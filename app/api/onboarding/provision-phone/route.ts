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
    // Check if THIS USER already has a provisioned number (handles retry/refresh scenarios).
    // Filter by friendlyName scoped to this user so we never return another company's number.
    const userTag = `LeadReply — ${user.id.slice(0, 8)}`
    const existingNumbers = await client.incomingPhoneNumbers.list({ friendlyName: userTag, limit: 1 })
    if (existingNumbers.length > 0) {
      const existing = existingNumbers[0]
      // Re-configure webhooks in case they weren't set in a previous partial attempt
      await client.incomingPhoneNumbers(existing.sid).update({
        smsUrl: smsWebhookUrl,
        smsMethod: "POST",
        voiceUrl: `${appUrl}/api/voice/inbound`,
        voiceMethod: "POST",
        statusCallback: `${appUrl}/api/voice/status`,
        statusCallbackMethod: "POST",
      })
      return NextResponse.json({
        phoneNumber: existing.phoneNumber,
        twilioSid: existing.sid,
      })
    }

    // No existing number — search for a local number in the contractor's state
    let availableNumbers = await client
      .availablePhoneNumbers("US")
      .local.list({ inRegion: state, smsEnabled: true, limit: 5 })

    // Fall back to any US number if none in that state
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

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: availableNumbers[0].phoneNumber,
      smsUrl: smsWebhookUrl,
      smsMethod: "POST",
      voiceUrl: `${appUrl}/api/voice/inbound`,
      voiceMethod: "POST",
      statusCallback: `${appUrl}/api/voice/status`,
      statusCallbackMethod: "POST",
      friendlyName: userTag,
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
