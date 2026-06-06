"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Save, X, CheckCircle2, RefreshCw } from "lucide-react"

interface Props {
  companyId: string
  initialName: string
  initialServiceType: string
  initialServiceArea: string
  initialNotificationPhone: string
  avgJobValue: number
}

export function CompanyInfoEditor({ companyId, initialName, initialServiceType, initialServiceArea, initialNotificationPhone, avgJobValue }: Props) {
  const supabase = createClient()
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState("")

  const [name, setName]                   = useState(initialName)
  const [serviceType, setServiceType]     = useState(initialServiceType)
  const [serviceArea, setServiceArea]     = useState(initialServiceArea)
  const [notifPhone, setNotifPhone]       = useState(initialNotificationPhone)
  const [jobValue, setJobValue]           = useState(String(avgJobValue || ""))

  async function handleSave() {
    setError("")
    setSaving(true)
    const { error: err } = await supabase
      .from("companies")
      .update({
        name:               name.trim() || initialName,
        service_type:       serviceType.trim() || initialServiceType,
        service_area:       serviceArea.trim() || initialServiceArea,
        notification_phone: notifPhone.trim() || null,
        avg_job_value:      parseFloat(jobValue) || 0,
      })
      .eq("id", companyId)

    setSaving(false)
    if (err) {
      setError("Failed to save. Please try again.")
      return
    }
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleCancel() {
    setName(initialName)
    setServiceType(initialServiceType)
    setServiceArea(initialServiceArea)
    setNotifPhone(initialNotificationPhone)
    setJobValue(String(avgJobValue || ""))
    setError("")
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        <Row label="Company name"      value={name || "—"} />
        <Row label="Service type"      value={serviceType || "—"} />
        <Row label="Service area"      value={serviceArea || "—"} />
        <Row label="Notification phone" value={notifPhone || "—"} />
        <Row label="Average job value" value={jobValue ? `$${Number(jobValue).toLocaleString()}` : "—"} />
        <div className="flex items-center justify-between pt-1">
          {saved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="gap-1.5 ml-auto"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Field label="Company name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme HVAC" />
      </Field>
      <Field label="Service type">
        <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="HVAC, Roofing, Solar…" />
      </Field>
      <Field label="Service area">
        <Input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="Dallas-Fort Worth, TX" />
      </Field>
      <Field label="Notification phone">
        <Input value={notifPhone} onChange={(e) => setNotifPhone(e.target.value)} placeholder="+1 (555) 000-0000" type="tel" />
      </Field>
      <Field label="Average job value ($)">
        <Input value={jobValue} onChange={(e) => setJobValue(e.target.value)} placeholder="5000" type="number" min="0" />
      </Field>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Saving…</>
            : <><Save className="w-3.5 h-3.5" />Save</>}
        </Button>
        <Button onClick={handleCancel} variant="ghost" size="sm" className="gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
