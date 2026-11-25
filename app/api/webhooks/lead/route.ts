import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave, inferJobType } from "@/lib/ai-engine"
import { sendToLead, parseLeadPhone, describeTwilioError } from "@/lib/twilio"
import { notifyNewLead } from "@/lib/notifications"
import { normalizeLead, normalizeSource, channelForSource, mergeLeadMetadata } from "@/lib/normalize-lead"
import { buildNoReplySchedule } from "@/lib/sequences"
import { loadIntake, saveIntake } from "@/lib/intake"
import { isCompleteServiceAddress } from "@/lib/routing"

// The generic lead webhook: landing pages, Zapier, Make, GoHighLevel, any form.
//
//   POST https://fieldbuiltai.com/api/webhooks/lead?secret=<company webhook secret>
//
// Authentication is the company's webhook secret, nothing else. (This endpoint
// used to accept a bare company_id, and with a single company in the database
// it accepted no identifier at all. Since a lead makes the system TEXT that
// phone number from the company's line, that was an open door.)
//
// Field mapping lives in lib/normalize-lead.ts: automatic by field name, with the
// company's own overrides from Integrations → Lead webhook.
//
// Add ?dry_run=1 to see how a payload maps without creating a lead or texting.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret, Authorization",
}

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS })

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * The secret, from wherever the caller could put it:
 *   1. x-webhook-secret header  (preferred)
 *   2. Authorization: Bearer <secret>
 *   3. ?secret= or ?key= in the URL  (form builders that only take a URL)
 *   4. secret / webhook_secret in the body
 */
function extractSecret(req: NextRequest, body: Record<string, unknown>): string | null {
  const url = new URL(req.url)
  return (
    req.headers.get("x-webhook-secret") ||
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() ||
    url.searchParams.get("secret") ||
    url.searchParams.get("key") ||
    (typeof body.secret === "string" ? body.secret : null) ||
    (typeof body.webhook_secret === "string" ? body.webhook_secret : null) ||
    null
  )
}

/** Parses the body whatever the Content-Type: JSON, form-encoded, multipart, or mislabeled JSON. */
async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? ""
  const text = await req.text().catch(() => "")
  if (!text.trim()) return {}

  if (ct.includes("multipart/form-data")) {
    try {
      const form = await new Response(text, { headers: { "content-type": ct } }).formData()
      const obj: Record<string, unknown> = {}
      form.forEach((value, key) => { if (typeof value === "string") obj[key] = value })
      return obj
    } catch { /* fall through */ }
  }
  const trimmed = text.trim()
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return (parsed[0] && typeof parsed[0] === "object") ? parsed[0] : {}
      if (parsed && typeof parsed === "object") return parsed
    } catch { /* fall through */ }
  }
  try {
    const params = new URLSearchParams(text)
    const obj: Record<string, unknown> = {}
    params.forEach((value, key) => { obj[key] = value })
    return obj
  } catch {
    return {}
  }
}

// Some no-code tools can only send a GET with the lead in the query string.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const body: Record<string, unknown> = {}
  searchParams.forEach((value, key) => { body[key] = value })
  return handleLead(req, body)
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req)
  // Query-string fields are merged in (a URL-only form builder may add ?source=).
  const { searchParams } = new URL(req.url)
  searchParams.forEach((value, key) => { if (!(key in body)) body[key] = value })
  return handleLead(req, body)
}

async function handleLead(req: NextRequest, body: Record<string, unknown>) {
  const supabase = createServiceRoleClient()

  const secret = extractSecret(req, body)
  if (!secret) {
    return json({ error: "Missing webhook secret. Add ?secret=YOUR_SECRET to the URL or send it in the x-webhook-secret header." }, 401)
  }
  const { data: company } = await supabase
    .from("companies")
    .select("id, service_type")
    .eq("webhook_secret", secret)
    .maybeSingle()
  if (!company) return json({ error: "Invalid webhook secret" }, 401)

  const intake = await loadIntake(supabase, company.id).catch(() => null)
  const lead = normalizeLead(body, intake?.leadFieldMap ?? {})
  const source = normalizeSource(body.source)
  const dryRun = ["1", "true", "yes"].includes(String(body.dry_run ?? body.test ?? "").toLowerCase())

  const phone = lead.phone ? parseLeadPhone(lead.phone) : null
  const jobType = inferJobType(`${lead.job_type_raw ?? ""} ${lead.notes ?? ""}`)
  const address = isCompleteServiceAddress(lead.address) ? lead.address : null

  const mapped = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    phone,
    email: lead.email,
    address,
    zip: lead.zip,
    job_type: jobType,
    notes: lead.notes,
    qualification: lead.qualification,
    form_answers: lead.form_answers,
    source,
  }

  if (dryRun) {
    return json({
      dry_run: true,
      valid: !!phone,
      problem: !lead.phone ? "No phone field found" : !phone ? `Phone not usable: "${lead.phone}"` : null,
      mapped,
      fields: lead.mapping,
    })
  }

  // Remember the last payload's shape so the mapping screen can show real field names.
  if (lead.mapping.length > 0) {
    saveIntake(supabase, company.id, {
      lastWebhookSample: {
        receivedAt: new Date().toISOString(),
        source,
        fields: lead.mapping.map((m) => ({ key: m.key, target: m.target, how: m.how, sample: m.value })),
      },
    }).catch(() => {})
  }

  if (!lead.phone) return json({ error: "Phone number required", fields: lead.mapping }, 400)
  if (!phone) return json({ error: `Phone number not parseable: "${lead.phone}"` }, 400)

  // A street that is not a full address (no house number) is still worth keeping
  // for the assistant, just not as the address a visit is booked to.
  if (lead.address && !address) lead.form_answers["Address as entered"] = lead.address
  const incomingMeta: Record<string, unknown> = {
    ...lead.metadata,
    ...(Object.keys(lead.form_answers).length > 0 ? { form_answers: lead.form_answers } : {}),
  }

  // Upsert on phone + company. Soft-deleted leads are excluded: a contractor who
  // deletes a lead expects that person to get a clean slate if they come back.
  const { data: existing } = await supabase
    .from("leads")
    .select("id, status, ai_paused, metadata, first_name, last_name, email, address, zip, job_type, notes")
    .eq("company_id", company.id)
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle()

  let leadId: string

  if (existing) {
    // Never revive an opted-out lead into automated outreach: a re-delivered
    // payload must not undo a STOP.
    if (existing.ai_paused) {
      return json({ ok: true, lead_id: existing.id, skipped: "lead opted out or is being handled by a person" })
    }
    // A second submission: keep what we have, add what is new.
    const patch: Record<string, unknown> = {
      metadata: mergeLeadMetadata(existing.metadata as Record<string, unknown> | null, incomingMeta),
      updated_at: new Date().toISOString(),
    }
    if (!existing.first_name && lead.first_name) patch.first_name = lead.first_name
    if (!existing.last_name && lead.last_name) patch.last_name = lead.last_name
    if (!existing.email && lead.email) patch.email = lead.email
    if (!existing.address && address) patch.address = address
    if (!existing.zip && lead.zip) patch.zip = lead.zip
    if (!existing.job_type && jobType) patch.job_type = jobType
    if (lead.notes && !(existing.notes ?? "").includes(lead.notes)) {
      patch.notes = existing.notes ? `${existing.notes} | ${lead.notes}` : lead.notes
    }
    if (["cold", "closed_lost", "lost"].includes(existing.status)) patch.status = "just_came_in"
    await supabase.from("leads").update(patch).eq("id", existing.id)
    leadId = existing.id
  } else {
    const { data: newLead, error } = await supabase
      .from("leads")
      .insert({
        company_id: company.id,
        phone,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        address,
        zip: lead.zip,
        notes: lead.notes,
        service_type: lead.service_type ?? company.service_type ?? null,
        source,
        channel: channelForSource(source),
        source_form_id: lead.source_form_id,
        metadata: incomingMeta,
        status: "just_came_in",
        job_type: jobType,
      })
      .select("id")
      .single()

    if (error || !newLead) {
      console.error("[webhook/lead] failed to create lead:", error)
      return json({ error: "Failed to create lead" }, 500)
    }
    leadId = newLead.id

    const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
    notifyNewLead(company.id, leadName, phone, source, leadId).catch(() => {})
  }

  // Redelivery guard: Zapier, Make and most form tools retry slow responses.
  // Once a lead has any outbound message, a re-delivered payload never
  // triggers a second opener.
  {
    const { count: outboundCount } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("direction", "outbound")
    if ((outboundCount ?? 0) > 0) {
      return json({ ok: true, lead_id: leadId, deduped: true, mapped })
    }
  }

  const { data: phoneNumber } = await supabase
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!phoneNumber?.phone_number) {
    console.warn(`[webhook/lead] company ${company.id} has no texting number, lead ${leadId} saved without an opener`)
    return json({ success: true, lead_id: leadId, sms_sent: false, sms_problem: "No texting number is set up for this account", mapped })
  }

  const { data: agentCfg } = await supabase
    .from("ai_agent_config")
    .select("timezone")
    .eq("company_id", company.id)
    .maybeSingle()
  const companyTimezone = agentCfg?.timezone ?? "America/New_York"

  let smsSent = false
  let smsProblem: string | null = null

  try {
    const result = await processAndSave(leadId, company.id, null)

    if (result.response) {
      try {
        // The company's own transport (GoHighLevel when connected, then Twilio)
        // so the opener and every later message come from ONE number.
        const { sid } = await sendToLead(
          { id: leadId, phone, channel: "sms" },
          result.response,
          phoneNumber.phone_number,
          company.id
        )
        if (result.outboundConversationId) {
          await supabase.from("conversations").update({ twilio_sid: sid }).eq("id", result.outboundConversationId)
        }
        await supabase
          .from("leads")
          .update({ status: "contacted", last_message_at: new Date().toISOString() })
          .eq("id", leadId)
        smsSent = true
      } catch (sendErr) {
        const code = (sendErr as { code?: number })?.code
        smsProblem = describeTwilioError(sendErr)
        console.error(`[webhook/lead] opener for lead ${leadId} was not accepted (code ${code ?? "?"}):`, sendErr)
        if (result.outboundConversationId) {
          await supabase.from("conversations")
            .update({ delivery_status: "failed", delivery_error_code: code ? String(code) : null })
            .eq("id", result.outboundConversationId)
        }
      }
    } else {
      smsProblem = "The assistant is paused for this account (billing or office hours), so no opener was sent"
    }
  } catch (err) {
    smsProblem = "The assistant could not write an opener"
    console.error("[webhook/lead] AI engine error:", err)
  }

  // The no-reply sequence is created even when the opener failed, so a transient
  // send problem does not leave the lead with nothing. Never duplicated.
  try {
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
          company_id: company.id,
          sequence_type: "no_reply",
          step: s.step,
          scheduled_at: s.scheduledAt.toISOString(),
          status: "pending",
        }))
      )
      if (seqError) console.error(`[webhook/lead] failed to insert sequences for lead ${leadId}:`, seqError)
    }
  } catch (err) {
    console.error("[webhook/lead] sequence creation error:", err)
  }

  return json({ success: true, lead_id: leadId, sms_sent: smsSent, ...(smsProblem ? { sms_problem: smsProblem } : {}), mapped })
}
