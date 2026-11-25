"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/job-types"

const EMPTY = { name: "", phone: "", email: "", address: "", jobType: "", notes: "" }

/** Manual lead entry. Creates a record only; the AI does not message the lead. */
export function AddLeadButton({ onAdded }: { onAdded?: (lead: Record<string, unknown>) => void } = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  function close() {
    if (saving) return
    setOpen(false)
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError("Add a name."); return }
    if (!form.phone.trim() && !form.email.trim()) { setError("Add a phone number or an email."); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not add the lead.")
        setSaving(false)
        return
      }
      setForm(EMPTY)
      setOpen(false)
      setSaving(false)
      if (onAdded && data.lead) onAdded(data.lead as Record<string, unknown>)
      else router.refresh()
    } catch {
      setError("Network error. The lead was not added.")
      setSaving(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-[#F97316] hover:bg-[#EA580C] text-white gap-1.5">
        <Plus className="w-4 h-4" /> Add lead
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <form
            onSubmit={submit}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">Add lead</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saved to your pipeline as New. No message is sent.
                </p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={set("name")} placeholder="Jane Smith" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={set("phone")} placeholder="(555) 123-4567" inputMode="tel" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={set("email")} placeholder="jane@email.com" type="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Input value={form.address} onChange={set("address")} placeholder="Where the floors are going" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Job type</Label>
              <select
                value={form.jobType}
                onChange={set("jobType")}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
              >
                <option value="">Not sure yet</option>
                {JOB_TYPES.map(t => <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <textarea
                value={form.notes}
                onChange={set("notes")}
                rows={3}
                placeholder="Rooms, square footage, timing, anything useful"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={saving} className="flex-1 bg-[#F97316] hover:bg-[#EA580C] text-white">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Adding</> : "Add lead"}
              </Button>
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
