import { config } from 'dotenv'
config({ path: '.env.local' })
const { selectTechnician } = await import('./lib/technician-booking')
const CO = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'
const FAKE_APT = '00000000-0000-0000-0000-000000000000' // does not exist; UPDATE matches 0 rows

const cases: Array<[string, string | null, string, string | null]> = [
  // label, jobType, scheduledAt (UTC ISO), zip
  ['A: heat_pump_repair @60540 Mon 9am CT (job nobody offers)', 'heat_pump_repair', '2026-08-03T14:00:00.000Z', '60540'],
  ['B: duct_cleaning @90210 Mon 9am CT (zip nobody covers)',    'duct_cleaning',    '2026-08-03T14:00:00.000Z', '90210'],
  ['C: ductwork @48188 Mon 2pm CT (=19:00 UTC, schedule-hour check under UTC)', 'ductwork', '2026-08-03T19:00:00.000Z', '48188'],
  ['D: ductwork @48188 Sat 10am CT (saturday disabled)',        'ductwork',         '2026-08-08T15:00:00.000Z', '48188'],
  ['E: ductwork @48188 Mon 9am CT (Alex busy 9-12 + 11-2 in HCP)', 'ductwork',      '2026-08-03T14:00:00.000Z', '48188'],
  ['F: mini_split @48066 (job not offered AND zip not covered)', 'mini_split',      '2026-08-03T14:00:00.000Z', '48066'],
]

for (const [label, job, at, zip] of cases) {
  const r = await selectTechnician(CO, FAKE_APT, at, job, zip)
  if (r.found) console.log(`${label}\n  -> ASSIGNED ${r.technician.name} (${r.technician.id}) status=${r.technician.status} job_types=${JSON.stringify(r.technician.job_types)}`)
  else console.log(`${label}\n  -> NOT ASSIGNED reason=${r.reason}`)
}
