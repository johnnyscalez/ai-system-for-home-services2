import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

const DEFAULT_SCHEDULE = {
  monday:    { enabled: true,  start: "07:00", end: "16:00" },
  tuesday:   { enabled: true,  start: "07:00", end: "16:00" },
  wednesday: { enabled: true,  start: "07:00", end: "16:00" },
  thursday:  { enabled: true,  start: "07:00", end: "16:00" },
  friday:    { enabled: true,  start: "07:00", end: "16:00" },
  saturday:  { enabled: false, start: "07:00", end: "16:00" },
  sunday:    { enabled: false, start: "07:00", end: "16:00" },
}

async function getCompanyId() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return { error: NextResponse.json({ error: "No company" }, { status: 400 }) }
  return { companyId: profile.company_id as string }
}

export async function GET() {
  const auth = await getCompanyId()
  if (auth.error) return auth.error
  const db = createServiceRoleClient()
  const { count, error } = await db
    .from("technicians")
    .select("id", { count: "exact", head: true })
    .eq("company_id", auth.companyId)
    .eq("status", "active")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const auth = await getCompanyId()
  if (auth.error) return auth.error
  const companyId = auth.companyId

  const body = await req.json().catch(() => ({}))
  const target = Number(body?.count)
  if (!Number.isInteger(target) || target < 1 || target > 10) {
    return NextResponse.json({ error: "Count must be a whole number from 1 to 10" }, { status: 400 })
  }

  const db = createServiceRoleClient()
  const { data: rows, error: listErr } = await db
    .from("technicians")
    .select("id, name, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const all = rows ?? []
  const active = all.filter(r => r.status === "active")

  if (active.length > target) {
    // Deactivate the newest surplus rows, never delete.
    const surplus = active.slice(target).map(r => r.id)
    const { error } = await db.from("technicians").update({ status: "inactive" }).in("id", surplus)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (active.length < target) {
    let need = target - active.length
    // Reactivate previously deactivated measure slots first, then insert new ones.
    const reusable = all.filter(r => r.status !== "active" && /^Measure slot \d+$/.test(r.name ?? "")).slice(0, need)
    if (reusable.length > 0) {
      const { error } = await db.from("technicians").update({ status: "active" }).in("id", reusable.map(r => r.id))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      need -= reusable.length
    }
    if (need > 0) {
      const used = new Set(all.map(r => r.name))
      const inserts: Record<string, unknown>[] = []
      for (let n = 1; inserts.length < need; n++) {
        const name = `Measure slot ${n}`
        if (used.has(name)) continue
        inserts.push({
          company_id: companyId,
          name,
          phone: null,
          serves_all_areas: true,
          specializations: [],
          zip_codes: [],
          schedule: DEFAULT_SCHEDULE,
          status: "active",
        })
      }
      const { error } = await db.from("technicians").insert(inserts)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { count } = await db
    .from("technicians")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "active")
  return NextResponse.json({ count: count ?? target })
}
