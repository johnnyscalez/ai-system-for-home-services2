import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getGmailTokensFromCode, getGmailUserEmail } from "@/lib/gmail"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state") ?? ""
  const error = searchParams.get("error")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const [userId, returnTo] = state.split(":")

  if (error || !code || !userId) {
    const dest = returnTo === "onboarding"
      ? `/onboarding?gmail=error`
      : `/email?gmail=error`
    return NextResponse.redirect(`${appUrl}${dest}`)
  }

  try {
    const tokens = await getGmailTokensFromCode(code)
    const email = await getGmailUserEmail(tokens.access_token!, tokens.refresh_token!)

    const supabase = createServiceRoleClient()

    const { data: profile } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", userId)
      .single()

    if (!profile?.company_id) {
      return NextResponse.redirect(`${appUrl}/onboarding?gmail=error`)
    }

    await supabase.from("gmail_connections").upsert(
      {
        company_id: profile.company_id,
        gmail_email: email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        is_connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    )

    // After onboarding → go straight to dashboard; otherwise back to email settings
    const dest = returnTo === "onboarding"
      ? `/dashboard?gmail=connected`
      : `/email?gmail=connected`
    return NextResponse.redirect(`${appUrl}${dest}`)
  } catch (err) {
    console.error("Gmail callback error:", err)
    const dest = returnTo === "onboarding"
      ? `/onboarding?gmail=error`
      : `/email?gmail=error`
    return NextResponse.redirect(`${appUrl}${dest}`)
  }
}
