/** Qualification rules vs. the answer shapes a real Instant Form returns. */
import { qualifyFromFormFields } from "../lib/fieldbuilt-qualify"

const cases: Array<[string, Record<string, string>, boolean]> = [
  ["10+ techs, 10M+ (tier A)", { how_many_techs_do_you_have: "10+", what_is_your_annual_revenue: "10M+" }, true],
  ["3-4 techs, 1-2M", { techs: "3-4", revenue: "1-2M" }, true],
  ["5-9 techs, 2-5M", { how_many_technicians: "5 - 9", annual_sales: "$2-5M" }, true],
  ["1-2 techs (too small)", { techs: "1-2", revenue: "10M+" }, false],
  ["10+ techs but only 1-2M", { techs: "10+", revenue: "1-2M" }, false],
  ["3-4 techs, under 1M", { techs: "3-4", revenue: "<1M" }, false],
  ["verbose option text", { how_many_techs_do_you_have: "3 to 4 technicians", what_do_you_make_a_year: "1 - 2 million" }, true],
  ["bare number answer", { how_many_guys_on_the_crew: "12", annual_revenue: "5-10M" }, true],
  ["form never asked → work it anyway", { full_name: "Bob", phone_number: "+13125550123" }, true],
  ["only techs asked, too small", { how_many_techs: "1-2" }, false],
  // The live GHL workflow sends headcount with no revenue field — a missing
  // answer must never be read as a failing one.
  ["techs only 10+ (no revenue field)", { numberoftechs: "10+" }, true],
  ["techs only 5-9 (no revenue field)", { numberoftechs: "5-9" }, true],
  ["techs only 3-4 (no revenue field)", { numberoftechs: "3-4" }, true],
  ["revenue only, no techs", { annual_revenue: "5-10M" }, true],
]

let pass = true
for (const [name, fields, want] of cases) {
  const q = qualifyFromFormFields(fields)
  const ok = q.qualified === want
  if (!ok) pass = false
  console.log(`${ok ? "✅" : "❌"} ${name}`)
  console.log(`     techs=${q.techs} revenue=${q.revenue} tier=${q.tier} qualified=${q.qualified}${q.undetermined ? " (not asked)" : ""}`)
}
console.log(pass ? "\n✅ ALL QUALIFICATION CASES CORRECT" : "\n❌ FAILURES ABOVE")
process.exit(pass ? 0 : 1)
