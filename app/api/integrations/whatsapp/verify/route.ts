import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

// OTP verification for bring-your-own-number WhatsApp senders.
// Meta texts a code to the contractor's number; they enter it on the card.

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? "").replace(/\D/g, "")
  if (code.length < 4) return NextResponse.json({ error: "Enter the verification code that was sent to your number" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: conn } = await db
    .from("whatsapp_connections")
    .select("id, twilio_sender_sid")
    .eq("company_id", profile.company_id)
    .maybeSingle()

  if (!conn?.twilio_sender_sid) {
    return NextResponse.json({ error: "No pending WhatsApp registration found — start the connection first" }, { status: 400 })
  }

  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")
  const res = await fetch(`https://messaging.twilio.com/v2/Channels/Senders/${conn.twilio_sender_sid}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ configuration: { verification_code: code } }),
  })
  const result = await res.json().catch(() => ({}))

  if (!res.ok) {
    const detail = result?.message ?? `Verification failed (Twilio ${res.status})`
    return NextResponse.json({ error: detail }, { status: 422 })
  }

  const twStatus = String(result.status ?? "").toUpperCase()
  const status = twStatus === "ONLINE" ? "online" : "pending"
  await db.from("whatsapp_connections")
    .update({ status, status_detail: result.status ?? "verified", updated_at: new Date().toISOString() })
    .eq("id", conn.id)

  return NextResponse.json({ success: true, status })
}
