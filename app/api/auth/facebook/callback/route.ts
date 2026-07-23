import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/integrations?error=facebook_denied`)
  }

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
    console.error("[fb-callback] no session at callback (after retry). state:", state)
    return NextResponse.redirect(`${appUrl}/integrations?error=session_lost`)
  }
  if (user.id !== state) {
    console.error("[fb-callback] state mismatch. user:", user.id, "state:", state)
    return NextResponse.redirect(`${appUrl}/integrations?error=state_mismatch`)
  }

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.redirect(`${appUrl}/integrations?error=no_company`)
  }

  const redirectUri = `${appUrl}/api/auth/facebook/callback`
  const appId = process.env.FACEBOOK_APP_ID!
  const appSecret = process.env.FACEBOOK_APP_SECRET!

  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
  )
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/integrations?error=token_failed`)
  }

  // Exchange for long-lived user token (60 days)
  const llRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
  )
  const llData = await llRes.json()
  const userToken = llData.access_token || tokenData.access_token

  // Collect pages from EVERY source and merge — a client's page reaches us
  // three different ways depending on how it's shared, and checking only one
  // is why an agency-onboarded page came back empty:
  //   1. /me/accounts       — pages the person directly has a role on
  //   2. {biz}/owned_pages   — pages the Business Manager OWNS
  //   3. {biz}/client_pages  — pages PARTNER-SHARED into the BM by a client
  //                            (the runbook's "share your page with our BM"
  //                            step lands a page HERE, not in owned_pages)
  type FbPage = { id: string; name: string; access_token: string; fan_count?: number }
  const collected: FbPage[] = []

  const meRes = await fetch(
    `https://graph.facebook.com/me/accounts?access_token=${userToken}&fields=id,name,access_token,fan_count&limit=100`
  ).then((r) => r.json()).catch(() => ({}))
  collected.push(...((meRes.data as FbPage[]) ?? []))

  try {
    const bizRes = await fetch(
      `https://graph.facebook.com/me/businesses?access_token=${userToken}&fields=id,name&limit=25`
    ).then((r) => r.json())
    const businesses: Array<{ id: string }> = bizRes.data ?? []

    const perBiz = await Promise.all(
      businesses.flatMap((biz) =>
        ["owned_pages", "client_pages"].map((edge) =>
          fetch(
            `https://graph.facebook.com/${biz.id}/${edge}?access_token=${userToken}&fields=id,name,access_token,fan_count&limit=100`
          ).then((r) => r.json()).then((d) => (d.data as FbPage[]) ?? []).catch(() => [])
        )
      )
    )
    for (const list of perBiz) collected.push(...list)
  } catch {
    // ignore — the me/accounts result may still have pages
  }

  // Dedupe by page id (a page can appear in more than one source)
  const allPages: FbPage[] = Object.values(
    Object.fromEntries(collected.filter((p) => p?.id).map((p) => [p.id, p]))
  )

  if (!allPages.length) {
    return NextResponse.redirect(`${appUrl}/integrations?error=no_pages`)
  }

  // Backfill page access tokens: client_pages sometimes returns a page with no
  // token, and a page token is what we actually message and subscribe with.
  await Promise.all(
    allPages.map(async (p) => {
      if (p.access_token) return
      try {
        const t = await fetch(
          `https://graph.facebook.com/${p.id}?fields=access_token&access_token=${userToken}`
        ).then((r) => r.json())
        if (t?.access_token) p.access_token = t.access_token
      } catch { /* leave tokenless — surfaced in setup, still selectable */ }
    })
  )

  // Store pages + user token in integrations table, mark setup as incomplete
  const serviceSupabase = createServiceRoleClient()
  const { error: upsertError } = await serviceSupabase
    .from("integrations")
    .upsert(
      {
        company_id: profile.company_id,
        type: "facebook",
        fb_user_id: user.id,
        fb_user_access_token: userToken,
        fb_pages_cache: allPages,
        // Clear old page selection so setup wizard runs fresh
        fb_page_id: null,
        fb_page_name: null,
        fb_access_token: null,
        fb_selected_form_ids: [],
        setup_complete: false,
        is_active: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,type" }
    )

  if (upsertError) {
    console.error("Failed to save Facebook integration:", upsertError)
    return NextResponse.redirect(`${appUrl}/integrations?error=save_failed`)
  }

  // Redirect to setup wizard to pick page + lead form
  return NextResponse.redirect(`${appUrl}/integrations/facebook-setup`)
}
