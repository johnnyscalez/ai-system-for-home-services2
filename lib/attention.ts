/**
 * "Needs attention": the owner's text, and what happens when nobody acts.
 *
 * Anything can hand a lead to a person (the assistant, a failed Facebook lead,
 * an engine error, the owner by hand). The lead's status becomes
 * needs_attention and its pending follow-ups are cancelled. Before this file,
 * two things went wrong from there:
 *   - several of those paths never texted the owner at all;
 *   - nothing ever restarted the follow-ups, so a lead nobody called back was
 *     dropped for good.
 *
 * The bookkeeping lives on the lead, in metadata.attention:
 *   since         when the episode started
 *   alerted_at    when the owner was texted about it
 *   reason        why, when known ("out_of_area")
 *   resumable     false = never restart follow-ups on its own
 *   paused_steps  the follow-ups the hand-off interrupted (lib/sequences.ts)
 *
 * sweepAttention() runs every minute from the follow-up cron. It is the
 * guarantee; the direct texts sent at the moment of a hand-off are only faster.
 *   1. ALERT   a lead in needs_attention the owner has not been texted about
 *   2. CLEAR   a lead that left needs_attention closes its episode
 *   3. RESUME  RESUME_AFTER_HOURS after the hand-off and after the lead's last
 *              message, with no person on the thread (ai_paused false) and
 *              nothing booked, the lead goes back to its stage and its
 *              follow-ups continue where they stopped.
 */

import { isPlaceholderPhone } from "@/lib/twilio"
import {
  buildQuoteFollowUpSchedule,
  buildRepliedNotBookedSchedule,
  type PausedStep,
} from "@/lib/sequences"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export const RESUME_AFTER_HOURS = 48

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** An untouched lead older than this is history, not news: stamped quietly. */
const ALERT_WINDOW_MS = 2 * HOUR
/**
 * companyId: a test stays inside one company. skipCompanies: FieldBuilt's own
 * sales tenant, whose leads (service_type null on the lead) run their own flow.
 */
type Scope = { companyId?: string; skipCompanies?: string[] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped(query: any, scope: Scope): any {
  if (scope.companyId) return query.eq("company_id", scope.companyId)
  if (scope.skipCompanies?.length) return query.not("company_id", "in", `(${scope.skipCompanies.join(",")})`)
  return query
}

export type Attention = {
  since?: string
  alerted_at?: string
  reason?: string
  resumable?: boolean
  paused_steps?: PausedStep[]
  backfilled?: boolean
  resume_skipped?: string
}

type LeadRow = {
  id: string
  company_id: string
  status: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  messenger_psid: string | null
  ai_paused: boolean | null
  last_inbound_at: string | null
  updated_at: string
  metadata: Record<string, unknown> | null
}

const LEAD_COLUMNS = "id, company_id, status, first_name, last_name, phone, messenger_psid, ai_paused, last_inbound_at, updated_at, metadata"

function attentionOf(meta: Record<string, unknown> | null | undefined): Attention {
  return { ...((meta?.attention as Attention | undefined) ?? {}) }
}

/** Merge facts about the current episode into the lead (reason, resumable, alerted_at). */
export async function markAttention(db: Db, leadId: string, patch: Attention): Promise<void> {
  const { data: lead } = await db.from("leads").select("metadata").eq("id", leadId).maybeSingle()
  const meta = { ...((lead?.metadata as Record<string, unknown> | null) ?? {}) }
  const attention = { ...attentionOf(meta), ...patch }
  if (!attention.since) attention.since = new Date().toISOString()
  meta.attention = attention
  await db.from("leads").update({ metadata: meta }).eq("id", leadId)
}

/** Coded hand-off reasons, as the owner reads them. Anything else is already plain words. */
export const REASON_TEXT: Record<string, string> = {
  out_of_area: "The home is outside your service area",
}

function leadName(l: Pick<LeadRow, "first_name" | "last_name" | "phone">): string {
  return `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "A lead"
}

// ── 1. ALERT ────────────────────────────────────────────────────────────────

async function alertNew(db: Db, now: Date, scope: Scope): Promise<number> {
  const { data } = await scoped(db
    .from("leads").select(LEAD_COLUMNS)
    .eq("status", "needs_attention").is("deleted_at", null)
    .is("metadata->attention->>alerted_at", null), scope)
    .limit(25)
  let sent = 0
  for (const lead of (data ?? []) as LeadRow[]) {
    const meta = { ...(lead.metadata ?? {}) }
    const attention = attentionOf(meta)
    const fresh = now.getTime() - new Date(lead.updated_at).getTime() <= ALERT_WINDOW_MS
    // A lead that sat in needs_attention before this sweep existed is not new
    // news, and its episode is too old to restart on its own.
    if (!fresh) {
      meta.attention = { ...attention, since: attention.since ?? now.toISOString(), alerted_at: now.toISOString(), backfilled: true, resumable: false }
      await db.from("leads").update({ metadata: meta }).eq("id", lead.id)
      continue
    }
    meta.attention = { ...attention, since: attention.since ?? now.toISOString(), alerted_at: now.toISOString() }
    // Claim first, text second: a direct alert racing this sweep cannot double up.
    const { data: claimed } = await db
      .from("leads").update({ metadata: meta })
      .eq("id", lead.id).is("metadata->attention->>alerted_at", null)
      .select("id")
    if (!claimed || claimed.length === 0) continue
    const { notifyNeedsAttention } = await import("@/lib/notifications")
    const why = attention.reason ? REASON_TEXT[attention.reason] ?? attention.reason : "Your assistant handed this lead to you"
    await notifyNeedsAttention(lead.company_id, leadName(lead), lead.phone && !isPlaceholderPhone(lead.phone) ? lead.phone : "", lead.id, { skipStamp: true, reason: why })
    sent++
  }
  return sent
}

// ── 2. CLEAR ────────────────────────────────────────────────────────────────

async function clearFinished(db: Db, scope: Scope): Promise<number> {
  const { data } = await scoped(db
    .from("leads").select("id, status, metadata")
    .neq("status", "needs_attention")
    .not("metadata->attention", "is", null), scope)
    .limit(50)
  let cleared = 0
  for (const lead of (data ?? []) as Array<Pick<LeadRow, "id" | "status" | "metadata">>) {
    const meta = { ...(lead.metadata ?? {}) }
    delete meta.attention
    await db.from("leads").update({ metadata: meta }).eq("id", lead.id).neq("status", "needs_attention")
    cleared++
  }
  return cleared
}

// ── 3. RESUME ───────────────────────────────────────────────────────────────

/**
 * Moves steps forward by whole days until the first one is at least ten
 * minutes away, so every step keeps its time of day and the gaps between them.
 */
function shiftForward(steps: PausedStep[], now: Date): PausedStep[] {
  if (steps.length === 0) return []
  const earliest = Math.min(...steps.map((s) => new Date(s.scheduled_at).getTime()))
  const target = now.getTime() + 10 * 60 * 1000
  const days = earliest >= target ? 0 : Math.ceil((target - earliest) / DAY)
  return steps
    .map((s) => ({ ...s, scheduled_at: new Date(new Date(s.scheduled_at).getTime() + days * DAY).toISOString() }))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
}

async function resumeOne(db: Db, lead: LeadRow, now: Date): Promise<"resumed" | "kept"> {
  const meta = { ...(lead.metadata ?? {}) }
  const attention = attentionOf(meta)
  const keep = async (why: string) => {
    meta.attention = { ...attention, resumable: false, resume_skipped: why }
    await db.from("leads").update({ metadata: meta }).eq("id", lead.id).eq("status", "needs_attention")
    console.log(`[attention] lead ${lead.id} stays with a person: ${why}`)
    return "kept" as const
  }

  // Booked while flagged (a person booked by hand and left the status): nothing to chase.
  const { count: upcoming } = await db
    .from("appointments").select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id).eq("status", "scheduled").gte("scheduled_at", now.toISOString())
  if ((upcoming ?? 0) > 0) return keep("a measure is booked")

  const reachable = (!!lead.phone && !isPlaceholderPhone(lead.phone)) || !!lead.messenger_psid
  if (!reachable) return keep("no phone number to text")

  const quoteStage = !!meta.quote_sent_at
  const measureDone = !quoteStage && !!meta.measure_done_at
  if (measureDone) return keep("the measure is done and the quote is owed by the team")

  const { data: agentCfg } = await db
    .from("ai_agent_config").select("timezone").eq("company_id", lead.company_id).maybeSingle()
  const tz = (agentCfg?.timezone as string | null) ?? "America/New_York"

  let steps: PausedStep[]
  const paused = (attention.paused_steps ?? []).filter((s) =>
    quoteStage ? s.sequence_type === "quote_follow_up" : s.sequence_type !== "quote_follow_up")

  if (paused.length > 0) {
    steps = shiftForward(paused, now)
  } else if (quoteStage) {
    // The hand-off came from a path that did not record its steps: continue the
    // chase after the last text it actually sent.
    const { data: sent } = await db
      .from("sequences").select("step")
      .eq("lead_id", lead.id).eq("sequence_type", "quote_follow_up").eq("status", "sent")
    const lastSent = Math.max(0, ...((sent ?? []) as Array<{ step: number }>).map((r) => r.step))
    const plan = buildQuoteFollowUpSchedule(new Date(meta.quote_sent_at as string), tz)
      .filter((s) => s.step > lastSent)
      .map((s) => ({ sequence_type: "quote_follow_up", step: s.step, scheduled_at: s.scheduledAt.toISOString() }))
    if (plan.length === 0) return keep("the quote chase already sent every text")
    steps = shiftForward(plan, now)
  } else if (lead.last_inbound_at) {
    steps = buildRepliedNotBookedSchedule(now, tz)
      .map((s) => ({ sequence_type: "replied_not_booked", step: s.step, scheduled_at: s.scheduledAt.toISOString() }))
  } else {
    return keep("the lead never replied and no follow-ups were running")
  }

  const nextStatus = quoteStage ? "quote_sent" : lead.last_inbound_at ? "active_conversation" : "following_up"
  const history = Array.isArray(meta.attention_history) ? [...(meta.attention_history as unknown[])] : []
  history.push({ since: attention.since, reason: attention.reason ?? null, resumed_at: now.toISOString(), steps: steps.length })
  delete meta.attention
  meta.attention_history = history.slice(-10)

  // Claim the lead by its status: a person who moved it a second ago wins.
  const { data: claimed } = await db
    .from("leads").update({ status: nextStatus, metadata: meta })
    .eq("id", lead.id).eq("status", "needs_attention").eq("ai_paused", false)
    .select("id")
  if (!claimed || claimed.length === 0) return "kept"

  // Anything still pending (an owner who set the status by hand does not stop
  // the follow-ups) is replaced, never doubled.
  await db.from("sequences").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "pending")
  await db.from("sequences").insert(steps.map((s) => ({
    lead_id: lead.id,
    company_id: lead.company_id,
    sequence_type: s.sequence_type,
    step: s.step,
    scheduled_at: s.scheduled_at,
    status: "pending",
  })))
  console.log(`[attention] lead ${lead.id}: nobody acted within ${RESUME_AFTER_HOURS}h of the hand-off, back to ${nextStatus} with ${steps.length} follow-up${steps.length === 1 ? "" : "s"} (first ${steps[0]?.scheduled_at})`)
  return "resumed"
}

async function resumeStale(db: Db, now: Date, scope: Scope): Promise<number> {
  const cutoff = new Date(now.getTime() - RESUME_AFTER_HOURS * HOUR).toISOString()
  const { data } = await scoped(db
    .from("leads").select(LEAD_COLUMNS)
    .eq("status", "needs_attention").is("deleted_at", null).eq("ai_paused", false)
    .lt("metadata->attention->>since", cutoff), scope)
    .limit(25)
  let resumed = 0
  for (const lead of (data ?? []) as LeadRow[]) {
    const attention = attentionOf(lead.metadata)
    if (attention.resumable === false) continue
    // The wait restarts whenever the lead writes in: the clock is for silence.
    if (lead.last_inbound_at && new Date(lead.last_inbound_at).getTime() > now.getTime() - RESUME_AFTER_HOURS * HOUR) continue
    try {
      if ((await resumeOne(db, lead, now)) === "resumed") resumed++
    } catch (err) {
      console.error(`[attention] resume failed for lead ${lead.id}:`, err)
    }
  }
  return resumed
}

/** The cron sweeps every client company; a test passes one company id. */
export async function sweepAttention(
  db: Db,
  now = new Date(),
  scope: Scope = {}
): Promise<{ alerted: number; cleared: number; resumed: number }> {
  const out = { alerted: 0, cleared: 0, resumed: 0 }
  if (!scope.companyId) {
    const { data: sales } = await db.from("companies").select("id").eq("service_type", "fieldbuilt_sales")
    scope = { ...scope, skipCompanies: ((sales ?? []) as Array<{ id: string }>).map((c) => c.id) }
  }
  try { out.alerted = await alertNew(db, now, scope) } catch (err) { console.error("[attention] alert pass failed:", err) }
  try { out.cleared = await clearFinished(db, scope) } catch (err) { console.error("[attention] clear pass failed:", err) }
  try { out.resumed = await resumeStale(db, now, scope) } catch (err) { console.error("[attention] resume pass failed:", err) }
  return out
}
