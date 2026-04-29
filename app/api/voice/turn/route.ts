import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getSession, saveCallTurn } from "@/lib/voice-session"
import { runVoiceTurn } from "@/lib/voice-engine"
import { notifyAppointmentBooked, notifyNeedsAttention } from "@/lib/notifications"

export const runtime = "nodejs"

const VOICE = "Polly.Joanna-Neural"

function twiml(xml: string) {
  return new NextResponse(xml, { status: 200, headers: { "Content-Type": "text/xml" } })
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function gatherTwiML(text: string, appUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">${escapeXml(text)}</Say>
  <Gather input="speech" action="${appUrl}/api/voice/turn" method="POST"
    speechTimeout="auto" speechModel="phone_call" enhanced="true" timeout="10" language="en-US">
  </Gather>
  <Say voice="${VOICE}">Are you still there?</Say>
  <Gather input="speech" action="${appUrl}/api/voice/turn" method="POST"
    speechTimeout="auto" speechModel="phone_call" enhanced="true" timeout="8" language="en-US">
  </Gather>
  <Hangup/>
</Response>`
}

function endTwiML(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">${escapeXml(text)}</Say>
  <Hangup/>
</Response>`
}

function transferTwiML(text: string, notificationPhone: string | null): string {
  if (!notificationPhone) {
    return endTwiML("I'll have someone from our team call you back shortly. Thanks for calling!")
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">${escapeXml(text)}</Say>
  <Dial timeout="30" action="/api/voice/transfer-complete">
    <Number>${escapeXml(notificationPhone)}</Number>
  </Dial>
  <Say voice="${VOICE}">Looks like they're unavailable right now. Someone will call you back soon. Thanks!</Say>
  <Hangup/>
</Response>`
}

function retryTwiML(appUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">Sorry, I didn't quite catch that. Could you say that again?</Say>
  <Gather input="speech" action="${appUrl}/api/voice/turn" method="POST"
    speechTimeout="auto" speechModel="phone_call" enhanced="true" timeout="10" language="en-US">
  </Gather>
  <Hangup/>
</Response>`
}

export async function POST(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const body = await req.formData().catch(() => null)
  if (!body) return twiml(endTwiML("Thanks for calling. Goodbye!"))

  const callSid      = body.get("CallSid")?.toString()
  const speechResult = body.get("SpeechResult")?.toString()?.trim()
  const confidence   = parseFloat(body.get("Confidence")?.toString() ?? "1")

  if (!callSid) return twiml(endTwiML("Thanks for calling."))

  // No speech or very low confidence — ask to repeat
  if (!speechResult || confidence < 0.3) {
    return twiml(retryTwiML(appUrl))
  }

  const session = await getSession(callSid)
  if (!session || session.status !== "active") {
    return twiml(endTwiML("Thanks for calling. Have a great day!"))
  }

  try {
    const result = await runVoiceTurn(session, speechResult)

    // Save turn to conversations table for CRM visibility
    await saveCallTurn(session, speechResult, result.text)

    // Update lead last_message_at
    const db = createServiceRoleClient()
    await db.from("leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", session.lead_id)

    // Route TwiML based on action
    switch (result.action.type) {
      case "end":
        return twiml(endTwiML(result.text))

      case "book": {
        const { data: aptLead } = await db
          .from("leads")
          .select("first_name, last_name, phone")
          .eq("id", session.lead_id)
          .single()
        const { data: apt } = await db
          .from("appointments")
          .select("scheduled_at, address")
          .eq("lead_id", session.lead_id)
          .eq("status", "scheduled")
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
        if (aptLead && apt) {
          const name = `${aptLead.first_name ?? ""} ${aptLead.last_name ?? ""}`.trim() || aptLead.phone
          notifyAppointmentBooked(session.company_id, name, apt.scheduled_at, apt.address ?? "").catch(() => {})
        }
        return twiml(gatherTwiML(result.text, appUrl))
      }

      case "transfer": {
        const { data: company } = await db
          .from("companies")
          .select("notification_phone")
          .eq("id", session.company_id)
          .single()
        const { data: tLead } = await db
          .from("leads")
          .select("first_name, last_name, phone")
          .eq("id", session.lead_id)
          .single()
        if (tLead) {
          const name = `${tLead.first_name ?? ""} ${tLead.last_name ?? ""}`.trim() || tLead.phone
          notifyNeedsAttention(session.company_id, name, tLead.phone).catch(() => {})
        }
        return twiml(transferTwiML(result.text, company?.notification_phone ?? null))
      }

      default:
        return twiml(gatherTwiML(result.text, appUrl))
    }
  } catch (err) {
    console.error("Voice turn error:", err)
    return twiml(endTwiML("I'm sorry, I'm having a technical issue. Someone from our team will call you back. Thanks!"))
  }
}
