import { config } from 'dotenv'
config({ path: '.env.local' })
const { findSlotsForLead } = await import('./lib/technician-booking')
const CO = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'

const summarize = (r: any) => {
  if (!r.found) return `DECLINED reason=${r.reason}`
  const techs = [...new Set(r.slots.map((s: any) => s.techName))].join(',')
  return `FOUND n=${r.slots.length} techs=[${techs}] first="${r.slots[0].label}" iso=${r.slots[0].isoStart}`
}

// Part A: job-type vocabulary matrix @ IL zip 60540
const jobs = ['duct_cleaning','ductwork','duct cleaning','Duct_Cleaning','DUCT_CLEANING','ac_installation','new_ac_install','ac_repair','hvac_tune_up','hvac_maintenance','hvac_replacement','full_hvac_upgrade','heat_pump_repair','mini_split','thermostat','air_quality','other','general',null]
for (const j of jobs) {
  const r = await findSlotsForLead(CO, j as any, '60540')
  console.log(`JOB ${JSON.stringify(j)} @60540 -> ${summarize(r)}`)
}

// Part B: zip matrix @ duct_cleaning
const zips = ['48188','48066','46320','60197','90210',null,'6054','60540-1234','48188-1234']
for (const z of zips) {
  const r = await findSlotsForLead(CO, 'duct_cleaning', z as any)
  console.log(`ZIP ${JSON.stringify(z)} duct_cleaning -> ${summarize(r)}`)
}

// Part C: crosses
for (const [j, z] of [['ductwork','48188'],['ac_repair','48188'],['ac_installation','48066'],['heat_pump_repair',null],['general',null],[null,null],['general','48066']] as any[]) {
  const r = await findSlotsForLead(CO, j, z)
  console.log(`CROSS job=${JSON.stringify(j)} zip=${JSON.stringify(z)} -> ${summarize(r)}`)
}
