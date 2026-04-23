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
    console.error("Facebook token exchange failed:", tokenData)
    return NextResponse.redirect(`${appUrl}/integrations?error=token_failed`)
  }

  // Exchange for long-lived user token (60 days)
  const llRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
  )
  const llData = await llRes.json()
  const userToken = llData.access_token || tokenData.access_token

  // Fetch pages managed by this user
  const pagesRes = await fetch(
    `https://graph.facebook.com/me/accounts?access_token=${userToken}&fields=id,name,access_token`
  )
  const pagesData = await pagesRes.json()

  if (!pagesData.data?.length) {
    return NextResponse.redirect(`${appUrl}/integrations?error=no_pages`)
  }

  // Use first page — MVP: we can add page-selector UI later
  const page = pagesData.data[0] as { id: string; name: string; access_token: string }

  // Subscribe this page to leadgen webhook notifications
  await fetch(
    `https://graph.facebook.com/${page.id}/subscribed_apps?subscribed_fields=leadgen&access_token=${page.access_token}`,
    { method: "POST" }
  )

  // Save integration (upsert by company_id + type)
  const serviceSupabase = createServiceRoleClient()
  const { error: upsertError } = await serviceSupabase
    .from("integrations")
    .upsert(
      {
        company_id: profile.company_id,
        type: "facebook",
        fb_user_id: user.id,
        fb_page_id: page.id,
        fb_page_name: page.name,
        fb_access_token: page.access_token,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,type" }
    )

  if (upsertError) {
    console.error("Failed to save Facebook integration:", upsertError)
    return NextResponse.redirect(`${appUrl}/integrations?error=save_failed`)
  }

  return NextResponse.redirect(`${appUrl}/integrations?success=facebook`)
}
