import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getSession, updateSession } from "@/lib/voice-session"

export const runtime = "nodejs"

// Twilio calls this webhook when a call ends (completed, failed, busy, no-answer).
export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const callSid    = body.get("CallSid")?.toString()
  const callStatus = body.get("CallStatus")?.toString()
  const duration   = body.get("CallDuration")?.toString()

  if (!callSid) return NextResponse.json({ ok: true })

  const session = await getSession(callSid)
  if (!session) return NextResponse.json({ ok: true })

  const db = createServiceRoleClient()

  // Map Twilio call status to session status
  const sessionStatus =
    callStatus === "completed" ? "completed" :
    callStatus === "failed"    ? "failed" :
    callStatus === "busy"      ? "failed" :
    callStatus === "no-answer" ? "failed" :
    "completed"

  await updateSession(callSid, { status: sessionStatus })

  // If no-answer or busy on outbound — fall back to SMS
  if ((callStatus === "no-answer" || callStatus === "busy") && session.direction === "outbound") {
    try {
      // Trigger SMS follow-up for unanswered outbound call
      await db.from("sequences").insert({
        lead_id:    session.lead_id,
        company_id: session.company_id,
        sequence_type: "no_reply",
        step: 1,
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
        status: "pending",
      })
    } catch { /* non-blocking */ }
  }

  // If call failed unexpectedly — flag for attention
  if (callStatus === "failed") {
    await db.from("leads")
      .update({ status: "needs_attention" })
      .eq("id", session.lead_id)
      .in("status", ["new", "contacted"])
  }

  // Log call duration on lead metadata
  if (duration) {
    await db.from("leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", session.lead_id)
  }

  return NextResponse.json({ ok: true })
}
