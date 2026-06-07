"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2, AlertTriangle, RotateCcw, DollarSign, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  leadId: string
  leadName: string
  leadStatus: string
  dealValue?: number | null
  refundAmount?: number | null
  redirectAfter?: boolean
}

export function DeleteLeadButton({
  leadId,
  leadName,
  leadStatus,
  dealValue,
  refundAmount,
  redirectAfter = false,
}: Props) {
  const router = useRouter()
  const isClosed = ["closed", "closed_won"].includes(leadStatus)

  // ── Delete state ──
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── Refund state ──
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundInput, setRefundInput] = useState(
    refundAmount != null && refundAmount > 0 ? String(refundAmount) : ""
  )
  const [refundNote, setRefundNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [refundError, setRefundError] = useState("")

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/leads/${leadId}/delete`, { method: "DELETE" })
      if (redirectAfter) {
        router.push("/leads")
      } else {
        router.refresh()
      }
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  async function handleRefund() {
    const amount = parseFloat(refundInput)
    if (isNaN(amount) || amount < 0) {
      setRefundError("Enter a valid refund amount.")
      return
    }
    const max = Number(dealValue) || 0
    if (amount > max) {
      setRefundError(`Cannot exceed the deal value of $${max.toLocaleString()}.`)
      return
    }
    setSaving(true)
    setRefundError("")
    try {
      const res = await fetch(`/api/leads/${leadId}/refund`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refund_amount: amount, refund_note: refundNote || null }),
      })
      const data = await res.json()
      if (!res.ok) { setRefundError(data.error ?? "Failed to save refund."); return }
      setShowRefundModal(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // ── Closed lead: show Refund only, no delete ──
  if (isClosed) {
    const currentRefund = Number(refundAmount) || 0
    const hasRefund = currentRefund > 0

    return (
      <>
        <button
          onClick={() => {
            setRefundInput(hasRefund ? String(currentRefund) : "")
            setRefundNote("")
            setRefundError("")
            setShowRefundModal(true)
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-600 border border-border hover:border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {hasRefund ? `Refund ($${currentRefund.toLocaleString()})` : "Refund"}
        </button>

        {/* Refund modal */}
        <AnimatePresence>
          {showRefundModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setShowRefundModal(false)}
            >
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-[#E7E5E4]"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4] bg-amber-50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1C1917]">Issue Refund</p>
                      <p className="text-xs text-[#78716C]">{leadName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRefundModal(false)}
                    className="text-[#78716C] hover:text-[#1C1917] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 py-5 space-y-4">
                  {/* Deal value context */}
                  <div className="bg-[#FAFAF8] rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[#78716C]">Original deal value</span>
                    <span className="text-sm font-bold text-[#4D7C0F]">
                      ${(Number(dealValue) || 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Refund amount */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1C1917]">
                      Refund amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                      <Input
                        type="number"
                        min="0"
                        max={Number(dealValue) || undefined}
                        step="1"
                        value={refundInput}
                        onChange={e => setRefundInput(e.target.value)}
                        placeholder="0"
                        autoFocus
                        className="pl-9 h-10 text-base font-bold border-[#E7E5E4] focus:border-amber-400 focus:ring-amber-400/20"
                      />
                    </div>
                    <p className="text-xs text-[#78716C]">
                      Can be partial or full. Net revenue after refund:{" "}
                      <span className="font-semibold text-[#1C1917]">
                        ${Math.max(0, (Number(dealValue) || 0) - (parseFloat(refundInput) || 0)).toLocaleString()}
                      </span>
                    </p>
                  </div>

                  {/* Note */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1C1917]">
                      Reason <span className="text-[#78716C] font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={refundNote}
                      onChange={e => setRefundNote(e.target.value)}
                      placeholder="e.g. Customer requested partial refund due to incomplete work"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-[#E7E5E4] rounded-lg bg-white text-[#1C1917] resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  </div>

                  {refundError && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{refundError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#E7E5E4]"
                      onClick={() => setShowRefundModal(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
                      onClick={handleRefund}
                      disabled={saving || !refundInput}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      {saving ? "Saving…" : "Save refund"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  // ── Non-closed lead: show Delete ──
  if (confirmingDelete) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Delete <span className="font-semibold">{leadName}</span>? This can&apos;t be undone.</span>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Yes, delete
        </button>
        <button
          onClick={() => setConfirmingDelete(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirmingDelete(true)}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 border border-border hover:border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Delete
    </button>
  )
}
