import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.app_metadata?.role !== "technician") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createServiceRoleClient()
  const { data: tech } = await db
    .from("technicians")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const timeMin = searchParams.get("timeMin")
  const timeMax = searchParams.get("timeMax")

  let query = db
    .from("appointments")
    .select(`
      id, scheduled_at, address, notes, status,
      technician_name,
      leads(id, first_name, last_name, phone, service_type, job_type, status)
    `)
    .eq("technician_id", tech.id)
    .eq("company_id", tech.company_id)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: true })

  if (timeMin) query = query.gte("scheduled_at", timeMin)
  if (timeMax) query = query.lte("scheduled_at", timeMax)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ appointments: data ?? [] })
}
