/**
 * Seeds the Peak Comfort DEMO account with realistic 30-day dashboard data
 * for ad screenshots. Idempotent-ish: computes deficits against targets and
 * tops up, so re-running won't double the numbers.
 *
 * Targets (last 30 days):
 *   132 new leads · 87 conversations (distinct leads w/ inbound) ·
 *   41 jobs booked (33 completed, 8 upcoming) ·
 *   $31,264 booked-by-AI revenue · $8,410 sourced-by-AI revenue
 *
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/seed-demo-dashboard.ts
 */
import { createServiceRoleClient } from "../lib/supabase-server"

const COMPANY = "436e5f50-ad1b-42b5-a050-a702cc374618" // Peak Comfort demo — NEVER a real client

const TARGET_LEADS = 132
const TARGET_CONVO_LEADS = 87
const TARGET_APTS = 41
const TARGET_COMPLETED = 33
// 28 closed AI-booked jobs — sums to exactly $31,264
const BOOKED_AMOUNTS = [6480, 5890, 1480, 1320, 1240, 1140, 1060, 980, 920, 880, 840, 790, 740, 690, 660, 620, 590, 560, 530, 490, 470, 440, 420, 390, 370, 350, 340, 584]
// 5 closed office-booked jobs from AI-sourced customers — sums to exactly $8,410
const SOURCED_AMOUNTS = [2840, 1890, 1480, 1260, 940]

const FIRST = ["Mike","Sarah","David","Jennifer","Chris","Amanda","Kevin","Lisa","Brandon","Emily","Jason","Nicole","Matt","Stephanie","Eric","Rachel","Tyler","Megan","Josh","Lauren","Derek","Katie","Ryan","Melissa","Adam","Heather","Justin","Brittany","Sean","Christina","Nathan","Angela","Brad","Danielle","Corey","Tiffany","Travis","Courtney","Shane","Vanessa","Marcus","Erica","Dustin","Kayla","Trevor","Monica","Wesley","Diana","Grant","Paula","Victor","Gina","Russ","Carmen","Neil","Tara","Doug","Wendy","Phil","Robin","Glen","Dana","Craig","Toni","Lance","Faith","Blake","Joy","Reed","Iris","Cole","June","Wade","Beth","Drew"]
const LAST = ["Reynolds","Patterson","Whitfield","Grady","Holloway","Mercer","Ashford","Callahan","Dempsey","Farrow","Gentry","Hobbs","Ingram","Jarvis","Kimball","Langston","Mabry","Norwood","Ogden","Pruitt","Quimby","Rasmussen","Sheffield","Thackery","Upton","Vance","Wexler","Yancey","Zimmerman","Aldridge","Bostic","Crowder","Dillard","Eastman","Fenwick","Garrison","Hutchins","Irwin","Jessup","Kirkland","Lockhart","McAllister","Nesbitt","Overton","Pemberton","Radford","Satterfield","Tillman","Underhill","Vickers","Wombley","Yarborough","Ackerman","Bridges","Colvin","Draper","Emerson","Fleming","Goodwin","Harrell","Ivey","Jennings","Keller","Lawson","Maddox","Newton","Osborne","Pittman","Ramsey","Sanford","Talley","Vaughn","Whitley","York","Zeller"]
const STREETS: Array<[string, string]> = [
  ["Sharon Amity Rd, Charlotte, NC 28211","Charlotte"],["Park Rd, Charlotte, NC 28209","Charlotte"],
  ["Idlewild Rd, Matthews, NC 28105","Matthews"],["Gilead Rd, Huntersville, NC 28078","Huntersville"],
  ["Poplar Tent Rd, Concord, NC 28027","Concord"],["Carmel Rd, Charlotte, NC 28226","Charlotte"],
  ["Lawyers Rd, Mint Hill, NC 28227","Mint Hill"],["Main St, Pineville, NC 28134","Pineville"],
  ["Mallard Creek Rd, Charlotte, NC 28262","Charlotte"],["Rea Rd, Charlotte, NC 28277","Charlotte"],
  ["Eastway Dr, Charlotte, NC 28205","Charlotte"],["Steele Creek Rd, Charlotte, NC 28273","Charlotte"],
  ["Prosperity Church Rd, Charlotte, NC 28269","Charlotte"],["Ballantyne Commons Pkwy, Charlotte, NC 28277","Charlotte"],
  ["Sardis Rd N, Charlotte, NC 28270","Charlotte"],["Monroe Rd, Matthews, NC 28105","Matthews"],
  ["Statesville Rd, Huntersville, NC 28078","Huntersville"],["Derita Rd, Concord, NC 28027","Concord"],
]
const TECHS = ["Jake Morrison","Danny Alvarez","Chris Waller","Tommy Nguyen","Ray Bennett"]
const JOB_TYPES = ["ac_repair","ac_not_cooling","hvac_replacement","furnace_repair","ac_installation","duct_cleaning","hvac_tune_up","heat_pump_repair"]
const SOURCES = ["facebook","facebook","facebook","facebook","facebook","facebook","website","website","google","messenger","whatsapp"]
const INBOUND = [
  "yeah its blowing warm air, started a couple days ago",
  "how soon can someone come out?",
  "whats the service call fee?",
  "we own the house, been here about 8 years",
  "the unit is maybe 12 years old i think",
  "ok that time works for me",
  "its making a loud rattling noise when it kicks on",
  "upstairs is way hotter than downstairs",
]
const OUTBOUND = [
  "That's no fun in this heat — you're in the right place. How long has it been doing that?",
  "Got it. What's the address we'd be coming to?",
  "I've got tomorrow morning or Thursday between 1-3 — which works better?",
  "Done — you're on the schedule. Our tech will reach out before heading over.",
]

const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
const daysAgo = (d: number, hour = 9 + Math.floor(Math.random() * 10), min = Math.floor(Math.random() * 60)) => {
  const t = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
  t.setHours(hour, min, 0, 0)
  return t
}

async function main() {
  const db = createServiceRoleClient()
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Rename SyncTest leads + fix their Kankakee addresses ────────────────
  const { data: syncLeads } = await db.from("leads").select("id").eq("company_id", COMPANY).ilike("first_name", "%SyncTest%")
  const syncNames = [["Marcus","Webb"], ["Paul","Kestler"]]
  for (let i = 0; i < (syncLeads ?? []).length; i++) {
    const [f, l] = syncNames[i % syncNames.length]
    const addr = `${2100 + i * 3} ${STREETS[i][0]}`
    await db.from("leads").update({ first_name: f, last_name: l, address: addr }).eq("id", syncLeads![i].id)
    await db.from("appointments").update({ address: addr }).eq("lead_id", syncLeads![i].id)
    console.log(`renamed SyncTest lead ${i + 1} → ${f} ${l}`)
  }

  // ── 2. Existing past-dated scheduled appointments → completed ──────────────
  await db.from("appointments").update({ status: "completed" })
    .eq("company_id", COMPANY).eq("status", "scheduled")
    .lt("scheduled_at", new Date().toISOString())

  // ── 3. Inventory ───────────────────────────────────────────────────────────
  const { data: existingApts } = await db.from("appointments")
    .select("id, lead_id, status, origin, created_at")
    .eq("company_id", COMPANY).neq("status", "cancelled").gte("created_at", since30)
  const existingCompleted = (existingApts ?? []).filter(a => a.status === "completed")
  const existingScheduled = (existingApts ?? []).filter(a => a.status !== "completed")
  const { count: leadCount } = await db.from("leads").select("*", { count: "exact", head: true })
    .eq("company_id", COMPANY).gte("created_at", since30).is("deleted_at", null)
  const { data: convoRows } = await db.from("conversations").select("lead_id")
    .eq("company_id", COMPANY).eq("direction", "inbound").gte("created_at", since30)
  const convoLeads = new Set((convoRows ?? []).map(r => r.lead_id))

  const needLeads = Math.max(0, TARGET_LEADS - (leadCount ?? 0))
  const needApts = Math.max(0, TARGET_APTS - (existingApts?.length ?? 0))
  const needCompleted = Math.max(0, TARGET_COMPLETED - existingCompleted.length)
  const needConvos = Math.max(0, TARGET_CONVO_LEADS - convoLeads.size)
  console.log(`deficits → leads:+${needLeads} apts:+${needApts} (completed:+${needCompleted}) convoLeads:+${needConvos}`)

  // ── 4. Insert leads ────────────────────────────────────────────────────────
  const usedNames = new Set<string>()
  const newLeads: Array<{ id?: string; first_name: string; last_name: string; phone: string; created: Date; source: string; job_type: string; address: string }> = []
  for (let i = 0; i < needLeads; i++) {
    let f = "", l = ""
    do { f = rand(FIRST); l = rand(LAST) } while (usedNames.has(f + l))
    usedNames.add(f + l)
    // Weight toward recent days so the trend reads as growth
    const d = Math.floor(Math.pow(Math.random(), 1.35) * 29)
    newLeads.push({
      first_name: f, last_name: l,
      phone: `+1704555${String(1000 + i).slice(-4)}`,
      created: daysAgo(d),
      source: rand(SOURCES),
      job_type: rand(JOB_TYPES),
      address: `${100 + Math.floor(Math.random() * 8800)} ${rand(STREETS)[0]}`,
    })
  }
  for (const nl of newLeads) {
    const { data } = await db.from("leads").insert({
      company_id: COMPANY, phone: nl.phone, first_name: nl.first_name, last_name: nl.last_name,
      source: nl.source, channel: nl.source === "messenger" ? "messenger" : nl.source === "whatsapp" ? "whatsapp" : "sms",
      status: "contacted", job_type: nl.job_type, address: nl.address,
      created_at: nl.created.toISOString(), updated_at: nl.created.toISOString(),
    }).select("id").single()
    nl.id = data?.id
  }
  console.log(`inserted ${newLeads.length} leads`)

  // ── 5. New appointments — completed first (they carry the revenue) ─────────
  // Order: 5 office-origin completed (sourced revenue), then AI completed,
  // then any remaining as upcoming scheduled.
  const aptLeads = newLeads.filter(l => l.id).slice(0, needApts)
  const newAptRows: Array<{ leadIdx: number; origin: string; completed: boolean }> = []
  for (let i = 0; i < aptLeads.length; i++) {
    const completed = i < needCompleted
    const origin = completed && i < SOURCED_AMOUNTS.length ? "hcp" : "ai"
    newAptRows.push({ leadIdx: i, origin, completed })
  }
  const insertedApts: Array<{ id: string; lead_id: string; origin: string; completed: boolean; scheduled: Date }> = []
  for (const row of newAptRows) {
    const lead = aptLeads[row.leadIdx]
    const created = new Date(lead.created.getTime() + (10 + Math.random() * 100) * 60 * 1000)
    const scheduled = row.completed
      ? new Date(created.getTime() + (1 + Math.random() * 2.5) * 24 * 60 * 60 * 1000)
      : daysAgo(-1 - Math.floor(Math.random() * 4), 9 + Math.floor(Math.random() * 8), Math.random() > 0.5 ? 0 : 30)
    const { data } = await db.from("appointments").insert({
      company_id: COMPANY, lead_id: lead.id, scheduled_at: scheduled.toISOString(),
      status: row.completed ? "completed" : "scheduled",
      origin: row.origin, address: lead.address,
      technician_name: rand(TECHS),
      notes: row.origin === "hcp" ? "Created in Housecall Pro by the office" : null,
      hcp_job_id: `job_demo_${lead.phone.slice(-4)}`,
      confirmation_status: "confirmed", confirmation_sms_sent: true,
      created_at: created.toISOString(),
    }).select("id, lead_id").single()
    if (data) {
      insertedApts.push({ id: data.id, lead_id: data.lead_id, origin: row.origin, completed: row.completed, scheduled })
      await db.from("leads").update({ status: "appointment_booked" }).eq("id", lead.id)
    }
  }
  console.log(`inserted ${insertedApts.length} appointments (${insertedApts.filter(a => a.completed).length} completed)`)

  // ── 6. Revenue events — wipe old, insert exact amounts ─────────────────────
  await db.from("hcp_revenue_events").delete().eq("company_id", COMPANY)

  const aiCompleted = [
    ...existingCompleted.filter(a => a.origin !== "hcp").map(a => ({ lead_id: a.lead_id, when: new Date() })),
    ...insertedApts.filter(a => a.completed && a.origin === "ai").map(a => ({ lead_id: a.lead_id, when: a.scheduled })),
  ]
  const officeCompleted = insertedApts.filter(a => a.completed && a.origin === "hcp")

  let bi = 0
  for (const apt of aiCompleted) {
    if (bi >= BOOKED_AMOUNTS.length) break
    const closedAt = new Date(Math.min(Date.now() - 3600e3, apt.when.getTime() + (0.5 + Math.random() * 3) * 24 * 60 * 60 * 1000))
    await db.from("hcp_revenue_events").insert({
      company_id: COMPANY, lead_id: apt.lead_id, event_type: "job_completed",
      amount_cents: BOOKED_AMOUNTS[bi] * 100, attribution: "booked_by_ai",
      hcp_job_id: `job_demo_rev_${bi}`, created_at: closedAt.toISOString(),
    })
    bi++
  }
  let si = 0
  for (const apt of officeCompleted) {
    if (si >= SOURCED_AMOUNTS.length) break
    const closedAt = new Date(Math.min(Date.now() - 3600e3, apt.scheduled.getTime() + (0.5 + Math.random() * 3) * 24 * 60 * 60 * 1000))
    await db.from("hcp_revenue_events").insert({
      company_id: COMPANY, lead_id: apt.lead_id, event_type: "job_completed",
      amount_cents: SOURCED_AMOUNTS[si] * 100, attribution: "sourced_by_ai",
      hcp_job_id: `job_demo_src_${si}`, created_at: closedAt.toISOString(),
    })
    si++
  }
  console.log(`revenue events → booked:${bi} ($${BOOKED_AMOUNTS.slice(0, bi).reduce((a, b) => a + b, 0)}) sourced:${si} ($${SOURCED_AMOUNTS.slice(0, si).reduce((a, b) => a + b, 0)})`)

  // ── 7. Conversations — top up distinct inbound-convo leads to target ───────
  const talkers = newLeads.filter(l => l.id).slice(0, needConvos)
  for (const lead of talkers) {
    const base = lead.created.getTime()
    const msgs = [
      { direction: "outbound", body: OUTBOUND[0], offset: 1 },
      { direction: "inbound", body: rand(INBOUND), offset: 4 + Math.random() * 20 },
      { direction: "outbound", body: rand(OUTBOUND), offset: 5 + Math.random() * 25 },
      { direction: "inbound", body: rand(INBOUND), offset: 30 + Math.random() * 60 },
    ]
    for (const m of msgs) {
      await db.from("conversations").insert({
        company_id: COMPANY, lead_id: lead.id, direction: m.direction,
        sent_by: m.direction === "outbound" ? "ai" : "human", body: m.body, channel: "sms",
        created_at: new Date(base + m.offset * 60 * 1000).toISOString(),
      })
    }
    await db.from("leads").update({ last_message_at: new Date(base + 91 * 60 * 1000).toISOString() }).eq("id", lead.id)
  }
  console.log(`added conversations for ${talkers.length} leads`)

  // ── 8. Final verification ──────────────────────────────────────────────────
  const { count: fLeads } = await db.from("leads").select("*", { count: "exact", head: true })
    .eq("company_id", COMPANY).gte("created_at", since30).is("deleted_at", null)
  const { data: fConvo } = await db.from("conversations").select("lead_id")
    .eq("company_id", COMPANY).eq("direction", "inbound").gte("created_at", since30)
  const { data: fApts } = await db.from("appointments").select("status")
    .eq("company_id", COMPANY).neq("status", "cancelled").gte("created_at", since30)
  const { data: fRev } = await db.from("hcp_revenue_events").select("amount_cents, attribution")
    .eq("company_id", COMPANY).gte("created_at", since30)
  const booked = (fRev ?? []).filter(r => r.attribution === "booked_by_ai").reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const sourced = (fRev ?? []).filter(r => r.attribution === "sourced_by_ai").reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  console.log("\n=== FINAL STATE (30d) ===")
  console.log(`leads: ${fLeads} | convo leads: ${new Set((fConvo ?? []).map(r => r.lead_id)).size} | apts: ${fApts?.length} (completed ${(fApts ?? []).filter(a => a.status === "completed").length}) | booked $${booked / 100} | sourced $${sourced / 100}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
