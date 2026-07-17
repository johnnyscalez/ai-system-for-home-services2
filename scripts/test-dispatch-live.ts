/**
 * Live dispatch comparison: near customer vs far customer, real company data,
 * real HCP jobs. Usage: npx tsx --env-file=.env.local scripts/test-dispatch-live.ts
 */
import { findSlotsForLead } from "../lib/technician-booking"
import { zipToPoint, estimateDriveMin } from "../lib/routing"

const COMPANY = "436e5f50-ad1b-42b5-a050-a702cc374618"
const OFFICE_ZIP = "60901"   // Kankakee — the office
const NEAR_ZIP = "60915"     // Bradley — next town over
const FAR_ZIP = "60601"      // Chicago Loop — ~55 miles

async function main() {
  const office = zipToPoint(OFFICE_ZIP)!
  console.log(`drive office→near customer (${NEAR_ZIP}): ${estimateDriveMin(office, zipToPoint(NEAR_ZIP)!).toFixed(0)} min`)
  console.log(`drive office→far customer (${FAR_ZIP}):  ${estimateDriveMin(office, zipToPoint(FAR_ZIP)!).toFixed(0)} min\n`)

  const near = await findSlotsForLead(COMPANY, "ac_repair", NEAR_ZIP)
  const far  = await findSlotsForLead(COMPANY, "ac_repair", FAR_ZIP)

  console.log(`NEAR customer — ${near.found ? near.slots.length : 0} slots offered:`)
  if (near.found) for (const s of near.slots) console.log(`  ${s.label} → ${s.techName}`)

  console.log(`\nFAR customer — ${far.found ? far.slots.length : 0} slots offered:`)
  if (far.found) for (const s of far.slots) console.log(`  ${s.label} → ${s.techName}`)

  if (near.found && far.found) {
    const nearSet = new Set(near.slots.map(s => s.label))
    const hidden = [...nearSet].filter(l => !far.slots.some(s => s.label === l))
    console.log(`\nSlots offered to the NEAR customer but HIDDEN from the FAR customer:`)
    hidden.length ? hidden.forEach(l => console.log(`  ✗ ${l}`)) : console.log("  (none)")
  }
}

main().catch(e => { console.error("FAILED:", String(e).slice(0, 300)); process.exit(1) })
