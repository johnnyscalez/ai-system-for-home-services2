import { createServiceRoleClient } from "@/lib/supabase-server"

// ─────────────────────────────────────────────────────────────────────────────
// Quoted-price capture: what the AI actually SOLD in the conversation.
//
// For fixed-price services (duct cleaning: $189/furnace, $249 condo) the sale
// value is fully determined the moment the customer agrees — property type ×
// unit count — yet nothing downstream recorded it: HCP jobs landed at $0 and
// "revenue booked by AI" could only count money AFTER the office invoiced.
//
// Resolution ladder, cheapest and most reliable first:
//   1. AGENT     — the amount the model passed to book_appointment. It just
//                  negotiated it; nobody knows it better.
//   2. COMPUTED  — company price book × captured unit count. Deterministic.
//   3. LLM       — one cheap Haiku pass over the transcript, ONLY when the
//                  first two are unavailable (same pattern as ensureLeadName:
//                  prompt instructions are probabilistic, so there is always a
//                  deterministic-ish backstop rather than a single fragile path).
// Nothing is ever invented: when all three fail the amount stays null and the
// dashboard reports it as unpriced rather than guessing.
// ─────────────────────────────────────────────────────────────────────────────

export type PricingRule = {
  property_types?: string[]   // empty/absent = any
  job_types?: string[]        // canonical-ish job families; empty/absent = any
  unit_price_cents: number
  per_unit?: boolean          // true = × unit count
}

export type PricingRules = {
  currency?: string
  unit_label?: string         // "furnace", "system", "unit"
  rules?: PricingRule[]
  default_unit_price_cents?: number | null
}

const PROPERTY_ALIASES: Record<string, string> = {
  house: "house", home: "house", "single-family": "house", single_family: "house",
  townhome: "townhome", townhouse: "townhome", rowhouse: "townhome",
  condo: "condo", condominium: "condo",
  apartment: "apartment", apt: "apartment", unit: "apartment", flat: "apartment",
}

export function normalizePropertyType(v: string | null | undefined): string | null {
  const s = (v ?? "").toLowerCase().trim().replace(/[\s]+/g, "_")
  if (!s) return null
  for (const [k, canon] of Object.entries(PROPERTY_ALIASES)) {
    if (s === k || s.includes(k)) return canon
  }
  return null
}

/** Price a job from the company's price book. Returns null when no rule matches. */
export function priceFromRules(
  rules: PricingRules | null | undefined,
  propertyType: string | null,
  jobType: string | null,
  unitCount: number | null
): number | null {
  if (!rules?.rules?.length) return null
  const prop = normalizePropertyType(propertyType)
  const job = (jobType ?? "").toLowerCase()
  const units = Math.max(1, Math.min(unitCount ?? 1, 20)) // sanity clamp

  const matches = (r: PricingRule) => {
    const propOk = !r.property_types?.length || (prop != null && r.property_types.map(normalizePropertyType).includes(prop))
    const jobOk = !r.job_types?.length || r.job_types.some((j) => job.includes(j.toLowerCase()))
    return propOk && jobOk
  }
  // Most specific rule wins (more constraints = more specific)
  const candidates = rules.rules
    .filter(matches)
    .sort((a, b) =>
      ((b.property_types?.length ?? 0) + (b.job_types?.length ?? 0)) -
      ((a.property_types?.length ?? 0) + (a.job_types?.length ?? 0))
    )
  const rule = candidates[0]
  if (!rule) {
    return rules.default_unit_price_cents != null ? rules.default_unit_price_cents * units : null
  }
  return rule.per_unit === false ? rule.unit_price_cents : rule.unit_price_cents * units
}

export type QuoteResolution = {
  amountCents: number | null
  source: "agent" | "computed" | "llm" | null
  unitCount: number | null
  propertyType: string | null
}

/** Sanity band — a quoted residential job outside this range is a model error. */
const MIN_CENTS = 1_00
const MAX_CENTS = 100_000_00

function sane(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents)) return null
  const c = Math.round(cents)
  return c >= MIN_CENTS && c <= MAX_CENTS ? c : null
}

/**
 * Resolve the quoted value for a booking. Call once, right after the
 * appointment is created.
 */
export async function resolveQuotedAmount(opts: {
  companyId: string
  leadId: string
  jobType: string | null
  /** what the agent passed to book_appointment, if anything */
  agentTotalCents?: number | null
  agentUnitCount?: number | null
  agentPropertyType?: string | null
}): Promise<QuoteResolution> {
  const db = createServiceRoleClient()

  const [{ data: cfg }, { data: lead }] = await Promise.all([
    db.from("ai_agent_config").select("pricing_rules").eq("company_id", opts.companyId).maybeSingle(),
    db.from("leads").select("system_type, notes").eq("id", opts.leadId).maybeSingle(),
  ])
  const rules = (cfg?.pricing_rules ?? null) as PricingRules | null

  // Structured hints already captured on the lead (e.g. system_type
  // "House, 1 furnace") — used to fill gaps, never to override the agent.
  const hintText = `${lead?.system_type ?? ""} ${lead?.notes ?? ""}`
  const hintUnits = (() => {
    const m = hintText.match(/(\d+)\s*(furnace|system|unit|ac|air handler)/i)
    return m ? parseInt(m[1], 10) : null
  })()
  const hintProperty = normalizePropertyType(hintText.match(/\b(house|home|townhome|townhouse|condo|apartment)\b/i)?.[1] ?? null)

  const unitCount = opts.agentUnitCount ?? hintUnits ?? null
  const propertyType = normalizePropertyType(opts.agentPropertyType ?? null) ?? hintProperty

  // 1. AGENT
  const agentCents = sane(opts.agentTotalCents ?? null)
  if (agentCents != null) {
    return { amountCents: agentCents, source: "agent", unitCount, propertyType }
  }

  // 2. COMPUTED
  const computed = sane(priceFromRules(rules, propertyType, opts.jobType, unitCount))
  if (computed != null) {
    return { amountCents: computed, source: "computed", unitCount, propertyType }
  }

  // 3. LLM — last resort, only when the company has no usable price book
  // match AND the agent said nothing. One cheap call over the transcript.
  try {
    const llm = await extractQuotedFromTranscript(opts.leadId)
    const cents = sane(llm)
    if (cents != null) return { amountCents: cents, source: "llm", unitCount, propertyType }
  } catch (err) {
    console.error("[pricing] LLM quote extraction failed:", err)
  }

  return { amountCents: null, source: null, unitCount, propertyType }
}

/** One Haiku pass: find the total price the customer AGREED to, or nothing. */
async function extractQuotedFromTranscript(leadId: string): Promise<number | null> {
  const db = createServiceRoleClient()
  const { data: msgs } = await db
    .from("conversations")
    .select("direction, body")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(40)
  if (!msgs?.length) return null

  const transcript = msgs
    .map((m) => `${m.direction === "inbound" ? "Customer" : "Agent"}: ${m.body ?? ""}`)
    .join("\n")
    .slice(-6000)

  const { anthropic } = await import("@/lib/claude")
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    tools: [{
      name: "record_quote",
      description: "Record the total price the customer agreed to pay for the booked job.",
      input_schema: {
        type: "object" as const,
        properties: {
          total_dollars: {
            type: "number",
            description: "The TOTAL agreed price in dollars for the whole booked job (all units combined). Omit entirely if no price was agreed or the job is a free/estimate visit.",
          },
        },
      },
    }],
    tool_choice: { type: "any" },
    messages: [{
      role: "user",
      content:
        `Read this booking conversation and report the TOTAL price the customer agreed to pay.\n\n` +
        `Rules: report the FINAL agreed total, not a per-unit rate and not a price the customer ` +
        `declined. CORRECTIONS WIN: if an earlier detail was later corrected, only the final ` +
        `corrected version counts — a customer who first said two furnaces and later settled on ` +
        `one furnace at $189 agreed to 189, never 378. Never multiply units yourself unless the ` +
        `agent explicitly stated that multiplied total and the customer accepted it. When the ` +
        `agent's last stated total was accepted (with words like "ok", "yes", "sounds good"), ` +
        `that number is the answer. If the visit is a free estimate or no price was agreed, ` +
        `omit the field. Any language.\n\n${transcript}`,
    }],
  })
  const block = res.content.find((b) => b.type === "tool_use")
  if (!block || block.type !== "tool_use") return null
  const out = block.input as { total_dollars?: number }
  if (typeof out.total_dollars !== "number" || !Number.isFinite(out.total_dollars)) return null
  return Math.round(out.total_dollars * 100)
}

/** Persist a resolution onto the appointment (and mirror to the lead). */
export async function saveQuotedAmount(appointmentId: string, leadId: string, q: QuoteResolution): Promise<void> {
  if (q.amountCents == null) return
  const db = createServiceRoleClient()
  await db.from("appointments").update({
    quoted_amount_cents: q.amountCents,
    quoted_source: q.source,
    quoted_unit_count: q.unitCount,
    quoted_property_type: q.propertyType,
  }).eq("id", appointmentId)
  // deal_value is the CRM's pipeline number (dollars) — fill only if unset so
  // an office-entered value is never overwritten by an estimate.
  await db.from("leads")
    .update({ deal_value: Math.round(q.amountCents / 100) })
    .eq("id", leadId)
    .is("deal_value", null)
  console.log(`[pricing] appointment ${appointmentId} quoted $${(q.amountCents / 100).toFixed(2)} via ${q.source}`)
}
