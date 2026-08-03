"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Loader2, X, Check, AlertTriangle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  leadId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string
  address: string | null
  /** true when this lead is already linked to a Housecall Pro customer */
  syncedToHcp?: boolean
}

/**
 * Edit a lead's identity from the lead detail page — available in BOTH product
 * modes. The AI can't always capture a name (Messenger profile lookups need
 * Meta Advanced Access; some leads never say it), and a nameless lead reaches
 * Housecall Pro as "Unknown", which is what the technician then sees.
 */
export function EditLeadDetails({
  leadId, firstName, lastName, email, phone, address, syncedToHcp,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isPlaceholder = phone.startsWith("msgr:") || phone.startsWith("fbform:")
  const [form, setForm] = useState({
    first_name: firstName ?? "",
    last_name: lastName ?? "",
    email: email ?? "",
    phone: isPlaceholder ? "" : phone,
    address: address ?? "",
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, string> = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        address: form.address,
      }
      // Only send phone when the user actually typed one — an empty field must
      // never wipe a good number or overwrite a placeholder with junk.
      if (form.phone.trim()) payload.phone = form.phone

      const res = await fetch(`/api/leads/${leadId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Could not save")
      setSaved(true)
      router.refresh()
      setTimeout(() => { setOpen(false); setSaved(false) }, 900)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
              className="w-full max-w-md rounded-xl bg-white shadow-xl border border-border p-5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base">Edit lead details</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {syncedToHcp
                      ? "Saving also updates this customer in Housecall Pro."
                      : "Used on the appointment, confirmations, and the technician's job."}
                  </p>
                </div>
                <button onClick={() => !saving && setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">First name</span>
                  <Input value={form.first_name} onChange={set("first_name")} placeholder="Mourad" autoFocus />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Last name</span>
                  <Input value={form.last_name} onChange={set("last_name")} placeholder="Surname" />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <Input value={form.email} onChange={set("email")} placeholder="name@example.com" type="email" />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Phone {isPlaceholder && <span className="text-amber-600">— not collected yet</span>}
                </span>
                <Input value={form.phone} onChange={set("phone")} placeholder="+1 312 555 0134" />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Service address</span>
                <Input value={form.address} onChange={set("address")} placeholder="123 Main St, City, IL 60614" />
              </label>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving || saved}>
                  {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
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
