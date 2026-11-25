"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, AlertTriangle, Clock, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Business = {
  legalName?: string; businessType?: string; ein?: string
  street?: string; city?: string; state?: string; zip?: string; website?: string
  repFirstName?: string; repLastName?: string; repTitle?: string; repEmail?: string; repPhone?: string
  privacyPolicyUrl?: string; termsUrl?: string
}

type Status = {
  status: string
  label: string
  detail: string
  missing: string[]
  brandStatus: string | null
  campaignStatus: string | null
  lastError: string | null
  business: Business
  phoneNumber: string | null
  legal: { privacy: string; terms: string }
}

const BUSINESS_TYPES = [
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "non_profit", label: "Non-profit" },
  { value: "sole_proprietor", label: "Sole proprietor (no EIN)" },
]

const TONE: Record<string, { icon: typeof Clock; className: string }> = {
  approved:         { icon: CheckCircle2,  className: "bg-green-50 text-green-700 border-green-200" },
  brand_pending:    { icon: Clock,         className: "bg-amber-50 text-amber-700 border-amber-200" },
  campaign_pending: { icon: Clock,         className: "bg-amber-50 text-amber-700 border-amber-200" },
  submitted:        { icon: Clock,         className: "bg-amber-50 text-amber-700 border-amber-200" },
  rejected:         { icon: AlertTriangle, className: "bg-red-50 text-red-700 border-red-200" },
  error:            { icon: AlertTriangle, className: "bg-red-50 text-red-700 border-red-200" },
}
const DEFAULT_TONE = { icon: AlertTriangle, className: "bg-orange-50 text-orange-700 border-orange-200" }

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button" variant="outline" size="sm" aria-label={`Copy ${label}`}
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
    </Button>
  )
}

export function TextingStatusCard() {
  const [data, setData] = useState<Status | null>(null)
  const [form, setForm] = useState<Business>({})
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Bumped after a save to re-read the status from the server.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    fetch("/api/a2p/status")
      .then(async (res) => ({ ok: res.ok, d: await res.json() }))
      .then(({ ok, d }) => {
        if (!alive) return
        if (!ok) { setError(d.error ?? "Could not load the registration status."); return }
        setData(d)
        setForm(d.business ?? {})
      })
      .catch(() => { if (alive) setError("Could not load the registration status.") })
    return () => { alive = false }
  }, [reloadKey])

  async function save() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/a2p/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business: form }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? "Could not save."); return }
      setSaved(true)
      setReloadKey((k) => k + 1)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : <><Loader2 className="size-4 animate-spin" /> Loading</>}
      </div>
    )
  }

  const tone = TONE[data.status] ?? DEFAULT_TONE
  const Icon = tone.icon
  const field = (key: keyof Business, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`a2p-${key}`}>{label}</Label>
      <Input
        id={`a2p-${key}`} value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </div>
  )
  const consentLine = "By submitting, you agree to receive text messages about your request, including appointment scheduling and reminders. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help."
  const editable = !["submitted", "brand_pending", "campaign_pending", "approved"].includes(data.status)

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-lg font-semibold text-foreground">
          {data.phoneNumber ?? "No number reserved yet"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Your assistant texts every lead from this number, and replies land in your CRM.
        </p>
      </div>

      <div className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", tone.className)}>
        <Icon className="size-4 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Carrier registration: {data.label}</p>
          <p className="text-xs mt-0.5 opacity-90">{data.detail}</p>
          {data.lastError && <p className="text-xs mt-1.5 font-medium break-words">{data.lastError}</p>}
        </div>
      </div>

      {data.status !== "approved" && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          US carriers only deliver business texts from a number registered to that business (called A2P 10DLC).
          Until the registration is approved, texts from this number are blocked by the carriers. Review usually takes
          one to two weeks from submission.
        </p>
      )}

      {editable && (
        <div className="space-y-3">
          <button
            type="button" onClick={() => setOpen((o) => !o)}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            aria-expanded={open}
          >
            {open ? "Hide business details" : data.missing.length ? `Add business details (${data.missing.length} missing)` : "Review business details"}
          </button>

          {open && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {field("legalName", "Legal business name", { placeholder: "Summit Floors LLC" })}
                <div className="space-y-1.5">
                  <Label htmlFor="a2p-type">Business type</Label>
                  <select
                    id="a2p-type" value={form.businessType ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    <option value="">Choose</option>
                    {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {form.businessType !== "sole_proprietor" && field("ein", "EIN", { placeholder: "12-3456789", inputMode: "numeric" })}
                {field("website", "Website", { placeholder: "https://summitfloors.com", type: "url" })}
                {field("street", "Street address", { placeholder: "4501 Main St" })}
                {field("city", "City")}
                {field("state", "State", { placeholder: "TX", maxLength: 2 })}
                {field("zip", "ZIP code", { placeholder: "75201", inputMode: "numeric", maxLength: 5 })}
                {field("repFirstName", "Contact first name")}
                {field("repLastName", "Contact last name")}
                {field("repTitle", "Contact title", { placeholder: "Owner" })}
                {field("repEmail", "Contact email", { type: "email" })}
                {field("repPhone", "Contact mobile", { type: "tel" })}
              </div>
              {form.businessType === "sole_proprietor" && (
                <p className="text-xs text-muted-foreground">
                  Sole proprietors with no EIN are registered by hand, because the carriers send a one-time code to the owner&apos;s mobile. Save the details and FieldBuilt completes it with you.
                </p>
              )}
              {data.missing.length > 0 && (
                <p className="text-xs text-muted-foreground">Still needed: {data.missing.join(", ")}.</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void save()}>
                  {busy && <Loader2 className="animate-spin" />} Save details
                </Button>
                {saved && <span className="text-xs text-green-700">Saved</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                FieldBuilt files the registration for you as soon as these details are complete. There is nothing else to do.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2 rounded-lg bg-muted/60 p-3">
        <p className="text-xs font-semibold text-foreground">What the carriers check</p>
        <p className="text-xs text-muted-foreground">
          Every form that collects a mobile number (your website and your Facebook lead form) must show this line next to the submit button, and link to a privacy policy and messaging terms:
        </p>
        <div className="flex items-start gap-2">
          <p className="flex-1 rounded-md bg-background px-2.5 py-2 text-xs text-foreground ring-1 ring-foreground/10">{consentLine}</p>
          <CopyButton text={consentLine} label="consent line" />
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground">
          <span>Privacy policy: <a className="text-primary underline-offset-4 hover:underline break-all" href={data.legal.privacy} target="_blank" rel="noreferrer">{data.legal.privacy}</a></span>
          <span>Messaging terms: <a className="text-primary underline-offset-4 hover:underline break-all" href={data.legal.terms} target="_blank" rel="noreferrer">{data.legal.terms}</a></span>
        </div>
      </div>
    </div>
  )
}
