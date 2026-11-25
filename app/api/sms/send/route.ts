import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendToLead, isPlaceholderPhone, describeTwilioError } from "@/lib/twilio"

// A person replying to a lead from the CRM. Goes out through the same transport
// ladder as the AI (GoHighLevel when connected, otherwise the company's Twilio
// number) so the lead sees ONE number, then pauses the AI on this lead.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { leadId, body } = await req.json().catch(() => ({})) as { leadId?: string; body?: string }
  const text = body?.trim()
  if (!leadId || !text) {
    return NextResponse.json({ error: "Missing leadId or body" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const service = createServiceRoleClient()

  const { data: lead } = await service
    .from("leads").select("id, phone, channel, last_inbound_at").eq("id", leadId).eq("company_id", profile.company_id).single()
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (isPlaceholderPhone(lead.phone)) {
    return NextResponse.json({ error: "This lead has no mobile number on file, so there is nothing to text." }, { status: 400 })
  }

  const { data: phoneRecord } = await service
    .from("phone_numbers").select("phone_number").eq("company_id", profile.company_id).eq("is_active", true).limit(1).maybeSingle()
  if (!phoneRecord?.phone_number) {
    return NextResponse.json({ error: "No texting number is set up for this account yet. Reserve one in Settings." }, { status: 400 })
  }

  let sid: string | null = null
  try {
    const sent = await sendToLead(
      { id: lead.id as string, phone: lead.phone as string },
      text,
      phoneRecord.phone_number,
      profile.company_id
    )
    sid = sent.sid
  } catch (err) {
    const code = (err as { code?: number })?.code
    console.error(`[sms/send] manual text to lead ${leadId} failed (code ${code ?? "?"}):`, err)
    // Keep the attempt visible in the thread, marked as not delivered.
    await service.from("conversations").insert({
      lead_id: leadId,
      company_id: profile.company_id,
      direction: "outbound",
      sent_by: "human",
      channel: "sms",
      body: text,
      delivery_status: "failed",
      delivery_error_code: code ? String(code) : null,
    })
    return NextResponse.json({ error: describeTwilioError(err), code: code ?? null }, { status: 502 })
  }

  await service.from("conversations").insert({
    lead_id: leadId,
    company_id: profile.company_id,
    direction: "outbound",
    sent_by: "human",
    channel: "sms",
    body: text,
    twilio_sid: sid,
  })

  // A person took over this conversation: the AI stops replying until it is switched back on.
  await service
    .from("leads")
    .update({ last_message_at: new Date().toISOString(), ai_paused: true })
    .eq("id", leadId)

  return NextResponse.json({ success: true, aiPaused: true })
}
