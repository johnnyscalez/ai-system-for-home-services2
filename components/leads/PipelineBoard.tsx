"use client"

import { useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import Link from "next/link"
import {
  Clock, Zap, MessageSquare, DollarSign, HardHat, CalendarDays,
} from "lucide-react"
import { formatDistanceToNow } from "@/lib/utils"
import { CloseDealModal } from "./CloseDealModal"
import { cn } from "@/lib/utils"
import type { Lead } from "@/types/database"

// ─── Column config ─────────────────────────────────────────────────────────────

const PIPELINE_COLUMNS = [
  { key: "just_came_in",        statuses: ["just_came_in", "new", "contacted"],                label: "Just came in",            color: "text-sky-500",     dot: "bg-sky-500",     bg: "bg-sky-500/5" },
  { key: "following_up",        statuses: ["following_up"],                                     label: "No Reply – Following Up", color: "text-orange-500",  dot: "bg-orange-500",  bg: "bg-orange-500/5" },
  { key: "active_conversation", statuses: ["active_conversation", "followed_up", "nurturing"],  label: "Active conversation",     color: "text-[#F97316]",   dot: "bg-[#F97316]",   bg: "bg-[#F97316]/5" },
  { key: "qualified",           statuses: ["qualified"],                                         label: "Qualified",               color: "text-amber-500",   dot: "bg-amber-500",   bg: "bg-amber-500/5" },
  { key: "unqualified",         statuses: ["unqualified"],                                       label: "Unqualified",             color: "text-red-400",     dot: "bg-red-400",     bg: "bg-red-400/5" },
  { key: "appointment_booked",  statuses: ["appointment_booked"],                                label: "Appointment",             color: "text-emerald-500", dot: "bg-emerald-500", bg: "bg-emerald-500/5" },
  { key: "closed",              statuses: ["closed", "closed_won"],                             label: "Closed ✓",                color: "text-green-600",   dot: "bg-green-500",   bg: "bg-green-500/8" },
  { key: "lost",                statuses: ["lost", "cold", "closed_lost"],                      label: "Lost",                    color: "text-slate-400",   dot: "bg-slate-400",   bg: "bg-slate-400/5" },
]

const COLUMN_STATUS_MAP: Record<string, string> = {
  just_came_in:        "just_came_in",
  following_up:        "following_up",
  active_conversation: "active_conversation",
  qualified:           "qualified",
  unqualified:         "unqualified",
  appointment_booked:  "appointment_booked",
  closed:              "closed_won",
  lost:                "lost",
}

// ─── Date filter ───────────────────────────────────────────────────────────────

type DateFilterKey = "today" | "week" | "month" | "all"

const DATE_FILTERS: { key: DateFilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all",   label: "All Time" },
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

// ─── Types ─────────────────────────────────────────────────────────────────────

type Technician  = { id: string; name: string }
type PendingClose = {
  lead: Lead
  prefilledTechId: string | null
  prefilledTechName: string | null
}

// ─── Lead card ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, isDragging = false }: { lead: Lead; isDragging?: boolean }) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const isActive = lead.is_active_conversation && !!lead.last_inbound_at && lead.last_inbound_at > twoHoursAgo

  return (
    <div
      className={cn(
        "bg-white border border-[#E7E5E4] rounded-xl p-3 transition-all",
        isDragging
          ? "shadow-2xl rotate-1 border-[#7C3AED]/30 scale-105"
          : "shadow-sm hover:border-[#7C3AED]/30 hover:shadow-md"
      )}
      style={{ boxShadow: isDragging ? "0 16px 40px rgba(124,58,237,0.18)" : "0 1px 8px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED]/20 to-[#7C3AED]/10 flex items-center justify-center text-xs font-bold text-[#7C3AED] shrink-0">
          {lead.first_name?.[0] ?? "?"}
        </div>
        <p className="text-sm font-semibold text-[#1C1917] truncate flex-1">
          {lead.first_name} {lead.last_name}
        </p>
      </div>

      {isActive && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 mb-2">
          <Zap className="w-2.5 h-2.5" /> Active
        </span>
      )}
      {lead.status === "following_up" && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-500 border border-orange-500/20 mb-2">
          <MessageSquare className="w-2.5 h-2.5" /> Following up
        </span>
      )}

      {lead.deal_value && (
        <div className="flex items-center gap-1 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-700 border border-green-500/20">
            <DollarSign className="w-2.5 h-2.5" />
            {lead.deal_value.toLocaleString()}
          </span>
        </div>
      )}
      {lead.closed_technician_name && (
        <div className="flex items-center gap-1 mb-1">
          <HardHat className="w-2.5 h-2.5 text-[#78716C]" />
          <span className="text-[10px] text-[#78716C]">{lead.closed_technician_name}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-[10px] text-[#78716C] capitalize">{lead.source}</span>
        <span className="text-[10px] text-[#78716C] flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {formatDistanceToNow(lead.created_at)}
        </span>
      </div>
    </div>
  )
}

// ─── Draggable wrapper ─────────────────────────────────────────────────────────

function DraggableLead({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <Link href={`/leads/${lead.id}`} onClick={e => e.stopPropagation()} className="block">
        <LeadCard lead={lead} />
      </Link>
    </div>
  )
}

// ─── Droppable column ──────────────────────────────────────────────────────────

function DroppableColumn({
  colKey, label, color, dot, leads,
}: {
  colKey: string; label: string; color: string; dot: string; leads: Lead[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey })
  const isClosedCol = colKey === "closed"

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-w-[210px] w-[210px] flex-shrink-0 rounded-xl p-2 flex flex-col transition-all duration-150",
        isOver
          ? isClosedCol
            ? "bg-green-500/15 ring-2 ring-green-500/40"
            : "bg-[#7C3AED]/8 ring-2 ring-[#7C3AED]/30"
          : "bg-[#F5F4F2]"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-2 px-1 shrink-0">
        <div className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
        <span className={cn("text-xs font-bold truncate flex-1", color)}>{label}</span>
        <span className="text-[10px] text-[#78716C] bg-white rounded-full px-1.5 py-0.5 border border-[#E7E5E4] shrink-0">
          {leads.length}
        </span>
      </div>

      {/* Revenue sum for closed column */}
      {isClosedCol && leads.length > 0 && (
        <div className="mx-1 mb-2 px-2 py-1 bg-green-500/10 rounded-lg border border-green-500/20 shrink-0">
          <p className="text-[10px] text-green-700 font-medium">
            ${leads.reduce((sum, l) => sum + (l.deal_value ?? 0), 0).toLocaleString()} closed
          </p>
        </div>
      )}

      {/* Drop zone hint */}
      {isOver && isClosedCol && (
        <div className="mb-2 mx-1 border-2 border-dashed border-green-500/50 rounded-lg p-2 text-center shrink-0">
          <p className="text-[10px] font-semibold text-green-600">Drop to close deal</p>
        </div>
      )}

      {/* Scrollable card list — capped height so columns don't grow infinitely */}
      <div className="overflow-y-auto space-y-2 flex-1 pr-0.5" style={{ maxHeight: 300 }}>
        {leads.length === 0 && !isOver ? (
          <div className="border border-dashed border-[#E7E5E4] rounded-lg p-4 text-center text-[10px] text-[#78716C]">
            No leads
          </div>
        ) : (
          leads.map(lead => (
            <DraggableLead key={lead.id} lead={lead} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main pipeline board ───────────────────────────────────────────────────────

export function PipelineBoard({
  initialLeads,
  technicians,
}: {
  initialLeads: Lead[]
  technicians: Technician[]
}) {
  const [leads, setLeads]               = useState<Lead[]>(initialLeads)
  const [activeId, setActiveId]         = useState<string | null>(null)
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null)
  const [dateFilter, setDateFilter]     = useState<DateFilterKey>("all")

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

  const getColumnLeads = useCallback(
    (statuses: string[]) => filteredLeads.filter(l => statuses.includes(l.status)),
    [filteredLeads]
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const leadId      = active.id as string
    const targetColKey = over.id as string
    const lead        = leads.find(l => l.id === leadId)
    if (!lead) return

    const currentCol = PIPELINE_COLUMNS.find(c => c.statuses.includes(lead.status))
    if (currentCol?.key === targetColKey) return

    if (targetColKey === "closed") {
      const apt = await fetch(`/api/appointments/by-lead/${leadId}`).then(r => r.ok ? r.json() : null).catch(() => null)
      const aptData = apt?.appointment
      setPendingClose({
        lead,
        prefilledTechId:   aptData?.technician_id   ?? null,
        prefilledTechName: aptData?.technician_name ?? null,
      })
      return
    }

    const newStatus = COLUMN_STATUS_MAP[targetColKey]
    if (!newStatus) return

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus as Lead["status"] } : l))

    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch {
      setLeads(prev => prev.map(l => l.id === leadId ? lead : l))
    }
  }

  async function handleCloseDeal(data: {
    deal_value: number
    closed_job_type: string
    closed_technician_id: string | null
    closed_technician_name: string | null
  }) {
    if (!pendingClose) return
    const leadId = pendingClose.lead.id

    const res = await fetch(`/api/leads/${leadId}/close`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed")
    const { lead: updated } = await res.json()

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updated } : l))
    setPendingClose(null)
  }

  return (
    <>
      {/* Date filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <CalendarDays className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
        <span className="text-xs text-[#78716C] font-medium shrink-0">Period:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DATE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                dateFilter === f.key
                  ? "bg-[#F97316] text-white border-[#F97316] shadow-sm"
                  : "bg-white border-[#E7E5E4] text-[#78716C] hover:border-[#F97316]/50 hover:text-[#F97316]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#A8A29E] ml-1">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
        </span>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Horizontal scroll, fixed height so it never pushes content below */}
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1" style={{ maxHeight: 420 }}>
          {PIPELINE_COLUMNS.map(col => (
            <DroppableColumn
              key={col.key}
              colKey={col.key}
              label={col.label}
              color={col.color}
              dot={col.dot}
              leads={getColumnLeads(col.statuses)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
          {activeLead && <LeadCard lead={activeLead} isDragging />}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {pendingClose && (
          <CloseDealModal
            leadName={`${pendingClose.lead.first_name ?? ""} ${pendingClose.lead.last_name ?? ""}`.trim() || pendingClose.lead.phone}
            prefilledTechId={pendingClose.prefilledTechId}
            prefilledTechName={pendingClose.prefilledTechName}
            technicians={technicians}
            onConfirm={handleCloseDeal}
            onCancel={() => setPendingClose(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
