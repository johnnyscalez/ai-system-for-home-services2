import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { parseCloudWebhook, getCloudConnectionByPhoneNumberId, sendCloudText } from "@/lib/whatsapp-cloud"
import { formatPhone } from "@/lib/twilio"
import { processAndSave, inferJobType } from "@/lib/ai-engine"

// Meta WhatsApp Cloud API webhook (Level 3 — customer-owned WABAs).
//
// Handles, per event kind:
//   message → lead find/create → AI engine → reply via Cloud API
//   echo    → a message sent from the business side. If WE didn't send it
//             (wamid unknown), a human replied from the WhatsApp app
//             (coexistence) → pause the AI for that lead. Human takeover.
//   status  → delivery tracking onto the conversation row
//
// GET = Meta's verification handshake (hub.challenge).

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  if (
    sp.get("hub.mode") === "subscribe" &&
    sp.get("hub.verify_token") === process.env.FACEBOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

export async function POST(req: NextRequest) {
  const raw = await req.text()

  // Verify Meta's signature when app secret is configured
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (appSecret) {
    const sig = req.headers.get("x-hub-signature-256") ?? ""
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex")
    if (sig && !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return new NextResponse("Forbidden", { status: 403 })
    }
  }

  const payload = JSON.parse(raw || "{}")
  const events = parseCloudWebhook(payload)
  const db = createServiceRoleClient()

  for (const ev of events) {
    try {
      const conn = await getCloudConnectionByPhoneNumberId(ev.phoneNumberId)
      if (!conn) continue

      if (ev.kind === "status" && ev.wamid) {
        if (ev.status === "failed") {
          await db.from("conversations")
            .update({ delivery_status: "failed" })
            .eq("twilio_sid", ev.wamid)
        }
        continue
      }

      if (ev.kind === "echo" && ev.wamid) {
        // Did we send this? Our outbound rows store the wamid in twilio_sid.
        const { data: ours } = await db
          .from("conversations")
          .select("id")
          .eq("twilio_sid", ev.wamid)
          .maybeSingle()
        if (ours) continue // our own message echoed back — ignore

        // Human replied from the WhatsApp Business app → AI backs off.
        // The echo's counterpart (the customer) isn't in the event; pause the
        // most recent active whatsapp lead for this company with a message in
        // the last 24h — best-effort heuristic, refined when Meta includes the
        // recipient in echo payloads.
        const { data: recent } = await db
          .from("leads")
          .select("id")
          .eq("company_id", conn.company_id)
          .eq("channel", "whatsapp")
          .eq("ai_paused", false)
          .gte("last_message_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("last_message_at", { ascending: false })
          .limit(1)
        if (recent?.[0]) {
          await db.from("leads").update({ ai_paused: true }).eq("id", recent[0].id)
          await db.from("conversations").insert({
            lead_id: recent[0].id,
            company_id: conn.company_id,
            direction: "outbound",
            sent_by: "human",
            body: ev.text ?? "(sent from WhatsApp Business app)",
            twilio_sid: ev.wamid,
            channel: "whatsapp",
          })
          console.log(`[meta-wa] human takeover — AI paused for lead ${recent[0].id}`)
        }
        continue
      }

      if (ev.kind === "message" && ev.from && ev.text) {
        const phone = formatPhone(ev.from)

        // Idempotency: Meta retries webhooks — skip already-processed wamids
        if (ev.wamid) {
          const { data: dupe } = await db
            .from("conversations").select("id").eq("twilio_sid", ev.wamid).maybeSingle()
          if (dupe) continue
        }

        let { data: lead } = await db
          .from("leads")
          .select("id, status, ai_paused")
          .eq("company_id", conn.company_id)
          .eq("phone", phone)
          .is("deleted_at", null)
          .maybeSingle()

        if (!lead) {
          const { data: newLead } = await db
            .from("leads")
            .insert({
              company_id: conn.company_id,
              phone,
              source: "whatsapp",
              channel: "whatsapp",
              status: "new",
              metadata: { inbound_first_message: ev.text },
              job_type: inferJobType(ev.text),
            })
            .select("id, status, ai_paused")
            .single()
          lead = newLead
        }
        if (!lead || lead.ai_paused) continue

        await db.from("leads")
          .update({ last_inbound_at: new Date().toISOString(), is_active_conversation: true, channel: "whatsapp" })
          .eq("id", lead.id)

        // Capture email/address the moment they're shared in the conversation
        const email = ev.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
        if (email) {
          await db.from("leads").update({ email: email.toLowerCase() }).eq("id", lead.id).is("email", null)
        }

        const result = await processAndSave(lead.id, conn.company_id, ev.text, ev.wamid, undefined, "whatsapp")
        if (result.response) {
          const wamid = await sendCloudText(conn, phone, result.response)
          if (wamid && result.outboundConversationId) {
            await db.from("conversations")
              .update({ twilio_sid: wamid, channel: "whatsapp" })
              .eq("id", result.outboundConversationId)
          }
        }
      }
    } catch (err) {
      console.error("[meta-wa] event failed:", err)
    }
  }

  return NextResponse.json({ ok: true })
}
