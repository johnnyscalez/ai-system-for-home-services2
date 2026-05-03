import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getGmailAuthUrl } from "@/lib/gmail"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", req.url))

  // Pass return destination in state so callback knows where to send the user
  const returnTo = new URL(req.url).searchParams.get("return_to") ?? "settings"
  const state = `${user.id}:${returnTo}`

  const url = getGmailAuthUrl(state)
  return NextResponse.redirect(url)
}
