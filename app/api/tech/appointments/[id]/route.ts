import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

// PATCH — let a technician update notes on their own appointment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  if (!tech) return NextResponse.json({ error: "Tech not found" }, { status: 404 })

  // Verify this appointment belongs to this tech
  const { data: apt } = await db
    .from("appointments")
    .select("id, status")
    .eq("id", id)
    .eq("technician_id", tech.id)
    .eq("company_id", tech.company_id)
    .single()

  if (!apt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  // Techs can update notes only — admin controls scheduling/reassignment
  if (typeof body.notes === "string") updates.notes = body.notes.trim() || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const { data, error } = await db
    .from("appointments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointment: data })
}
