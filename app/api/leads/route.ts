import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { parseLeadPhone } from "@/lib/twilio"
import { JOB_TYPES, JOB_TYPE_LABELS, type JobType } from "@/lib/job-types"

// Manual lead creation from the CRM. Never triggers an AI message: the lead is
// just a record the team can work, so no sequences or SMS are started here.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const name = str(body.name)
  const rawPhone = str(body.phone)
  const email = str(body.email)
  const address = str(body.address)
  const notes = str(body.notes)
  const rawJobType = str(body.jobType)

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!rawPhone && !email) {
    return NextResponse.json({ error: "Add a phone number or an email" }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email does not look right" }, { status: 400 })
  }

  let phone: string
  if (rawPhone) {
    const parsed = parseLeadPhone(rawPhone)
    if (!parsed) return NextResponse.json({ error: "That phone number does not look right" }, { status: 400 })
    phone = parsed
  } else {
    // Email-only lead: leads.phone is required, so store a non-dialable
    // placeholder (isPlaceholderPhone() blocks any send to it).
    phone = `manual:${randomUUID()}`
  }

  // Accept either the enum value or its label
  let jobType: string | null = null
  if (rawJobType) {
    const byEnum = (JOB_TYPES as readonly string[]).includes(rawJobType) ? rawJobType : null
    const byLabel = (JOB_TYPES as readonly JobType[]).find((t) => JOB_TYPE_LABELS[t] === rawJobType) ?? null
    jobType = byEnum ?? byLabel
  }

  if (!phone.startsWith("manual:")) {
    const { data: existing } = await supabase
      .from("leads").select("id").eq("company_id", profile.company_id).eq("phone", phone)
      .is("deleted_at", null).limit(1).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "A lead with this phone number already exists", leadId: existing.id }, { status: 409 })
    }
  }

  const { data: company } = await supabase
    .from("companies").select("service_type").eq("id", profile.company_id).maybeSingle()

  const [first, ...rest] = name.split(/\s+/)
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      company_id: profile.company_id,
      first_name: first,
      last_name: rest.join(" ") || null,
      phone,
      email: email || null,
      address: address || null,
      job_type: jobType,
      notes: notes || null,
      source: "manual",
      status: "just_came_in",
      service_type: (company?.service_type as string | null) ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead }, { status: 201 })
}
