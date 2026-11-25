// Pure wizard logic: the shape of what the wizard edits, per-step defaults,
// validation and the launch checklist. Client-safe, and also imported by the
// server routes so both sides agree on what "ready to launch" means.

import {
  DEFAULT_QUALIFYING_QUESTIONS,
  DEFAULT_QUALIFICATION_RULES,
  DEFAULT_MEASURE_WINDOWS,
  offerHeadline,
} from "@/lib/intake"
import type { A2pBusiness, CompanyIntake, OfferConfig } from "@/lib/intake"
import type { StepId } from "./constants"

export type WizardCompany = { name: string; office_address: string; notification_phone: string }

export type WizardKb = {
  website_url: string
  business_description: string
  services_offered: string
  unique_selling_points: string
  certifications: string
  testimonials: string
  financing_options: string
  /** The owner's own pricing notes. The offer lines are generated from the offer step. */
  pricing_info: string
  custom_ai_knowledge: string
}

export type WizardAgent = {
  agent_name: string
  tone: string
  working_hours_start: number
  working_hours_end: number
  timezone: string
  custom_instructions: string
}

export type WizardData = {
  company: WizardCompany
  kb: WizardKb
  agent: WizardAgent
  intake: CompanyIntake
}

export type ScanSummary = {
  url: string
  scannedAt: string
  imageUrls: string[]
  logoUrl: string | null
  brandColor: string | null
  socialLinks: Record<string, string>
  phone: string | null
  serviceAreas: string | null
  pagesRead: number
}

export type WizardContext = {
  companyId: string | null
  onboardingCompleted: boolean
  phoneNumber: string | null
  facebook: { connected: boolean; pageName: string | null; adAccountId: string | null }
  gmailConnected: boolean
  googlePlaces: boolean
  scan: ScanSummary | null
  user: { fullName: string; email: string }
}

export const EMPTY_KB: WizardKb = {
  website_url: "", business_description: "", services_offered: "", unique_selling_points: "",
  certifications: "", testimonials: "", financing_options: "", pricing_info: "", custom_ai_knowledge: "",
}

export const DEFAULT_AGENT: WizardAgent = {
  agent_name: "Mia",
  tone: "friendly_professional",
  working_hours_start: 8,
  working_hours_end: 20,
  timezone: "America/New_York",
  custom_instructions: "",
}

// ── Section defaults ─────────────────────────────────────────────────────────
// A section stays undefined in the saved intake until the owner has actually
// been through its step. Steps read through these getters; continuing past a
// step commits what was on screen (commitStepDefaults).

export function servicesOf(intake: CompanyIntake): NonNullable<CompanyIntake["services"]> {
  return intake.services ?? { flooringTypes: [], propertyScope: "residential", notOffered: "" }
}

export function qualificationOf(intake: CompanyIntake): NonNullable<CompanyIntake["qualification"]> {
  return intake.qualification ?? {
    questions: DEFAULT_QUALIFYING_QUESTIONS.map((q) => ({ ...q })),
    rules: { ...DEFAULT_QUALIFICATION_RULES },
  }
}

export function offersOf(intake: CompanyIntake): NonNullable<CompanyIntake["offers"]> {
  return intake.offers ?? { primary: null, secondary: [], measureIsFree: true, measureFee: "" }
}

export function assetsOf(intake: CompanyIntake): NonNullable<CompanyIntake["assets"]> {
  return intake.assets ?? { photos: [], websiteImages: [], logoUrl: null, brandColor: null }
}

export function calendarOf(intake: CompanyIntake): NonNullable<CompanyIntake["calendar"]> {
  return intake.calendar ?? {
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    windows: DEFAULT_MEASURE_WINDOWS.map((w) => ({ ...w })),
    capacity: 1,
    minLeadDays: 1,
    measureDurationMin: 60,
    estimatorName: "",
    estimatorPhone: "",
  }
}

/** Writes the on-screen defaults of a step into the intake when the owner moves past it. */
export function commitStepDefaults(step: StepId, data: WizardData): WizardData {
  const intake = { ...data.intake }
  if (step === "customer") {
    intake.services = servicesOf(intake)
    intake.qualification = qualificationOf(intake)
  }
  if (step === "offer") intake.offers = offersOf(intake)
  if (step === "photos") intake.assets = assetsOf(intake)
  if (step === "calendar") intake.calendar = calendarOf(intake)
  return { ...data, intake }
}

// ── Small validators ─────────────────────────────────────────────────────────

export function isUsPhone(raw: string | null | undefined): boolean {
  const d = (raw ?? "").replace(/\D/g, "")
  return (d.length === 10 && /^[2-9]/.test(d)) || (d.length === 11 && d.startsWith("1") && /^[2-9]/.test(d.slice(1)))
}

export function isEmail(raw: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((raw ?? "").trim())
}

export function isTime(raw: string | null | undefined): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw ?? "")
}

export function normalizeWebsite(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

/** Stable key for a custom qualifying question. */
export function questionKey(question: string, taken: string[]): string {
  const base = question.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "question"
  let key = `custom_${base}`
  for (let i = 2; taken.includes(key); i++) key = `custom_${base}_${i}`
  return key
}

const A2P_REQUIRED: Array<keyof A2pBusiness> = [
  "legalName", "businessType", "street", "city", "state", "zip",
  "repFirstName", "repLastName", "repEmail", "repPhone",
]

/** What is still missing before the texting registration can be filed. */
export function a2pMissing(b: Partial<A2pBusiness> | null | undefined): string[] {
  const biz = b ?? {}
  const labels: Record<string, string> = {
    legalName: "legal business name", businessType: "business type", street: "street address", city: "city",
    state: "state", zip: "zip code", repFirstName: "contact first name", repLastName: "contact last name",
    repEmail: "contact email", repPhone: "contact mobile",
  }
  const missing = A2P_REQUIRED.filter((k) => !String(biz[k] ?? "").trim()).map((k) => labels[k])
  if (biz.businessType !== "sole_proprietor" && String(biz.ein ?? "").replace(/\D/g, "").length !== 9) missing.push("EIN (9 digits)")
  if (biz.zip && !/^\d{5}$/.test(String(biz.zip).trim()) && !missing.includes("zip code")) missing.push("a 5 digit zip code")
  if (biz.repEmail && !isEmail(biz.repEmail)) missing.push("a valid contact email")
  if (biz.repPhone && !isUsPhone(biz.repPhone)) missing.push("a valid contact mobile")
  return missing
}

/**
 * The carrier-registration details already known from the business step, so
 * the owner only adds the legal name, business type and EIN. Used by the
 * onboarding screen to prefill and by lib/a2p.ts before filing.
 */
export function a2pDefaults(input: {
  companyName: string | null | undefined
  officeAddress: string | null | undefined
  ownerMobile: string | null | undefined
  business: CompanyIntake["business"] | undefined
}): Partial<A2pBusiness> {
  const b = input.business ?? {}
  const [first, ...rest] = (b.ownerName ?? "").trim().split(/\s+/)
  const office = (input.officeAddress ?? "").trim()
  const addr = office.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\.?\s*(\d{5})?/)
  return {
    legalName: (input.companyName ?? "").trim(),
    website: normalizeWebsite(b.website ?? ""),
    street: addr?.[1]?.trim() ?? office,
    city: addr?.[2]?.trim() ?? "",
    state: (addr?.[3] ?? b.state ?? "").toUpperCase(),
    zip: addr?.[4] ?? "",
    repFirstName: first ?? "",
    repLastName: rest.join(" "),
    repTitle: "Owner",
    repEmail: (b.ownerEmail ?? "").trim(),
    repPhone: (input.ownerMobile ?? "").trim(),
  }
}

/** The owner's own entries win; an empty field takes the default. */
export function withA2pDefaults(business: Partial<A2pBusiness> | undefined, defaults: Partial<A2pBusiness>): Partial<A2pBusiness> {
  const out: Partial<A2pBusiness> = { ...defaults }
  for (const [k, v] of Object.entries(business ?? {}) as Array<[keyof A2pBusiness, string | undefined]>) {
    if (String(v ?? "").trim()) out[k] = v
  }
  return out
}

function offerProblems(offer: OfferConfig | null | undefined, which: string): string[] {
  if (!offer) return []
  const out: string[] = []
  const needsAmount = ["dollars_off", "percent_off", "free_upgrade", "financing"].includes(offer.type)
  if (needsAmount && !offer.amount?.trim() && !offer.headline?.trim()) {
    out.push(`${which}: fill in the amount so the ad line reads correctly.`)
  }
  if (!offerHeadline(offer)) out.push(`${which}: write the offer in your own words.`)
  return out
}

function calendarProblems(intake: CompanyIntake): string[] {
  const cal = calendarOf(intake)
  const out: string[] = []
  if (cal.days.length === 0) out.push("Pick at least one day you run measures.")
  const on = cal.windows.filter((w) => w.enabled)
  if (on.length === 0) out.push("Switch on at least one time window.")
  for (const w of on) {
    if (!isTime(w.start) || !isTime(w.end)) out.push(`${w.label}: set a start and end time.`)
    else if (w.start >= w.end) out.push(`${w.label}: the end time must be after the start time.`)
  }
  if (!(cal.capacity >= 1 && cal.capacity <= 10)) out.push("Measures at once must be between 1 and 10.")
  return out
}

// ── Per-step validation (what blocks Continue) ───────────────────────────────

export function validateStep(step: StepId, data: WizardData): string[] {
  const { company, intake, agent } = data
  const b = intake.business ?? {}
  const out: string[] = []

  if (step === "business") {
    if (!company.name.trim()) out.push("Enter your company name.")
    if (!b.ownerName?.trim()) out.push("Enter the owner's name.")
    if (!b.ownerEmail?.trim()) out.push("Enter the owner's email.")
    else if (!isEmail(b.ownerEmail)) out.push("The owner email does not look right.")
    if (b.businessPhone?.trim() && !isUsPhone(b.businessPhone)) out.push("The business phone needs 10 digits.")
    if (!company.notification_phone.trim()) out.push("Enter the owner's mobile. That is where we text new leads, booked estimates and leads that need you.")
    else if (!isUsPhone(company.notification_phone)) out.push("The owner's mobile needs 10 digits.")
    if (!company.office_address.trim()) out.push("Enter your office address.")
    // A 5-digit group after the first comma is the zip; one before it is a house number.
    else if (!/,[^]*\b\d{5}(-\d{4})?\b/.test(company.office_address)) out.push("End the office address with its 5 digit zip code, so we can find you a local number.")
    if (!b.state) out.push("Pick your state.")
  }

  if (step === "areas") {
    if (!b.state) out.push("Pick your state.")
    if ((intake.serviceAreas ?? []).length === 0) out.push("Add at least one city or area you work in.")
  }

  if (step === "customer") {
    const services = servicesOf(intake)
    const qual = qualificationOf(intake)
    if (services.flooringTypes.length === 0) out.push("Pick at least one type of flooring you install.")
    if (qual.questions.some((q) => q.enabled && !q.question.trim())) out.push("One of the questions that is switched on has no wording.")
    const rules = qual.rules
    for (const [label, v] of [["Minimum square feet", rules.minSqft], ["Minimum budget", rules.minBudget], ["Latest start", rules.maxTimelineMonths]] as const) {
      if (v != null && (!Number.isFinite(v) || v < 0)) out.push(`${label} must be a positive number.`)
    }
  }

  if (step === "offer") {
    const offers = offersOf(intake)
    out.push(...offerProblems(offers.primary, "Main offer"))
    offers.secondary.forEach((o, i) => out.push(...offerProblems(o, `Extra offer ${i + 1}`)))
    if (!offers.measureIsFree && offers.primary?.type === "free_measure") {
      out.push("Your main offer is a free in-home measure, but the measure is marked as having a fee. Change one so they agree.")
    } else if (!offers.measureIsFree && !offers.measureFee?.trim()) {
      out.push("Say what the in-home measure costs, or mark it as free.")
    }
  }

  if (step === "number") {
    const biz = intake.a2p?.business ?? {}
    const started = Object.values(biz).some((v) => String(v ?? "").trim())
    if (started) {
      if (biz.repEmail?.trim() && !isEmail(biz.repEmail)) out.push("The contact email does not look right.")
      if (biz.repPhone?.trim() && !isUsPhone(biz.repPhone)) out.push("The contact mobile needs 10 digits.")
      if (biz.zip?.trim() && !/^\d{5}$/.test(biz.zip.trim())) out.push("The zip code needs 5 digits.")
      const ein = String(biz.ein ?? "").replace(/\D/g, "")
      if (ein && ein.length !== 9) out.push("An EIN has 9 digits.")
    }
  }

  if (step === "calendar") {
    out.push(...calendarProblems(intake))
    const cal = calendarOf(intake)
    if (cal.estimatorPhone?.trim() && !isUsPhone(cal.estimatorPhone)) out.push("The mobile number for whoever runs measures needs 10 digits.")
    if (!agent.agent_name.trim()) out.push("Give your assistant a name.")
    if (agent.working_hours_start >= agent.working_hours_end) out.push("The assistant's texting hours must end after they start.")
  }

  return out
}

// ── Launch ───────────────────────────────────────────────────────────────────

/** The only things that block "Go to my dashboard". Everything else FieldBuilt chases during install. */
export function missingForLaunch(input: { companyName: string; ownerMobile: string; intake: CompanyIntake }): Array<{ step: StepId; message: string }> {
  const { companyName, ownerMobile, intake } = input
  const out: Array<{ step: StepId; message: string }> = []
  if (!companyName.trim()) out.push({ step: "business", message: "Company name" })
  // New leads, booked estimates and leads that need a person are texted to this
  // mobile, and the owner email is kept on file beside it. Without them the
  // owner never hears about the work the assistant does.
  if (!isUsPhone(ownerMobile)) out.push({ step: "business", message: "The owner's mobile" })
  if (!isEmail(intake.business?.ownerEmail)) out.push({ step: "business", message: "The owner's email" })
  if (!intake.business?.state) out.push({ step: "business", message: "Your state" })
  if ((intake.serviceAreas ?? []).length === 0) out.push({ step: "areas", message: "At least one service area" })
  if ((intake.services?.flooringTypes ?? []).length === 0) out.push({ step: "customer", message: "At least one flooring type you install" })
  if (!intake.calendar) out.push({ step: "calendar", message: "Your measure calendar" })
  else if (calendarProblems(intake).length > 0) out.push({ step: "calendar", message: "A measure day and time window" })
  return out
}

export type ChecklistItem = {
  key: string
  label: string
  detail: string
  done: boolean
  required: boolean
  step: StepId
}

export function launchChecklist(data: WizardData, ctx: WizardContext): ChecklistItem[] {
  const { company, intake } = data
  const areas = intake.serviceAreas ?? []
  const types = intake.services?.flooringTypes ?? []
  const offers = intake.offers
  const photos = (intake.assets?.photos ?? []).length + (intake.assets?.websiteImages ?? []).length
  const questions = intake.qualification?.questions.filter((q) => q.enabled) ?? []
  const a2pStatus = intake.a2p?.status ?? "not_started"
  const calOk = !!intake.calendar && calendarProblems(intake).length === 0
  const cal = calendarOf(intake)
  const headline = offerHeadline(offers?.primary)

  return [
    {
      key: "business", step: "business", required: true,
      label: "Business details",
      done: !!company.name.trim() && !!intake.business?.state && isUsPhone(company.notification_phone) && isEmail(intake.business?.ownerEmail),
      detail: !company.name.trim()
        ? "Company name and state are missing"
        : !isUsPhone(company.notification_phone) || !isEmail(intake.business?.ownerEmail)
          ? "The owner's mobile and email are needed for lead and booking texts"
          : `${company.name.trim()}${intake.business?.state ? `, ${intake.business.state}` : ""}`,
    },
    {
      key: "areas", step: "areas", required: true,
      label: "Service areas",
      done: areas.length > 0,
      detail: areas.length > 0 ? `${areas.length} area${areas.length === 1 ? "" : "s"}: ${areas.slice(0, 3).map((a) => a.name).join("; ")}${areas.length > 3 ? " and more" : ""}` : "No areas added yet",
    },
    {
      key: "customer", step: "customer", required: true,
      label: "Ideal customer",
      done: types.length > 0,
      detail: types.length > 0 ? `${types.length} flooring type${types.length === 1 ? "" : "s"}, ${questions.length} qualifying question${questions.length === 1 ? "" : "s"}` : "Pick the flooring you install",
    },
    {
      key: "offer", step: "offer", required: false,
      label: "Offer to advertise",
      done: !!headline,
      detail: headline || (offers ? "No main offer chosen. We can still launch on the in-home measure alone." : "Not chosen yet"),
    },
    {
      key: "photos", step: "photos", required: false,
      label: "Job photos",
      done: photos >= 3,
      detail: photos > 0 ? `${photos} photo${photos === 1 ? "" : "s"} ready for ads${photos < 3 ? ". Three or more works best." : ""}` : "No photos yet. Real job photos make the strongest ads.",
    },
    {
      key: "facebook", step: "ads", required: false,
      label: "Facebook connected",
      done: ctx.facebook.connected,
      detail: ctx.facebook.connected
        ? `${ctx.facebook.pageName ?? "Page connected"}${ctx.facebook.adAccountId ? `, ad account ${ctx.facebook.adAccountId}` : ", ad account not chosen yet"}`
        : "Not connected. We will do this with you on the install call.",
    },
    {
      key: "number", step: "number", required: false,
      label: "Texting number",
      done: !!ctx.phoneNumber,
      detail: ctx.phoneNumber ?? "No number reserved yet",
    },
    {
      key: "registration", step: "number", required: false,
      label: "Carrier registration",
      done: a2pStatus === "approved",
      detail:
        a2pStatus === "approved" ? "Approved" :
        a2pStatus === "not_started" ? "Business details still needed" :
        a2pStatus === "info_collected" ? "Details saved. FieldBuilt files it for you." :
        a2pStatus === "rejected" || a2pStatus === "error" ? "Needs a fix. FieldBuilt will contact you." :
        "In review with the carriers",
    },
    {
      key: "calendar", step: "calendar", required: true,
      label: "Measure calendar",
      done: calOk,
      detail: calOk
        ? `${cal.days.length} day${cal.days.length === 1 ? "" : "s"} a week, ${cal.windows.filter((w) => w.enabled).length} time window${cal.windows.filter((w) => w.enabled).length === 1 ? "" : "s"}, ${cal.capacity} at once`
        : "Days and time windows are missing",
    },
  ]
}

/** Formats 10 digits as (555) 123-4567 while typing; leaves anything else alone. */
export function prettyPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")
  if (d.length !== 10) return raw
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}
