/**
 * US holidays the business is closed: no measure or visit is ever offered or
 * booked on these days, and the CRM calendars mark them.
 *
 *   New Year's Day     January 1
 *   Memorial Day       last Monday of May
 *   Independence Day   July 4
 *   Labor Day          first Monday of September
 *   Thanksgiving       fourth Thursday of November
 *   Christmas Day      December 25
 *
 * Dates are local calendar dates ("YYYY-MM-DD"), compared against the date of
 * the visit in the customer's own time zone. Fixed-date holidays are closed on
 * the day itself, not the weekday they are "observed" on.
 *
 * Client-safe: no imports, so the calendar views can use it too.
 */

export type Holiday = { date: string; name: string }

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** The nth weekday (0 = Sunday) of a month; n = -1 is the last one. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
    return iso(year, month, day)
  }
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const lastDay = new Date(Date.UTC(year, month - 1, lastDate)).getUTCDay()
  return iso(year, month, lastDate - ((lastDay - weekday + 7) % 7))
}

const cache = new Map<number, Holiday[]>()

export function usHolidays(year: number): Holiday[] {
  const hit = cache.get(year)
  if (hit) return hit
  const list: Holiday[] = [
    { date: iso(year, 1, 1), name: "New Year's Day" },
    { date: nthWeekday(year, 5, 1, -1), name: "Memorial Day" },
    { date: iso(year, 7, 4), name: "Independence Day" },
    { date: nthWeekday(year, 9, 1, 1), name: "Labor Day" },
    { date: nthWeekday(year, 11, 4, 4), name: "Thanksgiving" },
    { date: iso(year, 12, 25), name: "Christmas Day" },
  ]
  cache.set(year, list)
  return list
}

/** The holiday on a local date ("YYYY-MM-DD"), or null. */
export function holidayOn(dateStr: string): Holiday | null {
  const year = Number(dateStr.slice(0, 4))
  if (!Number.isFinite(year)) return null
  return usHolidays(year).find((h) => h.date === dateStr.slice(0, 10)) ?? null
}

/** The holiday on the day an instant falls in a time zone, or null. */
export function holidayAt(instant: Date | string | number, timeZone: string): Holiday | null {
  const d = new Date(instant)
  if (Number.isNaN(d.getTime())) return null
  return holidayOn(d.toLocaleDateString("en-CA", { timeZone }))
}
