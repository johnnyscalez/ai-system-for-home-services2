import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getTwilioClient } from "@/lib/twilio"
import { zipFromAddress, zipToPoint } from "@/lib/routing"

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { state, officeAddress } = await req.json()
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

    // Number search, closest-first. Searching by STATE alone is not good
    // enough: a Chicago contractor was handed a 217 (Springfield) number,
    // 200 miles from the people it texts. Locals answer local-looking
    // numbers, so anchor the search on the office's actual coordinates and
    // widen only if nothing is available.
    const officePoint = zipToPoint(zipFromAddress(officeAddress))

    let availableNumbers: Array<{ phoneNumber: string }> = []

    // inRegion pins the result to the contractor's own state — a pure
    // radius search around Chicago happily returns Indiana numbers.
    if (officePoint) {
      for (const distance of [25, 50, 100]) {
        availableNumbers = await client.availablePhoneNumbers("US").local.list({
          nearLatLong: `${officePoint.lat},${officePoint.lng}`,
          distance,
          inRegion: state,
          smsEnabled: true,
          voiceEnabled: true,
          limit: 5,
        })
        if (availableNumbers.length) break
      }
    }

    // Statewide, then anywhere in the US — last resorts only.
    if (!availableNumbers.length) {
      availableNumbers = await client
        .availablePhoneNumbers("US")
        .local.list({ inRegion: state, smsEnabled: true, voiceEnabled: true, limit: 5 })
    }
    if (!availableNumbers.length) {
      availableNumbers = await client
        .availablePhoneNumbers("US")
        .local.list({ smsEnabled: true, voiceEnabled: true, limit: 5 })
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
