"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft, ChevronRight, Calendar, MapPin, Phone,
  CheckCircle2, XCircle, AlertTriangle, Clock, X, User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppointmentWindow } from "@/lib/availability"

type Lead = { first_name: string | null; last_name: string | null; phone: string }
type Appointment = {
  id: string
  lead_id: string
  scheduled_at: string
  address: string | null
  notes: string | null
  status: string
  leads: Lead | null
}

type Props = {
  companyId: string
  timezone: string
  availableDays: string[]
  appointmentWindows: AppointmentWindow[]
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const DAY_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  scheduled:  { label: "Scheduled",  color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20", icon: Clock        },
  completed:  { label: "Completed",  color: "bg-sky-500/15 text-sky-500 border-sky-500/20",             icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  color: "bg-red-500/15 text-red-500 border-red-500/20",             icon: XCircle      },
  no_show:    { label: "No-show",    color: "bg-amber-500/15 text-amber-500 border-amber-500/20",       icon: AlertTriangle},
}

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
    const aptDate = new Date(apt.scheduled_at)
    if (aptDate.toLocaleDateString("en-CA", { timeZone: timezone }) !== dateStr) return false
    const aptH = parseInt(
      aptDate.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false, timeZone: timezone })
    )
    return aptH >= startH && aptH < endH
  })
}

export function AppointmentsCalendar({ companyId, timezone, availableDays, appointmentWindows }: Props) {
  const supabase = createClient()
  const [weekStart, setWeekStart]       = useState(() => getMonday(new Date()))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selected, setSelected]         = useState<Appointment | null>(null)
  const [updating, setUpdating]         = useState<string | null>(null)

  const enabledWindows = appointmentWindows.filter((w) => w.enabled)

  // Week days filtered to only show available days
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  }).filter((d) => availableDays.includes(DAY_NAMES[d.getDay()]))

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const loadAppointments = useCallback(async () => {
    const from = new Date(weekStart); from.setDate(from.getDate() - 7)  // load ±1 week buffer
    const to   = new Date(weekEnd);   to.setDate(to.getDate() + 7)

    const { data } = await supabase
      .from("appointments")
      .select("*, leads(first_name, last_name, phone)")
      .eq("company_id", companyId)
      .gte("scheduled_at", from.toISOString())
      .lte("scheduled_at", to.toISOString())
      .order("scheduled_at")

    setAppointments((data ?? []) as Appointment[])
  }, [companyId, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  // Real-time subscription — updates calendar instantly when AI books
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

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    await loadAppointments()
    // Refresh selected if it's the same appointment
    setSelected((prev) => prev?.id === id ? { ...prev, status } : prev)
    setUpdating(null)
  }

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
  const isToday = (d: Date) => d.toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA")
  const isPast  = (d: Date, win: AppointmentWindow) => {
    const [h] = win.end.split(":").map(Number)
    const end = new Date(d); end.setHours(h, 0, 0, 0)
    return end < new Date()
  }

  const totalBooked   = appointments.filter((a) => a.status === "scheduled" && weekDays.some((d) => d.toLocaleDateString("en-CA", { timeZone: timezone }) === new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: timezone }))).length
  const totalCapacity = weekDays.length * enabledWindows.length

  return (
    <div className="flex flex-col gap-6">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d })}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">{weekLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d })}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setWeekStart(getMonday(new Date()))}>
            Today
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{totalBooked}</span> / {totalCapacity} slots booked this week
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Day headers */}
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` }}
        >
          <div className="px-4 py-3 text-xs text-muted-foreground font-medium bg-muted/30" />
          {weekDays.map((d) => (
            <div
              key={d.toISOString()}
              className={cn(
                "px-3 py-3 text-center border-l border-border",
                isToday(d) ? "bg-primary/5" : "bg-muted/20"
              )}
            >
              <p className={cn("text-xs font-medium", isToday(d) ? "text-primary" : "text-muted-foreground")}>
                {DAY_SHORT[d.getDay()]}
              </p>
              <p className={cn("text-lg font-bold leading-tight", isToday(d) ? "text-primary" : "text-foreground")}>
                {d.getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* Time window rows */}
        {enabledWindows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No time windows enabled. Configure them in AI Agent settings.
          </div>
        ) : (
          enabledWindows.map((win, wi) => (
            <div
              key={win.id}
              className={cn(
                "grid",
                wi < enabledWindows.length - 1 && "border-b border-border"
              )}
              style={{ gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` }}
            >
              {/* Time label */}
              <div className="px-4 py-4 flex flex-col justify-center bg-muted/10 border-r border-border">
                <p className="text-xs font-semibold text-foreground">{win.label}</p>
                <p className="text-xs text-muted-foreground">{fmt12(win.start)}–{fmt12(win.end)}</p>
              </div>

              {/* Day cells */}
              {weekDays.map((d) => {
                const apt = getSlotAppointment(appointments, d, win, timezone)
                const past = isPast(d, win)
                const cfg  = apt ? (STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled) : null

                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "border-l border-border px-2 py-2 min-h-[72px] flex items-center justify-center transition-colors",
                      apt ? "cursor-pointer hover:bg-muted/20" : past ? "bg-muted/5" : "hover:bg-muted/10",
                      isToday(d) && !apt && "bg-primary/3"
                    )}
                    onClick={() => apt && setSelected(apt)}
                  >
                    {apt ? (
                      <div className={cn("w-full rounded-lg px-2.5 py-2 border", cfg!.color)}>
                        <p className="text-xs font-semibold truncate">
                          {apt.leads?.first_name} {apt.leads?.last_name}
                        </p>
                        <p className="text-xs opacity-70">
                          {new Date(apt.scheduled_at).toLocaleTimeString("en-US", {
                            hour: "numeric", minute: "2-digit", timeZone: timezone,
                          })}
                        </p>
                        {apt.address && (
                          <p className="text-xs opacity-60 truncate flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />{apt.address}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className={cn("text-xs", past ? "text-muted-foreground/30" : "text-muted-foreground/40")}>
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

      {/* Upcoming list — appointments outside current week view */}
      {(() => {
        const outside = appointments.filter((a) => {
          const d = new Date(a.scheduled_at)
          return d < weekStart || d > weekEnd
        })
        if (outside.length === 0) return null
        return (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Other appointments</p>
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
              {outside.map((apt) => {
                const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled
                return (
                  <div key={apt.id} className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => setSelected(apt)}>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{apt.leads?.first_name} {apt.leads?.last_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(apt.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: timezone })} ·{" "}
                          {new Date(apt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })}
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
        <div className="bg-card border border-border rounded-xl px-5 py-16 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No available days configured for this week.</p>
          <p className="text-xs text-muted-foreground mt-1">Update your booking days in AI Agent settings.</p>
        </div>
      )}

      {/* Detail panel — slide-in from right */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="font-semibold text-lg">Appointment</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 py-5 space-y-5">
              {/* Lead */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{selected.leads?.first_name} {selected.leads?.last_name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />{selected.leads?.phone}
                  </p>
                </div>
              </div>

              {/* Date/time */}
              <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {new Date(selected.scheduled_at).toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: timezone,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {new Date(selected.scheduled_at).toLocaleTimeString("en-US", {
                      hour: "numeric", minute: "2-digit", timeZone: timezone,
                    })}
                  </span>
                </div>
                {selected.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{selected.address}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selected.notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Job notes</p>
                  <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg px-3 py-2.5">{selected.notes}</p>
                </div>
              )}

              {/* Current status */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
                <Badge variant="outline" className={cn("text-sm py-1 px-3", STATUS_CONFIG[selected.status]?.color ?? "")}>
                  {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                </Badge>
              </div>

              {/* Status actions */}
              {selected.status === "scheduled" && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Update outcome</p>
                  <div className="space-y-2">
                    <Button
                      className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={updating === selected.id}
                      onClick={() => updateStatus(selected.id, "completed")}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Mark as completed
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                      disabled={updating === selected.id}
                      onClick={() => updateStatus(selected.id, "no_show")}
                    >
                      <AlertTriangle className="w-4 h-4" /> Mark as no-show
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                      disabled={updating === selected.id}
                      onClick={() => updateStatus(selected.id, "cancelled")}
                    >
                      <XCircle className="w-4 h-4" /> Cancel appointment
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Cancelled slots are freed up and can be offered to new leads.
                  </p>
                </div>
              )}

              {selected.status !== "scheduled" && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={updating === selected.id}
                  onClick={() => updateStatus(selected.id, "scheduled")}
                >
                  <Clock className="w-4 h-4" /> Restore to scheduled
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
