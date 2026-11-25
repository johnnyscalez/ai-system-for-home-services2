// One status vocabulary for the whole CRM (pipeline board, leads table,
// conversations list, dashboard, reports, lead detail). Every status label,
// colour, board column and the list of statuses a person may set by hand live
// here so the screens cannot drift apart.
//
// The strings are the contract with the engine (lib/ai-engine, lib/sequences,
// the webhooks and the cron write them). Client safe: no server imports.

export type LeadStatusMeta = { label: string; badge: string }

const SKY = "bg-sky-50 text-sky-700 border-sky-200"
const ORANGE = "bg-orange-50 text-orange-700 border-orange-200"
const ACTIVE = "bg-[#FFF3EC] text-[#EA580C] border-[#F97316]/25"
const AMBER = "bg-amber-50 text-amber-700 border-amber-200"
const RED = "bg-red-50 text-red-600 border-red-200"
const MEASURE = "bg-emerald-50 text-emerald-700 border-emerald-200"
const QUOTE = "bg-teal-50 text-teal-700 border-teal-200"
const SIGNED = "bg-green-50 text-green-700 border-green-200"
const LOST = "bg-slate-50 text-slate-500 border-slate-200"

export const LEAD_STATUS: Record<string, LeadStatusMeta> = {
  needs_attention:     { label: "Needs attention", badge: RED },
  just_came_in:        { label: "New",             badge: SKY },
  new:                 { label: "New",             badge: SKY },
  contacted:           { label: "New",             badge: SKY },
  following_up:        { label: "No reply",        badge: ORANGE },
  // Quiet, but the follow-ups are still running: not lost yet.
  cold:                { label: "No reply",        badge: ORANGE },
  active_conversation: { label: "In conversation", badge: ACTIVE },
  followed_up:         { label: "In conversation", badge: ACTIVE },
  nurturing:           { label: "In conversation", badge: ACTIVE },
  qualified:           { label: "Qualified",       badge: AMBER },
  appointment_booked:  { label: "Measure booked",  badge: MEASURE },
  measure_done:        { label: "Measure done",    badge: QUOTE },
  quote_sent:          { label: "Quote sent",      badge: QUOTE },
  closed:              { label: "Signed",          badge: SIGNED },
  closed_won:          { label: "Signed",          badge: SIGNED },
  lost:                { label: "Lost",            badge: LOST },
  closed_lost:         { label: "Lost",            badge: LOST },
  unqualified:         { label: "Unqualified",     badge: LOST },
}

const FALLBACK_BADGE = "bg-slate-50 text-slate-500 border-slate-200"

export function getLeadStatus(status: string | null | undefined): LeadStatusMeta {
  const s = status ?? ""
  return (
    LEAD_STATUS[s] ?? {
      label: s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Unknown",
      badge: FALLBACK_BADGE,
    }
  )
}

export function leadStatusLabel(status: string | null | undefined): string {
  return getLeadStatus(status).label
}

export function leadStatusBadge(status: string | null | undefined): string {
  return getLeadStatus(status).badge
}

// ── Pipeline board ───────────────────────────────────────────────────────────

export type PipelineColumn = {
  key: string
  label: string
  /** Every status that shows in this column */
  statuses: string[]
  /** The status a lead gets when a person drops it here */
  dropStatus: string
  /** Text colour for the header and the idle dot */
  color: string
  dot: string
  /** Solid chip colour used by filter chips */
  chip: string
}

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  { key: "needs_attention",     label: "Needs attention", statuses: ["needs_attention"],                                dropStatus: "needs_attention",     color: "text-red-600",     dot: "bg-red-500",     chip: "bg-red-500 text-white border-red-500" },
  { key: "new",                 label: "New",             statuses: ["just_came_in", "new", "contacted"],               dropStatus: "just_came_in",        color: "text-sky-600",     dot: "bg-sky-500",     chip: "bg-sky-500 text-white border-sky-500" },
  { key: "no_reply",            label: "No reply",        statuses: ["following_up", "cold"],                           dropStatus: "following_up",        color: "text-orange-600",  dot: "bg-orange-500",  chip: "bg-orange-500 text-white border-orange-500" },
  { key: "in_conversation",     label: "In conversation", statuses: ["active_conversation", "followed_up", "nurturing"], dropStatus: "active_conversation", color: "text-[#EA580C]",   dot: "bg-[#F97316]",   chip: "bg-[#F97316] text-white border-[#F97316]" },
  { key: "qualified",           label: "Qualified",       statuses: ["qualified"],                                      dropStatus: "qualified",           color: "text-amber-600",   dot: "bg-amber-500",   chip: "bg-amber-500 text-white border-amber-500" },
  { key: "measure_booked",      label: "Measure booked",  statuses: ["appointment_booked"],                             dropStatus: "appointment_booked",  color: "text-emerald-600", dot: "bg-emerald-500", chip: "bg-emerald-500 text-white border-emerald-500" },
  { key: "quote_out",           label: "Quote out",       statuses: ["measure_done", "quote_sent"],                     dropStatus: "measure_done",        color: "text-teal-600",    dot: "bg-teal-500",    chip: "bg-teal-500 text-white border-teal-500" },
  { key: "signed",              label: "Signed",          statuses: ["closed", "closed_won"],                           dropStatus: "closed_won",          color: "text-green-700",   dot: "bg-green-600",   chip: "bg-green-600 text-white border-green-600" },
  { key: "lost",                label: "Lost",            statuses: ["lost", "closed_lost", "unqualified"],             dropStatus: "lost",                color: "text-slate-500",   dot: "bg-slate-400",   chip: "bg-slate-500 text-white border-slate-500" },
]

/** The column a status belongs to. Unknown statuses fall into "New" so no lead is ever unreachable. */
export function pipelineColumnOf(status: string | null | undefined): PipelineColumn {
  return PIPELINE_COLUMNS.find((c) => c.statuses.includes(status ?? "")) ?? PIPELINE_COLUMNS[1]
}

/** Column label for a status: the coarse stage used by filters and counts. */
export function leadStageLabel(status: string | null | undefined): string {
  return pipelineColumnOf(status).label
}

// ── Statuses a person may set by hand ────────────────────────────────────────

export const MANUAL_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "needs_attention",     label: "Needs attention" },
  { value: "just_came_in",        label: "New" },
  { value: "following_up",        label: "No reply" },
  { value: "active_conversation", label: "In conversation" },
  { value: "qualified",           label: "Qualified" },
  { value: "appointment_booked",  label: "Measure booked" },
  { value: "measure_done",        label: "Measure done" },
  { value: "quote_sent",          label: "Quote sent" },
  { value: "closed_won",          label: "Signed" },
  { value: "unqualified",         label: "Unqualified" },
  { value: "lost",                label: "Lost" },
]

const MANUAL_STATUS_VALUES = new Set(MANUAL_STATUS_OPTIONS.map((o) => o.value))

export function isManualStatus(status: unknown): status is string {
  return typeof status === "string" && MANUAL_STATUS_VALUES.has(status)
}

/**
 * The hand-settable option that represents a stored status. Legacy and
 * engine-only values ("contacted", "cold", "closed_lost"...) map to the option
 * of their column so the status control always shows a real selection.
 */
export function manualStatusFor(status: string | null | undefined): string {
  const s = status ?? ""
  if (MANUAL_STATUS_VALUES.has(s)) return s
  if (s === "closed_lost") return "lost"
  return pipelineColumnOf(s).dropStatus
}

// ── Status groups used by dashboard and reports ──────────────────────────────

export const SIGNED_STATUSES = ["closed", "closed_won"] as const
export const QUOTE_STAGE_STATUSES = ["measure_done", "quote_sent"] as const
export const LOST_STATUSES = ["lost", "closed_lost", "unqualified"] as const
/** The lead reached a booked measure, or anything after it. */
export const MEASURE_REACHED_STATUSES = ["appointment_booked", "measure_done", "quote_sent", "closed", "closed_won"] as const
/** The lead replied, or got further than that. */
export const ENGAGED_STATUSES = [
  "active_conversation", "followed_up", "nurturing", "qualified", "unqualified", "needs_attention",
  ...MEASURE_REACHED_STATUSES,
] as const

export function isSignedStatus(status: string | null | undefined): boolean {
  return (SIGNED_STATUSES as readonly string[]).includes(status ?? "")
}

// ── Phone placeholders ───────────────────────────────────────────────────────

/**
 * Leads without a number carry an internal placeholder in leads.phone
 * ("msgr:<psid>", "fbform:<id>", "manual:<uuid>"). Same rule as
 * isPlaceholderPhone in lib/twilio (which is server only): a real phone is E.164.
 */
export function hasRealPhone(phone: string | null | undefined): boolean {
  return !!phone && /^\+\d{8,15}$/.test(phone)
}
