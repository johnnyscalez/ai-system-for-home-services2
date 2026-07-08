import { NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: conn } = await db
    .from("whatsapp_connections")
    .select("id, twilio_sender_sid")
    .eq("company_id", profile.company_id)
    .maybeSingle()

  if (conn?.twilio_sender_sid) {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")
    await fetch(`https://messaging.twilio.com/v2/Channels/Senders/${conn.twilio_sender_sid}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${auth}` },
    }).catch(() => {})
  }

  if (conn) {
    await db.from("whatsapp_connections")
      .update({ status: "disconnected", twilio_sender_sid: null, updated_at: new Date().toISOString() })
      .eq("id", conn.id)
  }

  return NextResponse.json({ success: true })
}
