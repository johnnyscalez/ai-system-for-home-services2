import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const { data } = await supabase
    .from("ai_agent_config")
    .select("available_days, appointment_windows, booking_horizon_days, max_appointments_per_day, timezone, working_hours_start, working_hours_end")
    .eq("company_id", profile.company_id)
    .single()

  return NextResponse.json(data ?? {})
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const body = await req.json()
  const { available_days, appointment_windows, booking_horizon_days, max_appointments_per_day, timezone } = body

  await supabase
    .from("ai_agent_config")
    .update({
      available_days,
      appointment_windows,
      booking_horizon_days,
      max_appointments_per_day: max_appointments_per_day ?? null,
      timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", profile.company_id)

  return NextResponse.json({ success: true })
}
