"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, DollarSign, Wrench, ChevronDown, Loader2, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { FLOORING_JOB_TYPE_LABELS } from "@/lib/job-types"

type Props = {
  leadName: string
  onConfirm: (data: {
    deal_value: number
    closed_job_type: string
  }) => Promise<void>
  onCancel: () => void
}

export function CloseDealModal({ leadName, onConfirm, onCancel }: Props) {
  const [amount, setAmount]         = useState("")
  const [jobType, setJobType]       = useState("")
  const [jobOpen, setJobOpen]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Enter a valid deal amount.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm({
        deal_value: Number(amount),
        closed_job_type: jobType,
      })
    } catch (err) {
      // Show what the server said (the caller throws its message), not a generic line.
      setError(err instanceof Error && err.message ? err.message : "The deal was not saved. Try again.")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: "0 24px 64px rgba(22,163,74,0.18), 0 4px 16px rgba(0,0,0,0.08)" }}
      >
        {/* Green header bar */}
        <div className="bg-[#16A34A] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-base" style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Mark as signed
                </p>
                <p className="text-white/70 text-xs">{leadName}</p>
              </div>
            </div>
            <button onClick={onCancel} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Deal amount */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1C1917]">
              Deal amount <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#16A34A]" />
              <Input
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="pl-9 h-11 text-lg font-bold border-[#E7E5E4] focus:border-[#16A34A] focus:ring-[#16A34A]/20"
                autoFocus
              />
            </div>
          </div>

          {/* Job type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5">
              <Wrench className="w-3 h-3 text-[#78716C]" /> Job type
            </Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setJobOpen(v => !v)}
                className={cn(
                  "w-full flex items-center justify-between px-3 h-10 rounded-lg border text-sm transition-colors",
                  jobType ? "text-[#1C1917]" : "text-[#78716C]",
                  jobOpen ? "border-[#16A34A] ring-1 ring-[#16A34A]/20" : "border-[#E7E5E4] hover:border-[#16A34A]/40"
                )}
              >
                {jobType || "Select job type"}
                <ChevronDown className={cn("w-4 h-4 text-[#78716C] transition-transform", jobOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {jobOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E7E5E4] rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto"
                  >
                    {FLOORING_JOB_TYPE_LABELS.map(t => (
                      <button
                        key={t} type="button"
                        onClick={() => { setJobType(t); setJobOpen(false) }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-[#16A34A]/8 transition-colors",
                          jobType === t && "bg-[#16A34A]/10 text-[#16A34A] font-medium"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 h-11 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Mark signed</>}
            </Button>
            <Button variant="outline" onClick={onCancel} className="h-11 px-5">
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
