"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronLeft, ChevronRight, Calendar, MapPin, Phone,
  CheckCircle2, XCircle, AlertTriangle, Clock, X, User,
  Wrench, RotateCcw, MessageSquare, AlertCircle, Plus,
  List, Search, Edit2, Send, Check,
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

type LeadResult = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  email: string | null
  status: string
}

type TechOption = { id: string; name: string; phone: string | null }

type Props = {
  companyId: string
  timezone: string
  availableDays: string[]
  appointmentWindows: AppointmentWindow[]
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ─── HouseCall Pro-style time grid ────────────────────────────────────────────
const CAL_START   = 7
const CAL_END     = 20
const CAL_HOURS   = CAL_END - CAL_START
const CAL_HOUR_PX = 88

const TECH_PALETTE = [
  { bg: "#1D4ED8", light: "rgba(29,78,216,0.09)",   border: "#3B82F6" },
  { bg: "#7C3AED", light: "rgba(124,58,237,0.09)",  border: "#8B5CF6" },
  { bg: "#059669", light: "rgba(5,150,105,0.09)",   border: "#10B981" },
  { bg: "#B45309", light: "rgba(180,83,9,0.09)",    border: "#F59E0B" },
  { bg: "#DC2626", light: "rgba(220,38,38,0.09)",   border: "#EF4444" },
  { bg: "#0891B2", light: "rgba(8,145,178,0.09)",   border: "#06B6D4" },
  { bg: "#EA580C", light: "rgba(234,88,12,0.09)",   border: "#F97316" },
  { bg: "#9333EA", light: "rgba(147,51,234,0.09)",  border: "#A855F7" },
]

type TechColor = { bg: string; light: string; border: string }
const UNASSIGNED_COLOR: TechColor = { bg: "#64748B", light: "rgba(100,116,139,0.09)", border: "#94A3B8" }

function aptTimeToY(isoStr: string, tz: string): number {
  const timeStr = new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  })
  const [h, m] = timeStr.split(":").map(Number)
  return Math.max(0, (h - CAL_START) * CAL_HOUR_PX + (m / 60) * CAL_HOUR_PX)
}

// ─── Column layout algorithm ─────────────────────────────────────────────────
// Spreads concurrent events side-by-side instead of stacking them.
type LayoutEvent = { id: string; top: number; height: number }
type LayoutResult = Record<string, { col: number; numCols: number }>

function layoutColumns(events: LayoutEvent[]): LayoutResult {
  const result: LayoutResult = {}
  if (!events.length) return result

  const sorted = [...events].sort((a, b) => a.top - b.top)
  const colBottoms: number[] = []
  const assigned = new Map<string, number>()

  for (const ev of sorted) {
    let placed = false
    for (let c = 0; c < colBottoms.length; c++) {
      if (ev.top >= colBottoms[c] - 2) {
        colBottoms[c] = ev.top + ev.height
        assigned.set(ev.id, c)
        placed = true
        break
      }
    }
    if (!placed) {
      assigned.set(ev.id, colBottoms.length)
      colBottoms.push(ev.top + ev.height)
    }
  }

  for (const ev of sorted) {
    const col = assigned.get(ev.id) ?? 0
    const evBottom = ev.top + ev.height
    const overlapping = sorted.filter(
      o => o.id !== ev.id && o.top < evBottom && o.top + o.height > ev.top
    )
    const maxCol = overlapping.reduce((m, o) => Math.max(m, assigned.get(o.id) ?? 0), col)
    result[ev.id] = { col, numCols: maxCol + 1 }
  }

  return result
}

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

function toLocalDateInput(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz })
}

function toLocalTimeInput(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz })
}

function localDateTimeToISO(dateStr: string, timeStr: string, tz: string): string {
  // Parse local date+time string in the given timezone to UTC ISO string
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hour, minute] = timeStr.split(":").map(Number)
  // Use Intl to find the UTC offset for this local moment
  const refDate = new Date(`${dateStr}T${timeStr}:00`)
  const localStr = refDate.toLocaleString("en-US", { timeZone: tz })
  const utcStr   = refDate.toLocaleString("en-US", { timeZone: "UTC" })
  const diff     = new Date(localStr).getTime() - new Date(utcStr).getTime()
  const d        = new Date(Date.UTC(year, month - 1, day, hour, minute) - diff)
  return d.toISOString()
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

  // ── View state ──
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar")
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))

  // ── Appointment data ──
  const [appointments, setAppointments]   = useState<Appointment[]>([])
  const [selected, setSelected]           = useState<Appointment | null>(null)
  const [updating, setUpdating]           = useState<string | null>(null)

  // ── List view ──
  const [listSearch, setListSearch]       = useState("")
  const [listStatus, setListStatus]       = useState("all")
  const [listAppointments, setListApts]   = useState<Appointment[]>([])
  const [listLoading, setListLoading]     = useState(false)
  const listDebounce                      = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Technicians ──
  const [technicians, setTechnicians]     = useState<TechOption[]>([])

  // ── New appointment modal ──
  const [showNewModal, setShowNewModal]   = useState(false)
  const [newStep, setNewStep]             = useState<1 | 2>(1)
  const [leadSearchQ, setLeadSearchQ]     = useState("")
  const [leadResults, setLeadResults]     = useState<LeadResult[]>([])
  const [leadSearching, setLeadSearching] = useState(false)
  const [selectedLead, setSelectedLead]   = useState<LeadResult | null>(null)
  const [newForm, setNewForm]             = useState({
    date: new Date().toLocaleDateString("en-CA"),
    time: "09:00",
    technician_id: "",
    technician_name: "",
    address: "",
    notes: "",
    send_confirmation: true,
  })
  const [creating, setCreating]           = useState(false)
  const [createError, setCreateError]     = useState("")
  const leadSearchDebounce                = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Edit mode (inside detail panel) ──
  const [editMode, setEditMode]           = useState(false)
  const [editForm, setEditForm]           = useState({
    date: "",
    time: "",
    technician_id: "",
    technician_name: "",
    address: "",
    notes: "",
  })
  const [saving, setSaving]               = useState(false)
  const [saveError, setSaveError]         = useState("")

  const enabledWindows = appointmentWindows.filter((w) => w.enabled)

  // All 7 days of the week (for time-grid view)
  const allDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  // Legacy: only available days (kept for week label calculation)
  const weekDays: Date[] = allDays.filter((d) => availableDays.includes(DAY_NAMES[d.getDay()]))

  // Build technician → color map (index by position in the technicians list)
  const techColorMap = useMemo(() => {
    const map = new Map<string, TechColor>()
    technicians.forEach((t, i) => map.set(t.id, TECH_PALETTE[i % TECH_PALETTE.length]))
    return map
  }, [technicians])

  function getTechColor(techId: string | null | undefined): TechColor {
    if (!techId) return UNASSIGNED_COLOR
    return techColorMap.get(techId) ?? UNASSIGNED_COLOR
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  // ── Load calendar appointments ──
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

  // ── Load list view appointments ──
  const loadListAppointments = useCallback(async (q: string, status: string) => {
    setListLoading(true)
    try {
      const params = new URLSearchParams({ limit: "200" })
      if (q)           params.set("q", q)
      if (status !== "all") params.set("status", status)
      const res  = await fetch(`/api/appointments?${params}`)
      const data = await res.json()
      setListApts((data.appointments ?? []) as Appointment[])
    } finally {
      setListLoading(false)
    }
  }, [])

  // ── Load technicians ──
  useEffect(() => {
    supabase
      .from("technicians")
      .select("id, name, phone")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name")
      .then(({ data }) => setTechnicians((data ?? []) as TechOption[]))
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAppointments() }, [loadAppointments])

  useEffect(() => {
    const channel = supabase
      .channel("appointments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `company_id=eq.${companyId}` },
        () => {
          loadAppointments()
          if (viewMode === "list") loadListAppointments(listSearch, listStatus)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId, loadAppointments, viewMode, listSearch, listStatus, loadListAppointments]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode !== "list") return
    if (listDebounce.current) clearTimeout(listDebounce.current)
    listDebounce.current = setTimeout(() => loadListAppointments(listSearch, listStatus), 300)
  }, [viewMode, listSearch, listStatus, loadListAppointments])

  // ── Lead search for new modal ──
  useEffect(() => {
    if (leadSearchDebounce.current) clearTimeout(leadSearchDebounce.current)
    if (leadSearchQ.length < 2) { setLeadResults([]); return }
    leadSearchDebounce.current = setTimeout(async () => {
      setLeadSearching(true)
      try {
        const res  = await fetch(`/api/leads/search?q=${encodeURIComponent(leadSearchQ)}`)
        const data = await res.json()
        setLeadResults(data.leads ?? [])
      } finally {
        setLeadSearching(false)
      }
    }, 300)
  }, [leadSearchQ])

  // ── Status / confirmation update helpers ──

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

  // ── Open edit mode ──
  function openEdit(apt: Appointment) {
    setEditForm({
      date: toLocalDateInput(apt.scheduled_at, timezone),
      time: toLocalTimeInput(apt.scheduled_at, timezone),
      technician_id: apt.technician_id ?? "",
      technician_name: apt.technician_name ?? "",
      address: apt.address ?? "",
      notes: apt.notes ?? "",
    })
    setSaveError("")
    setEditMode(true)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    setSaveError("")
    try {
      const scheduled_at = localDateTimeToISO(editForm.date, editForm.time, timezone)
      const techId   = editForm.technician_id || null
      const techName = techId
        ? (technicians.find(t => t.id === techId)?.name ?? (editForm.technician_name || null))
        : (editForm.technician_name || null)

      const res = await fetch(`/api/appointments/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_at,
          technician_id: techId,
          technician_name: techName,
          address: editForm.address || null,
          notes: editForm.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? "Save failed"); return }

      // Update selected + appointments list
      if (data.appointment) {
        const updated = {
          ...selected,
          ...data.appointment,
          leads: data.appointment.leads ?? selected.leads,
          technicians: data.appointment.technicians ?? selected.technicians,
        } as Appointment
        setSelected(updated)
        setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))
        if (viewMode === "list") loadListAppointments(listSearch, listStatus)
      }
      setEditMode(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Create new appointment ──
  function openNewModal() {
    setShowNewModal(true)
    setNewStep(1)
    setLeadSearchQ("")
    setLeadResults([])
    setSelectedLead(null)
    setNewForm({
      date: new Date().toLocaleDateString("en-CA"),
      time: "09:00",
      technician_id: "",
      technician_name: "",
      address: "",
      notes: "",
      send_confirmation: true,
    })
    setCreateError("")
  }

  async function createAppointment() {
    if (!selectedLead) return
    setCreating(true)
    setCreateError("")
    try {
      const scheduled_at = localDateTimeToISO(newForm.date, newForm.time, timezone)
      const techId   = newForm.technician_id || null
      const techName = techId
        ? (technicians.find(t => t.id === techId)?.name ?? null)
        : (newForm.technician_name || null)

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          scheduled_at,
          technician_id: techId,
          technician_name: techName,
          address: newForm.address || null,
          notes: newForm.notes || null,
          send_confirmation: newForm.send_confirmation,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? "Failed to create appointment"); return }

      setShowNewModal(false)
      await loadAppointments()
      if (viewMode === "list") loadListAppointments(listSearch, listStatus)
      // Jump calendar to the appointment's week
      const aptDate = new Date(data.appointment.scheduled_at)
      setWeekStart(getMonday(aptDate))
    } finally {
      setCreating(false)
    }
  }

  // ─── Derived values ──────────────────────────────────────────────────────────
  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
  const isToday   = (d: Date) => d.toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA")
  const isPast    = (d: Date, win: AppointmentWindow) => {
    const [h] = win.end.split(":").map(Number)
    const end = new Date(d); end.setHours(h, 0, 0, 0)
    return end < new Date()
  }

  const thisWeekApts = appointments.filter(a =>
    a.status !== "cancelled" &&
    allDays.some(d =>
      d.toLocaleDateString("en-CA", { timeZone: timezone }) ===
      new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: timezone })
    )
  )

  const statusCounts = {
    pending:     thisWeekApts.filter(a => a.confirmation_status === "pending_confirmation").length,
    confirmed:   thisWeekApts.filter(a => a.confirmation_status === "confirmed").length,
    no_response: thisWeekApts.filter(a => a.confirmation_status === "no_response").length,
    reschedule:  thisWeekApts.filter(a => a.confirmation_status === "reschedule_requested").length,
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {viewMode === "calendar" && (
            <>
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
            </>
          )}
          {viewMode === "list" && (
            <span className="text-sm font-medium text-[#1C1917]">All Appointments</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-[#F5F4F2] rounded-lg p-0.5 border border-[#E7E5E4]">
            <button
              onClick={() => setViewMode("calendar")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === "calendar" ? "bg-white shadow-sm text-[#1C1917]" : "text-[#78716C] hover:text-[#1C1917]")}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendar
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === "list" ? "bg-white shadow-sm text-[#1C1917]" : "text-[#78716C] hover:text-[#1C1917]")}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>

          {/* New appointment */}
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-[#F97316] hover:bg-[#ea6c0e] text-white text-xs"
            onClick={openNewModal}
          >
            <Plus className="w-3.5 h-3.5" /> New Appointment
          </Button>
        </div>
      </div>

      {/* ── Status summary pills (calendar only) ── */}
      {viewMode === "calendar" && (statusCounts.pending > 0 || statusCounts.confirmed > 0 || statusCounts.no_response > 0 || statusCounts.reschedule > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-xs -mt-3">
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
      )}

      {/* ── Calendar view (HouseCall Pro-style time grid) ── */}
      {viewMode === "calendar" && (
        <>
          {/* Technician color legend */}
          {technicians.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 -mt-2">
              <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wide">Technicians:</span>
              {technicians.map(t => {
                const c = techColorMap.get(t.id)
                return c ? (
                  <div key={t.id} className="flex items-center gap-1.5 text-xs text-[#78716C]">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.bg }} />
                    {t.name}
                  </div>
                ) : null
              })}
              {appointments.some(a => a.status !== "cancelled" && !a.technician_id) && (
                <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
                  <div className="w-2.5 h-2.5 rounded-sm bg-slate-400 shrink-0" />
                  Unassigned
                </div>
              )}
            </div>
          )}

          {/* Time-based week grid */}
          <div className="bg-white border border-[#E7E5E4] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {/* Day header row */}
            <div className="grid border-b border-[#E7E5E4]" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
              <div className="border-r border-[#E7E5E4] bg-[#FAFAF8]" />
              {allDays.map((d, i) => {
                const today_ = isToday(d)
                const available = availableDays.includes(DAY_NAMES[d.getDay()])
                const dayApts = appointments.filter(a =>
                  a.status !== "cancelled" &&
                  new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: timezone }) ===
                  d.toLocaleDateString("en-CA", { timeZone: timezone })
                )
                return (
                  <div
                    key={i}
                    className={cn(
                      "px-2 py-2.5 text-center border-r border-[#E7E5E4] last:border-r-0",
                      today_ ? "bg-[#F97316]/5" : !available ? "bg-[#FAFAF8]/70" : "bg-[#FAFAF8]"
                    )}
                  >
                    <p className={cn("text-xs font-medium", today_ ? "text-[#F97316]" : "text-[#78716C]")}>
                      {DAY_SHORT[d.getDay()]}
                    </p>
                    <p className={cn(
                      "text-xl font-bold leading-tight mt-0.5",
                      today_ ? "text-[#F97316]" : !available ? "text-[#78716C]/40" : "text-[#1C1917]"
                    )}>
                      {d.getDate()}
                    </p>
                    {dayApts.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1.5">
                        {dayApts.slice(0, 4).map(a => (
                          <div
                            key={a.id}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: getTechColor(a.technician_id).bg }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Scrollable time grid */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
              <div className="grid relative" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", height: CAL_HOURS * CAL_HOUR_PX }}>
                {/* Hour labels */}
                <div className="border-r border-[#E7E5E4] relative bg-[#FAFAF8]/60">
                  {Array.from({ length: CAL_HOURS }, (_, i) => {
                    const h = CAL_START + i
                    const label = h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`
                    return (
                      <div
                        key={i}
                        className="absolute w-full flex items-start justify-end pr-2"
                        style={{ top: i * CAL_HOUR_PX, height: CAL_HOUR_PX }}
                      >
                        <span className="text-[10px] text-[#78716C] -translate-y-2">{label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Day columns */}
                {allDays.map((day, di) => {
                  const available = availableDays.includes(DAY_NAMES[day.getDay()])
                  const dayDateStr = day.toLocaleDateString("en-CA", { timeZone: timezone })
                  const dayApts = appointments.filter(a =>
                    a.status !== "cancelled" &&
                    new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: timezone }) === dayDateStr
                  )

                  return (
                    <div
                      key={di}
                      className={cn(
                        "border-r border-[#E7E5E4] last:border-r-0 relative",
                        !available && "bg-[#FAFAF8]/50"
                      )}
                    >
                      {/* Hour lines */}
                      {Array.from({ length: CAL_HOURS }, (_, i) => (
                        <div key={i} className="absolute w-full border-t border-[#E7E5E4]" style={{ top: i * CAL_HOUR_PX }} />
                      ))}
                      {/* Half-hour dashes */}
                      {Array.from({ length: CAL_HOURS }, (_, i) => (
                        <div
                          key={`hh${i}`}
                          className="absolute w-full border-t border-[#E7E5E4]/60 border-dashed"
                          style={{ top: i * CAL_HOUR_PX + CAL_HOUR_PX / 2 }}
                        />
                      ))}

                      {/* Appointment blocks — column layout prevents overlap */}
                      {(() => {
                        const APT_MIN_H = Math.max(CAL_HOUR_PX * 1.5, 90)
                        const aptData = dayApts.map(apt => ({
                          id: apt.id,
                          top: aptTimeToY(apt.scheduled_at, timezone),
                          height: APT_MIN_H,
                        }))
                        const layouts = layoutColumns(aptData)

                        return dayApts.map(apt => {
                          const top = aptTimeToY(apt.scheduled_at, timezone)
                          const height = APT_MIN_H
                          const c = getTechColor(apt.technician_id)
                          const techName = apt.technician_name ?? (apt.technicians as { name: string } | null)?.name
                          const layout = layouts[apt.id] ?? { col: 0, numCols: 1 }
                          const leftPct = (layout.col / layout.numCols) * 100
                          const widthPct = (1 / layout.numCols) * 100

                          return (
                            <button
                              key={apt.id}
                              onClick={() => { setSelected(apt); setEditMode(false) }}
                              className="absolute rounded-lg overflow-hidden hover:brightness-95 transition-all text-left"
                              style={{
                                top,
                                height,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`,
                                backgroundColor: c.light,
                                borderLeft: `3px solid ${c.bg}`,
                                border: `1px solid ${c.border}35`,
                                borderLeftWidth: 3,
                                borderLeftColor: c.bg,
                              }}
                            >
                              {/* Pending confirmation tag */}
                              {apt.confirmation_status === "pending_confirmation" && (
                                <div
                                  className="absolute top-0 right-0 px-1.5 py-[3px] text-[8px] font-bold text-white uppercase tracking-wider"
                                  style={{ background: "#F59E0B", borderBottomLeftRadius: 6 }}
                                >
                                  Pending
                                </div>
                              )}
                              <div className="px-2 py-1.5 h-full flex flex-col gap-0.5 overflow-hidden">
                                <p className="text-[11px] font-bold truncate leading-tight pr-10" style={{ color: c.bg }}>
                                  {apt.leads?.first_name} {apt.leads?.last_name}
                                </p>
                                <p className="text-[10px] text-[#78716C] font-medium flex items-center gap-0.5">
                                  <Clock className="w-2 h-2 shrink-0" />
                                  {new Date(apt.scheduled_at).toLocaleTimeString("en-US", {
                                    hour: "numeric", minute: "2-digit", timeZone: timezone,
                                  })}
                                </p>
                                {apt.address && (
                                  <p className="text-[10px] text-[#78716C] truncate flex items-center gap-0.5">
                                    <MapPin className="w-2 h-2 shrink-0" />{apt.address}
                                  </p>
                                )}
                                {apt.notes && (
                                  <p className="text-[9px] text-[#78716C] truncate">{apt.notes}</p>
                                )}
                                {techName && (
                                  <p className="text-[9px] font-semibold mt-auto flex items-center gap-0.5" style={{ color: c.bg }}>
                                    <Wrench className="w-2 h-2 shrink-0" />{techName}
                                  </p>
                                )}
                              </div>
                            </button>
                          )
                        })
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Appointments outside current week */}
          {(() => {
            const outside = appointments.filter(a => {
              const d = new Date(a.scheduled_at)
              return (d < weekStart || d > weekEnd) && a.status !== "cancelled"
            })
            if (outside.length === 0) return null
            return (
              <div>
                <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">Other appointments</p>
                <div className="bg-white border border-[#E7E5E4] rounded-2xl divide-y divide-[#E7E5E4] overflow-hidden">
                  {outside.map(apt => {
                    const cfg = getStatusCfg(apt)
                    const c = getTechColor(apt.technician_id)
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[#FAFAF8] transition-colors"
                        onClick={() => setSelected(apt)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-8 rounded-full shrink-0" style={{ background: c.bg }} />
                          <div>
                            <p className="text-sm font-medium text-[#1C1917]">{apt.leads?.first_name} {apt.leads?.last_name}</p>
                            <p className="text-xs text-[#78716C]">
                              {new Date(apt.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: timezone })}
                              {" · "}
                              {new Date(apt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })}
                              {(apt.technician_name ?? (apt.technicians as { name: string } | null)?.name) && (
                                <> · {apt.technician_name ?? (apt.technicians as { name: string })?.name}</>
                              )}
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
        </>
      )}

      {/* ── List view ── */}
      {viewMode === "list" && (
        <div className="flex flex-col gap-4">
          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
              <Input
                placeholder="Search by name, phone, email, job type, address…"
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                className="pl-9 bg-white border-[#E7E5E4] h-9 text-sm"
              />
            </div>
            <select
              value={listStatus}
              onChange={e => setListStatus(e.target.value)}
              className="h-9 px-3 text-sm border border-[#E7E5E4] rounded-md bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white border border-[#E7E5E4] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {listLoading ? (
              <div className="py-12 text-center text-sm text-[#78716C]">Loading…</div>
            ) : listAppointments.length === 0 ? (
              <div className="py-16 text-center">
                <Calendar className="w-10 h-10 text-[#78716C]/30 mx-auto mb-3" />
                <p className="text-sm text-[#78716C]">No appointments found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E7E5E4] bg-[#FAFAF8]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wide">Lead</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wide">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wide hidden md:table-cell">Technician</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wide hidden lg:table-cell">Address / Notes</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E4]">
                    {listAppointments.map(apt => {
                      const cfg = getStatusCfg(apt)
                      return (
                        <tr key={apt.id} className="hover:bg-[#FAFAF8] transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#1C1917]">{apt.leads?.first_name} {apt.leads?.last_name}</p>
                            <p className="text-xs text-[#78716C] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {apt.leads?.phone}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-[#1C1917]">
                              {new Date(apt.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: timezone })}
                            </p>
                            <p className="text-xs text-[#78716C]">
                              {new Date(apt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })}
                            </p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-[#78716C]">
                              {apt.technician_name ?? (apt.technicians as { name: string } | null)?.name ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]">
                            <p className="text-[#78716C] truncate">{apt.address ?? apt.notes ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn("text-xs", cfg.color)}>{cfg.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 px-2 text-[#78716C] hover:text-[#1C1917]"
                              onClick={() => { setSelected(apt); setEditMode(false) }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2.5 border-t border-[#E7E5E4] bg-[#FAFAF8]">
                  <p className="text-xs text-[#78716C]">{listAppointments.length} appointment{listAppointments.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail panel ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
            onClick={() => { setSelected(null); setEditMode(false) }}
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
                <h2 className="font-semibold text-lg text-[#1C1917]">
                  {editMode ? "Edit Appointment" : "Appointment"}
                </h2>
                <div className="flex items-center gap-2">
                  {!editMode && (
                    <Button
                      variant="outline" size="sm"
                      className="h-8 gap-1.5 text-xs border-[#E7E5E4]"
                      onClick={() => openEdit(selected)}
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => { setSelected(null); setEditMode(false) }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 px-6 py-5 space-y-5">

                {/* Lead */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F97316]/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-[#F97316]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1C1917]">{selected.leads?.first_name} {selected.leads?.last_name}</p>
                    <p className="text-sm text-[#78716C] flex items-center gap-1">
                      <Phone className="w-3 h-3" />{selected.leads?.phone}
                    </p>
                  </div>
                </div>

                {editMode ? (
                  /* ── Edit form ── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-[#78716C] mb-1 block">Date</label>
                        <Input
                          type="date"
                          value={editForm.date}
                          onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                          className="h-9 text-sm border-[#E7E5E4]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#78716C] mb-1 block">Time</label>
                        <Input
                          type="time"
                          value={editForm.time}
                          onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                          className="h-9 text-sm border-[#E7E5E4]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#78716C] mb-1 block">Technician</label>
                      <select
                        value={editForm.technician_id}
                        onChange={e => {
                          const id = e.target.value
                          const name = technicians.find(t => t.id === id)?.name ?? ""
                          setEditForm(f => ({ ...f, technician_id: id, technician_name: name }))
                        }}
                        className="w-full h-9 px-3 text-sm border border-[#E7E5E4] rounded-md bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
                      >
                        <option value="">No technician</option>
                        {technicians.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#78716C] mb-1 block">Address</label>
                      <Input
                        value={editForm.address}
                        onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="Job address"
                        className="h-9 text-sm border-[#E7E5E4]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#78716C] mb-1 block">Notes / Job type</label>
                      <textarea
                        value={editForm.notes}
                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="e.g. Roof replacement, full house"
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-[#E7E5E4] rounded-md bg-white text-[#1C1917] resize-none focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
                      />
                    </div>

                    {saveError && (
                      <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="flex-1 border-[#E7E5E4] text-[#78716C]"
                        onClick={() => { setEditMode(false); setSaveError("") }}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-[#F97316] hover:bg-[#ea6c0e] text-white gap-1.5"
                        onClick={saveEdit}
                        disabled={saving}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {saving ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <>
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
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── New Appointment Modal ── */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewModal(false)}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E7E5E4] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#E7E5E4]">
                <div>
                  <h2 className="font-semibold text-lg text-[#1C1917]">New Appointment</h2>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    {newStep === 1 ? "Step 1 of 2 — Select a lead" : "Step 2 of 2 — Appointment details"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Step 1 — Lead search */}
              {newStep === 1 && (
                <div className="px-6 py-5 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                    <Input
                      autoFocus
                      placeholder="Search lead by name, phone, or email…"
                      value={leadSearchQ}
                      onChange={e => setLeadSearchQ(e.target.value)}
                      className="pl-9 border-[#E7E5E4] h-10"
                    />
                  </div>

                  {leadSearching && (
                    <p className="text-sm text-[#78716C] text-center py-4">Searching…</p>
                  )}

                  {!leadSearching && leadResults.length > 0 && (
                    <div className="border border-[#E7E5E4] rounded-xl overflow-hidden divide-y divide-[#E7E5E4] max-h-64 overflow-y-auto">
                      {leadResults.map(lead => (
                        <button
                          key={lead.id}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAF8] transition-colors",
                            selectedLead?.id === lead.id && "bg-[#F97316]/5 border-l-2 border-[#F97316]"
                          )}
                          onClick={() => setSelectedLead(lead)}
                        >
                          <div className="w-8 h-8 rounded-full bg-[#F97316]/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-[#F97316]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#1C1917] truncate">
                              {lead.first_name} {lead.last_name}
                            </p>
                            <p className="text-xs text-[#78716C]">{lead.phone}{lead.email ? ` · ${lead.email}` : ""}</p>
                          </div>
                          {selectedLead?.id === lead.id && (
                            <Check className="w-4 h-4 text-[#F97316] shrink-0 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {!leadSearching && leadSearchQ.length >= 2 && leadResults.length === 0 && (
                    <p className="text-sm text-[#78716C] text-center py-4">No leads found matching &ldquo;{leadSearchQ}&rdquo;</p>
                  )}

                  {leadSearchQ.length < 2 && (
                    <p className="text-xs text-[#78716C] text-center py-2">Type at least 2 characters to search</p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 border-[#E7E5E4]" onClick={() => setShowNewModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-[#F97316] hover:bg-[#ea6c0e] text-white"
                      disabled={!selectedLead}
                      onClick={() => setNewStep(2)}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2 — Appointment details */}
              {newStep === 2 && (
                <div className="px-6 py-5 space-y-4">
                  {/* Selected lead summary */}
                  <div className="flex items-center gap-3 bg-[#F97316]/5 border border-[#F97316]/20 rounded-xl px-4 py-3">
                    <User className="w-4 h-4 text-[#F97316] shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[#1C1917]">{selectedLead?.first_name} {selectedLead?.last_name}</p>
                      <p className="text-xs text-[#78716C]">{selectedLead?.phone}</p>
                    </div>
                    <button
                      className="ml-auto text-xs text-[#F97316] hover:underline"
                      onClick={() => setNewStep(1)}
                    >
                      Change
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-[#78716C] mb-1 block">Date *</label>
                      <Input
                        type="date"
                        value={newForm.date}
                        onChange={e => setNewForm(f => ({ ...f, date: e.target.value }))}
                        className="h-9 text-sm border-[#E7E5E4]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#78716C] mb-1 block">Time *</label>
                      <Input
                        type="time"
                        value={newForm.time}
                        onChange={e => setNewForm(f => ({ ...f, time: e.target.value }))}
                        className="h-9 text-sm border-[#E7E5E4]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#78716C] mb-1 block">Technician</label>
                    <select
                      value={newForm.technician_id}
                      onChange={e => {
                        const id = e.target.value
                        setNewForm(f => ({ ...f, technician_id: id, technician_name: technicians.find(t => t.id === id)?.name ?? "" }))
                      }}
                      className="w-full h-9 px-3 text-sm border border-[#E7E5E4] rounded-md bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
                    >
                      <option value="">No technician</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#78716C] mb-1 block">Address</label>
                    <Input
                      value={newForm.address}
                      onChange={e => setNewForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Job address"
                      className="h-9 text-sm border-[#E7E5E4]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#78716C] mb-1 block">Notes / Job type</label>
                    <textarea
                      value={newForm.notes}
                      onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. Full roof replacement, 2,000 sq ft"
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-[#E7E5E4] rounded-md bg-white text-[#1C1917] resize-none focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
                    />
                  </div>

                  {/* Confirmation SMS toggle */}
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div
                      className={cn(
                        "relative w-9 h-5 rounded-full transition-colors shrink-0",
                        newForm.send_confirmation ? "bg-[#F97316]" : "bg-[#E7E5E4]"
                      )}
                      onClick={() => setNewForm(f => ({ ...f, send_confirmation: !f.send_confirmation }))}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        newForm.send_confirmation ? "translate-x-4" : "translate-x-0.5"
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1C1917] flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-[#F97316]" />
                        Send confirmation SMS
                      </p>
                      <p className="text-xs text-[#78716C]">AI sends a confirmation message to the lead right away</p>
                    </div>
                  </label>

                  {createError && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#E7E5E4] text-[#78716C]"
                      onClick={() => setNewStep(1)}
                      disabled={creating}
                    >
                      ← Back
                    </Button>
                    <Button
                      className="flex-1 bg-[#F97316] hover:bg-[#ea6c0e] text-white gap-1.5"
                      onClick={createAppointment}
                      disabled={creating || !newForm.date || !newForm.time}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {creating ? "Booking…" : "Book Appointment"}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
