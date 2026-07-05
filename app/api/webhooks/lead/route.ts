import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave, inferJobType } from "@/lib/ai-engine"
import { sendSMS, formatPhone } from "@/lib/twilio"
import { notifyNewLead } from "@/lib/notifications"
import { normalizeLead } from "@/lib/normalize-lead"
import { buildNoReplySchedule } from "@/lib/sequences"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * Extracts the webhook secret from wherever the caller put it:
 *   1. x-webhook-secret header  (preferred)
 *   2. Authorization: Bearer <secret> header
 *   3. ?secret= query param  (most form builders can append to URL)
 *   4. secret / webhook_secret field inside the body
 */
function extractSecret(req: NextRequest, body: Record<string, unknown>): string | null {
  return (
    req.headers.get("x-webhook-secret") ||
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() || null ||
    new URL(req.url).searchParams.get("secret") ||
    new URL(req.url).searchParams.get("key") ||
    (typeof body.secret === "string" ? body.secret : null) ||
    (typeof body.webhook_secret === "string" ? body.webhook_secret : null) ||
    null
  )
}

/**
 * Parses the request body regardless of Content-Type.
 * Handles: application/json, application/x-www-form-urlencoded,
 * multipart/form-data, and plain-text JSON with wrong content-type.
 */
async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? ""

  // application/json or no content-type — try JSON first
  if (ct.includes("application/json") || ct === "") {
    try {
      return await req.json()
    } catch {
      // fall through
    }
  }

  // application/x-www-form-urlencoded or multipart/form-data
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    try {
      const form = await req.formData()
      const obj: Record<string, unknown> = {}
      form.forEach((value, key) => { obj[key] = value })
      return obj
    } catch {
      // fall through
    }
  }

  // Last resort: read raw text and try to parse as JSON
  try {
    const text = await req.text()
    if (text.trim().startsWith("{")) return JSON.parse(text)
    // Try URL-encoded as plain text
    const params = new URLSearchParams(text)
    const obj: Record<string, unknown> = {}
    params.forEach((value, key) => { obj[key] = value })
    if (Object.keys(obj).length > 0) return obj
  } catch {
    // fall through
  }

  return {}
}

// GET support: some no-code tools send lead data as query params
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const body: Record<string, unknown> = {}
  searchParams.forEach((value, key) => { body[key] = value })
  return handleLead(req, body)
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req)
  return handleLead(req, body)
}

async function handleLead(req: NextRequest, body: Record<string, unknown>) {
  const supabase = createServiceRoleClient()

  let company: { id: string; service_type: string | null } | null = null

  const secret = extractSecret(req, body)

  if (secret) {
    const { data } = await supabase
      .from("companies")
      .select("id, service_type")
      .eq("webhook_secret", secret)
      .single()
    company = data
    if (!company) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401, headers: CORS_HEADERS })
    }
  } else {
    // No secret — try company_id from query/body, then fall back to the single company
    const companyId =
      new URL(req.url).searchParams.get("company_id") ||
      (typeof body.company_id === "string" ? body.company_id : null)

    if (companyId) {
      const { data } = await supabase
        .from("companies")
        .select("id, service_type")
        .eq("id", companyId)
        .single()
      company = data
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404, headers: CORS_HEADERS })
      }
    } else {
      // No identifier — safe single-tenant fallback. Returns 401 when >1 company exists,
      // so this is safe for multi-tenant. Clients must include webhook_secret or company_id.
      const { data: companies } = await supabase
        .from("companies")
        .select("id, service_type")
        .limit(2)
      if (!companies || companies.length === 0) {
        return NextResponse.json({ error: "No company configured" }, { status: 404, headers: CORS_HEADERS })
      }
      if (companies.length > 1) {
        return NextResponse.json({ error: "Multiple companies exist — include company_id or webhook_secret" }, { status: 401, headers: CORS_HEADERS })
      }
      company = companies[0]
    }
  }

  const lead = normalizeLead(body)

  if (!lead.phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400, headers: CORS_HEADERS })
  }
  const phone = formatPhone(lead.phone)

  // Upsert lead — idempotent on phone + company_id. Excludes soft-deleted
  // leads (deleted_at set): a contractor who deletes a lead expects that
  // person to get a clean slate if they reach out again, not to silently
  // resurrect the deleted record and its old conversation history — which
  // also meant the AI would take the "follow-up" path instead of writing a
  // fresh opener, and could come back with nothing to send at all.
  const { data: existing } = await supabase
    .from("leads")
    .select("id, status")
    .eq("company_id", company.id)
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
    const { data: newLead, error } = await supabase
      .from("leads")
      .insert({
        company_id: company.id,
        phone,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        address: lead.address,
        notes: lead.notes,
        service_type: lead.service_type ?? company.service_type ?? null,
        source: (body.source as "facebook" | "webhook" | "manual") ?? "webhook",
        source_form_id: lead.source_form_id,
        metadata: lead.metadata,
        status: "just_came_in",
        // Pre-classify from the form notes so the very first AI turn already
        // runs the focused job-type playbook instead of the identify module
        job_type: inferJobType(lead.notes ?? ""),
      })
      .select("id")
      .single()

    if (error || !newLead) {
      console.error("Failed to create lead:", error)
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500, headers: CORS_HEADERS })
    }
    leadId = newLead.id

    const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
    notifyNewLead(company.id, leadName, phone, (body.source as string) ?? "webhook").catch(() => {})
  }

  const { data: phoneNumber } = await supabase
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .single()

  if (!phoneNumber?.phone_number) {
    console.warn(`Company ${company.id} has no active phone number — skipping SMS`)
    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: false }, { headers: CORS_HEADERS })
  }

  const { data: agentCfg } = await supabase
    .from("ai_agent_config")
    .select("timezone")
    .eq("company_id", company.id)
    .single()
  const companyTimezone = agentCfg?.timezone ?? "America/New_York"

  let smsSent = false

  try {
    const result = await processAndSave(leadId, company.id, null)

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
      smsSent = true
    }
  } catch (err) {
    console.error("AI engine / SMS error:", err)
  }

  // Always create no_reply sequences — even if SMS failed. Guard against duplicates.
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
      if (seqError) {
        console.error(`[webhook/lead] Failed to insert sequences for lead ${leadId}:`, seqError)
      }
    }
  } catch (err) {
    console.error("[webhook/lead] Sequence creation error:", err)
  }

  return NextResponse.json({ success: true, lead_id: leadId, sms_sent: smsSent }, { headers: CORS_HEADERS })
}
