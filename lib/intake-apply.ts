// Compiles the onboarding intake (lib/intake.ts) into the runtime config the
// engines already read: companies.service_area_zips, knowledge_base,
// ai_agent_config, and the technicians rows that stand for measure capacity.
//
// The intake is what the owner told us; this file is the only place that turns
// it into behaviour. Onboarding calls it on finish, and Settings > Account
// setup calls it on every save.
//
// SERVER ONLY (zip dataset, service role, Claude).

import { createServiceRoleClient } from "@/lib/supabase-server"
import { loadIntake, runtimeQualifyingQuestions, offerHeadline, DEFAULT_MEASURE_WINDOWS } from "@/lib/intake"
import type { CompanyIntake, MeasureWindow, OfferConfig } from "@/lib/intake"
import { deriveServiceAreaZips, serviceAreaText } from "@/lib/service-areas"
import { JOB_TYPE_LABELS, JOB_TYPES } from "@/lib/job-types"
import type { JobType } from "@/lib/job-types"
import { zipFromAddress } from "@/lib/routing"
import { zipToTimeZone } from "@/lib/timezones"
import { parseLeadPhone } from "@/lib/twilio"
import { generateSystemPrompt } from "@/lib/claude"
import type { KnowledgeBaseData, AgentConfigData } from "@/lib/claude"

type Db = ReturnType<typeof createServiceRoleClient>

const WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
const DEFAULT_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]

// ── Pure pieces (unit-testable, no I/O) ──────────────────────────────────────

const PRICING_LABELS = ["IN-HOME MEASURE:", "CURRENT ADVERTISED OFFER:", "OTHER OFFERS:"]

/** The owner's own pricing notes: whatever is left once the generated lines are removed. */
export function stripGeneratedPricing(text: string | null | undefined): string {
  return (text ?? "")
    .split("\n")
    .filter((line) => !PRICING_LABELS.some((label) => line.trimStart().startsWith(label)))
    .join("\n")
    .trim()
}

function sentence(s: string | null | undefined): string {
  const t = (s ?? "").trim().replace(/\s+/g, " ")
  if (!t) return ""
  return /[.!?]$/.test(t) ? t : `${t}.`
}

function offerLine(offer: OfferConfig): string {
  const headline = offerHeadline(offer)
  if (!headline) return ""
  const parts = [sentence(headline)]
  if (offer.conditions?.trim()) parts.push(`Conditions: ${sentence(offer.conditions)}`)
  if (offer.expires?.trim()) parts.push(`Ends: ${sentence(offer.expires)}`)
  return parts.join(" ")
}

/**
 * The labelled lines the SMS agent may quote. Built ONLY from what the owner
 * entered: no offers section means no lines at all, never an assumed "free".
 */
export function generatedPricingLines(intake: CompanyIntake): string[] {
  const offers = intake.offers
  if (!offers) return []
  const lines: string[] = []
  if (offers.measureIsFree) {
    lines.push("IN-HOME MEASURE: Free, no obligation.")
  } else {
    const fee = sentence(offers.measureFee)
    lines.push(`IN-HOME MEASURE: ${fee || "Not free. The office confirms the fee when the measure is set."}`)
  }
  if (offers.primary) {
    const line = offerLine(offers.primary)
    if (line) lines.push(`CURRENT ADVERTISED OFFER: ${line}`)
  }
  const others = (offers.secondary ?? []).map(offerLine).filter(Boolean)
  if (others.length > 0) lines.push(`OTHER OFFERS: ${others.join(" | ")}`)
  return lines
}

/** knowledge_base.pricing_info: generated lines first, then the owner's notes. Idempotent. */
export function composePricingInfo(intake: CompanyIntake, existing: string | null | undefined): string {
  const notes = stripGeneratedPricing(existing)
  return [...generatedPricingLines(intake), notes].filter(Boolean).join("\n")
}

function flooringLabels(keys: string[] | null | undefined): string[] {
  return (keys ?? [])
    .filter((k): k is JobType => (JOB_TYPES as readonly string[]).includes(k) && k !== "other")
    .map((k) => JOB_TYPE_LABELS[k])
}

/** ai_agent_config.disqualifiers: who the assistant must not book, in plain sentences. */
export function compileDisqualifiers(intake: CompanyIntake): string {
  const out: string[] = []
  const scope = intake.services?.propertyScope
  if (scope === "residential") {
    out.push("Only book residential homes. Do not book offices, retail or other commercial spaces. Let those leads know politely that the company only works on homes.")
  } else if (scope === "commercial") {
    out.push("Only book commercial properties. Do not book homeowners. Let them know politely that the company only does commercial work.")
  }

  const installed = flooringLabels(intake.services?.flooringTypes)
  const allTypes = JOB_TYPES.filter((t) => t !== "other").length
  if (installed.length > 0 && installed.length < allTypes) {
    out.push(`The company installs: ${installed.join(", ")}. Do not book a measure for a flooring type outside this list.`)
  }
  if (intake.services?.notOffered?.trim()) {
    out.push(`Jobs the company does not take: ${sentence(intake.services.notOffered)}`)
  }

  const rules = intake.qualification?.rules
  if (rules) {
    if (rules.homeownersOnly) {
      out.push("Only book the homeowner, or someone the owner has authorized to approve the work. A renter needs the landlord's approval before a measure is booked.")
    }
    if (rules.requireDecisionMakers) {
      out.push("Everyone who decides on the floors must be home for the measure. If a decision maker cannot be there, find a time when they can before booking.")
    }
    if (rules.minSqft && rules.minSqft > 0) {
      out.push(`Do not book projects smaller than about ${Math.round(rules.minSqft)} square feet.`)
    }
    if (rules.minBudget && rules.minBudget > 0) {
      out.push(`Do not book a lead whose stated budget is under $${Math.round(rules.minBudget).toLocaleString("en-US")}. Never say this number to the lead.`)
    }
    if (rules.maxTimelineMonths && rules.maxTimelineMonths > 0) {
      const n = Math.round(rules.maxTimelineMonths)
      out.push(`Do not book a lead who wants the work to start more than ${n} month${n === 1 ? "" : "s"} from now. Offer to check back closer to the date.`)
    }
    if (rules.excludeRepairsOnly) {
      out.push("Do not book small repair or patch jobs. The company installs and replaces floors.")
    }
    if (rules.excludeMaterialOnly) {
      out.push("Do not book a lead who only wants to buy material with no installation.")
    }
    if (rules.other?.trim()) out.push(sentence(rules.other))
  }

  if (intake.excludedAreas?.trim()) {
    out.push(`The company does not serve: ${sentence(intake.excludedAreas)}`)
  }
  return out.join("\n")
}

/** knowledge_base.service_areas */
export function serviceAreasKnowledge(intake: CompanyIntake): string {
  const served = serviceAreaText(intake.serviceAreas)
  const lines = [served ? `We serve: ${served}.` : ""]
  if (intake.excludedAreas?.trim()) lines.push(`We do not serve: ${sentence(intake.excludedAreas)}`)
  return lines.filter(Boolean).join("\n")
}

function validTime(t: string | null | undefined): t is string {
  return !!t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
}

/** Enabled measure windows in the shape ai_agent_config.appointment_windows stores. */
export function runtimeWindows(calendar: CompanyIntake["calendar"]): MeasureWindow[] {
  const source = calendar?.windows?.length ? calendar.windows : DEFAULT_MEASURE_WINDOWS
  return source
    .filter((w) => w.enabled && validTime(w.start) && validTime(w.end) && w.start < w.end)
    .map((w) => ({ id: w.id, label: w.label, start: w.start, end: w.end, enabled: true }))
    .sort((a, b) => a.start.localeCompare(b.start))
}

export function runtimeDays(calendar: CompanyIntake["calendar"]): string[] {
  const days = (calendar?.days ?? DEFAULT_DAYS).map((d) => d.toLowerCase()).filter((d) => (WEEK as readonly string[]).includes(d))
  return WEEK.filter((d) => days.includes(d))
}

type DaySchedule = { enabled: boolean; start: string; end: string }

/** A measure slot works the enabled days, from the earliest window start to the latest window end. */
export function measureSlotSchedule(calendar: CompanyIntake["calendar"]): Record<string, DaySchedule> {
  const windows = runtimeWindows(calendar)
  const days = runtimeDays(calendar)
  const start = windows.length ? windows.map((w) => w.start).sort()[0] : "09:00"
  const end = windows.length ? windows.map((w) => w.end).sort().slice(-1)[0] : "17:00"
  const schedule: Record<string, DaySchedule> = {}
  for (const d of WEEK) schedule[d] = { enabled: days.includes(d), start, end }
  return schedule
}

const BUSINESS_MODEL_TEXT: Record<string, string> = {
  shop_at_home: "Shop at home flooring company. Samples come to the customer's home.",
  showroom: "Flooring showroom that also installs.",
  installer_led: "Installer-led flooring contractor.",
}

function teamInfoFromIntake(intake: CompanyIntake): string {
  const b = intake.business ?? {}
  const parts: string[] = []
  if (b.ownerName?.trim()) parts.push(`Owner: ${b.ownerName.trim()}.`)
  if (b.businessModel && BUSINESS_MODEL_TEXT[b.businessModel]) parts.push(BUSINESS_MODEL_TEXT[b.businessModel])
  if (b.crews?.trim()) parts.push(`Install crews: ${b.crews.trim()}. All installs are done by the company's own crews.`)
  return parts.join(" ")
}

function clampHour(n: unknown, fallback: number, max: number): number {
  const v = Number(n)
  return Number.isInteger(v) && v >= 0 && v <= max ? v : fallback
}

// ── Measure capacity ─────────────────────────────────────────────────────────

/**
 * The booking engine offers one measure per technicians row per window, so
 * capacity is simply how many active rows exist. Rows are deactivated, never
 * deleted (appointments reference them). Same rules as
 * app/api/settings/measure-capacity.
 */
async function syncMeasureSlots(db: Db, companyId: string, target: number, schedule: Record<string, DaySchedule>): Promise<number> {
  const { data: rows, error } = await db
    .from("technicians")
    .select("id, name, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
  if (error) throw new Error(`Could not read measure slots: ${error.message}`)

  const all = (rows ?? []) as Array<{ id: string; name: string | null; status: string }>
  const active = all.filter((r) => r.status === "active")
  const isSlot = (name: string | null) => /^Measure slot \d+$/.test(name ?? "")

  if (active.length > target) {
    const surplus = active.slice(target).map((r) => r.id)
    await db.from("technicians").update({ status: "inactive" }).in("id", surplus)
  } else if (active.length < target) {
    let need = target - active.length
    const reusable = all.filter((r) => r.status !== "active" && isSlot(r.name)).slice(0, need)
    if (reusable.length > 0) {
      await db.from("technicians").update({ status: "active" }).in("id", reusable.map((r) => r.id))
      need -= reusable.length
    }
    if (need > 0) {
      const used = new Set(all.map((r) => r.name))
      const inserts: Record<string, unknown>[] = []
      for (let n = 1; inserts.length < need; n++) {
        const name = `Measure slot ${n}`
        if (used.has(name)) continue
        inserts.push({
          company_id: companyId, name, phone: null, serves_all_areas: true,
          specializations: [], zip_codes: [], schedule, status: "active",
        })
      }
      const { error: insErr } = await db.from("technicians").insert(inserts)
      if (insErr) throw new Error(`Could not create measure slots: ${insErr.message}`)
    }
  }

  // Every measure slot follows the calendar the owner set.
  const { data: slots } = await db
    .from("technicians").select("id, name").eq("company_id", companyId).eq("status", "active")
  const slotIds = ((slots ?? []) as Array<{ id: string; name: string | null }>).filter((r) => isSlot(r.name)).map((r) => r.id)
  if (slotIds.length > 0) {
    await db.from("technicians").update({ schedule, serves_all_areas: true, zip_codes: [] }).in("id", slotIds)
  }
  return (slots ?? []).length
}

// ── The compile step ─────────────────────────────────────────────────────────

export type ApplyResult = {
  serviceAreaZips: number | null
  measureSlots: number
  qualifyingQuestions: number
  promptGenerated: boolean
  warnings: string[]
}

export async function applyIntakeToRuntime(
  companyId: string,
  opts: { prompt?: "always" | "if_missing" | "never" } = {}
): Promise<ApplyResult> {
  const promptMode = opts.prompt ?? "if_missing"
  const db = createServiceRoleClient()
  const warnings: string[] = []

  const [{ data: company }, { data: kb }, { data: agent }, intake] = await Promise.all([
    db.from("companies").select("id, name, service_type, office_address, notification_phone").eq("id", companyId).maybeSingle(),
    db.from("knowledge_base").select("*").eq("company_id", companyId).maybeSingle(),
    db.from("ai_agent_config").select("*").eq("company_id", companyId).maybeSingle(),
    loadIntake(db, companyId),
  ])
  if (!company) throw new Error(`Company ${companyId} not found`)

  // 1. Company: where it works and who gets told about booked measures
  const areas = intake.serviceAreas ?? []
  const zips = deriveServiceAreaZips(areas)
  const areaText = serviceAreaText(areas)
  if (areas.length > 0 && !zips) {
    warnings.push("No service area carries a location, so leads are not checked by zip code. The assistant judges the area from the names.")
  }
  const officeAddress = (company.office_address as string | null)?.trim() || null
  const rawNotify = (company.notification_phone as string | null)?.trim() || null
  const notifyPhone = rawNotify ? (parseLeadPhone(rawNotify) ?? rawNotify) : null
  if (rawNotify && !parseLeadPhone(rawNotify)) warnings.push("The mobile number for booked-measure texts does not look like a valid phone number.")

  {
    const { error } = await db.from("companies").update({
      service_type: (company.service_type as string | null) || "flooring",
      service_area: areaText || null,
      service_area_zips: zips,
      service_radius_miles: null,
      office_address: officeAddress,
      notification_phone: notifyPhone,
      updated_at: new Date().toISOString(),
    }).eq("id", companyId)
    if (error) throw new Error(`Could not save the service area: ${error.message}`)
  }

  // 2. Knowledge base
  const b = intake.business ?? {}
  const installed = flooringLabels(intake.services?.flooringTypes)
  const kbPatch: Record<string, unknown> = {
    website_url: b.website?.trim() || (kb?.website_url as string | null) || null,
    service_areas: serviceAreasKnowledge(intake) || null,
    pricing_info: composePricingInfo(intake, kb?.pricing_info as string | null) || null,
    services_offered: (kb?.services_offered as string | null)?.trim() || (installed.length ? installed.join(", ") : null),
    years_in_business: b.yearsInBusiness?.trim() || (kb?.years_in_business as string | null) || null,
    team_info: (kb?.team_info as string | null)?.trim() || teamInfoFromIntake(intake) || null,
    social_facebook: intake.assets?.facebookPage?.trim() || (kb?.social_facebook as string | null) || null,
    social_instagram: intake.assets?.instagram?.trim() || (kb?.social_instagram as string | null) || null,
    social_google: intake.assets?.googleBusinessUrl?.trim() || (kb?.social_google as string | null) || null,
    updated_at: new Date().toISOString(),
  }
  {
    const { error } = kb?.id
      ? await db.from("knowledge_base").update(kbPatch).eq("id", kb.id)
      : await db.from("knowledge_base").insert({ company_id: companyId, ...kbPatch })
    if (error) throw new Error(`Could not save the knowledge base: ${error.message}`)
  }

  // 3. Assistant config
  const calendar = intake.calendar
  const windows = runtimeWindows(calendar)
  const days = runtimeDays(calendar)
  if (windows.length === 0) warnings.push("No measure time window is switched on, so the assistant has no times to offer.")
  if (days.length === 0) warnings.push("No measure day is switched on, so the assistant has no days to offer.")

  const questions = runtimeQualifyingQuestions(intake)
  const disqualifiers = compileDisqualifiers(intake)
  const agentName = (agent?.agent_name as string | null)?.trim() || "Mia"
  const tone = (agent?.tone as string | null) || "friendly_professional"
  const timezone =
    (agent?.timezone as string | null) || zipToTimeZone(zipFromAddress(officeAddress)) || "America/New_York"
  const hoursStart = clampHour(agent?.working_hours_start, 8, 23)
  const hoursEnd = clampHour(agent?.working_hours_end, 20, 24)

  const agentPatch: Record<string, unknown> = {
    agent_name: agentName,
    agent_persona: tone,
    tone,
    primary_goal: "book_estimate",
    working_hours_start: hoursStart,
    working_hours_end: hoursEnd,
    timezone,
    qualifying_questions: questions,
    disqualifiers: disqualifiers || null,
    available_days: days,
    appointment_windows: windows,
    per_day_slots: null,
    max_appointments_per_day: null,
    min_booking_lead_days: Math.min(14, Math.max(0, Math.round(calendar?.minLeadDays ?? 1))),
    job_duration_min: Math.min(240, Math.max(30, Math.round(calendar?.measureDurationMin ?? 60))),
    booking_horizon_days: 14,
    requires_travel: true,
    follow_up_enabled: true,
    updated_at: new Date().toISOString(),
  }
  {
    const { error } = agent?.id
      ? await db.from("ai_agent_config").update(agentPatch).eq("id", agent.id)
      : await db.from("ai_agent_config").insert({ company_id: companyId, objection_responses: {}, ...agentPatch })
    if (error) throw new Error(`Could not save the assistant settings: ${error.message}`)
  }

  // 4. Measure capacity
  const capacity = Math.min(10, Math.max(1, Math.round(calendar?.capacity ?? 1)))
  const measureSlots = await syncMeasureSlots(db, companyId, capacity, measureSlotSchedule(calendar))

  // 5. Legacy settings row and the email logo
  await db.from("settings").upsert({
    company_id: companyId,
    ai_name: agentName,
    qualifying_questions: questions,
    objection_responses: (agent?.objection_responses as Record<string, string> | null) ?? {},
    follow_up_enabled: true,
    working_hours_start: hoursStart,
    working_hours_end: hoursEnd,
    timezone,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" })
  if (intake.assets?.logoUrl) {
    await db.from("email_templates").upsert(
      { company_id: companyId, logo_url: intake.assets.logoUrl, updated_at: new Date().toISOString() },
      { onConflict: "company_id" }
    )
  }

  // 6. The assistant's base prompt. Slow (one Sonnet call) and never fatal:
  //    without it the engine uses its built-in prompt plus the live config above.
  let promptGenerated = false
  const hasPrompt = !!(agent?.generated_system_prompt as string | null)?.trim()
  if (promptMode === "always" || (promptMode === "if_missing" && !hasPrompt)) {
    try {
      const kbData: KnowledgeBaseData = {
        companyName: company.name as string,
        serviceType: (company.service_type as string | null) || "flooring",
        serviceArea: areaText || officeAddress || "",
        businessDescription: (kb?.business_description as string | null) ?? undefined,
        servicesOffered: (kbPatch.services_offered as string | null) ?? undefined,
        pricingInfo: (kbPatch.pricing_info as string | null) ?? undefined,
        financingOptions: (kb?.financing_options as string | null) ?? undefined,
        teamInfo: (kbPatch.team_info as string | null) ?? undefined,
        uniqueSellingPoints: (kb?.unique_selling_points as string | null) ?? undefined,
        yearsInBusiness: (kbPatch.years_in_business as string | null) ?? undefined,
        certifications: (kb?.certifications as string | null) ?? undefined,
        testimonials: (kb?.testimonials as string | null) ?? undefined,
        customFacts: (kb?.custom_ai_knowledge as string | null) ?? undefined,
        websiteUrl: (kbPatch.website_url as string | null) ?? undefined,
      }
      const config: AgentConfigData = {
        agentName,
        tone,
        primaryGoal: "book_estimate",
        customInstructions: (agent?.custom_instructions as string | null) ?? undefined,
        qualifyingQuestions: questions.map((q) => ({ question: q.question })),
        disqualifiers,
        objectionResponses: (agent?.objection_responses as Record<string, string> | null) ?? {},
        workingHoursStart: hoursStart,
        workingHoursEnd: hoursEnd,
        timezone,
      }
      const prompt = await generateSystemPrompt(kbData, config)
      if (prompt.trim()) {
        await db.from("ai_agent_config").update({
          generated_system_prompt: prompt,
          prompt_generated_at: new Date().toISOString(),
        }).eq("company_id", companyId)
        promptGenerated = true
      } else {
        warnings.push("The assistant's base prompt came back empty and was not replaced.")
      }
    } catch (err) {
      console.error(`[intake-apply] prompt generation failed for company ${companyId}:`, err)
      warnings.push("The assistant's base prompt could not be written. The assistant still runs on the settings above.")
    }
  }

  return {
    serviceAreaZips: zips ? zips.length : null,
    measureSlots,
    qualifyingQuestions: questions.length,
    promptGenerated,
    warnings,
  }
}
