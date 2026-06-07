import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceRoleClient } from "@/lib/supabase-server"

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
  const supabase = createClient()
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

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined)              update.status = status
  if (confirmation_status !== undefined) update.confirmation_status = confirmation_status
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

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from("appointments")
    .update(update)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select("id, lead_id, scheduled_at, address, notes, status, confirmation_status, technician_id, technician_name, leads(first_name, last_name, phone), technicians(name, phone)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When an appointment is cancelled, revert the lead's status from appointment_booked
  // so it re-appears in the pipeline at the right stage. Keep the appointment record
  // in the DB so the AI agent has full conversation history context.
  if (status === "cancelled" && data?.lead_id) {
    await db
      .from("leads")
      .update({ status: "qualified", updated_at: new Date().toISOString() })
      .eq("id", data.lead_id)
      .eq("status", "appointment_booked") // only revert if still in appointment_booked
  }

  return NextResponse.json({ appointment: data })
}
