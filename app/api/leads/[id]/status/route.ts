import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const { status } = await req.json()
  if (!status) return NextResponse.json({ error: "Status required" }, { status: 400 })

  const { data: lead } = await supabase
    .from("leads").select("id, company_id").eq("id", id).single()
  if (!lead || lead.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: updated, error } = await supabase
    .from("leads").update({ status }).eq("id", id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: updated })
}
