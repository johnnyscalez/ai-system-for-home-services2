import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getTwilioClient } from "@/lib/twilio"

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { state } = await req.json()
  if (!state) return NextResponse.json({ error: "State required" }, { status: 400 })

  const client = getTwilioClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const smsWebhookUrl = `${appUrl}/api/webhooks/sms`

  try {
    // Search for local numbers in the contractor's state
    let availableNumbers = await client
      .availablePhoneNumbers("US")
      .local.list({ inRegion: state, smsEnabled: true, limit: 5 })

    // If nothing available in that state, fall back to any US number
    if (!availableNumbers.length) {
      availableNumbers = await client
        .availablePhoneNumbers("US")
        .local.list({ smsEnabled: true, limit: 5 })
    }

    if (!availableNumbers.length) {
      return NextResponse.json(
        { error: "No available numbers found. Please try again or contact support." },
        { status: 422 }
      )
    }

    // Purchase the first available number and configure SMS + voice webhooks
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: availableNumbers[0].phoneNumber,
      smsUrl: smsWebhookUrl,
      smsMethod: "POST",
      voiceUrl: `${appUrl}/api/voice/inbound`,
      voiceMethod: "POST",
      statusCallback: `${appUrl}/api/voice/status`,
      statusCallbackMethod: "POST",
      friendlyName: `LeadReply — ${user.id.slice(0, 8)}`,
    })

    return NextResponse.json({
      phoneNumber: purchased.phoneNumber,
      twilioSid: purchased.sid,
    })
  } catch (err: unknown) {
    console.error("Twilio provisioning error:", err)
    const message = err instanceof Error ? err.message : "Failed to provision number"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
