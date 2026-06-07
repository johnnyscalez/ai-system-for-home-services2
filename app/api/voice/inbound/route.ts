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
  <Gather input="speech" action="${appUrl}/api/voice/turn" method="POST"
    speechTimeout="auto" speechModel="phone_call" enhanced="true" timeout="10" language="en-US">
    <Play>${speakUrl(text, appUrl)}</Play>
  </Gather>
  <Gather input="speech" action="${appUrl}/api/voice/turn" method="POST"
    speechTimeout="auto" speechModel="phone_call" enhanced="true" timeout="8" language="en-US">
    <Play>${speakUrl("Sorry, I didn't catch that — are you still there?", appUrl)}</Play>
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
      .select("first_name, service_type, ai_voice_paused, notes, metadata, job_type")
      .eq("id", leadId)
      .single()

    if (lead?.ai_voice_paused) return twiml(errorTwiML(appUrl))
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
      .select("id, status, ai_voice_paused, first_name, service_type")
      .eq("company_id", companyId)
      .eq("phone", normalizedFrom)
      .maybeSingle()

    if (!lead) {
      const { data: newLead } = await db
        .from("leads")
        .insert({ company_id: companyId, phone: normalizedFrom, source: "voice_inbound", status: "new" })
        .select("id, status, ai_voice_paused, first_name, service_type")
        .single()
      lead = newLead
    }

    if (!lead) return twiml(errorTwiML(appUrl))
    if (lead.ai_voice_paused) return twiml(errorTwiML(appUrl))

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
    const nameHi = leadFirstName ? ` ${leadFirstName}` : ""

    if (direction === "outbound") {
      if (callbackReason) {
        // Lead texted "call me" — greet them by name and let them know you're calling back right away
        greetingText = `Hey${nameHi}! It's ${agentName} — you asked me to give you a call. What's up?`
      } else {
        // Proactive outbound — use specific context from the lead file when available
        const { data: fullLead } = await db
          .from("leads")
          .select("notes, metadata, job_type")
          .eq("id", leadId)
          .single()

        const notes    = fullLead?.notes as string | null
        const meta     = fullLead?.metadata as Record<string, unknown> | null
        const jobType  = fullLead?.job_type as string | null

        // Pull the most specific detail we have about why they reached out
        const issue    = notes?.split("\n")[0]?.trim() ||
                         (meta ? Object.values(meta).find((v) => typeof v === "string" && (v as string).length > 2) as string : null) ||
                         null

        if (issue && issue.length < 80) {
          greetingText = `Hey${nameHi}! It's ${agentName} — I saw you reached out about ${issue}. Did I catch you at an okay time?`
        } else if (jobType) {
          const readable = jobType.replace(/_/g, " ")
          greetingText = `Hey${nameHi}! It's ${agentName} — you reached out about ${readable}. Did I catch you at a good time?`
        } else if (leadServiceType) {
          greetingText = `Hey${nameHi}! It's ${agentName} — you reached out about your ${leadServiceType}. Did I catch you at an okay time?`
        } else {
          greetingText = `Hey${nameHi}! It's ${agentName} — just following up on your inquiry. Did I catch you at a good time?`
        }
      }
    } else {
      // Inbound — they called us, greet warmly by name if we have it
      if (leadFirstName) {
        greetingText = `Hey ${leadFirstName}! This is ${agentName} — what can I help you with?`
      } else {
        greetingText = `Thanks for calling! This is ${agentName} — how can I help you today?`
      }
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
