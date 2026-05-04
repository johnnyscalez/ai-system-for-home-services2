import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { formatPhone } from "@/lib/twilio"
import { getOrCreateSession, appendMessages } from "@/lib/voice-session"

export const runtime = "nodejs"

function twiml(xml: string) {
  return new NextResponse(xml, { status: 200, headers: { "Content-Type": "text/xml" } })
}

function speakUrl(text: string, appUrl: string): string {
  return `${appUrl}/api/voice/speak?t=${encodeURIComponent(text)}`
}

function gatherTwiML(text: string, appUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${speakUrl(text, appUrl)}</Play>
  <Gather input="speech" action="${appUrl}/api/voice/turn" method="POST"
    speechTimeout="auto" speechModel="phone_call" enhanced="true" timeout="10" language="en-US">
  </Gather>
  <Play>${speakUrl("Sorry, I didn't catch that — are you still there?", appUrl)}</Play>
  <Gather input="speech" action="${appUrl}/api/voice/turn" method="POST"
    speechTimeout="auto" speechModel="phone_call" enhanced="true" timeout="8" language="en-US">
  </Gather>
  <Hangup/>
</Response>`
}

function errorTwiML(appUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${speakUrl("Thanks for calling. Our team will be in touch shortly.", appUrl)}</Play>
  <Hangup/>
</Response>`
}

export async function POST(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  console.log("[voice/inbound] POST received", req.url)

  const body = await req.formData().catch((e) => { console.error("[voice/inbound] formData parse failed:", e); return null })
  if (!body) return twiml(errorTwiML(appUrl))

  const callSid = body.get("CallSid")?.toString()
  const fromRaw = body.get("From")?.toString() ?? ""
  const toRaw   = body.get("To")?.toString() ?? ""

  console.log("[voice/inbound] callSid:", callSid, "from:", fromRaw, "to:", toRaw)

  if (!callSid) return twiml(errorTwiML(appUrl))

  const url              = new URL(req.url)
  const leadIdParam      = url.searchParams.get("leadId")
  const companyIdParam   = url.searchParams.get("companyId")
  const direction        = (url.searchParams.get("direction") ?? "inbound") as "inbound" | "outbound"
  const callbackReason   = url.searchParams.get("callbackReason") ?? undefined
  const isFollowUp       = url.searchParams.get("isFollowUp") === "true"

  const db = createServiceRoleClient()

  let leadId: string
  let companyId: string
  let leadFirstName: string | null = null
  let leadServiceType: string | null = null

  if (leadIdParam && companyIdParam) {
    leadId    = leadIdParam
    companyId = companyIdParam

    const { data: lead } = await db
      .from("leads")
      .select("first_name, service_type, ai_paused")
      .eq("id", leadId)
      .single()

    if (lead?.ai_paused) return twiml(errorTwiML(appUrl))
    leadFirstName   = lead?.first_name   ?? null
    leadServiceType = lead?.service_type ?? null
  } else {
    const { data: phoneRecord } = await db
      .from("phone_numbers")
      .select("company_id")
      .eq("phone_number", toRaw)
      .eq("is_active", true)
      .maybeSingle()

    if (!phoneRecord?.company_id) {
      console.error("[voice/inbound] No phone_numbers row found for:", toRaw)
      return twiml(errorTwiML(appUrl))
    }
    companyId = phoneRecord.company_id

    const normalizedFrom = formatPhone(fromRaw)

    let { data: lead } = await db
      .from("leads")
      .select("id, status, ai_paused, first_name, service_type")
      .eq("company_id", companyId)
      .eq("phone", normalizedFrom)
      .maybeSingle()

    if (!lead) {
      const { data: newLead } = await db
        .from("leads")
        .insert({ company_id: companyId, phone: normalizedFrom, source: "voice_inbound", status: "new" })
        .select("id, status, ai_paused, first_name, service_type")
        .single()
      lead = newLead
    }

    if (!lead) return twiml(errorTwiML(appUrl))
    if (lead.ai_paused) return twiml(errorTwiML(appUrl))

    leadId          = lead.id
    leadFirstName   = lead.first_name   ?? null
    leadServiceType = lead.service_type ?? null
  }

  try {
    const [sessionResult, agentResult] = await Promise.all([
      getOrCreateSession(callSid, leadId, companyId, direction, {
        ...(callbackReason ? { callback_reason: callbackReason } : {}),
        ...(isFollowUp ? { is_follow_up: "true" } : {}),
      }),
      db.from("ai_agent_config").select("agent_name").eq("company_id", companyId).single(),
    ])

    const session   = sessionResult
    const agentName = agentResult.data?.agent_name ?? "Linda"

    // Mark new leads as contacted
    await db.from("leads")
      .update({ status: "contacted", last_message_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("status", "new")

    // Build greeting from template — no Claude call here keeps response well under Twilio's 15s limit.
    // Claude is invoked on the first real speech turn at /api/voice/turn instead.
    let greetingText: string
    if (direction === "outbound") {
      const nameHi    = leadFirstName ? `, ${leadFirstName}` : ""
      const serviceOf = leadServiceType ? ` about your ${leadServiceType} inquiry` : ""
      if (callbackReason) {
        greetingText = `Hey${nameHi}, this is ${agentName}! Calling you back${serviceOf} — is now a good time?`
      } else {
        greetingText = `Hey${nameHi}, this is ${agentName} following up${serviceOf}. Did I catch you at an okay time?`
      }
    } else {
      greetingText = `Thanks for calling! This is ${agentName} — how can I help you today?`
    }

    // Seed session history so Claude has full context when /voice/turn is called
    await appendMessages(session, [
      { role: "user",      content: direction === "outbound" ? "(outbound call connected)" : "(inbound call connected)" },
      { role: "assistant", content: greetingText },
    ])

    return twiml(gatherTwiML(greetingText, appUrl))
  } catch (err) {
    console.error("Voice inbound error:", err)
    return twiml(errorTwiML(appUrl))
  }
}
