import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, sendToLead, getTwilioClient } from "@/lib/twilio"
import { isVoiceStep, LAST_STEP, FOLLOW_UP_ANGLE, isTerminalLeadStatus } from "@/lib/sequences"

// Called by Vercel Cron every 5 minutes.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fieldbuiltai.com"
  if (!process.env.NEXT_PUBLIC_APP_URL) console.error("[cron/follow-up] NEXT_PUBLIC_APP_URL not set — voice callbacks will use fallback domain")

  // ── Clear stale "active conversation" flags (> 2 hours since last inbound) ──
  await supabase
    .from("leads")
    .update({ is_active_conversation: false })
    .eq("is_active_conversation", true)
    .lt("last_inbound_at", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())

  // ── Process pending sequence steps ─────────────────────────────────────────
  const { data: dueSteps } = await supabase
    .from("sequences")
    .select("*, leads(id, phone, status, ai_paused, ai_voice_paused, is_active_conversation, first_name, last_name, service_type, deleted_at, channel, messenger_psid, last_inbound_at)")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })  // oldest-first so no step is skipped
    .limit(50)

  let processed = 0

  // Billing gate (F36) — one lookup per company per run
  const { companyAiBlocked } = await import("@/lib/billing-gate")
  const billingBlockCache = new Map<string, string | null>()

  for (const step of dueSteps ?? []) {
    const lead = step.leads as {
      id: string; phone: string; status: string; ai_paused: boolean; ai_voice_paused: boolean;
      is_active_conversation: boolean;
      first_name: string | null; last_name: string | null; service_type: string | null; deleted_at: string | null;
      channel: string | null; messenger_psid: string | null; last_inbound_at: string | null;
    } | null

    if (!lead) continue

    // Lead is actively texting RIGHT NOW — a follow-up firing mid-conversation
    // contradicts whatever the AI just said (finding C17). Leave the step
    // pending; the flag auto-clears 2h after their last inbound.
    if (lead.is_active_conversation) continue

    // Billing gate (F36): cancelled subscription = no automated outreach
    // (pilots exempt). Steps stay pending so the sequence resumes untouched
    // if the company resubscribes.
    let billingBlock = billingBlockCache.get(step.company_id)
    if (billingBlock === undefined) {
      billingBlock = await companyAiBlocked(step.company_id)
      billingBlockCache.set(step.company_id, billingBlock)
    }
    if (billingBlock) continue

    const stepIsVoice = isVoiceStep(step.sequence_type, step.step)

    // A deleted lead should never receive further automated outreach —
    // deleting is meant to stop the relationship, not just hide it from
    // the UI while the cron keeps texting on schedule underneath.
    if (lead.deleted_at) {
      await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      continue
    }

    // Cancel steps for terminal leads — shared list, BOTH status vocabularies
    // ("lost" and "closed_lost"); the old three-value check let follow-ups
    // keep firing after an SMS opt-out (audit C8)
    if (isTerminalLeadStatus(lead.status)) {
      await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      continue
    }

    // SMS AI paused — cancel SMS sequence steps (human has taken over)
    if (!stepIsVoice && lead.ai_paused) {
      await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      continue
    }

    // Voice AI paused — skip unless the step is too stale (>48h past due), then cancel it.
    // Without the age check a step could sit pending for weeks and fire the moment voice is re-enabled.
    if (stepIsVoice && lead.ai_voice_paused) {
      const stepAge = now.getTime() - new Date(step.scheduled_at).getTime()
      if (stepAge > 48 * 60 * 60 * 1000) {
        await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      }
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

    // Voice steps also respect the general AI pause (human takeover / opt-out).
    // Gating only on ai_voice_paused let a paused lead still receive CALLS
    // (adversarial finding 3).
    if (useVoice && lead.ai_paused) {
      await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
      continue
    }

    // Quiet hours — for EVERYTHING. Voice: company working hours. SMS: TCPA
    // quiet hours (8 AM–9 PM recipient-local; we use company tz as the best
    // proxy). Fixed offsets from an evening reply used to fire SMS at 3 AM
    // (adversarial finding 7). Steps outside the window stay pending and fire
    // on the first cron run inside it.
    {
      const { data: agentCfg } = await supabase
        .from("ai_agent_config")
        .select("working_hours_start, working_hours_end, timezone")
        .eq("company_id", step.company_id)
        .single()

      const tz = agentCfg?.timezone ?? "America/New_York"
      const hourNow = parseInt(
        new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }),
        10
      ) % 24
      const start = useVoice ? (agentCfg?.working_hours_start ?? 8) : 8
      const end   = useVoice ? (agentCfg?.working_hours_end   ?? 20) : 21

      if (hourNow < start || hourNow >= end) {
        // Outside allowed hours — leave the step pending, cron will retry
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
        // Send a follow-up via AI engine with per-step angle
        const result = await processAndSave(lead.id, step.company_id, null, undefined, followUpAngle)

        if (result.response) {
          // Messenger leads get the follow-up ON MESSENGER — inside Meta's
          // 24h standard window. Outside it, fall back to SMS when a real
          // phone exists; a placeholder phone means the lead is unreachable
          // and the step cancels instead of looping forever.
          let sid: string | null = null
          let sentVia: string | null = null
          const isMessengerLead = lead.channel === "messenger" && !!lead.messenger_psid
          const inMsgrWindow = !!lead.last_inbound_at &&
            Date.now() - new Date(lead.last_inbound_at).getTime() < 23 * 60 * 60 * 1000
          if (isMessengerLead && inMsgrWindow) {
            const { data: integ } = await supabase
              .from("integrations").select("fb_access_token").eq("company_id", step.company_id).maybeSingle()
            if (integ?.fb_access_token) {
              const { sendMessengerMessage } = await import("@/lib/messenger")
              const sent = await sendMessengerMessage(integ.fb_access_token, lead.messenger_psid as string, result.response)
              if (sent.ok) { sid = sent.messageId ?? null; sentVia = "messenger" }
            }
          }
          if (!sentVia) {
            const { isPlaceholderPhone } = await import("@/lib/twilio")
            if (isPlaceholderPhone(lead.phone)) {
              console.log(`[cron] step ${step.id}: messenger window closed and no real phone — cancelling`)
              await supabase.from("sequences").update({ status: "cancelled" }).eq("id", step.id)
              continue
            }
            const r = await sendToLead(lead, result.response, phoneRecord.phone_number, step.company_id)
            sid = r.sid; sentVia = r.channel
          }
          if (result.outboundConversationId) {
            await supabase
              .from("conversations")
              .update({ twilio_sid: sid, channel: sentVia })
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
        if (step.step > 1) {
          // After the second+ follow-up fires without reply, lead is definitively cold
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
      } else {
        // Permanent Twilio errors on SMS steps: retrying burns AI tokens and
        // spams logs forever. 21610 = recipient opted out at the carrier,
        // 21211 = invalid number — cancel the ENTIRE sequence for this lead,
        // not just this step (audit C8).
        const code = (err as { code?: number })?.code
        if (code === 21610 || code === 21211) {
          await supabase
            .from("sequences")
            .update({ status: "cancelled" })
            .eq("lead_id", lead.id)
            .eq("status", "pending")
          if (code === 21610) {
            await supabase.from("leads").update({ status: "closed_lost", ai_paused: true }).eq("id", lead.id)
          }
          console.log(`[cron] SMS step ${step.id} hit permanent Twilio error ${code} — all pending steps for lead ${lead.id} cancelled`)
        }
      }
    }
  }

  // ── Process scheduled voice callbacks (lead-requested callbacks) ────────────
  const { data: dueCalls } = await supabase
    .from("scheduled_calls")
    .select("*, leads(id, phone, status, ai_voice_paused, ai_paused, company_id)")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .limit(20)

  let callsProcessed = 0

  for (const call of dueCalls ?? []) {
    const lead = call.leads as {
      id: string; phone: string; status: string; ai_voice_paused: boolean; ai_paused: boolean; company_id: string
    } | null

    if (!lead) continue

    if (lead.ai_voice_paused || lead.ai_paused || isTerminalLeadStatus(lead.status)) {
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

