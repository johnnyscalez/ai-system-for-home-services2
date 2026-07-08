import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { subscribeAppToWaba, fetchWabaNumbers } from "@/lib/whatsapp-cloud"

// Level 3 connect: exchange the embedded-signup result for a stored connection.
//
// The client-side Meta popup (FB.login with our config_id) returns:
//   - code: OAuth code to exchange for a business token
//   - waba_id + phone_number_id: from the popup's sessionInfoListener message
//
// We: exchange code → token, subscribe our app to the WABA's webhooks,
// resolve the number's display info, and store the meta_cloud connection.

const GRAPH = "https://graph.facebook.com/v21.0"

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? "")
  const wabaId = String(body.waba_id ?? "")
  const phoneNumberId = String(body.phone_number_id ?? "")

  if (!code || !wabaId || !phoneNumberId) {
    return NextResponse.json({ error: "Missing signup data — the Meta popup must complete fully before connecting" }, { status: 400 })
  }

  // 1. Exchange the code for a business token
  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${encodeURIComponent(code)}`
  )
  const tokenJson = await tokenRes.json().catch(() => ({}))
  const accessToken: string | undefined = tokenJson?.access_token
  if (!tokenRes.ok || !accessToken) {
    return NextResponse.json({ error: tokenJson?.error?.message ?? "Token exchange with Meta failed" }, { status: 422 })
  }

  // 2. Subscribe our app to the WABA so its messages reach our webhook
  const subscribed = await subscribeAppToWaba(wabaId, accessToken)

  // 3. Resolve the connected number's display details
  let displayNumber = ""
  let verifiedName = "WhatsApp Business"
  try {
    const numbers = await fetchWabaNumbers(wabaId, accessToken)
    const match = numbers.find((n) => n.id === phoneNumberId) ?? numbers[0]
    displayNumber = match?.display_phone_number ?? ""
    verifiedName = match?.verified_name ?? verifiedName
  } catch { /* non-fatal */ }

  const db = createServiceRoleClient()
  await db.from("whatsapp_connections").upsert({
    company_id: profile.company_id,
    provider: "meta_cloud",
    sender_type: "own_waba",
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    access_token: accessToken,
    phone_number: displayNumber ? `+${displayNumber.replace(/\D/g, "")}` : "unknown",
    display_name: verifiedName,
    status: subscribed ? "online" : "action_required",
    status_detail: subscribed
      ? "Connected via embedded signup (coexistence)"
      : "Connected, but webhook subscription failed — messages may not arrive; retry from the card",
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" })

  return NextResponse.json({ success: true, phone: displayNumber, name: verifiedName, subscribed })
}
