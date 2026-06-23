import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendSMS } from "@/lib/twilio"

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { leadId, body } = await req.json()
  if (!leadId || !body?.trim()) {
    return NextResponse.json({ error: "Missing leadId or body" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const service = createServiceRoleClient()

  // Verify lead belongs to this company
  const { data: lead } = await service
    .from("leads").select("phone").eq("id", leadId).eq("company_id", profile.company_id).single()
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  // Get company's Twilio number
  const { data: phoneRecord } = await service
    .from("phone_numbers").select("phone_number").eq("company_id", profile.company_id).eq("is_active", true).single()
  if (!phoneRecord?.phone_number) {
    return NextResponse.json({ error: "No phone number provisioned" }, { status: 400 })
  }

  // Send SMS
  const msg = await sendSMS(lead.phone, body.trim(), phoneRecord.phone_number)

  // Save to conversations
  await service.from("conversations").insert({
    lead_id: leadId,
    company_id: profile.company_id,
    direction: "outbound",
    sent_by: "human",
    body: body.trim(),
    twilio_sid: msg.sid,
  })

  // Pause the AI and update last_message_at — human took over this conversation
  await service
    .from("leads")
    .update({ last_message_at: new Date().toISOString(), ai_paused: true })
    .eq("id", leadId)

  return NextResponse.json({ success: true })
}
