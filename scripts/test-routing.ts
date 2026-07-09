/**
 * Routing logic proof — the founder's exact scenario:
 * tech's last job of the day is NEAR the office; a new lead is FAR away.
 * The badly-sequenced same-day slot must lose to a day-edge slot.
 * Usage: npx tsx scripts/test-routing.ts   (pure code — no DB, no APIs)
 */
import { zipToPoint, estimateDriveMin, insertionCostMin, returnOvertimeMin, ROUTE_SLACK_MIN, type LocatedJob } from "../lib/routing"

const office = zipToPoint("60901")!        // Kankakee, IL — the office
const nearJob = zipToPoint("60914")!       // Bourbonnais — 5 min from office
const farLead = zipToPoint("60601")!       // Chicago Loop — ~55 miles north

console.log(`drive office→far lead: ${estimateDriveMin(office, farLead).toFixed(0)} min`)
console.log(`drive office→near job: ${estimateDriveMin(office, nearJob).toFixed(0)} min\n`)

const h = (n: number) => n * 60 * 60 * 1000
const T0 = 1_800_000_000_000 // fixed epoch base, same "day"

// Tech's existing day: 8 AM job near office, LAST job 3-5 PM near office
const day: LocatedJob[] = [
  { startMs: T0 + h(8),  endMs: T0 + h(10), point: nearJob },
  { startMs: T0 + h(15), endMs: T0 + h(17), point: nearJob },
]

const DAY_END = T0 + h(18) // tech's day ends 6 PM
const NEXT_DAY_END = T0 + h(42)

// Candidate A — the founder's nightmare: far job WEDGED as 5:30 PM same day
// (last job of the day → he still must drive back; counts as overtime)
const costSandwich =
  insertionCostMin(day, office, farLead, T0 + h(17.5), T0 + h(19.5)) +
  returnOvertimeMin(farLead, office, T0 + h(19.5), DAY_END, true)
// Candidate B — same day, but as the FIRST job (6 AM, before the near jobs)
const costDayEdge =
  insertionCostMin(day, office, farLead, T0 + h(6), T0 + h(8)) +
  returnOvertimeMin(farLead, office, T0 + h(8), DAY_END, false)
// Candidate C — empty next day, morning slot (returns by day end — no overtime)
const costEmptyDay =
  insertionCostMin([], office, farLead, T0 + h(32), T0 + h(34)) +
  returnOvertimeMin(farLead, office, T0 + h(34), NEXT_DAY_END, true)

console.log(`A. far job after the near 3-5 PM job (sandwich): +${costSandwich.toFixed(0)} min added drive`)
console.log(`B. far job as day-edge first stop:               +${costDayEdge.toFixed(0)} min added drive`)
console.log(`C. far job on an empty day:                      +${costEmptyDay.toFixed(0)} min added drive`)

const minCost = Math.min(costSandwich, costDayEdge, costEmptyDay)
const offered = (c: number) => (c <= minCost + ROUTE_SLACK_MIN ? "OFFERED" : "SUPPRESSED")
console.log(`\nWith ROUTE_SLACK_MIN=${ROUTE_SLACK_MIN}:`)
console.log(`  A (sandwich):  ${offered(costSandwich)}`)
console.log(`  B (day edge):  ${offered(costDayEdge)}`)
console.log(`  C (empty day): ${offered(costEmptyDay)}`)

// Sanity: a NEAR lead should be offerable everywhere (all costs ~equal)
const nearLead = zipToPoint("60915")! // Bradley, IL — next to office
const nA = insertionCostMin(day, office, nearLead, T0 + h(17.5), T0 + h(19.5))
const nB = insertionCostMin([], office, nearLead, T0 + h(32), T0 + h(34))
console.log(`\nNear lead sanity: same-day +${nA.toFixed(0)} min, empty day +${nB.toFixed(0)} min → both within slack: ${Math.abs(nA - nB) <= ROUTE_SLACK_MIN}`)

if (costSandwich > costDayEdge && offered(costSandwich) === "SUPPRESSED" && offered(costEmptyDay) === "OFFERED") {
  console.log("\n✅ PASS — the founder's scenario is handled: sandwiched far slot hidden, sane slots offered")
} else {
  console.error("\n❌ FAIL — scoring does not suppress the bad slot")
  process.exit(1)
}
