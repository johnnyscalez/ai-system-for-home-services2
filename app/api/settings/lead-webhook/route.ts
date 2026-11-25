import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { loadIntake, saveIntake } from "@/lib/intake"
import { LEAD_TARGETS, normalizeLead } from "@/lib/normalize-lead"

export const runtime = "nodejs"

async function companyFor() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return { error: NextResponse.json({ error: "No company" }, { status: 400 }) }
  return { companyId: profile.company_id as string }
}

// GET: the webhook URL, the saved field mapping, and the shape of the last payload received.
export async function GET() {
  const auth = await companyFor()
  if (auth.error) return auth.error
  const db = createServiceRoleClient()
  const [{ data: company }, intake] = await Promise.all([
    db.from("companies").select("webhook_secret").eq("id", auth.companyId).maybeSingle(),
    loadIntake(db, auth.companyId),
  ])
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "https://fieldbuiltai.com").replace(/\/$/, "")
  return NextResponse.json({
    url: `${app}/api/webhooks/lead?secret=${company?.webhook_secret ?? ""}`,
    fieldMap: intake.leadFieldMap ?? {},
    lastSample: intake.lastWebhookSample ?? null,
    targets: LEAD_TARGETS,
  })
}

// PUT { fieldMap }: save the overrides.  POST { payload }: preview how a payload would map (nothing is saved or sent).
export async function PUT(req: NextRequest) {
  const auth = await companyFor()
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({})) as { fieldMap?: Record<string, string> }
  const allowed = new Set<string>(LEAD_TARGETS.map((t) => t.value))
  const fieldMap: Record<string, string> = {}
  for (const [k, v] of Object.entries(body.fieldMap ?? {})) {
    const key = String(k).trim().slice(0, 120)
    const target = String(v ?? "").trim()
    // "" clears an override. Custom qualifying keys (q:anything) are allowed.
    if (!key || !target) continue
    if (allowed.has(target) || /^q:[a-z0-9_]{1,40}$/.test(target)) fieldMap[key] = target
  }
  const db = createServiceRoleClient()
  await saveIntake(db, auth.companyId, { leadFieldMap: fieldMap })
  return NextResponse.json({ fieldMap })
}

export async function POST(req: NextRequest) {
  const auth = await companyFor()
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({})) as { payload?: unknown; fieldMap?: Record<string, string> }
  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return NextResponse.json({ error: "Paste a JSON object, for example {\"name\":\"Sarah Lee\",\"phone\":\"2145550123\"}" }, { status: 400 })
  }
  const db = createServiceRoleClient()
  const intake = await loadIntake(db, auth.companyId)
  const lead = normalizeLead(body.payload as Record<string, unknown>, body.fieldMap ?? intake.leadFieldMap ?? {})
  return NextResponse.json({
    fields: lead.mapping,
    lead: {
      first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, email: lead.email,
      address: lead.address, zip: lead.zip, project_type: lead.job_type_raw, notes: lead.notes,
      qualification: lead.qualification, form_answers: lead.form_answers,
    },
  })
}
