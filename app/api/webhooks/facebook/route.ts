import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave, inferJobType } from "@/lib/ai-engine"
import { sendSMS, formatPhone, parseLeadPhone } from "@/lib/twilio"
import { notifyNewLead, notifyAppointmentBooked, notifyNeedsAttention } from "@/lib/notifications"
import { buildNoReplySchedule } from "@/lib/sequences"
import { sendMessengerMessage, getMessengerProfile, messengerPlaceholderPhone } from "@/lib/messenger"
import crypto from "crypto"

// ─── Messenger events (entry[].messaging[]) ───────────────────────────────────
// A lead messages the contractor's Facebook Page → the same AI engine that
// handles SMS replies on Messenger. Replies are always within Meta's 24h
// window because every send here is a direct response to an inbound message.
type MessagingEvent = {
  sender: { id: string }
  recipient: { id: string }
  message?: { mid: string; text?: string; is_echo?: boolean; app_id?: number; attachments?: unknown[] }
  postback?: { title?: string; payload?: string }
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

  const { data: integration } = await supabase
    .from("integrations")
    .select("company_id, fb_access_token")
    .eq("fb_page_id", pageId)
    .eq("is_active", true)
    .single()
  if (!integration?.fb_access_token) {
    console.log("[webhook/facebook] msgEvent: NO active integration for page", pageId)
    return
  }

  // ── Echo = the PAGE sent a message. Two sources: our own AI sends (via the
  // Graph API — they carry OUR app_id) and MANUAL replies a team member typed
  // in Meta's inbox / Business Suite (different or no app_id). A manual reply
  // means a human took over the conversation → pause the AI so it stops
  // auto-replying and doesn't talk over the employee. (WhatsApp/SMS already do
  // this; this brings Messenger to parity.)
  if (event.message?.is_echo) {
    const customerPsid = event.recipient?.id            // echo recipient = the lead
    if (!customerPsid) return
    const ourAppId  = process.env.FACEBOOK_APP_ID
    const echoAppId = event.message.app_id != null ? String(event.message.app_id) : null
    if (echoAppId && ourAppId && echoAppId === ourAppId) return  // our own AI send — ignore

    const { data: lead } = await supabase
      .from("leads")
      .select("id")
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

    await supabase.from("leads").update({ ai_paused: true }).eq("id", lead.id)
    await supabase.from("conversations").insert({
      lead_id: lead.id, company_id: integration.company_id,
      direction: "outbound", sent_by: "human",
      body: echoText || "(manual reply sent from Messenger)", channel: "messenger",
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
    // and the tech's call-ahead all need it.
    if (existing.phone.startsWith("msgr:")) {
      // \s* not \s?: "(312) 555-0187" normalizes to " 312  555 0187" with
      // DOUBLE spaces — \s? missed the most common US phone format, so the
      // lead's real number never replaced the msgr: placeholder and the job
      // could never push to HCP (audit H4)
      const phoneMatch = text.replace(/[^\d+]/g, " ").match(/(\+?1?\s*\d{3}\s*\d{3}\s*\d{4})\b/)
      if (phoneMatch) {
        const realPhone = parseLeadPhone(phoneMatch[1].replace(/\s/g, ""))
        if (realPhone) await supabase.from("leads").update({ phone: realPhone }).eq("id", leadId)
        // invalid → Linda keeps asking
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
        metadata: { page_id: pageId, messenger: true },
      })
      .select("id")
      .single()
    if (!newLead) return
    leadId = newLead.id

    const leadName = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "Messenger lead"
    notifyNewLead(integration.company_id, leadName, "via Messenger", "facebook").catch(() => {})

    // FIRST CONTACT with this PSID — the thread may have a life we never saw
    // (Meta inbox automations, office reps, pre-connect history). Import it so
    // the AI is never history-blind, and if a human/automation already engaged
    // this person recently, the thread is THEIRS: pause the AI and tell the
    // office instead of talking over them. (The Nicole incident: the AI
    // restarted intake minutes after a rep said "we don't service your area".)
    try {
      const { importMessengerHistory } = await import("@/lib/messenger")
      const { imported, humanOwned } = await importMessengerHistory(
        supabase, leadId, integration.company_id,
        integration.fb_access_token, pageId, psid, text
      )
      if (humanOwned) {
        await supabase.from("conversations").insert({
          lead_id: leadId, company_id: integration.company_id,
          direction: "inbound", sent_by: "human", body: text, channel: "messenger",
        })
        await supabase.from("leads").update({
          ai_paused: true,
          status: "needs_attention",
          last_message_at: new Date().toISOString(),
        }).eq("id", leadId)
        const { notifyNeedsAttention } = await import("@/lib/notifications")
        notifyNeedsAttention(
          integration.company_id,
          `${leadName} (existing Messenger thread — a team member or page automation already engaged; AI is holding back. Review the imported history and Resume AI if wanted.)`,
          "via Messenger"
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
      direction: "inbound", sent_by: "human", body: text, channel: "messenger",
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

  // Human took over this conversation (a team member replied manually) → the AI
  // stays quiet. Still record the lead's message so the team sees the full
  // thread in the CRM; just don't generate an AI reply.
  if (existing?.ai_paused) {
    await supabase.from("conversations").insert({
      lead_id: leadId, company_id: integration.company_id,
      direction: "inbound", sent_by: "human", body: text, channel: "messenger",
    })
    await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId)
    console.log(`[webhook/facebook] lead ${leadId} is AI-paused (human handling) — no AI reply`)
    return
  }

  // Run the same AI engine as SMS; saves inbound + outbound with channel=messenger
  try {
    const result = await processAndSave(leadId, integration.company_id, text, undefined, undefined, "messenger")
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
    if (result.action?.type === "book_appointment" || result.action?.type === "reschedule_appointment") {
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
          notifyAppointmentBooked(integration.company_id, name, bookedApt.scheduled_at, bookedApt.address ?? "")
            .catch(() => {})
        }
      }
    }

    if (result.action?.type === "update_status" && result.action.status === "needs_attention") {
      const { data: leadData } = await supabase
        .from("leads").select("first_name, last_name, phone").eq("id", leadId).single()
      if (leadData) {
        const name = `${leadData.first_name ?? ""} ${leadData.last_name ?? ""}`.trim() || leadData.phone
        notifyNeedsAttention(integration.company_id, name, leadData.phone).catch(() => {})
      }
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

// POST — Receive leadgen events
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
      await handleMessagingEvent(entry.id, msgEvent)
    }

    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue

      const { leadgen_id, page_id, form_id } = change.value

      // Look up company by Facebook page ID
      const { data: integration } = await supabase
        .from("integrations")
        .select("company_id, fb_access_token")
        .eq("fb_page_id", page_id)
        .eq("is_active", true)
        .single()

      if (!integration) continue

      // Fetch lead field data from Facebook Graph API
      const leadRes = await fetch(
        `https://graph.facebook.com/${leadgen_id}?fields=field_data&access_token=${integration.fb_access_token}`
      )
      const leadData = await leadRes.json()
      if (!leadData.field_data) continue

      // Normalize field_data array into a flat object. Keys are whatever the
      // contractor typed as the form question — strip ALL punctuation, not
      // just spaces ("What is your phone number?" → what_is_your_phone_number)
      const fields: Record<string, string> = {}
      for (const f of leadData.field_data as Array<{ name: string; values: string[] }>) {
        const key = f.name.toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "")
        fields[key] = f.values?.[0] ?? ""
      }

      // ── Phone extraction: exact keys → key contains phone/mobile/cell →
      // any field whose VALUE looks like a phone number. Ad forms name this
      // field freely ("what_is_your_phone_number") — an unrecognized key must
      // NEVER cost the contractor a paid lead.
      const looksLikePhone = (v: string) => {
        const digits = v.replace(/\D/g, "")
        return digits.length >= 10 && digits.length <= 15 && /^[+\d(]/.test(v.trim())
      }
      let rawPhone =
        fields["phone_number"] || fields["phone"] || fields["mobile_phone"] || fields["mobile"] || ""
      if (!rawPhone) {
        for (const [k, v] of Object.entries(fields)) {
          if (v && /phone|mobile|cell/.test(k) && looksLikePhone(v)) { rawPhone = v; break }
        }
      }
      if (!rawPhone) {
        for (const v of Object.values(fields)) {
          if (v && looksLikePhone(v)) { rawPhone = v; break }
        }
      }

      // STRICT parse: returns valid E.164 or null. The lenient formatPhone
      // turned "no phone" into "+" (an invisible, undeliverable lead that also
      // dedupe-swallowed every later bad-phone lead) and "…ext 2" into a
      // Dutch number (adversarial-verify finding 8).
      const phone: string | null = parseLeadPhone(rawPhone)

      // Email: exact keys, then any key containing "email", then value match
      let leadEmail = fields["email"] || fields["email_address"] || ""
      if (!leadEmail) {
        for (const [k, v] of Object.entries(fields)) {
          if (v && (/email/.test(k) || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v))) { leadEmail = v; break }
        }
      }

      const fullName = fields["full_name"] || fields["name"] || fields["your_name"] || fields["what_is_your_name"] || ""
      const firstName = fields["first_name"] || fullName.split(" ")[0] || null
      const lastName =
        fields["last_name"] ||
        (fullName.includes(" ") ? fullName.split(" ").slice(1).join(" ") : null)

      // Zip from the form — previously discarded entirely; routing and the AI
      // both want it
      const formZip = (fields["zip"] || fields["zip_code"] || fields["postal_code"] ||
        Object.entries(fields).find(([k, v]) => /zip|postal/.test(k) && /^\d{5}/.test(v ?? ""))?.[1] || "")
        .match(/\d{5}/)?.[0] ?? null

      // Extract job/project details from any non-identity form fields.
      // Facebook lead forms often include custom questions like "What type of service do you need?"
      // We capture everything that isn't phone/name/email/location as notes so the AI can use it.
      const ADDRESS_KEYS = [
        "street_address", "address", "home_address", "lead_address",
        "property_address", "service_address", "full_address", "mailing_address",
      ]
      const IDENTITY_KEYS = new Set([
        "phone_number", "phone", "mobile_phone", "mobile",
        "first_name", "last_name", "full_name", "email", "email_address",
        "city", "state", "zip", "zip_code", "country", "postal_code",
        ...ADDRESS_KEYS,
      ])
      const JOB_TYPE_KEYS = [
        "job_type", "service_type", "service_requested", "service_needed",
        "type_of_service", "project_type", "service_interest",
        "what_type_of_service", "what_service_do_you_need",
      ]

      // Pull address from any recognised address field name
      let leadAddress: string | null = null
      for (const k of ADDRESS_KEYS) {
        if (fields[k]) { leadAddress = fields[k]; break }
      }

      // Pull explicit job-type field first
      let jobType: string | null = null
      for (const k of JOB_TYPE_KEYS) {
        if (fields[k]) { jobType = fields[k]; break }
      }

      // Collect all remaining custom question answers as notes. Skip identity
      // keys by EXACT name and also by fuzzy class (a phone captured from
      // "what_is_your_phone_number" must not leak into notes as a question).
      const extraParts: string[] = []
      if (jobType) extraParts.push(jobType)
      for (const [k, v] of Object.entries(fields)) {
        if (!v || IDENTITY_KEYS.has(k) || JOB_TYPE_KEYS.includes(k)) continue
        if (/phone|mobile|cell|email|zip|postal|name$/.test(k)) continue
        // Format the key nicely: "what_is_the_issue" → "What is the issue"
        const label = k.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())
        extraParts.push(`${label}: ${v}`)
      }
      if (formZip) extraParts.push(`Zip: ${formZip}`)
      // Unparseable phone: keep exactly what the lead typed — the owner may
      // still be able to read a real number out of it ("'6305551234", "630 555
      // 0187 ext 2"); losing it entirely made call-back impossible.
      if (rawPhone && !parseLeadPhone(rawPhone)) extraParts.push(`Phone (as typed): ${rawPhone}`)
      const formNotes = extraParts.length > 0 ? extraParts.join(" | ") : null

      // NEVER drop a paid lead. If no phone could be extracted, the lead still
      // gets created under a deterministic placeholder (dedupes Facebook's
      // webhook retries) with needs_attention so the owner sees it and calls
      // back manually — a silent drop is the one unforgivable outcome here.
      const effectivePhone = phone ?? `fbform:${leadgen_id}`
      if (!phone) {
        console.error(`[webhook/facebook] leadgen ${leadgen_id} (form ${form_id}): no phone field recognized — creating needs_attention lead. Keys: ${Object.keys(fields).join(",")}`)
      }

      // Upsert lead — excludes soft-deleted leads so a deleted lead's phone
      // number gets a clean slate instead of silently resurrecting old
      // history (see app/api/webhooks/lead/route.ts for the full reasoning)
      const { data: existing } = await supabase
        .from("leads")
        .select("id, status")
        .eq("company_id", integration.company_id)
        .eq("phone", effectivePhone)
        .is("deleted_at", null)
        .maybeSingle()

      let leadId: string
      let isNewLead = false

      if (existing) {
        // Opted-out leads stay opted out — a redelivered payload or genuine
        // re-submission must NOT revive an ai_paused lead into the texting
        // pipeline (adversarial-verify finding 3). Log + notify only.
        const { data: fullExisting } = await supabase
          .from("leads").select("ai_paused").eq("id", existing.id).single()
        if (fullExisting?.ai_paused) {
          console.log(`[webhook/facebook] leadgen for opted-out/paused lead ${existing.id} — not reviving, notifying owner`)
          notifyNewLead(integration.company_id, "Opted-out lead re-submitted a form", phone ?? "", "facebook").catch(() => {})
          continue
        }
        if (existing.status === "cold" || existing.status === "closed_lost") {
          await supabase
            .from("leads")
            .update({ status: "just_came_in", updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        }
        leadId = existing.id
      } else {
        isNewLead = true
        const { data: newLead } = await supabase
          .from("leads")
          .insert({
            company_id: integration.company_id,
            phone: effectivePhone,
            first_name: firstName,
            last_name: lastName,
            email: leadEmail || null,
            address: leadAddress ?? (formZip ? formZip : null),
            source: "facebook",
            channel: "sms",
            source_form_id: form_id,
            status: phone ? "just_came_in" : "needs_attention",
            notes: formNotes,
            metadata: { leadgen_id, page_id, form_id, job_type: jobType, ...(formZip ? { service_zip: formZip } : {}), ...(phone ? {} : { phone_missing: true, form_keys: Object.keys(fields) }) },
            // Pre-classify the job_type COLUMN (the metadata job_type above is
            // the raw form field text) so the first AI turn runs the focused
            // job playbook instead of the identify module
            job_type: inferJobType([jobType, formNotes].filter(Boolean).join(" ")),
          })
          .select("id")
          .single()

        if (!newLead) continue
        leadId = newLead.id

        // Notify contractor of new lead (non-blocking)
        const leadName = `${firstName ?? ""} ${lastName ?? ""}`.trim()
        notifyNewLead(integration.company_id, leadName, phone ?? "no phone on form — call back needed", "facebook").catch(() => {})
      }

      // Update integration stats
      await supabase
        .from("integrations")
        .update({ last_lead_at: new Date().toISOString() })
        .eq("company_id", integration.company_id)
        .eq("type", "facebook")

      // No real phone → no SMS opener and no SMS sequences. The lead exists,
      // the owner was notified with needs_attention; texting a placeholder
      // would only generate Twilio errors.
      if (!phone) continue

      // Meta redelivers webhooks whenever our (slow) first processing misses
      // its timeout — the existing-lead path then ran processAndSave(null)
      // again, generating a spurious follow-up seconds after the opener
      // (adversarial-verify finding 1). Once a lead has ANY outbound message,
      // subsequent leadgen deliveries only refresh the record — never re-text.
      if (!isNewLead) {
        const { count: outboundCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("lead_id", leadId)
          .eq("direction", "outbound")
        if ((outboundCount ?? 0) > 0) continue
      }

      // Get company's Twilio number and send AI opening message
      const { data: phoneNumber } = await supabase
        .from("phone_numbers")
        .select("phone_number")
        .eq("company_id", integration.company_id)
        .eq("is_active", true)
        .single()

      if (!phoneNumber?.phone_number) continue

      // Fetch company timezone for accurate local-time scheduling
      const { data: agentCfg } = await supabase
        .from("ai_agent_config")
        .select("timezone")
        .eq("company_id", integration.company_id)
        .single()
      const companyTimezone = agentCfg?.timezone ?? "America/New_York"

      try {
        const result = await processAndSave(leadId, integration.company_id, null)
        if (result.response) {
          const msg = await sendSMS(phone, result.response, phoneNumber.phone_number)
          if (result.outboundConversationId) {
            await supabase
              .from("conversations")
              .update({ twilio_sid: msg.sid })
              .eq("id", result.outboundConversationId)
          }

          await supabase
            .from("leads")
            .update({ status: "contacted", last_message_at: new Date().toISOString() })
            .eq("id", leadId)

          // Pre-create all 7 no_reply follow-up steps — guard against duplicates
          // (Facebook retries the webhook on non-200 responses)
          const { count: existingSteps } = await supabase
            .from("sequences")
            .select("*", { count: "exact", head: true })
            .eq("lead_id", leadId)
            .eq("sequence_type", "no_reply")
            .eq("status", "pending")

          if ((existingSteps ?? 0) === 0) {
            const steps = buildNoReplySchedule(new Date(), companyTimezone)
            const { error: seqError } = await supabase.from("sequences").insert(
              steps.map((s) => ({
                lead_id: leadId,
                company_id: integration.company_id,
                sequence_type: "no_reply",
                step: s.step,
                scheduled_at: s.scheduledAt.toISOString(),
                status: "pending",
              }))
            )
            if (seqError) {
              console.error(`[webhook/facebook] Failed to insert sequences for lead ${leadId}:`, seqError)
            }
          }
        }
      } catch (e) {
        console.error("AI/SMS error for Facebook lead:", leadId, e)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
