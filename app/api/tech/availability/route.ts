import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const

const DEFAULT_SCHEDULE = Object.fromEntries(
  DAYS.map(d => [d, { enabled: ["monday","tuesday","wednesday","thursday","friday"].includes(d), start: "08:00", end: "17:00" }])
)

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.app_metadata?.role !== "technician") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createServiceRoleClient()
  const { data: tech } = await db
    .from("technicians")
    .select("id, schedule")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const schedule = (tech.schedule && Object.keys(tech.schedule).length > 0)
    ? tech.schedule
    : DEFAULT_SCHEDULE

  return NextResponse.json({ schedule })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.app_metadata?.role !== "technician") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { schedule } = body
  if (!schedule) return NextResponse.json({ error: "Missing schedule" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: tech } = await db
    .from("technicians")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await db
    .from("technicians")
    .update({ schedule, updated_at: new Date().toISOString() })
    .eq("id", tech.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
