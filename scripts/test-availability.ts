/**
 * Verify slot generation sees HCP-booked jobs (dev tool, read-only against HCP).
 * Usage: npx tsx --env-file=.env.local scripts/test-availability.ts
 */
import { getHcpBusyIntervals } from "../lib/housecall-sync"
import { findSlotsForLead } from "../lib/technician-booking"

const COMPANY = "436e5f50-ad1b-42b5-a050-a702cc374618"

async function main() {
  const now = new Date()
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const busy = await getHcpBusyIntervals(COMPANY, now.toISOString(), week.toISOString())
  console.log(`HCP busy intervals for mapped techs: ${busy.length}`)
  for (const b of busy) {
    console.log(`  tech ${b.technicianId.slice(0, 8)}… busy ${new Date(b.startMs).toISOString()} → ${new Date(b.endMs).toISOString()}`)
  }
  const slots = await findSlotsForLead(COMPANY, "ac_repair", null)
  console.log("\nSlot generation:", slots.found ? `${slots.slots.length} slots` : `none (${slots.reason})`)
  if (slots.found) for (const s of slots.slots.slice(0, 6)) console.log(`  ${s.label} → ${s.techName} (${s.isoStart})`)
}

main().catch(e => { console.error("FAILED:", String(e).slice(0, 400)); process.exit(1) })
