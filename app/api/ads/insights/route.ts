import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getAdInsights, type AdRangeInput } from "@/lib/meta-ads"

export const runtime = "nodejs"

// GET /api/ads/insights?range=last_7d|last_30d|this_month
// GET /api/ads/insights?since=YYYY-MM-DD&until=YYYY-MM-DD
//
// Ad spend and results from the connected Facebook ad account, joined with what
// the CRM recorded in the same days. Always 200 for a signed-in company; the body
// says what is missing instead of an HTTP error:
//   { connected: false }                     Facebook is not connected
//   { connected: true, needsAdAccount: true } connected, no ad account chosen
//   { connected: true, error: "..." }         Facebook refused (permission, expired login)
//   { connected: true, totals, campaigns, crm, ... }
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const sp = new URL(req.url).searchParams
  const since = sp.get("since")
  const until = sp.get("until")
  const preset = sp.get("range")
  const range: AdRangeInput =
    since && until
      ? { since, until }
      : { preset: preset === "last_7d" || preset === "this_month" ? preset : "last_30d" }

  try {
    const result = await getAdInsights(profile.company_id as string, range)
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (err) {
    console.error("[ads/insights] failed:", err)
    return NextResponse.json({ connected: true, error: "Could not load ad results right now. Try again in a minute." })
  }
}
