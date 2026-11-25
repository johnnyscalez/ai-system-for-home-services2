"use client"

import { useState, useEffect, useCallback, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, MapPin, Phone, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { holidayOn } from "@/lib/holidays"
import { useVisiblePoll } from "@/components/leads/live"

const START_HOUR = 7
const END_HOUR = 20
const HOURS = END_HOUR - START_HOUR
const HOUR_PX = 96        // taller rows — more breathing room
const APT_MIN_H = 80      // our appointments: minimum block height
const GCAL_MIN_H = 38     // Google events: minimum block height (respect short durations)

type TechColor = { bg: string; light: string; border: string }
// One neutral color for every measure block.
const APT_COLOR: TechColor = { bg: "#57534E", light: "rgba(87,83,78,0.09)", border: "#A8A29E" }

type Appointment = {
  id: string
  lead_id?: string | null
  scheduled_at: string
  status: string
  address?: string | null
  notes?: string | null
  google_event_id?: string | null
  leads?: { first_name: string | null; last_name: string | null; phone: string; status: string } | null
}

type GoogleEvent = {
  id?: string | null
  summary?: string | null
  start?: { dateTime?: string | null }
  end?: { dateTime?: string | null }
  location?: string | null
  htmlLink?: string | null
}

// ─── Column layout algorithm ───────────────────────────────────────────────────
// Assigns each event a (col, numCols) pair so concurrent events sit side-by-side
// instead of stacking on top of each other.
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Closed-day hatching for US holidays (lib/holidays.ts): nothing is booked there. */
const HOLIDAY_FILL: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, rgba(120,113,108,0.07) 0 6px, transparent 6px 12px)",
}

// All calendar math runs on the COMPANY's clock, never the viewer's browser —
// a 3:00 PM Chicago job must sit on the 3 PM row (and the right day) whether
// the office views it from Illinois or the owner from a UTC+3 browser.
function dayKeyTz(d: Date, tz: string): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz })
}

/** Local-noon moment of the company's current calendar day. */
function companyToday(tz: string): Date {
  return new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: tz })}T12:00:00`)
}

function getWeekDates(base: Date) {
  const day = base.getDay()
  const monday = new Date(base)
  monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
  // Noon, not midnight: keeps each column moment on the same calendar day in
  // both the browser's and the company's timezone (any viewer within ±12h).
  monday.setHours(12, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function timeToY(dateStr: string, tz: string): number {
  const hm = new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  })
  const [h, m] = hm.split(":").map(Number)
  return Math.max(0, (h - START_HOUR) * HOUR_PX + (m / 60) * HOUR_PX)
}

function durationPx(startStr: string, endStr: string, fallbackMins = 90): number {
  const start = new Date(startStr).getTime()
  const end = endStr ? new Date(endStr).getTime() : start + fallbackMins * 60000
  return ((end - start) / 60000 / 60) * HOUR_PX
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeekCalendar({ timezone }: { timezone?: string }) {
  const tz = timezone ?? "America/New_York"
  const [baseDate, setBaseDate] = useState(() => companyToday(tz))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null)

  const weekDates = getWeekDates(baseDate)
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  // `silent` = background refresh: no spinner, and a failed fetch keeps what is on screen.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const timeMin = new Date(weekStart.getTime() - 24 * 3600e3).toISOString()
    const timeMax = new Date(weekEnd.getTime() + 24 * 3600e3).toISOString()
    try {
      const res = await fetch(`/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`)
      if (!res.ok) return
      const data = await res.json()
      // Cancelled measures are not on the calendar (the API filters them too).
      setAppointments(((data.appointments ?? []) as Appointment[]).filter(a => a.status !== "cancelled"))
      setGoogleEvents(data.googleEvents ?? [])
    } catch {
      /* keep the last good view */
    } finally {
      if (!silent) setLoading(false)
    }
  }, [weekStart.toISOString()]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Measures the assistant books or moves show within 20 seconds, no reload.
  useVisiblePoll(() => { void load(true) }, 20_000)

  const todayKey = dayKeyTz(new Date(), tz)

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

  const aptsForDay = (day: Date) =>
    appointments.filter(a => dayKeyTz(new Date(a.scheduled_at), tz) === dayKeyTz(day, tz))

  const gcalForDay = (day: Date) =>
    googleEvents.filter(e => e.start?.dateTime && dayKeyTz(new Date(e.start.dateTime), tz) === dayKeyTz(day, tz))

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBaseDate(companyToday(tz))}>Today</Button>
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

        <div className="flex items-center flex-wrap gap-3">
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
          const isToday = dayKeyTz(day, tz) === todayKey
          const dayApts = aptsForDay(day)
          const holiday = holidayOn(dayKeyTz(day, tz))
          return (
            <div key={i} className={cn("px-2 py-2.5 text-center border-r border-border last:border-r-0", isToday ? "bg-primary/5" : "bg-muted/10")}>
              <p className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>{DAY_NAMES[i]}</p>
              <p className={cn("text-xl font-bold mt-0.5 leading-none", isToday ? "text-primary" : "text-foreground")}>{day.getDate()}</p>
              {holiday && (
                <p className="mt-1 text-[10px] font-semibold leading-tight text-[#EA580C]" title={`${holiday.name}: closed, no measures are booked`}>
                  {holiday.name} · Closed
                </p>
              )}
              {dayApts.length > 0 && (
                <div className="flex justify-center gap-0.5 mt-1.5">
                  {dayApts.slice(0, 4).map(a => (
                    <div key={a.id} className="w-1.5 h-1.5 rounded-full" style={{ background: APT_COLOR.bg }} />
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
            const isToday = dayKeyTz(day, tz) === todayKey
            const dayApts = aptsForDay(day)
            const dayGcal = gcalForDay(day)

            // Compute heights for layout
            const aptHeights = dayApts.map(a => ({
              id: a.id,
              top: timeToY(a.scheduled_at, tz),
              height: Math.max(APT_MIN_H, durationPx(a.scheduled_at, "")),
            }))
            const gcalHeights = dayGcal.map(e => ({
              id: e.id ?? `gcal-${dayIdx}-${e.summary}`,
              top: e.start?.dateTime ? timeToY(e.start.dateTime, tz) : 0,
              height: e.start?.dateTime
                ? Math.max(GCAL_MIN_H, durationPx(e.start.dateTime, e.end?.dateTime ?? ""))
                : GCAL_MIN_H,
            }))

            // Run layout for all events together so they avoid each other
            const allLayouts = layoutColumns([...aptHeights, ...gcalHeights])

            return (
              <div
                key={dayIdx}
                className={cn("border-r border-border last:border-r-0 relative", isToday && "bg-primary/[0.018]")}
                style={holidayOn(dayKeyTz(day, tz)) ? HOLIDAY_FILL : undefined}
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
                  const evId = ev.id ?? `gcal-${dayIdx}-${ev.summary}`
                  const top = timeToY(ev.start.dateTime, tz)
                  const height = Math.max(GCAL_MIN_H, durationPx(ev.start.dateTime, ev.end?.dateTime ?? ""))
                  if (top < 0 || top > HOURS * HOUR_PX) return null
                  const layout = allLayouts[evId] ?? { col: 0, numCols: 1 }
                  const leftPct = (layout.col / layout.numCols) * 100
                  const widthPct = (1 / layout.numCols) * 100
                  return (
                    <a
                      key={evId}
                      href={ev.htmlLink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute rounded-lg overflow-hidden hover:brightness-95 transition-all"
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: "rgba(249,115,22,0.08)",
                        borderLeft: "3px solid #F97316",
                        border: "1px solid rgba(249,115,22,0.25)",
                        borderLeftWidth: 3,
                        borderLeftColor: "#F97316",
                      }}
                    >
                      <div className="px-1.5 py-1 h-full flex flex-col gap-0.5 overflow-hidden">
                        <p className="text-[10px] font-bold text-[#EA580C] truncate leading-tight">{ev.summary}</p>
                        {height > 50 && ev.start?.dateTime && (
                          <p className="text-[9px] text-[#F97316] flex items-center gap-0.5">
                            <Clock className="w-2 h-2 shrink-0" />
                            {new Date(ev.start.dateTime).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })}
                            {ev.end?.dateTime && ` – ${new Date(ev.end.dateTime).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })}`}
                          </p>
                        )}
                        {height > 70 && ev.location && (
                          <p className="text-[9px] text-[#EA580C]/70 truncate flex items-center gap-0.5">
                            <MapPin className="w-2 h-2 shrink-0" />{ev.location}
                          </p>
                        )}
                        {height > 80 && (
                          <div className="mt-auto flex items-center gap-1">
                            <ExternalLink className="w-2 h-2 text-[#F97316]/60" />
                            <span className="text-[8px] text-[#F97316]/60">GCal</span>
                          </div>
                        )}
                      </div>
                    </a>
                  )
                })}

                {/* Our measures */}
                {dayApts.map((apt) => {
                  const top = timeToY(apt.scheduled_at, tz)
                  const height = Math.max(APT_MIN_H, durationPx(apt.scheduled_at, ""))
                  const c = APT_COLOR
                  const layout = allLayouts[apt.id] ?? { col: 0, numCols: 1 }
                  const leftPct = (layout.col / layout.numCols) * 100
                  const widthPct = (1 / layout.numCols) * 100
                  return (
                    <button
                      key={apt.id}
                      onClick={() => setSelectedEvent(apt)}
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
                      <div className="px-2 py-1.5 h-full flex flex-col gap-0.5 overflow-hidden">
                        <p className="text-[11px] font-bold truncate leading-tight" style={{ color: c.bg }}>
                          {apt.leads?.first_name} {apt.leads?.last_name}
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          {new Date(apt.scheduled_at).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })}
                        </p>
                        {apt.address && height > 75 && (
                          <p className="text-[10px] text-slate-500 truncate flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />{apt.address}
                          </p>
                        )}
                        {apt.notes && height > 100 && (
                          <p className="text-[9px] text-slate-400 truncate">{apt.notes}</p>
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

      {/* ── Measure detail modal ── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5" style={{ background: APT_COLOR.bg }} />
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-lg">
                  {selectedEvent.leads?.first_name} {selectedEvent.leads?.last_name}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {new Date(selectedEvent.scheduled_at).toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" })}
                  {" · "}
                  {new Date(selectedEvent.scheduled_at).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
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
                  href={`/leads/${selectedEvent.lead_id ?? selectedEvent.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ background: APT_COLOR.bg }}
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
