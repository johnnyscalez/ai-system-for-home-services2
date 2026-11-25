/**
 * "Needs attention": the owner's text when a lead is handed to a person.
 *
 * Anything can hand a lead to a person (the assistant, a failed Facebook lead,
 * an engine error, the owner by hand). The lead's status becomes
 * needs_attention and its pending follow-ups are cancelled. Before this file,
 * several of those paths never texted the owner at all.
 *
 * The lead stays with a person from there: nothing restarts its follow-ups on
 * its own (Jonathan, 2026-11-25). It leaves needs_attention only when someone
 * books it, changes its status, or turns the assistant back on.
 *
 * The bookkeeping lives on the lead, in metadata.attention:
 *   since         when the episode started
 *   alerted_at    when the owner was texted about it
 *   reason        why, when known ("out_of_area")
 *
 * sweepAttention() runs every minute from the follow-up cron. It is the
 * guarantee; the direct texts sent at the moment of a hand-off are only faster.
 *   1. ALERT   a lead in needs_attention the owner has not been texted about
 *   2. CLEAR   a lead that left needs_attention closes its episode
 */

import { isPlaceholderPhone } from "@/lib/twilio"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

const HOUR = 60 * 60 * 1000
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
  backfilled?: boolean
}

type LeadRow = {
  id: string
  company_id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  updated_at: string
  metadata: Record<string, unknown> | null
}

const LEAD_COLUMNS = "id, company_id, first_name, last_name, phone, updated_at, metadata"

function attentionOf(meta: Record<string, unknown> | null | undefined): Attention {
  return { ...((meta?.attention as Attention | undefined) ?? {}) }
}

/** Merge facts about the current episode into the lead (reason, alerted_at). */
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
    // A lead that sat in needs_attention before this sweep existed is not new news.
    if (!fresh) {
      meta.attention = { ...attention, since: attention.since ?? now.toISOString(), alerted_at: now.toISOString(), backfilled: true }
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
  for (const lead of (data ?? []) as Array<Pick<LeadRow, "id" | "metadata">>) {
    const meta = { ...(lead.metadata ?? {}) }
    delete meta.attention
    await db.from("leads").update({ metadata: meta }).eq("id", lead.id).neq("status", "needs_attention")
    cleared++
  }
  return cleared
}

/** The cron sweeps every client company; a test passes one company id. */
export async function sweepAttention(
  db: Db,
  now = new Date(),
  scope: Scope = {}
): Promise<{ alerted: number; cleared: number }> {
  const out = { alerted: 0, cleared: 0 }
  if (!scope.companyId) {
    const { data: sales } = await db.from("companies").select("id").eq("service_type", "fieldbuilt_sales")
    scope = { ...scope, skipCompanies: ((sales ?? []) as Array<{ id: string }>).map((c) => c.id) }
  }
  try { out.alerted = await alertNew(db, now, scope) } catch (err) { console.error("[attention] alert pass failed:", err) }
  try { out.cleared = await clearFinished(db, scope) } catch (err) { console.error("[attention] clear pass failed:", err) }
  return out
}
