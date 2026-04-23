import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, validateTwilioSignature, formatPhone } from "@/lib/twilio"

// Twilio sends POST with form-encoded body to this endpoint.
// Configure this URL in Twilio console under the phone number's "A message comes in" webhook.
export async function POST(req: NextRequest) {
  // Validate Twilio signature in production
  if (process.env.NODE_ENV === "production") {
    const signature = req.headers.get("x-twilio-signature") ?? ""
    const url = process.env.NEXT_PUBLIC_APP_URL + "/api/webhooks/sms"
    const body = await req.formData()
    const params: Record<string, string> = {}
    body.forEach((value, key) => { params[key] = value.toString() })
    if (!validateTwilioSignature(signature, url, params)) {
      return new NextResponse("Forbidden", { status: 403 })
    }
  }

  // Parse Twilio's form-encoded body
  const formData = await req.formData().catch(() => null)
  if (!formData) return twimlOk()

  const from = formData.get("From")?.toString() ?? ""
  const to = formData.get("To")?.toString() ?? ""
  const messageBody = formData.get("Body")?.toString()?.trim() ?? ""
  const twilioSid = formData.get("MessageSid")?.toString() ?? undefined

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
    .select("id, status, ai_paused")
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
      .select("id, status, ai_paused")
      .single()

    lead = newLead
  }

  if (!lead) return twimlOk()

  // If AI is paused for this lead, skip
  if (lead.ai_paused) return twimlOk()

  // Don't respond to leads that are already done
  if (lead.status === "closed_won" || lead.status === "closed_lost") {
    return twimlOk()
  }

  try {
    const result = await processAndSave(lead.id, companyId, messageBody, twilioSid)

    if (result.response) {
      const msg = await sendSMS(normalizedFrom, result.response, to)

      // Update Twilio SID on the just-inserted outbound message
      await supabase
        .from("conversations")
        .update({ twilio_sid: msg.sid })
        .eq("lead_id", lead.id)
        .eq("direction", "outbound")
        .is("twilio_sid", null)
        .order("created_at", { ascending: false })
        .limit(1)
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
