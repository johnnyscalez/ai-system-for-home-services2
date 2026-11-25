import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { stopAllSequences } from "@/lib/sequences"

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

  const body = await req.json()
  const { deal_value, closed_job_type, closed_technician_id, closed_technician_name } = body

  if (!deal_value || isNaN(Number(deal_value))) {
    return NextResponse.json({ error: "Deal value is required" }, { status: 400 })
  }

  // Verify the lead belongs to this company
  const { data: lead } = await supabase
    .from("leads").select("id, company_id").eq("id", id).single()
  if (!lead || lead.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: updated, error } = await supabase
    .from("leads")
    .update({
      status: "closed_won",
      deal_value: Number(deal_value),
      closed_job_type: closed_job_type ?? null,
      // Optional legacy fields: the UI no longer sends them, but never wipe a
      // value an older client or integration already wrote.
      ...(closed_technician_id !== undefined ? { closed_technician_id: closed_technician_id ?? null } : {}),
      ...(closed_technician_name !== undefined ? { closed_technician_name: closed_technician_name ?? null } : {}),
      closed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Signed: every automated touch stops (booking nurture and the quote chase).
  try {
    await stopAllSequences(createServiceRoleClient(), id)
  } catch (err) {
    console.error(`[leads/${id}/close] could not stop pending sequences:`, err)
  }

  return NextResponse.json({ lead: updated })
}
