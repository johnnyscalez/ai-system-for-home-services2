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

  // Get appointment and verify ownership — also fetch lead for job_type
  const { data: apt } = await db
    .from("appointments")
    .select("id, lead_id, company_id, technician_id, leads(job_type, service_type)")
    .eq("id", id)
    .eq("technician_id", tech.id)
    .single()

  if (!apt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 })

  const leadData = (Array.isArray(apt.leads) ? apt.leads[0] : apt.leads) as { job_type: string | null; service_type: string | null } | null
  const closedJobType = leadData?.job_type ?? leadData?.service_type ?? null
  const now = new Date().toISOString()

  // Mark the visit as completed
  await db
    .from("appointments")
    .update({ status: "completed", confirmation_status: "completed", updated_at: now })
    .eq("id", apt.id)

  const amount = Number(dealValue)
  if (Number.isFinite(amount) && amount > 0) {
    // The homeowner signed on the spot: record the deal.
    await db
      .from("leads")
      .update({
        status:                   "closed_won",
        deal_value:               amount,
        closed_at:                now,
        closed_technician_id:     tech.id,
        closed_technician_name:   tech.name,
        closed_job_type:          closedJobType,
      })
      .eq("id", apt.lead_id)

    // Signed: every pending follow-up stops.
    await db
      .from("sequences")
      .update({ status: "cancelled" })
      .eq("lead_id", apt.lead_id)
      .eq("status", "pending")

    return NextResponse.json({ success: true, leadStatus: "closed_won" })
  }

  // No amount: the visit happened and the quote is owed. Move the lead to the
  // quote stage unless a quote already went out or the deal is signed.
  const { data: lead } = await db
    .from("leads").select("status, metadata").eq("id", apt.lead_id).maybeSingle()
  if (lead && !["measure_done", "quote_sent", "closed", "closed_won"].includes(lead.status as string)) {
    const meta = { ...((lead.metadata as Record<string, unknown> | null) ?? {}), measure_done_at: now }
    await db
      .from("leads")
      .update({ status: "measure_done", metadata: meta })
      .eq("id", apt.lead_id)
    return NextResponse.json({ success: true, leadStatus: "measure_done" })
  }

  return NextResponse.json({ success: true, leadStatus: lead?.status ?? null })
}
