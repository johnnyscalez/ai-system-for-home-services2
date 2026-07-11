import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getTwilioClient, formatPhone } from "@/lib/twilio"

export const runtime = "nodejs"

/**
 * POST /api/voice/verify-forwarding
 * Body: { officeNumber: string }
 *
 * Verifies the contractor's call forwarding by placing a real test call:
 * Twilio number → office number. The contractor lets it ring; forwarding
 * routes the unanswered call back to the Twilio number, /api/voice/inbound
 * detects the loop (From == To + ForwardedFrom) and marks the company verified.
 *
 * GET /api/voice/verify-forwarding — poll verification status from the UI.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { officeNumber } = await req.json() as { officeNumber?: string }
  if (!officeNumber) return NextResponse.json({ error: "officeNumber required" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: profile } = await db.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const normalized = formatPhone(officeNumber)

  const { data: phoneRecord } = await db
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", profile.company_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!phoneRecord?.phone_number) {
    return NextResponse.json({ error: "No active AI phone number for this company" }, { status: 400 })
  }
  if (normalized === phoneRecord.phone_number) {
    return NextResponse.json({ error: "Office number can't be the AI number itself" }, { status: 400 })
  }

  // Save the office number (unverified until the loop-back proves it) and reset state
  await db.from("companies")
    .update({ office_number: normalized, forwarding_verified: false, forwarding_verified_at: null })
    .eq("id", profile.company_id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const twilio = getTwilioClient()

  try {
    // If someone at the office answers by mistake, tell them to let it ring next time.
    // If nobody answers, forwarding loops the call back to /api/voice/inbound which
    // detects From == To + ForwardedFrom and marks the company verified.
    const answeredUrl = `${appUrl}/api/voice/speak?t=${encodeURIComponent(
      "This is a call forwarding test from your AI agent. Please hang up and let the next test ring without answering."
    )}`
    const call = await twilio.calls.create({
      to:   normalized,
      from: phoneRecord.phone_number,
      twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${answeredUrl}</Play><Hangup/></Response>`,
      timeout: 40, // ring long enough for a 10-30s no-answer forward to trigger
    })
    return NextResponse.json({ callSid: call.sid, status: "test_call_placed" })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to place test call"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = createServiceRoleClient()
  const { data: profile } = await db.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const { data: company } = await db.from("companies")
    .select("office_number, forwarding_verified, forwarding_verified_at")
    .eq("id", profile.company_id)
    .single()

  return NextResponse.json({
    officeNumber: company?.office_number ?? null,
    verified:     company?.forwarding_verified ?? false,
    verifiedAt:   company?.forwarding_verified_at ?? null,
  })
}
