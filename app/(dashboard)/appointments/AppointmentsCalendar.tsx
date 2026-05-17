"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft, ChevronRight, Calendar, MapPin, Phone,
  CheckCircle2, XCircle, AlertTriangle, Clock, X, User,
  Wrench, RotateCcw, MessageSquare, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppointmentWindow } from "@/lib/availability"
import type { ConfirmationStatus } from "@/types/database"

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = { first_name: string | null; last_name: string | null; phone: string }
type Technician = { name: string; phone: string | null } | null

type Appointment = {
  id: string
  lead_id: string
  scheduled_at: string
  address: string | null
  notes: string | null
  status: string
  confirmation_status: ConfirmationStatus
  technician_name: string | null
  technician_id: string | null
  leads: Lead | null
  technicians: Technician
}

type Props = {
  companyId: string
  timezone: string
  availableDays: string[]
  appointmentWindows: AppointmentWindow[]
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ─── Status configs ───────────────────────────────────────────────────────────

type StatusCfg = { label: string; color: string; dotColor: string; icon: React.ElementType }

const CONFIRMATION_STATUS_CONFIG: Record<ConfirmationStatus, StatusCfg> = {
  pending_confirmation: {
    label: "Pending Confirmation",
    color: "bg-amber-500/15 text-amber-700 border-amber-400/30",
    dotColor: "bg-amber-400",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-400/30",
    dotColor: "bg-emerald-500",
    icon: CheckCircle2,
  },
  cancelled_by_lead: {
    label: "Cancelled by Lead",
    color: "bg-red-500/15 text-red-700 border-red-400/30",
    dotColor: "bg-red-500",
    icon: XCircle,
  },
  reschedule_requested: {
    label: "Reschedule Requested",
    color: "bg-orange-500/15 text-orange-700 border-orange-400/30",
    dotColor: "bg-orange-400",
    icon: RotateCcw,
  },
  no_response: {
    label: "No Response",
    color: "bg-slate-400/15 text-slate-600 border-slate-400/30",
    dotColor: "bg-slate-400",
    icon: MessageSquare,
  },
  completed: {
    label: "Completed",
    color: "bg-sky-500/15 text-sky-700 border-sky-400/30",
    dotColor: "bg-sky-500",
    icon: CheckCircle2,
  },
}

// For cancelled/no-show appointments (status-level, not confirmation-level)
const STATUS_FALLBACK: Record<string, StatusCfg> = {
  cancelled: {
    label: "Cancelled",
    color: "bg-red-500/15 text-red-700 border-red-400/30",
    dotColor: "bg-red-500",
    icon: XCircle,
  },
  no_show: {
    label: "No-show",
    color: "bg-amber-500/15 text-amber-700 border-amber-400/30",
    dotColor: "bg-amber-400",
    icon: AlertTriangle,
  },
}

function getStatusCfg(apt: Appointment): StatusCfg {
  if (apt.status === "cancelled") return STATUS_FALLBACK.cancelled
  if (apt.status === "no_show")   return STATUS_FALLBACK.no_show
  return CONFIRMATION_STATUS_CONFIG[apt.confirmation_status] ?? CONFIRMATION_STATUS_CONFIG.pending_confirmation
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const ampm = h < 12 ? "AM" : "PM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`
}

function getSlotAppointment(
  appointments: Appointment[],
  date: Date,
  win: AppointmentWindow,
  timezone: string
): Appointment | undefined {
  const dateStr = date.toLocaleDateString("en-CA", { timeZone: timezone })
  const [startH] = win.start.split(":").map(Number)
  const [endH]   = win.end.split(":").map(Number)

  return appointments.find((apt) => {
    if (apt.status === "cancelled") return false
    const aptDate = new Date(apt.scheduled_at)
    if (aptDate.toLocaleDateString("en-CA", { timeZone: timezone }) !== dateStr) return false
    const aptH = parseInt(
      aptDate.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false, timeZone: timezone })
    )
    return aptH >= startH && aptH < endH
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AppointmentsCalendar({ companyId, timezone, availableDays, appointmentWindows }: Props) {
  const supabase = createClient()
  const [weekStart, setWeekStart]       = useState(() => getMonday(new Date()))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selected, setSelected]         = useState<Appointment | null>(null)
  const [updating, setUpdating]         = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const enabledWindows = appointmentWindows.filter((w) => w.enabled)

  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  }).filter((d) => availableDays.includes(DAY_NAMES[d.getDay()]))

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const loadAppointments = useCallback(async () => {
    const from = new Date(weekStart); from.setDate(from.getDate() - 7)
    const to   = new Date(weekEnd);   to.setDate(to.getDate() + 7)

    const { data } = await supabase
      .from("appointments")
      .select("*, leads(first_name, last_name, phone), technicians(name, phone)")
      .eq("company_id", companyId)
      .gte("scheduled_at", from.toISOString())
      .lte("scheduled_at", to.toISOString())
      .order("scheduled_at")

    setAppointments((data ?? []) as Appointment[])
  }, [companyId, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAppointments() }, [loadAppointments])

  useEffect(() => {
    const channel = supabase
      .channel("appointments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `company_id=eq.${companyId}` },
        () => loadAppointments()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId, loadAppointments]) // eslint-disable-line react-hooks/exhaustive-deps

  async function updateConfirmationStatus(id: string, confirmationStatus: ConfirmationStatus) {
    setUpdating(id)
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation_status: confirmationStatus }),
    })
    await loadAppointments()
    setSelected(prev => prev?.id === id ? { ...prev, confirmation_status: confirmationStatus } : prev)
    setUpdating(null)
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    await loadAppointments()
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev)
    setUpdating(null)
  }

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
  const isToday   = (d: Date) => d.toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA")
  const isPast    = (d: Date, win: AppointmentWindow) => {
    const [h] = win.end.split(":").map(Number)
    const end = new Date(d); end.setHours(h, 0, 0, 0)
    return end < new Date()
  }

  const thisWeekApts = appointments.filter(a =>
    a.status !== "cancelled" &&
    weekDays.some(d =>
      d.toLocaleDateString("en-CA", { timeZone: timezone }) ===
      new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: timezone })
    )
  )

  const statusCounts = {
    pending:    thisWeekApts.filter(a => a.confirmation_status === "pending_confirmation").length,
    confirmed:  thisWeekApts.filter(a => a.confirmation_status === "confirmed").length,
    no_response: thisWeekApts.filter(a => a.confirmation_status === "no_response").length,
    reschedule: thisWeekApts.filter(a => a.confirmation_status === "reschedule_requested").length,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header: nav + status summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline" size="icon" className="h-8 w-8 border-[#E7E5E4]"
            onClick={() => setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d })}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-[#1C1917]">{weekLabel}</span>
          <Button
            variant="outline" size="icon" className="h-8 w-8 border-[#E7E5E4]"
            onClick={() => setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() + 7); return d })}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost" size="sm" className="text-xs h-8 text-[#78716C]"
            onClick={() => setWeekStart(getMonday(new Date()))}
          >
            Today
          </Button>
        </div>

        {/* Status summary pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {statusCounts.pending > 0 && (
            <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              {statusCounts.pending} pending
            </span>
          )}
          {statusCounts.confirmed > 0 && (
            <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {statusCounts.confirmed} confirmed
            </span>
          )}
          {statusCounts.no_response > 0 && (
            <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />
              {statusCounts.no_response} no response
            </span>
          )}
          {statusCounts.reschedule > 0 && (
            <span className="flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 px-2 py-1 rounded-full">
              <RotateCcw className="w-3 h-3" />
              {statusCounts.reschedule} reschedule
            </span>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-[#E7E5E4] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {/* Day headers */}
        <div
          className="grid border-b border-[#E7E5E4]"
          style={{ gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` }}
        >
          <div className="px-4 py-3 text-xs text-[#78716C] font-medium bg-[#FAFAF8]" />
          {weekDays.map((d) => (
            <div
              key={d.toISOString()}
              className={cn(
                "px-3 py-3 text-center border-l border-[#E7E5E4]",
                isToday(d) ? "bg-[#7C3AED]/5" : "bg-[#FAFAF8]"
              )}
            >
              <p className={cn("text-xs font-medium", isToday(d) ? "text-[#7C3AED]" : "text-[#78716C]")}>
                {DAY_SHORT[d.getDay()]}
              </p>
              <p className={cn("text-lg font-bold leading-tight", isToday(d) ? "text-[#7C3AED]" : "text-[#1C1917]")}>
                {d.getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* Time window rows */}
        {enabledWindows.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#78716C]">
            No time windows enabled. Configure them in AI Agent settings.
          </div>
        ) : (
          enabledWindows.map((win, wi) => (
            <div
              key={win.id}
              className={cn("grid", wi < enabledWindows.length - 1 && "border-b border-[#E7E5E4]")}
              style={{ gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` }}
            >
              {/* Time label */}
              <div className="px-4 py-4 flex flex-col justify-center bg-[#FAFAF8] border-r border-[#E7E5E4]">
                <p className="text-xs font-semibold text-[#1C1917]">{win.label}</p>
                <p className="text-xs text-[#78716C]">{fmt12(win.start)}–{fmt12(win.end)}</p>
              </div>

              {/* Day cells */}
              {weekDays.map((d) => {
                const apt  = getSlotAppointment(appointments, d, win, timezone)
                const past = isPast(d, win)
                const cfg  = apt ? getStatusCfg(apt) : null

                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "border-l border-[#E7E5E4] px-2 py-2 min-h-[80px] flex items-center justify-center transition-colors",
                      apt ? "cursor-pointer hover:bg-[#FAFAF8]" : past ? "bg-[#FAFAF8]/50" : "hover:bg-[#FAFAF8]/60",
                      isToday(d) && !apt && "bg-[#7C3AED]/2"
                    )}
                    onClick={() => apt && setSelected(apt)}
                  >
                    {apt ? (
                      <div className={cn("w-full rounded-xl px-2.5 py-2 border", cfg!.color)}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg!.dotColor)} />
                          <p className="text-xs font-semibold truncate">
                            {apt.leads?.first_name} {apt.leads?.last_name}
                          </p>
                        </div>
                        <p className="text-xs opacity-70">
                          {new Date(apt.scheduled_at).toLocaleTimeString("en-US", {
                            hour: "numeric", minute: "2-digit", timeZone: timezone,
                          })}
                        </p>
                        {(apt.technician_name || (apt.technicians as { name: string } | null)?.name) && (
                          <p className="text-xs opacity-60 flex items-center gap-0.5 mt-0.5">
                            <Wrench className="w-2.5 h-2.5 shrink-0" />
                            {apt.technician_name ?? (apt.technicians as { name: string })?.name}
                          </p>
                        )}
                        {apt.address && (
                          <p className="text-xs opacity-50 truncate flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />{apt.address}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className={cn("text-xs", past ? "text-[#78716C]/30" : "text-[#78716C]/40")}>
                        {past ? "—" : "Free"}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Upcoming list */}
      {(() => {
        const outside = appointments.filter(a => {
          const d = new Date(a.scheduled_at)
          return d < weekStart || d > weekEnd
        })
        if (outside.length === 0) return null
        return (
          <div>
            <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">Other appointments</p>
            <div className="bg-white border border-[#E7E5E4] rounded-2xl divide-y divide-[#E7E5E4] overflow-hidden">
              {outside.map(apt => {
                const cfg = getStatusCfg(apt)
                return (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[#FAFAF8] transition-colors"
                    onClick={() => setSelected(apt)}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-[#78716C] shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#1C1917]">{apt.leads?.first_name} {apt.leads?.last_name}</p>
                        <p className="text-xs text-[#78716C]">
                          {new Date(apt.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: timezone })} ·{" "}
                          {new Date(apt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })}
                          {apt.technician_name && ` · ${apt.technician_name}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-xs shrink-0", cfg.color)}>{cfg.label}</Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Empty state */}
      {weekDays.length === 0 && (
        <div className="bg-white border border-[#E7E5E4] rounded-2xl px-5 py-16 text-center">
          <Calendar className="w-10 h-10 text-[#78716C]/30 mx-auto mb-3" />
          <p className="text-sm text-[#78716C]">No available days configured for this week.</p>
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
            onClick={() => setSelected(null)}
          >
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm bg-white border-l border-[#E7E5E4] shadow-2xl flex flex-col h-full overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#E7E5E4]">
                <h2 className="font-semibold text-lg text-[#1C1917]">Appointment</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 px-6 py-5 space-y-5">
                {/* Lead */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-[#7C3AED]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1C1917]">{selected.leads?.first_name} {selected.leads?.last_name}</p>
                    <p className="text-sm text-[#78716C] flex items-center gap-1">
                      <Phone className="w-3 h-3" />{selected.leads?.phone}
                    </p>
                  </div>
                </div>

                {/* Technician */}
                {(selected.technician_name || (selected.technicians as { name: string } | null)?.name) && (
                  <div className="flex items-center gap-3 bg-[#4D7C0F]/8 border border-[#4D7C0F]/20 rounded-xl px-4 py-3">
                    <Wrench className="w-4 h-4 text-[#4D7C0F] shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[#4D7C0F] uppercase tracking-wide">Assigned Technician</p>
                      <p className="text-sm font-medium text-[#1C1917]">
                        {selected.technician_name ?? (selected.technicians as { name: string })?.name}
                      </p>
                      {(selected.technicians as { phone: string | null } | null)?.phone && (
                        <p className="text-xs text-[#78716C]">
                          {(selected.technicians as { phone: string })?.phone}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Date/time/address */}
                <div className="bg-[#FAFAF8] rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-[#78716C]" />
                    <span className="font-medium text-[#1C1917]">
                      {new Date(selected.scheduled_at).toLocaleDateString("en-US", {
                        weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: timezone,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-[#78716C]" />
                    <span className="text-[#1C1917]">
                      {new Date(selected.scheduled_at).toLocaleTimeString("en-US", {
                        hour: "numeric", minute: "2-digit", timeZone: timezone,
                      })}
                    </span>
                  </div>
                  {selected.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-[#78716C] shrink-0 mt-0.5" />
                      <span className="text-[#1C1917]">{selected.address}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selected.notes && (
                  <div>
                    <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-1">Job notes</p>
                    <p className="text-sm text-[#78716C] bg-[#FAFAF8] rounded-lg px-3 py-2.5">{selected.notes}</p>
                  </div>
                )}

                {/* Confirmation status */}
                <div>
                  <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">Confirmation status</p>
                  {(() => {
                    const cfg = getStatusCfg(selected)
                    const Icon = cfg.icon
                    return (
                      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium", cfg.color)}>
                        <Icon className="w-4 h-4" /> {cfg.label}
                      </div>
                    )
                  })()}
                </div>

                {/* Status actions */}
                {selected.status !== "cancelled" && selected.status !== "no_show" && (
                  <div>
                    <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">Change status</p>
                    <div className="space-y-2">
                      {selected.confirmation_status !== "confirmed" && (
                        <Button
                          className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={updating === selected.id}
                          onClick={() => updateConfirmationStatus(selected.id, "confirmed")}
                        >
                          <CheckCircle2 className="w-4 h-4" /> Mark as confirmed
                        </Button>
                      )}
                      {selected.confirmation_status !== "completed" && (
                        <Button
                          className="w-full justify-start gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                          disabled={updating === selected.id}
                          onClick={() => updateConfirmationStatus(selected.id, "completed")}
                        >
                          <CheckCircle2 className="w-4 h-4" /> Mark as completed
                        </Button>
                      )}
                      {selected.confirmation_status !== "reschedule_requested" && (
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                          disabled={updating === selected.id}
                          onClick={() => updateConfirmationStatus(selected.id, "reschedule_requested")}
                        >
                          <RotateCcw className="w-4 h-4" /> Mark reschedule requested
                        </Button>
                      )}
                      {selected.confirmation_status !== "no_response" && (
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 text-slate-600 border-slate-300 hover:bg-slate-50"
                          disabled={updating === selected.id}
                          onClick={() => updateConfirmationStatus(selected.id, "no_response")}
                        >
                          <MessageSquare className="w-4 h-4" /> Mark no response
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
                        disabled={updating === selected.id}
                        onClick={() => updateStatus(selected.id, "no_show")}
                      >
                        <AlertTriangle className="w-4 h-4" /> Mark as no-show
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2 text-red-600 border-red-300 hover:bg-red-50"
                        disabled={updating === selected.id}
                        onClick={() => {
                          updateStatus(selected.id, "cancelled")
                          updateConfirmationStatus(selected.id, "cancelled_by_lead")
                        }}
                      >
                        <XCircle className="w-4 h-4" /> Cancel appointment
                      </Button>
                    </div>
                  </div>
                )}

                {/* Restore */}
                {(selected.status === "cancelled" || selected.status === "no_show") && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-[#E7E5E4]"
                    disabled={updating === selected.id}
                    onClick={() => {
                      updateStatus(selected.id, "scheduled")
                      updateConfirmationStatus(selected.id, "pending_confirmation")
                    }}
                  >
                    <Clock className="w-4 h-4" /> Restore to scheduled
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
