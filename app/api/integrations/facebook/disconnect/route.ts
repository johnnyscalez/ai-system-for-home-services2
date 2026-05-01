import { NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const serviceSupabase = createServiceRoleClient()
  await serviceSupabase
    .from("integrations")
    .delete()
    .eq("company_id", profile.company_id)
    .eq("type", "facebook")

  return NextResponse.json({ success: true })
}
