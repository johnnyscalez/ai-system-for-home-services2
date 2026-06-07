import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

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
  const { refund_amount, refund_note } = body as {
    refund_amount: number
    refund_note?: string
  }

  if (typeof refund_amount !== "number" || refund_amount < 0) {
    return NextResponse.json({ error: "refund_amount must be a non-negative number" }, { status: 400 })
  }

  // Verify lead belongs to company and is closed
  const { data: lead } = await supabase
    .from("leads")
    .select("id, status, deal_value")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .single()

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const closedStatuses = ["closed", "closed_won"]
  if (!closedStatuses.includes(lead.status)) {
    return NextResponse.json({ error: "Refunds can only be applied to closed leads" }, { status: 400 })
  }

  const dealValue = Number(lead.deal_value) || 0
  if (refund_amount > dealValue) {
    return NextResponse.json({
      error: `Refund amount ($${refund_amount}) cannot exceed deal value ($${dealValue})`,
    }, { status: 400 })
  }

  const service = createServiceRoleClient()
  const { data: updated, error } = await service
    .from("leads")
    .update({
      refund_amount,
      refund_note: refund_note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, deal_value, refund_amount, refund_note, status")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: updated })
}
