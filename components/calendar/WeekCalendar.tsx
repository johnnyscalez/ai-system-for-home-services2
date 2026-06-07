"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, MapPin, Phone, Wrench, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const START_HOUR = 7
const END_HOUR = 20
const HOURS = END_HOUR - START_HOUR
const HOUR_PX = 88

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

type Appointment = {
  id: string
  scheduled_at: string
  status: string
  address?: string | null
  notes?: string | null
  google_event_id?: string | null
  technician_id?: string | null
  technician_name?: string | null
  leads?: {
    first_name: string | null
    last_name: string | null
    phone: string
    status: string
  } | null
}

type GoogleEvent = {
  id?: string | null
  summary?: string | null
  start?: { dateTime?: string | null }
  end?: { dateTime?: string | null }
  location?: string | null
  htmlLink?: string | null
}

function getWeekDates(base: Date) {
  const day = base.getDay()
  const monday = new Date(base)
  monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function timeToY(dateStr: string): number {
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes()
  return Math.max(0, (h - START_HOUR) * HOUR_PX + (m / 60) * HOUR_PX)
}

function durationPx(startStr: string, endStr: string, fallbackMins = 90): number {
  const start = new Date(startStr).getTime()
  const end = endStr ? new Date(endStr).getTime() : start + fallbackMins * 60000
  return Math.max(80, ((end - start) / 60000 / 60) * HOUR_PX)
}

export function WeekCalendar() {
  const [baseDate, setBaseDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null)

  const weekDates = getWeekDates(baseDate)
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  const load = useCallback(async () => {
    setLoading(true)
    const timeMin = new Date(weekStart).toISOString()
    const end = new Date(weekEnd)
    end.setHours(23, 59, 59)
    const timeMax = end.toISOString()
    try {
      const res = await fetch(`/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`)
      const data = await res.json()
      setAppointments(data.appointments ?? [])
      setGoogleEvents(data.googleEvents ?? [])
    } finally {
      setLoading(false)
    }
  }, [weekStart.toISOString()]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Assign a color per technician in order of first appearance
  const techColorMap = useMemo(() => {
    const map = new Map<string, TechColor>()
    let idx = 0
    for (const apt of appointments) {
      if (apt.technician_id && !map.has(apt.technician_id)) {
        map.set(apt.technician_id, TECH_PALETTE[idx % TECH_PALETTE.length])
        idx++
      }
    }
    return map
  }, [appointments])

  function getColor(techId?: string | null): TechColor {
    if (!techId) return UNASSIGNED_COLOR
    return techColorMap.get(techId) ?? UNASSIGNED_COLOR
  }

  // Legend entries (tech name + color)
  const techLegend = useMemo(() => {
    const seen = new Set<string>()
    const entries: { id: string; name: string }[] = []
    for (const apt of appointments) {
      if (apt.technician_id && !seen.has(apt.technician_id)) {
        seen.add(apt.technician_id)
        entries.push({ id: apt.technician_id, name: apt.technician_name ?? "Unknown" })
      }
    }
    return entries
  }, [appointments])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

  const aptsForDay = (day: Date) =>
    appointments.filter((a) => {
      const d = new Date(a.scheduled_at)
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear()
    })

  const gcalForDay = (day: Date) =>
    googleEvents.filter((e) => {
      if (!e.start?.dateTime) return false
      const d = new Date(e.start.dateTime)
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear()
    })

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBaseDate(new Date())}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 ml-1">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">
              {MONTHS[weekStart.getMonth()]} {weekStart.getDate()} – {weekEnd.getDate() !== weekStart.getDate() ? `${weekEnd.getDate()} ` : ""}{MONTHS[weekEnd.getMonth()]} {weekEnd.getFullYear()}
            </span>
            {loading && <div className="w-3 h-3 rounded-full border border-primary border-t-transparent animate-spin" />}
          </div>
        </div>

        {/* Technician legend */}
        <div className="flex items-center flex-wrap gap-3">
          {techLegend.map(t => {
            const c = getColor(t.id)
            return (
              <div key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c.bg }} />
                {t.name}
              </div>
            )
          })}
          {appointments.some(a => !a.technician_id) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
              Unassigned
            </div>
          )}
          {googleEvents.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#F97316" }} />
              Google Calendar
            </div>
          )}
        </div>
      </div>

      {/* ── Day header row ── */}
      <div className="grid border-b border-border shrink-0" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="border-r border-border bg-muted/20" />
        {weekDates.map((day, i) => {
          const isToday = day.getTime() === today.getTime()
          const dayApts = aptsForDay(day)
          return (
            <div key={i} className={cn("px-2 py-2.5 text-center border-r border-border last:border-r-0", isToday ? "bg-primary/5" : "bg-muted/10")}>
              <p className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>{DAY_NAMES[i]}</p>
              <p className={cn("text-xl font-bold mt-0.5 leading-none", isToday ? "text-primary" : "text-foreground")}>{day.getDate()}</p>
              {dayApts.length > 0 && (
                <div className="flex justify-center gap-0.5 mt-1.5">
                  {dayApts.slice(0, 4).map(a => (
                    <div key={a.id} className="w-1.5 h-1.5 rounded-full" style={{ background: getColor(a.technician_id).bg }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Scrollable time grid ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)", height: HOURS * HOUR_PX }}>
          {/* Time column */}
          <div className="border-r border-border relative bg-muted/5">
            {Array.from({ length: HOURS }, (_, i) => {
              const h = START_HOUR + i
              const label = h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`
              return (
                <div key={i} className="absolute w-full flex items-start justify-end pr-2" style={{ top: i * HOUR_PX, height: HOUR_PX }}>
                  <span className="text-[10px] text-muted-foreground -translate-y-2">{label}</span>
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          {weekDates.map((day, dayIdx) => {
            const isToday = day.getTime() === today.getTime()
            const dayApts = aptsForDay(day)
            const dayGcal = gcalForDay(day)

            return (
              <div
                key={dayIdx}
                className={cn("border-r border-border last:border-r-0 relative", isToday && "bg-primary/[0.018]")}
              >
                {/* Hour lines */}
                {Array.from({ length: HOURS }, (_, i) => (
                  <div key={i} className="absolute w-full border-t border-border/50" style={{ top: i * HOUR_PX }} />
                ))}
                {/* Half-hour dashes */}
                {Array.from({ length: HOURS }, (_, i) => (
                  <div key={`hh${i}`} className="absolute w-full border-t border-border/25 border-dashed" style={{ top: i * HOUR_PX + HOUR_PX / 2 }} />
                ))}

                {/* Google Calendar events */}
                {dayGcal.map((ev) => {
                  if (!ev.start?.dateTime) return null
                  const top = timeToY(ev.start.dateTime)
                  const height = durationPx(ev.start.dateTime, ev.end?.dateTime ?? "")
                  if (top < 0 || top > HOURS * HOUR_PX) return null
                  return (
                    <a
                      key={ev.id}
                      href={ev.htmlLink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute left-1 right-1 rounded-lg overflow-hidden hover:brightness-95 transition-all"
                      style={{
                        top,
                        height: Math.max(height, 80),
                        backgroundColor: "rgba(249,115,22,0.08)",
                        borderLeft: "3px solid #F97316",
                        border: "1px solid rgba(249,115,22,0.25)",
                        borderLeftWidth: 3,
                        borderLeftColor: "#F97316",
                      }}
                    >
                      <div className="px-2.5 py-2 h-full flex flex-col gap-0.5">
                        <p className="text-[11px] font-bold text-[#EA580C] truncate leading-tight">{ev.summary}</p>
                        <p className="text-[10px] text-[#F97316] flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          {ev.start?.dateTime && new Date(ev.start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {ev.end?.dateTime && ` – ${new Date(ev.end.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                        </p>
                        {ev.location && (
                          <p className="text-[10px] text-[#EA580C]/70 truncate flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />{ev.location}
                          </p>
                        )}
                        <div className="mt-auto flex items-center gap-1">
                          <ExternalLink className="w-2.5 h-2.5 text-[#F97316]/60" />
                          <span className="text-[9px] text-[#F97316]/60">Google Calendar</span>
                        </div>
                      </div>
                    </a>
                  )
                })}

                {/* Our appointments */}
                {dayApts.map((apt) => {
                  const top = timeToY(apt.scheduled_at)
                  const height = durationPx(apt.scheduled_at, "")
                  const c = getColor(apt.technician_id)
                  return (
                    <button
                      key={apt.id}
                      onClick={() => setSelectedEvent(apt)}
                      className="absolute left-1 right-1 rounded-lg overflow-hidden hover:brightness-95 transition-all text-left group"
                      style={{
                        top,
                        height: Math.max(height, 80),
                        backgroundColor: c.light,
                        borderLeft: `3px solid ${c.bg}`,
                        border: `1px solid ${c.border}35`,
                        borderLeftWidth: 3,
                        borderLeftColor: c.bg,
                      }}
                    >
                      <div className="px-2.5 py-2 h-full flex flex-col gap-0.5">
                        <p className="text-[12px] font-bold truncate leading-tight" style={{ color: c.bg }}>
                          {apt.leads?.first_name} {apt.leads?.last_name}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          {new Date(apt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                        {apt.address && (
                          <p className="text-[10px] text-slate-500 truncate flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />{apt.address}
                          </p>
                        )}
                        {apt.notes && (
                          <p className="text-[10px] text-slate-400 truncate">{apt.notes}</p>
                        )}
                        {apt.technician_name && (
                          <p className="text-[10px] font-semibold mt-auto flex items-center gap-0.5" style={{ color: c.bg }}>
                            <Wrench className="w-2.5 h-2.5 shrink-0" />{apt.technician_name}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Appointment detail modal ── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Colored stripe matching tech color */}
            <div className="h-1.5" style={{ background: getColor(selectedEvent.technician_id).bg }} />
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedEvent.leads?.first_name} {selectedEvent.leads?.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {new Date(selectedEvent.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    {" · "}
                    {new Date(selectedEvent.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {selectedEvent.technician_name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wrench className="w-3.5 h-3.5" /> {selectedEvent.technician_name}
                </div>
              )}
              {selectedEvent.leads?.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {selectedEvent.leads.phone}
                </div>
              )}
              {selectedEvent.address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" /> {selectedEvent.address}
                </div>
              )}
              {selectedEvent.notes && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{selectedEvent.notes}</p>
              )}

              <div className="flex gap-2 pt-1">
                <a
                  href={`/leads/${selectedEvent.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ background: getColor(selectedEvent.technician_id).bg }}
                >
                  View lead <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
