import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, formatPhone } from "@/lib/twilio"

// Accepts lead data from Facebook Lead Ads, Google Ads, or any webhook source.
// Caller must include the company's webhook_secret in the x-webhook-secret header.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret")
  if (!secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Look up company by webhook_secret
  const { data: company } = await supabase
    .from("companies")
    .select("id, service_type")
    .eq("webhook_secret", secret)
    .single()

  if (!company) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 })
  }

  // Normalize phone
  const rawPhone = (body.phone as string) ?? ""
  if (!rawPhone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 })
  }
  const phone = formatPhone(rawPhone)

  // Upsert lead (idempotent on phone + company_id)
  const { data: existing } = await supabase
    .from("leads")
    .select("id, status")
    .eq("company_id", company.id)
    .eq("phone", phone)
    .maybeSingle()

  let leadId: string

  if (existing) {
    // Re-engage cold lead if they re-submit
    if (existing.status === "cold" || existing.status === "closed_lost") {
      await supabase
        .from("leads")
        .update({ status: "new", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    }
    leadId = existing.id
  } else {
    const { data: newLead, error } = await supabase
      .from("leads")
      .insert({
        company_id: company.id,
        phone,
        first_name: (body.first_name as string) ?? null,
        last_name: (body.last_name as string) ?? null,
        email: (body.email as string) ?? null,
        address: (body.address as string) ?? null,
        notes: (body.notes as string) ?? null,
        service_type: (body.service_type as string) ?? company.service_type ?? null,
        source: (body.source as "facebook" | "webhook" | "manual") ?? "webhook",
        source_form_id: (body.form_id as string) ?? null,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
        status: "new",
      })
      .select("id")
      .single()

    if (error || !newLead) {
      console.error("Failed to create lead:", error)
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
    }
    leadId = newLead.id
  }

  // Get company's Twilio number
  const { data: phoneNumber } = await supabase
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .single()

  if (!phoneNumber?.phone_number) {
    // No phone number provisioned yet — log and return success anyway
    console.warn(`Company ${company.id} has no active phone number — skipping SMS`)
    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: false })
  }

  try {
    // Run AI engine for initial outreach (null = new lead)
    const result = await processAndSave(leadId, company.id, null)

    if (result.response) {
      const msg = await sendSMS(phone, result.response, phoneNumber.phone_number)

      // Save the Twilio SID on the outbound message
      await supabase
        .from("conversations")
        .update({ twilio_sid: msg.sid })
        .eq("lead_id", leadId)
        .eq("direction", "outbound")
        .is("twilio_sid", null)
        .order("created_at", { ascending: false })
        .limit(1)

      // Update lead status to contacted
      await supabase
        .from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", leadId)

      // Schedule first no-reply follow-up (1 hour from now)
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      await supabase.from("sequences").insert({
        lead_id: leadId,
        company_id: company.id,
        sequence_type: "no_reply",
        step: 1,
        scheduled_at: oneHourFromNow,
        status: "pending",
      })
    }

    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: true })
  } catch (err) {
    console.error("AI engine / SMS error:", err)
    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: false })
  }
}
