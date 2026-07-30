import { config } from 'dotenv'
config({ path: '.env.local' })
const { selectTechnician } = await import('./lib/technician-booking')
const CO = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'
const FAKE_APT = '00000000-0000-0000-0000-000000000000'
// Monday 2026-08-03 23:00 CT = Tuesday 2026-08-04T04:00Z — night time, no window
const r = await selectTechnician(CO, FAKE_APT, '2026-08-04T04:00:00.000Z', 'ductwork', '48188')
console.log('Mon 11pm CT ductwork@48188 ->', r.found ? `ASSIGNED ${r.technician.name}` : `reason=${r.reason}`)
// 3am CT mid-week
const r2 = await selectTechnician(CO, FAKE_APT, '2026-08-05T08:00:00.000Z', 'ductwork', '48188')
console.log('Wed 3am CT ductwork@48188 ->', r2.found ? `ASSIGNED ${r2.technician.name}` : `reason=${r2.reason}`)
