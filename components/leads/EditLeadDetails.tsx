"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Loader2, X, Check, AlertTriangle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/job-types"
import { hasRealPhone } from "@/lib/lead-status"

interface Props {
  leadId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string
  address: string | null
  zip: string | null
  jobType: string | null
  notes: string | null
  /** true when this lead is already linked to a Housecall Pro customer */
  syncedToHcp?: boolean
  /** Called with the saved lead row so the page can update without a reload */
  onSaved?: (lead: Record<string, unknown>) => void
}

/**
 * Edit a lead from the lead detail page: who they are, where the floors are
 * going, what the job is, and the notes. The AI fills most of this in as it
 * learns it, but a person must always be able to correct it by hand.
 */
export function EditLeadDetails({
  leadId, firstName, lastName, email, phone, address, zip, jobType, notes, syncedToHcp, onSaved,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // msgr:<psid>, fbform:<id>, manual:<uuid> are internal placeholders, not numbers.
  const noPhoneOnFile = !hasRealPhone(phone)
  const initialForm = () => ({
    first_name: firstName ?? "",
    last_name: lastName ?? "",
    email: email ?? "",
    phone: noPhoneOnFile ? "" : phone,
    address: address ?? "",
    zip: zip ?? "",
    job_type: jobType ?? "",
    notes: notes ?? "",
  })
  const [form, setForm] = useState(initialForm)
  // What the form held when the dialog opened: the reference for "what changed".
  const [baseline, setBaseline] = useState(initialForm)

  const set = (k: keyof ReturnType<typeof initialForm>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  function openDialog() {
    // Start from the live values every time: the AI may have filled fields in
    // since this page was opened.
    const fresh = initialForm()
    setForm(fresh)
    setBaseline(fresh)
    setError(null)
    setSaved(false)
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // Send only what the person changed. The AI writes to this record while
      // the dialog is open (notes, job type, address), and re-sending untouched
      // fields would overwrite what it just saved.
      const payload: Record<string, string> = {}
      for (const k of ["first_name", "last_name", "email", "address", "zip", "job_type", "notes"] as const) {
        if (form[k].trim() !== baseline[k].trim()) payload[k] = form[k]
      }
      // Phone is only sent when a number was typed AND it differs from the one
      // on file: an empty field must never wipe a good number, and a
      // placeholder is never sent back.
      const typedPhone = form.phone.trim()
      if (typedPhone && typedPhone !== phone) payload.phone = typedPhone

      if (Object.keys(payload).length === 0) {
        setOpen(false)
        return
      }

      const res = await fetch(`/api/leads/${leadId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Could not save")
      setSaved(true)
      if (onSaved && data.lead) onSaved(data.lead as Record<string, unknown>)
      else router.refresh()
      setTimeout(() => { setOpen(false); setSaved(false) }, 700)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="w-3 h-3" />
        Edit details
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => !saving && setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Edit lead details"
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl border border-border p-5 space-y-4 text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base">Edit lead details</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {syncedToHcp
                      ? "Saving also updates this customer in Housecall Pro."
                      : "Used on the measure, the confirmations and the quote."}
                  </p>
                </div>
                <button type="button" aria-label="Close" onClick={() => !saving && setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">First name</span>
                  <Input value={form.first_name} onChange={set("first_name")} placeholder="Jane" autoFocus />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Last name</span>
                  <Input value={form.last_name} onChange={set("last_name")} placeholder="Smith" />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <Input value={form.email} onChange={set("email")} placeholder="name@example.com" type="email" />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Phone {noPhoneOnFile && <span className="text-amber-600">(none on file)</span>}
                </span>
                <Input value={form.phone} onChange={set("phone")} placeholder="+1 312 555 0134" inputMode="tel" />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Street address</span>
                <Input value={form.address} onChange={set("address")} placeholder="123 Main St, City, IL" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">ZIP code</span>
                  <Input value={form.zip} onChange={set("zip")} placeholder="60614" maxLength={5} inputMode="numeric" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Job type</span>
                  <select
                    value={form.job_type}
                    onChange={set("job_type")}
                    className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
                  >
                    <option value="">Not set</option>
                    {JOB_TYPES.map((t) => <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>)}
                    {/* A value written before the flooring list existed stays selectable until changed */}
                    {form.job_type && !(JOB_TYPES as readonly string[]).includes(form.job_type) && (
                      <option value={form.job_type} disabled>{form.job_type}</option>
                    )}
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Notes</span>
                <Textarea
                  value={form.notes}
                  onChange={set("notes")}
                  rows={4}
                  placeholder="Rooms, square footage, timing, anything the team should know"
                  className="text-sm resize-y"
                />
              </label>

              {error && (
                <div role="alert" className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving || saved}>
                  {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving</>
                    : saved ? <><Check className="w-3.5 h-3.5 mr-1.5" />Saved</>
                    : "Save changes"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
