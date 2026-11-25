import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { isManualStatus, isSignedStatus } from "@/lib/lead-status"
import { startQuoteChase, stopAllSequences } from "@/lib/sequences"

/**
 * Set a lead's pipeline status by hand (status control on the lead page, drag
 * on the board, the "Measure done / Quote sent / Lost" buttons).
 *
 * Only statuses in MANUAL_STATUS_OPTIONS are accepted. Side effects:
 *   quote_sent   → stores the quote amount and starts the quote chase
 *   measure_done → stamps when the measure happened, no outreach
 *   closed_won   → needs dealValue; records the deal and stops every sequence
 *   lost / unqualified → stops every sequence
 * Moving a lead back to an earlier stage changes the status and nothing else.
 */
async function setStatus(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const status = body.status
  if (!isManualStatus(status)) {
    return NextResponse.json({ error: "That status cannot be set by hand." }, { status: 400 })
  }

  const db = createServiceRoleClient()
  const { data: lead } = await db
    .from("leads")
    .select("id, company_id, status, metadata, deal_value")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (!lead || lead.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  const now = new Date().toISOString()
  const meta = { ...((lead.metadata as Record<string, unknown> | null) ?? {}) }
  const patch: Record<string, unknown> = { status }

  if (status === "quote_sent") {
    if (body.quoteAmount !== undefined && body.quoteAmount !== null && body.quoteAmount !== "") {
      const amount = Number(body.quoteAmount)
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
        return NextResponse.json({ error: "Enter the quote amount as a number above zero." }, { status: 400 })
      }
      meta.quote_amount = Math.round(amount * 100) / 100
    }
    meta.quote_sent_at = now
    if (!meta.measure_done_at) meta.measure_done_at = now
    patch.metadata = meta
  } else if (status === "measure_done") {
    meta.measure_done_at = now
    patch.metadata = meta
  } else if (status === "needs_attention") {
    // Flagged by a person: no owner text about their own click, and the
    // assistant never restarts follow-ups on it by itself (lib/attention.ts).
    meta.attention = { since: now, alerted_at: now, resumable: false, reason: "flagged by hand" }
    patch.metadata = meta
  } else if (status === "closed_won") {
    const amount = Number(body.dealValue ?? lead.deal_value)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "A signed deal needs its amount." }, { status: 400 })
    }
    patch.deal_value = amount
    if (typeof body.closedJobType === "string" && body.closedJobType.trim()) {
      patch.closed_job_type = body.closedJobType.trim().slice(0, 80)
    }
    if (!isSignedStatus(lead.status as string)) patch.closed_at = now
  }

  const { data: updated, error } = await db
    .from("leads").update(patch).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The visit is over once the measure is done (or a quote or a signature
  // exists), so the open appointment is closed too. Left "scheduled", it kept
  // sending day-before and two-hour reminders for a measure already done, and
  // kept holding the slot on the calendar.
  if (status === "measure_done" || status === "quote_sent" || status === "closed_won") {
    const { error: aptErr } = await db
      .from("appointments")
      .update({ status: "completed", confirmation_status: "completed" })
      .eq("lead_id", id)
      .eq("status", "scheduled")
    if (aptErr) console.error(`[leads/${id}/status] could not close the open appointment:`, aptErr)
  }

  // Outreach side effects run after the status is saved, and a failure in them
  // must be visible: a quote that is not being chased is the thing we promise against.
  let warning: string | null = null
  try {
    if (status === "quote_sent") {
      await startQuoteChase(db, id, lead.company_id as string)
    } else if (status === "closed_won" || status === "lost" || status === "unqualified") {
      await stopAllSequences(db, id)
    }
  } catch (err) {
    console.error(`[leads/${id}/status] sequence side effect failed for "${status}":`, err)
    warning = status === "quote_sent"
      ? "Status saved, but the quote follow-ups could not be scheduled. Set the status again to retry."
      : "Status saved, but pending follow-ups could not be stopped. Pause the assistant on this lead."
  }

  return NextResponse.json({ lead: updated, warning })
}

export const PATCH = setStatus
export const POST = setStatus
