export type AppointmentWindow = {
  id: string
  label: string
  start: string  // "08:00" 24h
  end: string    // "10:00" 24h
  enabled: boolean
}

export type DaySlot = { start: string; end: string }
export type DayConfig = { enabled: boolean; slots: DaySlot[] }
export type PerDaySlots = Record<string, DayConfig>

export type AvailabilitySettings = {
  available_days: string[]
  appointment_windows: AppointmentWindow[]
  booking_horizon_days: number
  max_appointments_per_day: number | null
  timezone: string
  per_day_slots?: PerDaySlots | null
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
 * Converts a wall-clock local time (e.g. "1pm on May 5 in America/New_York")
 * into the correct UTC Date. Without this, setHours() runs in server local time
 * (UTC on Railway) so an "Afternoon 1pm" slot for an EST contractor gets stored
 * as 1pm UTC = 9am EST instead of 1pm EST = 5pm UTC.
 */
function localWallClockToUtc(localDateStr: string, hours: number, minutes: number, tz: string): Date {
  // Treat the target wall-clock time as if it were UTC to get a starting point
  const pseudo = new Date(
    `${localDateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`
  )
  // Ask Intl what that UTC instant looks like in the target timezone
  const asLocal = new Date(pseudo.toLocaleString("en-US", { timeZone: tz }))
  // The gap is the UTC offset for that timezone at that date (handles DST correctly)
  return new Date(pseudo.getTime() + (pseudo.getTime() - asLocal.getTime()))
}

/**
 * Returns the next N available booking slots for a company, excluding:
 * - Slots already taken by system appointments
 * - Slots that overlap with any Google Calendar busy event
 * Slots are capped at 6 so the AI prompt stays concise.
 */
export function getAvailableSlots(
  settings: AvailabilitySettings,
  companyAppointments: { scheduled_at: string }[],
  googleBusyTimes: { start: string; end: string }[] = []
): AvailableSlot[] {
  const tz = settings.timezone || "America/New_York"
  const horizon = Math.min(settings.booking_horizon_days || 7, 14)
  const slots: AvailableSlot[] = []
  const now = new Date()

  // Per-day mode (new): each day has its own custom time slots
  if (settings.per_day_slots && Object.keys(settings.per_day_slots).length > 0) {
    for (let d = 1; d <= horizon && slots.length < 6; d++) {
      const date = new Date(now)
      date.setDate(now.getDate() + d)

      const dayName = date
        .toLocaleDateString("en-US", { weekday: "long", timeZone: tz })
        .toLowerCase()

      const dayConfig = settings.per_day_slots[dayName]
      if (!dayConfig?.enabled || !dayConfig.slots?.length) continue

      const localDateStr = date.toLocaleDateString("en-CA", { timeZone: tz })
      const bookedThisDay = companyAppointments.filter((a) =>
        new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: tz }) === localDateStr
      )

      for (const slot of dayConfig.slots) {
        if (slots.length >= 6) break

        const [startH, startM] = slot.start.split(":").map(Number)
        const [endH, endM] = slot.end.split(":").map(Number)

        const slotStart = localWallClockToUtc(localDateStr, startH, startM, tz)
        const slotEnd   = localWallClockToUtc(localDateStr, endH, endM, tz)

        const taken = bookedThisDay.some((a) => {
          const t = new Date(a.scheduled_at)
          return t >= slotStart && t < slotEnd
        })
        if (taken) continue

        const gcalBlocked = googleBusyTimes.some((busy) => {
          const busyStart = new Date(busy.start)
          const busyEnd = new Date(busy.end)
          return busyStart < slotEnd && busyEnd > slotStart
        })
        if (gcalBlocked) continue

        const dateLabel = date.toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", timeZone: tz,
        })

        slots.push({
          label: `${dateLabel} (${fmt12(slot.start)}–${fmt12(slot.end)})`,
          isoStart: slotStart.toISOString(),
          isoEnd: slotEnd.toISOString(),
        })
      }
    }
    return slots
  }

  // Legacy mode: all-days + shared time windows
  const enabledDays = (settings.available_days ?? DEFAULT_DAYS).map((d) => d.toLowerCase())
  const enabledWindows = (settings.appointment_windows ?? DEFAULT_WINDOWS).filter((w) => w.enabled)

  if (enabledDays.length === 0 || enabledWindows.length === 0) return []

  for (let d = 1; d <= horizon && slots.length < 6; d++) {
    const date = new Date(now)
    date.setDate(now.getDate() + d)

    const dayName = date
      .toLocaleDateString("en-US", { weekday: "long", timeZone: tz })
      .toLowerCase()

    if (!enabledDays.includes(dayName)) continue

    const localDateStr = date.toLocaleDateString("en-CA", { timeZone: tz })
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

      const slotStart = localWallClockToUtc(localDateStr, startH, startM, tz)
      const slotEnd   = localWallClockToUtc(localDateStr, endH, endM, tz)

      const taken = bookedThisDay.some((a) => {
        const t = new Date(a.scheduled_at)
        return t >= slotStart && t < slotEnd
      })
      if (taken) continue

      const gcalBlocked = googleBusyTimes.some((busy) => {
        const busyStart = new Date(busy.start)
        const busyEnd   = new Date(busy.end)
        return busyStart < slotEnd && busyEnd > slotStart
      })
      if (gcalBlocked) continue

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

  const lines = slots.map((s, i) => `  ${i + 1}. ${s.label}  [ISO: ${s.isoStart}]`).join("\n")

  return `=== AVAILABLE BOOKING SLOTS ===
Offer ONLY slots from this list. Never invent times or say "whenever works for you."

${lines}

HOW TO OFFER: Pick the 2 soonest slots and offer them as a choice:
"I've got [slot 1 short label] or [slot 2 short label] — which works better for you?"
Example: "I've got Thursday morning (8–10am) or Friday afternoon (1–3pm) — which works better?"

CRITICAL — TIMEZONE RULE: When the lead confirms a slot, copy the EXACT ISO string shown in [ISO: ...] for that slot into book_appointment.scheduled_at. Do NOT convert the time yourself — the ISO is already in the correct UTC timezone. Never write your own ISO timestamp from "8am" or any local time.
=== END AVAILABLE SLOTS ===`
}
