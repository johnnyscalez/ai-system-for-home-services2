/**
 * Smart technician selection logic.
 * Called immediately after the AI books an appointment — selects the best
 * available technician based on specialization → zip coverage → schedule → workload.
 */

import { createServiceRoleClient } from "@/lib/supabase-server"
import type { Technician } from "@/types/database"

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

  return { found: true, technician: best }
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
When you book an appointment, the system will automatically assign the best-matched technician.
Your job: after booking, confirm to the lead with the technician's first name.
Example: "I've got James booked for your AC repair on Tuesday at 10am."

Active technicians:
${lines.join("\n")}

If no technician can be found for a job type or zip code, tell the lead:
"Let me check with our scheduling team and confirm the best time for you — I'll follow up shortly."
Then call update_lead_status with 'needs_attention'.
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
