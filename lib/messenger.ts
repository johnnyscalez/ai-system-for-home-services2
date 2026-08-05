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

  // A page-side message is only a HUMAN TAKEOVER if it is neither a Meta inbox
  // automation nor something our own AI said. Both exclusions are load-bearing:
  //  - automations: a page running a greeting flow would otherwise disable the
  //    agent on every new conversation (observed live: 3 of 4 leads paused).
  //  - our own AI: a thread we already talked in (lead deleted and re-created,
  //    duplicate PSID row) would otherwise read our own words as a rep's.
  // Our sends are provably ours — every one is stored in `conversations`.
  const ourSent = new Set<string>()
  try {
    const { data: sent } = await db
      .from("conversations")
      .select("body")
      .eq("company_id", companyId)
      .eq("channel", "messenger")
      .eq("direction", "outbound")
      .eq("sent_by", "ai")
      .gte("created_at", new Date(cutoff).toISOString())
      .limit(1000)
    for (const r of (sent ?? []) as Array<{ body: string | null }>) {
      if (r.body) ourSent.add(r.body.trim())
    }
  } catch { /* fall through — automation filter still applies */ }

  const humanOwned = toImport.some(
    (m) =>
      m.fromPage &&
      !isAutomationMessage(m.text) &&
      !ourSent.has(m.text.trim()) &&
      new Date(m.createdTime).getTime() >= cutoff
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

// ── Automation vs. human page messages ───────────────────────────────────────
//
// Meta's own inbox automations (greeting flows, canned auto-replies, "lead
// stage" labels, questionnaire prompts) are page-side messages, exactly like a
// rep's reply. Treating them as human takeover disabled the AI on nearly every
// new thread for a page that runs an automation — observed live: 3 of 4 new
// leads auto-paused because the questionnaire spoke first.
//
// Live human takeover is detected reliably by ECHO events (message_echoes),
// which is the signal that should pause the AI. This classifier exists only so
// the HISTORY guard doesn't mistake a robot for a person.
const AUTOMATION_PATTERNS: RegExp[] = [
  /auto-?label added/i,
  /lead stage set to/i,
  /please tap on one of the options/i,
  /almost there.{0,3}\s*please finish answering/i,
  /please finish answering our questions/i,
  /veuillez appuyer sur/i,           // FR variant of "please tap an option"
  /нажмите на один из предложенных/i, // RU variant
  /you are responding to a user comment/i,
  /thanks for contacting us/i,
  /we'?ve received your message/i,
  /we noticed you'?re interested/i,
  /welcome to /i,
  /are you interested in our services/i,
  /^what is your (zip|postal) code\??$/i,
  /^what is your email( address)?\??$/i,
  /^what is your phone number\??$/i,
  /^what type of residence/i,
  /^how many furnaces/i,
  /^when was the last time you had your air ducts cleaned\??$/i,
  /^is there a single furnace or multiple units\??$/i,
]

/** Does this page-side message look like a bot/canned message rather than a person? */
export function isAutomationMessage(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  return AUTOMATION_PATTERNS.some((re) => re.test(t))
}

// ── Contact facts sitting in the history ─────────────────────────────────────
// A pre-existing thread often already contains everything we ask for. Mining
// it means the AI never re-asks a question the customer already answered
// (observed live: a lead answered the automation's duct-history question and
// our agent asked it again 7 hours later — "I already said last year").
export type MinedFacts = {
  phone?: string
  email?: string
  zip?: string
  /** Q→A pairs from the lead side, for the AI's context block */
  transcriptFacts: string[]
}

export function mineHistoryFacts(history: HistoryMessage[]): MinedFacts {
  const out: MinedFacts = { transcriptFacts: [] }
  for (let i = 0; i < history.length; i++) {
    const m = history[i]
    if (m.fromPage) continue
    const t = m.text.trim()
    if (!out.email) {
      const e = t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
      if (e) out.email = e.toLowerCase()
    }
    if (!out.phone) {
      const digits = t.replace(/[^\d+]/g, " ").match(/(\+?1?\s*\d{3}\s*\d{3}\s*\d{4})\b/)?.[1]
      if (digits) out.phone = digits.replace(/\s/g, "")
    }
    if (!out.zip && /^\d{5}$/.test(t)) out.zip = t
    // Pair the lead's answer with the page question immediately before it
    const prev = history[i - 1]
    if (prev?.fromPage && prev.text.trim().endsWith("?")) {
      out.transcriptFacts.push(`${prev.text.trim()} → "${t}"`)
    }
  }
  return out
}

// ── Gap-aware re-sync (the "AI intervenes in an existing conversation" case) ──
//
// importMessengerHistory() is a ONE-TIME snapshot taken when a lead is
// created. It never refreshes — so anything that happened in the thread while
// we weren't receiving (Meta's automation owning it, or a rep working the
// thread while the AI was paused) stayed invisible to the agent forever.
// Measured live: one lead was missing 20 of 45 messages.
//
// This closes that gap safely. It ADDS only what we don't already have — it
// never edits, never deletes, and never duplicates — so it is safe to call on
// any thread at any time.
export type SyncResult = { added: number; metaTotal: number; oursBefore: number; facts: MinedFacts | null }

export async function syncMessengerHistory(
  db: { from: (t: string) => any },
  leadId: string,
  companyId: string,
  pageAccessToken: string,
  pageId: string,
  psid: string
): Promise<SyncResult> {
  const history = await fetchConversationHistory(pageAccessToken, pageId, psid, 50)
  if (history.length === 0) return { added: 0, metaTotal: 0, oursBefore: 0, facts: null }

  const { data: existing } = await db
    .from("conversations")
    .select("body, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
  const ours = ((existing ?? []) as Array<{ body: string | null; created_at: string }>).map((r) => ({
    body: (r.body ?? "").trim(),
    ms: new Date(r.created_at).getTime(),
  }))

  // A Meta message is "already ours" when we hold the same text at roughly the
  // same time. Timestamps differ slightly between Meta's clock and our insert
  // time for live-received messages, hence a window rather than equality.
  //
  // Matching CONSUMES the local row: a thread legitimately repeats short
  // messages ("Yes", "Ok"), and without consumption one stored "Yes" would
  // satisfy every other "Yes" in the thread — leaving permanent holes that no
  // future sync could ever heal. Caught in testing: 13 removed, only 12 came
  // back.
  const WINDOW_MS = 5 * 60 * 1000
  const consumed = new Array(ours.length).fill(false)
  const missing = history.filter((m) => {
    const text = m.text.trim()
    const ms = new Date(m.createdTime).getTime()
    const idx = ours.findIndex((o, k) => !consumed[k] && o.body === text && Math.abs(o.ms - ms) <= WINDOW_MS)
    if (idx === -1) return true
    consumed[idx] = true
    return false
  })
  if (missing.length > 0) {
    const rows = missing.map((m) => ({
      lead_id: leadId,
      company_id: companyId,
      direction: m.fromPage ? "outbound" : "inbound",
      sent_by: "human", // page side = rep/automation; lead side = the lead
      body: m.text,
      channel: "messenger",
      created_at: m.createdTime,
    }))
    const { error } = await db.from("conversations").insert(rows)
    if (error) {
      console.error("[messenger] history re-sync insert failed:", error.message)
      return { added: 0, metaTotal: history.length, oursBefore: ours.length, facts: null }
    }
    console.log(`[messenger] re-synced ${missing.length} missing messages into lead ${leadId}`)
  }
  return { added: missing.length, metaTotal: history.length, oursBefore: ours.length, facts: mineHistoryFacts(history) }
}

/** Fill ONLY blank identity fields from the thread — never overwrite real data. */
export async function backfillLeadFromThread(
  db: { from: (t: string) => any },
  leadId: string,
  facts: MinedFacts | null
): Promise<string[]> {
  if (!facts) return []
  const { data: cur } = await db
    .from("leads").select("phone, email, address").eq("id", leadId).maybeSingle()
  if (!cur) return []
  const patch: Record<string, string> = {}
  if (facts.phone && (!cur.phone || String(cur.phone).startsWith("msgr:") || String(cur.phone).startsWith("fbform:"))) {
    const { parseLeadPhone } = await import("@/lib/twilio")
    const p = parseLeadPhone(facts.phone)
    if (p) patch.phone = p
  }
  if (facts.email && !cur.email) patch.email = facts.email
  if (facts.zip && !cur.address) patch.address = facts.zip
  if (Object.keys(patch).length === 0) return []
  await db.from("leads").update(patch).eq("id", leadId)
  return Object.keys(patch)
}
