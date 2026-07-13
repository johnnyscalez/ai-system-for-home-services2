import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave, inferJobType } from "@/lib/ai-engine"
import { sendSMS, formatPhone } from "@/lib/twilio"
import { notifyNewLead } from "@/lib/notifications"
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
  message?: { mid: string; text?: string; is_echo?: boolean; attachments?: unknown[] }
  postback?: { title?: string; payload?: string }
}

async function handleMessagingEvent(pageId: string, event: MessagingEvent): Promise<void> {
  const supabase = createServiceRoleClient()

  // Ignore echoes of our own sends and delivery/read receipts
  if (event.message?.is_echo) return
  const text = event.message?.text?.trim()
    ?? event.postback?.title?.trim()
    ?? (event.message?.attachments?.length ? "[sent an attachment]" : null)
  if (!text) return

  const psid = event.sender.id

  const { data: integration } = await supabase
    .from("integrations")
    .select("company_id, fb_access_token")
    .eq("fb_page_id", pageId)
    .eq("is_active", true)
    .single()
  if (!integration?.fb_access_token) return

  // Find or create the lead by Messenger PSID
  const { data: existing } = await supabase
    .from("leads")
    .select("id, status, phone")
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
      const phoneMatch = text.replace(/[^\d+]/g, " ").match(/(\+?1?\s?\d{3}\s?\d{3}\s?\d{4})\b/)
      if (phoneMatch) {
        try {
          const realPhone = formatPhone(phoneMatch[1].replace(/\s/g, ""))
          await supabase.from("leads").update({ phone: realPhone }).eq("id", leadId)
        } catch { /* not a parseable number — Linda keeps asking */ }
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
  }

  // Run the same AI engine as SMS; saves inbound + outbound with channel=messenger
  try {
    const result = await processAndSave(leadId, integration.company_id, text, undefined, undefined, "messenger")
    if (result.response) {
      await sendMessengerMessage(integration.fb_access_token, psid, result.response)
      await supabase
        .from("leads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", leadId)
    }
  } catch (e) {
    console.error("[webhook/facebook] Messenger AI error for lead:", leadId, e)
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

      // Normalize field_data array into a flat object
      const fields: Record<string, string> = {}
      for (const f of leadData.field_data as Array<{ name: string; values: string[] }>) {
        fields[f.name.toLowerCase().replace(/\s+/g, "_")] = f.values?.[0] ?? ""
      }

      const rawPhone =
        fields["phone_number"] ||
        fields["phone"] ||
        fields["mobile_phone"] ||
        fields["mobile"] ||
        ""
      if (!rawPhone) continue

      const phone = formatPhone(rawPhone)
      const fullName = fields["full_name"] || ""
      const firstName = fields["first_name"] || fullName.split(" ")[0] || null
      const lastName =
        fields["last_name"] ||
        (fullName.includes(" ") ? fullName.split(" ").slice(1).join(" ") : null)

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

      // Collect all remaining custom question answers as notes
      const extraParts: string[] = []
      if (jobType) extraParts.push(jobType)
      for (const [k, v] of Object.entries(fields)) {
        if (!v || IDENTITY_KEYS.has(k) || JOB_TYPE_KEYS.includes(k)) continue
        // Format the key nicely: "what_is_the_issue" → "What is the issue"
        const label = k.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())
        extraParts.push(`${label}: ${v}`)
      }
      const formNotes = extraParts.length > 0 ? extraParts.join(" | ") : null

      // Upsert lead — excludes soft-deleted leads so a deleted lead's phone
      // number gets a clean slate instead of silently resurrecting old
      // history (see app/api/webhooks/lead/route.ts for the full reasoning)
      const { data: existing } = await supabase
        .from("leads")
        .select("id, status")
        .eq("company_id", integration.company_id)
        .eq("phone", phone)
        .is("deleted_at", null)
        .maybeSingle()

      let leadId: string

      if (existing) {
        if (existing.status === "cold" || existing.status === "closed_lost") {
          await supabase
            .from("leads")
            .update({ status: "just_came_in", updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        }
        leadId = existing.id
      } else {
        const { data: newLead } = await supabase
          .from("leads")
          .insert({
            company_id: integration.company_id,
            phone,
            first_name: firstName,
            last_name: lastName,
            email: fields["email"] || null,
            address: leadAddress,
            source: "facebook",
            channel: "sms",
            source_form_id: form_id,
            status: "just_came_in",
            notes: formNotes,
            metadata: { leadgen_id, page_id, form_id, job_type: jobType },
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
        notifyNewLead(integration.company_id, leadName, phone, "facebook").catch(() => {})
      }

      // Update integration stats
      await supabase
        .from("integrations")
        .update({ last_lead_at: new Date().toISOString() })
        .eq("company_id", integration.company_id)
        .eq("type", "facebook")

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
