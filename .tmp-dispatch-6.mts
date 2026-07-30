import { config } from 'dotenv'
config({ path: '.env.local' })
const { findSlotsForLead } = await import('./lib/technician-booking')
const CO = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'
for (const z of ['Chicago', 'Naperville IL', '60540 ']) {
  const r = await findSlotsForLead(CO, 'duct_cleaning', z)
  console.log(`zip_code=${JSON.stringify(z)} ->`, r.found ? `FOUND ${r.slots.length}` : `DECLINED ${r.reason}`)
}
