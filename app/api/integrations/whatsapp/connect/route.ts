import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { formatPhone } from "@/lib/twilio"

// Registers a WhatsApp sender via Twilio's Senders API (v2).
// Two modes:
//   - fieldbuilt: the company's existing Twilio number becomes the WhatsApp line
//     (instant, zero disruption — recommended default)
//   - byon: the contractor's own number. Meta verifies ownership with an OTP
//     sent to that number (SMS); the user enters the code on the card
//     (/api/integrations/whatsapp/verify). WARNING surfaced in UI: a number
//     currently on the WhatsApp Business phone app stops working there.
//
// One-time account prerequisite (Twilio Console → Messaging → Senders →
// WhatsApp senders → Meta embedded signup) — errors below surface this.

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
  const senderType = body.sender_type === "byon" ? "byon" : "fieldbuilt"
  const ownNumberRaw = String(body.own_number ?? "").trim()

  if (!displayName || displayName.length < 3) {
    return NextResponse.json({ error: "Display name is required (min 3 characters) — this is the business name customers see on WhatsApp" }, { status: 400 })
  }

  const db = createServiceRoleClient()

  let senderNumber: string
  if (senderType === "byon") {
    if (!ownNumberRaw) return NextResponse.json({ error: "Enter the WhatsApp Business number you want to connect" }, { status: 400 })
    senderNumber = formatPhone(ownNumberRaw)
    if (!/^\+\d{8,15}$/.test(senderNumber)) {
      return NextResponse.json({ error: "That doesn't look like a valid phone number — use full format like +1 555 123 4567" }, { status: 400 })
    }
  } else {
    const { data: phoneRecord } = await db
      .from("phone_numbers")
      .select("phone_number")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .single()
    if (!phoneRecord?.phone_number) {
      return NextResponse.json({ error: "No active phone number found for your company — provision a number first" }, { status: 400 })
    }
    senderNumber = phoneRecord.phone_number
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")

  const res = await fetch(SENDERS_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_id: `whatsapp:${senderNumber}`,
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
    const actionable = /whatsapp|channel|not.*(enabled|found|allowed)|waba|business/i.test(detail)
      ? `${detail} — WhatsApp must be enabled once on the Twilio account (Twilio Console → Messaging → Senders → WhatsApp senders → sign in with Facebook to link the Meta Business Manager). After that one-time step, connecting from here works.`
      : detail

    await db.from("whatsapp_connections").upsert({
      company_id: profile.company_id,
      phone_number: senderNumber,
      display_name: displayName,
      sender_type: senderType,
      status: "action_required",
      status_detail: actionable,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" })

    return NextResponse.json({ error: actionable }, { status: 422 })
  }

  // BYON numbers come back needing OTP verification; Twilio numbers usually go
  // straight to CREATING/ONLINE.
  const twStatus = String(result.status ?? "").toUpperCase()
  const needsOtp = senderType === "byon" || /VERIF/.test(twStatus)

  await db.from("whatsapp_connections").upsert({
    company_id: profile.company_id,
    phone_number: senderNumber,
    display_name: displayName,
    sender_type: senderType,
    twilio_sender_sid: result.sid ?? null,
    status: needsOtp ? "verify_otp" : mapTwilioStatus(twStatus),
    status_detail: result.status ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" })

  return NextResponse.json({ success: true, status: needsOtp ? "verify_otp" : mapTwilioStatus(twStatus) })
}

function mapTwilioStatus(v: string): string {
  if (v === "ONLINE") return "online"
  if (/CREATING|PENDING|IN_REVIEW/.test(v)) return "pending"
  if (/OFFLINE|PAUSED|DISABLED|FAILED|REJECTED/.test(v)) return "failed"
  return "pending"
}
