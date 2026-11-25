// The company intake document: everything onboarding collects that FieldBuilt needs
// to launch ads and run the account (service areas, what a qualified lead is, the
// offer, brand assets, ad access, domain, A2P business details, measure calendar).
//
// Storage: `companies.intake` (jsonb). That column ships in
// supabase/migrations/20261125000000_flooring_crm_foundation.sql; until the SQL has
// been run, the document lives under `knowledge_base.scraped_raw.intake`, a jsonb
// column that already exists and nothing else used. Read and write only through
// loadIntake / saveIntake so the storage location stays in one place.
//
// The intake is the SOURCE. The engines never read it on the hot path: onboarding
// compiles it into the runtime config they already use (ai_agent_config,
// knowledge_base, companies.service_area_zips, technicians "measure slots") via
// applyIntakeToRuntime in lib/intake-apply.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any Supabase client flavour
type Db = { from: (table: string) => any }

// ── Service areas ────────────────────────────────────────────────────────────

export type ServiceAreaPlace = {
  /** "Plano, TX" as shown to the owner */
  name: string
  /** Two-letter state code when known */
  state?: string | null
  /** Google place id when picked from the dropdown; null when typed by hand */
  placeId?: string | null
  lat?: number | null
  lng?: number | null
  /** locality | county | postal_code | neighborhood | typed */
  kind?: string | null
  /** Bounding box from Google, used to resolve the zip codes inside the area */
  viewport?: { north: number; south: number; east: number; west: number } | null
}

// ── Qualification ────────────────────────────────────────────────────────────

export type QualifyingQuestion = {
  /** Stable key: answers are saved on the lead under metadata.qualification[key] */
  key: string
  /** What the owner wants asked, in plain words */
  question: string
  /** Required = the AI may not book a measure until this is answered */
  required: boolean
  enabled: boolean
  custom?: boolean
}

export type QualificationRules = {
  homeownersOnly: boolean
  requireDecisionMakers: boolean
  minSqft: number | null
  minBudget: number | null
  /** Leads who want the work later than this many months out are not booked */
  maxTimelineMonths: number | null
  excludeRepairsOnly: boolean
  excludeMaterialOnly: boolean
  /** Anything else the owner does not want booked, free text */
  other: string
}

/** The questions a flooring owner can pick from. Order is the order asked. */
export const DEFAULT_QUALIFYING_QUESTIONS: QualifyingQuestion[] = [
  { key: "project_type",    question: "What type of flooring are you looking for?",                         required: true,  enabled: true },
  { key: "project_size",    question: "Which rooms is it for, and roughly how many square feet?",           required: true,  enabled: true },
  { key: "timeline",        question: "When are you hoping to have the new floors in?",                     required: true,  enabled: true },
  { key: "homeowner",       question: "Do you own the home?",                                               required: true,  enabled: true },
  { key: "decision_makers", question: "Will everyone who decides on the floors be home for the measure?",   required: true,  enabled: true },
  { key: "budget",          question: "Do you have a budget in mind for the project?",                      required: false, enabled: false },
  { key: "current_floor",   question: "What flooring is down right now?",                                   required: false, enabled: false },
  { key: "financing",       question: "Are you planning to pay outright or interested in financing?",       required: false, enabled: false },
]

export const DEFAULT_QUALIFICATION_RULES: QualificationRules = {
  homeownersOnly: true,
  requireDecisionMakers: false,
  minSqft: null,
  minBudget: null,
  maxTimelineMonths: null,
  excludeRepairsOnly: false,
  excludeMaterialOnly: true,
  other: "",
}

// ── Offers ───────────────────────────────────────────────────────────────────

export type OfferType =
  | "free_measure"
  | "dollars_off"
  | "percent_off"
  | "free_installation"
  | "free_upgrade"
  | "financing"
  | "free_design"
  | "free_removal"
  | "price_match"
  | "custom"

export type OfferConfig = {
  type: OfferType
  /** The line that goes in the ad, e.g. "$500 off any project over 500 sq ft" */
  headline: string
  /** Number or short value the offer turns on: "500", "10", "12 months" */
  amount?: string
  /** Fine print the AI must respect: minimums, exclusions */
  conditions?: string
  /** Free text or a date; empty = no end date */
  expires?: string
}

export const OFFER_CATALOG: Array<{
  type: OfferType
  label: string
  description: string
  amountLabel?: string
  amountPlaceholder?: string
  headlineTemplate: string
}> = [
  { type: "free_measure",      label: "Free in-home measure and quote", description: "We come out, measure every room and leave an exact quote. No charge.", headlineTemplate: "Free in-home measure and quote" },
  { type: "dollars_off",       label: "Dollars off",                    description: "A fixed amount off the project.", amountLabel: "Amount off ($)", amountPlaceholder: "500", headlineTemplate: "${amount} off your new floors" },
  { type: "percent_off",       label: "Percent off",                    description: "A percentage off materials, labor or the whole job.", amountLabel: "Percent off (%)", amountPlaceholder: "10", headlineTemplate: "{amount}% off your new floors" },
  { type: "free_installation", label: "Free installation",              description: "Installation included when they buy the flooring from you.", headlineTemplate: "Free installation on select floors" },
  { type: "free_upgrade",      label: "Free upgrade",                   description: "Upgraded pad, underlayment or a better product line at no extra cost.", amountLabel: "What is upgraded", amountPlaceholder: "Premium pad", headlineTemplate: "Free {amount} upgrade" },
  { type: "financing",         label: "Special financing",              description: "0% or low monthly payments on approved credit.", amountLabel: "Terms", amountPlaceholder: "0% for 12 months", headlineTemplate: "{amount} financing on approved credit" },
  { type: "free_design",       label: "Free design consultation",       description: "Samples brought to the home and help choosing the right floor.", headlineTemplate: "Free in-home design consultation with samples" },
  { type: "free_removal",      label: "Free removal and haul away",     description: "Old flooring torn out and hauled off, or furniture moved, at no charge.", headlineTemplate: "Free removal and haul away of your old floors" },
  { type: "price_match",       label: "Price match",                    description: "You match any written quote for the same product and scope.", headlineTemplate: "We match any written quote" },
  { type: "custom",            label: "Something else",                 description: "Write your own offer.", headlineTemplate: "" },
]

// ── A2P 10DLC ────────────────────────────────────────────────────────────────

export type A2pStatus =
  | "not_started"
  | "info_collected"
  | "submitted"
  | "brand_pending"
  | "campaign_pending"
  | "approved"
  | "rejected"
  | "error"

export type A2pBusiness = {
  legalName: string
  /** llc | corporation | sole_proprietor | partnership | non_profit */
  businessType: string
  /** EIN, digits only or with the dash. Empty for a sole proprietor. */
  ein: string
  street: string
  city: string
  state: string
  zip: string
  website: string
  repFirstName: string
  repLastName: string
  repTitle: string
  repEmail: string
  repPhone: string
  /** The business's own privacy policy and terms pages. Empty = the FieldBuilt-hosted pages for this company are used. */
  privacyPolicyUrl?: string
  termsUrl?: string
}

export type A2pState = {
  status: A2pStatus
  business?: Partial<A2pBusiness>
  customerProfileSid?: string | null
  trustProductSid?: string | null
  brandSid?: string | null
  messagingServiceSid?: string | null
  campaignSid?: string | null
  /** SIDs of the sub-resources created along the way, so a retry resumes instead of duplicating */
  resources?: Record<string, string>
  /** Twilio's own words for where the brand and the campaign stand */
  brandStatus?: string | null
  campaignStatus?: string | null
  lastError?: string | null
  submittedAt?: string | null
  approvedAt?: string | null
  updatedAt?: string | null
}

// ── The document ─────────────────────────────────────────────────────────────

export type IntakePhoto = {
  url: string
  /** Storage path inside the company-assets bucket, kept so the file can be deleted */
  path: string
  /** before_after | finished | crew | showroom | other */
  kind?: string
  label?: string
}

export type MeasureWindow = { id: string; label: string; start: string; end: string; enabled: boolean }

export type CompanyIntake = {
  version: 1
  progress?: { step: number; completedSteps: number[]; finishedAt?: string | null }
  business?: {
    ownerName?: string
    ownerEmail?: string
    businessPhone?: string
    state?: string
    website?: string
    yearsInBusiness?: string
    crews?: string
    /** shop_at_home | showroom | installer_led */
    businessModel?: string
  }
  serviceAreas?: ServiceAreaPlace[]
  /** Places the owner does NOT go, free text */
  excludedAreas?: string
  services?: {
    /** Flooring job type keys from lib/job-types.ts */
    flooringTypes: string[]
    /** residential | commercial | both */
    propertyScope: string
    notOffered?: string
  }
  qualification?: { questions: QualifyingQuestion[]; rules: QualificationRules }
  offers?: {
    primary: OfferConfig | null
    secondary: OfferConfig[]
    measureIsFree: boolean
    /** Only when the measure is not free: "$49, credited toward the job" */
    measureFee?: string
  }
  assets?: {
    logoUrl?: string | null
    brandColor?: string | null
    photos: IntakePhoto[]
    /** Image URLs found on the website that the owner approved for ads */
    websiteImages?: string[]
    reviewsUrl?: string
    googleBusinessUrl?: string
    instagram?: string
    facebookPage?: string
  }
  ads?: {
    monthlyBudget?: string
    /** yes | no | unsure */
    hasAdAccount?: string
    hasRunAdsBefore?: string
    /** connected | partner_access | later */
    accessMethod?: string
    notes?: string
  }
  domain?: {
    domain?: string
    registrar?: string
    /** share_login | add_records | fieldbuilt_subdomain | unsure */
    access?: string
    contactName?: string
    notes?: string
  }
  calendar?: {
    days: string[]
    windows: MeasureWindow[]
    /** How many measures can run in the same window */
    capacity: number
    /** 0 = same day allowed, 1 = earliest tomorrow, ... */
    minLeadDays: number
    measureDurationMin: number
    estimatorName?: string
    estimatorPhone?: string
  }
  a2p?: A2pState
  voice?: { enabled: boolean }
  /** Webhook field mapping overrides: { "incoming key": "lead field" } */
  leadFieldMap?: Record<string, string>
  /** Shape of the last payload the lead webhook received, shown on the mapping screen */
  lastWebhookSample?: {
    receivedAt: string
    source: string
    fields: Array<{ key: string; target: string; how: string; sample: string }>
  }
}

export const DEFAULT_MEASURE_WINDOWS: MeasureWindow[] = [
  { id: "morning",   label: "Morning",   start: "09:00", end: "11:00", enabled: true },
  { id: "midday",    label: "Midday",    start: "12:00", end: "14:00", enabled: true },
  { id: "afternoon", label: "Afternoon", start: "15:00", end: "17:00", enabled: true },
  { id: "evening",   label: "Evening",   start: "17:30", end: "19:00", enabled: false },
]

export function emptyIntake(): CompanyIntake {
  return { version: 1 }
}

// ── Storage ──────────────────────────────────────────────────────────────────

// null = not probed yet. Re-probed every 10 minutes while false so the code
// picks the column up on its own after the SQL is run, without a redeploy.
let intakeColumnExists: boolean | null = null
let intakeColumnCheckedAt = 0
const RECHECK_MS = 10 * 60 * 1000

async function hasIntakeColumn(db: Db): Promise<boolean> {
  if (intakeColumnExists === true) return true
  if (intakeColumnExists === false && Date.now() - intakeColumnCheckedAt < RECHECK_MS) return false
  const { error } = await db.from("companies").select("intake").limit(1)
  intakeColumnExists = !error
  intakeColumnCheckedAt = Date.now()
  return intakeColumnExists
}

function asIntake(raw: unknown): CompanyIntake | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  if (Object.keys(raw as object).length === 0) return null
  return { ...(raw as CompanyIntake), version: 1 }
}

export async function loadIntake(db: Db, companyId: string): Promise<CompanyIntake> {
  if (await hasIntakeColumn(db)) {
    const { data } = await db.from("companies").select("intake").eq("id", companyId).maybeSingle()
    const fromColumn = asIntake(data?.intake)
    if (fromColumn) return fromColumn
  }
  const { data: kb } = await db.from("knowledge_base").select("scraped_raw").eq("company_id", companyId).maybeSingle()
  const raw = (kb?.scraped_raw ?? null) as { intake?: unknown } | null
  return asIntake(raw?.intake) ?? emptyIntake()
}

/** Shallow-merges `patch` over the stored document, section by section, and saves it. */
export async function saveIntake(db: Db, companyId: string, patch: Partial<CompanyIntake>): Promise<CompanyIntake> {
  const current = await loadIntake(db, companyId)
  const next: CompanyIntake = { ...current, ...patch, version: 1 }

  if (await hasIntakeColumn(db)) {
    const { error } = await db.from("companies").update({ intake: next }).eq("id", companyId)
    if (!error) return next
    console.error(`[intake] companies.intake write failed for ${companyId}, using the fallback store:`, error.message)
  }

  const { data: kb } = await db.from("knowledge_base").select("id, scraped_raw").eq("company_id", companyId).maybeSingle()
  const raw = ((kb?.scraped_raw ?? {}) as Record<string, unknown>) ?? {}
  const scraped_raw = { ...raw, intake: next }
  const { error } = kb?.id
    ? await db.from("knowledge_base").update({ scraped_raw }).eq("id", kb.id)
    : await db.from("knowledge_base").insert({ company_id: companyId, scraped_raw })
  if (error) throw new Error(`Could not save the intake for company ${companyId}: ${error.message}`)
  return next
}

// ── Small readers used outside onboarding ────────────────────────────────────

/** Enabled qualifying questions in the shape ai_agent_config.qualifying_questions stores. */
export function runtimeQualifyingQuestions(intake: CompanyIntake): Array<{ id: string; key: string; question: string; required: boolean }> {
  const questions = intake.qualification?.questions ?? DEFAULT_QUALIFYING_QUESTIONS
  return questions
    .filter((q) => q.enabled && q.question.trim())
    .map((q) => ({ id: q.key, key: q.key, question: q.question.trim(), required: !!q.required }))
}

export function offerHeadline(offer: OfferConfig | null | undefined): string {
  if (!offer) return ""
  if (offer.headline?.trim()) return offer.headline.trim()
  const entry = OFFER_CATALOG.find((o) => o.type === offer.type)
  return (entry?.headlineTemplate ?? "").replace("{amount}", offer.amount?.trim() ?? "").trim()
}
