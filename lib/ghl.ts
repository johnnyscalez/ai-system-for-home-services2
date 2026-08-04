import { createServiceRoleClient } from "@/lib/supabase-server"

// ─────────────────────────────────────────────────────────────────────────────
// GoHighLevel as an SMS transport.
//
// Why this exists: a contractor who already runs GHL has an A2P-10DLC or
// toll-free-verified number with established carrier reputation. Sending their
// AI conversations from a brand-new Twilio number would throw that away and
// start fresh with the carriers. So when a company has a GHL connection, the
// agent talks through their number, and every message lands in the same GHL
// conversation thread their team already watches.
//
// GHL chooses the sending number itself from the location's default — the API
// takes no "from" parameter. Verified live against the Conversations API.
// ─────────────────────────────────────────────────────────────────────────────

const GHL_BASE = "https://services.leadconnectorhq.com"

export type GhlConnection = {
  company_id: string
  api_key: string
  location_id: string
  sending_number: string | null
}

export async function getGhlConnection(companyId: string): Promise<GhlConnection | null> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from("ghl_connections")
    .select("company_id, api_key, location_id, sending_number")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle()
  return (data as GhlConnection) ?? null
}

/** Resolve a company from the shared secret a GHL workflow sends. */
export async function companyFromWebhookSecret(secret: string | null): Promise<string | null> {
  if (!secret) return null
  const db = createServiceRoleClient()
  const { data } = await db
    .from("companies")
    .select("id")
    .eq("webhook_secret", secret)
    .maybeSingle()
  return data?.id ?? null
}

function headers(conn: GhlConnection, version = "2021-04-15") {
  return {
    Authorization: `Bearer ${conn.api_key}`,
    Version: version,
    "Content-Type": "application/json",
  }
}

const last10 = (p: string) => p.replace(/\D/g, "").slice(-10)

/** Find a GHL contact by phone, or create one. Returns the contact id. */
export async function resolveGhlContact(
  conn: GhlConnection,
  lead: { first_name: string | null; last_name: string | null; phone: string; email: string | null }
): Promise<string | null> {
  const digits = last10(lead.phone)
  if (digits) {
    try {
      const res = await fetch(`${GHL_BASE}/contacts/search`, {
        method: "POST",
        headers: headers(conn, "2021-07-28"),
        body: JSON.stringify({
          locationId: conn.location_id,
          pageLimit: 10,
          filters: [{ field: "phone", operator: "contains", value: digits }],
        }),
      })
      const json = await res.json().catch(() => ({}))
      const hit = (json.contacts ?? []).find(
        (c: { phone?: string }) => last10(c.phone ?? "") === digits
      )
      if (hit?.id) return hit.id
    } catch { /* fall through to create */ }
  }

  try {
    const res = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: headers(conn, "2021-07-28"),
      body: JSON.stringify({
        locationId: conn.location_id,
        firstName: lead.first_name ?? undefined,
        lastName: lead.last_name ?? undefined,
        phone: lead.phone,
        email: lead.email ?? undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    return json?.contact?.id ?? null
  } catch (err) {
    console.error("[ghl] contact create failed:", err)
    return null
  }
}

/**
 * Send an SMS through the company's GHL number.
 * Returns GHL's message id, or null if the send failed (caller falls back).
 */
export async function sendGhlSms(
  conn: GhlConnection,
  contactId: string,
  message: string
): Promise<string | null> {
  const res = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: "POST",
    headers: headers(conn),
    body: JSON.stringify({ type: "SMS", contactId, message }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error("[ghl] sendSms failed", res.status, JSON.stringify(json).slice(0, 300))
    const db = createServiceRoleClient()
    await db.from("ghl_connections")
      .update({ last_error: `${res.status}: ${JSON.stringify(json).slice(0, 200)}`, updated_at: new Date().toISOString() })
      .eq("company_id", conn.company_id)
    return null
  }
  return json?.messageId ?? json?.conversationId ?? "sent"
}

/**
 * Ensure the lead is linked to a GHL contact, creating one if needed, and
 * cache the id so later turns skip the lookup.
 */
export async function ensureLeadGhlContact(
  companyId: string,
  leadId: string
): Promise<{ conn: GhlConnection; contactId: string } | null> {
  const conn = await getGhlConnection(companyId)
  if (!conn) return null

  const db = createServiceRoleClient()
  const { data: lead } = await db
    .from("leads")
    .select("id, first_name, last_name, phone, email, ghl_contact_id")
    .eq("id", leadId)
    .maybeSingle()
  if (!lead) return null

  if (lead.ghl_contact_id) return { conn, contactId: lead.ghl_contact_id }

  const contactId = await resolveGhlContact(conn, lead)
  if (!contactId) return null
  await db.from("leads").update({ ghl_contact_id: contactId }).eq("id", leadId)
  return { conn, contactId }
}
