/**
 * Books one appointment and watches the row for 30s. If scheduled_at changes
 * after we wrote it, something outside this process is rewriting it.
 */
import { createServiceRoleClient } from "../lib/supabase-server"
import { getGhlCalendar, getGhlFreeSlots, createGhlAppointment } from "../lib/ghl-calendar"
import { ensureLeadGhlContact } from "../lib/ghl"

const CO = "34f34432-9e1e-4e74-9383-83d5f3f96946"
const db = createServiceRoleClient()
const TZ = "America/Los_Angeles"
const show = (iso: string) =>
  `${iso}  (${new Date(iso).toLocaleString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", weekday: "short" })} ${TZ})`

async function main() {
  const phone = "+15550199077"
  const { data: old } = await db.from("leads").select("id").eq("company_id", CO).eq("phone", phone)
  for (const l of old ?? []) {
    await db.from("appointments").delete().eq("lead_id", l.id)
    await db.from("leads").delete().eq("id", l.id)
  }

  const { data: lead } = await db.from("leads").insert({
    company_id: CO, first_name: "DriftTest", phone, source: "facebook",
    channel: "sms", status: "just_came_in", timezone: TZ, metadata: { test: true },
  }).select("id").single()
  const leadId = lead!.id

  const cal = await getGhlCalendar(CO)
  if (!cal) { console.log("no calendar"); return }
  const slots = await getGhlFreeSlots(cal, TZ, { daysAhead: 6, max: 5 })
  const chosen = slots[0]
  console.log(`chose slot : ${show(chosen.isoStart)}   label="${chosen.label}"`)

  const { data: apt } = await db.from("appointments").insert({
    lead_id: leadId, company_id: CO, scheduled_at: chosen.isoStart,
    status: "scheduled", confirmation_status: "pending_confirmation",
  }).select("id, scheduled_at").single()
  console.log(`after insert: ${show(apt!.scheduled_at)}`)

  const link = await ensureLeadGhlContact(CO, leadId)
  const ev = await createGhlAppointment(cal, {
    contactId: link!.contactId, startTimeIso: chosen.isoStart,
    title: "Drift test", leadTimezone: TZ,
  })
  console.log(`GHL event  : ${ev?.id ?? "FAILED"}`)
  await db.from("appointments").update({ ghl_event_id: ev?.id }).eq("id", apt!.id)

  for (const wait of [5, 10, 15]) {
    await new Promise((r) => setTimeout(r, wait * 1000))
    const { data: rows } = await db.from("appointments")
      .select("id, scheduled_at, ghl_event_id").eq("lead_id", leadId)
    console.log(`\n+${wait}s — ${rows?.length} row(s)`)
    for (const r of rows ?? []) console.log(`   ${show(r.scheduled_at)} ghl=${r.ghl_event_id ?? "none"}`)
  }

  // cleanup
  const { data: rows } = await db.from("appointments").select("ghl_event_id").eq("lead_id", leadId)
  for (const r of rows ?? []) {
    if (r.ghl_event_id) {
      await fetch(`https://services.leadconnectorhq.com/calendars/events/${r.ghl_event_id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${cal.api_key}`, Version: "2021-04-15" },
      })
    }
  }
  if (link) {
    await fetch(`https://services.leadconnectorhq.com/contacts/${link.contactId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${cal.api_key}`, Version: "2021-07-28" },
    })
  }
  await db.from("appointments").delete().eq("lead_id", leadId)
  await db.from("leads").delete().eq("id", leadId)
  console.log("\ncleaned up.")
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
