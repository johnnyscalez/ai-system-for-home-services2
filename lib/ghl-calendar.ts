import { createServiceRoleClient } from "@/lib/supabase-server"

// ─────────────────────────────────────────────────────────────────────────────
// Booking against a GoHighLevel calendar.
//
// For a company that already runs GHL, GHL is the calendar: it is connected to
// the owner's real Google Calendar, so its free-slot API already accounts for
// everything else in their day, and creating an appointment there fires the
// confirmation email and produces the meeting link they've configured. Nothing
// has to be connected inside FieldBuilt, and the owner never logs into it.
//
// Verified live: free-slots respects real Google busy time (a day with meetings
// returned a single opening), and accepts a timezone so slots come back already
// in the lead's clock.
// ─────────────────────────────────────────────────────────────────────────────

const GHL_BASE = "https://services.leadconnectorhq.com"

export type GhlCalendarConn = {
  company_id: string
  api_key: string
  location_id: string
  calendar_id: string
}

export async function getGhlCalendar(companyId: string): Promise<GhlCalendarConn | null> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from("ghl_connections")
    .select("company_id, api_key, location_id, calendar_id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle()
  if (!data?.calendar_id) return null
  return data as GhlCalendarConn
}

function headers(conn: GhlCalendarConn) {
  return {
    Authorization: `Bearer ${conn.api_key}`,
    Version: "2021-04-15",
    "Content-Type": "application/json",
  }
}

export type GhlSlot = { isoStart: string; label: string }

/** "MDT" / "CST" — the abbreviation a lead recognises. */
function tzAbbrev(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(d)
  return parts.find((p) => p.type === "timeZoneName")?.value ?? ""
}

/**
 * Real openings on the GHL calendar, rendered in the LEAD's timezone.
 * Spread across days (first / middle / last of each day) so an offer covers
 * the week instead of three consecutive slots on one morning.
 */
export async function getGhlFreeSlots(
  conn: GhlCalendarConn,
  leadTimezone: string,
  opts: { daysAhead?: number; max?: number } = {}
): Promise<GhlSlot[]> {
  const daysAhead = opts.daysAhead ?? 10
  const max = opts.max ?? 8
  const start = Date.now() + 60 * 60 * 1000 // never offer the next few minutes
  const end = Date.now() + daysAhead * 24 * 60 * 60 * 1000

  const url =
    `${GHL_BASE}/calendars/${conn.calendar_id}/free-slots` +
    `?startDate=${start}&endDate=${end}&timezone=${encodeURIComponent(leadTimezone)}`

  const res = await fetch(url, { headers: headers(conn) })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    console.error("[ghl-calendar] free-slots failed", res.status, JSON.stringify(json).slice(0, 300))
    return []
  }

  const out: GhlSlot[] = []
  // Response is { "YYYY-MM-DD": { slots: [iso, ...] }, traceId }
  for (const key of Object.keys(json).sort()) {
    if (key === "traceId") continue
    const daySlots = (json[key] as { slots?: string[] } | undefined)?.slots ?? []
    if (daySlots.length === 0) continue
    // First / middle / last opening of the day
    const picks = [...new Set([0, Math.floor(daySlots.length / 2), daySlots.length - 1])]
    for (const i of picks) {
      const iso = daySlots[i]
      const d = new Date(iso)
      out.push({
        isoStart: iso,
        label:
          `${d.toLocaleDateString("en-US", { timeZone: leadTimezone, weekday: "long", month: "short", day: "numeric" })}` +
          ` — ${d.toLocaleTimeString("en-US", { timeZone: leadTimezone, hour: "numeric", minute: "2-digit" })} ${tzAbbrev(d, leadTimezone)}`,
      })
    }
    if (out.length >= max) break
  }
  return out.slice(0, max)
}

/**
 * Create the appointment on the GHL calendar. GHL sends the confirmation
 * email and attaches the meeting link configured on the calendar.
 * Returns the GHL event id, or null on failure.
 */
export async function createGhlAppointment(
  conn: GhlCalendarConn,
  args: { contactId: string; startTimeIso: string; title?: string; leadTimezone?: string }
): Promise<{ id: string; meetingUrl: string | null } | null> {
  const res = await fetch(`${GHL_BASE}/calendars/events/appointments`, {
    method: "POST",
    headers: headers(conn),
    body: JSON.stringify({
      calendarId: conn.calendar_id,
      locationId: conn.location_id,
      contactId: args.contactId,
      startTime: args.startTimeIso,
      title: args.title ?? "FieldBuilt walkthrough",
      appointmentStatus: "confirmed",
      // We offered slots GHL itself returned moments ago; re-validating only
      // opens a race where the lead is told "booked" and nothing is created.
      ignoreFreeSlotValidation: true,
      ...(args.leadTimezone ? { selectedTimezone: args.leadTimezone } : {}),
    }),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    console.error(
      `[ghl-calendar] CREATE APPOINTMENT FAILED (${res.status}) contact=${args.contactId} start=${args.startTimeIso} :: ${JSON.stringify(json).slice(0, 400)}`
    )
    return null
  }
  const ev = (json.event ?? json) as Record<string, unknown>
  return {
    id: String(ev.id ?? ""),
    meetingUrl: (ev.address as string) || (ev.meetingUrl as string) || null,
  }
}
