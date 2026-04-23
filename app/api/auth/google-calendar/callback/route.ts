import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getTokensFromCode, getGoogleUserEmail } from "@/lib/google-calendar"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state") // user ID passed as state
  const error = searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?tab=integrations&error=google_denied`)
  }

  try {
    const tokens = await getTokensFromCode(code)
    const email = await getGoogleUserEmail(tokens.access_token!, tokens.refresh_token!)

    const supabase = createServiceRoleClient()

    const { data: profile } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", state)
      .single()

    if (!profile?.company_id) {
      return NextResponse.redirect(`${appUrl}/settings?tab=integrations&error=no_company`)
    }

    await supabase.from("google_calendar_connections").upsert(
      {
        company_id: profile.company_id,
        google_email: email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        is_connected: true,
      },
      { onConflict: "company_id" }
    )

    return NextResponse.redirect(`${appUrl}/settings?tab=integrations&success=google_connected`)
  } catch (err) {
    console.error("Google Calendar callback error:", err)
    return NextResponse.redirect(`${appUrl}/settings?tab=integrations&error=google_failed`)
  }
}
