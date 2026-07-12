/**
 * Facebook Messenger Send API helpers.
 *
 * The AI agent replies to leads who message the contractor's Facebook Page.
 * Uses the PAGE access token stored in integrations.fb_access_token (set
 * during the Facebook setup wizard when the contractor picks their page).
 *
 * Meta policy notes:
 * - messaging_type RESPONSE is valid within 24h of the user's last message.
 *   All sends in this integration are direct replies to an inbound message,
 *   so they are always inside the window.
 * - Proactive/outbound Messenger outreach after 24h requires message tags —
 *   deliberately NOT implemented; follow-up sequences stay SMS-only.
 */

const GRAPH = "https://graph.facebook.com/v21.0"

export async function sendMessengerMessage(
  pageAccessToken: string,
  psid: string,
  text: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const res = await fetch(`${GRAPH}/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`
    console.error("[messenger] send failed:", msg)
    return { ok: false, error: msg }
  }
  return { ok: true, messageId: (data as { message_id?: string }).message_id }
}

/** Fetch the sender's name for the lead record. Returns nulls on any failure. */
export async function getMessengerProfile(
  pageAccessToken: string,
  psid: string
): Promise<{ firstName: string | null; lastName: string | null }> {
  try {
    const res = await fetch(
      `${GRAPH}/${psid}?fields=first_name,last_name&access_token=${pageAccessToken}`
    )
    if (!res.ok) return { firstName: null, lastName: null }
    const data = (await res.json()) as { first_name?: string; last_name?: string }
    return { firstName: data.first_name ?? null, lastName: data.last_name ?? null }
  } catch {
    return { firstName: null, lastName: null }
  }
}

/** Placeholder phone for Messenger-only leads (leads.phone is NOT NULL). */
export function messengerPlaceholderPhone(psid: string): string {
  return `msgr:${psid}`
}

export function isMessengerPlaceholderPhone(phone: string | null | undefined): boolean {
  return typeof phone === "string" && phone.startsWith("msgr:")
}
