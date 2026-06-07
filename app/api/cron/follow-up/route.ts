import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, getTwilioClient } from "@/lib/twilio"
import { isVoiceStep, LAST_STEP, FOLLOW_UP_ANGLE } from "@/lib/sequences"

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
    .select("*, leads(id, phone, status, ai_paused, ai_voice_paused, first_name, last_name, service_type)")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })  // oldest-first so no step is skipped
    .limit(50)

  let processed = 0

  for (const step of dueSteps ?? []) {
    const lead = step.leads as {
      id: string; phone: string; status: string; ai_paused: boolean; ai_voice_paused: boolean;
      first_name: string | null; last_name: string | null; service_type: string | null;
    } | null

    if (!lead) continue

    const stepIsVoice = isVoiceStep(step.sequence_type, step.step)

    // Cancel steps for terminal leads
    if (
      lead.status === "appointment_booked" ||
      lead.status === "closed_won" ||
      lead.status === "closed_lost"
    ) {
      await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      continue
    }

    // SMS AI paused — cancel SMS sequence steps (human has taken over)
    if (!stepIsVoice && lead.ai_paused) {
      await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      continue
    }

    // Voice AI paused — skip (leave pending) so the step fires when voice AI is re-enabled
    if (stepIsVoice && lead.ai_voice_paused) {
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

    // ── SMS retry: re-send the exact failed message body (no AI needed) ─────────
    if (step.sequence_type === "sms_retry") {
      const meta = step.metadata as { failed_body?: string } | null
      const retryBody = meta?.failed_body
      if (!retryBody) {
        await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
        continue
      }
      try {
        const msg = await sendSMS(lead.phone, retryBody, phoneRecord.phone_number)
        // Save the retried outbound to conversations
        await supabase.from("conversations").insert({
          lead_id:       lead.id,
          company_id:    step.company_id,
          direction:     "outbound",
          sent_by:       "ai",
          body:          retryBody,
          twilio_sid:    msg.sid,
          channel:       "sms",
        })
        await supabase.from("sequences").update({ status: "sent", sent_at: now.toISOString() }).eq("id", step.id)
        processed++
      } catch (err) {
        console.error(`[cron] SMS retry failed for lead ${lead.id}:`, err)
        await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      }
      continue
    }

    const angleKey = `${step.sequence_type}:${step.step}`
    const followUpAngle = FOLLOW_UP_ANGLE[angleKey]

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
        // Send a follow-up SMS via AI engine with per-step angle
        const result = await processAndSave(lead.id, step.company_id, null, undefined, followUpAngle)

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

      const lastStep = LAST_STEP[step.sequence_type] ?? 0
      if (step.step >= lastStep) {
        // Last step exhausted — mark lead as lost
        await supabase
          .from("leads")
          .update({ status: "lost" })
          .eq("id", lead.id)
          .in("status", ["just_came_in", "new", "contacted", "following_up", "active_conversation", "nurturing", "followed_up", "cold"])
      } else if (step.sequence_type === "no_reply") {
        // Mid no-reply sequence: mark cold after first step fires (7+ days silent)
        // "following_up" stays for steps before the 7-day threshold
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const coldStatuses = ["just_came_in", "new", "contacted", "following_up", "active_conversation", "nurturing", "followed_up"]
        if (step.step >= 1) {
          // After the first follow-up fires, the lead is definitively cold
          await supabase
            .from("leads")
            .update({ status: "cold" })
            .eq("id", lead.id)
            .in("status", coldStatuses)
            .lt("last_inbound_at", sevenDaysAgo)
            // If they never replied at all, also mark cold
        } else {
          await supabase
            .from("leads")
            .update({ status: "following_up" })
            .eq("id", lead.id)
            .in("status", ["just_came_in", "new", "contacted"])
        }
      } else if (step.sequence_type === "replied_not_booked") {
        // Replied but didn't book — mark cold after all nurture steps are sent
        if (step.step >= lastStep - 1) {
          await supabase
            .from("leads")
            .update({ status: "cold" })
            .eq("id", lead.id)
            .in("status", ["qualified", "active_conversation", "nurturing"])
        }
      }

      processed++
    } catch (err) {
      console.error(`Failed to process sequence step ${step.id}:`, err)
      // Voice call failures (bad number, international, Twilio config) would loop
      // forever as "pending" and block the whole sequence. Cancel them immediately
      // so the next cron run can process the SMS steps that are still pending.
      if (useVoice) {
        await supabase
          .from("sequences")
          .update({ status: "cancelled" })
          .eq("id", step.id)
        console.log(`[cron] Voice step ${step.id} (step ${step.step}) cancelled after failure — sequence SMS steps will continue`)
      }
    }
  }

  // ── Process scheduled voice callbacks (lead-requested callbacks) ────────────
  const { data: dueCalls } = await supabase
    .from("scheduled_calls")
    .select("*, leads(id, phone, status, ai_voice_paused, company_id)")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .limit(20)

  let callsProcessed = 0

  for (const call of dueCalls ?? []) {
    const lead = call.leads as {
      id: string; phone: string; status: string; ai_voice_paused: boolean; company_id: string
    } | null

    if (!lead) continue

    if (lead.ai_voice_paused || ["closed_won", "closed_lost"].includes(lead.status)) {
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

