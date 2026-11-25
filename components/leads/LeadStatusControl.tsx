"use client"

// Moving a lead through the pipeline by hand: the status select on the lead
// page, the "Measure done / Quote sent / Signed / Lost" buttons, and the two
// small dialogs they share with the pipeline board (quote amount, mark lost).
// Every change goes through /api/leads/[id]/status (or /close for a signed
// deal), which owns the side effects: the quote chase starts on "Quote sent"
// and every follow-up stops on "Signed" and "Lost".

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import { Ruler, FileText, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { CloseDealModal } from "@/components/leads/CloseDealModal"
import {
  MANUAL_STATUS_OPTIONS, getLeadStatus, isSignedStatus, manualStatusFor, pipelineColumnOf,
} from "@/lib/lead-status"
import { cn } from "@/lib/utils"

export type StatusLead = {
  id: string
  status: string
  first_name: string | null
  last_name: string | null
  phone: string
  metadata?: Record<string, unknown> | null
}

type StatusResult =
  | { ok: true; lead: Record<string, unknown>; warning: string | null }
  | { ok: false; error: string }

/** POST a hand-set status. Never throws: the caller gets the lead row or a message to show. */
export async function postLeadStatus(leadId: string, body: Record<string, unknown>): Promise<StatusResult> {
  try {
    const res = await fetch(`/api/leads/${leadId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as
      | { lead?: Record<string, unknown>; warning?: string | null; error?: string }
      | null
    if (!res.ok || !data?.lead) {
      return { ok: false, error: data?.error ?? `The status was not saved (server answered ${res.status}).` }
    }
    return { ok: true, lead: data.lead, warning: data.warning ?? null }
  } catch {
    return { ok: false, error: "Could not reach the server. The status was not saved." }
  }
}

/** Record a signed deal. Never throws. */
export async function postCloseDeal(
  leadId: string,
  data: { deal_value: number; closed_job_type: string }
): Promise<StatusResult> {
  try {
    const res = await fetch(`/api/leads/${leadId}/close`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = (await res.json().catch(() => null)) as { lead?: Record<string, unknown>; error?: string } | null
    if (!res.ok || !json?.lead) {
      return { ok: false, error: json?.error ?? `The deal was not saved (server answered ${res.status}).` }
    }
    return { ok: true, lead: json.lead, warning: null }
  } catch {
    return { ok: false, error: "Could not reach the server. The deal was not saved." }
  }
}

function leadDisplayName(lead: StatusLead): string {
  return `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "this lead"
}

// ── Quote sent dialog ────────────────────────────────────────────────────────

export function QuoteSentDialog({
  open, leadName, initialAmount, onCancel, onConfirm,
}: {
  open: boolean
  leadName: string
  initialAmount?: number | null
  onCancel: () => void
  /** Resolves with an error message to show, or null when saved */
  onConfirm: (quoteAmount: number | null) => Promise<string | null>
}) {
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = amount.trim()
    let value: number | null = null
    if (trimmed) {
      value = Number(trimmed.replace(/[$,\s]/g, ""))
      if (!Number.isFinite(value) || value <= 0) {
        setError("Enter the quote amount as a number, for example 8400.")
        return
      }
    }
    setSaving(true)
    setError(null)
    const failure = await onConfirm(value)
    setSaving(false)
    if (failure) setError(failure)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onCancel() }}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Quote sent to {leadName}</DialogTitle>
            <DialogDescription>
              From here the assistant checks in on the quote over the next 30 days, until they sign or say no.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="quote-amount" className="text-xs">Quote amount (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="quote-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="8400"
                className="pl-7 font-mono"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Kept on the lead for your own tracking. The assistant never states a price.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving</> : "Mark quote sent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Mark lost dialog ─────────────────────────────────────────────────────────

export function MarkLostDialog({
  open, leadName, status, onCancel, onConfirm,
}: {
  open: boolean
  leadName: string
  /** "lost" or "unqualified" */
  status: string
  onCancel: () => void
  onConfirm: () => Promise<string | null>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unqualified = status === "unqualified"

  async function confirm() {
    setSaving(true)
    setError(null)
    const failure = await onConfirm()
    setSaving(false)
    if (failure) setError(failure)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onCancel() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{unqualified ? `Mark ${leadName} as unqualified?` : `Mark ${leadName} as lost?`}</DialogTitle>
          <DialogDescription>
            Every scheduled follow-up to this lead stops. You can move them back to an earlier stage later.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-xs text-red-600 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Keep working it</Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving</> : unqualified ? "Mark unqualified" : "Mark lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── The controller: one place that runs every hand-set status change ─────────

type Pending =
  | { kind: "quote" }
  | { kind: "lost"; status: string }
  | { kind: "signed" }
  | null

/**
 * Shared logic for the select and the buttons. `request(status)` either applies
 * the status at once or opens the dialog it needs first.
 */
export function useLeadStatusActions(
  lead: StatusLead,
  onLeadChange: (lead: Record<string, unknown>) => void
) {
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function apply(status: string, extra: Record<string, unknown> = {}): Promise<string | null> {
    setBusy(status)
    setError(null)
    setNotice(null)
    const result = await postLeadStatus(lead.id, { status, ...extra })
    setBusy(null)
    if (!result.ok) return result.error
    onLeadChange(result.lead)
    if (result.warning) setNotice(result.warning)
    return null
  }

  async function request(status: string) {
    if (status === lead.status) return
    if (status === "quote_sent") { setPending({ kind: "quote" }); return }
    if (status === "closed_won") { setPending({ kind: "signed" }); return }
    if (status === "lost" || status === "unqualified") { setPending({ kind: "lost", status }); return }
    const failure = await apply(status)
    if (failure) setError(failure)
  }

  const name = leadDisplayName(lead)
  const quoteAmount = Number((lead.metadata ?? {}).quote_amount)

  const dialogs = (
    <>
      {/* Keyed so each opening starts from a clean form */}
      {pending?.kind === "quote" && (
        <QuoteSentDialog
          open
          leadName={name}
          initialAmount={Number.isFinite(quoteAmount) && quoteAmount > 0 ? quoteAmount : null}
          onCancel={() => setPending(null)}
          onConfirm={async (amount) => {
            const failure = await apply("quote_sent", amount ? { quoteAmount: amount } : {})
            if (!failure) setPending(null)
            return failure
          }}
        />
      )}
      {pending?.kind === "lost" && (
        <MarkLostDialog
          open
          leadName={name}
          status={pending.status}
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            const failure = await apply(pending.status)
            if (!failure) setPending(null)
            return failure
          }}
        />
      )}
      <AnimatePresence>
        {pending?.kind === "signed" && (
          <CloseDealModal
            leadName={name}
            onCancel={() => setPending(null)}
            onConfirm={async (data) => {
              const result = await postCloseDeal(lead.id, data)
              if (!result.ok) throw new Error(result.error)
              onLeadChange(result.lead)
              setPending(null)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )

  return { request, busy, error, notice, dialogs }
}

// ── Status select (lead page header) ─────────────────────────────────────────

export function LeadStatusControl({
  lead, onLeadChange,
}: {
  lead: StatusLead
  onLeadChange: (lead: Record<string, unknown>) => void
}) {
  const { request, busy, error, notice, dialogs } = useLeadStatusActions(lead, onLeadChange)
  const current = manualStatusFor(lead.status)
  const meta = getLeadStatus(lead.status)

  return (
    <div className="flex flex-col items-end gap-1">
      <Select
        value={current}
        onValueChange={(value) => { if (typeof value === "string") void request(value) }}
        disabled={!!busy}
      >
        <SelectTrigger
          size="sm"
          aria-label="Lead status"
          className={cn("text-xs font-medium gap-1.5 border", meta.badge)}
        >
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
          <SelectValue>{() => meta.label}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {MANUAL_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className={cn("w-1.5 h-1.5 rounded-full", pipelineColumnOf(option.value).dot)} />
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p role="alert" className="text-[11px] text-red-600 max-w-[16rem] text-right">{error}</p>}
      {notice && <p role="status" className="text-[11px] text-amber-700 max-w-[16rem] text-right">{notice}</p>}
      {dialogs}
    </div>
  )
}

// ── Next step buttons (lead page side panel) ─────────────────────────────────

export function LeadNextSteps({
  lead, onLeadChange,
}: {
  lead: StatusLead
  onLeadChange: (lead: Record<string, unknown>) => void
}) {
  const { request, busy, error, notice, dialogs } = useLeadStatusActions(lead, onLeadChange)
  const status = lead.status
  const signed = isSignedStatus(status)
  const lost = ["lost", "closed_lost", "unqualified"].includes(status)

  const showMeasureDone = status === "appointment_booked"
  const showQuoteSent = status === "appointment_booked" || status === "measure_done"
  const showSigned = ["appointment_booked", "measure_done", "quote_sent"].includes(status)
  const showLost = !signed && !lost

  if (!showMeasureDone && !showQuoteSent && !showSigned && !showLost) return <>{dialogs}</>

  const hint =
    status === "appointment_booked" ? "After the visit, mark the measure done so the quote does not get forgotten."
    : status === "measure_done" ? "The measure is done and the quote is owed. Mark it sent to start the follow-ups."
    : status === "quote_sent" ? "The assistant is following up on the quote."
    : null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next step</p>
      {hint && <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
      <div className="grid grid-cols-2 gap-2">
        {showMeasureDone && (
          <Button variant="outline" size="sm" className="gap-1.5 justify-start" disabled={!!busy} onClick={() => request("measure_done")}>
            {busy === "measure_done" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ruler className="w-3.5 h-3.5" />}
            Measure done
          </Button>
        )}
        {showQuoteSent && (
          <Button variant="outline" size="sm" className="gap-1.5 justify-start" disabled={!!busy} onClick={() => request("quote_sent")}>
            <FileText className="w-3.5 h-3.5" />
            Quote sent
          </Button>
        )}
        {showSigned && (
          <Button variant="outline" size="sm" className="gap-1.5 justify-start text-green-700 hover:text-green-800" disabled={!!busy} onClick={() => request("closed_won")}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Signed
          </Button>
        )}
        {showLost && (
          <Button variant="outline" size="sm" className="gap-1.5 justify-start text-muted-foreground" disabled={!!busy} onClick={() => request("lost")}>
            <XCircle className="w-3.5 h-3.5" />
            Lost
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-[11px] text-red-600">{error}</p>}
      {notice && <p role="status" className="text-[11px] text-amber-700">{notice}</p>}
      {dialogs}
    </div>
  )
}
