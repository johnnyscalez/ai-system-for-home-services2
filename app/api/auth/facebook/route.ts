import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { adsReadRequestable, parseFbReturnTarget } from "@/lib/meta-ads"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", req.url))

  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) return NextResponse.json({ error: "Facebook app not configured" }, { status: 500 })

  const returnTo = parseFbReturnTarget(new URL(req.url).searchParams.get("return_to"))

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`
  // Keep this list in exact sync with the permissions the Meta app carries.
  // Requesting one it does not have fails the Facebook window for app-role users.
  //   leads_retrieval, pages_manage_ads      read Lead Ad submissions and form definitions
  //   pages_show_list, pages_read_engagement list the Pages and read their details
  //   pages_manage_metadata                  subscribe the Page to our webhook
  //   pages_messaging                        Messenger conversations
  //   business_management                    Pages and ad accounts that live in a Business
  //   ads_read                               ad accounts, spend and results (read only).
  //                                          Added automatically once the Meta app has it
  //                                          (see adsReadRequestable); until then the wizard
  //                                          offers "skip for now" on the ad account step.
  const scopes = [
    "leads_retrieval",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_manage_ads",
    "pages_messaging",
    "business_management",
  ]
  if (await adsReadRequestable()) scopes.push("ads_read")
  const scope = scopes.join(",")

  const fbUrl = new URL("https://www.facebook.com/dialog/oauth")
  fbUrl.searchParams.set("client_id", appId)
  fbUrl.searchParams.set("redirect_uri", redirectUri)
  fbUrl.searchParams.set("scope", scope)
  // state = "<user id>:<return target>". The callback checks the user id against the
  // session (CSRF) and the target against the fixed list above.
  fbUrl.searchParams.set("state", `${user.id}:${returnTo}`)
  fbUrl.searchParams.set("response_type", "code")
  // Ask again for anything declined earlier (ads_read was added after some accounts connected).
  fbUrl.searchParams.set("auth_type", "rerequest")

  return NextResponse.redirect(fbUrl.toString())
}
