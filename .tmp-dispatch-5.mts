import { config } from 'dotenv'
config({ path: '.env.local' })

// Verbatim copy of localSlotToUtcIso from lib/technician-booking.ts:24-49 (not exported)
function localSlotToUtcIso(dateStr: string, timeStr: string, tz: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(naiveUtc)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00"
  const localMs = Date.UTC(parseInt(get("year")), parseInt(get("month")) - 1, parseInt(get("day")),
    parseInt(get("hour")) % 24, parseInt(get("minute")), parseInt(get("second")))
  const offsetMs = naiveUtc.getTime() - localMs
  return new Date(naiveUtc.getTime() + offsetMs).toISOString()
}

const TZ = 'America/Chicago'
const back = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: TZ, hour12: false })
const cases: [string, string, string][] = [
  ['2026-07-31', '08:00', 'CDT normal -> expect 13:00Z'],
  ['2026-01-15', '08:00', 'CST normal -> expect 14:00Z'],
  ['2026-03-08', '08:00', 'DST spring-forward day, after jump'],
  ['2026-03-08', '01:30', 'before spring jump (CST)'],
  ['2026-03-08', '02:30', 'NONEXISTENT local time (2-3am skipped)'],
  ['2026-11-01', '01:30', 'AMBIGUOUS local time (fall back)'],
  ['2026-11-01', '08:00', 'fall-back day, after transition'],
  ['2026-07-31', '00:00', 'local midnight'],
  ['2026-07-31', '23:00', 'near midnight local -> next UTC day'],
]
for (const [d, t, note] of cases) {
  const iso = localSlotToUtcIso(d, t, TZ)
  console.log(`${d} ${t} (${note})  => ${iso}  | round-trip local: ${back(iso)}`)
}

// ── Fake-clock probe: evening in Chicago (after midnight UTC) ────────────────
// Freeze "now" at Thursday 2026-07-30 20:00 CT = Friday 2026-07-31T01:00Z.
// Server tz = UTC (Railway). findSlotsForLead derives dayName from day.getDay()
// (server tz = UTC = Friday) while dateStr renders in America/Chicago (Thursday).
const FIXED = Date.UTC(2026, 6, 31, 1, 0, 0) // 2026-07-31T01:00:00Z
const RealDate = Date
class FakeDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(FIXED)
    else super(...(args as [any]))
  }
  static now() { return FIXED }
}
;(globalThis as any).Date = FakeDate

const { findSlotsForLead } = await import('./lib/technician-booking')
const r = await findSlotsForLead('bc9fb131-2af2-4c31-8d79-f46bb9663e60', 'duct_cleaning', '60540')
;(globalThis as any).Date = RealDate
if (r.found) {
  console.log('\nFAKE NOW = Thu 2026-07-30 20:00 CT (Fri 01:00Z), TZ=UTC server. Slots returned:')
  for (const s of r.slots) console.log(` ${s.label} | ${s.isoStart} | local start: ${back(s.isoStart)} | ${s.techName}`)
} else {
  console.log('\nFAKE NOW probe: DECLINED', (r as any).reason)
}
