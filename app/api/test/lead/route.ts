import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS } from "@/lib/twilio"

// Sends a test lead through the full AI flow so contractors can verify their setup.
// Uses a fake phone number — no real SMS is sent to a real person.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const companyId = profile.company_id
  const service = createServiceRoleClient()

  const { data: phoneRecord } = await service
    .from("phone_numbers").select("phone_number").eq("company_id", companyId).eq("is_active", true).single()
  if (!phoneRecord?.phone_number) {
    return NextResponse.json({ error: "No phone number provisioned yet" }, { status: 400 })
  }

  const { data: company } = await service
    .from("companies").select("service_type").eq("id", companyId).single()

  // Delete any previous test lead so the flow always starts fresh
  await service.from("leads").delete().eq("company_id", companyId).eq("phone", "+15550000001")

  const { data: lead } = await service
    .from("leads")
    .insert({
      company_id: companyId,
      phone: "+15550000001",
      first_name: "Test",
      last_name: "Lead",
      email: "test@example.com",
      source: "webhook",
      service_type: company?.service_type ?? null,
      status: "new",
      metadata: { is_test: true },
    })
    .select("id")
    .single()

  if (!lead) return NextResponse.json({ error: "Failed to create test lead" }, { status: 500 })

  try {
    // Run the AI engine — generates the opening message without sending real SMS
    const result = await processAndSave(lead.id, companyId, null)

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      aiMessage: result.response,
      action: result.action ?? null,
    })
  } catch (err) {
    console.error("Test lead AI error:", err)
    return NextResponse.json({ error: "AI engine error — check your config" }, { status: 500 })
  }
}
