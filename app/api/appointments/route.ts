import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendConfirmations } from "@/lib/appointment-reminders"

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json()
  const {
    lead_id,
    scheduled_at,
    technician_id,
    technician_name,
    address,
    notes,
    send_confirmation = true,
  } = body as {
    lead_id: string
    scheduled_at: string
    technician_id?: string | null
    technician_name?: string | null
    address?: string | null
    notes?: string | null
    send_confirmation?: boolean
  }

  if (!lead_id || !scheduled_at) {
    return NextResponse.json({ error: "lead_id and scheduled_at are required" }, { status: 400 })
  }

  // Verify lead belongs to company
  const { data: lead } = await supabase
    .from("leads").select("id, status").eq("id", lead_id).eq("company_id", profile.company_id).single()
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  // If technician_id provided, verify it belongs to company
  if (technician_id) {
    const { data: tech } = await supabase
      .from("technicians").select("id").eq("id", technician_id).eq("company_id", profile.company_id).single()
    if (!tech) return NextResponse.json({ error: "Technician not found" }, { status: 404 })
  }

  const db = createServiceRoleClient()

  // Create the appointment
  const { data: appointment, error } = await db
    .from("appointments")
    .insert({
      company_id: profile.company_id,
      lead_id,
      scheduled_at,
      technician_id: technician_id ?? null,
      technician_name: technician_name ?? null,
      address: address ?? null,
      notes: notes ?? null,
      status: "scheduled",
      confirmation_status: "pending_confirmation",
    })
    .select("id, lead_id, scheduled_at, address, notes, status, confirmation_status, technician_id, technician_name")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update lead status to appointment_booked
  await db
    .from("leads")
    .update({ status: "appointment_booked", updated_at: new Date().toISOString() })
    .eq("id", lead_id)

  // Send confirmation SMS + email (async — don't block the response)
  if (send_confirmation) {
    sendConfirmations(appointment.id).catch(err =>
      console.error("[appointments/create] sendConfirmations failed:", err)
    )
  }

  return NextResponse.json({ appointment }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const q      = searchParams.get("q")?.trim() ?? ""
  const status = searchParams.get("status") ?? "all"
  const from   = searchParams.get("from")
  const to     = searchParams.get("to")
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200)

  let query = supabase
    .from("appointments")
    .select("id, lead_id, scheduled_at, address, notes, status, confirmation_status, technician_id, technician_name, leads(id, first_name, last_name, phone, email), technicians(name, phone)")
    .eq("company_id", profile.company_id)
    .order("scheduled_at", { ascending: false })
    .limit(limit)

  if (status !== "all") query = query.eq("status", status)
  if (from) query = query.gte("scheduled_at", from)
  if (to)   query = query.lte("scheduled_at", `${to}T23:59:59`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Client-side text filter (Supabase doesn't support cross-join text search without FTS)
  let results = data ?? []
  if (q) {
    const lower = q.toLowerCase()
    results = results.filter(apt => {
      const lead = apt.leads as unknown as { first_name: string | null; last_name: string | null; phone: string; email: string | null } | null
      const tech = apt.technicians as unknown as { name: string } | null
      return (
        (lead?.first_name ?? "").toLowerCase().includes(lower) ||
        (lead?.last_name ?? "").toLowerCase().includes(lower) ||
        `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.toLowerCase().includes(lower) ||
        (lead?.phone ?? "").replace(/\D/g, "").includes(lower.replace(/\D/g, "")) ||
        (lead?.email ?? "").toLowerCase().includes(lower) ||
        (apt.notes ?? "").toLowerCase().includes(lower) ||
        (apt.address ?? "").toLowerCase().includes(lower) ||
        (tech?.name ?? "").toLowerCase().includes(lower) ||
        (apt.technician_name ?? "").toLowerCase().includes(lower)
      )
    })
  }

  return NextResponse.json({ appointments: results })
}
