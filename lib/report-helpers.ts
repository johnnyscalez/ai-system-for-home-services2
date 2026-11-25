// Shared by app/(dashboard)/reports/page.tsx and /api/reports/stats so the first
// paint and every later date-range fetch compute the numbers the same way.

import { JOB_TYPES, JOB_TYPE_LABELS, getJobTypeLabel } from "@/lib/job-types"

import {
  ENGAGED_STATUSES, MEASURE_REACHED_STATUSES, QUOTE_STAGE_STATUSES, SIGNED_STATUSES, LOST_STATUSES,
} from "@/lib/lead-status"

// Funnel stages are cumulative: a signed lead also counts as engaged, as a
// booked measure and as a quote. The status groups come from lib/lead-status so
// the funnel and the pipeline board can never disagree about a status.
const ENGAGED = new Set<string>(ENGAGED_STATUSES)
const MEASURE_BOOKED = new Set<string>(MEASURE_REACHED_STATUSES)
const QUOTE_OUT = new Set<string>([...QUOTE_STAGE_STATUSES, ...SIGNED_STATUSES])
const SIGNED = new Set<string>(SIGNED_STATUSES)
const LOST = new Set<string>(LOST_STATUSES)

export type FunnelStage = {
  stage: "leads" | "engaged" | "measure_booked" | "quote_out" | "signed" | "lost"
  count: number
}

/** Conversion funnel from CURRENT lead statuses. */
export function buildFunnel(leads: { status: string }[]): FunnelStage[] {
  const count = (set: Set<string>) => leads.filter((l) => set.has(l.status)).length
  return [
    { stage: "leads", count: leads.length },
    { stage: "engaged", count: count(ENGAGED) },
    { stage: "measure_booked", count: count(MEASURE_BOOKED) },
    { stage: "quote_out", count: count(QUOTE_OUT) },
    { stage: "signed", count: count(SIGNED) },
    { stage: "lost", count: count(LOST) },
  ]
}

/**
 * Lead source as counted in reports. Leads that arrived over the retired
 * WhatsApp channel are text-in leads now, so they fold into "sms".
 */
export function normalizeLeadSource(source: string | null | undefined): string {
  const s = (source ?? "").trim()
  if (!s) return "unknown"
  if (s === "whatsapp" || s === "sms_inbound") return "sms"
  return s
}

const ENUM_BY_LABEL = new Map<string, string>(
  JOB_TYPES.map((t) => [JOB_TYPE_LABELS[t].toLowerCase(), t as string])
)

/** Collapse enum values ("lvp") and labels ("LVP / Vinyl Plank") to one display label. */
export function normalizeJobTypeLabel(raw: string | null | undefined): string {
  const v = (raw ?? "").trim()
  if (!v) return ""
  const lower = v.toLowerCase()
  const asEnum = (JOB_TYPES as readonly string[]).includes(lower)
    ? lower
    : ENUM_BY_LABEL.get(lower) ?? null
  return asEnum ? getJobTypeLabel(asEnum) : v
}

export type JobTypeRevenueRow = { name: string; jobs: number; revenue: number; avgJob: number }

export function groupRevenueByJobType(
  deals: { closed_job_type: string | null; deal_value: unknown; refund_amount: unknown }[]
): JobTypeRevenueRow[] {
  const map: Record<string, { name: string; jobs: number; revenue: number }> = {}
  for (const d of deals) {
    const name = normalizeJobTypeLabel(d.closed_job_type) || "Unspecified"
    const key = name.toLowerCase()
    if (!map[key]) map[key] = { name, jobs: 0, revenue: 0 }
    map[key].jobs++
    map[key].revenue += Math.max(0, (Number(d.deal_value) || 0) - (Number(d.refund_amount) || 0))
  }
  return Object.values(map)
    .map((j) => ({ ...j, avgJob: j.jobs > 0 ? Math.round(j.revenue / j.jobs) : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}
