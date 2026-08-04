import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave, inferJobType } from "@/lib/ai-engine"
import { formatPhone } from "@/lib/twilio"
import { companyFromWebhookSecret, getGhlConnection, sendGhlSms } from "@/lib/ghl"
import { buildNoReplySchedule } from "@/lib/sequences"
import { notifyNewLead } from "@/lib/notifications"
import { qualifyFromFormFields } from "@/lib/fieldbuilt-qualify"

// New lead arriving FROM GoHighLevel.
//
// GHL owns the Facebook Instant Form connection, so the lead lands in their
// CRM first; a GHL Workflow then posts it here. We create the FieldBuilt lead,
// keep the GHL contact id, and the agent replies through the contractor's own
// A2P-verified GHL number — so the whole conversation stays on the thread
// their team already watches.
//
// GHL Workflow → Webhook action:
//   POST /api/webhooks/ghl/lead
//   Header: x-webhook-secret: <company webhook_secret>
//   Body:   { "contactId": "{{contact.id}}", "phone": "{{contact.phone}}",
//             "firstName": "{{contact.first_name}}", "lastName": "{{contact.last_name}}",
//             "email": "{{contact.email}}", ...any custom form fields }

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const secret =
    req.headers.get("x-webhook-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    (typeof body.secret === "string" ? body.secret : null)

  const companyId = await companyFromWebhookSecret(secret)
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  const rawPhone = str(body.phone) ?? str(body.mobile) ?? str(body.phoneNumber)
  if (!rawPhone) return NextResponse.json({ error: "phone is required" }, { status: 400 })
  const phone = formatPhone(rawPhone)

  const ghlContactId = str(body.contactId) ?? str(body.contact_id)
  const db = createServiceRoleClient()

  // Everything that isn't an identity field is form answers worth keeping —
  // that's what the AI qualifies and personalises from.
  const IDENTITY = new Set([
    "contactid", "contact_id", "phone", "mobile", "phonenumber", "firstname",
    "first_name", "lastname", "last_name", "email", "secret", "locationid", "location_id",
  ])
  const formFields: Record<string, string> = {}
  for (const [k, v] of Object.entries(body)) {
    if (IDENTITY.has(k.toLowerCase())) continue
    if (v === null || v === undefined || v === "") continue
    formFields[k.toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "")] = String(v)
  }
  const notes = Object.entries(formFields).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" | ")

  // FieldBuilt's own funnel screens on headcount + revenue; a contractor's
  // leads are never screened this way.
  const { data: company } = await db
    .from("companies").select("service_type").eq("id", companyId).single()
  const funnelQual = company?.service_type === "fieldbuilt_sales"
    ? qualifyFromFormFields(formFields)
    : null
  const rejected = !!funnelQual && !funnelQual.qualified

  const { data: existing } = await db
    .from("leads")
    .select("id, ai_paused")
    .eq("company_id", companyId)
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle()

  let leadId: string
  if (existing) {
    leadId = existing.id
    await db.from("leads").update({
      ...(ghlContactId ? { ghl_contact_id: ghlContactId } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", leadId)
    // Already in a conversation — don't re-open with a second opener.
    const { count } = await db
      .from("conversations").select("*", { count: "exact", head: true })
      .eq("lead_id", leadId).eq("direction", "outbound")
    if ((count ?? 0) > 0 || existing.ai_paused) {
      return NextResponse.json({ ok: true, leadId, opener: false, reason: "already engaged" })
    }
  } else {
    const { data: newLead, error } = await db.from("leads").insert({
      company_id: companyId,
      phone,
      first_name: str(body.firstName) ?? str(body.first_name),
      last_name: str(body.lastName) ?? str(body.last_name),
      email: str(body.email),
      source: "facebook",
      channel: "sms",
      status: rejected ? "unqualified" : "just_came_in",
      ...(rejected ? { ai_paused: true } : {}),
      ghl_contact_id: ghlContactId,
      notes: notes || null,
      job_type: inferJobType(notes),
      metadata: {
        via: "gohighlevel",
        ...formFields,
        ...(funnelQual ? { techs: funnelQual.techs, revenue: funnelQual.revenue, tier: funnelQual.tier, qualified: funnelQual.qualified } : {}),
      },
    }).select("id").single()

    if (error || !newLead) {
      console.error("[ghl/lead] insert failed:", error)
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
    }
    leadId = newLead.id

    const name = `${str(body.firstName) ?? ""} ${str(body.lastName) ?? ""}`.trim()
    notifyNewLead(companyId, name, phone, "facebook").catch(() => {})
  }

  if (rejected) {
    return NextResponse.json({ ok: true, leadId, opener: false, reason: "unqualified by form" })
  }

  // Follow-up sequence is scheduled regardless of whether the opener lands,
  // so a transient send failure never costs the lead its follow-ups.
  try {
    const { data: cfg } = await db
      .from("ai_agent_config").select("timezone").eq("company_id", companyId).maybeSingle()
    const steps = buildNoReplySchedule(new Date(), cfg?.timezone ?? "America/New_York")
    const { count: existingSteps } = await db
      .from("sequences").select("*", { count: "exact", head: true })
      .eq("lead_id", leadId).eq("sequence_type", "no_reply").eq("status", "pending")
    if ((existingSteps ?? 0) === 0) {
      await db.from("sequences").insert(steps.map((s) => ({
        lead_id: leadId, company_id: companyId, sequence_type: "no_reply",
        step: s.step, scheduled_at: s.scheduledAt.toISOString(), status: "pending",
      })))
    }
  } catch (err) {
    console.error("[ghl/lead] sequence scheduling failed:", err)
  }

  // Opener, sent through the contractor's own GHL number
  try {
    const conn = await getGhlConnection(companyId)
    const result = await processAndSave(leadId, companyId, null)
    if (result.response && conn && ghlContactId) {
      const sent = await sendGhlSms(conn, ghlContactId, result.response)
      if (sent && result.outboundConversationId) {
        await db.from("conversations")
          .update({ twilio_sid: sent, channel: "sms" })
          .eq("id", result.outboundConversationId)
      }
      await db.from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", leadId)
    }
  } catch (err) {
    console.error("[ghl/lead] opener failed:", err)
  }

  return NextResponse.json({ ok: true, leadId, opener: true })
}
