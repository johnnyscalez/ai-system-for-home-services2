import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

// Registers the company's Twilio number as a WhatsApp sender via Twilio's
// Senders API (v2). Prerequisites that Twilio/Meta enforce (not us):
//   - The Twilio account has WhatsApp enabled (Messaging → Senders → WhatsApp)
//   - A Meta Business Manager is linked (Twilio walks through this once per account)
// The sender then goes through Meta display-name review (minutes to ~1 day).
// We surface the live status on the integrations card and poll via /status.

const SENDERS_URL = "https://messaging.twilio.com/v2/Channels/Senders"

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const displayName = String(body.display_name ?? "").trim()
  if (!displayName || displayName.length < 3) {
    return NextResponse.json({ error: "Display name is required (min 3 characters) — this is the business name customers see on WhatsApp" }, { status: 400 })
  }

  const db = createServiceRoleClient()

  // The sender is the company's existing Twilio number
  const { data: phoneRecord } = await db
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", profile.company_id)
    .eq("is_active", true)
    .single()
  if (!phoneRecord?.phone_number) {
    return NextResponse.json({ error: "No active phone number found for your company — provision a number first" }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")

  const res = await fetch(SENDERS_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_id: `whatsapp:${phoneRecord.phone_number}`,
      profile: { name: displayName },
      webhook: {
        callback_url: `${appUrl}/api/webhooks/sms`,
        callback_method: "POST",
      },
    }),
  })

  const result = await res.json().catch(() => ({}))

  if (!res.ok) {
    const detail: string = result?.message ?? `Twilio error ${res.status}`
    // Most common failure: WhatsApp isn't enabled on the Twilio account yet
    const actionable = /whatsapp|channel|not.*(enabled|found|allowed)/i.test(detail)
      ? `${detail} — WhatsApp must be enabled once on the Twilio account (Twilio Console → Messaging → Senders → WhatsApp senders) and linked to a Meta Business Manager. After that, connecting from here works.`
      : detail

    await db.from("whatsapp_connections").upsert({
      company_id: profile.company_id,
      phone_number: phoneRecord.phone_number,
      display_name: displayName,
      status: "action_required",
      status_detail: actionable,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" })

    return NextResponse.json({ error: actionable }, { status: 422 })
  }

  await db.from("whatsapp_connections").upsert({
    company_id: profile.company_id,
    phone_number: phoneRecord.phone_number,
    display_name: displayName,
    twilio_sender_sid: result.sid ?? null,
    status: mapTwilioStatus(result.status),
    status_detail: result.status ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" })

  return NextResponse.json({ success: true, status: mapTwilioStatus(result.status) })
}

function mapTwilioStatus(s: string | undefined): string {
  const v = (s ?? "").toUpperCase()
  if (v === "ONLINE") return "online"
  if (/CREATING|PENDING|IN_REVIEW|VERIFYING/.test(v)) return "pending"
  if (/OFFLINE|PAUSED|DISABLED|FAILED|REJECTED/.test(v)) return "failed"
  return "pending"
}
