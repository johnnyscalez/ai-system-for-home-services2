/**
 * End-to-end proof for the sales agent's booking → confirmation chain.
 *
 * For each timezone it drives a real conversation through the live engine, lets
 * the real GHL calendar create the event, runs the real sendConfirmations(),
 * and then reads the SMS body that was actually written to the conversations
 * table. Nothing about the message text is simulated — if an assertion fails
 * here, a real prospect would have seen the same thing.
 *
 * Asserts:
 *   1. exactly one appointment (no phantom duplicate)
 *   2. a GHL event id came back
 *   3. a Google Meet link came back
 *   4. the confirmation SMS actually carries that link
 *   5. the SMS states the time in the LEAD's zone, matching what the agent said
 *   6. every clock time the agent offered was a genuine opening
 *
 *   npx tsx --env-file=.env.local scripts/verify-confirmation-link.ts
 */
import { createServiceRoleClient } from "../lib/supabase-server"
import { processAndSave } from "../lib/ai-engine"
import { sendConfirmations } from "../lib/appointment-reminders"
import { getGhlCalendar, getGhlFreeSlots } from "../lib/ghl-calendar"

const CO = "34f34432-9e1e-4e74-9383-83d5f3f96946"
const db = createServiceRoleClient()

const CASES = [
  { city: "Denver", tz: "America/Denver", said: "im in denver, mountain time", phone: "+15550199001" },
  { city: "Seattle", tz: "America/Los_Angeles", said: "seattle, pacific time", phone: "+15550199002" },
  { city: "Miami", tz: "America/New_York", said: "miami florida, eastern", phone: "+15550199003" },
]

function clockTimesIn(text: string): string[] {
  const out: string[] = []
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const h = parseInt(m[1], 10)
    if (h < 1 || h > 12) continue
    out.push(`${h}:${m[2] ?? "00"} ${m[3].replace(/\./g, "").toLowerCase()}`)
  }
  return [...new Set(out)]
}
const clockOf = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).toLowerCase().trim()

async function say(leadId: string, msg: string | null) {
  const r = await processAndSave(leadId, CO, msg)
  return (r.response ?? "").trim()
}

async function wipe(phone: string) {
  const { data } = await db.from("leads").select("id").eq("company_id", CO).eq("phone", phone)
  for (const l of data ?? []) {
    await db.from("appointments").delete().eq("lead_id", l.id)
    await db.from("conversations").delete().eq("lead_id", l.id)
    await db.from("sequences").delete().eq("lead_id", l.id)
    await db.from("leads").delete().eq("id", l.id)
  }
}

async function runCase(c: (typeof CASES)[number]) {
  console.log(`\n${"═".repeat(72)}\n▶ ${c.city} (${c.tz})\n${"═".repeat(72)}`)
  await wipe(c.phone)

  const { data: lead, error } = await db.from("leads").insert({
    company_id: CO, first_name: "Marcus", phone: c.phone,
    source: "facebook", channel: "sms", status: "just_came_in",
    notes: "NumberOfTechs: 10+", metadata: { test: true },
  }).select("id").single()
  if (error || !lead) throw error
  const leadId = lead.id

  const transcript: string[] = []
  for (const t of [null, "we get maybe 40 calls a week and miss a bunch after 5", c.said]) {
    if (t) console.log(`LEAD: ${t}`)
    const r = await say(leadId, t)
    transcript.push(r)
    console.log(`AI:   ${r}\n`)
  }
  console.log(`LEAD: the first one works for me`)
  const picked = await say(leadId, "the first one works for me")
  transcript.push(picked)
  console.log(`AI:   ${picked}\n`)

  const fails: string[] = []

  // 6. every offered clock time must be a real opening
  const cal = await getGhlCalendar(CO)
  const realSlots = cal ? await getGhlFreeSlots(cal, c.tz, { daysAhead: 12, max: 40 }) : []
  const realClocks = new Set(realSlots.map((s) => clockOf(s.isoStart, c.tz)))
  const offered = transcript.flatMap(clockTimesIn)
  const invented = offered.filter((t) => !realClocks.has(t))
  if (invented.length) fails.push(`offered times not on the calendar: ${invented.join(", ")}`)

  const { data: apts } = await db
    .from("appointments").select("id, scheduled_at, ghl_event_id, google_meet_link")
    .eq("lead_id", leadId)

  if ((apts?.length ?? 0) !== 1) fails.push(`expected 1 appointment, got ${apts?.length ?? 0}`)
  const apt = (apts ?? [])[0]
  if (!apt) {
    console.log("RESULT: ❌ " + fails.join(" | "))
    await cleanup(leadId, apts ?? [])
    return false
  }
  if (!apt.ghl_event_id) fails.push("no GHL event id")
  if (!apt.google_meet_link) fails.push("no Google Meet link")

  await sendConfirmations(apt.id)

  const { data: msgs } = await db
    .from("conversations").select("body").eq("lead_id", leadId).eq("direction", "outbound")
    .order("created_at", { ascending: false }).limit(4)
  const conf = (msgs ?? []).find((m) => /confirmed/i.test(m.body ?? ""))

  if (!conf) {
    fails.push("no confirmation SMS was stored")
  } else {
    if (apt.google_meet_link && !conf.body.includes(apt.google_meet_link)) {
      fails.push("confirmation SMS is missing the Meet link")
    }
    const want = clockOf(apt.scheduled_at, c.tz)
    const inSms = clockTimesIn(conf.body)
    if (!inSms.includes(want)) {
      fails.push(`SMS says ${inSms.join("/") || "no time"} but the booking is ${want} ${c.city} time`)
    }
    console.log(`SMS:  ${conf.body}`)
  }

  console.log(
    `\nbooked ${clockOf(apt.scheduled_at, c.tz)} ${c.city} | ghl ${apt.ghl_event_id ? "✓" : "✗"} | meet ${apt.google_meet_link ? "✓" : "✗"}`
  )
  console.log(fails.length ? `RESULT: ❌ ${fails.join(" | ")}` : "RESULT: ✅ all assertions passed")

  await cleanup(leadId, apts ?? [])
  return fails.length === 0
}

async function cleanup(leadId: string, apts: { ghl_event_id: string | null }[]) {
  try {
    const cal = await getGhlCalendar(CO)
    const { ensureLeadGhlContact } = await import("../lib/ghl")
    const link = await ensureLeadGhlContact(CO, leadId)
    for (const a of apts) {
      if (a.ghl_event_id && cal) {
        await fetch(`https://services.leadconnectorhq.com/calendars/events/${a.ghl_event_id}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${cal.api_key}`, Version: "2021-04-15" },
        })
      }
    }
    if (link && cal) {
      await fetch(`https://services.leadconnectorhq.com/contacts/${link.contactId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${cal.api_key}`, Version: "2021-07-28" },
      })
    }
  } catch { /* best effort */ }
  await db.from("appointments").delete().eq("lead_id", leadId)
  await db.from("conversations").delete().eq("lead_id", leadId)
  await db.from("sequences").delete().eq("lead_id", leadId)
  await db.from("leads").delete().eq("id", leadId)
}

async function main() {
  const results: boolean[] = []
  for (const c of CASES) results.push(await runCase(c))
  console.log(`\n${"═".repeat(72)}`)
  console.log(`${results.filter(Boolean).length}/${results.length} fully correct`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
