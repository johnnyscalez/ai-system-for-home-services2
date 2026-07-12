import twilio from "twilio"
import { parsePhoneNumber } from "libphonenumber-js"

export function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

export async function sendSMS(to: string, body: string, from?: string, statusCallbackUrl?: string) {
  // Messenger-only leads carry a "msgr:<psid>" placeholder phone — never let
  // those reach Twilio (reminders, sequences, confirmations all route here).
  if (!to || to.startsWith("msgr:")) {
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
  lead: { phone: string; channel?: string | null; last_inbound_at?: string | null },
  body: string,
  from: string,
  companyId?: string
): Promise<{ sid: string | null; channel: "whatsapp" | "sms" }> {
  const inWindow =
    lead.last_inbound_at &&
    Date.now() - new Date(lead.last_inbound_at).getTime() < 23 * 60 * 60 * 1000

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
