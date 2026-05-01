import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, validateTwilioSignature, formatPhone } from "@/lib/twilio"
import { notifyAppointmentBooked, notifyNeedsAttention } from "@/lib/notifications"

// Twilio sends POST with form-encoded body to this endpoint.
// Configure this URL in Twilio console under the phone number's "A message comes in" webhook.
export async function POST(req: NextRequest) {
  // Parse body first — can only read the stream once
  const formData = await req.formData().catch(() => null)
  if (!formData) return twimlOk()

  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })

  // Validate Twilio signature in production using the already-parsed params
  if (process.env.NODE_ENV === "production") {
    const signature = req.headers.get("x-twilio-signature") ?? ""
    const url = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") + "/api/webhooks/sms"
    if (!validateTwilioSignature(signature, url, params)) {
      console.warn("Twilio signature validation failed — possible spoofed request")
      return new NextResponse("Forbidden", { status: 403 })
    }
  }

  const from = params["From"] ?? ""
  const to = params["To"] ?? ""
  const messageBody = params["Body"]?.trim() ?? ""
  const twilioSid = params["MessageSid"] ?? undefined

  if (!from || !to || !messageBody) return twimlOk()

  const supabase = createServiceRoleClient()

  // Look up company by their Twilio number (the "To" field)
  const { data: phoneRecord } = await supabase
    .from("phone_numbers")
    .select("company_id")
    .eq("phone_number", to)
    .eq("is_active", true)
    .single()

  if (!phoneRecord?.company_id) {
    console.warn(`Incoming SMS to unknown number: ${to}`)
    return twimlOk()
  }

  const companyId = phoneRecord.company_id
  const normalizedFrom = formatPhone(from)

  // Find or create the lead by phone number
  let { data: lead } = await supabase
    .from("leads")
    .select("id, status, ai_paused, first_name, last_name")
    .eq("company_id", companyId)
    .eq("phone", normalizedFrom)
    .maybeSingle()

  if (!lead) {
    // Unknown number — create a new lead (organic inbound)
    const { data: newLead } = await supabase
      .from("leads")
      .insert({
        company_id: companyId,
        phone: normalizedFrom,
        source: "webhook",
        status: "new",
        metadata: { inbound_first_message: messageBody },
      })
      .select("id, status, ai_paused, first_name, last_name")
      .single()

    lead = newLead
  }

  if (!lead) return twimlOk()

  // If AI is paused for this lead, skip
  if (lead.ai_paused) return twimlOk()

  // Don't respond to leads that are already done
  if (["closed", "closed_won", "closed_lost", "lost", "unqualified"].includes(lead.status)) {
    return twimlOk()
  }

  // Mark this lead as actively replying
  await supabase
    .from("leads")
    .update({ last_inbound_at: new Date().toISOString(), is_active_conversation: true })
    .eq("id", lead.id)

  try {
    const result = await processAndSave(lead.id, companyId, messageBody, twilioSid)

    if (result.response) {
      const msg = await sendSMS(normalizedFrom, result.response, to)
      if (result.outboundConversationId) {
        await supabase
          .from("conversations")
          .update({ twilio_sid: msg.sid })
          .eq("id", result.outboundConversationId)
      }
    }

    // Cancel any pending no-reply sequences since they replied
    await supabase
      .from("sequences")
      .update({ status: "cancelled" })
      .eq("lead_id", lead.id)
      .eq("sequence_type", "no_reply")
      .eq("status", "pending")

    // Schedule replied-not-booked follow-up if not already booked
    if (result.action?.type !== "book_appointment") {
      const { data: existing } = await supabase
        .from("sequences")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("sequence_type", "replied_not_booked")
        .eq("status", "pending")
        .maybeSingle()

      if (!existing) {
        const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        await supabase.from("sequences").insert({
          lead_id: lead.id,
          company_id: companyId,
          sequence_type: "replied_not_booked",
          step: 1,
          scheduled_at: fourHoursFromNow,
          status: "pending",
        })
      }
    } else {
      // Appointment booked — cancel all pending sequences
      await supabase
        .from("sequences")
        .update({ status: "cancelled" })
        .eq("lead_id", lead.id)
        .eq("status", "pending")

      // Notify contractor
      const { data: leadData } = await supabase
        .from("leads")
        .select("first_name, last_name, phone")
        .eq("id", lead.id)
        .single()
      const { data: apt } = await supabase
        .from("appointments")
        .select("scheduled_at, address")
        .eq("lead_id", lead.id)
        .eq("status", "scheduled")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      if (leadData && apt) {
        const name = `${leadData.first_name ?? ""} ${leadData.last_name ?? ""}`.trim() || leadData.phone
        notifyAppointmentBooked(companyId, name, apt.scheduled_at, apt.address ?? "").catch(() => {})
      }
    }

    if (result.action?.type === "update_status" && result.action.status === "needs_attention") {
      const { data: leadData } = await supabase
        .from("leads")
        .select("first_name, last_name, phone")
        .eq("id", lead.id)
        .single()
      if (leadData) {
        const name = `${leadData.first_name ?? ""} ${leadData.last_name ?? ""}`.trim() || leadData.phone
        notifyNeedsAttention(companyId, name, leadData.phone).catch(() => {})
      }
    }
  } catch (err) {
    console.error("SMS conversation engine error:", err)
  }

  return twimlOk()
}

// Twilio expects a 200 with TwiML or empty response
function twimlOk() {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}
