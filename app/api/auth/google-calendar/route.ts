import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getGoogleAuthUrl } from "@/lib/google-calendar"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", req.url))

  const url = getGoogleAuthUrl(user.id)
  return NextResponse.redirect(url)
}
