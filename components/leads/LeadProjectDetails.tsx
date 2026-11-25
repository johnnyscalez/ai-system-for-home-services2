// What the lead told us about the job. Two blocks, both read from leads.metadata:
//   "Project details" = the qualification answers the assistant saved as it
//                        learned them (metadata.qualification)
//   "Form answers"    = what the lead typed into the ad form or landing page
//                        (metadata.form_answers) plus any other custom fields a
//                        webhook sent with the lead
// Pure presentation, no hooks: safe to render from a server or client component.

const QUALIFICATION_LABELS: Record<string, string> = {
  project_type: "Flooring wanted",
  project_size: "Rooms and size",
  timeline: "Timeline",
  homeowner: "Owns the home",
  decision_makers: "Decision makers at the measure",
  budget: "Budget",
  current_floor: "Current flooring",
  financing: "Paying or financing",
}

// Shown first, in this order; any other answered key follows.
const QUALIFICATION_ORDER = Object.keys(QUALIFICATION_LABELS)

// Bookkeeping the engine and the CRM keep in metadata. Never shown as an answer.
const INTERNAL_KEYS = new Set([
  "leadgen_id", "page_id", "form_id", "name_source", "name_verified", "service_zip",
  "unit_count", "property_type", "ad", "qualification", "form_answers",
  "inbound_first_message", "quote_amount", "quote_sent_at", "measure_done_at",
])

function humanize(key: string): string {
  const spaced = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ")
  try { return JSON.stringify(value) } catch { return "" }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export type LeadAdSource = { campaign: string | null; ad: string | null; form: string | null }

/** The ad a lead came from, when the lead source recorded it (metadata.ad). */
export function leadAdSource(metadata: Record<string, unknown> | null | undefined): LeadAdSource | null {
  const ad = asRecord(asRecord(metadata).ad)
  const pick = (k: string) => (typeof ad[k] === "string" && (ad[k] as string).trim() ? (ad[k] as string).trim() : null)
  const source = { campaign: pick("campaign_name"), ad: pick("ad_name"), form: pick("form_name") }
  return source.campaign || source.ad || source.form ? source : null
}

function Rows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="bg-muted/40 rounded-lg divide-y divide-border/60">
      {rows.map((row, i) => (
        <div key={`${i}-${row.label}`} className="px-3 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{row.label}</dt>
          <dd className="text-xs text-foreground mt-0.5 whitespace-pre-wrap break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function LeadProjectDetails({ metadata }: { metadata: Record<string, unknown> | null | undefined }) {
  const meta = asRecord(metadata)

  const qualification = asRecord(meta.qualification)
  const qualificationKeys = [
    ...QUALIFICATION_ORDER.filter((k) => k in qualification),
    ...Object.keys(qualification).filter((k) => !QUALIFICATION_ORDER.includes(k)),
  ]
  const projectRows = qualificationKeys
    .map((key) => ({ label: QUALIFICATION_LABELS[key] ?? humanize(key), value: formatValue(qualification[key]) }))
    .filter((row) => row.value)

  // form_answers is already label → answer. Other custom keys are de-snaked.
  const formAnswers = asRecord(meta.form_answers)
  const formRows = [
    ...Object.entries(formAnswers).map(([label, value]) => ({ label, value: formatValue(value) })),
    ...Object.entries(meta)
      .filter(([key]) => !INTERNAL_KEYS.has(key))
      .map(([key, value]) => ({ label: humanize(key), value: formatValue(value) })),
  ].filter((row) => row.value)

  if (projectRows.length === 0 && formRows.length === 0) return null

  return (
    <>
      {projectRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project details</p>
          <Rows rows={projectRows} />
        </div>
      )}
      {formRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Form answers</p>
          <Rows rows={formRows} />
        </div>
      )}
    </>
  )
}
