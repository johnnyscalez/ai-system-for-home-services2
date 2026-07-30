import { config } from 'dotenv'
config({ path: '.env.local' })
const { findSlotsForLead } = await import('./lib/technician-booking')
const r = await findSlotsForLead('bc9fb131-2af2-4c31-8d79-f46bb9663e60', 'duct_cleaning', '60540')
console.log(JSON.stringify(r, null, 2).slice(0, 2000))
