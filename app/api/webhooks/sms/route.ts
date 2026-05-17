import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, validateTwilioSignature, formatPhone } from "@/lib/twilio"
import { notifyAppointmentBooked, notifyNeedsAttention } from "@/lib/notifications"
import { buildRepliedNotBookedSchedule } from "@/lib/sequences"
import { notifyTechnicianConfirmed } from "@/lib/appointment-reminders"

// ─── Confirmation reply detection ─────────────────────────────────────────────

function isConfirmation(msg: string): boolean {
  const s = msg.toLowerCase().trim()
  return /^(yes|y|yeah|yep|yup|confirmed|confirm|ok|okay|sure|sounds good|i.ll be there|will be there|i.m good|good|👍|✅|absolutely|definitely|for sure|i confirm|confirmed|great|perfect|works for me|that works|see you|see you then|i.ll be home|we.ll be there|we.ll be home)/.test(s)
}

function isCancellation(msg: string): boolean {
  const s = msg.toLowerCase().trim()
  return /^(no|cancel|nope|nah|won.t make it|can.t make it|need to cancel|please cancel|cancel my appointment|reschedule|i need to reschedule|need to reschedule|can we reschedule|rescheduling|change)/.test(s)
}

async function handleConfirmationReply(
  leadId: string,
  companyId: string,
  messageBody: string,
  leadPhone: string,
  fromNumber: string,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<boolean> {
  // Find the most recent appointment pending confirmation for this lead
  const { data: apt } = await supabase
    .from("appointments")
    .select("id, scheduled_at, technician_name, confirmation_status, confirmation_requested_at, leads(first_name)")
    .eq("lead_id", leadId)
    .eq("status", "scheduled")
    .not("confirmation_requested_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!apt) return false  // no pending confirmation — normal AI flow

  const { data: agentCfg } = await supabase
    .from("ai_agent_config")
    .select("timezone, agent_name")
    .eq("company_id", companyId)
    .single()

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single()

  const timezone  = agentCfg?.timezone  ?? "America/New_York"
  const agentName = agentCfg?.agent_name ?? company?.name ?? "us"
  const firstName = (apt.leads as { first_name: string | null } | null)?.first_name ?? null
  const techName  = apt.technician_name
  const timeLabel = new Date(apt.scheduled_at).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: timezone,
  })

  if (isConfirmation(messageBody)) {
    // Lead confirmed → update status, send follow-up SMS, notify technician
    await supabase.from("appointments").update({
      confirmation_status: "confirmed",
      confirmed_at: new Date().toISOString(),
    }).eq("id", apt.id)

    const techPart = techName ? ` ${techName}` : " our tech"
    const reply = `Perfect${firstName ? `, ${firstName}` : ""}! You're confirmed.${techPart} will be there ${timeLabel}. See you then!`

    const msg = await sendSMS(leadPhone, reply, fromNumber)
    await supabase.from("conversations").insert({
      lead_id:    leadId,
      company_id: companyId,
      direction:  "outbound",
      sent_by:    "reminder",
      body:       reply,
      twilio_sid: msg.sid,
      channel:    "sms",
    })

    // Notify technician
    notifyTechnicianConfirmed(apt.id).catch(() => {})
    return true
  }

  if (isCancellation(messageBody)) {
    // Check if they want to reschedule or fully cancel — let the AI handle this
    // Just update status to reschedule_requested so owner sees it
    await supabase.from("appointments").update({
      confirmation_status: "reschedule_requested",
    }).eq("id", apt.id)

    // Let AI engine handle the reschedule conversation naturally
    return false
  }

  // Response doesn't clearly confirm or cancel — let AI handle
  return false
}

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

  // ── Confirmation reply interception ───────────────────────────────────────
  // If this lead has a pending confirmation AND their message is a clear YES/NO,
  // handle it directly without burning an AI call.
  const wasConfirmationReply = await handleConfirmationReply(
    lead.id, companyId, messageBody, normalizedFrom, to, supabase
  ).catch(() => false)

  if (wasConfirmationReply) {
    // Still save the inbound message to conversations for CRM visibility
    await supabase.from("conversations").insert({
      lead_id:    lead.id,
      company_id: companyId,
      direction:  "inbound",
      sent_by:    "human",
      body:       messageBody,
      twilio_sid: twilioSid ?? null,
      channel:    "sms",
    }).catch(() => {})
    return twimlOk()
  }

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

    // Schedule replied-not-booked follow-up if not already booked.
    // Reset ALL steps on EVERY reply so timers always count from the latest message.
    if (result.action?.type !== "book_appointment") {
      // Cancel all existing pending replied_not_booked steps, then pre-create all 3 fresh
      await supabase
        .from("sequences")
        .update({ status: "cancelled" })
        .eq("lead_id", lead.id)
        .eq("sequence_type", "replied_not_booked")
        .eq("status", "pending")

      const steps = buildRepliedNotBookedSchedule(new Date())
      await supabase.from("sequences").insert(
        steps.map((s) => ({
          lead_id: lead.id,
          company_id: companyId,
          sequence_type: "replied_not_booked",
          step: s.step,
          scheduled_at: s.scheduledAt.toISOString(),
          status: "pending",
        }))
      )
    } else {
      // Appointment booked — cancel all pending sequences
      await supabase
        .from("sequences")
        .update({ status: "cancelled" })
        .eq("lead_id", lead.id)
        .eq("status", "pending")

      // Send confirmation email + SMS to lead
      const { sendConfirmations } = await import("@/lib/appointment-reminders")
      const { data: bookedApt } = await supabase
        .from("appointments")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("status", "scheduled")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      if (bookedApt) {
        sendConfirmations(bookedApt.id).catch(() => {})
      }

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
