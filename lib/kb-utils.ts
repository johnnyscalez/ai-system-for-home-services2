// Knowledge-base field hygiene.
//
// Onboarding fields are free text filled in by non-technical contractors, who
// routinely type "null", "N/A", "none", or "-" to mean "we don't have this".
// Stored verbatim, those strings are TRUTHY, so prompt builders injected
// blocks like "FINANCING OPTIONS: null" and the model treated it as content.
// Every optional KB field must pass through here before reaching a prompt.

const PLACEHOLDERS = new Set([
  "null", "nil", "none", "none.", "n/a", "n\\a", "na", "no", "nope",
  "-", "--", "–", "—", "n/a.", "not applicable", "notapplicable",
  "unknown", "tbd", "x", ".", "0",
])

/** Returns the trimmed value, or null when it's empty or a "no value" placeholder. */
export function kbValue(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (PLACEHOLDERS.has(trimmed.toLowerCase())) return null
  return trimmed
}
