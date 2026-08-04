/**
 * Smart technician selection logic.
 *
 * Two-phase dispatch:
 * 1. findSlotsForLead  — called mid-conversation via find_available_slots tool.
 *    Returns only slots where a qualified, available tech actually exists.
 *    The slot→tech map is saved to leads.selected_slots for booking-time lookup.
 *
 * 2. selectTechnician  — fallback called after booking if no pre-selected tech.
 *    Runs the same logic against the specific booked time.
 */

import { createServiceRoleClient } from "@/lib/supabase-server"
import { DEFAULT_WINDOWS, DEFAULT_DAYS } from "@/lib/availability"
import type { AppointmentWindow } from "@/lib/availability"
import type { Technician } from "@/types/database"
import { zipToPoint, addressToPoint, insertionCostMin, returnOvertimeMin, sameLocalDay, ROUTE_SLACK_MIN, type LocatedJob, type GeoPoint } from "@/lib/routing"
import { zipToTimeZone } from "@/lib/timezones"

/**
 * Convert a local slot time (e.g. "08:00" on "2026-06-17" in "America/New_York")
 * to a UTC ISO string. Uses Intl.DateTimeFormat.formatToParts so DST is handled
 * correctly — no date libraries needed.
 */
export function localSlotToUtcIso(dateStr: string, timeStr: string, tz: string): string {
  // Treat the local values as UTC temporarily so we can do arithmetic
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`)

  // Find what that "UTC" moment looks like when rendered in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(naiveUtc)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00"
  const localMs = Date.UTC(
    parseInt(get("year")),
    parseInt(get("month")) - 1,
    parseInt(get("day")),
    parseInt(get("hour")) % 24, // hour12:false returns "24" for midnight in some envs
    parseInt(get("minute")),
    parseInt(get("second")),
  )

  // The gap between naiveUtc and localMs IS the UTC offset for this timezone on this date
  const offsetMs = naiveUtc.getTime() - localMs
  return new Date(naiveUtc.getTime() + offsetMs).toISOString()
}

/** "MDT" / "CST" — the abbreviation a lead actually recognises. */
function shortTzName(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(d)
  return parts.find((p) => p.type === "timeZoneName")?.value ?? ""
}

function fmt12(t: string): string {
  const [hStr, mStr] = t.split(":")
  const h = parseInt(hStr, 10)
  const ampm = h < 12 ? "AM" : "PM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return mStr === "00" ? `${h12} ${ampm}` : `${h12}:${mStr} ${ampm}`
}

export type SlotWithTech = {
  label:    string
  isoStart: string
  isoEnd:   string
  techId:   string
  techName: string
}

export type FindSlotsResult =
  | { found: true;  slots: SlotWithTech[] }
  | { found: false; reason: "no_technicians" | "no_specialization_match" | "no_zip_match" | "no_slots" | "job_not_offered" }

/**
 * Find real available booking slots for a specific job type and zip code.
 * Only returns slots where a qualified tech is actually free — no phantom slots.
 */
export async function findSlotsForLead(
  companyId: string,
  jobType:   string | null,
  zip:       string | null,
  leadTimezone?: string | null
): Promise<FindSlotsResult> {
  const db = createServiceRoleClient()

  const [techRes, configRes, companyAreaRes] = await Promise.all([
    db.from("technicians").select("*").eq("company_id", companyId).eq("status", "active").order("name"),
    db.from("ai_agent_config")
      .select("available_days, appointment_windows, booking_horizon_days, timezone, min_booking_lead_days, job_duration_min, requires_travel")
      .eq("company_id", companyId)
      .single(),
    db.from("companies").select("service_area_zips, integration_mode").eq("id", companyId).single(),
  ])

  // Company-level service radius gate (set at onboarding: office + radius →
  // every zip inside it). Techs with serves_all_areas=true mean "all areas WE
  // serve", not "all of the US" — this is the boundary that makes that true.
  const areaZips = (companyAreaRes.data?.service_area_zips as string[] | null) ?? null
  const requiresTravel = (configRes.data?.requires_travel as boolean | null) ?? true
  if (requiresTravel && zip && areaZips && areaZips.length > 0 && !areaZips.includes(zip.slice(0, 5))) {
    return { found: false, reason: "no_zip_match" }
  }

  let allTechs = (techRes.data ?? []) as Technician[]
  if (allTechs.length === 0) return { found: false, reason: "no_technicians" }

  const config       = configRes.data
  const companyTz    = (config?.timezone as string | null) ?? "America/New_York"
  // Customer-facing clock (Tasha incident): windows, labels, day boundaries,
  // and anchor dates are all interpreted in the LEAD's timezone when the zip
  // reveals one — a Michigan lead gets 8–11am EASTERN windows, not Chicago
  // numbers that are off by an hour at their front door. Unknown zip →
  // company timezone (identical to the old behavior).
  // For a call, the lead states their timezone; for a visit, the zip reveals it.
  const tz           = leadTimezone || zipToTimeZone(zip) || companyTz
  const horizonDays  = (config?.booking_horizon_days as number | null) ?? 7
  // Minimum lead time, in COMPANY-LOCAL days. 2 = today and tomorrow are
  // never offered (Top Air: "if it's Monday, never give Tuesday").
  const minLeadDays  = requiresTravel ? ((config?.min_booking_lead_days as number | null) ?? 0) : 0
  const jobDurationMin = (config?.job_duration_min as number | null) ?? 120

  // ── Anchor-day policy (product decision Aug 2026) ──────────────────────────
  // A tech may only be offered on a day where they ALREADY have at least one
  // booked job (ours or office-booked in HCP) — new jobs join existing routes,
  // they don't open dead days. The anchored search looks at least 3 weeks out
  // regardless of the company's normal horizon. ONLY if that whole search
  // yields nothing do we fall back to open days — and those are pushed at
  // least a week out (never "in 2-3 days"), so the office has time to build a
  // route around the first job of a fresh day.
  const ANCHOR_HORIZON_DAYS = 21
  // A call joins no route, so it never waits for an "anchor day" and is
  // bookable as soon as tomorrow.
  const FALLBACK_MIN_LEAD_DAYS = requiresTravel ? 7 : 0
  const MAX_ANCHOR_INSERT_MIN = 45 // route-fit ceiling for joining an existing day
  const scanHorizon = Math.max(horizonDays, ANCHOR_HORIZON_DAYS)
  const availDays    = (config?.available_days as string[] | null) ?? DEFAULT_DAYS
  const windows      = ((config?.appointment_windows as AppointmentWindow[] | null) ?? DEFAULT_WINDOWS)
                         .filter(w => w.enabled)

  // 0. Job-type capability filter — the primary work-routing gate.
  // A tech handles a job type if their job_types list is empty (does everything)
  // or explicitly includes it. If NO active tech handles this job type, the
  // company doesn't offer it → the AI declines gracefully (distinct from an
  // out-of-area miss). Runs before specialization/zip so "we don't do that"
  // beats "not in your area".
  if (jobType) {
    const offering = allTechs.filter(t => techHandlesJob(t.job_types, jobType))
    if (offering.length === 0) return { found: false, reason: "job_not_offered" }
    allTechs = offering
  }

  // 1. Specialization filter (legacy; inert for companies that don't set specializations)
  const targetSpecs = jobType ? (JOB_TYPE_SPECIALIZATION_MAP[jobType] ?? []) : []
  let candidates = targetSpecs.length === 0
    ? allTechs
    : allTechs.filter(t => t.specializations.length === 0 || t.specializations.some(s => targetSpecs.includes(s)))

  if (candidates.length === 0) return { found: false, reason: "no_specialization_match" }

  // 2. Zip coverage filter — hard filter: if a zip is provided and no tech covers it, fail.
  // A tech is eligible if serves_all_areas = true, zip_codes is empty (legacy all-areas),
  // or zip_codes explicitly includes the lead's zip.
  if (zip) {
    candidates = candidates.filter(t =>
      t.serves_all_areas === true ||
      t.zip_codes.length === 0 ||
      t.zip_codes.includes(zip)
    )
  }
  if (candidates.length === 0) return { found: false, reason: "no_zip_match" }

  // 3. Load existing appointments for these techs in the horizon
  const techIds    = candidates.map(t => t.id)
  const now        = new Date()
  const horizonEnd = new Date(now.getTime() + scanHorizon * 24 * 60 * 60 * 1000)

  const [{ data: existingApts }, { data: companyRow }] = await Promise.all([
    db.from("appointments")
      .select("scheduled_at, technician_id, address")
      .eq("company_id", companyId)
      .in("technician_id", techIds)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", horizonEnd.toISOString())
      .neq("status", "cancelled"),
    db.from("companies").select("office_address").eq("id", companyId).single(),
  ])

  const officePoint: GeoPoint | null = addressToPoint(companyRow?.office_address)
  const leadPoint: GeoPoint | null = zipToPoint(zip)

  // Capacity model (product decision Aug 2026): bookings are ARRIVAL WINDOWS
  // that deliberately overlap (8–11 / 10–1 / 12–3 / 3–6). A tech holds ONE job
  // per window — max 4/day. That means "taken" is decided per WINDOW BUCKET
  // for our own bookings, never by raw time overlap (a 10–1 job time-overlaps
  // the 8–11 range and would wrongly kill it, capping techs at ~2 jobs/day).
  //
  //   - OUR appointments  → consume exactly the window they were booked into.
  //   - OFFICE jobs booked directly in HCP (arbitrary times, unknown
  //     semantics) → conservatively block every window they overlap.
  //   - Route scoring still sees ALL jobs as real time intervals.
  const JOB_MS = jobDurationMin * 60 * 1000
  const busyIntervals = new Map<string, Array<LocatedJob>>()          // routing only
  const foreignIntervals = new Map<string, Array<{ startMs: number; endMs: number }>>()
  const ourWindowBookings = new Map<string, Set<string>>()            // techId → "date|windowId"
  const addBusy = (techId: string, startMs: number, endMs: number, point: GeoPoint | null) => {
    if (!busyIntervals.has(techId)) busyIntervals.set(techId, [])
    busyIntervals.get(techId)!.push({ startMs, endMs, point })
  }
  const addForeign = (techId: string, startMs: number, endMs: number) => {
    if (!foreignIntervals.has(techId)) foreignIntervals.set(techId, [])
    foreignIntervals.get(techId)!.push({ startMs, endMs })
  }
  // Bucket a booking into a window: exact local start-time match first, then
  // first window containing it (legacy bookings made under the old 2h grid).
  const bucketOf = (ms: number): { dateStr: string; windowId: string } | null => {
    const d = new Date(ms)
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: tz })
    const hm = d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" })
    const mins = parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(3, 5), 10)
    const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10)
    const exact = windows.find((w) => toMin(w.start) === mins)
    if (exact) return { dateStr, windowId: exact.id }
    const containing = windows.find((w) => mins >= toMin(w.start) && mins < toMin(w.end))
    return containing ? { dateStr, windowId: containing.id } : null
  }
  for (const a of existingApts ?? []) {
    if (!a.technician_id) continue
    const startMs = new Date(a.scheduled_at).getTime()
    addBusy(a.technician_id, startMs, startMs + JOB_MS, addressToPoint(a.address))
    const bucket = bucketOf(startMs)
    if (bucket) {
      if (!ourWindowBookings.has(a.technician_id)) ourWindowBookings.set(a.technician_id, new Set())
      ourWindowBookings.get(a.technician_id)!.add(`${bucket.dateStr}|${bucket.windowId}`)
    } else {
      // Unbucketable oddball (manual booking at 6:45am) — block by overlap
      addForeign(a.technician_id, startMs, startMs + JOB_MS)
    }
  }
  // Anchor source (owner decision Aug 2026, V2 accounts): HCP CRM is the ONLY
  // truth for "this tech has a work day" — a local appointment that never made
  // it into HCP does not anchor. Window CAPACITY still counts local rows
  // (push latency + placeholder-phone bookings must still block double-books).
  const hcpAnchorDays = new Set<string>()
  let hcpReachable = false
  try {
    const { getHcpBusyIntervals } = await import("@/lib/housecall-sync")
    const hcpBusy = await getHcpBusyIntervals(companyId, now.toISOString(), horizonEnd.toISOString(), { markOurJobs: true })
    hcpReachable = true
    for (const b of hcpBusy) {
      hcpAnchorDays.add(`${b.technicianId}|${new Date(b.startMs).toLocaleDateString("en-CA", { timeZone: tz })}`)
      if (!b.ours) {
        // Office-booked jobs: real busy intervals for blocking + routing.
        // Our own HCP mirrors are skipped here — the local rows already
        // window-bucket them, and double-counting cross-blocks windows.
        addBusy(b.technicianId, b.startMs, b.endMs, b.point)
        addForeign(b.technicianId, b.startMs, b.endMs)
      }
    }
  } catch (err) {
    // HCP unreachable — degrade to our own data rather than failing the booking
    console.warn("[slots] HCP availability unavailable, using local only:", err)
  }
  // Anchor set: (tech, company-local day) pairs with ≥1 real job.
  //   V2 (housecall_pro) + HCP reachable → HCP jobs ONLY (incl. our mirrors —
  //     they are real jobs in the CRM). The office's calendar is the truth.
  //   Standalone, or HCP down → local appointments (otherwise standalone
  //     accounts would never have an anchor and live in permanent fallback).
  const hcpMode = (companyAreaRes.data as { integration_mode?: string } | null)?.integration_mode === "housecall_pro"
  const anchorDays = new Set<string>()
  if (hcpMode && hcpReachable) {
    for (const d of hcpAnchorDays) anchorDays.add(d)
  } else {
    for (const [techId, jobs] of busyIntervals) {
      for (const j of jobs) {
        anchorDays.add(`${techId}|${new Date(j.startMs).toLocaleDateString("en-CA", { timeZone: tz })}`)
      }
    }
  }

  const isBusy = (techId: string, slotStartMs: number, slotEndMs: number, dateStr: string, windowId: string) =>
    (ourWindowBookings.get(techId)?.has(`${dateStr}|${windowId}`) ?? false) ||
    (foreignIntervals.get(techId) ?? []).some((b) => b.startMs < slotEndMs && b.endMs > slotStartMs)
  // Insertion cost of THIS lead's job in THIS tech's day around the slot,
  // plus the overtime penalty if it would strand him far from the office
  // past his day end.
  const routeCost = (techId: string, slotStartMs: number, slotEndMs: number, dayEndMs: number): number => {
    const dayJobs = (busyIntervals.get(techId) ?? []).filter((j) =>
      sameLocalDay(j.startMs, slotStartMs, tz)
    )
    const isLast = !dayJobs.some((j) => j.startMs >= slotEndMs)
    return (
      insertionCostMin(dayJobs, officePoint, leadPoint, slotStartMs, slotEndMs) +
      returnOvertimeMin(leadPoint, officePoint, slotEndMs, dayEndMs, isLast)
    )
  }

  // weekly workload for tiebreaking
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7)
  const weeklyCount: Record<string, number> = {}
  for (const t of candidates) weeklyCount[t.id] = 0
  for (const a of existingApts ?? []) {
    const d = new Date(a.scheduled_at)
    if (a.technician_id && d >= weekStart && d < weekEnd)
      weeklyCount[a.technician_id] = (weeklyCount[a.technician_id] ?? 0) + 1
  }

  // 4. Generate slots day by day, window by window — two passes:
  //    PASS 1 (anchored): only techs on days where they already have a job,
  //            searched ≥3 weeks out, with an absolute route-fit ceiling.
  //    PASS 2 (fallback): only if pass 1 found NOTHING — open days allowed,
  //            but never sooner than a week out.
  const runPass = (requireAnchor: boolean, earliestDateStr: string): Array<{ slot: SlotWithTech; cost: number }> => {
    const scored: Array<{ slot: SlotWithTech; cost: number }> = []
    // A fine grid (30-min calls) needs spreading: keep the first, middle and
    // last opening of each day rather than three back-to-back morning slots.
    const fineGrained = windows.length > 6
    for (let offset = 0; offset <= scanHorizon && scored.length < (fineGrained ? 24 : 16); offset++) {
      const day     = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000)
      // Weekday MUST come from the company timezone, same as dateStr. Using the
      // server's weekday (UTC on Railway) shifted every evening (7 PM–midnight
      // CT) one day forward: Sunday slots offered, Friday slots hidden (audit C3).
      const dayName = day.toLocaleDateString("en-US", { weekday: "long", timeZone: tz }).toLowerCase()
      if (!availDays.includes(dayName)) continue

      const dateStr = day.toLocaleDateString("en-CA", { timeZone: tz }) // YYYY-MM-DD
      if (dateStr < earliestDateStr) continue

      const dayCandidates: Array<{ slot: SlotWithTech; cost: number }> = []
      for (const win of windows) {
        // Convert local slot times to UTC so stored scheduled_at values are always UTC
        const isoStart = localSlotToUtcIso(dateStr, win.start, tz)
        const isoEnd   = localSlotToUtcIso(dateStr, win.end,   tz)
        if (new Date(isoStart) <= now) continue

        const [slotH, slotM] = win.start.split(":").map(Number)
        const slotMinutes    = slotH * 60 + slotM

        const slotStartMs = new Date(isoStart).getTime()
        const slotEndMs   = new Date(isoEnd).getTime()
        const avail = candidates
          .filter(t => {
            if (requireAnchor && !anchorDays.has(`${t.id}|${dateStr}`)) return false
            const sched = t.schedule[dayName as keyof Technician["schedule"]] as
              { enabled: boolean; start: string; end: string } | undefined
            if (!sched?.enabled) return false
            const [sh, sm] = sched.start.split(":").map(Number)
            const [eh, em] = sched.end.split(":").map(Number)
            if (slotMinutes < sh * 60 + sm || slotMinutes >= eh * 60 + em) return false
            return !isBusy(t.id, slotStartMs, slotEndMs, dateStr, win.id)
          })
          .map(t => {
            const sched = t.schedule[dayName as keyof Technician["schedule"]] as { end: string }
            const dayEndMs = new Date(localSlotToUtcIso(dateStr, sched.end, tz)).getTime()
            return { t, cost: routeCost(t.id, slotStartMs, slotEndMs, dayEndMs) }
          })
          // Anchored pass: the lead's address must genuinely FIT the existing
          // route — an absolute ceiling, not just relative ranking. (Fallback
          // pass has no ceiling: an empty day's baseline is the office, and an
          // absolute cap would make far-but-served territories unbookable.)
          .filter(x => !requireAnchor || x.cost <= MAX_ANCHOR_INSERT_MIN)
          // Route-first ranking: least added drive wins; workload breaks ties
          .sort((a, b) => (a.cost - b.cost) || ((weeklyCount[a.t.id] ?? 0) - (weeklyCount[b.t.id] ?? 0)))

        if (avail.length === 0) continue

        const best = avail[0].t
        // The label is what the LEAD reads. A 30-minute call gets an exact
        // start time stamped with their own timezone abbreviation, so
        // "Tuesday 10:00 AM MDT" can't be mistaken for our clock.
        const startDate = new Date(isoStart)
        const dayLabel = startDate.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric" })
        const label = fineGrained
          ? `${dayLabel} — ${startDate.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })} ${shortTzName(startDate, tz)}`
          : `${dayLabel} — ${win.label} (${fmt12(win.start)}–${fmt12(win.end)})`
        dayCandidates.push({
          cost: avail[0].cost,
          slot: { label, isoStart, isoEnd, techId: best.id, techName: best.name },
        })
      }

      if (fineGrained && dayCandidates.length > 3) {
        const picks = [...new Set([0, Math.floor(dayCandidates.length / 2), dayCandidates.length - 1])]
        scored.push(...picks.map((i) => dayCandidates[i]))
      } else {
        scored.push(...dayCandidates)
      }
    }
    return scored
  }

  // Lead-time gates computed as LOCAL date strings — "no earlier than N days
  // out" must roll over at the company's midnight, not the server's (UTC).
  const anchoredEarliest = new Date(now.getTime() + minLeadDays * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-CA", { timeZone: tz })
  const fallbackEarliest = new Date(now.getTime() + Math.max(FALLBACK_MIN_LEAD_DAYS, minLeadDays) * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-CA", { timeZone: tz })

  let scored = requiresTravel ? runPass(true, anchoredEarliest) : []
  if (scored.length === 0) {
    console.log(`[slots] no anchored slots in ${scanHorizon}d for company ${companyId} — open-day fallback (≥${Math.max(FALLBACK_MIN_LEAD_DAYS, minLeadDays)}d out)`)
    scored = runPass(false, fallbackEarliest)
  }

  if (scored.length === 0) return { found: false, reason: "no_slots" }

  // Relative route filter: keep slots within ROUTE_SLACK_MIN of the lead's
  // best-routed option. Unavoidable distance appears on every slot and cancels;
  // only badly-sequenced slots (far job wedged between near jobs) get hidden.
  const minCost = Math.min(...scored.map((c) => c.cost))
  const slots = scored
    .filter((c) => c.cost <= minCost + ROUTE_SLACK_MIN)
    .slice(0, 8)
    .map((c) => c.slot)

  return { found: true, slots }
}

export type TechnicianMatchResult =
  | { found: true;  technician: Technician }
  | { found: false; reason: "no_technicians" | "no_specialization_match" | "no_zip_match" | "no_availability" }

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

// Two different job-type vocabularies exist in the system: the SMS/Messenger AI
// engine emits values like "duct_cleaning"/"ac_installation", while the voice
// engine and the technician job_types config use the JOB_TYPES enum
// ("ductwork"/"new_ac_install"). Comparing them by raw string silently declined
// real jobs (a duct lead sent "duct_cleaning", the crew was tagged "ductwork",
// and no tech matched → "we don't offer that"). Normalize BOTH sides to a
// canonical category before any capability comparison.
const JOB_TYPE_CANON: Record<string, string> = {
  ductwork: "duct", duct_cleaning: "duct", duct_repair: "duct",
  ac_repair: "ac_repair", ac_not_cooling: "ac_repair", ac_frozen: "ac_repair",
  ac_replacement: "ac_replace", ac_installation: "ac_replace", new_ac_install: "ac_replace",
  furnace_repair: "furnace_repair", furnace_not_working: "furnace_repair",
  furnace_replacement: "furnace_replace",
  heat_pump_install: "heat_pump", heat_pump_installation: "heat_pump",
  heat_pump_replacement: "heat_pump", heat_pump_repair: "heat_pump",
  full_hvac_upgrade: "full_hvac", hvac_replacement: "full_hvac",
  hvac_maintenance: "maintenance", hvac_tune_up: "maintenance",
  mini_split: "mini_split", mini_split_installation: "mini_split", mini_split_repair: "mini_split",
  thermostat: "thermostat", air_quality: "air_quality",
  boiler_repair: "boiler", commercial_hvac: "commercial",
  electrical: "electrical", plumbing: "plumbing",
  other: "other", general: "general",
}
function canonJob(jt: string | null | undefined): string | null {
  if (!jt) return null
  // Normalize separators/case: "Duct Cleaning", "duct-cleaning", " AC  repair "
  const j = jt.toLowerCase().trim().replace(/[\s\-]+/g, "_")
  const exact = JOB_TYPE_CANON[j]
  if (exact) return exact
  // Substring fallbacks — models occasionally invent values outside the enum
  // (the voice model produced "air_duct_cleaning" and DECLINED the company's
  // core service). Better to bucket a weird string into the right category
  // than to turn a customer away over vocabulary.
  if (/duct/.test(j)) return "duct"
  if (/mini.?split/.test(j)) return "mini_split"
  if (/thermostat|smart.?control/.test(j)) return "thermostat"
  if (/heat.?pump/.test(j)) return "heat_pump"
  if (/boiler/.test(j)) return "boiler"
  if (/furnace|heating|heater/.test(j)) return "furnace_repair"
  if (/air.?quality|purif|filtr|humidif/.test(j)) return "air_quality"
  if (/maint|tune/.test(j)) return "maintenance"
  if (/commercial/.test(j)) return "commercial"
  if (/(install|replace|new)/.test(j) && /(ac|air.?cond|cooling)/.test(j)) return "ac_replace"
  if (/ac|air.?cond|cooling/.test(j)) return "ac_repair"
  // Truly unknown: return null = "cannot classify". Callers treat null as
  // unrestricted rather than declining — never turn away a real customer
  // because the model coined a phrase we've never seen.
  return null
}
/** Booking-time revalidation: is this tech still a legal choice for this job
 *  and address? Used when a booking arrives with a pre-selected tech from an
 *  earlier slot offer — the address collected AFTER the offer may fall outside
 *  the tech's territory, or the tech may have been deactivated (audit C7). */
export async function techCanTakeBooking(
  technicianId: string,
  jobType: string | null,
  zip: string | null,
  scheduledAt?: string | null,
  leadId?: string | null
): Promise<boolean> {
  const db = createServiceRoleClient()
  const { data: t } = await db
    .from("technicians")
    .select("status, job_types, zip_codes, serves_all_areas, company_id")
    .eq("id", technicianId)
    .maybeSingle()
  if (!t || t.status !== "active") return false
  if (!techHandlesJob(t.job_types as string[], jobType)) return false
  // Window-capacity conflict check (product decision Aug 2026): bookings are
  // overlapping ARRIVAL windows and a tech holds one job per window, max 4 a
  // day. Same window twice = double-booked (live-reproduced under the old
  // model); a DIFFERENT window the same day is normal capacity, even though
  // the wall-clock ranges overlap — never block on raw time proximity.
  if (scheduledAt) {
    const startMs = Date.parse(scheduledAt)
    if (!Number.isNaN(startMs)) {
      const [{ data: cfg }, { data: coMode }] = await Promise.all([
        db.from("ai_agent_config")
          .select("appointment_windows, timezone, min_booking_lead_days")
          .eq("company_id", t.company_id as string)
          .maybeSingle(),
        db.from("companies").select("integration_mode").eq("id", t.company_id as string).maybeSingle(),
      ])
      const hcpMode = coMode?.integration_mode === "housecall_pro"
      // Same customer-clock rule as findSlotsForLead — the two MUST agree or
      // the guard would reject every slot the tool legitimately offered.
      const tz = zipToTimeZone(zip) ?? (cfg?.timezone as string | null) ?? "America/New_York"

      // Lead-time gate at booking time too — the slot list already enforces
      // it, but a model writing its own ISO for "tomorrow" must also bounce.
      const minLead = (cfg?.min_booking_lead_days as number | null) ?? 0
      if (minLead > 0) {
        const earliest = new Date(Date.now() + minLead * 24 * 60 * 60 * 1000)
          .toLocaleDateString("en-CA", { timeZone: tz })
        const bookingDate = new Date(startMs).toLocaleDateString("en-CA", { timeZone: tz })
        if (bookingDate < earliest) return false
      }
      const { DEFAULT_WINDOWS } = await import("@/lib/availability")
      const windows = ((cfg?.appointment_windows as Array<{ id: string; start: string; end: string; enabled: boolean }> | null) ?? DEFAULT_WINDOWS)
        .filter((w) => w.enabled)

      const toMin = (s: string) => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(3, 5), 10)
      const localParts = (ms: number) => {
        const d = new Date(ms)
        return {
          dateStr: d.toLocaleDateString("en-CA", { timeZone: tz }),
          mins: (() => { const hm = d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }); return parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(3, 5), 10) })(),
        }
      }
      const target = localParts(startMs)
      const targetWin =
        windows.find((w) => toMin(w.start) === target.mins) ??
        windows.find((w) => target.mins >= toMin(w.start) && target.mins < toMin(w.end)) ??
        null

      // The tech's whole local day, ±1 calendar day of slack for UTC offsets
      const DAY = 24 * 60 * 60 * 1000
      const { data: dayApts } = await db
        .from("appointments")
        .select("id, scheduled_at")
        .eq("technician_id", technicianId)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(startMs - DAY).toISOString())
        .lte("scheduled_at", new Date(startMs + DAY).toISOString())
      const sameDay = (dayApts ?? []).filter((a) => localParts(Date.parse(a.scheduled_at)).dateStr === target.dateStr)

      if (targetWin) {
        // 1. Same window already booked → conflict
        const winOf = (ms: number) => {
          const p = localParts(ms)
          return (
            windows.find((w) => toMin(w.start) === p.mins) ??
            windows.find((w) => p.mins >= toMin(w.start) && p.mins < toMin(w.end)) ??
            null
          )
        }
        if (sameDay.some((a) => winOf(Date.parse(a.scheduled_at))?.id === targetWin.id)) return false
        // 2. Daily cap: one job per enabled window
        if (sameDay.length >= windows.length) return false
        // 3. Office-booked HCP jobs (ours excluded — they're counted above)
        //    conservatively block any window their real interval overlaps
        const winStartMs = startMs - (target.mins - toMin(targetWin.start)) * 60 * 1000
        const winEndMs = winStartMs + (toMin(targetWin.end) - toMin(targetWin.start)) * 60 * 1000
        let hcpDayJobs = 0
        let hcpReachable = false
        try {
          const { getHcpBusyIntervals } = await import("@/lib/housecall-sync")
          const hcpBusy = await getHcpBusyIntervals(
            t.company_id as string,
            new Date(winStartMs - 24 * 60 * 60 * 1000).toISOString(),
            new Date(winEndMs + 12 * 60 * 60 * 1000).toISOString(),
            { markOurJobs: true }
          )
          hcpReachable = true
          // Overlap-blocking: OFFICE jobs only — our mirrors are bucket-counted locally
          if (hcpBusy.some((b) => !b.ours && b.technicianId === technicianId && b.startMs < winEndMs && b.endMs > winStartMs)) return false
          // Anchor counting: ANY job in the CRM that day, ours included
          hcpDayJobs = hcpBusy.filter(
            (b) => b.technicianId === technicianId && localParts(b.startMs).dateStr === target.dateStr
          ).length
        } catch { /* HCP unreachable — local checks already ran */ }

        // 4. Anchor-day rule: a booking may only land on a day where this tech
        //    already has work — UNLESS this exact time was offered by the slot
        //    tool (leads.selected_slots), which already applied the anchored
        //    search and its own week-out fallback. This closes the last door:
        //    a model hand-writing an ISO for an empty day under lead pressure.
        //    V2 accounts: HCP CRM is the ONLY anchor truth (owner decision) —
        //    a local row that never reached HCP does not make a work day.
        const anchored = hcpMode && hcpReachable ? hcpDayJobs > 0 : (sameDay.length > 0 || hcpDayJobs > 0)
        if (!anchored) {
          let offered = false
          if (leadId) {
            const { data: leadRow } = await db
              .from("leads").select("selected_slots").eq("id", leadId).maybeSingle()
            const slotMap = (leadRow?.selected_slots ?? {}) as Record<string, unknown>
            offered = !!slotMap[new Date(startMs).toISOString().substring(0, 16)]
          }
          if (!offered) return false
        }
      } else {
        // Time outside every configured window (legacy/manual booking) — fall
        // back to the old ±2h overlap rule so oddball times still can't stack.
        const JOB_MS = 2 * 60 * 60 * 1000
        if (sameDay.some((a) => Math.abs(Date.parse(a.scheduled_at) - startMs) < JOB_MS)) return false
        // Anchor rule applies here too — an oddball time must not become the
        // back door onto an empty day. sameDay covers our jobs; check HCP for
        // office work, then the tool-offered escape.
        if (hcpMode || sameDay.length === 0) {
          let anchored = !hcpMode && sameDay.length > 0
          try {
            const { getHcpBusyIntervals } = await import("@/lib/housecall-sync")
            const DAY_MS = 24 * 60 * 60 * 1000
            const busy = await getHcpBusyIntervals(
              t.company_id as string,
              new Date(startMs - DAY_MS).toISOString(),
              new Date(startMs + DAY_MS).toISOString(),
              { markOurJobs: true }
            )
            anchored = anchored || busy.some((b) => b.technicianId === technicianId && localParts(b.startMs).dateStr === target.dateStr)
          } catch { anchored = true /* HCP unreachable — can't prove empty */ }
          if (!anchored) {
            let offered = false
            if (leadId) {
              const { data: leadRow } = await db
                .from("leads").select("selected_slots").eq("id", leadId).maybeSingle()
              const slotMap = (leadRow?.selected_slots ?? {}) as Record<string, unknown>
              offered = !!slotMap[new Date(startMs).toISOString().substring(0, 16)]
            }
            if (!offered) return false
          }
        }
      }
    }
  }
  const z = zip?.match(/\d{5}/)?.[0]
  if (z) {
    // COMPANY service-area gate first — "serves_all_areas" on a tech means
    // "all areas WE serve", never "anywhere in the US". Slot-offering enforced
    // this; booking-time didn't, so an address arriving after the offer could
    // book outside territory (adversarial finding: company boundary).
    const { data: co } = await db
      .from("companies").select("service_area_zips").eq("id", t.company_id).single()
    const areaZips = (co?.service_area_zips as string[] | null) ?? null
    if (areaZips && areaZips.length > 0 && !areaZips.includes(z)) return false
    if (!(t.serves_all_areas || !(t.zip_codes as string[])?.length || (t.zip_codes as string[]).includes(z))) return false
  }
  return true
}

/** Is this tech's day already a real work day (≥1 other job, ours or HCP)?
 *  Used to stamp bookings that OPEN a fresh route day (the anchored search
 *  fell back to an open day) so the office knows to build a route around it. */
export async function techAnchoredOn(
  companyId: string,
  technicianId: string,
  scheduledAtIso: string,
  excludeAppointmentId?: string
): Promise<boolean> {
  const db = createServiceRoleClient()
  const { data: cfg } = await db
    .from("ai_agent_config").select("timezone").eq("company_id", companyId).maybeSingle()
  const tz = (cfg?.timezone as string | null) ?? "America/New_York"
  const startMs = Date.parse(scheduledAtIso)
  if (Number.isNaN(startMs)) return true // unparseable — don't stamp noise
  const dateStr = new Date(startMs).toLocaleDateString("en-CA", { timeZone: tz })
  const DAY = 24 * 60 * 60 * 1000

  const { data: coMode } = await db
    .from("companies").select("integration_mode").eq("id", companyId).maybeSingle()
  const hcpMode = coMode?.integration_mode === "housecall_pro"

  if (!hcpMode) {
    // Standalone: local appointments are the only schedule there is
    let q = db.from("appointments")
      .select("id, scheduled_at")
      .eq("technician_id", technicianId)
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date(startMs - DAY).toISOString())
      .lte("scheduled_at", new Date(startMs + DAY).toISOString())
    if (excludeAppointmentId) q = q.neq("id", excludeAppointmentId)
    const { data: apts } = await q
    return (apts ?? []).some((a) => new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: tz }) === dateStr)
  }

  // V2: HCP CRM is the only anchor truth (this appointment isn't pushed yet
  // when the stamp runs, so it can't count itself)
  try {
    const { getHcpBusyIntervals } = await import("@/lib/housecall-sync")
    const busy = await getHcpBusyIntervals(
      companyId,
      new Date(startMs - DAY).toISOString(),
      new Date(startMs + DAY).toISOString(),
      { markOurJobs: true }
    )
    return busy.some((b) =>
      b.technicianId === technicianId &&
      new Date(b.startMs).toLocaleDateString("en-CA", { timeZone: tz }) === dateStr
    )
  } catch {
    return true // HCP unreachable — can't prove it's empty, don't stamp
  }
}

/** Does a tech (with its configured job_types) handle this job type? Empty = all. */
function techHandlesJob(techJobTypes: string[] | null | undefined, jobType: string | null): boolean {
  if (!techJobTypes?.length) return true
  const wanted = canonJob(jobType)
  // null = unclassifiable, "general" = explicit any-tech, "other" = the
  // enum's own catch-all for nonstandard REAL requests. None may gate: the
  // voice enum forces "other" for anything unusual, and hard-declining it
  // closed real callers as lost (adversarial finding 6). An oddball job going
  // to a dispatcher beats a customer being told "we don't do that."
  if (!wanted || wanted === "general" || wanted === "other") return true
  return techJobTypes.some(cap => canonJob(cap) === wanted)
}

// Map job_type values → specialization labels so AI job types resolve to technician skills
const JOB_TYPE_SPECIALIZATION_MAP: Record<string, string[]> = {
  ac_repair:                 ["AC Repair"],
  ac_maintenance:            ["AC Repair"],
  ac_installation:           ["AC Repair", "Heat Pump Installation", "Mini-Split Installation"],
  ac_not_cooling:            ["AC Repair"],
  ac_frozen:                 ["AC Repair"],
  furnace_repair:            ["Furnace Repair"],
  furnace_not_working:       ["Furnace Repair"],
  heat_pump_repair:          ["Heat Pump Installation", "AC Repair"],
  heat_pump_installation:    ["Heat Pump Installation"],
  duct_cleaning:             ["Duct Cleaning"],
  duct_repair:               ["Duct Cleaning"],
  mini_split_installation:   ["Mini-Split Installation"],
  mini_split_repair:         ["Mini-Split Installation", "AC Repair"],
  boiler_repair:             ["Boiler Repair"],
  commercial_hvac:           ["Commercial HVAC"],
  hvac_tune_up:              ["AC Repair", "Furnace Repair"],
  hvac_replacement:          ["AC Repair", "Furnace Repair", "Heat Pump Installation"],
  air_quality:               ["Air Quality / Filtration"],
  electrical:                ["Electrical"],
  plumbing:                  ["Plumbing"],
  general:                   [],  // any technician qualifies
}

/**
 * Given a booked appointment, find the best technician to assign.
 * Priority: specialization match → zip coverage → schedule availability → least bookings this week.
 */
export async function selectTechnician(
  companyId: string,
  appointmentId: string,
  scheduledAt: string,
  jobType: string | null,
  leadZip: string | null
): Promise<TechnicianMatchResult> {
  const db = createServiceRoleClient()

  // 1. Fetch all active technicians + company timezone (schedule checks must
  // run in COMPANY time — the server is UTC and every CT evening the server
  // weekday is already "tomorrow", audit C3)
  const [{ data: allTechs }, { data: tzCfg }, { data: companyArea }] = await Promise.all([
    db.from("technicians")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name"),
    db.from("ai_agent_config").select("timezone").eq("company_id", companyId).single(),
    db.from("companies").select("service_area_zips").eq("id", companyId).single(),
  ])

  const techs = (allTechs ?? []) as Technician[]
  if (techs.length === 0) return { found: false, reason: "no_technicians" }

  // Company-level service-area gate — mirrors findSlotsForLead so a booking
  // whose address arrived after the slot offer can't land outside territory
  const companyZips = (companyArea?.service_area_zips as string[] | null) ?? null
  if (leadZip && companyZips && companyZips.length > 0 && !companyZips.includes(leadZip.slice(0, 5))) {
    return { found: false, reason: "no_zip_match" }
  }

  // Same customer-clock rule as findSlotsForLead/techCanTakeBooking: an
  // 8–11am EASTERN booking must be judged against the tech's day in EASTERN,
  // or a Michigan morning window reads as 7am Chicago and fails the shift
  // check (found in the post-timezone-fix regression audit).
  const tz = zipToTimeZone(leadZip) ?? tzCfg?.timezone ?? "America/New_York"
  const aptDate = new Date(scheduledAt)
  const dayName = aptDate.toLocaleDateString("en-US", { weekday: "long", timeZone: tz })
    .toLowerCase() as keyof Technician["schedule"]
  const tparts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" })
    .formatToParts(aptDate)
  const aptHour = Number(tparts.find(p => p.type === "hour")?.value ?? 0) % 24
  const aptMin  = Number(tparts.find(p => p.type === "minute")?.value ?? 0)

  // 1.5 Job-type capability filter — HARD, matching findSlotsForLead. The old
  // fallback ("nobody handles it → let everybody through") silently defeated
  // the owner-vs-crew routing at assignment time (audit C6): a heat-pump job
  // got assigned to a duct tech. If no tech handles the job, we FAIL and the
  // caller flags the appointment for manual dispatch — an honest gap beats a
  // wrong tech on a real doorstep.
  if (jobType) {
    const jobCapable = techs.filter(t => techHandlesJob(t.job_types, jobType))
    if (jobCapable.length === 0) return { found: false, reason: "no_specialization_match" }
    techs.splice(0, techs.length, ...jobCapable)
  }

  // 2. Filter by specialization (legacy; inert when specializations unset)
  const targetSpecs = jobType ? (JOB_TYPE_SPECIALIZATION_MAP[jobType] ?? []) : []
  let candidates = targetSpecs.length === 0
    ? techs  // no specific spec required — any tech qualifies
    : techs.filter(t =>
        t.specializations.length === 0 ||  // tech marked as general (no spec filter)
        t.specializations.some(s => targetSpecs.includes(s))
      )

  if (candidates.length === 0) return { found: false, reason: "no_specialization_match" }

  // 3. Zip coverage — HARD filter, mirroring findSlotsForLead (audit C6). The
  // old "only apply if someone matches" fallback assigned an Illinois tech to
  // a Michigan address (and Ariel R to Beverly Hills 90210).
  if (leadZip) {
    candidates = candidates.filter(t =>
      t.serves_all_areas === true ||
      t.zip_codes.length === 0 ||
      t.zip_codes.includes(leadZip.slice(0, 5))
    )
  } else {
    // NO zip at all: if geography matters for this company (any tech is
    // territory-restricted, e.g. a two-metro operation), assigning blind put a
    // Michigan job on the Chicago crew (live-reproduced). Fail → the caller
    // flags the appointment for manual dispatch instead of guessing a metro.
    const geoMatters = candidates.some(t => !t.serves_all_areas && (t.zip_codes?.length ?? 0) > 0)
    if (geoMatters) return { found: false, reason: "no_zip_match" }
  }

  if (candidates.length === 0) return { found: false, reason: "no_zip_match" }

  // 4. Filter by working schedule for the appointment day + time
  const scheduleFiltered = candidates.filter(t => {
    const daySchedule = t.schedule[dayName]
    if (!daySchedule?.enabled) return false

    const [startH, startM] = daySchedule.start.split(":").map(Number)
    const [endH,   endM  ] = daySchedule.end.split(":").map(Number)
    const startMin = startH * 60 + startM
    const endMin   = endH   * 60 + endM
    const aptMin_  = aptHour * 60 + aptMin

    return aptMin_ >= startMin && aptMin_ < endMin
  })

  if (scheduleFiltered.length === 0) {
    // Fall back to any candidate available that day regardless of exact window
    // (business decision: prefer having SOMEONE booked rather than failing)
    const dayFiltered = candidates.filter(t => t.schedule[dayName]?.enabled)
    if (dayFiltered.length === 0) return { found: false, reason: "no_availability" }
    candidates = dayFiltered
  } else {
    candidates = scheduleFiltered
  }

  // 4.5 Conflict check — the tech's REAL day, from BOTH systems: our
  // appointments and jobs the office booked directly in Housecall Pro.
  const JOB_MS = 2 * 60 * 60 * 1000
  const aptStartMs = aptDate.getTime()
  const aptEndMs   = aptStartMs + JOB_MS
  const dayFrom = new Date(aptStartMs - 12 * 60 * 60 * 1000).toISOString()
  const dayTo   = new Date(aptEndMs   + 12 * 60 * 60 * 1000).toISOString()

  const busy = new Map<string, Array<LocatedJob>>()
  const addBusy = (id: string, startMs: number, endMs: number, point: GeoPoint | null) => {
    if (!busy.has(id)) busy.set(id, [])
    busy.get(id)!.push({ startMs, endMs, point })
  }
  const [{ data: sameDayApts }, { data: companyRow2 }, { data: aptRow }, { data: cfgRow }] = await Promise.all([
    db.from("appointments")
      .select("scheduled_at, technician_id, address")
      .eq("company_id", companyId)
      .in("technician_id", candidates.map(t => t.id))
      .gte("scheduled_at", dayFrom)
      .lte("scheduled_at", dayTo)
      .neq("status", "cancelled")
      .neq("id", appointmentId),
    db.from("companies").select("office_address").eq("id", companyId).single(),
    db.from("appointments").select("address").eq("id", appointmentId).single(),
    db.from("ai_agent_config").select("timezone").eq("company_id", companyId).single(),
  ])
  for (const a of sameDayApts ?? []) {
    if (a.technician_id) {
      const startMs = new Date(a.scheduled_at).getTime()
      addBusy(a.technician_id, startMs, startMs + JOB_MS, addressToPoint(a.address))
    }
  }
  try {
    const { getHcpBusyIntervals } = await import("@/lib/housecall-sync")
    for (const b of await getHcpBusyIntervals(companyId, dayFrom, dayTo)) {
      addBusy(b.technicianId, b.startMs, b.endMs, b.point)
    }
  } catch (err) {
    console.warn("[selectTechnician] HCP availability unavailable, using local only:", err)
  }
  const conflictFree = candidates.filter(t =>
    !(busy.get(t.id) ?? []).some(b => b.startMs < aptEndMs && b.endMs > aptStartMs)
  )
  // Prefer conflict-free techs; if literally everyone conflicts, keep original
  // candidates (someone assigned beats nobody — the office resolves it)
  if (conflictFree.length > 0) candidates = conflictFree

  // 4.6 Route ranking — least added drive time wins the assignment.
  const officePoint2: GeoPoint | null = addressToPoint(companyRow2?.office_address)
  const jobPoint: GeoPoint | null = addressToPoint(aptRow?.address) ?? zipToPoint(leadZip)
  const costOf = new Map<string, number>()
  for (const t of candidates) {
    const dayJobs = (busy.get(t.id) ?? []).filter(j => sameLocalDay(j.startMs, aptStartMs, (cfgRow?.timezone as string | null) ?? "America/New_York"))
    costOf.set(t.id, insertionCostMin(dayJobs, officePoint2, jobPoint, aptStartMs, aptEndMs))
  }
  candidates = [...candidates].sort((a, b) => (costOf.get(a.id)! - costOf.get(b.id)!))

  // 5. Rank by fewest appointments this week → pick most available tech
  const weekStart = new Date(aptDate)
  weekStart.setDate(aptDate.getDate() - aptDate.getDay()) // Sunday
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const techIds = candidates.map(t => t.id)

  const { data: weeklyApts } = await db
    .from("appointments")
    .select("technician_id")
    .eq("company_id", companyId)
    .in("technician_id", techIds)
    .gte("scheduled_at", weekStart.toISOString())
    .lt("scheduled_at", weekEnd.toISOString())
    .neq("status", "cancelled")

  const aptsPerTech: Record<string, number> = {}
  for (const t of candidates) aptsPerTech[t.id] = 0
  for (const a of weeklyApts ?? []) {
    if (a.technician_id) aptsPerTech[a.technician_id] = (aptsPerTech[a.technician_id] ?? 0) + 1
  }

  const best = candidates.reduce((prev, curr) =>
    (aptsPerTech[curr.id] ?? 0) < (aptsPerTech[prev.id] ?? 0) ? curr : prev
  )

  // 6. Assign technician to appointment
  await db
    .from("appointments")
    .update({ technician_id: best.id, technician_name: best.name })
    .eq("id", appointmentId)
    .eq("company_id", companyId)

  return { found: true, technician: best }
}

/**
 * Called when selectTechnician returns found:false — annotates the appointment
 * so the contractor can see it needs manual dispatch in the appointments view.
 */
export async function flagNoTechAvailable(
  appointmentId: string,
  reason: "no_technicians" | "no_specialization_match" | "no_zip_match" | "no_availability",
  companyId: string
): Promise<void> {
  const db = createServiceRoleClient()
  const reasonLabels: Record<string, string> = {
    no_technicians:        "No technicians configured",
    no_specialization_match: "No tech with the required specialization",
    no_zip_match:          "No tech covers the lead's zip code",
    no_availability:       "No tech available at the booked time",
  }
  const label = reasonLabels[reason] ?? reason
  const { data: apt } = await db.from("appointments").select("notes")
    .eq("id", appointmentId).eq("company_id", companyId).single()
  const updatedNotes = [apt?.notes, `⚠️ Auto-dispatch failed: ${label}. Manual dispatch required.`]
    .filter(Boolean).join(" | ")
  await db.from("appointments").update({ notes: updatedNotes })
    .eq("id", appointmentId).eq("company_id", companyId)
}

/**
 * Build the technician context block to inject into the AI system prompt,
 * so the AI knows WHO it just booked when confirming.
 */
export function buildTechnicianContextBlock(technicians: Technician[]): string {
  if (technicians.length === 0) {
    return `=== TECHNICIANS ===
No technicians configured. When booking, confirm the appointment without a technician name.
=== END TECHNICIANS ===`
  }

  const active = technicians.filter(t => t.status === "active")
  if (active.length === 0) {
    return `=== TECHNICIANS ===
No active technicians available right now.
=== END TECHNICIANS ===`
  }

  const lines = active.map(t => {
    const specs = t.specializations.length > 0 ? t.specializations.join(", ") : "General"
    const zips  = t.zip_codes.length > 0 ? t.zip_codes.join(", ") : "All areas"
    const days  = (Object.entries(t.schedule) as [string, { enabled: boolean }][])
      .filter(([, v]) => v.enabled).map(([k]) => k).join(", ")
    return `  • ${t.name} (${t.phone ?? "no phone"}) | Skills: ${specs} | Zips: ${zips} | Works: ${days}`
  })

  return `=== TECHNICIANS ===
Before offering time slots, call find_available_slots(job_type, zip_code).
That tool returns real available slots AND tells you which technician is assigned to each one.

WHEN LEAD ASKS "WHO'S COMING?":
→ If you already called find_available_slots: share the tech name shown for their preferred slot.
→ If you haven't called it yet: "Let me check who's available for your job and area." Then call find_available_slots.

AFTER BOOKING:
→ If find_available_slots told you a specific tech: "[Tech first name] is booked for [Day] at [Time] at [Address]. They'll reach out before heading over."
→ If you do NOT know which tech: "You're on the schedule — [Day] at [Time] at [Address]. Our tech will reach out before heading over."

Active technicians:
${lines.join("\n")}
=== END TECHNICIANS ===`
}

/**
 * Pull available technicians for a given appointment and return a formatted block
 * for injection into the voice/SMS system prompt.
 */
export async function getTechnicianContextForCompany(companyId: string): Promise<string> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from("technicians")
    .select("*")
    .eq("company_id", companyId)
    .order("name")

  return buildTechnicianContextBlock((data ?? []) as Technician[])
}
