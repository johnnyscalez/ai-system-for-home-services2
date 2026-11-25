import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendMessengerMessage } from "@/lib/messenger"

export const runtime = "nodejs"

// POST /api/messenger/send — manual reply from the dashboard to a Messenger lead.
// Mirrors /api/sms/send: sends, saves the conversation row, pauses the AI
// (a human took over the thread).
export async function POST(req: NextRequest) {
  // The SERVER client reads the session cookie. The browser client used here before
  // has no cookies on the server, so every manual Messenger reply returned 401.
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { leadId, body } = await req.json() as { leadId?: string; body?: string }
  if (!leadId || !body?.trim()) {
    return NextResponse.json({ error: "leadId and body required" }, { status: 400 })
  }

  const db = createServiceRoleClient()

  const [{ data: profile }, { data: lead }] = await Promise.all([
    db.from("users").select("company_id").eq("id", user.id).single(),
    db.from("leads").select("id, company_id, messenger_psid").eq("id", leadId).single(),
  ])

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (lead.company_id !== profile?.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!lead.messenger_psid) {
    return NextResponse.json({ error: "This lead has no Messenger conversation" }, { status: 400 })
  }

  const { data: integration } = await db
    .from("integrations")
    .select("fb_access_token")
    .eq("company_id", lead.company_id)
    .eq("type", "facebook")
    .eq("is_active", true)
    .maybeSingle()

  if (!integration?.fb_access_token) {
    return NextResponse.json({ error: "Facebook is not connected" }, { status: 400 })
  }

  const sent = await sendMessengerMessage(integration.fb_access_token, lead.messenger_psid, body.trim())
  if (!sent.ok) {
    // Meta only lets a Page reply within 24 hours of the person's last message.
    const outsideWindow = /outside (of )?(the )?allowed window|24.?hour|#10\b|2018278/i.test(sent.error ?? "")
    return NextResponse.json({
      error: outsideWindow
        ? "Facebook only allows a reply within 24 hours of their last message. Text or call this lead instead."
        : (sent.error ?? "Messenger send failed"),
    }, { status: 502 })
  }

  await db.from("conversations").insert({
    lead_id: leadId,
    company_id: lead.company_id,
    direction: "outbound",
    sent_by: "human",
    body: body.trim(),
    channel: "messenger",
    // The message id lets the echo of this very send be recognised as ours.
    twilio_sid: sent.messageId ?? null,
  })

  // Human took over — pause the AI, same as SMS manual sends
  await db.from("leads")
    .update({ last_message_at: new Date().toISOString(), ai_paused: true })
    .eq("id", leadId)

  return NextResponse.json({ success: true })
}
