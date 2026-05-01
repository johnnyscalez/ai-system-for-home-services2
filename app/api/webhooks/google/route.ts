import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, formatPhone } from "@/lib/twilio"

// Receives leads from Google Ads Lead Form Extensions.
// Contractor pastes: https://app.leadreply.ai/api/webhooks/google?secret=WEBHOOK_SECRET
// Google sends POST with user_column_data array.
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")

  if (!secret) {
    return NextResponse.json({ error: "Missing secret" }, { status: 401 })
  }

  let body: {
    lead_id?: string
    form_id?: string
    campaign_id?: string
    google_key?: string
    user_column_data?: Array<{ column_name: string; string_value: string }>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Look up company by webhook secret
  const { data: company } = await supabase
    .from("companies")
    .select("id, service_type")
    .eq("webhook_secret", secret)
    .single()

  if (!company) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 })
  }

  // Normalize Google's user_column_data format
  const fields: Record<string, string> = {}
  for (const col of body.user_column_data ?? []) {
    fields[col.column_name.toLowerCase()] = col.string_value
  }

  const rawPhone =
    fields["phone_number"] ||
    fields["phone"] ||
    fields["mobile_phone"] ||
    ""
  if (!rawPhone) {
    return NextResponse.json({ error: "Phone required" }, { status: 400 })
  }

  const phone = formatPhone(rawPhone)
  const fullName = fields["full_name"] || ""
  const firstName = fields["given_name"] || fields["first_name"] || fullName.split(" ")[0] || null
  const lastName =
    fields["family_name"] ||
    fields["last_name"] ||
    (fullName.includes(" ") ? fullName.split(" ").slice(1).join(" ") : null)

  // Upsert lead
  const { data: existing } = await supabase
    .from("leads")
    .select("id, status")
    .eq("company_id", company.id)
    .eq("phone", phone)
    .maybeSingle()

  let leadId: string

  if (existing) {
    if (existing.status === "cold" || existing.status === "closed_lost") {
      await supabase
        .from("leads")
        .update({ status: "just_came_in", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    }
    leadId = existing.id
  } else {
    const { data: newLead } = await supabase
      .from("leads")
      .insert({
        company_id: company.id,
        phone,
        first_name: firstName,
        last_name: lastName,
        email: fields["email"] || null,
        source: "webhook",
        source_form_id: body.form_id || null,
        status: "just_came_in",
        metadata: { google_lead_id: body.lead_id, campaign_id: body.campaign_id },
      })
      .select("id")
      .single()

    if (!newLead) {
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
    }
    leadId = newLead.id
  }

  // Get Twilio number and run AI engine
  const { data: phoneNumber } = await supabase
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .single()

  if (!phoneNumber?.phone_number) {
    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: false })
  }

  try {
    const result = await processAndSave(leadId, company.id, null)
    if (result.response) {
      const msg = await sendSMS(phone, result.response, phoneNumber.phone_number)
      await supabase
        .from("conversations")
        .update({ twilio_sid: msg.sid })
        .eq("lead_id", leadId)
        .eq("direction", "outbound")
        .is("twilio_sid", null)
        .order("created_at", { ascending: false })
        .limit(1)

      await supabase
        .from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", leadId)

      await supabase.from("sequences").insert({
        lead_id: leadId,
        company_id: company.id,
        sequence_type: "no_reply",
        step: 1,
        scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: "pending",
      })
    }
    return NextResponse.json({ success: true, lead_id: leadId })
  } catch (e) {
    console.error("AI/SMS error for Google lead:", e)
    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: false })
  }
}
