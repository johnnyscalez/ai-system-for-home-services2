import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient, createAdminClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

// PATCH /api/technicians/[id] — update a technician
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json()
  const allowed = ["name", "phone", "photo_url", "specializations", "zip_codes", "serves_all_areas", "schedule", "status", "notes"]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      if (key === "zip_codes" && Array.isArray(body[key])) {
        updates[key] = (body[key] as string[]).map((z) => z.trim()).filter(Boolean)
      } else if (key === "name" && typeof body[key] === "string") {
        updates[key] = body[key].trim()
      } else {
        updates[key] = body[key]
      }
    }
  }

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from("technicians")
    .update(updates)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE /api/technicians/[id] — delete a technician
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const db    = createServiceRoleClient()
  const admin = createAdminClient()

  // Fetch auth_user_id before deleting so we can remove the auth account too
  const { data: tech } = await db
    .from("technicians")
    .select("auth_user_id")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .single()

  // Unassign from future appointments before deleting
  await db.from("appointments")
    .update({ technician_id: null, technician_name: null })
    .eq("technician_id", id)
    .eq("company_id", profile.company_id)
    .gte("scheduled_at", new Date().toISOString())

  const { error } = await db
    .from("technicians")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delete the auth user so the email can be reused
  if (tech?.auth_user_id) {
    await admin.auth.admin.deleteUser(tech.auth_user_id)
  }

  return NextResponse.json({ ok: true })
}
