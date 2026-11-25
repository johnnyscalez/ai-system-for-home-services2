import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave, inferJobType } from "@/lib/ai-engine"
import { sendSMS, validateTwilioSignature, formatPhone } from "@/lib/twilio"
import { notifyAppointmentBooked, notifyNeedsAttention, notifyNewLead } from "@/lib/notifications"
import { reseedRepliedNotBooked } from "@/lib/sequences"
import { notifyTechnicianConfirmed } from "@/lib/appointment-reminders"
import { HOLDING_REPLY } from "@/lib/service-copy"

// ─── Address extraction ────────────────────────────────────────────────────────

const STREET_SUFFIX =
  "(?:street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|court|ct|place|pl|way|" +
  "circle|cir|terrace|ter|parkway|pkwy|highway|hwy|trail|trl|loop|run|pike|bend|ridge|" +
  "hollow|grove|woods|meadow|heights|hills|park)"

const STREET_RE = new RegExp(
  // house number + optional direction + 1-5 name words + street type
  // + optional unit + optional city + optional state abbrev + optional zip
  `\\b(\\d{1,6}\\s+(?:[nsewNSEW]\\.?\\s+)?(?:[a-z0-9]+\\s+){1,5}${STREET_SUFFIX}\\.?` +
  `(?:\\s*(?:apt|apartment|suite|ste|unit|#)\\.?\\s*[\\w-]+)?` +
  `(?:\\s*,?\\s*[a-z][a-z .]{1,30})?(?:\\s*,?\\s*[a-z]{2})?(?:\\s*,?\\s*\\d{5}(?:-\\d{4})?)?)`,
  "i"
)

function extractStreetAddress(text: string): string | null {
  const m = text.match(STREET_RE)
  return m ? m[1].trim().replace(/[,\s]+$/, "") : null
}

// ─── Confirmation reply detection ─────────────────────────────────────────────

// Anything suggesting the lead wants something DIFFERENT — a question, a time
// change, a condition — must fall through to the AI, never auto-confirm.
// The old prefix-only matcher confirmed "ok, actually can we move it to 2pm?"
// and treated "no problem, see you then!" as a cancellation (live-reproduced).
const COUNTER_SIGNALS = /\?|actually|instead|but |however|move|change|different|another|resched|earlier|later|can we|could we|what time|which time|not sure|maybe|except/i

function isConfirmation(msg: string): boolean {
  const s = msg.toLowerCase().trim()
  if (COUNTER_SIGNALS.test(s)) return false
  // Whole-message match (with optional trailing punctuation/pleasantries), not prefix
  return /^(yes|y|yeah|yep|yup|si|sí|confirmed|confirm|ok|okay|okey|sure|sounds good|good|great|perfect|absolutely|definitely|for sure|i confirm|works for me|that works|see you|see you then|see you there|i.ll be there|will be there|we.ll be there|i.ll be home|we.ll be home|i.m good|👍|✅)[\s.!,🙂😊👍✅]*(thanks?|thank you|ty)?[\s.!]*$/.test(s)
}

function isCancellation(msg: string): boolean {
  const s = msg.toLowerCase().trim()
  // "no" only as a standalone answer — "no problem/no worries" are CONFIRMATIONS in spirit
  if (/^no[.!\s]*$/.test(s)) return true
  if (/^(no problem|no worries)/.test(s)) return false
  return /^(cancel|nope|nah|won.?t make it|can.?t make it|cannot make it|need to cancel|please cancel|cancel my appointment|i need to reschedule|need to reschedule|can we reschedule|rescheduling|reschedule)\b/.test(s)
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
    .select("id, scheduled_at, confirmation_status, confirmation_requested_at, address, leads(first_name)")
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

  const { serviceTimeZone } = await import("@/lib/timezones")
  const timezone  = serviceTimeZone((apt as { address?: string | null }).address ?? null, agentCfg?.timezone ?? "America/New_York")
  const agentName = agentCfg?.agent_name ?? company?.name ?? "us"
  const firstName = (apt.leads as unknown as { first_name: string | null } | null)?.first_name ?? null
  const timeLabel = new Date(apt.scheduled_at).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: timezone,
  })

  if (isConfirmation(messageBody)) {
    // Lead confirmed → update status, send follow-up SMS, notify whoever runs the visit
    await supabase.from("appointments").update({
      confirmation_status: "confirmed",
      confirmed_at: new Date().toISOString(),
    }).eq("id", apt.id)

    // Written in code, so it must be right for every trade: no "technician".
    const reply = `Thanks${firstName ? `, ${firstName}` : ""}. You're confirmed for ${timeLabel}. See you then.`

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

  // Validate Twilio signature whenever the auth token is available (all deployed envs, not just production)
  if (process.env.TWILIO_AUTH_TOKEN) {
    const signature = req.headers.get("x-twilio-signature") ?? ""
    const url = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") + "/api/webhooks/sms"
    if (!validateTwilioSignature(signature, url, params)) {
      console.warn("Twilio signature validation failed — possible spoofed request")
      return new NextResponse("Forbidden", { status: 403 })
    }
  }

  // SMS only. WhatsApp was removed from the product: a "whatsapp:" sender left
  // attached to a number in Twilio must not be mistaken for a phone number.
  const rawFrom = params["From"] ?? ""
  if (rawFrom.startsWith("whatsapp:")) {
    console.warn("[webhook/sms] ignoring WhatsApp traffic, the channel is not supported")
    return twimlOk()
  }
  const channel = "sms" as const
  const from = rawFrom
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

  // Find or create the lead by phone number — excludes soft-deleted leads
  // so someone who was deleted gets treated as a fresh inbound contact if
  // they text in again, instead of silently resurrecting the old record
  // (see app/api/webhooks/lead/route.ts for the full reasoning)
  let { data: lead } = await supabase
    .from("leads")
    .select("id, status, ai_paused, first_name, last_name")
    .eq("company_id", companyId)
    .eq("phone", normalizedFrom)
    .is("deleted_at", null)
    .maybeSingle()

  if (!lead) {
    // Unknown number — create a new lead (organic inbound)
    const { data: newLead } = await supabase
      .from("leads")
      .insert({
        company_id: companyId,
        phone: normalizedFrom,
        source: "sms_inbound",
        channel,
        status: "new",
        metadata: { inbound_first_message: messageBody },
        job_type: inferJobType(messageBody ?? ""),
      })
      .select("id, status, ai_paused, first_name, last_name")
      .single()

    lead = newLead
    // Someone texted the number out of the blue: that is a new lead too.
    if (newLead) notifyNewLead(companyId, "", normalizedFrom, "sms", newLead.id).catch(() => {})
  }

  if (!lead) return twimlOk()

  // ── Confirmation replies OUTRANK opt-out ──────────────────────────────────
  // Our own confirmation SMS says "Reply RESCHEDULE or CANCEL if needed" — a
  // "Cancel" from a booked lead means CANCEL THE APPOINTMENT, not opt out.
  // The opt-out regex hijacked it: lead silently closed while the tech still
  // got dispatched (adversarial finding 4). The interceptor only acts when a
  // pending confirmation exists, so ordering it first is safe.
  const wasConfirmationReply = await handleConfirmationReply(
    lead.id, companyId, messageBody, normalizedFrom, to, supabase
  ).catch(() => false)

  // ── Deterministic opt-out — BEFORE any AI involvement (audit C8) ──────────
  // Twilio already blocks our sends after a carrier-level STOP; our job is to
  // kill every scheduled touch so nothing even attempts to fire. No goodbye
  // reply: answering a hard STOP is itself a compliance risk. Bare "cancel",
  // "end", "quit" are deliberately NOT here — they collide with appointment
  // language; the carrier and the AI's own opt-out rules cover those.
  const OPT_OUT_RE = /^\s*(stop|stopall|stop all|unsubscribe|opt ?out|remove me|quit texting( me)?|do not (text|contact|message) me|don'?t (text|contact|message) me)\s*[.!]*\s*$/i
  if (!wasConfirmationReply && OPT_OUT_RE.test(messageBody)) {
    await supabase.from("conversations").insert({
      lead_id: lead.id, company_id: companyId, direction: "inbound",
      sent_by: "human", body: messageBody, twilio_sid: twilioSid ?? null, channel,
    }).then(() => {}, () => {})
    // Remember where they were, so a later START puts them back there.
    const { data: before } = await supabase.from("leads").select("status, metadata").eq("id", lead.id).maybeSingle()
    const beforeMeta = ((before?.metadata ?? {}) as Record<string, unknown>) ?? {}
    await supabase.from("leads")
      .update({
        status: "closed_lost", ai_paused: true, last_message_at: new Date().toISOString(),
        metadata: { ...beforeMeta, opted_out_at: new Date().toISOString(), status_before_opt_out: before?.status ?? null },
      })
      .eq("id", lead.id)
    await supabase.from("sequences").update({ status: "cancelled" })
      .eq("lead_id", lead.id).eq("status", "pending")
    await supabase.from("scheduled_calls").update({ status: "cancelled" })
      .eq("lead_id", lead.id).eq("status", "pending")
    console.log(`[webhook/sms] opt-out from lead ${lead.id} — all outreach cancelled, AI paused`)
    return twimlOk()
  }

  // Opt back in: START / UNSTOP after a STOP. The carrier re-subscribes them on
  // its side; mirror it here so the lead is not stuck silent in the CRM forever.
  const OPT_IN_RE = /^\s*(start|unstop)\s*[.!]*\s*$/i
  if (!wasConfirmationReply && OPT_IN_RE.test(messageBody)) {
    await supabase.from("conversations").insert({
      lead_id: lead.id, company_id: companyId, direction: "inbound",
      sent_by: "human", body: messageBody, twilio_sid: twilioSid ?? null, channel,
    }).then(() => {}, () => {})
    // Back to the stage they were in before the STOP (a booked or quoted lead
    // stays booked or quoted). Follow-ups are NOT restarted on their own: they
    // opted back in to texts, not to a sequence; the AI answers their next message.
    const { data: cur } = await supabase.from("leads").select("metadata").eq("id", lead.id).maybeSingle()
    const curMeta = ((cur?.metadata ?? {}) as Record<string, unknown>) ?? {}
    const prior = typeof curMeta.status_before_opt_out === "string" ? curMeta.status_before_opt_out : null
    const restore = prior && !["closed_lost", "lost", "new", "just_came_in", "contacted"].includes(prior) ? prior : "active_conversation"
    await supabase.from("leads")
      .update({
        status: restore, ai_paused: false, last_message_at: new Date().toISOString(), last_inbound_at: new Date().toISOString(),
        metadata: { ...curMeta, opted_in_again_at: new Date().toISOString() },
      })
      .eq("id", lead.id)
    console.log(`[webhook/sms] opt-in from lead ${lead.id}, AI resumed`)
    return twimlOk()
  }

  // AI paused (a person took over the thread): the AI stays silent, but the
  // customer's message must still land in the CRM. Returning before the insert
  // made every reply after a manual send vanish (the owner texts, the customer
  // answers, the thread shows nothing).
  if (lead.ai_paused) {
    if (!wasConfirmationReply) {
      await supabase.from("conversations").insert({
        lead_id: lead.id, company_id: companyId, direction: "inbound",
        sent_by: "human", body: messageBody, twilio_sid: twilioSid ?? null, channel,
      }).then(() => {}, () => {})
      await supabase.from("leads")
        .update({ last_message_at: new Date().toISOString(), last_inbound_at: new Date().toISOString() })
        .eq("id", lead.id)
    }
    return twimlOk()
  }

  // Mark this lead as actively replying
  await supabase
    .from("leads")
    .update({ last_inbound_at: new Date().toISOString(), is_active_conversation: true, channel })
    .eq("id", lead.id)

  if (wasConfirmationReply) {
    // Still save the inbound message to conversations for CRM visibility
    try {
      await supabase.from("conversations").insert({
        lead_id:    lead.id,
        company_id: companyId,
        direction:  "inbound",
        sent_by:    "human",
        body:       messageBody,
        twilio_sid: twilioSid ?? null,
        channel,
      })
    } catch { /* non-critical */ }
    return twimlOk()
  }

  try {
    {
      const { officeCoversNowForCompany } = await import("@/lib/office-hours")
      if (await officeCoversNowForCompany(companyId)) {
        await supabase.from("conversations").insert({
          lead_id: lead.id, company_id: companyId,
          direction: "inbound", sent_by: "human", body: messageBody, channel: "sms", twilio_sid: twilioSid,
        })
        await supabase.from("leads").update({ last_message_at: new Date().toISOString(), last_inbound_at: new Date().toISOString() }).eq("id", lead.id)
        console.log(`[webhook/sms] office hours — inbound stored for lead ${lead.id}, agent off duty`)
        return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } })
      }
    }
    const result = await processAndSave(lead.id, companyId, messageBody, twilioSid)

    if (result.response) {
      try {
        const msg = await sendSMS(normalizedFrom, result.response, to)
        if (result.outboundConversationId) {
          await supabase
            .from("conversations")
            .update({ twilio_sid: msg.sid })
            .eq("id", result.outboundConversationId)
        }
      } catch (sendErr) {
        // The reply was generated and saved but the carrier/Twilio refused it.
        // Mark the row so the CRM shows "Not delivered" with the reason instead
        // of a message that looks sent. Never fall into the engine-crash path:
        // a second canned text would fail the same way.
        const code = (sendErr as { code?: number })?.code
        console.error(`[webhook/sms] reply to lead ${lead.id} was not accepted by Twilio (code ${code ?? "?"}):`, sendErr)
        if (result.outboundConversationId) {
          await supabase
            .from("conversations")
            .update({ delivery_status: "failed", delivery_error_code: code ? String(code) : null })
            .eq("id", result.outboundConversationId)
        }
        if (code === 21610) {
          // Opted out at the carrier: stop everything for this lead.
          await supabase.from("leads").update({ status: "closed_lost", ai_paused: true }).eq("id", lead.id)
          await supabase.from("sequences").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "pending")
        }
      }
    }

    // If the lead mentioned their address in this message, save it immediately
    // (don't wait for appointment booking). The .is("address", null) guard means
    // we never overwrite an address that's already stored.
    const detectedAddress = extractStreetAddress(messageBody)
    if (detectedAddress) {
      await supabase
        .from("leads")
        .update({ address: detectedAddress })
        .eq("id", lead.id)
        .is("address", null)
    }

    // Same for email — the moment they share it, it's on file and the AI
    // stops asking (the contact-file block marks it ✓ next turn)
    const detectedEmail = messageBody.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
    if (detectedEmail) {
      await supabase
        .from("leads")
        .update({ email: detectedEmail.toLowerCase() })
        .eq("id", lead.id)
        .is("email", null)
    }

    // Post-reply sequence bookkeeping — shared implementation (lib/sequences)
    await reseedRepliedNotBooked(supabase, lead.id, companyId, result.action as { type?: string; status?: string } | undefined)

    // Confirmation SMS + email and the contractor notification fire ONLY on
    // the turn an appointment was actually booked (or moved) — keyed off this
    // turn's action, NOT off the lead's status. Keying off status made every
    // later message from a booked lead ("thanks!") re-send the confirmation
    // SMS + email and re-notify the contractor, because status stays
    // "appointment_booked" forever.
    if ((result.action?.type === "book_appointment" && result.action.outcome !== "noop") || result.action?.type === "reschedule_appointment") {
      const { sendConfirmations } = await import("@/lib/appointment-reminders")
      const { data: bookedApt } = await supabase
        .from("appointments")
        .select("id, scheduled_at, address")
        .eq("lead_id", lead.id)
        .eq("status", "scheduled")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      if (bookedApt) {
        sendConfirmations(bookedApt.id).catch(() => {})

        // Notify contractor
        const { data: leadData } = await supabase
          .from("leads")
          .select("first_name, last_name, phone")
          .eq("id", lead.id)
          .single()
        if (leadData) {
          const name = `${leadData.first_name ?? ""} ${leadData.last_name ?? ""}`.trim() || leadData.phone
          const moved = result.action?.type === "reschedule_appointment" ||
            (result.action?.type === "book_appointment" && result.action.outcome === "moved")
          notifyAppointmentBooked(companyId, name, bookedApt.scheduled_at, bookedApt.address ?? "", moved, lead.id).catch(() => {})
        }
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
        notifyNeedsAttention(companyId, name, leadData.phone, lead.id).catch(() => {})
      }
    }
  } catch (err) {
    console.error("SMS conversation engine error:", err)
    // The engine crashed. The lead must not get silence, and must not get a line
    // that belongs to another trade or promises something nobody will do. Send
    // the holding reply and hand the thread to a person, loudly.
    try {
      const msg = await sendSMS(normalizedFrom, HOLDING_REPLY, to)
      await supabase.from("conversations").insert({
        lead_id:    lead.id,
        company_id: companyId,
        direction:  "outbound",
        sent_by:    "ai",
        body:       HOLDING_REPLY,
        twilio_sid: msg.sid,
        channel,
      })
    } catch { /* absolute last resort — ignore */ }
    try {
      await supabase.from("leads").update({ status: "needs_attention" }).eq("id", lead.id)
        .not("status", "in", "(appointment_booked,closed_won,closed,measure_done,quote_sent)")
      const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || normalizedFrom
      notifyNeedsAttention(companyId, `${name}: the assistant could not reply, please text them back`, normalizedFrom, lead.id).catch(() => {})
    } catch { /* best effort */ }
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
