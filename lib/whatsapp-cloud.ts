import { createServiceRoleClient } from "@/lib/supabase-server"

// ─────────────────────────────────────────────────────────────────────────────
// Meta WhatsApp Cloud API transport — "Level 3" connections.
//
// The contractor connects their OWN WhatsApp Business Account (embedded signup)
// and keeps using the WhatsApp Business app on their phones — Meta's
// coexistence mode mirrors app messages to our webhook as echoes, which powers
// human-takeover detection (office replies from the app → AI pauses).
//
// Pattern proven in the rent-a-phone project (official Cloud API, v21+).
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH = "https://graph.facebook.com/v21.0"

export type CloudConnection = {
  company_id: string
  waba_id: string
  phone_number_id: string
  access_token: string
}

export async function getCloudConnection(companyId: string): Promise<CloudConnection | null> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from("whatsapp_connections")
    .select("company_id, waba_id, phone_number_id, access_token, provider, status")
    .eq("company_id", companyId)
    .eq("provider", "meta_cloud")
    .eq("is_active", true)
    .maybeSingle()
  if (!data?.phone_number_id || !data.access_token) return null
  return data as CloudConnection
}

export async function getCloudConnectionByPhoneNumberId(phoneNumberId: string): Promise<CloudConnection | null> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from("whatsapp_connections")
    .select("company_id, waba_id, phone_number_id, access_token")
    .eq("phone_number_id", phoneNumberId)
    .eq("provider", "meta_cloud")
    .eq("is_active", true)
    .maybeSingle()
  if (!data?.access_token) return null
  return data as CloudConnection
}

/** Free-form text — deliverable only inside Meta's 24h customer-service window. */
export async function sendCloudText(conn: CloudConnection, to: string, body: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${conn.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "text",
      text: { body },
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error("[whatsapp-cloud] sendText failed", res.status, JSON.stringify(json).slice(0, 300))
    return null
  }
  return json?.messages?.[0]?.id ?? null // wamid
}

// ── Inbound webhook parsing ───────────────────────────────────────────────────

export type CloudInbound = {
  kind: "message" | "echo" | "status" | "other"
  phoneNumberId: string
  wamid?: string
  from?: string          // customer's number (message) — E.164 without '+'
  to?: string
  text?: string
  status?: string        // sent | delivered | read | failed
  timestamp?: string
}

/** Flattens Meta's entry/changes envelope into simple events. */
export function parseCloudWebhook(payload: unknown): CloudInbound[] {
  const events: CloudInbound[] = []
  const body = payload as {
    entry?: Array<{
      changes?: Array<{
        field?: string
        value?: {
          metadata?: { phone_number_id?: string; display_phone_number?: string }
          messages?: Array<{
            id?: string; from?: string; timestamp?: string; type?: string
            text?: { body?: string }
            // echoes carry the business's own number in `from`
          }>
          statuses?: Array<{ id?: string; status?: string; recipient_id?: string; timestamp?: string }>
        }
      }>
    }>
  }

  for (const entry of body?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value
      const phoneNumberId = v?.metadata?.phone_number_id ?? ""
      const businessNumber = (v?.metadata?.display_phone_number ?? "").replace(/\D/g, "")
      if (!phoneNumberId) continue

      const isEchoField = /echo/i.test(change.field ?? "")

      for (const m of v?.messages ?? []) {
        const fromDigits = (m.from ?? "").replace(/\D/g, "")
        const isEcho = isEchoField || (businessNumber !== "" && fromDigits === businessNumber)
        events.push({
          kind: isEcho ? "echo" : "message",
          phoneNumberId,
          wamid: m.id,
          from: m.from,
          text: m.text?.body,
          timestamp: m.timestamp,
        })
      }
      for (const s of v?.statuses ?? []) {
        events.push({
          kind: "status",
          phoneNumberId,
          wamid: s.id,
          to: s.recipient_id,
          status: s.status,
          timestamp: s.timestamp,
        })
      }
    }
  }
  return events
}

// ── Connection bootstrap (called from the embedded-signup exchange) ──────────

/** Subscribe our app to the customer's WABA so its events reach our webhook. */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<boolean> {
  const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    console.error("[whatsapp-cloud] subscribe failed", res.status, t.slice(0, 300))
  }
  return res.ok
}

export async function fetchWabaNumbers(wabaId: string, accessToken: string): Promise<
  Array<{ id: string; display_phone_number?: string; verified_name?: string }>
> {
  const res = await fetch(`${GRAPH}/${wabaId}/phone_numbers`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = await res.json().catch(() => ({}))
  return json?.data ?? []
}
