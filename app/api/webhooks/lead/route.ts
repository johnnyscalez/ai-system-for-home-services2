import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, formatPhone } from "@/lib/twilio"
import { notifyNewLead } from "@/lib/notifications"
import { normalizeLead } from "@/lib/normalize-lead"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Accepts lead data from Facebook Lead Ads, Google Ads, or any webhook source.
// Caller must include the company's webhook_secret in the x-webhook-secret header.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret")
  if (!secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 401, headers: CORS_HEADERS })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS })
  }

  const supabase = createServiceRoleClient()

  // Look up company by webhook_secret
  const { data: company } = await supabase
    .from("companies")
    .select("id, service_type")
    .eq("webhook_secret", secret)
    .single()

  if (!company) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401, headers: CORS_HEADERS })
  }

  // Normalize any field format into our standard shape
  const lead = normalizeLead(body)

  if (!lead.phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400, headers: CORS_HEADERS })
  }
  const phone = formatPhone(lead.phone)

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
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        address: lead.address,
        notes: lead.notes,
        service_type: lead.service_type ?? company.service_type ?? null,
        source: (body.source as "facebook" | "webhook" | "manual") ?? "webhook",
        source_form_id: lead.source_form_id,
        metadata: lead.metadata,
        status: "new",
      })
      .select("id")
      .single()

    if (error || !newLead) {
      console.error("Failed to create lead:", error)
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500, headers: CORS_HEADERS })
    }
    leadId = newLead.id

    // Notify contractor of new lead (non-blocking)
    const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
    notifyNewLead(company.id, leadName, phone, (body.source as string) ?? "webhook").catch(() => {})
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
    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: false }, { headers: CORS_HEADERS })
  }

  try {
    // Run AI engine for initial outreach (null = new lead)
    const result = await processAndSave(leadId, company.id, null)

    if (result.response) {
      const msg = await sendSMS(phone, result.response, phoneNumber.phone_number)
      if (result.outboundConversationId) {
        await supabase
          .from("conversations")
          .update({ twilio_sid: msg.sid })
          .eq("id", result.outboundConversationId)
      }

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

    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: true }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error("AI engine / SMS error:", err)
    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: false }, { headers: CORS_HEADERS })
  }
}
