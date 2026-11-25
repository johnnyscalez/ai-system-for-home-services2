// A2P 10DLC registration for a client's texting number.
//
// US carriers block texts from a local number that is not registered to a
// business ("A2P 10DLC"). Unregistered sends fail with Twilio error 30034, which
// is what happened to this account in July and August 2026: 796 of ~1,000 texts
// were blocked. So a client's number is only useful once its business is
// registered. This module does that registration through Twilio's ISV API:
//
//   FieldBuilt's Primary Customer Profile (must already be Twilio-approved)
//     └─ client Secondary Customer Profile  (legal name, EIN, address, a contact)
//          └─ A2P Trust Product
//               └─ Brand registration        (Low-Volume Standard)
//                    └─ Messaging Service + Campaign (LOW_VOLUME mixed)
//                         └─ the client's phone number in the service's sender pool
//
// It is a resumable state machine. Every Twilio resource SID is written to
// intake.a2p as soon as it exists, so a failure half way, or a second run, picks
// up where it stopped instead of creating duplicates. Brand and campaign review
// take days; refreshA2p() is polled by the cron and by the Settings screen.
//
// Hands-off, like an agency running its own Twilio: the client never presses a
// button. autoSubmitA2p() files the registration when onboarding finishes, when
// a number is bought, when Settings saves complete details, and on every cron
// pass, as soon as A2P_SUBMIT_ENABLED is on, the company has a number on
// FieldBuilt's Twilio and the details are complete. Every number the company
// has, including ones bought after approval, is put in its sender pool.
//
// Reference: twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv-api
//
// NOT covered: sole proprietors with no EIN. Twilio registers those through a
// different flow that needs a one-time code sent to the owner's mobile; those are
// registered by hand in the Twilio Console for now.

import { createServiceRoleClient } from "@/lib/supabase-server"
import { loadIntake, saveIntake, type A2pBusiness, type A2pState, type A2pStatus } from "@/lib/intake"
import { a2pDefaults, normalizeWebsite, withA2pDefaults } from "@/components/onboarding/logic"

const TRUSTHUB = "https://trusthub.twilio.com/v1"
const MESSAGING = "https://messaging.twilio.com/v1"
const SECONDARY_PROFILE_POLICY = "RNdfbf3fae0e1107f8aded0e7cead80bf5"
const A2P_TRUST_PRODUCT_POLICY = "RNb0d4771c2c98518d916a3d4cd70a8f8b"
const PRIMARY_PROFILE_POLICY = "RN6433641899984f951173ef1738c3bdd0"

type Params = Record<string, string | string[] | boolean | undefined>

class TwilioApiError extends Error {
  status: number
  code?: number
  constructor(message: string, status: number, code?: number) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function tw<T = Record<string, unknown>>(method: "GET" | "POST", url: string, params?: Params): Promise<T> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new TwilioApiError("Twilio credentials are not configured", 500)
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined) continue
    if (Array.isArray(v)) v.forEach((item) => body.append(k, item))
    else body.append(k, String(v))
  }
  const res = await fetch(method === "GET" && params ? `${url}?${body}` : url, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data as { message?: string; code?: number }
    throw new TwilioApiError(d.message ?? `Twilio returned ${res.status}`, res.status, d.code)
  }
  return data as T
}

// ── Business details ─────────────────────────────────────────────────────────

const BUSINESS_TYPES: Record<string, { twilio: string; companyType: string }> = {
  llc:         { twilio: "Limited Liability Corporation", companyType: "private" },
  corporation: { twilio: "Corporation", companyType: "private" },
  partnership: { twilio: "Partnership", companyType: "private" },
  non_profit:  { twilio: "Non-profit Corporation", companyType: "non-profit" },
}

/** What is still missing before a registration can be submitted. Empty = ready. */
export function a2pMissingFields(b: Partial<A2pBusiness> | undefined): string[] {
  const v = b ?? {}
  const missing: string[] = []
  const need = (ok: unknown, label: string) => { if (!ok) missing.push(label) }
  need(v.legalName?.trim(), "Legal business name")
  need(v.businessType?.trim(), "Business type")
  if (v.businessType !== "sole_proprietor") need(/^\d{9}$/.test((v.ein ?? "").replace(/\D/g, "")), "EIN (9 digits)")
  need(v.street?.trim(), "Street address")
  need(v.city?.trim(), "City")
  need(/^[A-Za-z]{2}$/.test((v.state ?? "").trim()), "State")
  need(/^\d{5}$/.test((v.zip ?? "").trim()), "ZIP code")
  need(/^https?:\/\/\S+\.\S+/.test(normalizeWebsite(v.website ?? "")), "Website")
  need(v.repFirstName?.trim(), "Contact first name")
  need(v.repLastName?.trim(), "Contact last name")
  need(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v.repEmail ?? "").trim()), "Contact email")
  need((v.repPhone ?? "").replace(/\D/g, "").length >= 10, "Contact mobile number")
  return missing
}

function jobPosition(title: string | undefined): string {
  const t = (title ?? "").toLowerCase()
  if (/ceo|owner|president|founder|principal/.test(t)) return "CEO"
  if (/cfo|finance/.test(t)) return "CFO"
  if (/general manager|\bgm\b/.test(t)) return "GM"
  if (/vice|\bvp\b/.test(t)) return "VP"
  if (/director/.test(t)) return "Director"
  return "Other"
}

const e164 = (raw: string) => {
  const d = raw.replace(/\D/g, "")
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : `+${d}`
}

// ── State helpers ────────────────────────────────────────────────────────────

type Ctx = {
  companyId: string
  companyName: string
  state: A2pState
  save: (patch: Partial<A2pState>) => Promise<void>
}

async function context(companyId: string): Promise<Ctx> {
  const db = createServiceRoleClient()
  const [{ data: company }, intake] = await Promise.all([
    db.from("companies").select("name").eq("id", companyId).maybeSingle(),
    loadIntake(db, companyId),
  ])
  const state: A2pState = { status: "not_started", ...(intake.a2p ?? {}) }
  return {
    companyId,
    companyName: (company?.name as string | undefined) ?? "Company",
    state,
    save: async (patch) => {
      Object.assign(state, patch, { updatedAt: new Date().toISOString() })
      await saveIntake(db, companyId, { a2p: { ...state } })
    },
  }
}

/** Create-once: returns the saved SID for `key`, or runs `create` and saves the result. */
async function once(ctx: Ctx, key: string, create: () => Promise<string>): Promise<string> {
  const existing = ctx.state.resources?.[key]
  if (existing) return existing
  const sid = await create()
  await ctx.save({ resources: { ...(ctx.state.resources ?? {}), [key]: sid } })
  return sid
}

export function publicA2pState(state: A2pState | undefined): {
  status: A2pStatus
  label: string
  detail: string
  missing: string[]
  canSubmit: boolean
  brandStatus: string | null
  campaignStatus: string | null
  lastError: string | null
} {
  const s: A2pState = state ?? { status: "not_started" }
  const missing = a2pMissingFields(s.business)
  const labels: Record<A2pStatus, [string, string]> = {
    not_started:      ["Not registered", "US carriers block texts from an unregistered number. Add the legal business name, business type and EIN to start."],
    info_collected:   ["Details saved", "FieldBuilt files the registration for you once your number is reserved and setup is finished."],
    submitted:        ["Submitted", "The business profile is with Twilio for review."],
    brand_pending:    ["Business under review", "Carriers are verifying the business. This usually takes a few business days."],
    campaign_pending: ["Texting use under review", "The business is verified. Carriers are reviewing how the number will be used, usually a few more days."],
    approved:         ["Registered", "The number is registered with US carriers. Texts deliver normally."],
    rejected:         ["Rejected", "The carriers did not accept the registration. FieldBuilt will sort it out with you."],
    error:            ["Needs attention", "The registration stopped. FieldBuilt retries it on its own and will contact you if a detail needs fixing."],
  }
  const [label, detail] = labels[s.status] ?? labels.not_started
  return {
    status: s.status,
    label,
    detail,
    missing,
    canSubmit: missing.length === 0 && ["not_started", "info_collected", "error", "rejected"].includes(s.status) && s.business?.businessType !== "sole_proprietor",
    brandStatus: s.brandStatus ?? null,
    campaignStatus: s.campaignStatus ?? null,
    lastError: s.lastError ?? null,
  }
}

// ── Save details ─────────────────────────────────────────────────────────────

export async function saveA2pBusiness(companyId: string, business: Partial<A2pBusiness>): Promise<A2pState> {
  const ctx = await context(companyId)
  const merged = { ...(ctx.state.business ?? {}), ...business }
  const next: Partial<A2pState> = { business: merged }
  if (ctx.state.status === "not_started" && a2pMissingFields(merged).length === 0) next.status = "info_collected"
  await ctx.save(next)
  return ctx.state
}

// ── Submit ───────────────────────────────────────────────────────────────────

/** Is submitting switched on for this deployment? Off by default: a submission costs money and files a legal registration. */
export function a2pSubmitEnabled(): boolean {
  return process.env.A2P_SUBMIT_ENABLED === "true"
}

async function primaryProfileSid(): Promise<{ sid: string } | { error: string }> {
  const configured = process.env.TWILIO_PRIMARY_PROFILE_SID
  const list = await tw<{ results?: Array<{ sid: string; status: string; policy_sid: string; friendly_name: string }> }>(
    "GET", `${TRUSTHUB}/CustomerProfiles`, { PageSize: "50" }
  )
  const profiles = list.results ?? []
  const primary = configured
    ? profiles.find((p) => p.sid === configured)
    : profiles.find((p) => p.policy_sid === PRIMARY_PROFILE_POLICY)
  if (!primary) {
    return { error: "FieldBuilt has no primary business profile in Twilio Trust Hub yet. Create and submit it in the Twilio Console first." }
  }
  if (primary.status !== "twilio-approved") {
    return { error: `FieldBuilt's own business profile in Twilio Trust Hub is "${primary.status}", not approved. Twilio only accepts client registrations under an approved primary profile. Finish and submit it in the Twilio Console (Trust Hub → Customer Profiles).` }
  }
  return { sid: primary.sid }
}

/**
 * One filing per company at a time in this process. The cron, the end of
 * onboarding and a Settings save can all start one; two at once would each
 * create a business profile before either saved its SID.
 */
const filing = new Map<string, Promise<A2pState>>()

/**
 * Run the registration as far as it can go right now: profile, trust product,
 * brand. The rest (messaging service, campaign, number) happens in refreshA2p
 * once the carriers approve the brand.
 */
export function submitA2p(companyId: string): Promise<A2pState> {
  const running = filing.get(companyId)
  if (running) return running
  const run = submitNow(companyId).finally(() => filing.delete(companyId))
  filing.set(companyId, run)
  return run
}

async function submitNow(companyId: string): Promise<A2pState> {
  const ctx = await context(companyId)
  const b = ctx.state.business ?? {}
  const fail = async (message: string, status: A2pStatus = "error") => {
    await ctx.save({ status, lastError: message })
    return ctx.state
  }

  const missing = a2pMissingFields(b)
  if (missing.length > 0) return fail(`Missing: ${missing.join(", ")}`, "info_collected")
  if (b.businessType === "sole_proprietor") {
    return fail("Sole proprietors with no EIN are registered by hand: Twilio needs a one-time code confirmed from the owner's mobile. FieldBuilt will complete this registration with you.", "info_collected")
  }
  if (["submitted", "brand_pending", "campaign_pending", "approved"].includes(ctx.state.status)) return ctx.state
  if (!a2pSubmitEnabled()) {
    return fail("Automatic submission is switched off (A2P_SUBMIT_ENABLED). The details are saved and FieldBuilt will submit the registration.", "info_collected")
  }
  const isvEmail = process.env.A2P_CONTACT_EMAIL
  if (!isvEmail) return fail("A2P_CONTACT_EMAIL is not set. Twilio needs FieldBuilt's contact email on every client profile.")

  try {
    const primary = await primaryProfileSid()
    if ("error" in primary) return fail(primary.error)

    const type = BUSINESS_TYPES[b.businessType ?? ""] ?? BUSINESS_TYPES.llc
    const ein = (b.ein ?? "").replace(/\D/g, "")
    const label = `${ctx.companyName} (FieldBuilt client)`

    // 1. Secondary customer profile
    const profileSid = ctx.state.customerProfileSid ?? await (async () => {
      const r = await tw<{ sid: string }>("POST", `${TRUSTHUB}/CustomerProfiles`, {
        FriendlyName: label, Email: isvEmail, PolicySid: SECONDARY_PROFILE_POLICY,
      })
      await ctx.save({ customerProfileSid: r.sid })
      return r.sid
    })()
    const assignToProfile = (key: string, objectSid: string) => once(ctx, `assign:${key}`, async () => {
      const r = await tw<{ sid: string }>("POST", `${TRUSTHUB}/CustomerProfiles/${profileSid}/EntityAssignments`, { ObjectSid: objectSid })
      return r.sid
    })

    const businessInfo = await once(ctx, "endUser:business", async () => (await tw<{ sid: string }>("POST", `${TRUSTHUB}/EndUsers`, {
      FriendlyName: `${label} business information`,
      Type: "customer_profile_business_information",
      Attributes: JSON.stringify({
        business_name: b.legalName!.trim(),
        business_identity: "direct_customer",
        business_type: type.twilio,
        business_industry: "CONSTRUCTION",
        business_registration_identifier: "EIN",
        business_registration_number: `${ein.slice(0, 2)}-${ein.slice(2)}`,
        business_regions_of_operation: "USA_AND_CANADA",
        website_url: normalizeWebsite(b.website!),
      }),
    })).sid)
    await assignToProfile("business", businessInfo)

    const rep = await once(ctx, "endUser:rep", async () => (await tw<{ sid: string }>("POST", `${TRUSTHUB}/EndUsers`, {
      FriendlyName: `${label} authorized representative`,
      Type: "authorized_representative_1",
      Attributes: JSON.stringify({
        first_name: b.repFirstName!.trim(),
        last_name: b.repLastName!.trim(),
        email: b.repEmail!.trim(),
        phone_number: e164(b.repPhone!),
        business_title: b.repTitle?.trim() || "Owner",
        job_position: jobPosition(b.repTitle),
      }),
    })).sid)
    await assignToProfile("rep", rep)

    const address = await once(ctx, "address", async () => (await tw<{ sid: string }>(
      "POST", `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Addresses.json`, {
        CustomerName: b.legalName!.trim(), Street: b.street!.trim(), City: b.city!.trim(),
        Region: b.state!.trim().toUpperCase(), PostalCode: b.zip!.trim(), IsoCountry: "US", FriendlyName: label,
      })).sid)
    const addressDoc = await once(ctx, "document:address", async () => (await tw<{ sid: string }>("POST", `${TRUSTHUB}/SupportingDocuments`, {
      FriendlyName: `${label} address`, Type: "customer_profile_address", Attributes: JSON.stringify({ address_sids: address }),
    })).sid)
    await assignToProfile("address", addressDoc)
    await assignToProfile("primary", primary.sid)

    if (!ctx.state.resources?.["profile:submitted"]) {
      const evaluation = await tw<{ status: string; results?: unknown }>(
        "POST", `${TRUSTHUB}/CustomerProfiles/${profileSid}/Evaluations`, { PolicySid: SECONDARY_PROFILE_POLICY })
      if (evaluation.status !== "compliant") {
        return fail(`Twilio says the business profile is incomplete: ${summarizeEvaluation(evaluation.results)}`)
      }
      await tw("POST", `${TRUSTHUB}/CustomerProfiles/${profileSid}`, { Status: "pending-review" })
      await ctx.save({ resources: { ...(ctx.state.resources ?? {}), "profile:submitted": new Date().toISOString() } })
    }

    // 2. A2P trust product
    const trustSid = ctx.state.trustProductSid ?? await (async () => {
      const r = await tw<{ sid: string }>("POST", `${TRUSTHUB}/TrustProducts`, {
        FriendlyName: `${label} A2P profile`, Email: isvEmail, PolicySid: A2P_TRUST_PRODUCT_POLICY,
      })
      await ctx.save({ trustProductSid: r.sid })
      return r.sid
    })()
    const assignToTrust = (key: string, objectSid: string) => once(ctx, `trustAssign:${key}`, async () => {
      const r = await tw<{ sid: string }>("POST", `${TRUSTHUB}/TrustProducts/${trustSid}/EntityAssignments`, { ObjectSid: objectSid })
      return r.sid
    })
    const a2pInfo = await once(ctx, "endUser:a2p", async () => (await tw<{ sid: string }>("POST", `${TRUSTHUB}/EndUsers`, {
      FriendlyName: `${label} A2P messaging profile`,
      Type: "us_a2p_messaging_profile_information",
      Attributes: JSON.stringify({ company_type: type.companyType }),
    })).sid)
    await assignToTrust("a2p", a2pInfo)
    await assignToTrust("profile", profileSid)

    if (!ctx.state.resources?.["trust:submitted"]) {
      const evaluation = await tw<{ status: string; results?: unknown }>(
        "POST", `${TRUSTHUB}/TrustProducts/${trustSid}/Evaluations`, { PolicySid: A2P_TRUST_PRODUCT_POLICY })
      if (evaluation.status !== "compliant") {
        return fail(`Twilio says the A2P profile is incomplete: ${summarizeEvaluation(evaluation.results)}`)
      }
      await tw("POST", `${TRUSTHUB}/TrustProducts/${trustSid}`, { Status: "pending-review" })
      await ctx.save({ resources: { ...(ctx.state.resources ?? {}), "trust:submitted": new Date().toISOString() } })
    }

    // 3. Brand. SkipAutomaticSecVet = a Low-Volume Standard brand (under 6,000
    //    message segments a day), which is every flooring contractor.
    if (!ctx.state.brandSid) {
      const brand = await tw<{ sid: string; status: string }>("POST", `${MESSAGING}/a2p/BrandRegistrations`, {
        CustomerProfileBundleSid: profileSid,
        A2PProfileBundleSid: trustSid,
        SkipAutomaticSecVet: true,
        ...(process.env.A2P_MOCK === "true" ? { Mock: true } : {}),
      })
      await ctx.save({ brandSid: brand.sid, brandStatus: brand.status })
    }

    await ctx.save({ status: "brand_pending", lastError: null, submittedAt: ctx.state.submittedAt ?? new Date().toISOString() })
    return ctx.state
  } catch (err) {
    const e = err as TwilioApiError
    console.error(`[a2p] submit failed for company ${companyId}:`, e)
    return fail(`Twilio: ${e.message}${e.code ? ` (code ${e.code})` : ""}`)
  }
}

// ── Hands-off: the client never files anything ───────────────────────────────

/** The company's active numbers on FieldBuilt's Twilio account. */
async function twilioNumbers(companyId: string): Promise<Array<{ sid: string; phone: string }>> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from("phone_numbers").select("twilio_sid, phone_number").eq("company_id", companyId).eq("is_active", true)
  return ((data ?? []) as Array<{ twilio_sid: string | null; phone_number: string }>)
    .filter((n) => !!n.twilio_sid)
    .map((n) => ({ sid: n.twilio_sid as string, phone: n.phone_number }))
}

/**
 * Puts every active number of the company in its registered sender pool, so a
 * number bought or replaced after approval texts under the same registration.
 * Numbers already in the pool are skipped; a failure is retried by the cron.
 */
async function attachNumbers(ctx: Ctx, serviceSid: string): Promise<number> {
  let added = 0
  for (const n of await twilioNumbers(ctx.companyId)) {
    const key = `number:${n.sid}`
    if (ctx.state.resources?.[key]) continue
    try {
      await once(ctx, key, async () =>
        (await tw<{ sid: string }>("POST", `${MESSAGING}/Services/${serviceSid}/PhoneNumbers`, { PhoneNumberSid: n.sid })).sid)
      added++
      console.log(`[a2p] ${n.phone} added to the registered sender pool of company ${ctx.companyId}`)
    } catch (err) {
      // Already in this pool (added by hand, or a save that failed after the add): record it.
      const inPool = await tw("GET", `${MESSAGING}/Services/${serviceSid}/PhoneNumbers/${n.sid}`).then(() => true, () => false)
      if (inPool) {
        await ctx.save({ resources: { ...(ctx.state.resources ?? {}), [key]: n.sid } })
        continue
      }
      console.error(`[a2p] could not add ${n.phone} to the sender pool of company ${ctx.companyId}:`, err)
    }
  }
  return added
}

/** After a number is bought: if the company is already registered, the number joins the registration. */
export async function attachNewNumbers(companyId: string): Promise<number> {
  const ctx = await context(companyId)
  if (!ctx.state.messagingServiceSid) return 0
  return attachNumbers(ctx, ctx.state.messagingServiceSid)
}

/** Statuses a filing starts (or, for an error, resumes) from without anyone pressing a button. */
const AUTO_FILE_FROM: A2pStatus[] = ["not_started", "info_collected", "error"]

/**
 * Files the registration when everything is in place, with no button for the
 * client: the switch is on, onboarding is finished, the company has a number
 * on FieldBuilt's Twilio, and the details are complete once the business-step
 * defaults are filled in. Returns null when it is not time yet.
 *
 * The number check also keeps test and demo companies (no real number) from
 * ever being filed.
 */
export async function autoSubmitA2p(companyId: string): Promise<A2pState | null> {
  if (!a2pSubmitEnabled()) return null
  const db = createServiceRoleClient()
  const [{ data: company }, intake] = await Promise.all([
    db.from("companies")
      .select("name, office_address, notification_phone, onboarding_completed, service_type")
      .eq("id", companyId).maybeSingle(),
    loadIntake(db, companyId),
  ])
  if (!company?.onboarding_completed || company.service_type === "fieldbuilt_sales") return null
  if (!AUTO_FILE_FROM.includes(intake.a2p?.status ?? "not_started")) return null
  if ((await twilioNumbers(companyId)).length === 0) return null

  const business = withA2pDefaults(intake.a2p?.business, a2pDefaults({
    companyName: company.name as string | null,
    officeAddress: company.office_address as string | null,
    ownerMobile: company.notification_phone as string | null,
    business: intake.business,
  }))
  // Sole proprietors need a code from the owner's phone: FieldBuilt files those by hand.
  if (business.businessType === "sole_proprietor" || a2pMissingFields(business).length > 0) return null

  await saveA2pBusiness(companyId, business)
  console.log(`[a2p] filing the carrier registration for company ${companyId}`)
  return submitA2p(companyId)
}

function summarizeEvaluation(results: unknown): string {
  try {
    const failures: string[] = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return
      if (Array.isArray(node)) { node.forEach(walk); return }
      const o = node as Record<string, unknown>
      if (o.passed === false && typeof o.failure_reason === "string") failures.push(o.failure_reason)
      Object.values(o).forEach(walk)
    }
    walk(results)
    return failures.length ? [...new Set(failures)].slice(0, 4).join("; ") : "see the Trust Hub evaluation in the Twilio Console"
  } catch {
    return "see the Trust Hub evaluation in the Twilio Console"
  }
}

// ── Poll and advance ─────────────────────────────────────────────────────────

/** Campaign wording. It must describe how leads really opt in, so it is built from the company's own details. */
function campaignCopy(companyName: string, website: string, privacyUrl: string, termsUrl: string) {
  return {
    Description:
      `${companyName} is a flooring contractor. This campaign sends conversational texts to homeowners who asked ${companyName} for a flooring quote: ` +
      `answering their request, asking about their project, scheduling an in-home measure, appointment confirmations and reminders, and follow-up on the quote they received.`,
    MessageFlow:
      `Homeowners opt in by submitting a quote request form for ${companyName}, either on its website (${website}) or on a Facebook or Instagram lead form. ` +
      `They enter their mobile number themselves, and the form states next to the submit button: "By submitting, you agree to receive text messages from ${companyName} about your request, ` +
      `including appointment scheduling and reminders. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help." ` +
      `The form links to the privacy policy (${privacyUrl}) and terms (${termsUrl}). Consent is not a condition of purchase. Mobile numbers are never shared or sold for marketing.`,
    MessageSamples: [
      `Hi Sarah, it's Mia, the AI assistant with ${companyName}. Thanks for asking about new floors. Which rooms are you looking to do? Reply STOP to opt out.`,
      `${companyName}: Your in-home measure is confirmed for Tuesday, March 4 at 9:00 AM at 123 Main St. Reply RESCHEDULE or CANCEL if needed.`,
      `${companyName}: Reminder, your in-home measure is tomorrow at 9:00 AM. Reply to reschedule or cancel.`,
    ],
  }
}

export function legalUrls(companyId: string, business: Partial<A2pBusiness> | undefined) {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "https://fieldbuiltai.com").replace(/\/$/, "")
  return {
    privacy: business?.privacyPolicyUrl?.trim() || `${app}/legal/${companyId}/privacy`,
    terms: business?.termsUrl?.trim() || `${app}/legal/${companyId}/terms`,
  }
}

/**
 * Check where the registration stands with Twilio and take the next step if it
 * is ready: brand approved → messaging service + campaign + number; campaign
 * verified → approved. Safe to call as often as you like.
 */
export async function refreshA2p(companyId: string): Promise<A2pState> {
  const ctx = await context(companyId)
  const s = ctx.state
  // A number bought or replaced after the business was approved joins the registration too.
  if (s.messagingServiceSid && ["campaign_pending", "approved"].includes(s.status)) {
    await attachNumbers(ctx, s.messagingServiceSid).catch((err) => console.error(`[a2p] number check failed for company ${companyId}:`, err))
  }
  if (!s.brandSid || !["brand_pending", "campaign_pending", "submitted"].includes(s.status)) return s

  try {
    if (s.status !== "campaign_pending") {
      const brand = await tw<{ status: string; failure_reason?: string | null; errors?: unknown[] }>(
        "GET", `${MESSAGING}/a2p/BrandRegistrations/${s.brandSid}`)
      await ctx.save({ brandStatus: brand.status })
      if (brand.status === "FAILED" || brand.status === "SUSPENDED") {
        await ctx.save({ status: "rejected", lastError: `Brand ${brand.status.toLowerCase()}: ${brand.failure_reason || JSON.stringify(brand.errors ?? []).slice(0, 300) || "no reason given"}` })
        return s
      }
      if (brand.status !== "APPROVED") return s

      // Brand approved: messaging service, the number, then the campaign.
      const app = (process.env.NEXT_PUBLIC_APP_URL ?? "https://fieldbuiltai.com").replace(/\/$/, "")
      const serviceSid = s.messagingServiceSid ?? await (async () => {
        const r = await tw<{ sid: string }>("POST", `${MESSAGING}/Services`, {
          FriendlyName: `FieldBuilt — ${ctx.companyName}`.slice(0, 64),
          // Each number keeps its own inbound webhook, so nothing about routing changes.
          UseInboundWebhookOnNumber: true,
          InboundRequestUrl: `${app}/api/webhooks/sms`,
          StatusCallback: `${app}/api/webhooks/sms-status`,
        })
        await ctx.save({ messagingServiceSid: r.sid })
        return r.sid
      })()

      await attachNumbers(ctx, serviceSid)

      if (!s.campaignSid) {
        const urls = legalUrls(companyId, s.business)
        const copy = campaignCopy(ctx.companyName, normalizeWebsite(s.business?.website ?? "") || app, urls.privacy, urls.terms)
        const campaign = await tw<{ sid: string; campaign_status: string }>("POST", `${MESSAGING}/Services/${serviceSid}/Compliance/Usa2p`, {
          BrandRegistrationSid: s.brandSid,
          UsAppToPersonUsecase: "LOW_VOLUME",
          Description: copy.Description,
          MessageFlow: copy.MessageFlow,
          MessageSamples: copy.MessageSamples,
          HasEmbeddedLinks: false,
          HasEmbeddedPhone: false,
          SubscriberOptIn: true,
          AgeGated: false,
          DirectLending: false,
          PrivacyPolicyUrl: urls.privacy,
          TermsAndConditionsUrl: urls.terms,
        })
        await ctx.save({ campaignSid: campaign.sid, campaignStatus: campaign.campaign_status })
      }
      await ctx.save({ status: "campaign_pending", lastError: null })
      return s
    }

    const campaign = await tw<{ campaign_status: string; errors?: unknown[] }>(
      "GET", `${MESSAGING}/Services/${s.messagingServiceSid}/Compliance/Usa2p/${s.campaignSid}`)
    await ctx.save({ campaignStatus: campaign.campaign_status })
    if (campaign.campaign_status === "VERIFIED") {
      await ctx.save({ status: "approved", approvedAt: new Date().toISOString(), lastError: null })
    } else if (campaign.campaign_status === "FAILED" || campaign.campaign_status === "SUSPENDED") {
      await ctx.save({ status: "rejected", lastError: `Campaign ${campaign.campaign_status.toLowerCase()}: ${JSON.stringify(campaign.errors ?? []).slice(0, 400) || "no reason given"}` })
    }
    return s
  } catch (err) {
    const e = err as TwilioApiError
    console.error(`[a2p] refresh failed for company ${companyId}:`, e)
    await ctx.save({ lastError: `Twilio: ${e.message}${e.code ? ` (code ${e.code})` : ""}` })
    return s
  }
}

/**
 * The cron's pass over every client company:
 *   - not filed yet (or stopped on an error): file it, once everything is in place
 *   - under review: check with Twilio and take the next step
 *   - approved: add any number bought since
 */
export async function refreshAllPendingA2p(): Promise<{ filed: number; checked: number; approved: number }> {
  const db = createServiceRoleClient()
  const { data: companies } = await db
    .from("companies").select("id, service_type").eq("onboarding_completed", true).limit(500)
  let filed = 0, checked = 0, approved = 0
  for (const c of (companies ?? []) as Array<{ id: string; service_type: string | null }>) {
    if (c.service_type === "fieldbuilt_sales") continue
    try {
      const intake = await loadIntake(db, c.id).catch(() => null)
      const status = intake?.a2p?.status ?? "not_started"
      if (AUTO_FILE_FROM.includes(status)) {
        const next = await autoSubmitA2p(c.id)
        if (next && next.status === "brand_pending") filed++
        continue
      }
      if (status === "approved") {
        await refreshA2p(c.id)
        continue
      }
      if (!["submitted", "brand_pending", "campaign_pending"].includes(status)) continue
      checked++
      const next = await refreshA2p(c.id)
      if (next.status === "approved") approved++
    } catch (err) {
      console.error(`[a2p] cron pass failed for company ${c.id}:`, err)
    }
  }
  return { filed, checked, approved }
}
