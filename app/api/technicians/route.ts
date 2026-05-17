import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

// GET  /api/technicians  — list all technicians for the authenticated company
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const { data, error } = await supabase
    .from("technicians")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/technicians  — create a new technician
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json()
  const { name, phone, specializations, zip_codes, schedule, status, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from("technicians")
    .insert({
      company_id:      profile.company_id,
      name:            name.trim(),
      phone:           phone?.trim() || null,
      specializations: specializations ?? [],
      zip_codes:       (zip_codes ?? []).map((z: string) => z.trim()).filter(Boolean),
      schedule:        schedule ?? undefined,
      status:          status ?? "active",
      notes:           notes?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
