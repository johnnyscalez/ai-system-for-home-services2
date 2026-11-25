// Per-call Anthropic usage + estimated cost. Log-only: never throws, never alters a reply.
// Per million tokens: input / cache write (5m) / cache read / output.
const PRICES: Record<string, { in: number; write: number; read: number; out: number }> = {
  sonnet: { in: 3, write: 3.75, read: 0.3, out: 15 },
  haiku: { in: 1, write: 1.25, read: 0.1, out: 5 },
}

type UsageLike = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation?: { ephemeral_1h_input_tokens?: number | null } | null
} | null | undefined

export function logUsage(args: {
  site: string
  companyId?: string | null
  leadId?: string | null
  model: string
  usage: UsageLike
}): void {
  try {
    const u = args.usage
    if (!u) return
    const p = args.model.includes("haiku") ? PRICES.haiku : PRICES.sonnet
    const input = u.input_tokens ?? 0
    const write = u.cache_creation_input_tokens ?? 0
    const read = u.cache_read_input_tokens ?? 0
    const out = u.output_tokens ?? 0
    // 1-hour cache writes bill at 2x base input ($6/M Sonnet, $2/M Haiku) instead of the 5-minute rate.
    const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0
    const write5m = Math.max(0, write - write1h)
    const cost =
      (input * p.in + write5m * p.write + write1h * p.in * 2 + read * p.read + out * p.out) / 1_000_000
    console.log(
      "[claude-usage] " +
        JSON.stringify({
          site: args.site,
          companyId: args.companyId ?? null,
          leadId: args.leadId ?? null,
          model: args.model,
          input_tokens: input,
          cache_creation_input_tokens: write,
          cache_read_input_tokens: read,
          output_tokens: out,
          est_cost_usd: Number(cost.toFixed(6)),
        }),
    )
  } catch {
    /* logging must never break a reply */
  }
}
