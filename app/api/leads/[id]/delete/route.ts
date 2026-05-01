import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  // Verify lead belongs to this company before deleting
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .single()

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  // Delete cascade: conversations, appointments, sequences, then the lead
  const service = createServiceRoleClient()
  await Promise.all([
    service.from("conversations").delete().eq("lead_id", id),
    service.from("appointments").delete().eq("lead_id", id),
    service.from("sequences").delete().eq("lead_id", id),
  ])
  await service.from("leads").delete().eq("id", id)

  return NextResponse.json({ success: true })
}
