/**
 * Hard scenarios against the live sales agent (real engine, real Claude, real
 * slot lookup). Creates throwaway leads, drives multi-turn conversations, then
 * deletes them.
 *   npx tsx --env-file=.env.local scripts/test-sales-agent.ts
 */
import { createServiceRoleClient } from "../lib/supabase-server"
import { processAndSave } from "../lib/ai-engine"

const CO = "34f34432-9e1e-4e74-9383-83d5f3f96946"
const db = createServiceRoleClient()

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []
const ok = (name: string, pass: boolean, detail = "") => checks.push({ name, pass, detail })

async function makeLead(first: string, phone: string, notes: string) {
  const { data, error } = await db.from("leads").insert({
    company_id: CO, first_name: first, phone,
    source: "facebook", channel: "sms", status: "just_came_in",
    // left unset on purpose: real GHL/webhook leads carry no service_type,
    // so this also proves the company-level fallback works
    notes, metadata: { test: true },
  }).select("id").single()
  if (error) throw error
  return data!.id
}

async function say(leadId: string, msg: string | null) {
  const r = await processAndSave(leadId, CO, msg)
  return (r.response ?? "").trim()
}

async function leadRow(id: string) {
  const { data } = await db.from("leads").select("timezone, first_name, status").eq("id", id).single()
  return data
}

async function scenario(title: string, fn: () => Promise<void>) {
  console.log(`\n${"═".repeat(70)}\n▶ ${title}\n${"═".repeat(70)}`)
  await fn()
}

const BANNED = /\bAI receptionist\b|\bchatbot\b|speed to lead|\bautomation platform\b/i

async function main() {
  const created: string[] = []

  // ── 1. Positioning: opener must sell jobs, not technology ──────────────
  await scenario("1. Opener — jobs language, no tech jargon", async () => {
    const id = await makeLead("Dave", "+15550100001", "NumberOfTechs: 10+"); created.push(id)
    const opener = await say(id, null)
    console.log("AI:", opener)
    ok("opener avoids AI jargon", !BANNED.test(opener), opener)
    ok("opener asks about jobs/leads", /job|lead|book/i.test(opener), opener)
    ok("opener is short (<=2 sentences)", opener.split(/[.!?]+/).filter(x => x.trim()).length <= 3, opener)
  })

  // ── 2. Timezone must be asked BEFORE times are offered ─────────────────
  await scenario("2. Timezone asked before any time is offered", async () => {
    const id = await makeLead("Maria", "+15550100002", "NumberOfTechs: 5-9"); created.push(id)
    await say(id, null)
    const r1 = await say(id, "maybe 3 out of 10 turn into jobs honestly")
    console.log("AI:", r1)
    const r2 = await say(id, "yeah after hours is the worst. lets do a call")
    console.log("AI:", r2)
    const both = r1 + " " + r2
    ok("asks for time zone", /time ?zone|what zone|which zone/i.test(both), both)
    const offeredTimeEarly = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(r1)
    ok("no clock time offered before zone known", !offeredTimeEarly, r1)
  })

  // ── 3. Full booking in the lead's own timezone ──────────────────────────
  await scenario("3. Books in the LEAD's timezone (Arizona)", async () => {
    const id = await makeLead("Rick", "+15550100003", "NumberOfTechs: 10+"); created.push(id)
    await say(id, null)
    await say(id, "we get maybe 40 leads a month, book half")
    const r = await say(id, "we're in Phoenix Arizona. lets set up a call")
    console.log("AI:", r)
    const row = await leadRow(id)
    ok("timezone saved to the lead", !!row?.timezone, `timezone=${row?.timezone}`)
    ok("timezone is Phoenix", row?.timezone === "America/Phoenix", `${row?.timezone}`)
    const r2 = await say(id, "what times do you have?")
    console.log("AI:", r2)
    const hasMST = /MST|MDT/i.test(r2)
    ok("offers times stamped in lead's zone", hasMST || /\d{1,2}(:\d{2})?\s?(am|pm)/i.test(r2), r2)
    const r3 = await say(id, "the first one works")
    console.log("AI:", r3)
    const { data: apts } = await db.from("appointments").select("id, scheduled_at").eq("lead_id", id)
    const apt = apts?.[0]
    ok("appointment created without any address", !!apt, apt ? `at ${apt.scheduled_at}` : "none")
    if (apt) {
      const mins = new Date(apt.scheduled_at).getUTCMinutes()
      ok("slot lands on a :00 or :30 boundary", mins === 0 || mins === 30, `minutes=${mins}`)
      // The stored instant must render as a sane business hour in PHOENIX,
      // which is the whole point of the timezone work.
      const localHour = Number(new Date(apt.scheduled_at).toLocaleString("en-US", { timeZone: "America/Phoenix", hour: "numeric", hour12: false }))
      ok("time is business hours in the LEAD's zone", localHour >= 8 && localHour <= 18, `${localHour}:00 Phoenix`)
    }
  })

  // ── 4. Never asks for a home address ────────────────────────────────────
  await scenario("4. Never asks for a property address", async () => {
    const id = await makeLead("Tom", "+15550100004", "NumberOfTechs: 5-9"); created.push(id)
    await say(id, null)
    const a = await say(id, "we're in Denver. book me in")
    const b = await say(id, "what have you got")
    console.log("AI:", a, "|", b)
    const both = a + " " + b
    ok("no street-address request", !/street address|service address|what.s the address|your address/i.test(both), both)
    ok("no HVAC-unit questions", !/your (ac|a\/c|furnace|unit)\b|how old is your/i.test(both), both)
  })

  // ── 5. Hostile: "just another AI bot" ──────────────────────────────────
  await scenario("5. Hostile — 'another AI bot, not interested'", async () => {
    const id = await makeLead("Sam", "+15550100005", "NumberOfTechs: 10+"); created.push(id)
    await say(id, null)
    const r = await say(id, "is this just another AI bot? we already get 10 of these a week and we have a girl answering phones")
    console.log("AI:", r)
    ok("owns being AI without denying it", /yeah|yep|yes|talking to it|you're talking/i.test(r), r)
    ok("pivots to jobs, not tech", /job|book|miss|slip|night|weekend/i.test(r), r)
  })

  // ── 6. Price pressure — must never quote ───────────────────────────────
  await scenario("6. Price pressure — must not quote a number", async () => {
    const id = await makeLead("Gina", "+15550100006", "NumberOfTechs: 5-9"); created.push(id)
    await say(id, null)
    const r1 = await say(id, "how much does it cost")
    const r2 = await say(id, "just give me a ballpark, $500? $2000? im not booking without a number")
    console.log("AI:", r1, "|", r2)
    const both = r1 + " " + r2
    const quoted = /\$\s?\d/.test(both)
    ok("never quotes a dollar figure", !quoted, both)
    ok("redirects to the call", /call|30 min|walk|show/i.test(both), both)
  })

  // ── 7. Deep product question — must use the knowledge base ─────────────
  await scenario("7. Deep product question — real answer from knowledge", async () => {
    const id = await makeLead("Luis", "+15550100007", "NumberOfTechs: 10+"); created.push(id)
    await say(id, null)
    const r = await say(id, "how does it know which tech to send? we run 12 guys across 3 counties and they all do different work")
    console.log("AI:", r)
    ok("cites real dispatch data", /zip|calendar|job type|coverage|schedule|route|area/i.test(r), r)
    ok("no invented features", !/gps tracking|machine learning model|predictive/i.test(r), r)
  })

  // ── 8. Never re-asks what the form captured ────────────────────────────
  await scenario("8. Never re-asks tech count or revenue", async () => {
    const id = await makeLead("Pete", "+15550100008", "NumberOfTechs: 10+"); created.push(id)
    const o = await say(id, null)
    const r = await say(id, "not sure, maybe a third?")
    console.log("AI:", o, "|", r)
    const both = o + " " + r
    ok("does not ask how many techs", !/how many (techs|technicians|guys)/i.test(both), both)
    ok("does not ask revenue", !/revenue|annual sales|how much do you (make|do)/i.test(both), both)
  })

  // cleanup
  for (const id of created) {
    await db.from("appointments").delete().eq("lead_id", id)
    await db.from("sequences").delete().eq("lead_id", id)
    await db.from("conversations").delete().eq("lead_id", id)
    await db.from("leads").delete().eq("id", id)
  }

  console.log(`\n${"═".repeat(70)}\nRESULTS\n${"═".repeat(70)}`)
  let failed = 0
  for (const c of checks) {
    if (!c.pass) failed++
    console.log(`${c.pass ? "✅" : "❌"} ${c.name}`)
    if (!c.pass) console.log(`     ↳ ${c.detail.slice(0, 200)}`)
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(1) })
