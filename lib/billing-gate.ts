import { createServiceRoleClient } from "@/lib/supabase-server"

/**
 * F36 billing gate — owner decision 2026-08-02: the AI hard-stops for
 * companies whose subscription is CANCELLED, but never for accounts marked
 * is_pilot. past_due does NOT block (Stripe retries the card; a payment
 * hiccup must not silently kill a customer's lead flow).
 *
 * Returns the block reason, or null when the company may keep using the AI.
 * Leads are still ingested and inbound messages still recorded while
 * blocked — only automated outreach and AI replies stop.
 */
export async function companyAiBlocked(companyId: string): Promise<string | null> {
  const db = createServiceRoleClient()
  const { data: c } = await db
    .from("companies")
    .select("plan, is_pilot")
    .eq("id", companyId)
    .maybeSingle()
  if (!c) return "company not found"
  if (c.is_pilot) return null
  if (c.plan === "cancelled") return "subscription cancelled"
  return null
}
