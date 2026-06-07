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

  // Soft delete: mark the lead deleted and cancel pending sequences.
  // Data is preserved in Supabase; RLS policy hides deleted leads from all auth-key reads.
  const service = createServiceRoleClient()
  await Promise.all([
    service.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", id),
    service.from("sequences").update({ status: "cancelled" }).eq("lead_id", id).eq("status", "pending"),
  ])

  return NextResponse.json({ success: true })
}
