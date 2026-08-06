import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { formatPhone } from "@/lib/twilio"
import { companyFromWebhookSecret, getGhlConnection, sendGhlSms } from "@/lib/ghl"
import { buildRepliedNotBookedSchedule } from "@/lib/sequences"
import { notifyAppointmentBooked, notifyNeedsAttention } from "@/lib/notifications"

// A lead replied inside GoHighLevel.
//
// GHL Workflow → trigger "Customer Replied" (SMS) → Webhook action:
//   POST /api/webhooks/ghl/inbound-message
//   Header: x-webhook-secret: <company webhook_secret>
//   Body:   { "contactId": "{{contact.id}}", "phone": "{{contact.phone}}",
//             "message": "{{message.body}}" }
//
// Scope the workflow to the leads this agent owns (a tag filter), or every
// reply in the whole location will fire it — including other businesses'.

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const secret =
    req.headers.get("x-webhook-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    (typeof body.secret === "string" ? body.secret : null)

  const companyId = await companyFromWebhookSecret(secret)
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  const messageBody = str(body.message) ?? str(body.body) ?? str(body.messageBody)
  const ghlContactId = str(body.contactId) ?? str(body.contact_id)
  const rawPhone = str(body.phone)
  if (!messageBody) return NextResponse.json({ ok: true, skipped: "no message body" })

  const db = createServiceRoleClient()

  // Match on the GHL contact id first (exact), then phone.
  let lead: { id: string; status: string; ai_paused: boolean } | null = null
  if (ghlContactId) {
    const { data } = await db
      .from("leads").select("id, status, ai_paused")
      .eq("company_id", companyId).eq("ghl_contact_id", ghlContactId)
      .is("deleted_at", null).maybeSingle()
    lead = data
  }
  if (!lead && rawPhone) {
    const { data } = await db
      .from("leads").select("id, status, ai_paused")
      .eq("company_id", companyId).eq("phone", formatPhone(rawPhone))
      .is("deleted_at", null).maybeSingle()
    lead = data
    // Backfill the link so the next reply matches on the first try
    if (lead && ghlContactId) {
      await db.from("leads").update({ ghl_contact_id: ghlContactId }).eq("id", lead.id)
    }
  }

  if (!lead) return NextResponse.json({ ok: true, skipped: "no matching lead" })
  if (lead.ai_paused) return NextResponse.json({ ok: true, skipped: "ai paused" })

  await db.from("leads").update({
    last_inbound_at: new Date().toISOString(),
    is_active_conversation: true,
  }).eq("id", lead.id)

  try {
    const result = await processAndSave(lead.id, companyId, messageBody)

    if (result.response) {
      const conn = await getGhlConnection(companyId)
      if (conn && ghlContactId) {
        const sent = await sendGhlSms(conn, ghlContactId, result.response)
        if (sent && result.outboundConversationId) {
          await db.from("conversations")
            .update({ twilio_sid: sent, channel: "sms" })
            .eq("id", result.outboundConversationId)
        }
      }
    }

    // They replied — the no-reply chase stops, and unless they just booked,
    // the replied-not-booked cadence takes over.
    await db.from("sequences").update({ status: "cancelled" })
      .eq("lead_id", lead.id).eq("sequence_type", "no_reply").eq("status", "pending")

    const terminal = ["closed", "closed_won", "closed_lost", "appointment_booked", "lost", "unqualified", "needs_attention", "cold"]
    if (result.action?.type !== "book_appointment" && !terminal.includes(lead.status)) {
      await db.from("sequences").update({ status: "cancelled" })
        .eq("lead_id", lead.id).eq("sequence_type", "replied_not_booked").eq("status", "pending")
      const { data: cfg } = await db
        .from("ai_agent_config").select("timezone").eq("company_id", companyId).maybeSingle()
      const steps = buildRepliedNotBookedSchedule(new Date(), cfg?.timezone ?? "America/New_York")
      await db.from("sequences").insert(steps.map((s) => ({
        lead_id: lead.id, company_id: companyId, sequence_type: "replied_not_booked",
        step: s.step, scheduled_at: s.scheduledAt.toISOString(), status: "pending",
      })))
    } else {
      await db.from("sequences").update({ status: "cancelled" })
        .eq("lead_id", lead.id).eq("status", "pending")
    }

    if ((result.action?.type === "book_appointment" && result.action.outcome !== "noop") || result.action?.type === "reschedule_appointment") {
      const { sendConfirmations } = await import("@/lib/appointment-reminders")
      const { data: apt } = await db
        .from("appointments").select("id, scheduled_at, address")
        .eq("lead_id", lead.id).eq("status", "scheduled")
        .order("created_at", { ascending: false }).limit(1).maybeSingle()
      if (apt) {
        sendConfirmations(apt.id).catch(() => {})
        const { data: l } = await db
          .from("leads").select("first_name, last_name, phone").eq("id", lead.id).single()
        if (l) {
          const name = `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || l.phone
          notifyAppointmentBooked(companyId, name, apt.scheduled_at, apt.address ?? "").catch(() => {})
        }
      }
    }

    if (result.action?.type === "update_status" && result.action.status === "needs_attention") {
      const { data: l } = await db
        .from("leads").select("first_name, last_name, phone").eq("id", lead.id).single()
      if (l) {
        const name = `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || l.phone
        notifyNeedsAttention(companyId, name, l.phone).catch(() => {})
      }
    }
  } catch (err) {
    console.error("[ghl/inbound-message] engine error:", err)
  }

  return NextResponse.json({ ok: true })
}
