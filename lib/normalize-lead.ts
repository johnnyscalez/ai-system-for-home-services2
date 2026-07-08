/**
 * Normalizes lead data from any JSON format into a consistent shape.
 * Handles field name variations from Typeform, HubSpot, Gravity Forms,
 * Zapier, custom website forms, Lovable, Go High Level, and others.
 */

export type NormalizedLead = {
  phone: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  address: string | null
  notes: string | null
  service_type: string | null
  source_form_id: string | null
  metadata: Record<string, unknown>
}

// All known aliases per field — order matters (most specific first)
const PHONE_KEYS = [
  "phone", "phone_number", "phoneNumber", "phonenumber",
  "mobile", "mobile_phone", "mobilePhone", "mobilenumber", "mobile_number",
  "cell", "cell_phone", "cellPhone", "telephone", "tel",
  "contact_phone", "contactPhone", "phone number", "Phone Number",
  "Phone", "Mobile", "Cell Phone", "Telephone",
]

const FIRST_NAME_KEYS = [
  "first_name", "firstName", "fname", "first",
  "given_name", "givenName", "First Name", "First", "firstname",
]

const LAST_NAME_KEYS = [
  "last_name", "lastName", "lname", "last",
  "family_name", "familyName", "surname", "Last Name", "Last", "lastname",
]

const FULL_NAME_KEYS = [
  "name", "full_name", "fullName", "fullname",
  "contact_name", "contactName", "customer_name", "customerName",
  "Full Name", "Name", "Contact Name",
]

const EMAIL_KEYS = [
  "email", "email_address", "emailAddress", "emailaddress",
  "e_mail", "Email", "Email Address", "Email address",
]

const ADDRESS_KEYS = [
  "address", "street_address", "streetAddress",
  "street", "location", "property_address", "propertyAddress",
  "Address", "Street Address", "Location",
]

const NOTES_KEYS = [
  "notes", "message", "messages", "comments", "comment",
  "description", "note", "inquiry", "details", "detail",
  "Message", "Comments", "Notes", "Description", "What can we help you with",
  "How can we help", "Additional info", "Additional information",
]

const SERVICE_TYPE_KEYS = [
  "service_type", "serviceType", "servicetype", "service", "Service Type", "Service",
  "service_needed", "type_of_service", "job_type", "jobType",
]

const FORM_ID_KEYS = [
  "form_id", "formId", "form_name", "formName",
]

// Keys that are webhook infrastructure — not lead fields, not metadata
const INFRA_KEYS = [
  "company_id", "companyId", "source", "webhook_secret", "secret", "key",
  "submittedAt", "submitted_at", "timestamp",
]

/**
 * Flattens one level of nested objects so top-level lookup works on
 * e.g. { data: { phone: "..." } } or { lead: { email: "..." } }
 */
function flattenOne(raw: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = { ...raw }
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        if (!(nk in flat)) flat[nk] = nv
      }
    }
  }
  return flat
}

/**
 * Case-insensitive key lookup across a flat object.
 */
function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  // Exact match first
  for (const k of keys) {
    const v = obj[k]
    if (v && typeof v === "string" && v.trim()) return v.trim()
  }
  // Case-insensitive fallback
  const lower = Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])
  )
  for (const k of keys) {
    const v = lower[k.toLowerCase()]
    if (v && typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

export function normalizeLead(raw: Record<string, unknown>): NormalizedLead {
  const flat = flattenOne(raw)

  const phone = pick(flat, PHONE_KEYS)
  const email = pick(flat, EMAIL_KEYS)
  const address = pick(flat, ADDRESS_KEYS)
  const notes = pick(flat, NOTES_KEYS)
  const serviceType = pick(flat, SERVICE_TYPE_KEYS)
  const formId = pick(flat, FORM_ID_KEYS)

  let firstName = pick(flat, FIRST_NAME_KEYS)
  let lastName = pick(flat, LAST_NAME_KEYS)

  // If no split name, try full name fields
  if (!firstName) {
    const fullName = pick(flat, FULL_NAME_KEYS)
    if (fullName) {
      const parts = fullName.trim().split(/\s+/)
      firstName = parts[0] ?? null
      lastName = parts.length > 1 ? parts.slice(1).join(" ") : lastName
    }
  }

  // Collect everything that didn't map to a known field as metadata
  const knownKeys = new Set([
    ...PHONE_KEYS, ...FIRST_NAME_KEYS, ...LAST_NAME_KEYS, ...FULL_NAME_KEYS,
    ...EMAIL_KEYS, ...ADDRESS_KEYS, ...NOTES_KEYS, ...SERVICE_TYPE_KEYS, ...FORM_ID_KEYS,
    ...INFRA_KEYS,
  ].map(k => k.toLowerCase()))

  // Sensitive fields that must never be stored in lead metadata
  const sensitiveKeys = new Set(["secret", "webhook_secret", "key", "api_key", "token", "password", "access_token"])

  const metadata: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(flat)) {
    if (!knownKeys.has(k.toLowerCase()) && !sensitiveKeys.has(k.toLowerCase()) && v !== null && v !== undefined && v !== "") {
      metadata[k] = v
    }
  }

  return { phone, first_name: firstName, last_name: lastName, email, address, notes, service_type: serviceType, source_form_id: formId, metadata }
}

// ── Source & channel taxonomy ─────────────────────────────────────────────────
// source  = where the lead came FROM (acquisition)
// channel = the medium we're TALKING to them on (conversation)

const SOURCE_ALIASES: Record<string, string> = {
  facebook: "facebook",
  facebook_lead_ads: "facebook",
  fb: "facebook",
  fb_lead_ads: "facebook",
  lead_ads: "facebook",
  messenger: "messenger",
  facebook_messenger: "messenger",
  whatsapp: "whatsapp",
  wa: "whatsapp",
  website: "website",
  web: "website",
  webform: "website",
  website_form: "website",
  form: "website",
  typeform: "typeform",
  google: "google",
  google_ads: "google",
  gmb: "google",
  sms: "sms_inbound",
  sms_inbound: "sms_inbound",
  text: "sms_inbound",
  phone: "voice_inbound",
  call: "voice_inbound",
  voice: "voice_inbound",
  voice_inbound: "voice_inbound",
  webhook: "webhook",
  manual: "manual",
}

export function normalizeSource(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "webhook"
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_")
  return SOURCE_ALIASES[key] ?? key
}

// The default conversation medium for a given source. Messenger/WhatsApp leads
// are spoken to on their own channel; everything else starts over SMS.
export function channelForSource(source: string): string {
  switch (source) {
    case "messenger":     return "messenger"
    case "whatsapp":      return "whatsapp"
    case "voice_inbound": return "voice"
    default:              return "sms"
  }
}
