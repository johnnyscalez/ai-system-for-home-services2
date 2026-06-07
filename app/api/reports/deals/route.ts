import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const since = searchParams.get("since")
  const until = searchParams.get("until")

  let query = supabase
    .from("leads")
    .select("id, first_name, last_name, phone, deal_value, refund_amount, refund_note, closed_at, closed_job_type, closed_technician_id, closed_technician_name, status")
    .eq("company_id", profile.company_id)
    .in("status", ["closed", "closed_won"])
    .not("deal_value", "is", null)
    .order("closed_at", { ascending: false })

  if (since) query = query.gte("closed_at", since)
  if (until) query = query.lte("closed_at", `${until}T23:59:59`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deals: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json()
  const { id, dealValue, closedJobType, closedTechnicianId, closedTechnicianName } = body

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (dealValue !== undefined) update.deal_value = Number(dealValue)
  if (closedJobType !== undefined) update.closed_job_type = closedJobType || null
  if (closedTechnicianId !== undefined) {
    update.closed_technician_id = closedTechnicianId || null
    update.closed_technician_name = closedTechnicianName || null
  }

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select("id, first_name, last_name, phone, deal_value, closed_at, closed_job_type, closed_technician_id, closed_technician_name, status")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deal: data })
}
