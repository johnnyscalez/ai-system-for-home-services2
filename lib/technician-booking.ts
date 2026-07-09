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

/**
 * Convert a local slot time (e.g. "08:00" on "2026-06-17" in "America/New_York")
 * to a UTC ISO string. Uses Intl.DateTimeFormat.formatToParts so DST is handled
 * correctly — no date libraries needed.
 */
function localSlotToUtcIso(dateStr: string, timeStr: string, tz: string): string {
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
  | { found: false; reason: "no_technicians" | "no_specialization_match" | "no_zip_match" | "no_slots" }

/**
 * Find real available booking slots for a specific job type and zip code.
 * Only returns slots where a qualified tech is actually free — no phantom slots.
 */
export async function findSlotsForLead(
  companyId: string,
  jobType:   string | null,
  zip:       string | null
): Promise<FindSlotsResult> {
  const db = createServiceRoleClient()

  const [techRes, configRes] = await Promise.all([
    db.from("technicians").select("*").eq("company_id", companyId).eq("status", "active").order("name"),
    db.from("ai_agent_config")
      .select("available_days, appointment_windows, booking_horizon_days, timezone")
      .eq("company_id", companyId)
      .single(),
  ])

  const allTechs = (techRes.data ?? []) as Technician[]
  if (allTechs.length === 0) return { found: false, reason: "no_technicians" }

  const config       = configRes.data
  const tz           = (config?.timezone as string | null) ?? "America/New_York"
  const horizonDays  = (config?.booking_horizon_days as number | null) ?? 7
  const availDays    = (config?.available_days as string[] | null) ?? DEFAULT_DAYS
  const windows      = ((config?.appointment_windows as AppointmentWindow[] | null) ?? DEFAULT_WINDOWS)
                         .filter(w => w.enabled)

  // 1. Specialization filter
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
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000)

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

  // The tech's REAL day = our appointments + every job booked directly in
  // Housecall Pro by the office. Both become busy intervals; a slot is taken
  // if any interval overlaps it — not just exact start-time matches.
  const JOB_MS = 2 * 60 * 60 * 1000
  const busyIntervals = new Map<string, Array<LocatedJob>>()
  const addBusy = (techId: string, startMs: number, endMs: number, point: GeoPoint | null) => {
    if (!busyIntervals.has(techId)) busyIntervals.set(techId, [])
    busyIntervals.get(techId)!.push({ startMs, endMs, point })
  }
  for (const a of existingApts ?? []) {
    if (a.technician_id) {
      const startMs = new Date(a.scheduled_at).getTime()
      addBusy(a.technician_id, startMs, startMs + JOB_MS, addressToPoint(a.address))
    }
  }
  try {
    const { getHcpBusyIntervals } = await import("@/lib/housecall-sync")
    const hcpBusy = await getHcpBusyIntervals(companyId, now.toISOString(), horizonEnd.toISOString())
    for (const b of hcpBusy) addBusy(b.technicianId, b.startMs, b.endMs, b.point)
  } catch (err) {
    // HCP unreachable — degrade to our own data rather than failing the booking
    console.warn("[slots] HCP availability unavailable, using local only:", err)
  }
  const isBusy = (techId: string, slotStartMs: number, slotEndMs: number) =>
    (busyIntervals.get(techId) ?? []).some((b) => b.startMs < slotEndMs && b.endMs > slotStartMs)
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

  // 4. Generate slots day by day, window by window — only include slots with an available tech
  const scored: Array<{ slot: SlotWithTech; cost: number }> = []

  for (let offset = 0; offset <= horizonDays && scored.length < 16; offset++) {
    const day     = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000)
    const dayName = DAY_NAMES[day.getDay()] as string
    if (!availDays.includes(dayName)) continue

    const dateStr = day.toLocaleDateString("en-CA", { timeZone: tz }) // YYYY-MM-DD

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
          const sched = t.schedule[dayName as keyof Technician["schedule"]] as
            { enabled: boolean; start: string; end: string } | undefined
          if (!sched?.enabled) return false
          const [sh, sm] = sched.start.split(":").map(Number)
          const [eh, em] = sched.end.split(":").map(Number)
          if (slotMinutes < sh * 60 + sm || slotMinutes >= eh * 60 + em) return false
          return !isBusy(t.id, slotStartMs, slotEndMs)
        })
        .map(t => {
          const sched = t.schedule[dayName as keyof Technician["schedule"]] as { end: string }
          const dayEndMs = new Date(localSlotToUtcIso(dateStr, sched.end, tz)).getTime()
          return { t, cost: routeCost(t.id, slotStartMs, slotEndMs, dayEndMs) }
        })
        // Route-first ranking: least added drive wins; workload breaks ties
        .sort((a, b) => (a.cost - b.cost) || ((weeklyCount[a.t.id] ?? 0) - (weeklyCount[b.t.id] ?? 0)))

      if (avail.length === 0) continue

      const best     = avail[0].t
      const dayLabel = day.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric" })
      scored.push({
        cost: avail[0].cost,
        slot: {
          label:    `${dayLabel} — ${win.label} (${fmt12(win.start)}–${fmt12(win.end)})`,
          isoStart,
          isoEnd,
          techId:   best.id,
          techName: best.name,
        },
      })
    }
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

  // 1. Fetch all active technicians for this company
  const { data: allTechs } = await db
    .from("technicians")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name")

  const techs = (allTechs ?? []) as Technician[]
  if (techs.length === 0) return { found: false, reason: "no_technicians" }

  const aptDate = new Date(scheduledAt)
  const dayName = DAY_NAMES[aptDate.getDay()] as keyof Technician["schedule"]
  const aptHour = aptDate.getHours()
  const aptMin  = aptDate.getMinutes()

  // 2. Filter by specialization
  const targetSpecs = jobType ? (JOB_TYPE_SPECIALIZATION_MAP[jobType] ?? []) : []
  let candidates = targetSpecs.length === 0
    ? techs  // no specific spec required — any tech qualifies
    : techs.filter(t =>
        t.specializations.length === 0 ||  // tech marked as general (no spec filter)
        t.specializations.some(s => targetSpecs.includes(s))
      )

  if (candidates.length === 0) return { found: false, reason: "no_specialization_match" }

  // 3. Filter by zip code coverage (if we have a zip AND tech has zip restrictions)
  if (leadZip) {
    const zipFiltered = candidates.filter(t =>
      t.zip_codes.length === 0 ||  // no restriction = serves all areas
      t.zip_codes.includes(leadZip)
    )
    // Only apply zip filter if at least one tech covers it
    if (zipFiltered.length > 0) candidates = zipFiltered
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
