import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { formatPhone } from "@/lib/twilio"
import { getOrCreateSession } from "@/lib/voice-session"
import { runVoiceTurn } from "@/lib/voice-engine"

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
  <Say voice="${VOICE}">Sorry, I didn't catch that — are you still there?</Say>
  <Gather input="speech" action="${appUrl}/api/voice/turn" method="POST"
    speechTimeout="auto" speechModel="phone_call" enhanced="true" timeout="8" language="en-US">
  </Gather>
  <Hangup/>
</Response>`
}

function errorTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">Thanks for calling. Our team will be in touch shortly.</Say>
  <Hangup/>
</Response>`
}

export async function POST(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Parse Twilio's form-encoded body
  const body = await req.formData().catch(() => null)
  if (!body) return twiml(errorTwiML())

  const callSid   = body.get("CallSid")?.toString()
  const fromRaw   = body.get("From")?.toString() ?? ""
  const toRaw     = body.get("To")?.toString() ?? ""

  if (!callSid) return twiml(errorTwiML())

  // Support outbound calls: leadId + companyId passed as query params
  const url = new URL(req.url)
  const leadIdParam      = url.searchParams.get("leadId")
  const companyIdParam   = url.searchParams.get("companyId")
  const direction        = (url.searchParams.get("direction") ?? "inbound") as "inbound" | "outbound"
  const callbackReason   = url.searchParams.get("callbackReason") ?? undefined
  const isFollowUp       = url.searchParams.get("isFollowUp") === "true"

  const db = createServiceRoleClient()

  let leadId: string
  let companyId: string

  if (leadIdParam && companyIdParam) {
    // Outbound call — ids pre-specified
    leadId    = leadIdParam
    companyId = companyIdParam
  } else {
    // Inbound call — look up company by Twilio number, lead by caller number
    const { data: phoneRecord } = await db
      .from("phone_numbers")
      .select("company_id")
      .eq("phone_number", toRaw)
      .eq("is_active", true)
      .maybeSingle()

    if (!phoneRecord?.company_id) return twiml(errorTwiML())
    companyId = phoneRecord.company_id

    const normalizedFrom = formatPhone(fromRaw)

    let { data: lead } = await db
      .from("leads")
      .select("id, status, ai_paused")
      .eq("company_id", companyId)
      .eq("phone", normalizedFrom)
      .maybeSingle()

    if (!lead) {
      const { data: newLead } = await db
        .from("leads")
        .insert({ company_id: companyId, phone: normalizedFrom, source: "voice_inbound", status: "new" })
        .select("id, status, ai_paused")
        .single()
      lead = newLead
    }

    if (!lead) return twiml(errorTwiML())
    if (lead.ai_paused) return twiml(errorTwiML())

    leadId = lead.id
  }

  try {
    const initialCollected: Record<string, string> = {
      ...(callbackReason ? { callback_reason: callbackReason } : {}),
      ...(isFollowUp ? { is_follow_up: "true" } : {}),
    }
    const session = await getOrCreateSession(callSid, leadId, companyId, direction, initialCollected)

    // Update lead status to contacted
    await db.from("leads")
      .update({ status: "contacted", last_message_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("status", "new")

    // Generate greeting with Claude
    const result = await runVoiceTurn(session, null)

    return twiml(gatherTwiML(result.text, appUrl))
  } catch (err) {
    console.error("Voice inbound error:", err)
    return twiml(errorTwiML())
  }
}
