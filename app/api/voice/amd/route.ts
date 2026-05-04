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

  // Helper: find the next pending SMS step (not voice) and move it up to ~5 min from now.
  // This avoids creating a new step 1 voice entry which would cause an infinite call loop.
  async function expediteNextSmsStep(delayMs: number) {
    if (!leadId) return
    const { data: pending } = await db
      .from("sequences")
      .select("id, step")
      .eq("lead_id", leadId)
      .eq("sequence_type", "no_reply")
      .eq("status", "pending")
      .order("step", { ascending: true })
    // Voice steps are 1 and 4 — skip those, pick the first SMS step
    const next = pending?.find((s) => s.step !== 1 && s.step !== 4)
    if (next) {
      await db.from("sequences")
        .update({ scheduled_at: new Date(Date.now() + delayMs).toISOString() })
        .eq("id", next.id)
    }
  }

  // machine_start — cancel immediately, let pre-scheduled SMS steps handle follow-up
  if (answeredBy === "machine_start") {
    try {
      const twilio = getTwilioClient()
      await twilio.calls(callSid).update({ status: "completed" })
      await updateSession(callSid, { status: "completed" })
      // Move the next SMS step up to fire in 5 min instead of waiting days
      await expediteNextSmsStep(5 * 60 * 1000)
    } catch { /* non-blocking */ }
    return NextResponse.json({ ok: true })
  }

  // machine_end_beep — leave a brief voicemail, then expedite next SMS step
  if (answeredBy === "machine_end_beep") {
    try {
      const { data: agentConfig } = await db
        .from("ai_agent_config")
        .select("agent_name, timezone")
        .eq("company_id", session.company_id)
        .single()

      const { data: lead } = await db
        .from("leads")
        .select("service_type")
        .eq("id", session.lead_id)
        .single()

      const agentName   = agentConfig?.agent_name ?? "Linda"
      const serviceType = lead?.service_type ?? "home services"

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      const vmText = `Hi, this is ${agentName} calling about your ${serviceType} inquiry. I wanted to reach out and get you scheduled for a free on-site estimate. Please give us a call back or just reply to our text and we will get you taken care of. Talk soon!`
      const twilio = getTwilioClient()
      await twilio.calls(callSid).update({
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${appUrl}/api/voice/speak?t=${encodeURIComponent(vmText)}</Play>
  <Hangup/>
</Response>`,
      })

      await updateSession(callSid, { status: "completed" })
      // Expedite the next SMS step to fire shortly after the voicemail
      await expediteNextSmsStep(5 * 60 * 1000)
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true })
}
