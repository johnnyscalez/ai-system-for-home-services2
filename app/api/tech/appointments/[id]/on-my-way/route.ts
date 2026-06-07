import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendSMS } from "@/lib/twilio"

export const runtime = "nodejs"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.app_metadata?.role !== "technician") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { minutes } = await req.json()
  if (!minutes || minutes < 1) return NextResponse.json({ error: "Minutes required" }, { status: 400 })

  const db = createServiceRoleClient()

  // Get the tech's record
  const { data: tech } = await db
    .from("technicians")
    .select("id, name, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) return NextResponse.json({ error: "Tech not found" }, { status: 404 })

  // Get the appointment and verify it belongs to this tech
  const { data: apt } = await db
    .from("appointments")
    .select("id, lead_id, company_id, technician_id")
    .eq("id", id)
    .eq("technician_id", tech.id)
    .single()

  if (!apt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 })

  // Get lead details
  const { data: lead } = await db
    .from("leads")
    .select("id, first_name, phone")
    .eq("id", apt.lead_id)
    .single()

  if (!lead?.phone) return NextResponse.json({ error: "Lead phone not found" }, { status: 404 })

  // Get company's provisioned Twilio number
  const { data: phoneRecord } = await db
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", tech.company_id)
    .eq("is_active", true)
    .single()

  // Get company service type for job label
  const { data: company } = await db
    .from("companies")
    .select("service_type")
    .eq("id", tech.company_id)
    .single()

  const jobTypeLabel = serviceTypeLabel(company?.service_type ?? "")
  const techFirst    = tech.name.trim().split(" ")[0]
  const leadFirst    = lead.first_name?.trim() || "there"

  const smsBody = `Hey ${leadFirst}! Just wanted to let you know that ${techFirst}, our ${jobTypeLabel} specialist, is on his way and will be there in about ${minutes} minute${Number(minutes) === 1 ? "" : "s"}! 🚗`

  await sendSMS(lead.phone, smsBody, phoneRecord?.phone_number ?? undefined)

  // Save the on-my-way message as an outbound conversation entry
  await db.from("conversations").insert({
    lead_id:    lead.id,
    company_id: tech.company_id,
    direction:  "outbound",
    sent_by:    "human",
    body:       smsBody,
    channel:    "sms",
  })

  return NextResponse.json({ success: true, message: smsBody })
}

function serviceTypeLabel(serviceType: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC",
    roofing: "roofing",
    solar: "solar",
    windows: "window installation",
    bath_remodel: "bath remodel",
  }
  return map[serviceType] ?? "home services"
}
