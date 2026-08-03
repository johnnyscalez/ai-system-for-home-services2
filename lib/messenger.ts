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
    if (!res.ok) {
      // Silently returning null here hid a real failure for weeks: without
      // Advanced Access this call 400s, so every Messenger lead was nameless
      // and reached Housecall Pro as customer "Unknown". The agent asks for
      // the name in-conversation as the primary path — this log tells us
      // whether the profile fallback is actually available.
      const body = await res.text().catch(() => "")
      console.warn(`[messenger] profile lookup failed for psid ${psid} (HTTP ${res.status}) — agent must collect the name in conversation. ${body.slice(0, 200)}`)
      return { firstName: null, lastName: null }
    }
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

// ── Conversation history import (the Nicole incident, Aug 2026) ──────────────
//
// A Messenger thread can have a life BEFORE our system ever sees it: Meta
// inbox automations, office reps replying by hand, months of back-and-forth.
// When such a person sends anything after we connect (or reconnect), the
// webhook meets an unknown PSID, creates a blank lead, and the AI restarts
// intake from zero — observed live: the AI re-opened a conversation minutes
// after a human rep had told the customer "we do not service your area."
//
// Fix: on first contact with a PSID, read the thread's recent history from
// the Conversations API (works with the standard page token — verified live)
// and (a) write it into our conversation log so the AI has full context,
// (b) detect page-side messages we didn't send — a human or automation
// already owns this thread, so the AI stays OUT until the office resumes it.

export type HistoryMessage = {
  fromPage: boolean
  text: string
  createdTime: string
}

export async function fetchConversationHistory(
  pageAccessToken: string,
  pageId: string,
  psid: string,
  limit = 25
): Promise<HistoryMessage[]> {
  try {
    const res = await fetch(
      `${GRAPH}/${pageId}/conversations?user_id=${psid}&fields=messages.limit(${limit}){message,from,created_time}&access_token=${pageAccessToken}`
    )
    if (!res.ok) {
      console.warn(`[messenger] history fetch failed for psid ${psid}: HTTP ${res.status}`)
      return []
    }
    const data = (await res.json()) as {
      data?: Array<{ messages?: { data?: Array<{ message?: string; from?: { id?: string }; created_time?: string }> } }>
    }
    const raw = data.data?.[0]?.messages?.data ?? []
    return raw
      .filter((m) => (m.message ?? "").trim() && m.created_time)
      .map((m) => ({
        fromPage: m.from?.id === pageId,
        text: (m.message ?? "").trim(),
        createdTime: m.created_time!,
      }))
      .reverse() // Graph returns newest-first; we want chronological
  } catch (err) {
    console.warn("[messenger] history fetch error:", err)
    return []
  }
}

export type HistoryImportResult = {
  imported: number
  /** Page-side activity in the recent window that we did not send — a human
   *  rep or inbox automation already engaged this person. */
  humanOwned: boolean
}

/**
 * Import a PSID's prior Messenger history into our conversation log.
 * Call ONLY when the lead was just created (unknown PSID) — an existing lead
 * already has its history. `currentText` is the inbound that triggered lead
 * creation; it appears in the fetched history too and must not be duplicated
 * (the webhook inserts it through the normal flow).
 */
export async function importMessengerHistory(
  db: { from: (t: string) => any },
  leadId: string,
  companyId: string,
  pageAccessToken: string,
  pageId: string,
  psid: string,
  currentText: string,
  humanOwnedWindowDays = 14
): Promise<HistoryImportResult> {
  const history = await fetchConversationHistory(pageAccessToken, pageId, psid)
  if (history.length === 0) return { imported: 0, humanOwned: false }

  // Drop the triggering message (newest lead-side entry matching its text)
  let dropped = false
  const toImport = [...history].reverse().filter((m) => {
    if (!dropped && !m.fromPage && m.text === currentText.trim()) { dropped = true; return false }
    return true
  }).reverse()

  const cutoff = Date.now() - humanOwnedWindowDays * 24 * 60 * 60 * 1000
  // The lead was created milliseconds ago, so we have sent NOTHING to this
  // PSID — every page-side message in the history is by definition not ours.
  const humanOwned = toImport.some(
    (m) => m.fromPage && new Date(m.createdTime).getTime() >= cutoff
  )

  if (toImport.length > 0) {
    const rows = toImport.map((m) => ({
      lead_id: leadId,
      company_id: companyId,
      direction: m.fromPage ? "outbound" : "inbound",
      sent_by: "human", // page side = rep/automation (not our AI); lead side = the lead
      body: m.text,
      channel: "messenger",
      created_at: m.createdTime,
    }))
    const { error } = await db.from("conversations").insert(rows)
    if (error) {
      console.error("[messenger] history import insert failed:", error.message)
      return { imported: 0, humanOwned }
    }
  }
  console.log(`[messenger] imported ${toImport.length} historical messages for lead ${leadId} (humanOwned=${humanOwned})`)
  return { imported: toImport.length, humanOwned }
}
