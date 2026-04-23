import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS } from "@/lib/twilio"

// Called by Vercel Cron or an external cron service every 5 minutes.
// Secures with CRON_SECRET header to prevent unauthorized triggers.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date()

  // Find pending sequence steps that are due
  const { data: dueSteps } = await supabase
    .from("sequences")
    .select("*, leads(id, phone, status, ai_paused, first_name, last_name, service_type)")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .limit(50)

  if (!dueSteps?.length) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0

  for (const step of dueSteps) {
    const lead = step.leads as {
      id: string; phone: string; status: string; ai_paused: boolean;
      first_name: string | null; last_name: string | null; service_type: string | null;
    } | null

    if (!lead) continue

    // Skip if lead is no longer in a follow-up-eligible state
    if (
      lead.ai_paused ||
      lead.status === "appointment_booked" ||
      lead.status === "closed_won" ||
      lead.status === "closed_lost"
    ) {
      await supabase
        .from("sequences")
        .update({ status: "cancelled" })
        .eq("id", step.id)
      continue
    }

    // Get company phone number
    const { data: phoneRecord } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("company_id", step.company_id)
      .eq("is_active", true)
      .single()

    if (!phoneRecord?.phone_number) {
      await supabase
        .from("sequences")
        .update({ status: "cancelled" })
        .eq("id", step.id)
      continue
    }

    try {
      // Run AI engine — null incomingMessage means we're sending a follow-up
      // We pass a context hint as a system note instead
      const result = await processAndSave(lead.id, step.company_id, null)

      if (result.response) {
        const msg = await sendSMS(lead.phone, result.response, phoneRecord.phone_number)

        await supabase
          .from("conversations")
          .update({ twilio_sid: msg.sid })
          .eq("lead_id", lead.id)
          .eq("direction", "outbound")
          .is("twilio_sid", null)
          .order("created_at", { ascending: false })
          .limit(1)
      }

      // Mark step as sent
      await supabase
        .from("sequences")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("id", step.id)

      // Schedule next step if there is one
      const nextStep = getNextStep(step.sequence_type, step.step)
      if (nextStep) {
        const nextAt = new Date(now.getTime() + nextStep.delayMs)
        await supabase.from("sequences").insert({
          lead_id: lead.id,
          company_id: step.company_id,
          sequence_type: step.sequence_type,
          step: nextStep.step,
          scheduled_at: nextAt.toISOString(),
          status: "pending",
        })
      } else {
        // Sequence exhausted — mark lead as cold
        await supabase
          .from("leads")
          .update({ status: "cold" })
          .eq("id", lead.id)
          .in("status", ["new", "contacted", "nurturing"])
      }

      processed++
    } catch (err) {
      console.error(`Failed to process sequence step ${step.id}:`, err)
    }
  }

  return NextResponse.json({ processed })
}

type SequenceType = "no_reply" | "replied_not_booked"

const SEQUENCES: Record<SequenceType, { step: number; delayMs: number }[]> = {
  // Lead never replied after initial contact
  no_reply: [
    { step: 1, delayMs: 60 * 60 * 1000 },         // 1 hour
    { step: 2, delayMs: 24 * 60 * 60 * 1000 },      // 24 hours
    { step: 3, delayMs: 72 * 60 * 60 * 1000 },      // 72 hours
    { step: 4, delayMs: 7 * 24 * 60 * 60 * 1000 },  // 7 days
  ],
  // Lead replied but didn't book
  replied_not_booked: [
    { step: 1, delayMs: 4 * 60 * 60 * 1000 },       // 4 hours (same day)
    { step: 2, delayMs: 48 * 60 * 60 * 1000 },      // 48 hours
    { step: 3, delayMs: 5 * 24 * 60 * 60 * 1000 },  // 5 days
  ],
}

function getNextStep(
  sequenceType: string,
  currentStep: number
): { step: number; delayMs: number } | null {
  const seq = SEQUENCES[sequenceType as SequenceType]
  if (!seq) return null
  return seq.find((s) => s.step === currentStep + 1) ?? null
}
