import twilio from "twilio"
import { parsePhoneNumber } from "libphonenumber-js"

export function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

export async function sendSMS(to: string, body: string, from?: string) {
  const client = getTwilioClient()
  return client.messages.create({
    to,
    from: from ?? process.env.TWILIO_PHONE_NUMBER!,
    body,
  })
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
