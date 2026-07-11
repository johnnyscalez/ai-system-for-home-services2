/**
 * Call forwarding setup — connects a contractor's EXISTING business number
 * to their AI agent's Twilio number.
 *
 * Strategy: conditional "no-answer" forwarding with a short ring timer (~10s).
 * The office phone itself is the gate — no schedule needed anywhere:
 *   • Business hours: someone answers in 2-3 rings, Twilio never sees the call.
 *   • After hours / weekends / busy rush: nobody answers, call forwards to
 *     Twilio after ~10 seconds and the AI agent picks up.
 *
 * Verification: Twilio passes a ForwardedFrom parameter on forwarded calls.
 * When an inbound call arrives with ForwardedFrom matching the company's
 * office_number, forwarding is proven working — no manual confirmation needed.
 */

/** Strip a number to bare digits with leading country code (no +). */
function bareDigits(e164: string): string {
  return e164.replace(/[^\d]/g, "")
}

export type ForwardingProvider = {
  id: string
  label: string
  /** How forwarding is configured on this provider. */
  method: "dial_code" | "settings_menu"
  /** GSM-style dial codes with the Twilio number embedded (method: dial_code). */
  enableCode?: string
  disableCode?: string
  /** Human steps for settings-menu providers. */
  steps?: string[]
  note?: string
}

/**
 * Build the provider-specific setup instructions for forwarding
 * an existing business number to the given Twilio number.
 */
export function getForwardingInstructions(twilioNumber: string): ForwardingProvider[] {
  const n = bareDigits(twilioNumber)

  // GSM standard: **61*<number>**<seconds># — forward when unanswered after N seconds.
  // 10 seconds ≈ 2-3 rings. Works on AT&T, T-Mobile, and most GSM carriers.
  const gsmEnable  = `**61*${n}**10#`
  const gsmDisable = `##61#`

  // Verizon (CDMA legacy): *71 = forward when busy/unanswered (timer not settable by code).
  const verizonEnable  = `*71${n}`
  const verizonDisable = `*73`

  return [
    {
      id: "att",
      label: "AT&T (cell)",
      method: "dial_code",
      enableCode: gsmEnable,
      disableCode: gsmDisable,
      note: "Dial this once from the business phone. Forwards unanswered calls after 10 seconds (about 3 rings).",
    },
    {
      id: "tmobile",
      label: "T-Mobile (cell)",
      method: "dial_code",
      enableCode: gsmEnable,
      disableCode: gsmDisable,
      note: "Dial this once from the business phone. Forwards unanswered calls after 10 seconds (about 3 rings).",
    },
    {
      id: "verizon",
      label: "Verizon (cell)",
      method: "dial_code",
      enableCode: verizonEnable,
      disableCode: verizonDisable,
      note: "Dial this once from the business phone. Forwards calls you don't answer (ring time follows your voicemail timer — shorten it in My Verizon if needed).",
    },
    {
      id: "ringcentral",
      label: "RingCentral",
      method: "settings_menu",
      steps: [
        "Admin Portal → Phone System → your main number → Call Handling",
        "Under After Hours: set action to \"Forward to external number\"",
        `Enter ${twilioNumber}`,
        "Optional: under Work Hours, add the same forward as the \"if no one answers\" fallback so missed daytime calls are caught too",
      ],
    },
    {
      id: "googlevoice",
      label: "Google Voice",
      method: "settings_menu",
      steps: [
        "voice.google.com → Settings → Calls",
        `Under \"Forward calls to\": add ${twilioNumber} as a linked number`,
        "Or set unanswered-call handling to forward to this number",
      ],
    },
    {
      id: "openphone",
      label: "OpenPhone",
      method: "settings_menu",
      steps: [
        "Settings → your number → Call Flow",
        "Business hours: keep ringing your team",
        `After hours / unanswered: forward to ${twilioNumber}`,
      ],
    },
    {
      id: "grasshopper",
      label: "Grasshopper",
      method: "settings_menu",
      steps: [
        "Settings → Call Forwarding → your extension",
        `Add ${twilioNumber} as a forwarding number`,
        "Set the schedule (after hours) or use it as the no-answer fallback",
      ],
    },
    {
      id: "landline",
      label: "Landline / other",
      method: "dial_code",
      enableCode: `*71${n}`,
      disableCode: `*73`,
      note: "Most landline providers use *71 for busy/no-answer forwarding. If this code doesn't work, check your provider's call-forwarding settings or call their support.",
    },
  ]
}
