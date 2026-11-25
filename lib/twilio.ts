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
  // Local simulation switch. With SMS_DRY_RUN=true nothing is sent: the message
  // is logged and a fake id is returned, so a whole conversation can be run end
  // to end on a developer machine without texting anyone. Never set in production.
  if (process.env.SMS_DRY_RUN === "true") {
    const sid = `SIM${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    console.log(`[sms dry run] to ${to} from ${from ?? "(default)"}: ${body}`)
    return { sid } as Awaited<ReturnType<ReturnType<typeof getTwilioClient>["messages"]["create"]>>
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

/**
 * The one outbound path for a text to a lead.
 *
 *   1. GoHighLevel, when the company has it connected: the message goes out from
 *      their own A2P-registered number and lands on the thread their team watches.
 *   2. Twilio, from the company's own number.
 *
 * A GHL failure falls through to Twilio rather than dropping the message.
 */
export async function sendToLead(
  lead: { id?: string; phone: string; channel?: string | null; last_inbound_at?: string | null },
  body: string,
  from: string,
  companyId?: string
): Promise<{ sid: string | null; channel: "sms" }> {
  const leadId = lead.id

  if (companyId) {
    try {
      const { ensureLeadGhlContact, sendGhlSms } = await import("@/lib/ghl")
      const link = await ensureLeadGhlContact(companyId, leadId ?? "")
      if (link) {
        const id = await sendGhlSms(link.conn, link.contactId, body)
        if (id) return { sid: id, channel: "sms" }
      }
    } catch { /* fall through to Twilio */ }
  }

  const msg = await sendSMS(lead.phone, body, from)
  return { sid: msg.sid, channel: "sms" }
}

/** Plain-words reason for the Twilio errors an owner can act on. */
export function describeTwilioError(err: unknown): string {
  const code = (err as { code?: number } | null)?.code
  switch (code) {
    case 21610: return "This person opted out of texts (replied STOP), so the message was not sent."
    case 21211:
    case 21614: return "That phone number is not a valid mobile number."
    case 21408: return "Texting to that country is not enabled on the account."
    case 21603:
    case 21606:
    case 21659: return "The company texting number is missing or no longer active. Reserve a number in Settings."
    case 30034: return "The texting number is not registered with US carriers yet (A2P 10DLC), so carriers block it."
    case 20003: return "The texting provider rejected our credentials. Check the Twilio keys."
    default:    return (err as Error | null)?.message || "The text could not be sent."
  }
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
