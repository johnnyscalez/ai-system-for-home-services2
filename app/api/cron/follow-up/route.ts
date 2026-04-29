import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, getTwilioClient } from "@/lib/twilio"

// Called by Vercel Cron every 5 minutes.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // ── Clear stale "active conversation" flags (> 2 hours since last inbound) ──
  await supabase
    .from("leads")
    .update({ is_active_conversation: false })
    .eq("is_active_conversation", true)
    .lt("last_inbound_at", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())

  // ── Process pending sequence steps ─────────────────────────────────────────
  const { data: dueSteps } = await supabase
    .from("sequences")
    .select("*, leads(id, phone, status, ai_paused, first_name, last_name, service_type)")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .limit(50)

  let processed = 0

  for (const step of dueSteps ?? []) {
    const lead = step.leads as {
      id: string; phone: string; status: string; ai_paused: boolean;
      first_name: string | null; last_name: string | null; service_type: string | null;
    } | null

    if (!lead) continue

    // Skip finished leads
    if (
      lead.ai_paused ||
      lead.status === "appointment_booked" ||
      lead.status === "closed_won" ||
      lead.status === "closed_lost"
    ) {
      await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      continue
    }

    const { data: phoneRecord } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("company_id", step.company_id)
      .eq("is_active", true)
      .single()

    if (!phoneRecord?.phone_number) {
      await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      continue
    }

    // Decide: SMS or voice call for this step?
    const useVoice = isVoiceStep(step.sequence_type, step.step)

    // Gate outbound voice calls to working hours — never call at 2 AM.
    // SMS always goes through (that's the whole value prop).
    if (useVoice) {
      const { data: agentCfg } = await supabase
        .from("ai_agent_config")
        .select("working_hours_start, working_hours_end, timezone")
        .eq("company_id", step.company_id)
        .single()

      const tz = agentCfg?.timezone ?? "America/New_York"
      const hourNow = parseInt(
        new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }),
        10
      )
      const start = agentCfg?.working_hours_start ?? 8
      const end   = agentCfg?.working_hours_end   ?? 20

      if (hourNow < start || hourNow >= end) {
        // Outside working hours — leave the step pending, cron will retry
        continue
      }
    }

    try {
      if (useVoice) {
        // Fire an outbound voice call using the follow-up agent
        const twilio = getTwilioClient()
        await twilio.calls.create({
          to: lead.phone,
          from: phoneRecord.phone_number,
          url: `${appUrl}/api/voice/inbound?leadId=${lead.id}&companyId=${step.company_id}&direction=outbound&isFollowUp=true`,
          statusCallback: `${appUrl}/api/voice/status`,
          statusCallbackMethod: "POST",
          statusCallbackEvent: ["completed", "failed", "no-answer", "busy"],
          machineDetection: "DetectMessageEnd",
          asyncAmdStatusCallback: `${appUrl}/api/voice/amd?leadId=${lead.id}`,
        })
      } else {
        // Send a follow-up SMS via AI engine
        const result = await processAndSave(lead.id, step.company_id, null)

        if (result.response) {
          const msg = await sendSMS(lead.phone, result.response, phoneRecord.phone_number)
          if (result.outboundConversationId) {
            await supabase
              .from("conversations")
              .update({ twilio_sid: msg.sid })
              .eq("id", result.outboundConversationId)
          }
        }
      }

      // Mark step sent
      await supabase
        .from("sequences")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("id", step.id)

      // Move lead into "followed_up" stage (unless they're already further along)
      await supabase
        .from("leads")
        .update({ status: "followed_up", last_message_at: now.toISOString() })
        .eq("id", lead.id)
        .in("status", ["new", "contacted", "nurturing", "followed_up"])

      // Schedule next step
      const nextStep = getNextStep(step.sequence_type, step.step)
      if (nextStep) {
        const nextAt = new Date(now.getTime() + nextStep.delayMs)
        await supabase.from("sequences").insert({
          lead_id: lead.id,
          company_id: step.company_id,
          sequence_type: step.sequence_type,
          step: nextStep.step,
          scheduled_at: nextAt.toISOString(),
          status: "pending",
        })
      } else {
        // Sequence exhausted — mark cold
        await supabase
          .from("leads")
          .update({ status: "cold" })
          .eq("id", lead.id)
          .in("status", ["new", "contacted", "nurturing", "followed_up"])
      }

      processed++
    } catch (err) {
      console.error(`Failed to process sequence step ${step.id}:`, err)
    }
  }

  // ── Process scheduled voice callbacks (lead-requested callbacks) ────────────
  const { data: dueCalls } = await supabase
    .from("scheduled_calls")
    .select("*, leads(id, phone, status, ai_paused, company_id)")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .limit(20)

  let callsProcessed = 0

  for (const call of dueCalls ?? []) {
    const lead = call.leads as {
      id: string; phone: string; status: string; ai_paused: boolean; company_id: string
    } | null

    if (!lead) continue

    if (lead.ai_paused || ["closed_won", "closed_lost"].includes(lead.status)) {
      await supabase.from("scheduled_calls").update({ status: "cancelled" }).eq("id", call.id)
      continue
    }

    const { data: phoneRecord } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("company_id", call.company_id)
      .eq("is_active", true)
      .single()

    if (!phoneRecord?.phone_number) {
      await supabase.from("scheduled_calls").update({ status: "failed" }).eq("id", call.id)
      continue
    }

    try {
      const twilio = getTwilioClient()
      const reasonParam = call.reason ? `&callbackReason=${encodeURIComponent(call.reason)}` : ""

      const twilioCall = await twilio.calls.create({
        to: lead.phone,
        from: phoneRecord.phone_number,
        url: `${appUrl}/api/voice/inbound?leadId=${lead.id}&companyId=${call.company_id}&direction=outbound${reasonParam}`,
        statusCallback: `${appUrl}/api/voice/status`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["completed", "failed", "no-answer", "busy"],
        machineDetection: "DetectMessageEnd",
        asyncAmdStatusCallback: `${appUrl}/api/voice/amd?leadId=${lead.id}`,
      })

      await supabase.from("scheduled_calls").update({
        status: "completed",
        call_sid: twilioCall.sid,
        completed_at: now.toISOString(),
      }).eq("id", call.id)

      callsProcessed++
    } catch (err) {
      console.error(`Failed to fire scheduled call ${call.id}:`, err)
      await supabase.from("scheduled_calls").update({ status: "failed" }).eq("id", call.id)
    }
  }

  return NextResponse.json({ processed, callsProcessed })
}

// Steps that use a voice call instead of SMS
// no_reply: step 2 (24h) and step 4 (7d) → voice
// replied_not_booked: step 2 (48h) → voice
function isVoiceStep(sequenceType: string, step: number): boolean {
  if (sequenceType === "no_reply" && (step === 2 || step === 4)) return true
  if (sequenceType === "replied_not_booked" && step === 2) return true
  return false
}

type SequenceType = "no_reply" | "replied_not_booked"

const SEQUENCES: Record<SequenceType, { step: number; delayMs: number }[]> = {
  no_reply: [
    { step: 1, delayMs: 60 * 60 * 1000 },              // 1h  → SMS
    { step: 2, delayMs: 24 * 60 * 60 * 1000 },         // 24h → Voice call
    { step: 3, delayMs: 72 * 60 * 60 * 1000 },         // 72h → SMS
    { step: 4, delayMs: 7 * 24 * 60 * 60 * 1000 },     // 7d  → Voice call (last attempt)
  ],
  replied_not_booked: [
    { step: 1, delayMs: 4 * 60 * 60 * 1000 },          // 4h  → SMS
    { step: 2, delayMs: 48 * 60 * 60 * 1000 },         // 48h → Voice call
    { step: 3, delayMs: 5 * 24 * 60 * 60 * 1000 },     // 5d  → SMS (final)
  ],
}

function getNextStep(
  sequenceType: string,
  currentStep: number
): { step: number; delayMs: number } | null {
  const seq = SEQUENCES[sequenceType as SequenceType]
  if (!seq) return null
  return seq.find((s) => s.step === currentStep + 1) ?? null
}
