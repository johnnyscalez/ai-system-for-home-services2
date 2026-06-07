import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.app_metadata?.role !== "technician") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { dealValue } = await req.json()

  const db = createServiceRoleClient()

  // Get the tech's record
  const { data: tech } = await db
    .from("technicians")
    .select("id, name, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) return NextResponse.json({ error: "Tech not found" }, { status: 404 })

  // Get appointment and verify ownership
  const { data: apt } = await db
    .from("appointments")
    .select("id, lead_id, company_id, technician_id")
    .eq("id", id)
    .eq("technician_id", tech.id)
    .single()

  if (!apt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 })

  const now = new Date().toISOString()

  // Mark appointment as completed
  await db
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", apt.id)

  // Mark lead as closed_won with deal value
  await db
    .from("leads")
    .update({
      status:                   "closed_won",
      deal_value:               dealValue ? Number(dealValue) : null,
      closed_at:                now,
      closed_technician_id:     tech.id,
      closed_technician_name:   tech.name,
    })
    .eq("id", apt.lead_id)

  // Cancel any pending follow-up sequences for this lead
  await db
    .from("sequences")
    .update({ status: "cancelled" })
    .eq("lead_id", apt.lead_id)
    .eq("status", "pending")

  return NextResponse.json({ success: true })
}
