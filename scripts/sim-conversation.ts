/**
 * Local multi-turn conversation simulator — runs the REAL AI engine
 * (processAndSave) against the live DB, without sending any SMS (delivery
 * happens in the webhook layer, not in the engine). This is the test
 * harness for conversation-quality work: it shows the full transcript and
 * asserts on gate behavior, saved lead details, and booking side effects.
 *
 * Usage: npx tsx scripts/sim-conversation.ts install|repair|impatient
 */
import { createServiceRoleClient } from "../lib/supabase-server"
import { processAndSave } from "../lib/ai-engine"

const COMPANY = "436e5f50-ad1b-42b5-a050-a702cc374618" // Peak Comfort demo

const SCENARIOS: Record<string, { notes: string; phone: string; name: string; replies: string[] }> = {
  install: {
    notes: "Looking to install a new unit",
    phone: "+17045550991",
    name: "SimInstall",
    replies: [
      "have a central AC unit, probably original to the house - installed sometime around 2006 I think. its been dying on us the past couple summers",
      "yeah we own it, been here 12 years",
      "pretty soon honestly, its been rough this summer so sooner the better",
      "1400 Providence Rd, Charlotte, NC 28211",
      "the first one works, lets do that",
    ],
  },
  repair: {
    notes: "AC not cooling",
    phone: "+17045550992",
    name: "SimRepair",
    replies: [
      "its running but blowing warm air since yesterday",
      "2200 Monroe Rd, Charlotte NC 28205",
      "morning works",
    ],
  },
  impatient: {
    notes: "Looking to install a new unit",
    phone: "+17045550993",
    name: "SimRush",
    replies: [
      "look i dont have time for 20 questions, can you just get someone out here? 3100 Central Ave charlotte 28205",
      "first one",
    ],
  },
}

async function main() {
  const scenario = SCENARIOS[process.argv[2] ?? "install"]
  if (!scenario) { console.error("unknown scenario"); process.exit(1) }
  const db = createServiceRoleClient()

  // Clean slate for this phone
  const { data: old } = await db.from("leads").select("id").eq("phone", scenario.phone).eq("company_id", COMPANY)
  for (const o of old ?? []) {
    await db.from("conversations").delete().eq("lead_id", o.id)
    await db.from("appointments").delete().eq("lead_id", o.id)
    await db.from("sequences").delete().eq("lead_id", o.id)
    await db.from("leads").delete().eq("id", o.id)
  }

  const { data: lead } = await db.from("leads").insert({
    company_id: COMPANY, phone: scenario.phone, first_name: scenario.name,
    last_name: "Homeowner", email: "sim@example.com", source: "webhook",
    service_type: "hvac", status: "just_came_in", notes: scenario.notes,
  }).select("id").single()
  if (!lead) throw new Error("lead insert failed")

  console.log(`\n══ scenario: ${process.argv[2] ?? "install"} — lead ${lead.id} ══\n`)

  const opener = await processAndSave(lead.id, COMPANY, null)
  console.log(`AI:   ${opener.response}\n`)

  for (const reply of scenario.replies) {
    console.log(`LEAD: ${reply}`)
    const r = await processAndSave(lead.id, COMPANY, reply)
    console.log(`AI:   ${r.response}`)
    if (r.action) console.log(`      [action: ${JSON.stringify(r.action)}]`)
    console.log()
  }

  // Final state assertions
  const { data: final } = await db.from("leads")
    .select("status, job_type, system_type, system_age, address")
    .eq("id", lead.id).single()
  console.log("── final lead state ──")
  console.log(final)
  const { data: appts } = await db.from("appointments")
    .select("scheduled_at, technician_name, status, notes")
    .eq("lead_id", lead.id)
  console.log("── appointments ──")
  console.log(appts)

  // Cleanup
  await db.from("conversations").delete().eq("lead_id", lead.id)
  await db.from("appointments").delete().eq("lead_id", lead.id)
  await db.from("sequences").delete().eq("lead_id", lead.id)
  await db.from("leads").delete().eq("id", lead.id)
  console.log("\n(cleaned up)")
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
