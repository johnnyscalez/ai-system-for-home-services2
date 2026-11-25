import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, sendToLead, getTwilioClient } from "@/lib/twilio"
import { isVoiceStep, voiceStepWithoutVoice, LAST_STEP, FOLLOW_UP_ANGLE, isTerminalLeadStatus } from "@/lib/sequences"
import { voiceEnabled } from "@/lib/voice-enabled"
import { sweepAttention } from "@/lib/attention"

// Triggered every 5 minutes by cron-worker.mjs on Railway (and by vercel.json if the
// project is also deployed on Vercel). Overlapping triggers are safe: every step is
// claimed atomically (pending -> processing) before anything is generated.
//
// Retry budget: a step may be claimed at most MAX_STEP_ATTEMPTS times, ever. Each claim
// is the only place a Claude call can happen, so this is also the hard cap on Claude
// calls per step. A failed delivery keeps its generated body on the step so the retry
// re-sends it WITHOUT regenerating (same idea as sms_retry).
const MAX_STEP_ATTEMPTS = 3
const RETRY_BACKOFF_MS = 15 * 60 * 1000
const CLAIM_TTL_MS = 15 * 60 * 1000

type SupabaseClient = ReturnType<typeof createServiceRoleClient>

async function cancelStep(supabase: SupabaseClient, stepId: string, why: string, stats: { cancelled: number }) {
  await supabase.from("sequences").update({ status: "cancelled" }).eq("id", stepId)
  stats.cancelled++
  console.log(`[cron] step ${stepId}: cancelled — ${why}`)
}

/** Give a claimed step back after a failure: retry later (no regeneration if a body was
 *  kept) or, when the budget is spent, mark it failed so it can never run again. */
async function releaseStep(
  supabase: SupabaseClient,
  stepId: string,
  attemptNo: number,
  meta: Record<string, unknown>,
  reason: string,
  stats: { retried: number; exhausted: number },
  keepBody?: string | null
) {
  const nextMeta: Record<string, unknown> = { ...meta, attempts: attemptNo, last_error: reason.slice(0, 300) }
  delete nextMeta.claimed_at
  if (keepBody) { nextMeta.generated_body = keepBody; nextMeta.generated_at = new Date().toISOString() }
  if (attemptNo >= MAX_STEP_ATTEMPTS) {
    await supabase.from("sequences").update({ status: "failed", metadata: nextMeta }).eq("id", stepId)
    stats.exhausted++
    console.log(`[cron] step ${stepId}: EXHAUSTED after ${attemptNo} attempts (${reason}) — marked failed, no more Claude calls for this step`)
  } else {
    await supabase.from("sequences").update({
      status: "pending",
      scheduled_at: new Date(Date.now() + RETRY_BACKOFF_MS * attemptNo).toISOString(),
      metadata: nextMeta,
    }).eq("id", stepId)
    stats.retried++
    console.log(`[cron] step ${stepId}: attempt ${attemptNo}/${MAX_STEP_ATTEMPTS} failed (${reason}) — retry in ${(RETRY_BACKOFF_MS * attemptNo) / 60000} min${keepBody ? ", generated body kept (no regeneration)" : ""}`)
  }
}

/** Can this company send SMS right now? True when it routes through GoHighLevel, or when
 *  Twilio still owns the sending number. Fails OPEN on any lookup error. */
async function smsTransportUsable(companyId: string, from: string): Promise<boolean> {
  // Local simulation (lib/twilio sendSMS logs instead of sending): no real number to look up.
  if (process.env.SMS_DRY_RUN === "true") return true
  try {
    const { getGhlConnection } = await import("@/lib/ghl")
    if (await getGhlConnection(companyId)) return true
    const owned = await getTwilioClient().incomingPhoneNumbers.list({ phoneNumber: from, limit: 1 })
    return owned.length > 0
  } catch (err) {
    console.warn(`[cron] SMS sender check failed for company ${companyId} — assuming usable:`, err)
    return true
  }
}

// Night-shift sweep safety net (see bottom): leads whose Messenger send keeps failing.
const sweepFailures = new Map<string, { n: number; at: number }>()

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

  // ── Reap steps stuck in "processing" (a run crashed or was restarted mid-step) ──
  const stats = { due: 0, deferred: 0, cancelled: 0, retried: 0, exhausted: 0, claimLost: 0, unreachable: 0 }
  {
    const { data: claimedSteps } = await supabase
      .from("sequences").select("id, metadata").eq("status", "processing").limit(100)
    for (const c of claimedSteps ?? []) {
      const at = (c.metadata as { claimed_at?: string } | null)?.claimed_at
      if (!at || now.getTime() - new Date(at).getTime() > CLAIM_TTL_MS) {
        await supabase.from("sequences").update({ status: "pending" }).eq("id", c.id).eq("status", "processing")
        console.log(`[cron] step ${c.id}: claim expired (run died mid-step) — returned to pending`)
      }
    }
  }

  // ── Process pending sequence steps ─────────────────────────────────────────
  const { data: dueSteps } = await supabase
    .from("sequences")
    .select("*, leads(id, phone, status, ai_paused, ai_voice_paused, is_active_conversation, first_name, last_name, service_type, deleted_at, channel, messenger_psid, last_inbound_at)")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })  // oldest-first so no step is skipped
    .limit(50)

  let processed = 0
  stats.due = dueSteps?.length ?? 0
  const smsUsableCache = new Map<string, boolean>()

  // Billing gate (F36) — one lookup per company per run
  const { companyAiBlocked } = await import("@/lib/billing-gate")
  const billingBlockCache = new Map<string, string | null>()

  const officeCoverCache = new Map<string, boolean>()
  const voiceOnCache = new Map<string, boolean>()
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
    if (lead.is_active_conversation) { stats.deferred++; continue }

    // Billing gate (F36): cancelled subscription = no automated outreach
    // (pilots exempt). Steps stay pending so the sequence resumes untouched
    // if the company resubscribes.
    let billingBlock = billingBlockCache.get(step.company_id)
    if (billingBlock === undefined) {
      billingBlock = await companyAiBlocked(step.company_id)
      billingBlockCache.set(step.company_id, billingBlock)
    }
    if (billingBlock) { stats.deferred++; continue }

    // A "voice" step is only a call for a company with the voice agent ON.
    // With it off (the default) the step becomes a text, or is dropped when
    // another text already covers that morning. Decided here, at fire time, so
    // the switch also applies to rows inserted before it was flipped.
    const scheduledAsVoice = isVoiceStep(step.sequence_type, step.step)
    let voiceOn = voiceOnCache.get(step.company_id)
    if (voiceOn === undefined) {
      voiceOn = await voiceEnabled(step.company_id)
      voiceOnCache.set(step.company_id, voiceOn)
    }
    if (scheduledAsVoice && !voiceOn && voiceStepWithoutVoice(step.sequence_type, step.step) === "skip") {
      await cancelStep(supabase, step.id, "voice agent off, this step has no text equivalent", stats)
      continue
    }
    const stepIsVoice = scheduledAsVoice && voiceOn

    // Office-coverage shift: while the office covers the inbox, follow-up
    // sends are DEFERRED, never cancelled — the step stays pending and fires
    // on the first cron pass after coverage ends (the agent's shift start).
    {
      let covered = officeCoverCache.get(step.company_id)
      if (covered === undefined) {
        const { officeCoversNowForCompany } = await import("@/lib/office-hours")
        covered = await officeCoversNowForCompany(step.company_id)
        officeCoverCache.set(step.company_id, covered)
      }
      if (covered) { stats.deferred++; continue }
    }

    // A deleted lead should never receive further automated outreach —
    // deleting is meant to stop the relationship, not just hide it from
    // the UI while the cron keeps texting on schedule underneath.
    if (lead.deleted_at) {
      await cancelStep(supabase, step.id, "lead deleted", stats)
      continue
    }

    // Cancel steps for terminal leads — shared list, BOTH status vocabularies
    // ("lost" and "closed_lost"); the old three-value check let follow-ups
    // keep firing after an SMS opt-out (audit C8)
    if (isTerminalLeadStatus(lead.status)) {
      await cancelStep(supabase, step.id, "lead status is terminal", stats)
      continue
    }

    // SMS AI paused — cancel SMS sequence steps (human has taken over)
    if (!stepIsVoice && lead.ai_paused) {
      await cancelStep(supabase, step.id, "SMS AI paused (human takeover)", stats)
      continue
    }

    // Voice AI paused — skip unless the step is too stale (>48h past due), then cancel it.
    // Without the age check a step could sit pending for weeks and fire the moment voice is re-enabled.
    if (stepIsVoice && lead.ai_voice_paused) {
      const stepAge = now.getTime() - new Date(step.scheduled_at).getTime()
      if (stepAge > 48 * 60 * 60 * 1000) {
        await cancelStep(supabase, step.id, "voice step stale >48h while voice AI paused", stats)
      }
      continue
    }

    const { data: phoneRecord } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("company_id", step.company_id)
      .eq("is_active", true)
      .single()

    // No active phone number = no SMS and no voice, but a Messenger-only company (Top Air)
    // still follows up over Messenger. Everything that needs a number cancels as before.
    const messengerOnly = !phoneRecord?.phone_number &&
      !stepIsVoice && step.sequence_type !== "sms_retry" &&
      lead.channel === "messenger" && !!lead.messenger_psid
    if (!phoneRecord?.phone_number && !messengerOnly) {
      await cancelStep(supabase, step.id, "no active phone number for company", stats)
      continue
    }
    const fromNumber = phoneRecord?.phone_number ?? ""

    // Decide: SMS or voice call for this step?
    const useVoice = stepIsVoice

    // Voice steps also respect the general AI pause (human takeover / opt-out).
    // Gating only on ai_voice_paused let a paused lead still receive CALLS
    // (adversarial finding 3).
    if (useVoice && lead.ai_paused) {
      await cancelStep(supabase, step.id, "voice step but AI paused", stats)
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
        stats.deferred++
        continue
      }
    }

    // ── Retry budget + atomic claim ─────────────────────────────────────────────
    // Everything above this line is cheap gating that defers or cancels. From here on the
    // step will do real work, so it must be (a) within its attempt budget and (b) owned by
    // exactly one run: pending -> processing succeeds for one caller only.
    const stepMeta = ((step.metadata ?? {}) as Record<string, unknown>)
    const priorAttempts = Number(stepMeta.attempts ?? 0) || 0
    if (priorAttempts >= MAX_STEP_ATTEMPTS) {
      await supabase.from("sequences").update({ status: "failed" }).eq("id", step.id).eq("status", "pending")
      stats.exhausted++
      console.log(`[cron] step ${step.id}: EXHAUSTED (${priorAttempts} attempts already) — marked failed without calling Claude`)
      continue
    }
    const attemptNo = priorAttempts + 1
    const { data: claimedRows } = await supabase
      .from("sequences")
      .update({ status: "processing", metadata: { ...stepMeta, attempts: attemptNo, claimed_at: now.toISOString() } })
      .eq("id", step.id)
      .eq("status", "pending")
      .select("id")
    if (!claimedRows?.length) {
      stats.claimLost++
      console.log(`[cron] step ${step.id}: already claimed by another run — skipped`)
      continue
    }

    // ── SMS retry: re-send the exact failed message body (no AI needed) ─────────
    if (step.sequence_type === "sms_retry") {
      const meta = step.metadata as { failed_body?: string } | null
      const retryBody = meta?.failed_body
      if (!retryBody) {
        await cancelStep(supabase, step.id, "sms_retry without a stored body", stats)
        continue
      }
      try {
        const msg = await sendSMS(lead.phone, retryBody, fromNumber)
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
        await cancelStep(supabase, step.id, "sms_retry send failed", stats)
      }
      continue
    }

    const angleKey = `${step.sequence_type}:${step.step}`
    const followUpAngle = FOLLOW_UP_ANGLE[angleKey]

    // Set as the step progresses so the catch block knows what to clean up / keep.
    let ghostId: string | undefined
    let pendingBody: string | null = null
    let delivered = false

    try {
      if (useVoice) {
        // Fire an outbound voice call using the follow-up agent
        const twilio = getTwilioClient()
        await twilio.calls.create({
          to: lead.phone,
          from: fromNumber,
          url: `${appUrl}/api/voice/inbound?leadId=${lead.id}&companyId=${step.company_id}&direction=outbound&isFollowUp=true`,
          statusCallback: `${appUrl}/api/voice/status`,
          statusCallbackMethod: "POST",
          statusCallbackEvent: ["completed", "failed", "no-answer", "busy"],
          machineDetection: "DetectMessageEnd",
          asyncAmdStatusCallback: `${appUrl}/api/voice/amd?leadId=${lead.id}`,
        })
      } else {
        // Reachability is decided BEFORE generating anything: a step with no working
        // way to reach the lead cancels instead of burning a Claude call and leaving
        // a "Not delivered" ghost bubble in the thread (live: Olya; and the Oct 2026
        // loop, where Messenger's 24h window was closed and the company's Twilio
        // number had been released, so every generated text died at send time).
        const isMessengerLead = lead.channel === "messenger" && !!lead.messenger_psid
        const inMsgrWindow = !!lead.last_inbound_at &&
          Date.now() - new Date(lead.last_inbound_at).getTime() < 23 * 60 * 60 * 1000
        let fbToken: string | null = null
        if (isMessengerLead && inMsgrWindow) {
          const { data: integ } = await supabase
            .from("integrations").select("fb_access_token").eq("company_id", step.company_id).eq("type", "facebook").maybeSingle()
          fbToken = integ?.fb_access_token ?? null
        }
        const canMessenger = !!fbToken
        const { isPlaceholderPhone } = await import("@/lib/twilio")
        let canSms = !!fromNumber && !isPlaceholderPhone(lead.phone)
        if (canSms) {
          let usable = smsUsableCache.get(step.company_id)
          if (usable === undefined) {
            usable = await smsTransportUsable(step.company_id, fromNumber)
            smsUsableCache.set(step.company_id, usable)
          }
          canSms = usable
        }
        if (!canMessenger && !canSms) {
          stats.unreachable++
          await cancelStep(supabase, step.id, "no reachable channel (Messenger window closed or no token, and no usable SMS sender or real phone)", stats)
          continue
        }

        // A previous attempt generated this message but could not deliver it: re-send
        // the stored body, never regenerate. Drop it if the lead has spoken since.
        let response: string | null = null
        const storedBody = typeof stepMeta.generated_body === "string" ? stepMeta.generated_body : null
        if (storedBody) {
          const genAt = typeof stepMeta.generated_at === "string" ? new Date(stepMeta.generated_at).getTime() : 0
          if (lead.last_inbound_at && new Date(lead.last_inbound_at).getTime() > genAt) {
            await cancelStep(supabase, step.id, "stored message is stale (lead replied after it was generated)", stats)
            continue
          }
          response = storedBody
        } else {
          const result = await processAndSave(lead.id, step.company_id, null, undefined, followUpAngle)
          response = result.response || null
          ghostId = result.outboundConversationId
        }
        pendingBody = response

        if (response) {
          // Messenger first inside Meta's 24h window; SMS as the fallback.
          let sid: string | null = null
          let sentVia: string | null = null
          if (canMessenger && fbToken) {
            const { sendMessengerMessage } = await import("@/lib/messenger")
            const sent = await sendMessengerMessage(fbToken, lead.messenger_psid as string, response)
            if (sent.ok) { sid = sent.messageId ?? null; sentVia = "messenger" }
          }
          if (!sentVia && canSms) {
            const r = await sendToLead(lead, response, fromNumber, step.company_id)
            sid = r.sid; sentVia = r.channel
          }
          if (!sentVia) {
            // Generated but no transport accepted it: remove the ghost row and keep the
            // body on the step so the retry re-sends it without another generation.
            if (ghostId) await supabase.from("conversations").delete().eq("id", ghostId)
            ghostId = undefined
            await releaseStep(supabase, step.id, attemptNo, stepMeta, "all transports failed after generation", stats, response)
            continue
          }
          delivered = true
          if (ghostId) {
            await supabase.from("conversations").update({ twilio_sid: sid, channel: sentVia }).eq("id", ghostId)
          } else {
            // Re-sent from a stored body: the ghost row was deleted earlier, so record it now.
            await supabase.from("conversations").insert({
              lead_id: lead.id, company_id: step.company_id, direction: "outbound",
              sent_by: "ai", body: response, twilio_sid: sid, channel: sentVia,
            })
          }
        }
      }

      // Mark step sent
      await supabase
        .from("sequences")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("id", step.id)

      const lastStep = LAST_STEP[step.sequence_type] ?? 0
      if (step.sequence_type === "quote_follow_up") {
        // Quote chase: the lead stays in the quote stage. When the last text
        // has gone out with no decision, a person takes it from here.
        if (step.step >= lastStep) {
          const { notifyOwner } = await import("@/lib/notifications")
          const who = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.phone
          notifyOwner(step.company_id, `Quote follow-up finished for ${who}: six texts over a month, no decision. Worth a personal call, or mark the lead lost in your CRM.`).catch(() => {})
        }
      } else if (step.step >= lastStep) {
        // Last step exhausted — mark lead as lost
        await supabase
          .from("leads")
          .update({ status: "lost" })
          .eq("id", lead.id)
          .in("status", ["just_came_in", "new", "contacted", "following_up", "active_conversation", "nurturing", "followed_up", "cold"])
      } else if (step.sequence_type === "no_reply") {
        // No reply yet: "following_up" through the first week, "cold" from the
        // day-7 text on. (The old rule compared last_inbound_at, which is NULL
        // for a lead who never replied, so it never matched and nobody went cold.)
        const earlyStatuses = ["just_came_in", "new", "contacted", "following_up"]
        await supabase
          .from("leads")
          .update({ status: step.step >= 6 ? "cold" : "following_up" })
          .eq("id", lead.id)
          .in("status", earlyStatuses)
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
      if (delivered) {
        // The message went out; only the bookkeeping after it failed. Never retry.
        await supabase.from("sequences").update({ status: "sent", sent_at: now.toISOString() }).eq("id", step.id)
        continue
      }
      if (ghostId) {
        await supabase.from("conversations").delete().eq("id", ghostId)
        console.log(`[cron] step ${step.id}: removed undelivered ghost row ${ghostId}`)
      }
      // Voice call failures (bad number, international, Twilio config) would loop
      // forever as "pending" and block the whole sequence. Cancel them immediately
      // so the next cron run can process the SMS steps that are still pending.
      if (useVoice) {
        await cancelStep(supabase, step.id, `voice call failed (step ${step.step}) — sequence SMS steps will continue`, stats)
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
          await cancelStep(supabase, step.id, `permanent Twilio error ${code}`, stats)
        } else {
          // Any other failure (dead sender, network, Claude error): spend one attempt,
          // keep the generated body if there is one, and stop for good after the budget.
          await releaseStep(supabase, step.id, attemptNo, stepMeta, String((err as Error)?.message ?? err), stats, pendingBody)
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

    if (lead.ai_voice_paused || lead.ai_paused || isTerminalLeadStatus(lead.status) || !(await voiceEnabled(call.company_id))) {
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

  // ── Night-shift sweep ──────────────────────────────────────────────────
  // For companies on the office-coverage shift model: once the office is off
  // duty, answer any Messenger inbound the office left unanswered. Without
  // this, a 5:50 PM question would sit silent all night — the webhook only
  // fires on NEW inbounds. Idempotent: after the agent replies, the thread's
  // last row is outbound and the lead no longer matches.
  let swept = 0
  try {
    const { data: shiftCompanies } = await supabase
      .from("ai_agent_config")
      .select("company_id, office_coverage, timezone")
      .not("office_coverage", "is", null)
    const { officeCoversNow } = await import("@/lib/office-hours")
    for (const cfg of shiftCompanies ?? []) {
      const cov = cfg.office_coverage as { enabled?: boolean } | null
      if (!cov?.enabled) continue
      if (officeCoversNow(cov, (cfg.timezone as string | null) ?? "America/New_York")) continue // office on duty

      // Candidates: live Messenger leads with a fresh inbound (inside Meta's
      // 24h window) whose LAST message is from the lead, ≥10 min old (give the
      // office takeover echoes and webhook retries time to land).
      const { data: candidates } = await supabase
        .from("leads")
        .select("id, messenger_psid, status, ai_paused, last_inbound_at")
        .eq("company_id", cfg.company_id)
        .eq("channel", "messenger")
        .eq("ai_paused", false)
        .not("messenger_psid", "is", null)
        .gte("last_inbound_at", new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString())
        .lte("last_inbound_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .limit(40)

      for (const lead of candidates ?? []) {
        if (swept >= 15) break // cap per pass; next pass continues
        if (isTerminalLeadStatus(lead.status)) continue
        // Failure cooldown: 3 failed sends in the last hour = stop generating for this lead
        // for an hour (every pass would otherwise regenerate the same undeliverable reply).
        const failed = sweepFailures.get(lead.id)
        if (failed && failed.n >= 3 && Date.now() - failed.at < 60 * 60 * 1000) {
          console.log(`[cron] night-shift sweep: lead ${lead.id} skipped — ${failed.n} recent send failures (cooldown)`)
          continue
        }
        const { data: lastMsg } = await supabase
          .from("conversations")
          .select("direction, sent_by")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!lastMsg || lastMsg.direction !== "inbound") continue

        let sweepGhostId: string | undefined
        try {
          // Pre-reply thread sync — same takeover safety as the live webhook.
          const { data: integ } = await supabase
            .from("integrations").select("fb_access_token, fb_page_id").eq("company_id", cfg.company_id).eq("type", "facebook").maybeSingle()
          if (!integ?.fb_access_token) continue
          const { syncMessengerHistory, sendMessengerMessage } = await import("@/lib/messenger")
          const r = await syncMessengerHistory(supabase, lead.id, cfg.company_id, integ.fb_access_token, integ.fb_page_id, lead.messenger_psid as string, {})
          if (r.humanTakeover) continue
          const { data: still } = await supabase.from("leads").select("ai_paused").eq("id", lead.id).maybeSingle()
          if (still?.ai_paused) continue

          const result = await processAndSave(lead.id, cfg.company_id, null, undefined, undefined, "messenger")
          sweepGhostId = result.outboundConversationId
          if (result.response) {
            const sent = await sendMessengerMessage(integ.fb_access_token, lead.messenger_psid as string, result.response)
            if (sent.ok) {
              sweepFailures.delete(lead.id)
              if (result.outboundConversationId) {
                await supabase.from("conversations").update({ channel: "messenger", twilio_sid: sent.messageId ?? null }).eq("id", result.outboundConversationId)
              }
              swept++
              console.log(`[cron] night-shift sweep answered lead ${lead.id}`)
            } else {
              if (result.outboundConversationId) {
                await supabase.from("conversations").delete().eq("id", result.outboundConversationId)
              }
              const f = sweepFailures.get(lead.id)
              sweepFailures.set(lead.id, { n: (f && Date.now() - f.at < 60 * 60 * 1000 ? f.n : 0) + 1, at: Date.now() })
              console.log(`[cron] night-shift sweep: send failed for lead ${lead.id} — ghost removed (${sweepFailures.get(lead.id)!.n} recent failures)`)
            }
          }
        } catch (e) {
          console.error(`[cron] night-shift sweep failed for lead ${lead.id}:`, e)
          if (sweepGhostId) await supabase.from("conversations").delete().eq("id", sweepGhostId)
          const f = sweepFailures.get(lead.id)
          sweepFailures.set(lead.id, { n: (f && Date.now() - f.at < 60 * 60 * 1000 ? f.n : 0) + 1, at: Date.now() })
        }
      }
    }
  } catch (e) {
    console.error("[cron] night-shift sweep block failed:", e)
  }

  // Leads handed to a person: text the owner if nothing has yet, and restart
  // the follow-ups when nobody booked or took the lead over (lib/attention.ts).
  const attention = await sweepAttention(supabase)

  console.log(`[cron] follow-up run: due=${stats.due} sent=${processed} deferred=${stats.deferred} cancelled=${stats.cancelled} unreachable=${stats.unreachable} retried=${stats.retried} exhausted=${stats.exhausted} claimLost=${stats.claimLost} swept=${swept} attention=${JSON.stringify(attention)}`)
  return NextResponse.json({ processed, callsProcessed, swept, attention, ...stats })
}

