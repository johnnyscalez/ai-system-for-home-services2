import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getTwilioClient } from "@/lib/twilio"

export const runtime = "nodejs"

// POST /api/voice/outbound
// Body: { leadId: string }
// Initiates an outbound call from the company's Twilio number to the lead.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { leadId } = await req.json() as { leadId: string }
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 })

  const db      = createServiceRoleClient()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const twilio  = getTwilioClient()

  // Load lead + company + Twilio number in parallel
  const [leadRes, profileRes] = await Promise.all([
    db.from("leads").select("id, phone, company_id, ai_paused, status").eq("id", leadId).single(),
    db.from("users").select("company_id").eq("id", user.id).single(),
  ])

  const lead = leadRes.data
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (lead.company_id !== profileRes.data?.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (lead.ai_paused) return NextResponse.json({ error: "AI paused for this lead" }, { status: 400 })
  if (["closed_won", "closed_lost"].includes(lead.status)) {
    return NextResponse.json({ error: "Lead is closed" }, { status: 400 })
  }

  const { data: phoneRecord } = await db
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", lead.company_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!phoneRecord?.phone_number) {
    return NextResponse.json({ error: "No active Twilio number for this company" }, { status: 400 })
  }

  try {
    const call = await twilio.calls.create({
      to: lead.phone,
      from: phoneRecord.phone_number,
      url: `${appUrl}/api/voice/inbound?leadId=${lead.id}&companyId=${lead.company_id}&direction=outbound`,
      statusCallback: `${appUrl}/api/voice/status`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["completed", "failed", "no-answer", "busy"],
      machineDetection: "DetectMessageEnd",
      asyncAmdStatusCallback: `${appUrl}/api/voice/amd?leadId=${lead.id}`,
    })

    return NextResponse.json({ callSid: call.sid })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to initiate call"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
