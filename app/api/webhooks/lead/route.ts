import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, formatPhone } from "@/lib/twilio"
import { notifyNewLead } from "@/lib/notifications"
import { normalizeLead } from "@/lib/normalize-lead"

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
  const secret = extractSecret(req, body)
  if (!secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 401, headers: CORS_HEADERS })
  }

  const supabase = createServiceRoleClient()

  const { data: company } = await supabase
    .from("companies")
    .select("id, service_type")
    .eq("webhook_secret", secret)
    .single()

  if (!company) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401, headers: CORS_HEADERS })
  }

  const lead = normalizeLead(body)

  if (!lead.phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400, headers: CORS_HEADERS })
  }
  const phone = formatPhone(lead.phone)

  // Upsert lead — idempotent on phone + company_id
  const { data: existing } = await supabase
    .from("leads")
    .select("id, status")
    .eq("company_id", company.id)
    .eq("phone", phone)
    .maybeSingle()

  let leadId: string

  if (existing) {
    if (existing.status === "cold" || existing.status === "closed_lost") {
      await supabase
        .from("leads")
        .update({ status: "new", updated_at: new Date().toISOString() })
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
        status: "new",
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

      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      await supabase.from("sequences").insert({
        lead_id: leadId,
        company_id: company.id,
        sequence_type: "no_reply",
        step: 1,
        scheduled_at: oneHourFromNow,
        status: "pending",
      })
    }

    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: true }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error("AI engine / SMS error:", err)
    return NextResponse.json({ success: true, lead_id: leadId, sms_sent: false }, { headers: CORS_HEADERS })
  }
}
