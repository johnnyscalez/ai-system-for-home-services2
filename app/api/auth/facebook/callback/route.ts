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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=auth_failed`)
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

  // Fetch ALL pages managed by this user (with their page-level access tokens)
  const pagesRes = await fetch(
    `https://graph.facebook.com/me/accounts?access_token=${userToken}&fields=id,name,access_token,fan_count`
  )
  const pagesData = await pagesRes.json()

  if (!pagesData.data?.length) {
    return NextResponse.redirect(`${appUrl}/integrations?error=no_pages`)
  }

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
        fb_pages_cache: pagesData.data,
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
