import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { formatPhone } from "@/lib/twilio"
import { companyFromWebhookSecret } from "@/lib/ghl"
import { notifyAppointmentBooked } from "@/lib/notifications"

// A lead booked (or moved, or cancelled) on the GoHighLevel calendar.
//
// The agent normally books inside FieldBuilt, so this never fires for its own
// bookings. It exists for the other route in: someone books through a GHL
// calendar link directly. Without this, that appointment would be invisible to
// FieldBuilt — the agent would keep chasing a lead who has already booked.
//
// GHL Workflow → Webhook action:
//   POST /api/webhooks/ghl/appointment-booked
//   Header: x-webhook-secret: <company webhook_secret>
//   Body:   { "contactId": "{{contact.id}}", "phone": "{{contact.phone}}",
//             "appointmentId": "{{appointment.id}}",
//             "appointmentAt": "{{appointment.start_time}}",
//             "status": "{{appointment.status}}" }

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const secret =
    req.headers.get("x-webhook-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    (typeof body.secret === "string" ? body.secret : null)

  const companyId = await companyFromWebhookSecret(secret)
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  const ghlContactId = str(body.contactId) ?? str(body.contact_id)
  const rawPhone = str(body.phone)
  const ghlAppointmentId = str(body.appointmentId) ?? str(body.appointment_id)
  const appointmentAt = str(body.appointmentAt) ?? str(body.appointment_at) ?? str(body.startTime)
  const rawStatus = (str(body.status) ?? "").toLowerCase()
  const isCancelled = /cancel|declin|no.?show/.test(rawStatus)

  const db = createServiceRoleClient()

  // Match the lead: GHL contact id first, then phone.
  let lead: { id: string; first_name: string | null; last_name: string | null; phone: string } | null = null
  if (ghlContactId) {
    const { data } = await db
      .from("leads").select("id, first_name, last_name, phone")
      .eq("company_id", companyId).eq("ghl_contact_id", ghlContactId)
      .is("deleted_at", null).maybeSingle()
    lead = data
  }
  if (!lead && rawPhone) {
    const { data } = await db
      .from("leads").select("id, first_name, last_name, phone")
      .eq("company_id", companyId).eq("phone", formatPhone(rawPhone))
      .is("deleted_at", null).maybeSingle()
    lead = data
    if (lead && ghlContactId) {
      await db.from("leads").update({ ghl_contact_id: ghlContactId }).eq("id", lead.id)
    }
  }
  if (!lead) return NextResponse.json({ ok: true, matched: false })

  // Already tracked? Then this is a reschedule or a cancellation of a known job.
  const { data: existing } = ghlAppointmentId
    ? await db.from("appointments")
        .select("id, scheduled_at, status")
        .eq("company_id", companyId).eq("ghl_event_id", ghlAppointmentId)
        .maybeSingle()
    : { data: null }

  if (isCancelled) {
    if (existing) {
      await db.from("appointments").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Cancelled on the GoHighLevel calendar",
      }).eq("id", existing.id)
      await db.from("leads").update({ status: "needs_attention" }).eq("id", lead.id)
    }
    return NextResponse.json({ ok: true, cancelled: true })
  }

  // GHL renders {{appointment.start_time}} as a NAIVE local string in the
  // location's timezone. new Date() reads that as UTC and shifts the booking
  // by the entire offset — live-reproduced: an appointment we had just written
  // correctly at 6:00 AM PDT was rewritten to 9:00 AM PDT five seconds later,
  // because this location runs at +03:00. So the payload time is only a hint;
  // GHL's API is the authority whenever we can reach it.
  let authoritative: string | null = null
  if (ghlAppointmentId) {
    const { getGhlCalendar, getGhlAppointmentStart } = await import("@/lib/ghl-calendar")
    const cal = await getGhlCalendar(companyId)
    if (cal) authoritative = await getGhlAppointmentStart(cal, ghlAppointmentId)
  }

  if (!authoritative && !appointmentAt) {
    return NextResponse.json({ error: "appointmentAt is required" }, { status: 400 })
  }
  // An offsetless payload cannot be trusted; without the API we would rather
  // keep the time we already hold than overwrite it with a shifted one.
  const payloadHasOffset = !!appointmentAt && /([zZ]|[+-]\d{2}:?\d{2})$/.test(appointmentAt.trim())
  const when = authoritative
    ? new Date(authoritative)
    : payloadHasOffset
      ? new Date(appointmentAt as string)
      : null

  if (!when || isNaN(when.getTime())) {
    if (existing) {
      console.warn(
        `[ghl/appointment] untrusted time "${appointmentAt}" for tracked event ${ghlAppointmentId} — keeping ${existing.scheduled_at}`
      )
      return NextResponse.json({ ok: true, timeUnchanged: true, appointmentId: existing.id })
    }
    return NextResponse.json({ error: `Unusable appointment time: "${appointmentAt}"` }, { status: 400 })
  }

  if (existing) {
    // GHL echoes a confirmation for appointments the agent itself created.
    // That is not a reschedule, and treating it as one both reset the reminder
    // clocks and (before the fix above) corrupted the time. Only a genuine
    // move — someone dragging the event in GHL — should touch the row.
    const moved = Math.abs(Date.parse(existing.scheduled_at) - when.getTime()) >= 60_000
    if (!moved) {
      return NextResponse.json({ ok: true, echo: true, appointmentId: existing.id })
    }
    // Reschedule — reminder clocks restart for the new time.
    await db.from("appointments").update({
      scheduled_at: when.toISOString(),
      status: "scheduled",
      rescheduled_from: existing.scheduled_at,
      reminder_2d_email_sent: false, reminder_2d_sms_sent: false,
      reminder_1d_email_sent: false, reminder_1d_sms_sent: false,
      reminder_2h_email_sent: false, reminder_2h_sms_sent: false,
    }).eq("id", existing.id)
    return NextResponse.json({ ok: true, rescheduled: true, appointmentId: existing.id })
  }

  // New booking made outside the agent. GHL already sends its own calendar
  // confirmation, so FieldBuilt records it and stops chasing rather than
  // sending a second confirmation text on top.
  const { data: apt, error } = await db.from("appointments").insert({
    company_id: companyId,
    lead_id: lead.id,
    scheduled_at: when.toISOString(),
    status: "scheduled",
    origin: "ghl",
    ghl_event_id: ghlAppointmentId,
    notes: "Booked on the GoHighLevel calendar",
    confirmation_status: "confirmed",
    confirmation_sms_sent: true,
    confirmation_email_sent: true,
  }).select("id").single()

  if (error) {
    console.error("[ghl/appointment] insert failed:", error)
    return NextResponse.json({ error: "Failed to record appointment" }, { status: 500 })
  }

  await db.from("leads").update({
    status: "appointment_booked",
    last_message_at: new Date().toISOString(),
  }).eq("id", lead.id)

  // They booked — every pending chase stops.
  await db.from("sequences").update({ status: "cancelled" })
    .eq("lead_id", lead.id).eq("status", "pending")

  const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.phone
  notifyAppointmentBooked(companyId, name, when.toISOString(), "").catch(() => {})

  return NextResponse.json({ ok: true, appointmentId: apt.id })
}
