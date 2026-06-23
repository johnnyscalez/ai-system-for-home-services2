import { createServiceRoleClient } from "@/lib/supabase-server"
import { getTwilioClient, formatPhone } from "@/lib/twilio"

async function getCompanyNotificationConfig(companyId: string) {
  const supabase = createServiceRoleClient()
  const [companyRes, phoneRes, agentRes] = await Promise.all([
    supabase.from("companies").select("notification_phone, name").eq("id", companyId).single(),
    supabase.from("phone_numbers").select("phone_number").eq("company_id", companyId).eq("is_active", true).single(),
    supabase.from("ai_agent_config").select("timezone").eq("company_id", companyId).single(),
  ])
  const fromNumber = phoneRes.data?.phone_number ?? process.env.TWILIO_PHONE_NUMBER ?? null
  if (!fromNumber) console.error(`[notifications] No Twilio number for company ${companyId} and TWILIO_PHONE_NUMBER env var not set`)
  return {
    notificationPhone: companyRes.data?.notification_phone ?? null,
    companyName: companyRes.data?.name ?? "",
    fromNumber: fromNumber ?? "",
    timezone: agentRes.data?.timezone ?? "America/New_York",
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
  const { notificationPhone, fromNumber, timezone } = await getCompanyNotificationConfig(companyId)
  if (!notificationPhone || !fromNumber) return
  const name = leadName.trim() || "A lead"
  const when = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZone: timezone,
  })
  const where = address || "address TBD"
  try {
    const client = getTwilioClient()
    await client.messages.create({
      to: formatPhone(notificationPhone),
      from: fromNumber,
      body: `✅ Appointment booked! ${name} — ${when} at ${where}`,
    })
  } catch (err) {
    console.error("[notifications] Appointment booked notification failed:", err)
  }
}

export async function notifyNeedsAttention(
  companyId: string,
  leadName: string,
  phone: string
) {
  const name = leadName.trim() || "A lead"
  await send(companyId, `⚠️ Needs attention: ${name} (${phone}) — your AI flagged this one for a human. Check your CRM.`)
}
