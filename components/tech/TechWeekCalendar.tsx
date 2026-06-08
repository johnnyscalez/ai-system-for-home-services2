"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, MapPin, Phone, Clock, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const START_HOUR = 7
const END_HOUR   = 20
const HOUR_PX    = 80

type Lead = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  service_type: string | null
  job_type: string | null
  status: string
}

type Appointment = {
  id: string
  scheduled_at: string
  status: string
  address?: string | null
  notes?: string | null
  technician_name?: string | null
  leads?: Lead | null
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

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate()
}

export function TechWeekCalendar() {
  const [baseDate, setBaseDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<Appointment | null>(null)

  const weekDates = getWeekDates(baseDate)
  const weekStart = weekDates[0]
  const weekEnd   = weekDates[6]

  const load = useCallback(async () => {
    setLoading(true)
    const timeMin = new Date(weekStart).toISOString()
    const end = new Date(weekEnd); end.setHours(23, 59, 59)
    const timeMax = end.toISOString()
    try {
      const res = await fetch(`/api/tech/appointments/calendar?timeMin=${timeMin}&timeMax=${timeMax}`)
      const data = await res.json()
      setAppointments(data.appointments ?? [])
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.toISOString()])

  useEffect(() => { load() }, [load])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const HOURS = END_HOUR - START_HOUR
  const hours = Array.from({ length: HOURS + 1 }, (_, i) => START_HOUR + i)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Week nav bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E5E4] bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F5F4F2] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[#78716C]" />
          </button>
          <span className="text-sm font-semibold text-[#1C1917]">
            {weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            {" — "}
            {weekEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <button
            onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F5F4F2] transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-[#78716C]" />
          </button>
        </div>
        <button
          onClick={() => setBaseDate(new Date())}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#E7E5E4] text-[#78716C] hover:bg-[#F5F4F2] transition-colors"
        >
          Today
        </button>
      </div>

      {/* Day headers */}
      <div className="grid border-b border-[#E7E5E4] bg-white shrink-0"
        style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
        <div className="h-10" />
        {weekDates.map((d) => {
          const isToday = sameDay(d, today)
          const dayApts = appointments.filter(a => sameDay(new Date(a.scheduled_at), d))
          return (
            <div key={d.toISOString()} className="flex flex-col items-center justify-center py-1.5 border-l border-[#E7E5E4]">
              <span className="text-[10px] text-[#A8A29E] uppercase tracking-wide">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <div className={cn(
                "w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mt-0.5",
                isToday ? "bg-[#F97316] text-white" : "text-[#1C1917]"
              )}>
                {d.getDate()}
              </div>
              {dayApts.length > 0 && (
                <span className="text-[9px] text-[#F97316] font-medium mt-0.5">
                  {dayApts.length} job{dayApts.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#A8A29E] text-sm gap-2">
            <div className="w-4 h-4 border-2 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
            Loading calendar…
          </div>
        ) : (
          <div className="grid relative" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
            {/* Hour labels */}
            <div>
              {hours.map(h => (
                <div key={h} style={{ height: HOUR_PX }} className="flex items-start justify-end pr-2 pt-1">
                  <span className="text-[10px] text-[#A8A29E]">
                    {h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDates.map((d) => {
              const dayApts = appointments.filter(a => sameDay(new Date(a.scheduled_at), d))
              return (
                <div key={d.toISOString()} className="border-l border-[#E7E5E4] relative"
                  style={{ height: HOUR_PX * HOURS }}>
                  {/* Hour lines */}
                  {hours.map(h => (
                    <div key={h} style={{ top: (h - START_HOUR) * HOUR_PX }}
                      className="absolute left-0 right-0 border-t border-[#F5F4F2]" />
                  ))}

                  {/* Current time line */}
                  {sameDay(d, today) && (() => {
                    const now = new Date()
                    const yPx = (now.getHours() - START_HOUR) * HOUR_PX + (now.getMinutes() / 60) * HOUR_PX
                    if (yPx < 0 || yPx > HOUR_PX * HOURS) return null
                    return (
                      <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: yPx }}>
                        <div className="w-2 h-2 rounded-full bg-[#F97316] -ml-1 shrink-0" />
                        <div className="flex-1 h-px bg-[#F97316]" />
                      </div>
                    )
                  })()}

                  {/* Appointment cards */}
                  {dayApts.map(apt => {
                    const top = timeToY(apt.scheduled_at)
                    const lead = apt.leads
                    const name = lead
                      ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Lead"
                      : "Job"
                    const isClosed = apt.status === "completed" || lead?.status === "closed_won"
                    const time = new Date(apt.scheduled_at).toLocaleTimeString("en-US", {
                      hour: "numeric", minute: "2-digit"
                    })

                    return (
                      <motion.button
                        key={apt.id}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => setSelected(apt)}
                        className={cn(
                          "absolute left-1 right-1 rounded-xl border text-left overflow-hidden z-20 shadow-sm",
                          isClosed
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-[#FFF3EC] border-[#F97316]/30"
                        )}
                        style={{ top, minHeight: 52 }}
                      >
                        <div className={cn(
                          "h-1 w-full",
                          isClosed ? "bg-emerald-400" : "bg-[#F97316]"
                        )} />
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-semibold text-[#1C1917] truncate">{name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-[#A8A29E] shrink-0" />
                            <span className="text-[10px] text-[#78716C]">{time}</span>
                          </div>
                          {apt.address && (
                            <div className="flex items-start gap-1 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-[#A8A29E] shrink-0 mt-0.5" />
                              <span className="text-[10px] text-[#78716C] truncate">{apt.address}</span>
                            </div>
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Event detail overlay */}
      {selected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className={cn(
              "h-1.5",
              selected.status === "completed" || selected.leads?.status === "closed_won"
                ? "bg-emerald-400"
                : "bg-[#F97316]"
            )} />

            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#1C1917] text-base">
                    {selected.leads
                      ? `${selected.leads.first_name ?? ""} ${selected.leads.last_name ?? ""}`.trim() || "Lead"
                      : "Job"}
                  </p>
                  {selected.leads?.service_type && (
                    <p className="text-sm text-[#78716C] capitalize mt-0.5">
                      {(selected.leads.job_type ?? selected.leads.service_type).replace(/_/g, " ")}
                    </p>
                  )}
                </div>
                {(selected.status === "completed" || selected.leads?.status === "closed_won") && (
                  <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Closed
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-[#A8A29E] shrink-0" />
                  <span className="text-[#1C1917]">
                    {new Date(selected.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    {" at "}
                    {new Date(selected.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                {selected.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-3.5 h-3.5 text-[#A8A29E] shrink-0 mt-0.5" />
                    <span className="text-[#1C1917]">{selected.address}</span>
                  </div>
                )}
                {selected.leads?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-3.5 h-3.5 text-[#A8A29E] shrink-0" />
                    <a href={`tel:${selected.leads.phone}`} className="text-[#F97316] hover:underline font-mono text-xs">
                      {selected.leads.phone}
                    </a>
                  </div>
                )}
              </div>

              {selected.notes && (
                <p className="text-xs text-[#78716C] bg-[#F5F4F2] rounded-xl p-3 leading-relaxed">
                  {selected.notes}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 text-sm py-2 rounded-xl border border-[#E7E5E4] text-[#78716C] hover:bg-[#F5F4F2] transition-colors"
                >
                  Close
                </button>
                <a
                  href={`/tech/appointments/${selected.id}`}
                  className="flex-1 text-sm py-2 rounded-xl bg-[#F97316] text-white font-semibold text-center hover:bg-[#ea6d04] transition-colors"
                >
                  View job
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
