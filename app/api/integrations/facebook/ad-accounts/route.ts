import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { adAccountStatusLabel, fetchAdAccounts, readFbCache } from "@/lib/meta-ads"

// GET /api/integrations/facebook/ad-accounts[?refresh=1]
// The ad accounts the connected Facebook login can see. Served from the list
// stored at login; ?refresh=1 asks Facebook again (after the owner was added to
// an ad account, for example). Ids, names and status only: no tokens.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: integration } = await db
    .from("integrations")
    .select("fb_pages_cache, fb_user_access_token")
    .eq("company_id", profile.company_id)
    .eq("type", "facebook")
    .maybeSingle()
  if (!integration) return NextResponse.json({ error: "Facebook is not connected" }, { status: 404 })

  let cache = readFbCache(integration.fb_pages_cache)
  const refresh = new URL(req.url).searchParams.get("refresh") === "1"

  if (refresh && integration.fb_user_access_token) {
    const fresh = await fetchAdAccounts(integration.fb_user_access_token as string)
    cache = { ...cache, adAccounts: fresh.error ? cache.adAccounts : fresh.accounts, adAccountsError: fresh.error ?? null, fetchedAt: new Date().toISOString() }
    await db.from("integrations").update({ fb_pages_cache: cache })
      .eq("company_id", profile.company_id).eq("type", "facebook")
  }

  return NextResponse.json({
    adAccounts: cache.adAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      status: adAccountStatusLabel(a.account_status),
      active: a.account_status === 1 || a.account_status == null,
      currency: a.currency ?? null,
      business: a.business_name ?? null,
    })),
    error: cache.adAccountsError ?? null,
  })
}
