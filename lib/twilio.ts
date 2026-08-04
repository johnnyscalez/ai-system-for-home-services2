import twilio from "twilio"
import { parsePhoneNumber } from "libphonenumber-js"

export function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

export async function sendSMS(to: string, body: string, from?: string, statusCallbackUrl?: string) {
  // Placeholder leads carry "msgr:<psid>" / "fbform:<leadgen_id>" phones, and
  // failed extraction historically produced garbage like "+". Never let any
  // non-dialable value reach Twilio (reminders, sequences, confirmations all
  // route here).
  if (isPlaceholderPhone(to)) {
    throw new Error(`sendSMS: not a real phone number: "${to}"`)
  }
  const client = getTwilioClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  return client.messages.create({
    to,
    from: from ?? process.env.TWILIO_PHONE_NUMBER!,
    body,
    statusCallback: statusCallbackUrl ?? (appUrl ? `${appUrl}/api/webhooks/sms-status` : undefined),
  })
}

// WhatsApp messages ride the same Twilio Messages API with a channel prefix.
export async function sendWhatsApp(to: string, body: string, from: string) {
  const client = getTwilioClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  return client.messages.create({
    to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    body,
    statusCallback: appUrl ? `${appUrl}/api/webhooks/sms-status` : undefined,
  })
}

/**
 * Channel-aware outbound: WhatsApp leads get WhatsApp replies while Meta's
 * 24-hour session window is open; outside the window (or if WhatsApp fails)
 * we fall back to plain SMS — the WhatsApp number IS a phone number.
 */
export async function sendToLead(
  lead: { id?: string; phone: string; channel?: string | null; last_inbound_at?: string | null },
  body: string,
  from: string,
  companyId?: string
): Promise<{ sid: string | null; channel: "whatsapp" | "sms" }> {
  const leadId = lead.id
  const inWindow =
    lead.last_inbound_at &&
    Date.now() - new Date(lead.last_inbound_at).getTime() < 23 * 60 * 60 * 1000

  // A company on GoHighLevel sends from their own A2P-verified number, and
  // every message stays on the thread their team already watches in GHL.
  if (companyId) {
    try {
      const { ensureLeadGhlContact, sendGhlSms } = await import("@/lib/ghl")
      const link = await ensureLeadGhlContact(companyId, leadId ?? "")
      if (link) {
        const id = await sendGhlSms(link.conn, link.contactId, body)
        if (id) return { sid: id, channel: "sms" }
        // GHL failed — fall through to Twilio rather than drop the message
      }
    } catch { /* fall through */ }
  }

  if (lead.channel === "whatsapp" && inWindow) {
    // Level 3 first: the company's own WABA via Meta Cloud API
    if (companyId) {
      try {
        const { getCloudConnection, sendCloudText } = await import("@/lib/whatsapp-cloud")
        const conn = await getCloudConnection(companyId)
        if (conn) {
          const wamid = await sendCloudText(conn, lead.phone, body)
          if (wamid) return { sid: wamid, channel: "whatsapp" }
        }
      } catch { /* fall through */ }
    }
    // Twilio-hosted WhatsApp sender
    try {
      const msg = await sendWhatsApp(lead.phone, body, from)
      return { sid: msg.sid, channel: "whatsapp" }
    } catch {
      // fall through to SMS
    }
  }
  const msg = await sendSMS(lead.phone, body, from)
  return { sid: msg.sid, channel: "sms" }
}

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  )
}

/** Strict lead-phone parser for INGESTION paths. Returns a valid E.164 string
 *  or null — never a garbage value. formatPhone() (below) is lenient by
 *  design for send paths; using it on raw form input produced "+" (from
 *  "no phone") and +31255501872 (a Dutch number, from "312 555 0187 ext 2").
 *  Ingestion must validate, not guess (adversarial-verify findings 8 + ext). */
export function parseLeadPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Strip extension suffixes before digit-mangling: "ext 2", "x22", "extension 3"
  const cleaned = raw.trim().replace(/[,;]?\s*(ext\.?|extension|x)\s*\d{1,6}\s*$/i, "")
  if (!/\d{7}/.test(cleaned.replace(/\D/g, ""))) return null
  let formatted: string
  try { formatted = formatPhone(cleaned) } catch { return null }
  if (!/^\+\d{10,15}$/.test(formatted)) return null
  return formatted
}

/** True when a value is one of our internal placeholders (msgr:<psid>,
 *  fbform:<leadgen_id>) or otherwise not a dialable E.164 number. */
export function isPlaceholderPhone(phone: string | null | undefined): boolean {
  return !phone || !/^\+\d{8,15}$/.test(phone)
}

export function formatPhone(phone: string): string {
  const trimmed = phone.trim()

  // Already E.164 — parse and normalise
  if (trimmed.startsWith("+")) {
    try {
      const parsed = parsePhoneNumber(trimmed)
      if (parsed?.isValid()) return parsed.format("E.164")
    } catch { /* fall through */ }
    return trimmed
  }

  // International dialing prefix 00... → +...
  if (trimmed.startsWith("00")) {
    return formatPhone("+" + trimmed.slice(2))
  }

  const digits = trimmed.replace(/\D/g, "")

  // 11 digits starting with 1 → US/Canada
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`

  // 10 digits NOT starting with 0 → assume US/Canada
  if (digits.length === 10 && !digits.startsWith("0")) return `+1${digits}`

  // Everything else: prepend + and let libphonenumber validate
  // e.g. 972529511234 → +972529511234 (Israeli full number without +)
  try {
    const parsed = parsePhoneNumber(`+${digits}`)
    if (parsed?.isValid()) return parsed.format("E.164")
  } catch { /* fall through */ }

  return `+${digits}`
}
