import { NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

// Polls Twilio for the live WhatsApp sender status (Meta display-name review
// happens on their side) and mirrors it onto our connection row.

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: conn } = await db
    .from("whatsapp_connections")
    .select("id, twilio_sender_sid, status, status_detail, phone_number, display_name")
    .eq("company_id", profile.company_id)
    .maybeSingle()

  if (!conn) return NextResponse.json({ connected: false })
  if (!conn.twilio_sender_sid) {
    return NextResponse.json({ connected: false, status: conn.status, detail: conn.status_detail })
  }

  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")
  const res = await fetch(`https://messaging.twilio.com/v2/Channels/Senders/${conn.twilio_sender_sid}`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  const result = await res.json().catch(() => ({}))

  if (res.ok && result.status) {
    const v = String(result.status).toUpperCase()
    const status = v === "ONLINE" ? "online" : /OFFLINE|PAUSED|DISABLED|FAILED|REJECTED/.test(v) ? "failed" : "pending"
    await db.from("whatsapp_connections")
      .update({ status, status_detail: result.status, updated_at: new Date().toISOString() })
      .eq("id", conn.id)
    return NextResponse.json({
      connected: status === "online",
      status,
      detail: result.status,
      phone_number: conn.phone_number,
      display_name: conn.display_name,
    })
  }

  return NextResponse.json({
    connected: conn.status === "online",
    status: conn.status,
    detail: conn.status_detail,
    phone_number: conn.phone_number,
    display_name: conn.display_name,
  })
}
