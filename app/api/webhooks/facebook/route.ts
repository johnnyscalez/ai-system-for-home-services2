import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { parseLeadPhone } from "@/lib/twilio"
import { notifyNewLead, notifyAppointmentBooked, notifyNeedsAttention } from "@/lib/notifications"
import { sendMessengerMessage, getMessengerProfile, messengerPlaceholderPhone } from "@/lib/messenger"
import { handleLeadgenChange } from "@/lib/meta-leadgen"
import crypto from "crypto"

// ─── Messenger events (entry[].messaging[]) ───────────────────────────────────
// A lead messages the contractor's Facebook Page → the same AI engine that
// handles SMS replies on Messenger. Replies are always within Meta's 24h
// window because every send here is a direct response to an inbound message.
type MessagingEvent = {
  sender: { id: string }
  recipient: { id: string }
  timestamp?: number
  message?: { mid: string; text?: string; is_echo?: boolean; app_id?: number; attachments?: unknown[] }
  postback?: { mid?: string; title?: string; payload?: string }
}

// ── Message id dedupe ────────────────────────────────────────────────────────
// Meta redelivers a messaging event whenever our reply takes longer than its
// timeout, and a multi-second AI turn regularly does. Without this the same
// inbound was answered twice. Two layers: an in-process LRU (catches the retry
// that lands while the first run is still generating) and a database check on
// conversations.twilio_sid = mid (catches a retry served by another instance or
// after a restart; the inbound row carries the mid from the first run).
const seenMids = new Map<string, number>()
const MID_LRU_MAX = 2000

function midAlreadyHandled(mid: string): boolean {
  if (seenMids.has(mid)) return true
  seenMids.set(mid, Date.now())
  if (seenMids.size > MID_LRU_MAX) seenMids.delete(seenMids.keys().next().value as string)
  return false
}

async function handleMessagingEvent(pageId: string, event: MessagingEvent): Promise<void> {
  const supabase = createServiceRoleClient()

  // Diagnostic: exactly what kind of messaging event arrived (temporary).
  console.log("[webhook/facebook] msgEvent:", JSON.stringify({
    page: pageId,
    sender: event.sender?.id,
    is_echo: event.message?.is_echo ?? false,
    has_text: Boolean(event.message?.text),
    text_preview: event.message?.text?.slice(0, 40),
    is_delivery: Boolean((event as { delivery?: unknown }).delivery),
    is_read: Boolean((event as { read?: unknown }).read),
    has_postback: Boolean(event.postback),
  }))

  // limit(1), not single(): one Page active under two companies used to make
  // single() fail for BOTH, silencing the Page everywhere. Most recently saved wins.
  const { data: integrationRows } = await supabase
    .from("integrations")
    .select("company_id, fb_access_token")
    .eq("fb_page_id", pageId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
  const integration = integrationRows?.[0]
  if (!integration?.fb_access_token) {
    console.log("[webhook/facebook] msgEvent: NO active integration for page", pageId)
    return
  }

  const mid = event.message?.mid ?? event.postback?.mid ?? null
  if (mid) {
    if (midAlreadyHandled(mid)) {
      console.log(`[webhook/facebook] duplicate delivery of ${mid} ignored (in-process)`)
      return
    }
    const { data: dup } = await supabase
      .from("conversations").select("id")
      .eq("company_id", integration.company_id).eq("twilio_sid", mid).limit(1)
    if (dup?.length) {
      console.log(`[webhook/facebook] duplicate delivery of ${mid} ignored (already stored)`)
      return
    }
  }

  // ── Echo = the PAGE sent a message. Two sources: our own AI sends (via the
  // Graph API — they carry OUR app_id) and MANUAL replies a team member typed
  // in Meta's inbox / Business Suite (different or no app_id). A manual reply
  // means a human took over the conversation → pause the AI so it stops
  // auto-replying and doesn't talk over the employee. (SMS already does this;
  // this brings Messenger to parity.)
  if (event.message?.is_echo) {
    const customerPsid = event.recipient?.id            // echo recipient = the lead
    if (!customerPsid) return
    const ourAppId  = process.env.FACEBOOK_APP_ID
    const echoAppId = event.message.app_id != null ? String(event.message.app_id) : null
    if (echoAppId && ourAppId && echoAppId === ourAppId) return  // our own AI send — ignore

    const { data: lead } = await supabase
      .from("leads")
      .select("id, last_inbound_at")
      .eq("company_id", integration.company_id)
      .eq("messenger_psid", customerPsid)
      .is("deleted_at", null)
      .maybeSingle()
    if (!lead) return

    // Safety net when app_id is absent: don't mistake our own text for a human's.
    const echoText = event.message.text?.trim() ?? ""
    if (!echoAppId && echoText) {
      const { data: ours } = await supabase
        .from("conversations")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("direction", "outbound")
        .eq("channel", "messenger")
        .gte("created_at", new Date(Date.now() - 120000).toISOString())
        .ilike("body", echoText.slice(0, 80) + "%")
        .maybeSingle()
      if (ours) return
    }

    // The Page's own automation (instant replies, questionnaire prompts) echoes
    // exactly like a person's reply. Pausing on it would switch the agent off for
    // every lead of a Page that runs a greeting flow. Record it, do not pause.
    if (echoText) {
      const { isAutomationEcho, getPageAutomationTexts } = await import("@/lib/messenger")
      const pageTexts = await getPageAutomationTexts(integration.fb_access_token, pageId)
      const automation = isAutomationEcho({
        text: echoText,
        echoMs: typeof event.timestamp === "number" ? event.timestamp : null,
        lastInboundMs: lead.last_inbound_at ? new Date(lead.last_inbound_at as string).getTime() : null,
        pageTexts,
      })
      if (automation) {
        await supabase.from("conversations").insert({
          lead_id: lead.id, company_id: integration.company_id,
          direction: "outbound", sent_by: "human", body: echoText, channel: "messenger", twilio_sid: mid,
        })
        console.log(`[webhook/facebook] page automation echo recorded for lead ${lead.id}, AI stays on`)
        return
      }
    }

    await supabase.from("leads").update({ ai_paused: true }).eq("id", lead.id)
    await supabase.from("conversations").insert({
      lead_id: lead.id, company_id: integration.company_id,
      direction: "outbound", sent_by: "human",
      body: echoText || "(manual reply sent from Messenger)", channel: "messenger",
      twilio_sid: mid,
    })
    console.log(`[webhook/facebook] human takeover — AI paused for lead ${lead.id}`)
    return
  }

  const text = event.message?.text?.trim()
    ?? event.postback?.title?.trim()
    ?? (event.message?.attachments?.length ? "[sent an attachment]" : null)
  if (!text) return

  const psid = event.sender.id

  // Find or create the lead by Messenger PSID
  const { data: existing } = await supabase
    .from("leads")
    .select("id, status, phone, ai_paused")
    .eq("company_id", integration.company_id)
    .eq("messenger_psid", psid)
    .is("deleted_at", null)
    .maybeSingle()

  let leadId: string
  if (existing) {
    leadId = existing.id
    // Messenger-only leads have a placeholder phone. The moment they type a
    // real number ("561-555-0123"), capture it — reminders, confirmations,
    // and the call-ahead before the visit all need it.
    // BOTH placeholder kinds must be replaceable. It used to check only
    // "msgr:", so a lead created from a lead form WITHOUT a phone (placeholder
    // "fbform:<id>") who then typed their number in Messenger kept the
    // placeholder forever — and the HCP push refuses placeholders, so the
    // booking never reached the CRM. Live: Jeremy Sekulovski typed
    // 2488280823, booked, and the job never synced.
    if (existing.phone.startsWith("msgr:") || existing.phone.startsWith("fbform:")) {
      // \s* not \s?: "(312) 555-0187" normalizes to " 312  555 0187" with
      // DOUBLE spaces — \s? missed the most common US phone format, so the
      // lead's real number never replaced the msgr: placeholder and the job
      // could never push to HCP (audit H4)
      const phoneMatch = text.replace(/[^\d+]/g, " ").match(/(\+?1?\s*\d{3}\s*\d{3}\s*\d{4})\b/)
      if (phoneMatch) {
        const realPhone = parseLeadPhone(phoneMatch[1].replace(/\s/g, ""))
        if (realPhone) await supabase.from("leads").update({ phone: realPhone }).eq("id", leadId)
        // invalid: the agent keeps asking
      }
    }
    // Same for email — capture the moment it's shared in conversation
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
    if (emailMatch) {
      await supabase.from("leads").update({ email: emailMatch.toLowerCase() }).eq("id", leadId).is("email", null)
    }
  } else {
    const profile = await getMessengerProfile(integration.fb_access_token, psid)
    const { data: newLead } = await supabase
      .from("leads")
      .insert({
        company_id: integration.company_id,
        phone: messengerPlaceholderPhone(psid), // real number collected in conversation
        first_name: profile.firstName,
        last_name: profile.lastName,
        messenger_psid: psid,
        source: "facebook",
        channel: "messenger",
        status: "just_came_in",
        // name_source: Facebook autofills/serves PROFILE names, which are
        // often aliases (live: "KTrin Brownskin" = Katrina Lewis). The booking
        // gate requires the customer to state their real full name.
        metadata: { page_id: pageId, messenger: true, ...(profile.firstName ? { name_source: "facebook_profile" } : {}) },
      })
      .select("id")
      .single()
    if (!newLead) return
    leadId = newLead.id

    const leadName = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "Messenger lead"
    notifyNewLead(integration.company_id, leadName, "", "messenger", leadId).catch(() => {})

    // FIRST CONTACT with this PSID — the thread may have a life we never saw
    // (Meta inbox automations, office reps, pre-connect history). Import it so
    // the AI is never history-blind, and if a human/automation already engaged
    // this person recently, the thread is THEIRS: pause the AI and tell the
    // office instead of talking over them. (The Nicole incident: the AI
    // restarted intake minutes after a rep said "we don't service your area".)
    try {
      const { importMessengerHistory, fetchConversationHistory, mineHistoryFacts } = await import("@/lib/messenger")
      const { imported, humanOwned } = await importMessengerHistory(
        supabase, leadId, integration.company_id,
        integration.fb_access_token, pageId, psid, text
      )

      // Mine the thread (history + THIS first message) for contact details the
      // customer already gave. Two live losses this repairs: the creating
      // message was never scanned for a phone/email (capture only ran for
      // EXISTING leads — a lead whose first words were her phone number had it
      // dropped), and answers given to a page automation were invisible, so
      // the AI re-asked them.
      try {
        const hist = await fetchConversationHistory(integration.fb_access_token, pageId, psid)
        const facts = mineHistoryFacts([
          ...hist,
          { fromPage: false, text, createdTime: new Date().toISOString() },
        ])
        const patch: Record<string, string> = {}
        if (facts.phone) {
          const real = parseLeadPhone(facts.phone)
          if (real) patch.phone = real
        }
        if (facts.email) patch.email = facts.email
        // A zip is a zip, never an address (a bare zip in the address field counted
        // as "street address on file" in the agent's booking checklist).
        if (facts.zip) patch.zip = facts.zip
        if (Object.keys(patch).length > 0) {
          await supabase.from("leads").update(patch).eq("id", leadId)
          console.log(`[webhook/facebook] mined contact facts for lead ${leadId}: ${Object.keys(patch).join(", ")}`)
        }
        if (facts.transcriptFacts.length > 0) {
          const { data: cur } = await supabase.from("leads").select("notes").eq("id", leadId).maybeSingle()
          const block = `Already answered before this conversation: ${facts.transcriptFacts.join(" | ")}`
          await supabase.from("leads")
            .update({ notes: cur?.notes ? `${cur.notes}\n${block}` : block })
            .eq("id", leadId)
        }
      } catch (err) {
        console.error("[webhook/facebook] fact mining failed:", err)
      }
      if (humanOwned) {
        await supabase.from("conversations").insert({
          lead_id: leadId, company_id: integration.company_id,
          direction: "inbound", sent_by: "human", body: text, channel: "messenger", twilio_sid: mid,
        })
        // Pause, but never demote a lead with an upcoming visit (Viloren class)
        const { data: upcomingApt } = await supabase.from("appointments")
          .select("id").eq("lead_id", leadId).eq("status", "scheduled")
          .gt("scheduled_at", new Date().toISOString()).limit(1)
        await supabase.from("leads").update({
          ai_paused: true,
          ...((upcomingApt ?? []).length > 0 ? {} : { status: "needs_attention" }),
          last_message_at: new Date().toISOString(),
        }).eq("id", leadId)
        const { notifyNeedsAttention } = await import("@/lib/notifications")
        notifyNeedsAttention(
          integration.company_id,
          `${leadName} (existing Messenger thread — a team member or page automation already engaged; AI is holding back. Review the imported history and Resume AI if wanted.)`,
          "via Messenger",
          leadId
        ).catch(() => {})
        console.log(`[webhook/facebook] lead ${leadId}: ${imported} msgs imported, HUMAN-OWNED thread — AI paused, office notified`)
        return
      }
      if (imported > 0) console.log(`[webhook/facebook] lead ${leadId}: ${imported} historical messages imported — AI has full context`)
    } catch (err) {
      console.error("[webhook/facebook] history import failed (continuing without):", err)
    }
  }

  // Deterministic opt-out — Messenger has no carrier backstop like SMS, so
  // this handler is the ONLY thing standing between a "stop" and continued
  // automated messages (audit C8)
  const MSGR_OPT_OUT_RE = /^\s*(stop|stopall|stop all|unsubscribe|opt ?out|remove me|do not (text|contact|message) me|don'?t (text|contact|message) me|leave me alone)\s*[.!]*\s*$/i
  if (MSGR_OPT_OUT_RE.test(text)) {
    await supabase.from("conversations").insert({
      lead_id: leadId, company_id: integration.company_id,
      direction: "inbound", sent_by: "human", body: text, channel: "messenger", twilio_sid: mid,
    })
    await supabase.from("leads")
      .update({ status: "closed_lost", ai_paused: true, last_message_at: new Date().toISOString() })
      .eq("id", leadId)
    await supabase.from("sequences").update({ status: "cancelled" })
      .eq("lead_id", leadId).eq("status", "pending")
    await supabase.from("scheduled_calls").update({ status: "cancelled" })
      .eq("lead_id", leadId).eq("status", "pending")
    console.log(`[webhook/facebook] opt-out from messenger lead ${leadId} — all outreach cancelled, AI paused`)
    return
  }

  // Every other inbound channel stamps these two fields; Messenger never did —
  // so every Messenger lead had last_inbound_at NULL, the cron's 24h-window
  // check read NULL as "window closed", and Messenger follow-ups could never
  // fire (live: Olya — followed up 7h after her message, via a dead SMS ghost
  // instead of the open Messenger window). is_active_conversation also gives
  // Messenger leads the same mid-conversation follow-up protection as SMS.
  await supabase.from("leads")
    .update({ last_inbound_at: new Date().toISOString(), is_active_conversation: true })
    .eq("id", leadId)

  // Human took over this conversation (a team member replied manually) → the AI
  // stays quiet. Still record the lead's message so the team sees the full
  // thread in the CRM; just don't generate an AI reply.
  if (existing?.ai_paused) {
    await supabase.from("conversations").insert({
      lead_id: leadId, company_id: integration.company_id,
      direction: "inbound", sent_by: "human", body: text, channel: "messenger", twilio_sid: mid,
    })
    await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId)
    console.log(`[webhook/facebook] lead ${leadId} is AI-paused (human handling) — no AI reply`)
    return
  }

  // Re-sync the thread from Meta before EVERY reply, not just the first
  // (Gaurang incident: the owner corrected the agent from the page inbox, the
  // echo webhooks never arrived, and the agent answered the next message
  // blind to the correction AND unpaused). The sync pulls anything reps or
  // automations said since we last looked, and if it reveals a rep speaking
  // after the AI's last word it pauses the AI itself — echo delivery is no
  // longer a single point of failure. One Graph call per inbound.
  try {
    const { syncMessengerHistory, backfillLeadFromThread } = await import("@/lib/messenger")
    const r = await syncMessengerHistory(
      supabase, leadId, integration.company_id,
      integration.fb_access_token, pageId, psid,
      { excludeTriggerText: text }
    )
    if (r.added > 0) console.log(`[webhook/facebook] pre-reply re-sync: +${r.added} msgs for lead ${leadId}`)
    await backfillLeadFromThread(supabase, leadId, r.facts)
    if (r.humanTakeover) {
      // Record the lead's message (unless the sync already imported it), then
      // stay silent — the thread belongs to the team now.
      const { count: haveIt } = await supabase
        .from("conversations").select("*", { count: "exact", head: true })
        .eq("lead_id", leadId).eq("direction", "inbound").eq("body", text)
        .gte("created_at", new Date(Date.now() - 6 * 60 * 1000).toISOString())
      if ((haveIt ?? 0) === 0) {
        await supabase.from("conversations").insert({
          lead_id: leadId, company_id: integration.company_id,
          direction: "inbound", sent_by: "human", body: text, channel: "messenger", twilio_sid: mid,
        })
      }
      await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId)
      console.log(`[webhook/facebook] rep active in thread ${leadId} (sync-detected) — no AI reply`)
      return
    }
  } catch (err) {
    console.error("[webhook/facebook] pre-reply re-sync failed (continuing):", err)
  }

  // Office-coverage shift: during covered hours the office owns the inbox.
  // The inbound is already stored, stamped and takeover-synced above — the
  // agent simply does not reply. The night-shift sweep (follow-up cron)
  // answers anything the office leaves unanswered once coverage ends.
  {
    const { officeCoversNowForCompany } = await import("@/lib/office-hours")
    if (await officeCoversNowForCompany(integration.company_id)) {
      const { count: haveIt } = await supabase
        .from("conversations").select("*", { count: "exact", head: true })
        .eq("lead_id", leadId).eq("direction", "inbound").eq("body", text)
        .gte("created_at", new Date(Date.now() - 6 * 60 * 1000).toISOString())
      if ((haveIt ?? 0) === 0) {
        await supabase.from("conversations").insert({
          lead_id: leadId, company_id: integration.company_id,
          direction: "inbound", sent_by: "human", body: text, channel: "messenger", twilio_sid: mid,
        })
      }
      await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId)
      console.log(`[webhook/facebook] office hours — inbound stored for lead ${leadId}, agent off duty`)
      return
    }
  }

  // Run the same AI engine as SMS; saves inbound + outbound with channel=messenger
  try {
    const result = await processAndSave(leadId, integration.company_id, text, mid ?? undefined, undefined, "messenger")
    if (result.response) {
      // Re-check ai_paused RIGHT before sending (finding C19): a human can take
      // over in the dashboard during the multi-second AI generation above — the
      // stale check at the top of this function wouldn't see it, and the AI
      // would talk over the team member.
      const { data: freshLead } = await supabase
        .from("leads").select("ai_paused").eq("id", leadId).maybeSingle()
      if (freshLead?.ai_paused) {
        console.log(`[webhook/facebook] lead ${leadId} became AI-paused mid-generation — reply suppressed`)
        return
      }
      await sendMessengerMessage(integration.fb_access_token, psid, result.response)
      await supabase
        .from("leads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", leadId)
    }

    // Post-booking follow-through. This block existed on SMS and voice but NOT
    // here, so Messenger bookings sent no confirmation SMS/email and never
    // notified the owner — two live bookings landed completely silently.
    // Keyed off THIS turn's action (not lead status), so a later "thanks!"
    // can't re-fire it.
    if ((result.action?.type === "book_appointment" && result.action.outcome !== "noop") || result.action?.type === "reschedule_appointment") {
      const { data: bookedApt } = await supabase
        .from("appointments")
        .select("id, scheduled_at, address")
        .eq("lead_id", leadId)
        .eq("status", "scheduled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (bookedApt) {
        const { sendConfirmations } = await import("@/lib/appointment-reminders")
        sendConfirmations(bookedApt.id).catch((e) =>
          console.error("[webhook/facebook] sendConfirmations failed:", e))

        const { data: leadData } = await supabase
          .from("leads").select("first_name, last_name, phone").eq("id", leadId).single()
        if (leadData) {
          const name = `${leadData.first_name ?? ""} ${leadData.last_name ?? ""}`.trim() || leadData.phone
          const moved = result.action?.type === "reschedule_appointment" ||
            (result.action?.type === "book_appointment" && result.action.outcome === "moved")
          notifyAppointmentBooked(integration.company_id, name, bookedApt.scheduled_at, bookedApt.address ?? "", moved, leadId)
            .catch(() => {})
        }
      }
    }

    if (result.action?.type === "update_status" && result.action.status === "needs_attention") {
      const { data: leadData } = await supabase
        .from("leads").select("first_name, last_name, phone").eq("id", leadId).single()
      if (leadData) {
        const name = `${leadData.first_name ?? ""} ${leadData.last_name ?? ""}`.trim() || leadData.phone
        // Awaited: it stamps the lead, and the follow-up pause below writes the same field.
        await notifyNeedsAttention(integration.company_id, name, leadData.phone, leadId).catch(() => {})
      }
    }

    // Post-reply sequence bookkeeping — the SAME nurture the SMS channel gets
    // (class K fix: Messenger leads who replied but never booked previously
    // got no follow-up of any kind).
    try {
      const { reseedRepliedNotBooked } = await import("@/lib/sequences")
      await reseedRepliedNotBooked(supabase, leadId, integration.company_id, result.action as { type?: string; status?: string } | undefined)
    } catch (e) {
      console.error("[webhook/facebook] sequence reseed failed:", e)
    }
  } catch (e) {
    console.error("[webhook/facebook] Messenger AI error for lead:", leadId, e)
    // Never leave a lead in dead silence mid-conversation — a crash after they
    // just agreed to something reads as being ghosted (adversarial finding 5)
    try {
      await sendMessengerMessage(integration.fb_access_token, psid,
        "Sorry — something glitched on my end for a second. Could you send that one more time?")
    } catch { /* page token failure — nothing more we can do here */ }
  }
}

// GET — Facebook webhook verification challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// POST — Lead Ads submissions and Messenger events
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify Facebook signature — required when FACEBOOK_APP_SECRET is configured.
  // Reject requests with no signature too, not just wrong signatures.
  if (process.env.FACEBOOK_APP_SECRET) {
    const sig = req.headers.get("x-hub-signature-256")
    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }
    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", process.env.FACEBOOK_APP_SECRET)
        .update(rawBody)
        .digest("hex")
    if (sig !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let body: {
    object: string
    entry: Array<{
      id: string
      changes?: Array<{
        field: string
        value: { leadgen_id: string; page_id: string; form_id: string }
      }>
      messaging?: MessagingEvent[]
    }>
  }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Delivery observability — every Meta POST logs one line so Railway logs
  // show whether events are arriving at all (messaging + leadgen counts).
  console.log("[webhook/facebook] delivery:", JSON.stringify({
    object: body.object,
    entries: (body.entry ?? []).map(e => ({
      id: e.id,
      messaging: e.messaging?.length ?? 0,
      changes: (e.changes ?? []).map(c => c.field),
    })),
  }))

  if (body.object !== "page") {
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceRoleClient()

  for (const entry of body.entry) {
    // Messenger conversation events — entry.id is the page ID
    for (const msgEvent of entry.messaging ?? []) {
      try {
        await handleMessagingEvent(entry.id, msgEvent)
      } catch (err) {
        console.error("[webhook/facebook] messaging event crashed:", err)
        // Let Meta's retry through: nothing was stored for this message.
        const failedMid = msgEvent.message?.mid ?? msgEvent.postback?.mid
        if (failedMid) seenMids.delete(failedMid)
      }
    }

    // Lead Ads submissions. All the work lives in lib/meta-leadgen.ts (it is also
    // re-run from the setup wizard to recover leads Facebook refused to release
    // while the connection was broken). One bad event never stops the batch, and
    // Meta always gets its 200: a non-200 makes Meta redeliver the WHOLE batch and,
    // if it keeps happening, disable the subscription for every company.
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue
      const { leadgen_id, page_id, form_id } = change.value
      try {
        const outcome = await handleLeadgenChange(supabase, {
          leadgen_id: String(leadgen_id), page_id: String(page_id), form_id: String(form_id),
        })
        console.log(`[webhook/facebook] leadgen ${leadgen_id} (page ${page_id}, form ${form_id}): ${outcome}`)
      } catch (err) {
        console.error(`[webhook/facebook] leadgen ${leadgen_id} crashed:`, err)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
