"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, MapPin, Phone } from "lucide-react"
import { cn } from "@/lib/utils"

const START_HOUR = 7   // 7am
const END_HOUR = 21    // 9pm
const HOURS = END_HOUR - START_HOUR
const HOUR_PX = 72     // pixels per hour

type Appointment = {
  id: string
  scheduled_at: string
  status: string
  address?: string | null
  notes?: string | null
  google_event_id?: string | null
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

function durationPx(startStr: string, endStr: string, fallbackMins = 60): number {
  const start = new Date(startStr).getTime()
  const end = endStr ? new Date(endStr).getTime() : start + fallbackMins * 60000
  return Math.max(32, ((end - start) / 60000 / 60) * HOUR_PX)
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

  const statusColor: Record<string, string> = {
    scheduled: "bg-sky-500 border-sky-400",
    completed: "bg-emerald-500 border-emerald-400",
    cancelled: "bg-red-500/70 border-red-400",
    no_show: "bg-amber-500/70 border-amber-400",
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBaseDate(new Date())}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {MONTHS[weekStart.getMonth()]} {weekStart.getDate()} – {weekEnd.getDate() !== weekStart.getDate() ? `${weekEnd.getDate()} ` : ""}{MONTHS[weekEnd.getMonth()]} {weekEnd.getFullYear()}
          </span>
          {loading && <div className="w-3 h-3 rounded-full border border-primary border-t-transparent animate-spin" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-sky-500" />Our appointments</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#F97316]" />Google Calendar</div>
        </div>
      </div>

      {/* Day header row */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border shrink-0">
        <div className="border-r border-border" />
        {weekDates.map((day, i) => {
          const isToday = day.getTime() === today.getTime()
          const aptCount = aptsForDay(day).length
          return (
            <div key={i} className={cn(
              "px-2 py-3 text-center border-r border-border last:border-r-0",
              isToday && "bg-primary/5"
            )}>
              <p className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
                {DAY_NAMES[i]}
              </p>
              <p className={cn(
                "text-lg font-bold mt-0.5",
                isToday ? "text-primary" : "text-foreground"
              )}>
                {day.getDate()}
              </p>
              {aptCount > 0 && (
                <div className="flex justify-center mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: HOURS * HOUR_PX }}>
          {/* Time column */}
          <div className="border-r border-border relative">
            {Array.from({ length: HOURS }, (_, i) => {
              const h = START_HOUR + i
              const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`
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
                className={cn(
                  "border-r border-border last:border-r-0 relative",
                  isToday && "bg-primary/3"
                )}
              >
                {/* Hour lines */}
                {Array.from({ length: HOURS }, (_, i) => (
                  <div
                    key={i}
                    className="absolute w-full border-t border-border/50"
                    style={{ top: i * HOUR_PX }}
                  />
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
                      className="absolute left-0.5 right-0.5 rounded-md overflow-hidden hover:brightness-95 transition-all group"
                      style={{
                        top,
                        height: Math.max(height, 24),
                        background: "rgba(109,40,217,0.12)",
                        borderLeft: "3px solid #7c3aed",
                        borderTop: "1px solid rgba(249,115,22,0.25)",
                        borderRight: "1px solid rgba(249,115,22,0.25)",
                        borderBottom: "1px solid rgba(249,115,22,0.25)",
                      }}
                    >
                      <div className="px-1.5 py-1 h-full">
                        <p className="text-[11px] font-semibold text-[#EA580C] truncate leading-tight">{ev.summary}</p>
                        {ev.location && height > 42 && (
                          <p className="text-[10px] text-[#EA580C] truncate mt-0.5">{ev.location}</p>
                        )}
                        {height > 54 && ev.start?.dateTime && (
                          <p className="text-[9px] text-[#F97316] mt-0.5">
                            {new Date(ev.start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            {ev.end?.dateTime && ` – ${new Date(ev.end.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                          </p>
                        )}
                      </div>
                    </a>
                  )
                })}

                {/* Our appointments */}
                {dayApts.map((apt) => {
                  const top = timeToY(apt.scheduled_at)
                  const height = durationPx(apt.scheduled_at, "")
                  const colorClass = statusColor[apt.status] ?? "bg-sky-500 border-sky-400"
                  return (
                    <button
                      key={apt.id}
                      onClick={() => setSelectedEvent(apt)}
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded border px-1.5 py-1 text-left overflow-hidden transition-opacity hover:opacity-90",
                        colorClass
                      )}
                      style={{ top, height: Math.max(height, 28) }}
                    >
                      <p className="text-[10px] font-semibold text-white truncate leading-tight">
                        {apt.leads?.first_name} {apt.leads?.last_name}
                      </p>
                      {height > 40 && apt.address && (
                        <p className="text-[9px] text-white/70 truncate">{apt.address}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Appointment detail panel */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={() => setSelectedEvent(null)}>
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm mx-4 mb-0 sm:mb-0 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {selectedEvent.leads?.first_name} {selectedEvent.leads?.last_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedEvent.scheduled_at).toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric"
                  })}
                  {" at "}
                  {new Date(selectedEvent.scheduled_at).toLocaleTimeString("en-US", {
                    hour: "numeric", minute: "2-digit"
                  })}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  selectedEvent.status === "scheduled" ? "bg-sky-500/15 text-sky-400 border-sky-500/20" :
                  selectedEvent.status === "completed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                  "bg-red-500/15 text-red-400 border-red-500/20"
                )}
              >
                {selectedEvent.status}
              </Badge>
            </div>

            {selectedEvent.leads?.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                {selectedEvent.leads.phone}
              </div>
            )}

            {selectedEvent.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {selectedEvent.address}
              </div>
            )}

            {selectedEvent.notes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{selectedEvent.notes}</p>
            )}

            {selectedEvent.google_event_id && (
              <div className="flex items-center gap-1.5 text-xs text-[#F97316]">
                <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                Synced to Google Calendar
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <a
                href={`/leads/${selectedEvent.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                View lead <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
