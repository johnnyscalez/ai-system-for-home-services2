/**
 * Turns a lead payload from ANY source (landing page form, Zapier, Make, GoHighLevel,
 * Typeform, a custom site) into one consistent shape, and decides where every field
 * goes on the lead:
 *
 *   contact fields   → the lead columns (name, phone, email, address, zip)
 *   project type     → leads.job_type (via inferJobType at the call site)
 *   qualifying info  → metadata.qualification[key]   (budget, timeline, size, ...)
 *   everything else  → metadata.form_answers[label]  (shown in the CRM, read by the AI)
 *   ad tracking      → metadata.utm
 *
 * Mapping is automatic from the field NAME (a wide alias table plus question-style
 * matching, so "What type of flooring are you interested in?" lands on project_type).
 * A company can override any field in Integrations → Lead webhook; those overrides
 * arrive here as `fieldMap` ({ "incoming key": "target" }) and always win.
 *
 * Nothing a form sends is ever dropped: a field that maps nowhere is still kept in
 * form_answers under a readable label.
 */

export type LeadTarget =
  | "first_name" | "last_name" | "full_name" | "phone" | "email"
  | "address" | "city" | "state" | "zip" | "notes" | "job_type" | "form_id"
  | "ignore"
  | `q:${string}`

export type MappedField = {
  /** The key exactly as the source sent it */
  key: string
  /** Where it went: a LeadTarget, or "form_answer" when it was kept as a custom answer */
  target: string
  value: string
  /** explicit = the company mapped it by hand, auto = matched by name, kept = stored as a form answer */
  how: "explicit" | "auto" | "kept"
}

export type NormalizedLead = {
  phone: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  address: string | null
  zip: string | null
  notes: string | null
  service_type: string | null
  /** Raw project-type text from the form, for inferJobType */
  job_type_raw: string | null
  source_form_id: string | null
  qualification: Record<string, string>
  form_answers: Record<string, string>
  utm: Record<string, string>
  /** Ready to store on leads.metadata */
  metadata: Record<string, unknown>
  /** How every incoming field was handled, for the mapping screen and for debugging */
  mapping: MappedField[]
}

/** Targets a company can choose in the mapping screen, with the label shown there. */
export const LEAD_TARGETS: Array<{ value: LeadTarget; label: string; group: string }> = [
  { value: "first_name", label: "First name", group: "Contact" },
  { value: "last_name", label: "Last name", group: "Contact" },
  { value: "full_name", label: "Full name", group: "Contact" },
  { value: "phone", label: "Mobile phone", group: "Contact" },
  { value: "email", label: "Email", group: "Contact" },
  { value: "address", label: "Street address", group: "Contact" },
  { value: "city", label: "City", group: "Contact" },
  { value: "state", label: "State", group: "Contact" },
  { value: "zip", label: "ZIP code", group: "Contact" },
  { value: "job_type", label: "Project type (flooring type)", group: "Project" },
  { value: "q:project_size", label: "Rooms / square footage", group: "Project" },
  { value: "q:timeline", label: "Timeline", group: "Project" },
  { value: "q:budget", label: "Budget", group: "Project" },
  { value: "q:homeowner", label: "Owns the home", group: "Project" },
  { value: "q:decision_makers", label: "Decision makers", group: "Project" },
  { value: "q:current_floor", label: "Current flooring", group: "Project" },
  { value: "q:financing", label: "Financing interest", group: "Project" },
  { value: "notes", label: "Notes / message", group: "Other" },
  { value: "form_id", label: "Form name or id", group: "Other" },
  { value: "ignore", label: "Do not save this field", group: "Other" },
]

const norm = (k: string) => k.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")

// Exact aliases, compared after norm(). Order inside a list does not matter.
const ALIASES: Record<string, string[]> = {
  phone: ["phone", "phone_number", "phonenumber", "mobile", "mobile_phone", "mobilephone", "mobile_number", "mobilenumber", "cell", "cell_phone", "cellphone", "telephone", "tel", "contact_phone", "contactphone", "phone_no", "your_phone", "best_phone", "best_number"],
  first_name: ["first_name", "firstname", "fname", "first", "given_name", "givenname"],
  last_name: ["last_name", "lastname", "lname", "last", "family_name", "familyname", "surname"],
  full_name: ["name", "full_name", "fullname", "contact_name", "contactname", "customer_name", "customername", "your_name"],
  email: ["email", "email_address", "emailaddress", "e_mail", "your_email"],
  address: ["address", "street_address", "streetaddress", "street", "address1", "address_1", "address_line_1", "property_address", "propertyaddress", "home_address", "service_address", "full_address"],
  city: ["city", "town"],
  state: ["state", "province", "region"],
  zip: ["zip", "zip_code", "zipcode", "postal_code", "postalcode", "postcode", "service_zip"],
  notes: ["notes", "note", "message", "messages", "comments", "comment", "description", "inquiry", "details", "detail", "additional_info", "additional_information", "anything_else", "how_can_we_help", "what_can_we_help_you_with", "tell_us_about_your_project", "project_details", "project_description"],
  job_type: ["project_type", "projecttype", "flooring_type", "flooringtype", "floor_type", "type_of_flooring", "type_of_floor", "flooring", "product", "product_type", "interested_in", "service_needed", "type_of_service", "job_type", "jobtype", "what_are_you_looking_for", "material"],
  "q:project_size": ["square_feet", "square_footage", "squarefootage", "sqft", "sq_ft", "project_size", "size", "rooms", "room", "which_rooms", "how_many_rooms", "number_of_rooms", "area", "areas"],
  "q:timeline": ["timeline", "timeframe", "time_frame", "project_timeline", "start_date", "how_soon", "when", "when_do_you_want_to_start", "urgency"],
  "q:budget": ["budget", "budget_range", "price_range", "project_budget", "investment", "estimated_budget"],
  "q:homeowner": ["homeowner", "home_owner", "own_home", "ownership", "own_or_rent", "do_you_own", "do_you_own_the_home", "do_you_own_your_home", "owner", "property_owner"],
  "q:decision_makers": ["decision_maker", "decision_makers", "decisionmaker", "who_decides", "spouse"],
  "q:current_floor": ["current_floor", "current_flooring", "existing_floor", "existing_flooring", "what_do_you_have_now"],
  "q:financing": ["financing", "finance", "payment", "payment_method", "interested_in_financing"],
  service_type: ["service_type", "servicetype", "service", "trade"],
  form_id: ["form_id", "formid", "form_name", "formname"],
}

// Question-style keys ("What type of flooring are you interested in?"): every word
// in one of the groups must appear in the normalized key.
const QUESTION_HINTS: Array<{ target: string; all: string[] }> = [
  { target: "job_type", all: ["type", "floor"] },
  { target: "job_type", all: ["kind", "floor"] },
  { target: "job_type", all: ["what", "floor"] },
  { target: "q:project_size", all: ["square"] },
  { target: "q:project_size", all: ["sq", "ft"] },
  { target: "q:project_size", all: ["how", "many", "room"] },
  { target: "q:project_size", all: ["which", "room"] },
  { target: "q:timeline", all: ["when"] },
  { target: "q:timeline", all: ["how", "soon"] },
  { target: "q:timeline", all: ["timeline"] },
  { target: "q:timeline", all: ["timeframe"] },
  { target: "q:budget", all: ["budget"] },
  { target: "q:homeowner", all: ["own", "home"] },
  { target: "q:homeowner", all: ["homeowner"] },
  { target: "q:homeowner", all: ["rent"] },
  { target: "q:decision_makers", all: ["decision"] },
  { target: "q:financing", all: ["financ"] },
  { target: "q:current_floor", all: ["current", "floor"] },
  { target: "zip", all: ["zip"] },
  { target: "zip", all: ["postal"] },
  { target: "email", all: ["email"] },
  { target: "phone", all: ["phone"] },
  { target: "address", all: ["street", "address"] },
]

const ALIAS_LOOKUP: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [target, keys] of Object.entries(ALIASES)) for (const k of keys) out[k] = target
  return out
})()

// Webhook plumbing: never a lead field, never stored.
const INFRA = new Set([
  "company_id", "companyid", "source", "webhook_secret", "secret", "key", "api_key", "apikey",
  "token", "password", "access_token", "submittedat", "submitted_at", "timestamp", "dry_run", "test",
])

const UTM_KEYS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "fbclid", "gclid", "ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name",
  "landing_page", "page_url", "referrer",
])

function autoTarget(key: string): string | null {
  const n = norm(key)
  if (!n) return null
  if (ALIAS_LOOKUP[n]) return ALIAS_LOOKUP[n]
  // A question-style key is long; a short unknown key ("color") is just a custom answer.
  if (n.length >= 8) {
    for (const hint of QUESTION_HINTS) {
      if (hint.all.every((w) => n.includes(w))) return hint.target
    }
  }
  return null
}

/** "project_timeline" → "Project timeline"; a real sentence is kept as written. */
export function labelForKey(key: string): string {
  const k = key.trim()
  if (/\s/.test(k) && /[a-z]/.test(k)) return k.replace(/\s+/g, " ").replace(/[?:]\s*$/, "")
  const words = k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-.]+/g, " ").trim().toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : k
}

function toText(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(", ")
  return ""
}

/**
 * Flattens nested objects (one or two levels: { data: { fields: { phone } } }) and the
 * common "array of { name|label|key, value }" shape (Typeform, Meta, many form tools)
 * into a single key → value map. Top-level keys win over nested ones.
 */
function flatten(raw: Record<string, unknown>): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = []
  const seen = new Set<string>()
  const push = (k: string, v: unknown) => {
    const id = norm(k)
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push([k, v])
  }
  const walk = (obj: Record<string, unknown>, depth: number) => {
    const nested: Array<Record<string, unknown>> = []
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
        const items = v as Array<Record<string, unknown>>
        const named = items.filter((x) => ("value" in x || "values" in x || "answer" in x) && (x.name || x.label || x.key || x.question || x.title))
        if (named.length > 0) {
          for (const x of named) {
            push(String(x.label ?? x.question ?? x.title ?? x.name ?? x.key), x.value ?? x.values ?? x.answer)
          }
          continue
        }
      }
      if (v && typeof v === "object" && !Array.isArray(v)) nested.push(v as Record<string, unknown>)
      else push(k, v)
    }
    if (depth < 2) for (const n of nested) walk(n, depth + 1)
  }
  walk(raw, 0)
  return out
}

export function normalizeLead(
  raw: Record<string, unknown>,
  fieldMap: Record<string, string> = {}
): NormalizedLead {
  const explicit: Record<string, string> = {}
  for (const [k, t] of Object.entries(fieldMap ?? {})) {
    if (typeof t === "string" && t.trim()) explicit[norm(k)] = t.trim()
  }

  const picked: Record<string, string> = {}
  const qualification: Record<string, string> = {}
  const form_answers: Record<string, string> = {}
  const utm: Record<string, string> = {}
  const mapping: MappedField[] = []

  for (const [key, rawValue] of flatten(raw)) {
    const n = norm(key)
    if (INFRA.has(n)) continue
    const value = toText(rawValue)
    if (!value) continue

    if (UTM_KEYS.has(n)) {
      utm[n] = value.slice(0, 300)
      continue
    }

    const byHand = explicit[n]
    const target = byHand ?? autoTarget(key)
    const how: MappedField["how"] = byHand ? "explicit" : target ? "auto" : "kept"

    if (target === "ignore") {
      mapping.push({ key, target: "ignore", value: value.slice(0, 80), how })
      continue
    }
    if (target && target.startsWith("q:")) {
      const qKey = norm(target.slice(2))
      if (qKey && !qualification[qKey]) qualification[qKey] = value.slice(0, 300)
      // Keep the readable copy too, so the CRM shows the question as the form asked it.
      form_answers[labelForKey(key)] = value.slice(0, 500)
      mapping.push({ key, target, value: value.slice(0, 80), how })
      continue
    }
    if (target) {
      // First one wins: "phone" beats a later "mobile" alias in the same payload.
      if (!picked[target]) picked[target] = value
      if (target === "job_type") form_answers[labelForKey(key)] = value.slice(0, 500)
      mapping.push({ key, target, value: value.slice(0, 80), how })
      continue
    }
    form_answers[labelForKey(key)] = value.slice(0, 500)
    mapping.push({ key, target: "form_answer", value: value.slice(0, 80), how: "kept" })
  }

  let firstName = picked.first_name ?? null
  let lastName = picked.last_name ?? null
  if (!firstName && picked.full_name) {
    const parts = picked.full_name.trim().split(/\s+/)
    firstName = parts[0] ?? null
    lastName = parts.length > 1 ? parts.slice(1).join(" ") : lastName
  }

  // City / state / zip sent as separate fields complete a street address.
  const zipMatch = (picked.zip ?? "").match(/\d{5}/)?.[0] ?? null
  let address = picked.address ?? null
  if (address) {
    const tail = [picked.city, picked.state].filter(Boolean).join(", ")
    const lower = address.toLowerCase()
    if (picked.city && !lower.includes(picked.city.toLowerCase())) address = `${address}, ${tail}`
    if (zipMatch && !address.includes(zipMatch)) address = `${address} ${zipMatch}`
  } else if (picked.city) {
    // Where they are, without a street: useful to the AI, not an address.
    form_answers["City"] = [picked.city, picked.state].filter(Boolean).join(", ")
  }

  const metadata: Record<string, unknown> = {}
  if (Object.keys(form_answers).length > 0) metadata.form_answers = form_answers
  if (Object.keys(qualification).length > 0) metadata.qualification = qualification
  if (Object.keys(utm).length > 0) metadata.utm = utm

  return {
    phone: picked.phone ?? null,
    first_name: firstName,
    last_name: lastName,
    email: picked.email ? picked.email.toLowerCase() : null,
    address,
    zip: zipMatch,
    notes: picked.notes ?? null,
    service_type: picked.service_type ?? null,
    job_type_raw: picked.job_type ?? null,
    source_form_id: picked.form_id ?? null,
    qualification,
    form_answers,
    utm,
    metadata,
    mapping,
  }
}

/** Merge a new submission's metadata into what a lead already has (new answers win). */
export function mergeLeadMetadata(
  current: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const cur = (current ?? {}) as Record<string, unknown>
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
  const out: Record<string, unknown> = { ...cur }
  for (const section of ["form_answers", "qualification", "utm"] as const) {
    const merged = { ...obj(cur[section]), ...obj(incoming[section]) }
    if (Object.keys(merged).length > 0) out[section] = merged
  }
  return out
}

// ── Source & channel taxonomy ─────────────────────────────────────────────────
// source  = where the lead came FROM (acquisition)
// channel = the medium we're TALKING to them on (conversation)

const SOURCE_ALIASES: Record<string, string> = {
  facebook: "facebook",
  facebook_lead_ads: "facebook",
  fb: "facebook",
  fb_lead_ads: "facebook",
  lead_ads: "facebook",
  meta: "facebook",
  instagram: "facebook",
  messenger: "messenger",
  facebook_messenger: "messenger",
  website: "website",
  web: "website",
  webform: "website",
  website_form: "website",
  landing_page: "website",
  landingpage: "website",
  form: "website",
  typeform: "typeform",
  google: "google",
  google_ads: "google",
  gmb: "google",
  sms: "sms_inbound",
  sms_inbound: "sms_inbound",
  text: "sms_inbound",
  phone: "voice_inbound",
  call: "voice_inbound",
  voice: "voice_inbound",
  voice_inbound: "voice_inbound",
  webhook: "webhook",
  manual: "manual",
}

export function normalizeSource(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "webhook"
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_")
  return SOURCE_ALIASES[key] ?? key
}

// The default conversation medium for a given source. Messenger leads are spoken
// to on Messenger; everything else, including a lead who first called, is texted.
export function channelForSource(source: string): string {
  return source === "messenger" ? "messenger" : "sms"
}
