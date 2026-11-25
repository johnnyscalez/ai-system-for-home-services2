import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

const ALLOWED_STATUSES = ["scheduled", "completed", "cancelled", "no_show"]
const ALLOWED_CONFIRMATION_STATUSES = [
  "pending_confirmation", "confirmed", "cancelled_by_lead",
  "reschedule_requested", "no_response", "completed",
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json()
  const {
    status,
    confirmation_status,
    scheduled_at,
    technician_id,
    technician_name,
    address,
    notes,
  } = body as {
    status?: string
    confirmation_status?: string
    scheduled_at?: string
    technician_id?: string | null
    technician_name?: string | null
    address?: string | null
    notes?: string | null
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  if (confirmation_status !== undefined && !ALLOWED_CONFIRMATION_STATUSES.includes(confirmation_status)) {
    return NextResponse.json({ error: "Invalid confirmation_status" }, { status: 400 })
  }

  const db = createServiceRoleClient()

  // The row as it stands: completion and un-completion both depend on it.
  const { data: current } = await db
    .from("appointments")
    .select("id, status, confirmation_status")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: "Measure not found" }, { status: 404 })

  // "Mark as completed" arrives as confirmation_status only. A completed measure
  // must also stop being a scheduled one (reminders, the calendar and the
  // "Completed" filter all read status), and un-completing it puts it back.
  const completing = status === "completed" || confirmation_status === "completed"
  const uncompleting =
    confirmation_status !== undefined && confirmation_status !== "completed" &&
    status === undefined && current.status === "completed"

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined)              update.status = status
  if (completing) {
    update.status = "completed"
    update.confirmation_status = "completed"
  }
  if (uncompleting)                      update.status = "scheduled"
  if (confirmation_status !== undefined && !completing) update.confirmation_status = confirmation_status
  if (address !== undefined)             update.address = address
  if (notes !== undefined)               update.notes = notes
  if (technician_id !== undefined)       update.technician_id = technician_id
  if (technician_name !== undefined)     update.technician_name = technician_name

  // If rescheduling: reset all reminder flags so the new time triggers fresh reminders
  if (scheduled_at !== undefined) {
    update.scheduled_at = scheduled_at
    update.confirmation_requested_at = null
    update.no_response_call_at = null
    update.no_response_call_scheduled = false
    update.reminder_2d_email_sent = false
    update.reminder_2d_sms_sent = false
    update.reminder_1d_email_sent = false
    update.reminder_1d_sms_sent = false
    update.reminder_2h_email_sent = false
    update.reminder_2h_sms_sent = false
    // Reset confirmation status to pending when rescheduling
    if (confirmation_status === undefined) update.confirmation_status = "pending_confirmation"
  }

  const { data, error } = await db
    .from("appointments")
    .update(update)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select("id, lead_id, scheduled_at, address, notes, status, confirmation_status, technician_id, technician_name, leads(first_name, last_name, phone), technicians(name, phone)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = new Date().toISOString()

  // A cancelled measure puts the lead back into the conversation stage, so it
  // shows on the board again and the assistant can rebook it. The appointment
  // row stays for history.
  if (status === "cancelled" && data?.lead_id) {
    await db
      .from("leads")
      .update({ status: "active_conversation", updated_at: now })
      .eq("id", data.lead_id)
      .eq("status", "appointment_booked") // only if nothing else moved the lead since
  }

  // A cancelled or no-show measure that is put back on the calendar is a booked
  // measure again, unless the lead has already moved past it.
  if (status === "scheduled" && current.status !== "scheduled" && data?.lead_id) {
    await db
      .from("leads")
      .update({ status: "appointment_booked", updated_at: now })
      .eq("id", data.lead_id)
      .not("status", "in", '("measure_done","quote_sent","closed","closed_won")')
  }

  // A completed measure means the quote is owed: move the lead to the quote
  // stage, unless a quote already went out or the deal is signed.
  if (completing && data?.lead_id) {
    const { data: lead } = await db
      .from("leads").select("status, metadata").eq("id", data.lead_id).maybeSingle()
    if (lead && !["measure_done", "quote_sent", "closed", "closed_won"].includes(lead.status as string)) {
      const meta = { ...((lead.metadata as Record<string, unknown> | null) ?? {}), measure_done_at: now }
      await db
        .from("leads")
        .update({ status: "measure_done", metadata: meta, updated_at: now })
        .eq("id", data.lead_id)
    }
  }

  return NextResponse.json({ appointment: data })
}
