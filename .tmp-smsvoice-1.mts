import { config } from 'dotenv'
config({ path: '.env.local' })

const CID = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'

const { findSlotsForLead } = await import('./lib/technician-booking')
const { buildNoReplySchedule, buildRepliedNotBookedSchedule } = await import('./lib/sequences')

// ── 1. Slot routing matrix ────────────────────────────────────────────────
const cases: Array<[string, string | null, string]> = [
  ['ductwork@Chicago',        'ductwork',       '60614'],
  ['duct_cleaning@Chicago',   'duct_cleaning',  '60614'],   // engine-style enum
  ['ac_repair@Chicago',       'ac_repair',      '60614'],
  ['ac_installation@Chicago', 'ac_installation','60614'],   // engine-style enum, tech has new_ac_install
  ['ductwork@Detroit',        'ductwork',       '48237'],
  ['duct_cleaning@Detroit',   'duct_cleaning',  '48237'],
  ['ac_repair@Detroit',       'ac_repair',      '48237'],   // David is IL-only — expect no_zip_match
  ['thermostat@Chicago',      'thermostat',     '60614'],   // expect job_not_offered
  ['heat_pump_install@Chi',   'heat_pump_install','60614'], // expect job_not_offered
  ['mini_split@Chicago',      'mini_split',     '60614'],
  ['air_quality@Chicago',     'air_quality',    '60614'],
  ['other@Chicago',           'other',          '60614'],
  ['ductwork@out-of-area',    'ductwork',       '90210'],   // expect no_zip_match
  ['nulljob@Chicago',         null,             '60614'],
]

for (const [label, jt, zip] of cases) {
  const r = await findSlotsForLead(CID, jt, zip)
  if (r.found) {
    const techs = [...new Set(r.slots.map(s => s.techName))]
    console.log(`${label.padEnd(26)} FOUND  slots=${r.slots.length} techs=${techs.join(', ')} first=${r.slots[0].label}`)
  } else {
    console.log(`${label.padEnd(26)} NOT_FOUND reason=${r.reason}`)
  }
}

// ── 2. Schedule math in America/Chicago ───────────────────────────────────
const tz = 'America/Chicago'
const fmt = (d: Date) => d.toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

for (const createdLocal of ['2026-07-30T02:30:00-05:00', '2026-07-30T14:00:00-05:00', '2026-07-30T23:30:00-05:00']) {
  const base = new Date(createdLocal)
  console.log(`\nno_reply schedule, lead created ${fmt(base)} CT:`)
  for (const s of buildNoReplySchedule(base, tz)) {
    console.log(`  step ${s.step} (${s.type})  ${fmt(s.scheduledAt)} CT`)
  }
  console.log(`replied_not_booked schedule, last reply ${fmt(base)} CT:`)
  for (const s of buildRepliedNotBookedSchedule(base, tz)) {
    console.log(`  step ${s.step} (${s.type})  ${fmt(s.scheduledAt)} CT`)
  }
}
