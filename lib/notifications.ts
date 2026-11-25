/**
 * Texts to the business owner about their own leads. Three kinds:
 *   "New lead"            a lead arrived and the assistant is texting them
 *   "New estimate booked" the assistant booked (or moved) a home visit
 *   "Needs attention"     a lead was handed to a person
 *
 * They go to companies.notification_phone (the owner's mobile, required in
 * onboarding and in Settings), sent from the company's own texting number.
 * Best effort: a failed owner text is logged and never breaks the lead's flow.
 * lib/attention.ts re-sends the needs-attention text from the cron for any
 * hand-off that did not text the owner here.
 */
import { createServiceRoleClient } from "@/lib/supabase-server"
import { sendSMS, formatPhone } from "@/lib/twilio"

async function getCompanyNotificationConfig(companyId: string) {
  const supabase = createServiceRoleClient()
  const [companyRes, phoneRes, agentRes] = await Promise.all([
    supabase.from("companies").select("notification_phone, name, service_type").eq("id", companyId).single(),
    supabase.from("phone_numbers").select("phone_number").eq("company_id", companyId).eq("is_active", true).limit(1).maybeSingle(),
    supabase.from("ai_agent_config").select("timezone").eq("company_id", companyId).maybeSingle(),
  ])
  const fromNumber = phoneRes.data?.phone_number ?? process.env.TWILIO_PHONE_NUMBER ?? null
  if (!fromNumber) console.error(`[notifications] No Twilio number for company ${companyId} and TWILIO_PHONE_NUMBER env var not set`)
  if (!companyRes.data?.notification_phone) console.error(`[notifications] Company ${companyId} has no owner mobile, so the owner gets no texts`)
  return {
    notificationPhone: (companyRes.data?.notification_phone as string | null) ?? null,
    companyName: (companyRes.data?.name as string | null) ?? "",
    serviceType: (companyRes.data?.service_type as string | null) ?? null,
    fromNumber: fromNumber ?? "",
    timezone: (agentRes.data?.timezone as string | null) ?? "America/New_York",
  }
}

/** +12145550161 → 214-555-0161 for US numbers; anything else as it came. */
function readablePhone(phone: string): string {
  const m = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : phone
}

/** A tappable link to the lead in the CRM, when we know which lead. */
function leadLink(leadId?: string | null): string {
  if (!leadId) return ""
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://fieldbuiltai.com").replace(/\/$/, "")
  return ` ${base}/leads/${leadId}`
}

async function send(companyId: string, message: string) {
  const { notificationPhone, fromNumber } = await getCompanyNotificationConfig(companyId)
  // No sender = nothing to send from. Calling Twilio anyway produced a steady
  // stream of 21603 "From is required" failures (Oct 2026).
  if (!notificationPhone || !fromNumber) return

  try {
    await sendSMS(formatPhone(notificationPhone), message, fromNumber)
  } catch (err) {
    console.error("Contractor notification failed:", err)
  }
}

/** One plain text to the owner's notification phone. Best effort, never throws. */
export async function notifyOwner(companyId: string, message: string) {
  await send(companyId, message)
}

const SOURCE_LABEL: Record<string, string> = {
  facebook: "Facebook",
  messenger: "Messenger",
  webhook: "your website form",
  website: "your website form",
  sms: "a text to your number",
  missed_call: "a missed call",
  google: "Google",
}

export async function notifyNewLead(
  companyId: string,
  leadName: string,
  phone: string,
  source: string,
  leadId?: string | null
) {
  const name = leadName.trim()
  const who = name ? `${name}${phone ? ` (${readablePhone(phone)})` : ""}` : phone ? readablePhone(phone) : "Someone"
  const src = SOURCE_LABEL[source] ?? (source || "an inbound message")
  await send(companyId, `New lead: ${who} from ${src}. Your assistant is texting them now.${leadLink(leadId)}`)
}

export async function notifyAppointmentBooked(
  companyId: string,
  leadName: string,
  scheduledAt: string,
  address: string,
  moved = false,
  leadId?: string | null
) {
  const { notificationPhone, fromNumber, timezone, serviceType } = await getCompanyNotificationConfig(companyId)
  if (!fromNumber) return
  const supabase = createServiceRoleClient()

  // Whoever runs the measures gets the booking too, when onboarding named one.
  const recipients = new Set<string>()
  if (notificationPhone) recipients.add(formatPhone(notificationPhone))
  try {
    const { loadIntake } = await import("@/lib/intake")
    const estimator = (await loadIntake(supabase, companyId)).calendar?.estimatorPhone
    if (estimator?.trim()) recipients.add(formatPhone(estimator))
  } catch { /* the intake is optional */ }
  if (recipients.size === 0) return

  // The owner calls the home visit an estimate; HVAC books service calls.
  const visit = serviceType === "hvac" ? "appointment" : "estimate"
  const name = leadName.trim() || "A lead"
  const when = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZone: timezone,
  })
  const where = address || "address to be confirmed"
  const title = moved ? `${visit[0].toUpperCase()}${visit.slice(1)} moved` : `New ${visit} booked`
  for (const to of recipients) {
    try {
      await sendSMS(to, `${title}: ${name}, ${when}, ${where}.${leadLink(leadId) || " Details are in your CRM."}`, fromNumber)
    } catch (err) {
      console.error("[notifications] booked notification failed:", err)
    }
  }
}

/**
 * "Needs attention" text. With a leadId, the episode is stamped as alerted so
 * the cron sweep (lib/attention.ts) does not text the owner a second time.
 */
export async function notifyNeedsAttention(
  companyId: string,
  leadName: string,
  phone: string,
  leadId?: string | null,
  opts: { skipStamp?: boolean; reason?: string } = {}
) {
  let why = opts.reason ?? ""
  if (leadId && !opts.skipStamp) {
    try {
      const db = createServiceRoleClient()
      // Two paths often flag the same lead in one turn (a call request and the
      // turn's own status). The owner needs one text per lead, not one per path.
      const { data: cur } = await db.from("leads").select("metadata").eq("id", leadId).maybeSingle()
      const attention = (cur?.metadata as { attention?: { alerted_at?: string; reason?: string } } | null)?.attention
      const last = attention?.alerted_at ?? null
      if (attention?.reason) {
        const { REASON_TEXT } = await import("@/lib/attention")
        why = REASON_TEXT[attention.reason] ?? attention.reason
      }
      if (last && Date.now() - Date.parse(last) < 10 * 60 * 1000) {
        console.log(`[notifications] needs-attention text for lead ${leadId} skipped: the owner was texted about it at ${last}`)
        return
      }
      const { markAttention } = await import("@/lib/attention")
      await markAttention(db, leadId, { alerted_at: new Date().toISOString() })
    } catch (err) {
      console.error("[notifications] could not stamp the needs-attention alert:", err)
    }
  }
  const name = leadName.trim() || "A lead"
  const cleanWhy = why.trim().replace(/[.\s]+$/, "")
  const reason = cleanWhy && !name.toLowerCase().includes(cleanWhy.toLowerCase())
    ? ` ${cleanWhy[0].toUpperCase()}${cleanWhy.slice(1)}.`
    : ""
  await send(companyId, `Needs attention: ${name}${phone ? ` (${readablePhone(phone)})` : ""}.${reason}${leadLink(leadId) || " Open the lead in your CRM."}`)
}
