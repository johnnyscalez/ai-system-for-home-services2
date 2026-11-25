import { NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { GRAPH, clearAdInsightsCache } from "@/lib/meta-ads"

// POST /api/integrations/facebook/disconnect
// Stops lead and Messenger delivery for the Page and forgets the connection.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })
  const companyId = profile.company_id as string

  const db = createServiceRoleClient()
  const { data: integration } = await db
    .from("integrations")
    .select("fb_page_id, fb_access_token")
    .eq("company_id", companyId)
    .eq("type", "facebook")
    .maybeSingle()

  // Unsubscribe the Page from our app so Meta stops sending its events. Best
  // effort: an expired token must not block the owner from disconnecting. Skipped
  // when another company still uses the same Page.
  let unsubscribed: boolean | null = null
  if (integration?.fb_page_id && integration?.fb_access_token) {
    const { count: others } = await db
      .from("integrations").select("id", { count: "exact", head: true })
      .eq("fb_page_id", integration.fb_page_id).eq("is_active", true).neq("company_id", companyId)
    if ((others ?? 0) === 0) {
      try {
        const res = await fetch(
          `${GRAPH}/${integration.fb_page_id}/subscribed_apps?access_token=${integration.fb_access_token}`,
          { method: "DELETE", signal: AbortSignal.timeout(10000) }
        )
        const body = await res.json().catch(() => ({}))
        unsubscribed = !!body?.success
        if (!unsubscribed) console.warn(`[fb-disconnect] page ${integration.fb_page_id} unsubscribe refused:`, body?.error?.message ?? body)
      } catch (err) {
        unsubscribed = false
        console.warn(`[fb-disconnect] page ${integration.fb_page_id} unsubscribe failed:`, err)
      }
    }
  }

  await db.from("integrations").delete().eq("company_id", companyId).eq("type", "facebook")
  await db.from("facebook_connections").delete().eq("company_id", companyId)
  clearAdInsightsCache(companyId)

  return NextResponse.json({ success: true, unsubscribed })
}
