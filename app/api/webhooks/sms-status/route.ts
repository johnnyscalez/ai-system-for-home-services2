import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

// Twilio calls this webhook for every outbound SMS status update.
// MessageStatus values: queued → sending → sent → delivered | failed | undelivered
//
// We use it to:
// 1. Mark failed messages so operators can see them in the CRM
// 2. Schedule a retry for failed/undelivered messages (once, 60s later)

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const messageSid    = body.get("MessageSid")?.toString()
  const messageStatus = body.get("MessageStatus")?.toString()
  const errorCode     = body.get("ErrorCode")?.toString() ?? null
  const to            = body.get("To")?.toString() ?? ""

  if (!messageSid || !messageStatus) return NextResponse.json({ ok: true })

  // Only act on terminal failure statuses
  const isFailed = messageStatus === "failed" || messageStatus === "undelivered"
  if (!isFailed) return NextResponse.json({ ok: true })

  const db = createServiceRoleClient()

  // Find the conversation row by twilio_sid
  const { data: conv } = await db
    .from("conversations")
    .select("id, lead_id, company_id, body, direction")
    .eq("twilio_sid", messageSid)
    .eq("direction", "outbound")
    .maybeSingle()

  if (!conv) return NextResponse.json({ ok: true })

  // Mark delivery failure on the conversation row
  await db
    .from("conversations")
    .update({ delivery_status: messageStatus, delivery_error_code: errorCode })
    .eq("id", conv.id)

  console.warn(`[sms-status] Delivery ${messageStatus} for conv ${conv.id} lead ${conv.lead_id} to ${to} — error ${errorCode ?? "none"}`)

  // Schedule one retry in 60 seconds via sequences (reuse the existing sequence runner)
  // Only retry if lead is still active (not closed/lost/booked)
  const { data: lead } = await db
    .from("leads")
    .select("status, ai_paused")
    .eq("id", conv.lead_id)
    .single()

  // ── Permanent failures: retrying is pointless and loops forever ────────────
  // 30034 = OUR number isn't A2P-registered (every US send fails until the
  //         number is registered — retrying spams the CRM thread, audit incident:
  //         148 identical sends to one lead)
  // 30003/30004/30005/30006 = unreachable / blocked / unknown / landline
  // 21610 = recipient opted out · 21211/21614 = invalid / not a mobile
  const PERMANENT_SMS_ERRORS = new Set(["30034", "30003", "30004", "30005", "30006", "21610", "21211", "21614"])
  const isPermanent = errorCode !== null && PERMANENT_SMS_ERRORS.has(errorCode)

  // Retry ONCE, ever — count sms_retry rows of ANY status. The old check only
  // looked for a *pending* retry, so after each retry was sent-and-failed a
  // fresh one was created: an infinite 5-minute loop.
  const { count: retriesEver } = await db
    .from("sequences")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", conv.lead_id)
    .eq("sequence_type", "sms_retry")

  const retryableStatuses = ["new", "contacted", "active_conversation", "qualified", "following_up", "nurturing"]
  const leadEligible = lead && !lead.ai_paused && retryableStatuses.includes(lead.status)

  if (isPermanent || (retriesEver ?? 0) >= 1 || !leadEligible) {
    if (isPermanent || (retriesEver ?? 0) >= 1) {
      // This number can't receive our SMS — stop ALL automated outreach to it
      // and surface the lead for a manual call instead of grinding forever.
      await db.from("sequences").update({ status: "cancelled" })
        .eq("lead_id", conv.lead_id).eq("status", "pending")
      const reason = isPermanent
        ? `SMS undeliverable (Twilio error ${errorCode})`
        : "SMS undeliverable (retry also failed)"
      const { data: l2 } = await db.from("leads").select("notes, status").eq("id", conv.lead_id).single()
      if (l2 && !["appointment_booked", "closed_won", "closed_lost", "lost"].includes(l2.status)) {
        await db.from("leads").update({
          status: "needs_attention",
          notes: [l2.notes, `⚠️ ${reason} — call this lead manually.`].filter(Boolean).join(" | "),
        }).eq("id", conv.lead_id)
      }
      console.warn(`[sms-status] ${reason} — outreach stopped for lead ${conv.lead_id}, flagged needs_attention`)
    }
    return NextResponse.json({ ok: true })
  }

  // Transient failure, first occurrence → schedule exactly one retry in 60s
  await db.from("sequences").insert({
    lead_id:       conv.lead_id,
    company_id:    conv.company_id,
    sequence_type: "sms_retry",
    step:          1,
    scheduled_at:  new Date(Date.now() + 60_000).toISOString(),
    status:        "pending",
    metadata:      { failed_conversation_id: conv.id, failed_body: conv.body },
  })

  return NextResponse.json({ ok: true })
}
