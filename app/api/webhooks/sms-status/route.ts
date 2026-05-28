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

  const retryableStatuses = ["new", "contacted", "active_conversation", "qualified", "following_up", "nurturing"]
  if (lead && !lead.ai_paused && retryableStatuses.includes(lead.status)) {
    // Check we haven't already queued a retry for this conversation
    const { count } = await db
      .from("sequences")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", conv.lead_id)
      .eq("sequence_type", "sms_retry")
      .eq("status", "pending")

    if ((count ?? 0) === 0) {
      await db.from("sequences").insert({
        lead_id:       conv.lead_id,
        company_id:    conv.company_id,
        sequence_type: "sms_retry",
        step:          1,
        scheduled_at:  new Date(Date.now() + 60_000).toISOString(),
        status:        "pending",
        metadata:      { failed_conversation_id: conv.id, failed_body: conv.body },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
