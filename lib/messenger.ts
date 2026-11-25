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

// Any Supabase client flavour (service role or server) works with these helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessengerDb = { from: (t: string) => any }

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
  db: MessengerDb,
  leadId: string,
  companyId: string,
  pageAccessToken: string,
  pageId: string,
  psid: string,
  currentText: string,
  humanOwnedWindowDays = 14
): Promise<HistoryImportResult> {
  const HISTORY_LIMIT = 25
  const history = await fetchConversationHistory(pageAccessToken, pageId, psid, HISTORY_LIMIT)
  if (history.length === 0) return { imported: 0, humanOwned: false }

  // Which page-side messages are the Page's own automation (instant replies, ad
  // questionnaires, canned prompts) rather than a person. Judged on the FULL thread:
  // timing needs the neighbouring messages.
  const pageTexts = await getPageAutomationTexts(pageAccessToken, pageId)
  const automated = automationFlags(history, { pageTexts, threadComplete: history.length < HISTORY_LIMIT })
  const automatedMsgs = new Set(history.filter((_, i) => automated[i]))

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
      !automatedMsgs.has(m) &&
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
// Wording alone cannot settle this: every Page writes its own questions, so a
// fixed list written for one trade (it started as an HVAC list) reads another
// trade's questionnaire as a person. A page-side message counts as AUTOMATION
// when ANY of these holds:
//   1. it matches a built-in pattern (system lines, generic canned prompts);
//   2. it is word for word one of the Page's own configured automations that
//      Graph lets us read (ice breakers, greeting, lead form questions);
//   3. it arrived within ~3 seconds of the message before it, when that message
//      was the lead's or was itself automation. No person reads and answers in
//      three seconds; a bot always does;
//   4. it opens the thread: nothing from the lead came before it. A person
//      cannot start a Messenger thread with someone, only an ad's welcome flow can.
// Everything else from the Page is a person.
const AUTOMATION_PATTERNS: RegExp[] = [
  /auto-?label added/i,
  /lead stage set to/i,
  /please tap on one of the options/i,
  /almost there.{0,3}\s*please finish answering/i,
  /please finish answering our questions/i,
  /veuillez appuyer sur/i,           // FR variant of "please tap an option"
  /нажмите на один из предложенных/i, // RU variant
  /toca una de las opciones/i,        // ES variant (seen live: counted as a rep and could wrongly pause the AI)
  /respondi[oó] a? ?una publicaci[oó]n/i, // ES "replied to a post" system line
  /you are responding to a user comment/i,
  /thanks for contacting us/i,
  /thank(s| you) for (reaching out|your (message|interest|inquiry))/i,
  /we'?ve received your message/i,
  /we'?ll (get back to|be in touch with) you (shortly|soon|as soon as)/i,
  /we noticed you'?re interested/i,
  /welcome to /i,
  /are you interested in our services/i,
  /^(hi|hello|hey)[^.!?]{0,40}[.!]? (how can we help( you)?( today)?|what can we help you with)\??$/i,
  /^how can we help( you)?( today)?\??$/i,
  /^what is your (zip|postal) code\??$/i,
  /^what is your email( address)?\??$/i,
  /^what is your phone number\??$/i,
  /^what is your (full )?name\??$/i,
  /^what type of residence/i,
  // Trade questionnaires seen on client Pages. Whole-line matches only: a rep who
  // types a longer, personal version of the same question still reads as a person.
  /^how many furnaces/i,
  /^when was the last time you had your air ducts cleaned\??$/i,
  /^is there a single furnace or multiple units\??$/i,
  /^what (type|kind) of floor(ing|s)? (are you|do you)[^?]{0,60}\??$/i,
  /^which rooms?[^?]{0,60}\??$/i,
  /^(roughly |about )?how many (square feet|sq\.? ?ft|rooms)[^?]{0,40}\??$/i,
  /^when (are you|do you|would you)[^?]{0,60}(start|install|done|project|floors?)[^?]{0,20}\??$/i,
  /^do you own (the|your) (home|house|property)\??$/i,
  /^are you the homeowner\??$/i,
]

/** Does this page-side message look like a bot/canned message rather than a person? */
export function isAutomationMessage(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  return AUTOMATION_PATTERNS.some((re) => re.test(t))
}

const normalizeAutomationText = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()

/** How fast is too fast to be a person. Graph timestamps have one-second resolution. */
export const FAST_REPLY_MS = 3000

/**
 * A single page-side message seen live (an echo event), judged without the rest of
 * the thread: wording, the Page's configured automations, or a reply that landed
 * within three seconds of the lead's last message.
 */
export function isAutomationEcho(input: {
  text: string
  echoMs: number | null
  lastInboundMs: number | null
  pageTexts?: Set<string>
}): boolean {
  if (isAutomationMessage(input.text)) return true
  if (input.pageTexts?.has(normalizeAutomationText(input.text))) return true
  if (input.echoMs != null && input.lastInboundMs != null) {
    const gap = input.echoMs - input.lastInboundMs
    if (gap >= -1000 && gap <= FAST_REPLY_MS) return true
  }
  return false
}

/**
 * For every message in a chronological thread: is it Page automation?
 * Lead-side messages are always false. See the four rules above.
 */
export function automationFlags(
  history: HistoryMessage[],
  opts?: {
    /** Normalized texts of the Page's configured automations (getPageAutomationTexts) */
    pageTexts?: Set<string>
    /** True when `history` is the whole thread, not a truncated window */
    threadComplete?: boolean
  }
): boolean[] {
  const flags: boolean[] = new Array(history.length).fill(false)
  let leadHasSpoken = false
  for (let i = 0; i < history.length; i++) {
    const m = history[i]
    if (!m.fromPage) { leadHasSpoken = true; continue }

    if (isAutomationMessage(m.text)) { flags[i] = true; continue }
    if (opts?.pageTexts?.has(normalizeAutomationText(m.text))) { flags[i] = true; continue }
    if (!leadHasSpoken && opts?.threadComplete) { flags[i] = true; continue }

    const prev = history[i - 1]
    if (prev) {
      const gap = new Date(m.createdTime).getTime() - new Date(prev.createdTime).getTime()
      if (gap >= 0 && gap <= FAST_REPLY_MS && (!prev.fromPage || flags[i - 1])) flags[i] = true
    }
  }
  return flags
}

// The Page's own configured automations, read once per Page and cached. Best
// effort: Graph exposes ice breakers, the greeting and lead-form questions, but
// not Inbox instant replies (the timing rule covers those).
const pageAutomationCache = new Map<string, { at: number; texts: Set<string> }>()
const PAGE_AUTOMATION_TTL_MS = 6 * 60 * 60 * 1000

export async function getPageAutomationTexts(pageAccessToken: string, pageId: string): Promise<Set<string>> {
  const hit = pageAutomationCache.get(pageId)
  if (hit && Date.now() - hit.at < PAGE_AUTOMATION_TTL_MS) return hit.texts
  const texts = new Set<string>()
  const add = (v: unknown) => {
    if (typeof v !== "string") return
    const n = normalizeAutomationText(v)
    if (n.length >= 3) texts.add(n)
  }
  const get = async (path: string) => {
    try {
      const res = await fetch(`${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${pageAccessToken}`, {
        signal: AbortSignal.timeout(8000),
      })
      return res.ok ? await res.json() : null
    } catch { return null }
  }
  const [profile, forms] = await Promise.all([
    get(`${pageId}/messenger_profile?fields=ice_breakers,greeting`),
    get(`${pageId}/leadgen_forms?fields=questions,context_card,thank_you_page&limit=25`),
  ])
  for (const entry of (profile?.data ?? []) as Array<Record<string, unknown>>) {
    for (const g of (entry.greeting as Array<{ text?: string }> | undefined) ?? []) add(g.text)
    for (const group of (entry.ice_breakers as Array<{ call_to_actions?: Array<{ question?: string }>; question?: string }> | undefined) ?? []) {
      add(group.question)
      for (const cta of group.call_to_actions ?? []) add(cta.question)
    }
  }
  for (const form of (forms?.data ?? []) as Array<Record<string, unknown>>) {
    for (const q of (form.questions as Array<{ label?: string }> | undefined) ?? []) add(q.label)
    const card = form.context_card as { title?: string; content?: string[] | string } | undefined
    add(card?.title)
    for (const line of Array.isArray(card?.content) ? card!.content as string[] : [card?.content]) add(line)
    const ty = form.thank_you_page as { title?: string; body?: string } | undefined
    add(ty?.title); add(ty?.body)
  }
  pageAutomationCache.set(pageId, { at: Date.now(), texts })
  if (pageAutomationCache.size > 300) pageAutomationCache.delete(pageAutomationCache.keys().next().value as string)
  return texts
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
    // "Zip code is 48187" — a zip inside a sentence that mentions zip (live:
    // Ajish, whose zip was never captured because it wasn't a bare number)
    else if (!out.zip && /zip/i.test(t)) { const z = t.match(/\b\d{5}\b/)?.[0]; if (z) out.zip = z }
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
export type SyncResult = { added: number; metaTotal: number; oursBefore: number; facts: MinedFacts | null; humanTakeover: boolean }

/** Did this import reveal a REP (page-side human, not automation) speaking
 *  after the AI's last word? Pure logic, exported for the test battery.
 *  lastAiMs = 0 means the AI never spoke — then any rep message in the last
 *  7 days counts (the thread belongs to the office, not to an opener). */
export function repTakeoverInImport(
  imported: HistoryMessage[],
  lastAiMs: number,
  nowMs: number,
  /** The messages of `imported` that the full-thread classifier judged to be Page
   *  automation (automationFlags). Omitted = wording patterns only. */
  automated?: Set<HistoryMessage>
): boolean {
  const RECENT_MS = 7 * 24 * 60 * 60 * 1000
  return imported.some((m) => {
    if (!m.fromPage || isAutomationMessage(m.text) || automated?.has(m)) return false
    const ms = new Date(m.createdTime).getTime()
    if (lastAiMs > 0) return ms > lastAiMs
    return nowMs - ms < RECENT_MS
  })
}

export async function syncMessengerHistory(
  db: MessengerDb,
  leadId: string,
  companyId: string,
  pageAccessToken: string,
  pageId: string,
  psid: string,
  opts?: {
    /** Sync-level human-takeover detection (default ON). Resume passes false —
     *  the owner just said "AI go", re-pausing on the rep messages that
     *  prompted the pause would make Resume a no-op. */
    autoPauseOnRep?: boolean
    /** The inbound message that TRIGGERED this sync — Meta's history already
     *  contains it, and without exclusion it would import as a duplicate of
     *  the row the engine is about to insert. */
    excludeTriggerText?: string
  }
): Promise<SyncResult> {
  const SYNC_LIMIT = 50
  const history = await fetchConversationHistory(pageAccessToken, pageId, psid, SYNC_LIMIT)
  if (history.length === 0) return { added: 0, metaTotal: 0, oursBefore: 0, facts: null, humanTakeover: false }

  const { data: existing } = await db
    .from("conversations")
    .select("body, created_at, direction, sent_by")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
  const ours = ((existing ?? []) as Array<{ body: string | null; created_at: string; direction: string; sent_by: string | null }>).map((r) => ({
    body: (r.body ?? "").trim(),
    ms: new Date(r.created_at).getTime(),
    direction: r.direction,
    sentBy: r.sent_by,
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
  const trigger = opts?.excludeTriggerText?.trim()
  const nowMs = Date.now()
  const missing = history.filter((m) => {
    const text = m.text.trim()
    const ms = new Date(m.createdTime).getTime()
    // The message that triggered this sync is about to be inserted by the
    // engine — importing it too would double it in the thread.
    if (trigger && !m.fromPage && text === trigger && nowMs - ms < 10 * 60 * 1000) return false
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
      return { added: 0, metaTotal: history.length, oursBefore: ours.length, facts: null, humanTakeover: false }
    }
    console.log(`[messenger] re-synced ${missing.length} missing messages into lead ${leadId}`)
  }

  // Redundant human-takeover detection (Gaurang incident): the owner corrected
  // the agent from the page inbox, the echo webhooks never arrived, and the
  // agent kept replying over him three minutes later. Echoes stay the fast
  // path — THIS is the guarantee: any sync that reveals a rep speaking after
  // the AI's last word pauses the AI, whether the sync came from the 15-min
  // sweep or the pre-reply refresh.
  let humanTakeover = false
  if (opts?.autoPauseOnRep !== false) {
    const lastAiMs = Math.max(0, ...ours.filter((o) => o.direction === "outbound" && o.sentBy === "ai").map((o) => o.ms))
    // Automation is judged on the whole thread (timing needs the neighbours),
    // then applied to the messages this sync added.
    const pageTexts = await getPageAutomationTexts(pageAccessToken, pageId)
    const flags = automationFlags(history, { pageTexts, threadComplete: history.length < SYNC_LIMIT })
    const automated = new Set(history.filter((_, i) => flags[i]))
    if (repTakeoverInImport(missing, lastAiMs, nowMs, automated)) {
      const { data: cur } = await db.from("leads").select("ai_paused, first_name, phone").eq("id", leadId).maybeSingle()
      if (cur && !cur.ai_paused) {
        humanTakeover = true
        // A rep in the thread pauses the AI — but it must never strip the
        // booked tag off a lead with an upcoming visit (live: Viloren — the
        // office pulled her job EARLIER, and the takeover flag demoted a
        // booked lead to needs_attention; the pipeline lost the booking).
        const { data: upcoming } = await db.from("appointments")
          .select("id").eq("lead_id", leadId).eq("status", "scheduled")
          .gt("scheduled_at", new Date().toISOString()).limit(1)
        const hasUpcoming = (upcoming ?? []).length > 0
        await db.from("leads")
          .update(hasUpcoming ? { ai_paused: true } : { ai_paused: true, status: "needs_attention" })
          .eq("id", leadId)
        try {
          const { notifyNeedsAttention } = await import("@/lib/notifications")
          notifyNeedsAttention(companyId, `${cur.first_name ?? "Messenger lead"} — a team member is in the thread, AI paused`, cur.phone ?? "", leadId).catch(() => {})
        } catch { /* notification is best-effort */ }
        console.log(`[messenger] sync found a rep in lead ${leadId}'s thread after the AI's last message — AI paused${hasUpcoming ? ", booked status KEPT (upcoming visit)" : ", status → needs_attention"}`)
      }
    }
  }
  return { added: missing.length, metaTotal: history.length, oursBefore: ours.length, facts: mineHistoryFacts(history), humanTakeover }
}

/** Fill ONLY blank identity fields from the thread — never overwrite real data. */
export async function backfillLeadFromThread(
  db: MessengerDb,
  leadId: string,
  facts: MinedFacts | null
): Promise<string[]> {
  if (!facts) return []
  const { data: cur } = await db
    .from("leads").select("phone, email, address, zip").eq("id", leadId).maybeSingle()
  if (!cur) return []
  const patch: Record<string, string> = {}
  if (facts.phone && (!cur.phone || String(cur.phone).startsWith("msgr:") || String(cur.phone).startsWith("fbform:"))) {
    const { parseLeadPhone } = await import("@/lib/twilio")
    const p = parseLeadPhone(facts.phone)
    if (p) patch.phone = p
  }
  if (facts.email && !cur.email) patch.email = facts.email
  if (facts.zip && !cur.zip) patch.zip = facts.zip
  if (Object.keys(patch).length === 0) return []
  await db.from("leads").update(patch).eq("id", leadId)
  return Object.keys(patch)
}

/**
 * Sync EVERY Messenger thread for a company, whoever is talking.
 *
 * The per-thread sync only fires at lead creation, on resume, and before the
 * AI's first message — so a thread a human owns never refreshed, and the CRM
 * showed the customer's side while the rep's replies were invisible. Live:
 * one thread held 32 of 42 messages, missing six of Michael's answers.
 *
 * Additive only (see syncMessengerHistory): existing rows are never edited or
 * deleted, so AI messages keep sent_by="ai" and stay orange in the UI, while
 * newly-recovered page messages come in as "human" and render blue.
 */
export async function syncAllMessengerThreads(
  db: MessengerDb,
  companyId: string,
  pageAccessToken: string,
  pageId: string,
  limit = 150
): Promise<{ threads: number; added: number }> {
  const { data: leads } = await db
    .from("leads")
    .select("id, messenger_psid")
    .eq("company_id", companyId)
    .not("messenger_psid", "is", null)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit)
  let threads = 0, added = 0
  for (const l of (leads ?? []) as Array<{ id: string; messenger_psid: string }>) {
    try {
      const r = await syncMessengerHistory(db, l.id, companyId, pageAccessToken, pageId, l.messenger_psid)
      if (r.added > 0) { threads++; added += r.added }
    } catch { /* one bad thread must never stop the sweep */ }
  }
  if (added > 0) console.log(`[messenger] thread sweep: +${added} messages across ${threads} threads`)
  return { threads, added }
}
