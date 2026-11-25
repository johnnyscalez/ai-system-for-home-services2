"use client"

import { useState, useCallback, useMemo } from "react"
import { AnimatePresence } from "framer-motion"
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import Link from "next/link"
import {
  Clock, Zap, DollarSign, CalendarDays, AlertTriangle, FileText, X,
} from "lucide-react"
import { formatDistanceToNow } from "@/lib/utils"
import { CloseDealModal } from "./CloseDealModal"
import {
  QuoteSentDialog, MarkLostDialog, postLeadStatus, postCloseDeal,
} from "./LeadStatusControl"
import { PIPELINE_COLUMNS, pipelineColumnOf, type PipelineColumn } from "@/lib/lead-status"
import { cn } from "@/lib/utils"
import type { Lead } from "@/types/database"

// ─── Date filter ───────────────────────────────────────────────────────────────

type DateFilterKey = "today" | "week" | "month" | "all"

const DATE_FILTERS: { key: DateFilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This week" },
  { key: "month", label: "This month" },
  { key: "all",   label: "All time" },
]

function getDateThreshold(filter: DateFilterKey): string | null {
  const now = new Date()
  if (filter === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  }
  if (filter === "week") {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  if (filter === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }
  return null
}

// A drop that needs one more answer before the status can be saved.
type PendingMove =
  | { kind: "signed"; lead: Lead }
  | { kind: "quote"; lead: Lead }
  | { kind: "lost"; lead: Lead }

function leadName(lead: Lead): string {
  return `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "this lead"
}

// ─── Lead card ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, nowMs, isDragging = false }: { lead: Lead; nowMs: number; isDragging?: boolean }) {
  const twoHoursAgo = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString()
  const isActive = lead.is_active_conversation && !!lead.last_inbound_at && lead.last_inbound_at > twoHoursAgo
  const status = lead.status as string
  const quoteAmount = Number((lead.metadata ?? {}).quote_amount)

  return (
    <div
      className={cn(
        "bg-white border border-[#E7E5E4] rounded-xl p-3 transition-all",
        isDragging
          ? "shadow-2xl rotate-1 border-[#F97316]/30 scale-105"
          : "shadow-sm hover:border-[#F97316]/30 hover:shadow-md"
      )}
      style={{ boxShadow: isDragging ? "0 16px 40px rgba(249,115,22,0.18)" : "0 1px 8px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-[#FFF3EC] flex items-center justify-center text-xs font-bold text-[#EA580C] shrink-0">
          {lead.first_name?.[0] ?? "?"}
        </div>
        <p className="text-sm font-semibold text-[#1A1614] truncate flex-1">
          {leadName(lead) === "this lead" ? "No name yet" : leadName(lead)}
        </p>
      </div>

      {isActive && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
          <Zap className="w-2.5 h-2.5" /> Replying now
        </span>
      )}
      {status === "measure_done" && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 mb-2">
          <FileText className="w-2.5 h-2.5" /> Quote owed
        </span>
      )}
      {status === "quote_sent" && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
          <FileText className="w-2.5 h-2.5" />
          {Number.isFinite(quoteAmount) && quoteAmount > 0 ? `Quote $${quoteAmount.toLocaleString()}` : "Quote sent"}
        </span>
      )}
      {status === "unqualified" && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200 mb-2">
          Unqualified
        </span>
      )}

      {lead.deal_value && (
        <div className="flex items-center gap-1 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-[#16A34A] border border-green-200">
            <DollarSign className="w-2.5 h-2.5" />
            {lead.deal_value.toLocaleString()}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-[10px] text-[#78716C] capitalize">{(lead.source as string) === "whatsapp" ? "text" : lead.source}</span>
        <span className="text-[10px] text-[#78716C] flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {formatDistanceToNow(lead.created_at)}
        </span>
      </div>
    </div>
  )
}

// ─── Draggable wrapper ─────────────────────────────────────────────────────────

function DraggableLead({ lead, nowMs }: { lead: Lead; nowMs: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <Link href={`/leads/${lead.id}`} onClick={e => e.stopPropagation()} className="block">
        <LeadCard lead={lead} nowMs={nowMs} />
      </Link>
    </div>
  )
}

// ─── Droppable column ──────────────────────────────────────────────────────────

function DroppableColumn({ column, leads, nowMs }: { column: PipelineColumn; leads: Lead[]; nowMs: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key })
  const isSignedCol = column.key === "signed"
  const isAttentionCol = column.key === "needs_attention"

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-w-[210px] w-[210px] flex-shrink-0 rounded-xl p-2 flex flex-col transition-all duration-150",
        isOver
          ? isSignedCol
            ? "bg-green-50 ring-2 ring-green-500/40"
            : "bg-[#FFF3EC] ring-2 ring-[#F97316]/30"
          : isAttentionCol && leads.length > 0
            ? "bg-red-50"
            : "bg-[#F5F4F2]"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-2 px-1 shrink-0">
        {isAttentionCol && leads.length > 0
          ? <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
          : <div className={cn("w-2 h-2 rounded-full shrink-0", column.dot)} />}
        <span className={cn("text-xs font-bold truncate flex-1", column.color)}>{column.label}</span>
        <span className="text-[10px] text-[#78716C] bg-white rounded-full px-1.5 py-0.5 border border-[#E7E5E4] shrink-0 tabular-nums">
          {leads.length}
        </span>
      </div>

      {/* Revenue sum for the signed column */}
      {isSignedCol && leads.length > 0 && (
        <div className="mx-1 mb-2 px-2 py-1 bg-green-50 rounded-lg border border-green-200 shrink-0">
          <p className="text-[10px] text-[#16A34A] font-medium font-mono">
            ${leads.reduce((sum, l) => sum + (l.deal_value ?? 0), 0).toLocaleString()} signed
          </p>
        </div>
      )}

      {/* Drop zone hint */}
      {isOver && isSignedCol && (
        <div className="mb-2 mx-1 border-2 border-dashed border-green-500/50 rounded-lg p-2 text-center shrink-0">
          <p className="text-[10px] font-semibold text-green-700">Drop to mark signed</p>
        </div>
      )}

      {/* Scrollable card list, capped so columns do not grow without end */}
      <div className="overflow-y-auto space-y-2 flex-1 pr-0.5" style={{ maxHeight: 300 }}>
        {leads.length === 0 && !isOver ? (
          <div className="border border-dashed border-[#E7E5E4] rounded-lg p-4 text-center text-[10px] text-[#78716C]">
            No leads
          </div>
        ) : (
          leads.map(lead => (
            <DraggableLead key={lead.id} lead={lead} nowMs={nowMs} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main pipeline board ───────────────────────────────────────────────────────

export function PipelineBoard({
  leads,
  onLeadsChange,
  nowMs,
}: {
  leads: Lead[]
  /** The clock as of the last refresh, for the "Replying now" marker */
  nowMs: number
  /** Local update of the shared lead list (optimistic moves and saved rows) */
  onLeadsChange: (updater: (prev: Lead[]) => Lead[]) => void
}) {
  const [activeId, setActiveId]       = useState<string | null>(null)
  const [pending, setPending]         = useState<PendingMove | null>(null)
  const [dateFilter, setDateFilter]   = useState<DateFilterKey>("all")
  const [moveError, setMoveError]     = useState<string | null>(null)
  const [moveNotice, setMoveNotice]   = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  // Apply date filter to pipeline view only
  const filteredLeads = useMemo(() => {
    const threshold = getDateThreshold(dateFilter)
    if (!threshold) return leads
    return leads.filter(l => l.created_at >= threshold)
  }, [leads, dateFilter])

  // Every lead lands in exactly one column: an unknown status falls into "New".
  const leadsByColumn = useMemo(() => {
    const map = new Map<string, Lead[]>()
    for (const col of PIPELINE_COLUMNS) map.set(col.key, [])
    for (const lead of filteredLeads) map.get(pipelineColumnOf(lead.status).key)!.push(lead)
    return map
  }, [filteredLeads])

  const mergeSaved = useCallback((leadId: string, saved: Record<string, unknown>) => {
    onLeadsChange(prev => prev.map(l => l.id === leadId ? { ...l, ...(saved as Partial<Lead>) } : l))
  }, [onLeadsChange])

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
    setMoveError(null)
    setMoveNotice(null)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const leadId = active.id as string
    const target = PIPELINE_COLUMNS.find(c => c.key === over.id)
    const lead   = leads.find(l => l.id === leadId)
    if (!lead || !target) return
    if (pipelineColumnOf(lead.status).key === target.key) return

    // Three columns need one more answer before anything is saved.
    if (target.key === "signed")    { setPending({ kind: "signed", lead }); return }
    if (target.key === "quote_out") { setPending({ kind: "quote", lead });  return }
    if (target.key === "lost")      { setPending({ kind: "lost", lead });   return }

    // Everything else saves at once: move the card now, put it back if the server says no.
    const newStatus = target.dropStatus
    onLeadsChange(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus as Lead["status"] } : l))
    const result = await postLeadStatus(leadId, { status: newStatus })
    if (!result.ok) {
      onLeadsChange(prev => prev.map(l => l.id === leadId ? { ...l, status: lead.status } : l))
      setMoveError(`${leadName(lead)} was not moved. ${result.error}`)
      return
    }
    mergeSaved(leadId, result.lead)
    if (result.warning) setMoveNotice(result.warning)
  }

  async function handleCloseDeal(data: { deal_value: number; closed_job_type: string }) {
    if (pending?.kind !== "signed") return
    const result = await postCloseDeal(pending.lead.id, data)
    if (!result.ok) throw new Error(result.error)
    mergeSaved(pending.lead.id, result.lead)
    setPending(null)
  }

  async function saveStatus(lead: Lead, body: Record<string, unknown>): Promise<string | null> {
    const result = await postLeadStatus(lead.id, body)
    if (!result.ok) return result.error
    mergeSaved(lead.id, result.lead)
    if (result.warning) setMoveNotice(result.warning)
    setPending(null)
    return null
  }

  return (
    <>
      {/* Date filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <CalendarDays className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
        <span className="text-xs text-[#78716C] font-medium shrink-0">Leads from:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DATE_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setDateFilter(f.key)}
              aria-pressed={dateFilter === f.key}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                dateFilter === f.key
                  ? "bg-[#1A1614] text-white border-[#1A1614]"
                  : "bg-white border-[#E7E5E4] text-[#78716C] hover:border-[#1A1614]/40 hover:text-[#1A1614]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#A8A29E] ml-1 tabular-nums">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
        </span>
      </div>

      {(moveError || moveNotice) && (
        <div
          role={moveError ? "alert" : "status"}
          className={cn(
            "mb-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 border",
            moveError ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">{moveError ?? moveNotice}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => { setMoveError(null); setMoveNotice(null) }}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Horizontal scroll, fixed height so it never pushes content below */}
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1" style={{ maxHeight: 420 }}>
          {PIPELINE_COLUMNS.map(col => (
            <DroppableColumn key={col.key} column={col} leads={leadsByColumn.get(col.key) ?? []} nowMs={nowMs} />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
          {activeLead && <LeadCard lead={activeLead} nowMs={nowMs} isDragging />}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {pending?.kind === "signed" && (
          <CloseDealModal
            leadName={leadName(pending.lead)}
            onConfirm={handleCloseDeal}
            onCancel={() => setPending(null)}
          />
        )}
      </AnimatePresence>

      {pending?.kind === "quote" && (
        <QuoteStageDialog
          lead={pending.lead}
          onCancel={() => setPending(null)}
          onMeasureDone={() => saveStatus(pending.lead, { status: "measure_done" })}
          onQuoteSent={(amount) => saveStatus(pending.lead, { status: "quote_sent", ...(amount ? { quoteAmount: amount } : {}) })}
        />
      )}

      {pending?.kind === "lost" && (
        <MarkLostDialog
          open
          leadName={leadName(pending.lead)}
          status="lost"
          onCancel={() => setPending(null)}
          onConfirm={() => saveStatus(pending.lead, { status: "lost" })}
        />
      )}
    </>
  )
}

// Dropping on "Quote out" covers two different facts: the measure happened and
// the quote is still owed, or the quote already went out. Ask which.
function QuoteStageDialog({
  lead, onCancel, onMeasureDone, onQuoteSent,
}: {
  lead: Lead
  onCancel: () => void
  onMeasureDone: () => Promise<string | null>
  onQuoteSent: (amount: number | null) => Promise<string | null>
}) {
  const [step, setStep] = useState<"choose" | "quote">("choose")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (step === "quote") {
    return (
      <QuoteSentDialog
        open
        leadName={leadName(lead)}
        onCancel={onCancel}
        onConfirm={onQuoteSent}
      />
    )
  }

  async function measureDone() {
    setSaving(true)
    setError(null)
    const failure = await onMeasureDone()
    setSaving(false)
    if (failure) setError(failure)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onCancel()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Where is this lead in the quote stage"
        className="relative bg-white rounded-xl shadow-xl border border-[#E7E5E4] w-full max-w-sm p-5 space-y-4"
      >
        <div>
          <h3 className="font-semibold text-base text-[#1A1614]">Where is {leadName(lead)}?</h3>
          <p className="text-xs text-[#78716C] mt-1">The measure is behind them. Has the quote gone out yet?</p>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={measureDone}
            className="text-left rounded-lg border border-[#E7E5E4] hover:border-[#1A1614]/40 px-3 py-2.5 transition-colors disabled:opacity-60"
          >
            <p className="text-sm font-medium text-[#1A1614]">Measure done, quote still owed</p>
            <p className="text-[11px] text-[#78716C] mt-0.5">No messages go out. The lead waits here until the quote is sent.</p>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setStep("quote")}
            className="text-left rounded-lg border border-[#E7E5E4] hover:border-[#1A1614]/40 px-3 py-2.5 transition-colors disabled:opacity-60"
          >
            <p className="text-sm font-medium text-[#1A1614]">Quote sent</p>
            <p className="text-[11px] text-[#78716C] mt-0.5">The assistant starts checking in on the quote.</p>
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button type="button" onClick={onCancel} disabled={saving} className="text-xs text-[#78716C] hover:text-[#1A1614] px-2 py-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
