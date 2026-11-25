// Turns a Facebook Lead Ad submission (Graph `field_data`) into the fields the CRM
// and the SMS agent read. Pure: no network, no database, so it can be tested with a
// sample payload.
//
// Where each answer goes:
//   identity (name, phone, email)      lead columns
//   street address                     leads.address, only when it is a real street
//   zip                                leads.zip
//   project type                       leads.job_type (via inferJobType)
//   every non-identity answer          metadata.form_answers  { "Question label": "answer" }
//   answers to qualifying questions    metadata.qualification { project_type, project_size, ... }
//   a readable one-line summary        leads.notes
//
// Multi-select questions arrive as several values; all of them are kept, joined
// with ", ". Nothing the homeowner typed is dropped.

import { inferJobType } from "@/lib/ai-engine"
import { isCompleteServiceAddress } from "@/lib/routing"
import { parseLeadPhone } from "@/lib/twilio"

export type LeadgenField = { name: string; values?: string[] | null }

/** One question from the form definition (`/{form_id}?fields=questions`). */
export type FormQuestion = { key?: string | null; label?: string | null; type?: string | null }

export type MappedLead = {
  phone: string | null
  /** Exactly what was typed in the phone field, kept when it does not parse */
  rawPhone: string
  email: string | null
  firstName: string | null
  lastName: string | null
  /** Only a complete street address; a bare city or zip never lands here */
  address: string | null
  zip: string | null
  /** leads.job_type enum value, or null when the answers do not name a floor type */
  jobType: string | null
  /** The raw project-type answer, as the homeowner picked it */
  projectTypeText: string | null
  formAnswers: Record<string, string>
  qualification: Record<string, string>
  notes: string | null
  /** Messenger thread id when the form ran inside Messenger */
  psid: string | null
  /** normalized key -> joined values, for callers that match on keys */
  fields: Record<string, string>
}

const normKey = (name: string) => name.toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "")

/** "what_type_of_flooring_are_you_looking_for" -> "What type of flooring are you looking for" */
export function deSnake(key: string): string {
  const s = key.replace(/_+/g, " ").trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key
}

// Meta's built-in contact fields. `name$` style checks below catch custom wordings.
const PHONE_KEYS = ["phone_number", "phone", "mobile_phone", "mobile", "cell_phone", "work_phone_number"]
const EMAIL_KEYS = ["email", "email_address", "work_email"]
const FIRST_KEYS = ["first_name", "firstname"]
const LAST_KEYS = ["last_name", "lastname"]
const FULL_KEYS = ["full_name", "name", "your_name", "what_is_your_name", "what_is_your_full_name"]
const STREET_KEYS = [
  "street_address", "address", "home_address", "lead_address", "property_address",
  "service_address", "full_address", "mailing_address",
]
const ZIP_KEYS = ["zip", "zip_code", "postal_code", "post_code", "zipcode"]
const THREAD_KEYS = ["inbox_url", "conversation_url"]

const looksLikePhone = (v: string) => {
  const digits = v.replace(/\D/g, "")
  return digits.length >= 10 && digits.length <= 15 && /^[+\d(]/.test(v.trim())
}

/**
 * Which qualifying question an answer belongs to. Checked in order: the specific
 * ones first, because "what flooring do you have now" also mentions flooring.
 * Keys match DEFAULT_QUALIFYING_QUESTIONS in lib/intake.ts.
 */
const QUALIFICATION_SYNONYMS: Array<{ key: string; re: RegExp }> = [
  { key: "current_floor",   re: /\b(current(ly)?|existing|right now|down now|today|replac\w*|old)\b.*\bfloor|\bfloor\w*\b.*\b(current(ly)?|existing|right now|have now|replac\w*)\b|\bwhat (is|s) down\b/ },
  { key: "financing",       re: /\bfinanc\w*|\bpayment plan|\bmonthly payment|\bpay(ing)? (outright|cash|in full)|\bhow (will|would) you (like to )?pay/ },
  { key: "budget",          re: /\bbudget|\bprice range|\bhow much (are you|do you) (looking|plan|want|hop)\w* to (spend|invest)|\bspend\b|\binvest\w*/ },
  { key: "decision_makers", re: /\bdecision|\bspouse|\bpartner\b|\bhusband|\bwife|\beveryone who decides|\bboth (be )?(home|present|there)|\ball (owners|decision)/ },
  { key: "homeowner",       re: /\bhome ?owner|\bown (the|your|this) (home|house|property)|\bdo you own\b|\bown or rent|\brent(er|ing)?\b|\bownership/ },
  { key: "timeline",        re: /\btime ?line|\btime ?frame|\bhow soon|\bwhen (are|do|would|will) you|\bwhen .*(start|done|install|ready|need|hoping|looking)|\bready to (start|move|begin)|\bstart date|\bproject start|\bhow quickly/ },
  { key: "project_size",    re: /\bsquare (feet|foot|footage)|\bsq\.? ?ft|\bsqft|\bhow (big|large|much (space|area))|\bhow many rooms|\bwhich rooms?|\bwhat rooms?|\brooms?\b|\bsize of|\barea (size|of)/ },
  { key: "project_type",    re: /\btype of floor|\bkind of floor|\bfloor\w* type|\bwhat floor|\bwhich floor|\bfloor\w* (are you|do you|you are)|\bproject type|\btype of project|\btype of service|\bservice (type|needed|requested|interest)|\bwhat (are you|service|type|kind)\b.*(looking|interested|need)|\bmaterial\b|\binterested in\b/ },
]

export function qualificationKeyFor(questionText: string): string | null {
  const t = ` ${questionText.toLowerCase().replace(/[_\-]+/g, " ").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()} `
  for (const { key, re } of QUALIFICATION_SYNONYMS) if (re.test(t)) return key
  return null
}

export function mapLeadgenFields(fieldData: LeadgenField[], questions: FormQuestion[] = []): MappedLead {
  // Question key -> human label, from the form definition when it could be read.
  const labelByKey = new Map<string, string>()
  for (const q of questions) {
    if (q?.key && q?.label?.trim()) labelByKey.set(normKey(q.key), q.label.trim().replace(/\s+/g, " "))
  }

  // Normalize: every value kept, joined. Insertion order = the order asked.
  const fields: Record<string, string> = {}
  const valuesByKey: Record<string, string[]> = {}
  for (const f of fieldData ?? []) {
    if (!f?.name) continue
    const key = normKey(f.name)
    const values = (f.values ?? []).map((v) => String(v ?? "").trim()).filter(Boolean)
    if (!key) continue
    valuesByKey[key] = [...(valuesByKey[key] ?? []), ...values]
    fields[key] = valuesByKey[key].join(", ")
  }

  const used = new Set<string>()
  const take = (keys: string[]): string => {
    for (const k of keys) if (fields[k]) { used.add(k); return fields[k] }
    return ""
  }

  // ── Phone: known keys, then any key that mentions a phone, then any value shaped like one.
  // A phone question answered in a sentence ("call me at 630 555 0187 ext 2") still yields
  // the number; when nothing parses, the words stay on the lead as "Phone (as typed)".
  let rawPhone = take(PHONE_KEYS)
  if (!rawPhone) {
    for (const [k, v] of Object.entries(fields)) {
      if (v && /phone|mobile|cell/.test(k)) { rawPhone = v; used.add(k); break }
    }
  }
  if (!rawPhone) {
    for (const [k, v] of Object.entries(fields)) {
      if (v && !THREAD_KEYS.includes(k) && !ZIP_KEYS.includes(k) && looksLikePhone(v) && !/\d{5}-\d{4}/.test(v)) {
        rawPhone = v; used.add(k); break
      }
    }
  }
  let phone = parseLeadPhone(rawPhone)
  if (!phone && rawPhone) {
    const inside = rawPhone.match(/(\+?1?[\s.-]*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})(?!\d)/)?.[1]
    if (inside) phone = parseLeadPhone(inside)
  }

  // ── Email
  let email = take(EMAIL_KEYS)
  if (!email) {
    for (const [k, v] of Object.entries(fields)) {
      if (v && (/email/.test(k) || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v))) { email = v; used.add(k); break }
    }
  }

  // ── Name
  const fullName = take(FULL_KEYS)
  const firstName = take(FIRST_KEYS) || fullName.split(/\s+/)[0] || null
  const lastName = take(LAST_KEYS) || (fullName.trim().includes(" ") ? fullName.trim().split(/\s+/).slice(1).join(" ") : null)

  // ── Messenger thread
  const inboxUrl = take(THREAD_KEYS)
  const psid = inboxUrl.match(/latest\/(\d{6,})/)?.[1] ?? null

  // ── Zip
  let zip = take(ZIP_KEYS).match(/\d{5}/)?.[0] ?? null
  if (!zip) {
    for (const [k, v] of Object.entries(fields)) {
      if (/zip|postal/.test(k) && /\d{5}/.test(v)) { zip = v.match(/\d{5}/)![0]; used.add(k); break }
    }
  }

  // ── Street address: stored only when it is a real street ("123 Main St"), never a bare city or zip.
  let streetRaw = ""
  for (const k of STREET_KEYS) if (fields[k]) { streetRaw = fields[k]; used.add(k); break }
  if (!streetRaw) {
    for (const [k, v] of Object.entries(fields)) {
      if (v && !used.has(k) && /address/.test(k) && !/email/.test(k)) { streetRaw = v; used.add(k); break }
    }
  }
  let address: string | null = null
  if (streetRaw && isCompleteServiceAddress(streetRaw)) {
    const parts = [streetRaw]
    const city = fields["city"]
    const state = fields["state"] || fields["province"]
    if (city && !streetRaw.toLowerCase().includes(city.toLowerCase())) parts.push(city)
    if (state && !new RegExp(`\\b${state.replace(/[^\w ]/g, "")}\\b`, "i").test(streetRaw)) parts.push(state)
    address = parts.join(", ")
    if (zip && !address.includes(zip)) address = `${address} ${zip}`
    if (!zip) zip = streetRaw.match(/\b\d{5}\b(?!.*\b\d{5}\b)/)?.[0] ?? null
  }

  // ── Everything else is an answer worth keeping.
  const formAnswers: Record<string, string> = {}
  const qualification: Record<string, string> = {}
  const noteParts: string[] = []
  let projectTypeText: string | null = null
  let projectTypeValues: string[] = []

  for (const [key, value] of Object.entries(fields)) {
    if (!value || used.has(key)) continue
    // Identity fields phrased as questions ("what_is_your_phone_number") were consumed
    // above when they parsed; when they did not parse they stay visible as answers.
    const label = labelByKey.get(key) ?? deSnake(key)
    formAnswers[label] = value

    const isLocationOnly = ["city", "state", "province", "country"].includes(key)
    const qKey = isLocationOnly ? null : qualificationKeyFor(`${key} ${label}`)
    if (qKey && !qualification[qKey]) qualification[qKey] = value
    if (qKey === "project_type" && !projectTypeText) {
      projectTypeText = value
      projectTypeValues = valuesByKey[key] ?? [value]
    }
    noteParts.push(`${label}: ${value}`)
  }
  // A street answer that was not a full address is still an answer the office should see.
  if (streetRaw && !address) {
    formAnswers["Address"] = streetRaw
    noteParts.push(`Address: ${streetRaw}`)
  }

  // Flooring type: the project-type answer first, then anything else they wrote.
  // When several floor types were ticked, the first one they ticked names the job;
  // all of them stay in form_answers and qualification.project_type.
  const jobType =
    projectTypeValues.map((v) => inferJobType(v)).find(Boolean) ??
    inferJobType(projectTypeText ?? "") ??
    inferJobType(Object.values(formAnswers).join(" ")) ??
    null

  if (zip) noteParts.push(`Zip: ${zip}`)
  if (rawPhone && !phone) noteParts.push(`Phone (as typed): ${rawPhone}`)

  return {
    phone,
    rawPhone,
    email: email ? email.toLowerCase() : null,
    firstName: firstName || null,
    lastName: lastName || null,
    address,
    zip,
    jobType,
    projectTypeText,
    formAnswers,
    qualification,
    notes: noteParts.length > 0 ? noteParts.join(" | ") : null,
    psid,
    fields,
  }
}

/** Ad attribution carried on the lead: metadata.ad */
export type LeadAdInfo = {
  ad_id: string | null
  ad_name: string | null
  adset_id: string | null
  adset_name: string | null
  campaign_id: string | null
  campaign_name: string | null
  form_id: string | null
  form_name: string | null
  platform: string | null
  is_organic: boolean | null
}

export function adInfoFromLeadgen(
  lead: Record<string, unknown>,
  formId: string | null,
  formName: string | null
): LeadAdInfo {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  return {
    ad_id: s(lead.ad_id),
    ad_name: s(lead.ad_name),
    adset_id: s(lead.adset_id),
    adset_name: s(lead.adset_name),
    campaign_id: s(lead.campaign_id),
    campaign_name: s(lead.campaign_name),
    form_id: s(lead.form_id) ?? formId,
    form_name: formName,
    platform: s(lead.platform),
    is_organic: typeof lead.is_organic === "boolean" ? lead.is_organic : null,
  }
}

/**
 * Merge a new submission's metadata over what the lead already carries. New answers
 * win question by question; nothing already on file is removed.
 */
export function mergeLeadFormMetadata(
  current: Record<string, unknown> | null | undefined,
  incoming: {
    leadgenId: string
    pageId: string
    formId: string
    formAnswers: Record<string, string>
    qualification: Record<string, string>
    ad: LeadAdInfo
    zip: string | null
  }
): Record<string, unknown> {
  const cur = { ...(current ?? {}) } as Record<string, unknown>
  const asRecord = (v: unknown): Record<string, string> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {}

  const previousIds = Array.isArray(cur.leadgen_ids) ? (cur.leadgen_ids as string[]) : []
  const priorId = typeof cur.leadgen_id === "string" ? cur.leadgen_id : null
  const leadgenIds = [...new Set([...previousIds, ...(priorId ? [priorId] : []), incoming.leadgenId])]

  // The same question can arrive as "Do you own the home?" (form definition readable) or
  // "Do you own the home" (not readable). Match on letters and digits only so a
  // re-submission updates the existing answer instead of adding a near-duplicate.
  const squash = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "")
  const formAnswers = { ...asRecord(cur.form_answers) }
  const existingKey = new Map(Object.keys(formAnswers).map((k) => [squash(k), k]))
  for (const [label, value] of Object.entries(incoming.formAnswers)) {
    formAnswers[existingKey.get(squash(label)) ?? label] = value
  }

  const hasAd = Object.values(incoming.ad).some((v) => v !== null && v !== undefined)
  return {
    ...cur,
    leadgen_id: incoming.leadgenId,
    leadgen_ids: leadgenIds,
    page_id: incoming.pageId,
    form_id: incoming.formId,
    form_answers: formAnswers,
    qualification: { ...asRecord(cur.qualification), ...incoming.qualification },
    ...(hasAd ? { ad: incoming.ad } : {}),
    ...(incoming.zip ? { service_zip: incoming.zip } : {}),
  }
}
