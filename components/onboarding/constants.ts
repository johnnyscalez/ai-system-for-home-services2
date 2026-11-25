// Shared, client-safe constants for the onboarding wizard. No server imports here.

export type StepId =
  | "business"
  | "review"
  | "areas"
  | "customer"
  | "offer"
  | "photos"
  | "ads"
  | "number"
  | "calendar"
  | "finish"

export const STEPS: Array<{ id: StepId; n: number; label: string; short: string }> = [
  { id: "business", n: 1,  label: "Your business",                  short: "Business" },
  { id: "review",   n: 2,  label: "Review what we found",           short: "Review" },
  { id: "areas",    n: 3,  label: "Where you work",                 short: "Areas" },
  { id: "customer", n: 4,  label: "Your ideal customer",            short: "Customer" },
  { id: "offer",    n: 5,  label: "Your offer",                     short: "Offer" },
  { id: "photos",   n: 6,  label: "Photos and brand",               short: "Photos" },
  { id: "ads",      n: 7,  label: "Ads and access",                 short: "Ads" },
  { id: "number",   n: 8,  label: "Texting number",                 short: "Number" },
  { id: "calendar", n: 9,  label: "Measure calendar and assistant", short: "Calendar" },
  { id: "finish",   n: 10, label: "Finish",                         short: "Finish" },
]

export const US_STATES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
]

// The timezone most of each state runs on. Only a starting point: the owner can change it.
const EASTERN = "America/New_York"
const CENTRAL = "America/Chicago"
const MOUNTAIN = "America/Denver"
const PACIFIC = "America/Los_Angeles"
export const STATE_TIMEZONE: Record<string, string> = {
  AL: CENTRAL, AK: "America/Anchorage", AZ: "America/Phoenix", AR: CENTRAL, CA: PACIFIC, CO: MOUNTAIN,
  CT: EASTERN, DE: EASTERN, DC: EASTERN, FL: EASTERN, GA: EASTERN, HI: "Pacific/Honolulu", ID: MOUNTAIN,
  IL: CENTRAL, IN: EASTERN, IA: CENTRAL, KS: CENTRAL, KY: EASTERN, LA: CENTRAL, ME: EASTERN, MD: EASTERN,
  MA: EASTERN, MI: EASTERN, MN: CENTRAL, MS: CENTRAL, MO: CENTRAL, MT: MOUNTAIN, NE: CENTRAL, NV: PACIFIC,
  NH: EASTERN, NJ: EASTERN, NM: MOUNTAIN, NY: EASTERN, NC: EASTERN, ND: CENTRAL, OH: EASTERN, OK: CENTRAL,
  OR: PACIFIC, PA: EASTERN, RI: EASTERN, SC: EASTERN, SD: CENTRAL, TN: CENTRAL, TX: CENTRAL, UT: MOUNTAIN,
  VT: EASTERN, VA: EASTERN, WA: PACIFIC, WV: EASTERN, WI: CENTRAL, WY: MOUNTAIN,
}

export const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: EASTERN, label: "Eastern" },
  { value: CENTRAL, label: "Central" },
  { value: MOUNTAIN, label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona (no daylight saving)" },
  { value: PACIFIC, label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
]

export const BUSINESS_MODELS: Array<{ value: string; label: string; hint: string }> = [
  { value: "shop_at_home",  label: "Shop at home",            hint: "You bring samples to the customer" },
  { value: "showroom",      label: "Showroom that installs",  hint: "Customers visit, your crews install" },
  { value: "installer_led", label: "Installer-led contractor", hint: "You sell and install the job yourself" },
]

export const PROPERTY_SCOPES: Array<{ value: string; label: string }> = [
  { value: "residential", label: "Homes only" },
  { value: "commercial",  label: "Commercial only" },
  { value: "both",        label: "Both" },
]

export const PHOTO_KINDS: Array<{ value: string; label: string }> = [
  { value: "before_after", label: "Before and after" },
  { value: "finished",     label: "Finished floor" },
  { value: "crew",         label: "Crew at work" },
  { value: "showroom",     label: "Showroom" },
  { value: "other",        label: "Other" },
]

export const TONES: Array<{ value: string; label: string; hint: string }> = [
  { value: "friendly_professional", label: "Friendly and professional", hint: "Warm, clear, to the point" },
  { value: "casual",                label: "Casual",                    hint: "Relaxed, like a neighbor" },
  { value: "formal",                label: "Formal",                    hint: "Polished and respectful" },
]

export const WEEK_DAYS: Array<{ value: string; label: string; short: string }> = [
  { value: "monday",    label: "Monday",    short: "Mon" },
  { value: "tuesday",   label: "Tuesday",   short: "Tue" },
  { value: "wednesday", label: "Wednesday", short: "Wed" },
  { value: "thursday",  label: "Thursday",  short: "Thu" },
  { value: "friday",    label: "Friday",    short: "Fri" },
  { value: "saturday",  label: "Saturday",  short: "Sat" },
  { value: "sunday",    label: "Sunday",    short: "Sun" },
]

export const LEAD_TIMES: Array<{ value: number; label: string }> = [
  { value: 0, label: "Same day" },
  { value: 1, label: "Next day" },
  { value: 2, label: "Two days out" },
]

export const MEASURE_LENGTHS: Array<{ value: number; label: string }> = [
  { value: 45,  label: "45 minutes" },
  { value: 60,  label: "1 hour" },
  { value: 90,  label: "1.5 hours" },
  { value: 120, label: "2 hours" },
]

export const A2P_BUSINESS_TYPES: Array<{ value: string; label: string }> = [
  { value: "llc",             label: "LLC" },
  { value: "corporation",     label: "Corporation" },
  { value: "partnership",     label: "Partnership" },
  { value: "sole_proprietor", label: "Sole proprietor" },
  { value: "non_profit",      label: "Non-profit" },
]

export const DOMAIN_ACCESS: Array<{ value: string; label: string; hint: string }> = [
  { value: "share_login",          label: "I will share the login",      hint: "We set everything up for you" },
  { value: "add_records",          label: "I will add what you send me", hint: "We send two records, you paste them in" },
  { value: "fieldbuilt_subdomain", label: "Use a FieldBuilt address",    hint: "No changes to your domain" },
  { value: "unsure",               label: "Not sure yet",                hint: "We will walk you through it" },
]

/** Ready-to-edit facts an owner can drop into the assistant's knowledge. */
export const KNOWLEDGE_CHIPS: Array<{ label: string; text: string }> = [
  { label: "Brands we carry",     text: "We carry and install Shaw, Mohawk and COREtec flooring." },
  { label: "Samples at the measure", text: "We bring samples with us to every in-home measure." },
  { label: "Labor warranty",      text: "Every install comes with a lifetime warranty on our workmanship." },
  { label: "Own crews",           text: "All installs are done by our own crews, never subcontractors." },
  { label: "Furniture moving",    text: "We move the furniture for you and put it back when the job is done." },
  { label: "Old floor removal",   text: "We tear out and haul away the old flooring as part of the job." },
  { label: "Subfloor check",      text: "We check the subfloor at every measure and fix any problems before we install." },
  { label: "Install timeline",    text: "Most installs start within 2 to 3 weeks of signing." },
  { label: "Spanish speaking",    text: "Spanish speaking staff are available on request." },
  { label: "Licensed and insured", text: "We are fully licensed and insured." },
]

export const A2P_STATUS_TEXT: Record<string, { label: string; detail: string; tone: "idle" | "progress" | "good" | "bad" }> = {
  not_started:      { label: "Not started",        detail: "Fill in the business details below so we can register your number.", tone: "idle" },
  info_collected:   { label: "Details saved",      detail: "We have what we need. FieldBuilt files the registration for you.", tone: "progress" },
  submitted:        { label: "Filed",              detail: "The registration is with the carriers. This usually takes a few business days.", tone: "progress" },
  brand_pending:    { label: "Business in review", detail: "The carriers are verifying your business details.", tone: "progress" },
  campaign_pending: { label: "Messages in review", detail: "Your business is verified. The carriers are reviewing the message samples.", tone: "progress" },
  approved:         { label: "Approved",           detail: "Your number is registered. Texts deliver normally.", tone: "good" },
  rejected:         { label: "Needs a fix",        detail: "The carriers sent the registration back. FieldBuilt will contact you about what to change.", tone: "bad" },
  error:            { label: "Needs a fix",        detail: "Something went wrong filing the registration. FieldBuilt is on it.", tone: "bad" },
}
