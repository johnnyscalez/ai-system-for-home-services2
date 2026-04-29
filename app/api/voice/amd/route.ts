import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getSession, updateSession } from "@/lib/voice-session"
import { getTwilioClient } from "@/lib/twilio"

export const runtime = "nodejs"

// Twilio calls this webhook asynchronously when answering machine detection completes.
// AnsweredBy values: human | machine_start | machine_end_beep | machine_end_silence | machine_end_other | fax | unknown
export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const callSid    = body.get("CallSid")?.toString()
  const answeredBy = body.get("AnsweredBy")?.toString()

  if (!callSid || !answeredBy) return NextResponse.json({ ok: true })

  // Only act on machine detections
  if (!answeredBy.startsWith("machine")) return NextResponse.json({ ok: true })

  const session = await getSession(callSid)
  if (!session) return NextResponse.json({ ok: true })

  const url = new URL(req.url)
  const leadId = url.searchParams.get("leadId")

  const db = createServiceRoleClient()

  // Leave a voicemail if machine detected at end of message (machine_end_beep)
  // For machine_start we cancel immediately — no point leaving a partial voicemail
  if (answeredBy === "machine_start") {
    try {
      const twilio = getTwilioClient()
      await twilio.calls(callSid).update({ status: "completed" })
      await updateSession(callSid, { status: "completed" })

      // Schedule SMS follow-up instead
      if (leadId) {
        await db.from("sequences").insert({
          lead_id:       leadId,
          company_id:    session.company_id,
          sequence_type: "no_reply",
          step:          1,
          scheduled_at:  new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 min
          status:        "pending",
        })
      }
    } catch { /* non-blocking */ }

    return NextResponse.json({ ok: true })
  }

  // machine_end_beep — leave a brief voicemail then hang up
  // We modify the call to play a voicemail TwiML
  if (answeredBy === "machine_end_beep") {
    try {
      const { data: agentConfig } = await db
        .from("ai_agent_config")
        .select("agent_name")
        .eq("company_id", session.company_id)
        .single()

      const { data: kb } = await db
        .from("knowledge_base")
        .select("business_description")
        .eq("company_id", session.company_id)
        .single()

      const agentName = agentConfig?.agent_name ?? "Linda"
      const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

      const twilio = getTwilioClient()
      await twilio.calls(callSid).update({
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Hi, this is ${agentName} calling about your HVAC inquiry. I wanted to reach out and schedule a free on-site estimate for you. Please give us a call back or reply to our text message and we'll get you taken care of. Talk soon!</Say>
  <Hangup/>
</Response>`,
      })

      await updateSession(callSid, { status: "completed" })

      // Schedule SMS follow-up after voicemail
      if (leadId) {
        await db.from("sequences").insert({
          lead_id:       leadId,
          company_id:    session.company_id,
          sequence_type: "no_reply",
          step:          1,
          scheduled_at:  new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 min after voicemail
          status:        "pending",
        })
      }
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true })
}
