import { createServiceRoleClient } from "@/lib/supabase-server"
import { getTwilioClient, formatPhone } from "@/lib/twilio"

async function getCompanyNotificationConfig(companyId: string) {
  const supabase = createServiceRoleClient()
  const [companyRes, phoneRes] = await Promise.all([
    supabase
      .from("companies")
      .select("notification_phone, name")
      .eq("id", companyId)
      .single(),
    supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .single(),
  ])
  return {
    notificationPhone: companyRes.data?.notification_phone ?? null,
    companyName: companyRes.data?.name ?? "",
    fromNumber: phoneRes.data?.phone_number ?? process.env.TWILIO_PHONE_NUMBER!,
  }
}

async function send(companyId: string, message: string) {
  const { notificationPhone, fromNumber } = await getCompanyNotificationConfig(companyId)
  if (!notificationPhone) return

  try {
    const client = getTwilioClient()
    await client.messages.create({
      to: formatPhone(notificationPhone),
      from: fromNumber,
      body: message,
    })
  } catch (err) {
    console.error("Contractor notification failed:", err)
  }
}

export async function notifyNewLead(
  companyId: string,
  leadName: string,
  phone: string,
  source: string
) {
  const name = leadName.trim() || "New lead"
  const src = source === "facebook" ? "Facebook" : source === "webhook" ? "Webhook" : "Inbound"
  await send(companyId, `🔔 New lead: ${name} (${phone}) via ${src}. Check your CRM.`)
}

export async function notifyAppointmentBooked(
  companyId: string,
  leadName: string,
  scheduledAt: string,
  address: string
) {
  const name = leadName.trim() || "A lead"
  const when = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  })
  const where = address || "address TBD"
  await send(companyId, `✅ Appointment booked! ${name} — ${when} at ${where}`)
}

export async function notifyNeedsAttention(
  companyId: string,
  leadName: string,
  phone: string
) {
  const name = leadName.trim() || "A lead"
  await send(companyId, `⚠️ Needs attention: ${name} (${phone}) — your AI flagged this one for a human. Check your CRM.`)
}
