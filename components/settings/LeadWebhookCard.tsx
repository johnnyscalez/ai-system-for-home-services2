"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Target = { value: string; label: string; group: string }
type SampleField = { key: string; target: string; how: string; sample: string }
type Config = {
  url: string
  fieldMap: Record<string, string>
  lastSample: { receivedAt: string; source: string; fields: SampleField[] } | null
  targets: Target[]
}
type Preview = {
  fields: Array<{ key: string; target: string; value: string; how: string }>
  lead: Record<string, unknown>
}

const EXAMPLE = `{
  "full_name": "Sarah Lee",
  "phone": "2145550123",
  "email": "sarah@example.com",
  "zip": "75024",
  "What type of flooring are you interested in?": "LVP",
  "square_feet": "about 800",
  "timeline": "Next month",
  "budget": "$6,000 to $8,000",
  "utm_campaign": "plano-lvp"
}`

function targetLabel(targets: Target[], value: string): string {
  if (value === "form_answer") return "Kept as a form answer"
  const t = targets.find((x) => x.value === value)
  if (t) return t.label
  if (value.startsWith("q:")) return `Project detail: ${value.slice(2).replace(/_/g, " ")}`
  return value
}

export function LeadWebhookCard() {
  const [config, setConfig] = useState<Config | null>(null)
  const [map, setMap] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState(EXAMPLE)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/settings/lead-webhook")
      .then(async (res) => ({ ok: res.ok, d: await res.json() }))
      .then(({ ok, d }) => {
        if (!alive) return
        if (!ok) { setError(d.error ?? "Could not load the webhook settings."); return }
        setConfig(d)
        setMap(d.fieldMap ?? {})
      })
      .catch(() => { if (alive) setError("Could not load the webhook settings.") })
    return () => { alive = false }
  }, [])

  // Fields to show in the mapping table: the last real payload, plus any field
  // that already has an override, plus whatever the preview just revealed.
  const rows = useMemo(() => {
    const out = new Map<string, { key: string; auto: string; sample: string }>()
    for (const f of config?.lastSample?.fields ?? []) out.set(f.key, { key: f.key, auto: f.how === "explicit" ? "" : f.target, sample: f.sample })
    for (const f of preview?.fields ?? []) if (!out.has(f.key)) out.set(f.key, { key: f.key, auto: f.how === "explicit" ? "" : f.target, sample: f.value })
    for (const k of Object.keys(map)) if (!out.has(k)) out.set(k, { key: k, auto: "", sample: "" })
    return [...out.values()]
  }, [config, preview, map])

  async function save() {
    setSaving(true); setSaved(false); setError(null)
    try {
      const res = await fetch("/api/settings/lead-webhook", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldMap: map }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? "Could not save the mapping."); return }
      setMap(d.fieldMap ?? {})
      setSaved(true)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function runPreview() {
    setPreviewing(true); setPreviewError(null)
    try {
      let parsed: unknown
      try { parsed = JSON.parse(payload) } catch { setPreviewError("That is not valid JSON."); return }
      const res = await fetch("/api/settings/lead-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: parsed, fieldMap: map }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setPreviewError(d.error ?? "Could not preview."); return }
      setPreview(d)
    } catch {
      setPreviewError("Network error. Please try again.")
    } finally {
      setPreviewing(false)
    }
  }

  if (!config) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : <><Loader2 className="size-4 animate-spin" /> Loading</>}
      </div>
    )
  }

  const groups = [...new Set(config.targets.map((t) => t.group))]

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Send leads from a landing page, your website form, Zapier or any other tool to this address. Each lead is added to your CRM and texted within seconds.
        </p>
        <div className="flex items-start gap-2">
          <code className="flex-1 break-all rounded-lg bg-muted p-3 font-mono text-xs text-foreground">{config.url}</code>
          <Button
            type="button" variant="outline" size="sm" aria-label="Copy webhook address"
            onClick={() => { navigator.clipboard.writeText(config.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Send a POST with JSON or form fields. Only a phone number is required. Keep this address private: anyone who has it can add leads to your account.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Where each field goes</p>
        <p className="text-xs text-muted-foreground">
          Fields are matched by name automatically (name, phone, email, zip, project type, square footage, timeline, budget and so on). Anything we do not recognise is still saved on the lead as a form answer, and your assistant reads it. Change a row only when the automatic match is wrong.
        </p>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            No lead has arrived through the webhook yet. Send one, or paste a sample below and press Preview, and its fields will be listed here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Field your form sends</th>
                  <th className="px-3 py-2 font-medium">Example</th>
                  <th className="px-3 py-2 font-medium">Saved as</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-foreground break-all">{r.key}</td>
                    <td className="px-3 py-2 text-muted-foreground break-all">{r.sample || "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Where ${r.key} is saved`}
                        value={map[r.key] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value
                          setSaved(false)
                          setMap((m) => {
                            const next = { ...m }
                            if (v) next[r.key] = v; else delete next[r.key]
                            return next
                          })
                        }}
                        className="h-8 w-full min-w-44 rounded-lg border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Automatic{r.auto ? `: ${targetLabel(config.targets, r.auto)}` : ""}</option>
                        {groups.map((g) => (
                          <optgroup key={g} label={g}>
                            {config.targets.filter((t) => t.group === g).map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" disabled={saving} onClick={save}>
            {saving && <Loader2 className="animate-spin" />} Save mapping
          </Button>
          {saved && <span className="text-xs text-green-700">Saved</span>}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
        {config.lastSample && (
          <p className="text-xs text-muted-foreground">
            Last lead received {new Date(config.lastSample.receivedAt).toLocaleString()} from {config.lastSample.source}.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Try a sample</p>
        <p className="text-xs text-muted-foreground">Paste what your form sends to see how it would be saved. Nothing is created and nobody is texted.</p>
        <Textarea
          value={payload} onChange={(e) => setPayload(e.target.value)} rows={8}
          className="font-mono text-xs" aria-label="Sample lead payload" spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={previewing} onClick={runPreview}>
            {previewing && <Loader2 className="animate-spin" />} Preview
          </Button>
          {previewError && <span className="text-xs text-destructive">{previewError}</span>}
        </div>
        {preview && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <tbody>
                {preview.fields.map((f) => (
                  <tr key={f.key} className="border-t border-border first:border-t-0">
                    <td className="px-3 py-2 font-mono text-foreground break-all">{f.key}</td>
                    <td className="px-3 py-2 text-muted-foreground break-all">{f.value}</td>
                    <td className="px-3 py-2 text-foreground">{targetLabel(config.targets, f.target)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
