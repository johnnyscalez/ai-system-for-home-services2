/**
 * Follow-up sequence definitions and schedule builders.
 *
 * NO-REPLY sequence (lead never responded):
 *   Step 1 — 30 min    — Voice call  (while warm)
 *   Step 2 — 24h       — SMS         (gentle next-day touch)
 *   Step 3 — Day 2, 9am — SMS        (fresh morning, different angle)
 *   Step 4 — Day 2, 12pm — Voice     (lunchtime call attempt)
 *   Step 5 — Day 4, 9am — SMS        (value / urgency angle)
 *   Step 6 — Day 7, 9am — SMS        (closing the loop)
 *   Step 7 — Day 14, 9am — SMS       (long game / seasonal)
 *
 * REPLIED-NOT-BOOKED sequence (lead replied but didn't book):
 *   Step 1 — 4h  — SMS
 *   Step 2 — 48h — Voice call
 *   Step 3 — 5d  — SMS  (final)
 *
 * All "dayOffset + localHour" steps are scheduled in the company's timezone
 * so they fire at the right wall-clock time regardless of UTC.
 */

export type StepType = "sms" | "voice"

export type SequenceStep = {
  step: number
  type: StepType
  scheduledAt: Date
}

// Voice steps: no_reply steps 1 and 4 / replied_not_booked step 2
export function isVoiceStep(sequenceType: string, step: number): boolean {
  if (sequenceType === "no_reply" && (step === 1 || step === 4)) return true
  if (sequenceType === "replied_not_booked" && step === 2) return true
  return false
}

// Last step for each sequence — used to detect sequence exhaustion
export const LAST_STEP: Record<string, number> = {
  no_reply: 7,
  replied_not_booked: 3,
}

// Per-step AI follow-up instructions (injected into the AI prompt)
export const FOLLOW_UP_ANGLE: Record<string, string> = {
  "no_reply:2":             "It's been about 24 hours — one more gentle touch. Different angle from your opener. Short.",
  "no_reply:3":             "Day 2 morning. Fresh start — brief, different angle from anything you've already sent.",
  "no_reply:5":             "Day 4. Offer value or light urgency. Not chasing — genuinely offering something useful.",
  "no_reply:6":             "Day 7. Last active attempt. Close the loop politely, make it easy for them to reply.",
  "no_reply:7":             "Day 14. Long game — seasonal or situational angle. Zero pressure, just staying relevant.",
  "replied_not_booked:1":   "They replied but haven't booked yet. Casual 4-hour check-in — keep it short and human.",
  "replied_not_booked:3":   "Final follow-up. They replied but never booked. Low-pressure, no guilt — just closing the loop.",
}

/**
 * Converts a local time (dayOffset days from baseDate, at localHour:00)
 * to the correct UTC Date using the company's timezone.
 */
function localDayTime(
  baseDate: Date,
  daysOffset: number,
  localHour: number,
  timezone: string
): Date {
  // Compute the target calendar date in the company timezone
  const target = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000)
  const dateStr = target.toLocaleDateString("en-CA", { timeZone: timezone }) // "YYYY-MM-DD"

  // Find the UTC offset on this date by checking what local hour noon UTC maps to
  const noonRef = new Date(dateStr + "T12:00:00.000Z")
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  })
  const localHourAtNoon = parseInt(
    fmt.formatToParts(noonRef).find((p) => p.type === "hour")!.value
  )

  // utcHour = localHour - (localNoonHour - 12)
  let utcHour = localHour - localHourAtNoon + 12
  let adjustedDate = dateStr

  if (utcHour < 0) {
    utcHour += 24
    const d = new Date(dateStr + "T00:00:00Z")
    d.setUTCDate(d.getUTCDate() - 1)
    adjustedDate = d.toISOString().slice(0, 10)
  } else if (utcHour >= 24) {
    utcHour -= 24
    const d = new Date(dateStr + "T00:00:00Z")
    d.setUTCDate(d.getUTCDate() + 1)
    adjustedDate = d.toISOString().slice(0, 10)
  }

  return new Date(`${adjustedDate}T${String(utcHour).padStart(2, "0")}:00:00.000Z`)
}

/**
 * Builds all 7 no_reply follow-up steps, pre-computed relative to when the
 * lead arrived (leadCreatedAt). All steps are inserted at lead-creation time
 * so the cron just fires them — no next-step scheduling needed.
 */
export function buildNoReplySchedule(leadCreatedAt: Date, timezone: string): SequenceStep[] {
  return [
    // Step 1: 30 min — Voice call
    {
      step: 1,
      type: "voice",
      scheduledAt: new Date(leadCreatedAt.getTime() + 30 * 60 * 1000),
    },
    // Step 2: 24h — SMS
    {
      step: 2,
      type: "sms",
      scheduledAt: new Date(leadCreatedAt.getTime() + 24 * 60 * 60 * 1000),
    },
    // Step 3: Day 2 @ 9am local — SMS
    {
      step: 3,
      type: "sms",
      scheduledAt: localDayTime(leadCreatedAt, 2, 9, timezone),
    },
    // Step 4: Day 2 @ 12pm local — Voice call
    {
      step: 4,
      type: "voice",
      scheduledAt: localDayTime(leadCreatedAt, 2, 12, timezone),
    },
    // Step 5: Day 4 @ 9am local — SMS
    {
      step: 5,
      type: "sms",
      scheduledAt: localDayTime(leadCreatedAt, 4, 9, timezone),
    },
    // Step 6: Day 7 @ 9am local — SMS
    {
      step: 6,
      type: "sms",
      scheduledAt: localDayTime(leadCreatedAt, 7, 9, timezone),
    },
    // Step 7: Day 14 @ 9am local — SMS
    {
      step: 7,
      type: "sms",
      scheduledAt: localDayTime(leadCreatedAt, 14, 9, timezone),
    },
  ]
}

/**
 * Builds all 3 replied-not-booked steps. Timer starts from lastReplyAt
 * and resets on every new reply so the 4h window is always from the
 * lead's most recent message.
 */
export function buildRepliedNotBookedSchedule(lastReplyAt: Date): SequenceStep[] {
  return [
    // Step 1: 4h — SMS
    {
      step: 1,
      type: "sms",
      scheduledAt: new Date(lastReplyAt.getTime() + 4 * 60 * 60 * 1000),
    },
    // Step 2: 48h — Voice call
    {
      step: 2,
      type: "voice",
      scheduledAt: new Date(lastReplyAt.getTime() + 48 * 60 * 60 * 1000),
    },
    // Step 3: 5d — SMS (final)
    {
      step: 3,
      type: "sms",
      scheduledAt: new Date(lastReplyAt.getTime() + 5 * 24 * 60 * 60 * 1000),
    },
  ]
}
