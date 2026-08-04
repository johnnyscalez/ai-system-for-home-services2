// ─────────────────────────────────────────────────────────────────────────────
// Qualification rules for FieldBuilt's OWN funnel (service_type
// 'fieldbuilt_sales'). Single source of truth: the landing-page form and the
// Facebook Instant Form both decide "is this shop worth our time" here, so the
// two entry points can never drift apart.
//
// Instant Forms hand back whatever option text was typed into Ads Manager
// ("3-4", "3 - 4 techs", "Between 3 and 4"), so the normalizers are tolerant
// by design — a lead must never be misjudged because of punctuation.
// ─────────────────────────────────────────────────────────────────────────────

export type TechBucket = "1-2" | "3-4" | "5-9" | "10+"
export type RevenueBucket = "<1M" | "1-2M" | "2-5M" | "5-10M" | "10M+"

const REVENUE_ORDER: RevenueBucket[] = ["<1M", "1-2M", "2-5M", "5-10M", "10M+"]

export function normalizeTechs(raw: string | null | undefined): TechBucket | null {
  const s = (raw ?? "").toLowerCase().replace(/\s+/g, "")
  if (!s) return null
  if (/10\+|10ormore|morethan10|over10|10plus/.test(s)) return "10+"
  if (/1[-–to]+2|^1$|^2$/.test(s)) return "1-2"
  if (/3[-–to]+4|^3$|^4$/.test(s)) return "3-4"
  if (/5[-–to]+9|^[5-9]$/.test(s)) return "5-9"
  // Bare number fallback ("we have 12 guys")
  const n = parseInt(s.replace(/\D/g, ""), 10)
  if (!Number.isNaN(n)) {
    if (n >= 10) return "10+"
    if (n >= 5) return "5-9"
    if (n >= 3) return "3-4"
    if (n >= 1) return "1-2"
  }
  return null
}

export function normalizeRevenue(raw: string | null | undefined): RevenueBucket | null {
  const s = (raw ?? "").toLowerCase().replace(/\s+/g, "")
  if (!s) return null
  if (/10m\+|10million\+|over10m|morethan10m|10\+m/.test(s)) return "10M+"
  if (/5[-–to]+10m|5to10million/.test(s)) return "5-10M"
  if (/2[-–to]+5m|2to5million/.test(s)) return "2-5M"
  if (/1[-–to]+2m|1to2million/.test(s)) return "1-2M"
  if (/<1m|under1m|lessthan1m|below1m|under\$?1million/.test(s)) return "<1M"
  return null
}

function revenueAtLeast(revenue: RevenueBucket, floor: RevenueBucket): boolean {
  return REVENUE_ORDER.indexOf(revenue) >= REVENUE_ORDER.indexOf(floor)
}

/** A shop is worth our time at 3+ techs with revenue matching the headcount. */
export function isQualified(techs: TechBucket | null, revenue: RevenueBucket | null): boolean {
  if (!techs || !revenue) return false
  if (techs === "3-4" || techs === "5-9") return revenueAtLeast(revenue, "1-2M")
  if (techs === "10+") return revenueAtLeast(revenue, "2-5M")
  return false // 1-2 techs
}

const TECH_ESTIMATE: Record<TechBucket, number> = { "1-2": 1.5, "3-4": 3.5, "5-9": 7, "10+": 12 }
const REVENUE_ESTIMATE: Record<RevenueBucket, number> = { "<1M": 0.75, "1-2M": 1.5, "2-5M": 3.5, "5-10M": 7.5, "10M+": 12 }

/** Priority signal only — never gates qualification. Revenue per tech. */
export function leadTier(techs: TechBucket | null, revenue: RevenueBucket | null): "A" | "B" | "C" {
  if (!techs || !revenue) return "C"
  const perTech = (REVENUE_ESTIMATE[revenue] * 1_000_000) / TECH_ESTIMATE[techs]
  if (perTech >= 300_000) return "A"
  if (perTech >= 200_000) return "B"
  return "C"
}

export type FunnelQualification = {
  techs: TechBucket | null
  revenue: RevenueBucket | null
  qualified: boolean
  tier: "A" | "B" | "C"
  /** True when the form never asked — we can't judge, so we don't reject. */
  undetermined: boolean
}

/**
 * Pull headcount + revenue out of arbitrary Instant Form answers.
 * Keys arrive as the question text, punctuation-stripped
 * ("how_many_techs_do_you_have").
 */
export function qualifyFromFormFields(fields: Record<string, string>): FunnelQualification {
  let techsRaw = ""
  let revenueRaw = ""

  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue
    if (!techsRaw && /tech|technician|employee|crew|installer|guys|headcount|how_many/.test(k)) techsRaw = v
    if (!revenueRaw && /revenue|sales|turnover|annual|volume|make_a_year|per_year/.test(k)) revenueRaw = v
  }

  const techs = normalizeTechs(techsRaw)
  const revenue = normalizeRevenue(revenueRaw)
  const undetermined = !techs && !revenue

  return {
    techs,
    revenue,
    // Never silently discard a paid lead the form didn't ask about — if we
    // have no signal at all, the agent works it and qualifies in conversation.
    qualified: undetermined ? true : isQualified(techs, revenue),
    tier: leadTier(techs, revenue),
    undetermined,
  }
}
