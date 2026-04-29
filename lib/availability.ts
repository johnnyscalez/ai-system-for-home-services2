export type AppointmentWindow = {
  id: string
  label: string
  start: string  // "08:00" 24h
  end: string    // "10:00" 24h
  enabled: boolean
}

export type AvailabilitySettings = {
  available_days: string[]
  appointment_windows: AppointmentWindow[]
  booking_horizon_days: number
  max_appointments_per_day: number | null
  timezone: string
}

export const DEFAULT_WINDOWS: AppointmentWindow[] = [
  { id: "morning",      label: "Morning",       start: "08:00", end: "10:00", enabled: true  },
  { id: "midmorning",   label: "Mid-morning",   start: "10:00", end: "12:00", enabled: true  },
  { id: "afternoon",    label: "Afternoon",     start: "13:00", end: "15:00", enabled: true  },
  { id: "late_afternoon", label: "Late afternoon", start: "15:00", end: "17:00", enabled: false },
]

export const DEFAULT_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]

export type AvailableSlot = {
  label: string      // "Thursday, May 1 — Morning (8:00–10:00 AM)"
  isoStart: string   // ISO 8601 for book_appointment tool
  isoEnd: string
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const ampm = h < 12 ? "AM" : "PM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`
}

/**
 * Returns the next N available booking slots for a company, excluding slots
 * that are already taken by existing scheduled appointments.
 * Slots are capped at 6 so the AI prompt stays concise.
 */
export function getAvailableSlots(
  settings: AvailabilitySettings,
  companyAppointments: { scheduled_at: string }[]
): AvailableSlot[] {
  const tz = settings.timezone || "America/New_York"
  const horizon = Math.min(settings.booking_horizon_days || 7, 14)
  const enabledDays = (settings.available_days ?? DEFAULT_DAYS).map((d) => d.toLowerCase())
  const enabledWindows = (settings.appointment_windows ?? DEFAULT_WINDOWS).filter((w) => w.enabled)

  if (enabledDays.length === 0 || enabledWindows.length === 0) return []

  const slots: AvailableSlot[] = []
  const now = new Date()

  for (let d = 1; d <= horizon && slots.length < 6; d++) {
    const date = new Date(now)
    date.setDate(now.getDate() + d)

    // Day name in company timezone
    const dayName = date
      .toLocaleDateString("en-US", { weekday: "long", timeZone: tz })
      .toLowerCase()

    if (!enabledDays.includes(dayName)) continue

    // Local date string for comparison (YYYY-MM-DD in company tz)
    const localDateStr = date.toLocaleDateString("en-CA", { timeZone: tz })

    // Appointments already booked on this calendar day
    const bookedThisDay = companyAppointments.filter((a) => {
      return new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: tz }) === localDateStr
    })

    if (
      settings.max_appointments_per_day != null &&
      bookedThisDay.length >= settings.max_appointments_per_day
    ) continue

    for (const win of enabledWindows) {
      if (slots.length >= 6) break

      const [startH, startM] = win.start.split(":").map(Number)
      const [endH, endM] = win.end.split(":").map(Number)

      // Build Date objects representing the window start/end in local wall-clock time.
      // We use the date's year/month/day and set hours directly — this works correctly
      // for scheduling purposes because Twilio/HVAC techs work in local time.
      const slotDate = new Date(
        date.toLocaleDateString("en-CA", { timeZone: tz }) + "T00:00:00"
      )
      const slotStart = new Date(slotDate)
      slotStart.setHours(startH, startM, 0, 0)
      const slotEnd = new Date(slotDate)
      slotEnd.setHours(endH, endM, 0, 0)

      // Skip if a booked appointment falls inside this window
      const taken = bookedThisDay.some((a) => {
        const t = new Date(a.scheduled_at)
        return t >= slotStart && t < slotEnd
      })
      if (taken) continue

      const dateLabel = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: tz,
      })

      slots.push({
        label: `${dateLabel} — ${win.label} (${fmt12(win.start)}–${fmt12(win.end)})`,
        isoStart: slotStart.toISOString(),
        isoEnd: slotEnd.toISOString(),
      })
    }
  }

  return slots
}

/**
 * Formats available slots into the block that gets injected into the AI system prompt.
 */
export function formatSlotsForPrompt(slots: AvailableSlot[]): string {
  if (slots.length === 0) {
    return `=== AVAILABLE BOOKING SLOTS ===
No open slots in the next booking window. Tell the lead you'll check with the team and
follow up. Use update_lead_status("needs_attention") so a human can call back.
=== END AVAILABLE SLOTS ===`
  }

  const lines = slots.map((s, i) => `  ${i + 1}. ${s.label}`).join("\n")

  return `=== AVAILABLE BOOKING SLOTS ===
Offer ONLY slots from this list. Never invent times or say "whenever works for you."
When the lead confirms a slot, use that slot's start time in book_appointment.

${lines}

HOW TO OFFER: Pick the 2 soonest slots and offer them as a choice:
"I've got [slot 1 short label] or [slot 2 short label] — which works better for you?"
Example: "I've got Thursday morning (8–10am) or Friday afternoon (1–3pm) — which works better?"

When they pick one → call book_appointment with the exact ISO datetime shown above.
=== END AVAILABLE SLOTS ===`
}
