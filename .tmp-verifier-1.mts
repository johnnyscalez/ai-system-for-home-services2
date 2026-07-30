import { config } from 'dotenv'
config({ path: '.env.local' })

const { findSlotsForLead } = await import('./lib/technician-booking')
const { createServiceRoleClient } = await import('./lib/supabase-server')

const COMPANY = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'

// 1. Tech roster check
const db = createServiceRoleClient()
const { data: techs } = await db.from('technicians')
  .select('name, status, job_types, zip_codes, serves_all_areas')
  .eq('company_id', COMPANY).order('name')
for (const t of techs ?? []) {
  console.log(`TECH ${t.name} | ${t.status} | job_types=${JSON.stringify(t.job_types)} | zips=${(t.zip_codes ?? []).length} | all=${t.serves_all_areas}`)
}

// 2. findSlotsForLead probes
const probes = ['air_duct_cleaning', 'duct cleaning', 'air duct cleaning', 'vent_cleaning', 'ductwork_cleaning', 'duct_cleaning', 'ductwork', 'duct_repair', null]
for (const jt of probes) {
  const r = await findSlotsForLead(COMPANY, jt, '60540')
  if (r.found) {
    const names = [...new Set(r.slots.map(s => s.techName))]
    console.log(`PROBE ${JSON.stringify(jt)} -> FOUND ${r.slots.length} slots, techs: ${names.join(', ')}`)
  } else {
    console.log(`PROBE ${JSON.stringify(jt)} -> DECLINED reason=${r.reason}`)
  }
}
