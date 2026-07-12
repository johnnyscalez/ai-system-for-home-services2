import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", req.url))

  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) return NextResponse.json({ error: "Facebook app not configured" }, { status: 500 })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`
  // Keep this list in exact sync with the permissions approved in Meta App
  // Review — requesting an unapproved scope in Live mode fails the OAuth dialog.
  const scope = [
    "leads_retrieval",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_manage_ads",
    "pages_messaging",
    "business_management",
  ].join(",")

  const fbUrl = new URL("https://www.facebook.com/dialog/oauth")
  fbUrl.searchParams.set("client_id", appId)
  fbUrl.searchParams.set("redirect_uri", redirectUri)
  fbUrl.searchParams.set("scope", scope)
  fbUrl.searchParams.set("state", user.id)
  fbUrl.searchParams.set("response_type", "code")

  return NextResponse.redirect(fbUrl.toString())
}
