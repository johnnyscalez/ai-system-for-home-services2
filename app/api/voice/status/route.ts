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

  // If no-answer or busy on outbound — expedite the next pending SMS step.
  // Do NOT insert a new step 1 (voice) — that creates an infinite call loop.
  if ((callStatus === "no-answer" || callStatus === "busy") && session.direction === "outbound") {
    try {
      const { data: pending } = await db
        .from("sequences")
        .select("id, step")
        .eq("lead_id", session.lead_id)
        .eq("sequence_type", "no_reply")
        .eq("status", "pending")
        .order("step", { ascending: true })
      // Voice steps are 1 and 4 — skip those
      const next = pending?.find((s) => s.step !== 1 && s.step !== 4)
      if (next) {
        await db.from("sequences")
          .update({ scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
          .eq("id", next.id)
      }
    } catch { /* non-blocking */ }
  }

  // Log call duration on lead metadata
  if (duration) {
    await db.from("leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", session.lead_id)
  }

  return NextResponse.json({ ok: true })
}
