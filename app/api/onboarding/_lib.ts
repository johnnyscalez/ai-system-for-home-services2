// Shared by the onboarding routes: who is calling, which company they belong to,
// and the whitelist that decides what an onboarding save may write into the intake.

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { JOB_TYPES } from "@/lib/job-types"
import type {
  A2pBusiness, CompanyIntake, MeasureWindow, OfferConfig, OfferType,
  QualifyingQuestion, QualificationRules, ServiceAreaPlace,
} from "@/lib/intake"
import { a2pMissing } from "@/components/onboarding/logic"
import { isUsState } from "@/lib/service-areas"

export type Db = ReturnType<typeof createServiceRoleClient>

export type Session = {
  userId: string
  email: string
  fullName: string
  companyId: string | null
  db: Db
}

/** The signed-in user and their company (null until the first onboarding save creates it). */
export async function getSession(): Promise<Session | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const db = createServiceRoleClient()
  const { data: profile } = await db
    .from("users").select("company_id, full_name, email").eq("id", user.id).maybeSingle()
  return {
    userId: user.id,
    email: (profile?.email as string | null) ?? user.email ?? "",
    fullName: (profile?.full_name as string | null) ?? (user.user_metadata?.full_name as string | undefined) ?? "",
    companyId: (profile?.company_id as string | null) ?? null,
    db,
  }
}

/** Creates the company on the first save, or re-links one this user already owns. */
export async function ensureCompany(session: Session, name: string, timezone: string | null): Promise<string> {
  const { db, userId } = session
  const { data: owned } = await db
    .from("companies").select("id").eq("owner_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle()

  let companyId = owned?.id as string | undefined
  if (!companyId) {
    const webhookSecret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((x) => x.toString(16).padStart(2, "0")).join("")
    const { data: created, error } = await db
      .from("companies")
      .insert({
        name,
        owner_id: userId,
        service_type: "flooring",
        onboarding_completed: false,
        webhook_secret: webhookSecret,
      })
      .select("id")
      .single()
    if (error || !created) throw new Error(`Could not create the company: ${error?.message ?? "no row returned"}`)
    companyId = created.id as string
  }

  const { data: linked } = await db.from("users").update({ company_id: companyId }).eq("id", userId).select("id")
  if (!linked?.length) {
    await db.from("users").insert({
      id: userId, email: session.email, full_name: session.fullName, company_id: companyId, role: "owner",
    })
  }

  await db.from("knowledge_base").upsert({ company_id: companyId }, { onConflict: "company_id", ignoreDuplicates: true })
  await db.from("ai_agent_config").upsert(
    { company_id: companyId, agent_name: "Mia", ...(timezone ? { timezone } : {}) },
    { onConflict: "company_id", ignoreDuplicates: true }
  )
  return companyId
}

// ── Intake whitelist ─────────────────────────────────────────────────────────

const s = (v: unknown, max = 300): string => (typeof v === "string" ? v.slice(0, max) : "")
const bool = (v: unknown): boolean => v === true
const numOrNull = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}
const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const oneOf = (v: unknown, allowed: readonly string[], fallback = ""): string =>
  typeof v === "string" && allowed.includes(v) ? v : fallback
const httpUrl = (v: unknown, max = 600): string => {
  const t = s(v, max).trim()
  return /^https?:\/\/[^\s]+$/i.test(t) ? t : ""
}
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const OFFER_TYPES: OfferType[] = [
  "free_measure", "dollars_off", "percent_off", "free_installation", "free_upgrade",
  "financing", "free_design", "free_removal", "price_match", "custom",
]
const AREA_KINDS = ["locality", "county", "postal_code", "neighborhood", "typed"]
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function cleanArea(raw: unknown): ServiceAreaPlace | null {
  const a = obj(raw)
  const name = s(a.name, 120).trim()
  if (!name) return null
  const v = obj(a.viewport)
  const box = [v.north, v.south, v.east, v.west].map((n) => (typeof n === "number" && Number.isFinite(n) ? n : null))
  const lat = numOrNull(a.lat, -90, 90)
  const lng = numOrNull(a.lng, -180, 180)
  const hasGeo = (lat !== null && lng !== null) || box.every((n) => n !== null)
  const kind = oneOf(a.kind, AREA_KINDS, "typed")
  return {
    name,
    state: isUsState(s(a.state, 2)) ? s(a.state, 2).toUpperCase() : null,
    placeId: s(a.placeId, 300) || null,
    lat,
    lng,
    // An area without coordinates cannot contribute zip codes, whatever it claims to be.
    kind: hasGeo ? (kind === "typed" ? "locality" : kind) : "typed",
    viewport: box.every((n) => n !== null)
      ? { north: box[0] as number, south: box[1] as number, east: box[2] as number, west: box[3] as number }
      : null,
  }
}

function cleanOffer(raw: unknown): OfferConfig | null {
  const o = obj(raw)
  const type = oneOf(o.type, OFFER_TYPES) as OfferType | ""
  if (!type) return null
  return {
    type,
    headline: s(o.headline, 200).trim(),
    amount: s(o.amount, 60).trim(),
    conditions: s(o.conditions, 400).trim(),
    expires: s(o.expires, 80).trim(),
  }
}

function cleanQuestion(raw: unknown): QualifyingQuestion | null {
  const q = obj(raw)
  const key = s(q.key, 48).toLowerCase().replace(/[^a-z0-9_]/g, "")
  if (!key) return null
  return {
    key,
    question: s(q.question, 300),
    required: bool(q.required),
    enabled: bool(q.enabled),
    ...(bool(q.custom) ? { custom: true } : {}),
  }
}

function cleanRules(raw: unknown): QualificationRules {
  const r = obj(raw)
  return {
    homeownersOnly: bool(r.homeownersOnly),
    requireDecisionMakers: bool(r.requireDecisionMakers),
    minSqft: numOrNull(r.minSqft, 1, 100000),
    minBudget: numOrNull(r.minBudget, 1, 10000000),
    maxTimelineMonths: numOrNull(r.maxTimelineMonths, 1, 60),
    excludeRepairsOnly: bool(r.excludeRepairsOnly),
    excludeMaterialOnly: bool(r.excludeMaterialOnly),
    other: s(r.other, 1000),
  }
}

function cleanWindow(raw: unknown): MeasureWindow | null {
  const w = obj(raw)
  const id = s(w.id, 32).toLowerCase().replace(/[^a-z0-9_]/g, "")
  if (!id) return null
  return {
    id,
    label: s(w.label, 40).trim() || "Window",
    start: TIME.test(s(w.start, 5)) ? s(w.start, 5) : "",
    end: TIME.test(s(w.end, 5)) ? s(w.end, 5) : "",
    enabled: bool(w.enabled),
  }
}

function cleanA2pBusiness(raw: unknown): Partial<A2pBusiness> {
  const b = obj(raw)
  return {
    legalName: s(b.legalName, 200).trim(),
    businessType: oneOf(b.businessType, ["llc", "corporation", "partnership", "sole_proprietor", "non_profit"]),
    ein: s(b.ein, 12).replace(/[^\d-]/g, ""),
    street: s(b.street, 200).trim(),
    city: s(b.city, 100).trim(),
    state: isUsState(s(b.state, 2)) ? s(b.state, 2).toUpperCase() : "",
    zip: s(b.zip, 10).trim(),
    website: s(b.website, 300).trim(),
    repFirstName: s(b.repFirstName, 80).trim(),
    repLastName: s(b.repLastName, 80).trim(),
    repTitle: s(b.repTitle, 80).trim(),
    repEmail: s(b.repEmail, 200).trim(),
    repPhone: s(b.repPhone, 30).trim(),
  }
}

/**
 * Turns whatever the browser sent into a safe intake patch. Only the sections
 * onboarding owns are accepted. Three things are never taken from the browser:
 * uploaded photos (the assets route records them), the registration ids and
 * status (the registration route owns them), and anything outside this list
 * (voice switch, webhook field map).
 */
export function sanitizeIntakePatch(raw: unknown, current: CompanyIntake): Partial<CompanyIntake> {
  const input = obj(raw)
  const patch: Partial<CompanyIntake> = {}

  if ("progress" in input) {
    const p = obj(input.progress)
    patch.progress = {
      step: int(p.step, 1, 10, 1),
      completedSteps: [...new Set(arr(p.completedSteps, 10).map((n) => int(n, 1, 10, 0)).filter((n) => n >= 1))].sort((a, b) => a - b),
      finishedAt: current.progress?.finishedAt ?? null,
    }
  }

  if ("business" in input) {
    const b = obj(input.business)
    patch.business = {
      ownerName: s(b.ownerName, 120),
      ownerEmail: s(b.ownerEmail, 200).trim(),
      businessPhone: s(b.businessPhone, 30),
      state: isUsState(s(b.state, 2)) ? s(b.state, 2).toUpperCase() : "",
      website: s(b.website, 300).trim(),
      yearsInBusiness: s(b.yearsInBusiness, 60),
      crews: s(b.crews, 30),
      businessModel: oneOf(b.businessModel, ["shop_at_home", "showroom", "installer_led"]),
    }
  }

  if ("serviceAreas" in input) {
    // One entry per place. When the same name arrives twice, the one that
    // carries a location wins, because only that one can contribute zip codes.
    const byName = new Map<string, ServiceAreaPlace>()
    const placeIds = new Set<string>()
    for (const raw of arr(input.serviceAreas, 80)) {
      const a = cleanArea(raw)
      if (!a) continue
      if (a.placeId && placeIds.has(a.placeId)) continue
      const key = a.name.toLowerCase()
      const existing = byName.get(key)
      if (existing && !(existing.kind === "typed" && a.kind !== "typed")) continue
      byName.set(key, a)
      if (a.placeId) placeIds.add(a.placeId)
    }
    patch.serviceAreas = [...byName.values()]
  }
  if ("excludedAreas" in input) patch.excludedAreas = s(input.excludedAreas, 1000)

  if ("services" in input) {
    const sv = obj(input.services)
    patch.services = {
      flooringTypes: arr(sv.flooringTypes, 20).filter(
        (t): t is string => typeof t === "string" && (JOB_TYPES as readonly string[]).includes(t) && t !== "other"
      ),
      propertyScope: oneOf(sv.propertyScope, ["residential", "commercial", "both"], "residential"),
      notOffered: s(sv.notOffered, 1000),
    }
  }

  if ("qualification" in input) {
    const q = obj(input.qualification)
    const keys = new Set<string>()
    patch.qualification = {
      questions: arr(q.questions, 20).map(cleanQuestion).filter((x): x is QualifyingQuestion => {
        if (!x || keys.has(x.key)) return false
        keys.add(x.key)
        return true
      }),
      rules: cleanRules(q.rules),
    }
  }

  if ("offers" in input) {
    const o = obj(input.offers)
    patch.offers = {
      primary: o.primary ? cleanOffer(o.primary) : null,
      secondary: arr(o.secondary, 5).map(cleanOffer).filter((x): x is OfferConfig => !!x),
      measureIsFree: o.measureIsFree !== false,
      measureFee: s(o.measureFee, 200),
    }
  }

  if ("assets" in input) {
    const a = obj(input.assets)
    const color = s(a.brandColor, 7).toLowerCase()
    patch.assets = {
      logoUrl: httpUrl(a.logoUrl) || null,
      brandColor: /^#[0-9a-f]{6}$/.test(color) ? color : null,
      // Uploaded photos are recorded by the assets route, never by a form save.
      photos: current.assets?.photos ?? [],
      websiteImages: [...new Set(arr(a.websiteImages, 40).map((u) => httpUrl(u)).filter(Boolean))],
      reviewsUrl: s(a.reviewsUrl, 400).trim(),
      googleBusinessUrl: s(a.googleBusinessUrl, 400).trim(),
      instagram: s(a.instagram, 200).trim(),
      facebookPage: s(a.facebookPage, 400).trim(),
    }
  }

  if ("ads" in input) {
    const a = obj(input.ads)
    patch.ads = {
      monthlyBudget: s(a.monthlyBudget, 60),
      hasAdAccount: oneOf(a.hasAdAccount, ["yes", "no", "unsure"]),
      hasRunAdsBefore: oneOf(a.hasRunAdsBefore, ["yes", "no", "unsure"]),
      accessMethod: oneOf(a.accessMethod, ["connected", "partner_access", "later"]),
      notes: s(a.notes, 1000),
    }
  }

  if ("domain" in input) {
    const d = obj(input.domain)
    patch.domain = {
      domain: s(d.domain, 120).trim(),
      registrar: s(d.registrar, 120),
      access: oneOf(d.access, ["share_login", "add_records", "fieldbuilt_subdomain", "unsure"]),
      contactName: s(d.contactName, 120),
      notes: s(d.notes, 1000),
    }
  }

  if ("calendar" in input) {
    const c = obj(input.calendar)
    const ids = new Set<string>()
    patch.calendar = {
      days: WEEK.filter((d) => arr(c.days, 7).includes(d)),
      windows: arr(c.windows, 8).map(cleanWindow).filter((w): w is MeasureWindow => {
        if (!w || ids.has(w.id)) return false
        ids.add(w.id)
        return true
      }),
      capacity: int(c.capacity, 1, 10, 1),
      minLeadDays: int(c.minLeadDays, 0, 14, 1),
      measureDurationMin: int(c.measureDurationMin, 30, 240, 60),
      estimatorName: s(c.estimatorName, 120),
      estimatorPhone: s(c.estimatorPhone, 30),
    }
  }

  if ("a2p" in input) {
    const business = cleanA2pBusiness(obj(input.a2p).business)
    const status = current.a2p?.status ?? "not_started"
    const editable = status === "not_started" || status === "info_collected"
    // Once a registration has been filed, the business details on record are
    // what the carriers hold; a form save must not silently change them.
    patch.a2p = editable
      ? {
          ...current.a2p,
          business,
          status: a2pMissing(business).length === 0 ? "info_collected" : "not_started",
          updatedAt: new Date().toISOString(),
        }
      : current.a2p
  }

  return patch
}
