import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import {
  GRAPH, fetchAdAccounts, fbReturnUrl, parseFbReturnTarget, readFbCache, saveFacebookConnection,
  type FbCache, type FbCachedPage,
} from "@/lib/meta-ads"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // state = "<user id>:<return target>" (older links sent the bare user id).
  const rawState = searchParams.get("state") ?? ""
  const [stateUserId, stateTarget] = rawState.split(":")
  const returnTo = parseFbReturnTarget(stateTarget)
  const fail = (reason: string) => NextResponse.redirect(`${appUrl}${fbReturnUrl(returnTo, "error", reason)}`)

  if (error || !code) return fail("facebook_denied")

  const supabase = await createServerSupabaseClient()
  // getUser() validates against Supabase over the network — a transient
  // failure here used to kill the whole OAuth round-trip. Retry once.
  let { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    await new Promise((r) => setTimeout(r, 700))
    const retry = await supabase.auth.getUser()
    user = retry.data.user
  }
  if (!user) {
    console.error("[fb-callback] no session at callback (after retry). state:", rawState)
    return fail("session_lost")
  }
  if (user.id !== stateUserId) {
    console.error("[fb-callback] state mismatch. user:", user.id, "state:", rawState)
    return fail("state_mismatch")
  }

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) return fail("no_company")
  const companyId = profile.company_id as string

  const redirectUri = `${appUrl}/api/auth/facebook/callback`
  const appId = process.env.FACEBOOK_APP_ID!
  const appSecret = process.env.FACEBOOK_APP_SECRET!

  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`
  )
  const tokenData = await tokenRes.json().catch(() => ({}))
  if (!tokenData.access_token) {
    console.error("[fb-callback] code exchange failed:", tokenData?.error?.message ?? tokenData)
    return fail("token_failed")
  }

  // Exchange for long-lived user token (60 days)
  const llRes = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
  )
  const llData = await llRes.json().catch(() => ({}))
  const userToken: string = llData.access_token || tokenData.access_token

  // Collect pages from EVERY source and merge — a client's page reaches us
  // three different ways depending on how it's shared, and checking only one
  // is why an agency-onboarded page came back empty:
  //   1. /me/accounts       — pages the person directly has a role on
  //   2. {biz}/owned_pages   — pages the Business Manager OWNS
  //   3. {biz}/client_pages  — pages PARTNER-SHARED into the BM by a client
  //                            (the runbook's "share your page with our BM"
  //                            step lands a page HERE, not in owned_pages)
  const collected: FbCachedPage[] = []

  const meRes = await fetch(
    `${GRAPH}/me/accounts?access_token=${userToken}&fields=id,name,access_token,fan_count&limit=100`
  ).then((r) => r.json()).catch(() => ({}))
  collected.push(...((meRes.data as FbCachedPage[]) ?? []))

  try {
    const bizRes = await fetch(
      `${GRAPH}/me/businesses?access_token=${userToken}&fields=id,name&limit=25`
    ).then((r) => r.json())
    const businesses: Array<{ id: string }> = bizRes.data ?? []

    const perBiz = await Promise.all(
      businesses.flatMap((biz) =>
        ["owned_pages", "client_pages"].map((edge) =>
          fetch(
            `${GRAPH}/${biz.id}/${edge}?access_token=${userToken}&fields=id,name,access_token,fan_count&limit=100`
          ).then((r) => r.json()).then((d) => (d.data as FbCachedPage[]) ?? []).catch(() => [])
        )
      )
    )
    for (const list of perBiz) collected.push(...list)
  } catch {
    // ignore — the me/accounts result may still have pages
  }

  // Dedupe by page id (a page can appear in more than one source). A copy that
  // carries a token wins over a tokenless copy of the same Page.
  const byId = new Map<string, FbCachedPage>()
  for (const p of collected) {
    if (!p?.id) continue
    const have = byId.get(p.id)
    if (!have || (!have.access_token && p.access_token)) byId.set(p.id, p)
  }
  const allPages = [...byId.values()]

  if (!allPages.length) return fail("no_pages")

  // Backfill page access tokens: client_pages sometimes returns a page with no
  // token, and a page token is what we actually message and subscribe with.
  await Promise.all(
    allPages.map(async (p) => {
      if (p.access_token) return
      try {
        const t = await fetch(`${GRAPH}/${p.id}?fields=access_token&access_token=${userToken}`).then((r) => r.json())
        if (t?.access_token) p.access_token = t.access_token
      } catch { /* left tokenless: the wizard explains how to grant the Page */ }
    })
  )

  // Ad accounts this login can see. Needs ads_read; until Meta grants it for
  // everyone this can come back refused, and the wizard then offers "skip for now".
  const ads = await fetchAdAccounts(userToken)
  if (ads.error) console.warn(`[fb-callback] ad accounts not readable for company ${companyId}: ${ads.error}`)

  const db = createServiceRoleClient()
  const { data: current } = await db
    .from("integrations")
    .select("fb_page_id, fb_access_token, fb_pages_cache, is_active, setup_complete")
    .eq("company_id", companyId)
    .eq("type", "facebook")
    .maybeSingle()

  const previous = readFbCache(current?.fb_pages_cache)
  const cache: FbCache = {
    pages: allPages,
    adAccounts: ads.accounts,
    adAccountsError: ads.error ?? null,
    selectedForms: previous.selectedForms ?? [],
    fetchedAt: new Date().toISOString(),
  }

  // A LIVE integration stays live while the owner re-runs the login: leads keep
  // flowing on the saved Page and forms until a new selection is saved in the
  // wizard. (It used to be deactivated right here, dropping every lead that
  // arrived before the wizard was finished.) Only the tokens are refreshed.
  const isLive = !!current?.is_active && !!current?.setup_complete && !!current?.fb_page_id
  const livePage = isLive ? allPages.find((p) => p.id === current!.fb_page_id) : undefined

  const row = isLive
    ? {
        company_id: companyId,
        type: "facebook",
        fb_user_id: user.id,
        fb_user_access_token: userToken,
        fb_pages_cache: cache,
        // Fresh page token when the new login still covers the live Page; otherwise keep the old one.
        ...(livePage?.access_token ? { fb_access_token: livePage.access_token } : {}),
        updated_at: new Date().toISOString(),
      }
    : {
        company_id: companyId,
        type: "facebook",
        fb_user_id: user.id,
        fb_user_access_token: userToken,
        fb_pages_cache: cache,
        fb_page_id: null,
        fb_page_name: null,
        fb_access_token: null,
        fb_selected_form_ids: [],
        setup_complete: false,
        is_active: false,
        updated_at: new Date().toISOString(),
      }

  const { error: upsertError } = await db.from("integrations").upsert(row, { onConflict: "company_id,type" })
  if (upsertError) {
    console.error("Failed to save Facebook integration:", upsertError)
    return fail("save_failed")
  }

  // The ad account reads use the USER token: keep it current on the connection row.
  await saveFacebookConnection(db, companyId, { access_token: userToken }).catch((e) =>
    console.error("[fb-callback] could not store the user token on facebook_connections:", e))

  // A reconnect is exactly when leads Facebook refused earlier become readable again.
  if (isLive) {
    import("@/lib/meta-leadgen")
      .then(({ retryPendingLeadgen }) => retryPendingLeadgen(companyId))
      .catch((e) => console.error("[fb-callback] pending lead retry failed:", e))
  }

  // On to the wizard: Page, ad account, lead forms.
  return NextResponse.redirect(`${appUrl}/connect/facebook?return_to=${returnTo}`)
}
