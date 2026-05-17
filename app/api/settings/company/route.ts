import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const body = await req.json()
  const allowed = ["avg_job_value", "notification_phone", "service_area"]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const service = createServiceRoleClient()
  await service.from("companies").update(update).eq("id", profile.company_id)

  return NextResponse.json({ ok: true })
}
