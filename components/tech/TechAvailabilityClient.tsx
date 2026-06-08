"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Save, Loader2, CheckCircle2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DAYS = [
  { key: "monday",    label: "Monday" },
  { key: "tuesday",   label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday",  label: "Thursday" },
  { key: "friday",    label: "Friday" },
  { key: "saturday",  label: "Saturday" },
  { key: "sunday",    label: "Sunday" },
]

const DEFAULT_TIMES = { start: "08:00", end: "17:00" }

type DaySchedule = { enabled: boolean; start: string; end: string }
type Schedule = Record<string, DaySchedule>

const DEFAULT_SCHEDULE: Schedule = Object.fromEntries(
  DAYS.map(d => [d.key, {
    enabled: ["monday","tuesday","wednesday","thursday","friday"].includes(d.key),
    ...DEFAULT_TIMES,
  }])
)

export function TechAvailabilityClient() {
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    fetch("/api/tech/availability")
      .then(r => r.json())
      .then(d => { if (d.schedule) setSchedule(d.schedule) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleDay = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }))
    setSaved(false)
  }

  const setTime = (day: string, field: "start" | "end", value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
    setSaved(false)
  }

  const save = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch("/api/tech/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch { /* non-fatal */ }
    finally { setSaving(false) }
  }, [schedule])

  const enabledCount = DAYS.filter(d => schedule[d.key]?.enabled).length

  return (
    <div className="relative min-h-screen bg-[#FAFAF8] overflow-hidden">
      {/* Visual background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <motion.div animate={{ y: [0,-20,0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(249,115,22,0.06)", top: "-10%", right: "5%" }} />
        <motion.div animate={{ y: [0,18,0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.05)", bottom: "-5%", left: "-5%" }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto p-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="mb-8">
          <h1 className="text-2xl font-bold text-[#1C1917]">My Availability</h1>
          <p className="text-sm text-[#78716C] mt-1">
            Set which days and hours you&apos;re available for jobs. The AI uses this to offer slots when booking appointments for you.
          </p>
        </motion.div>

        {/* Info callout */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
          className="flex items-start gap-3 bg-[#FFF3EC] border border-[#F97316]/20 rounded-xl p-4 mb-6">
          <Info className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" />
          <p className="text-sm text-[#78716C] leading-relaxed">
            Your schedule syncs with the AI booking agent and your manager&apos;s calendar. When the AI finds time slots for a new job, it only offers slots that fall within your working hours.
          </p>
        </motion.div>

        {/* Schedule card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden mb-6">

          <div className="px-6 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
            <div>
              <p className="font-semibold text-[#1C1917]">Weekly schedule</p>
              <p className="text-xs text-[#78716C] mt-0.5">{enabledCount} day{enabledCount !== 1 ? "s" : ""} active</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[#A8A29E]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading schedule…</span>
            </div>
          ) : (
            <div className="divide-y divide-[#E7E5E4]">
              {DAYS.map(({ key, label }, i) => {
                const day = schedule[key] ?? { enabled: false, ...DEFAULT_TIMES }
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: 0.05 * i }}
                    className={cn(
                      "flex items-center gap-4 px-6 py-4 transition-colors",
                      day.enabled ? "bg-white" : "bg-[#FAFAF8]"
                    )}
                  >
                    {/* Toggle */}
                    <button
                      role="switch"
                      aria-checked={day.enabled}
                      onClick={() => toggleDay(key)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        day.enabled ? "bg-[#F97316]" : "bg-[#D6D3D1]"
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        day.enabled ? "translate-x-4" : "translate-x-0"
                      )} />
                    </button>

                    {/* Day label */}
                    <span className={cn("w-24 text-sm font-medium", day.enabled ? "text-[#1C1917]" : "text-[#A8A29E]")}>
                      {label}
                    </span>

                    {/* Time inputs */}
                    {day.enabled ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          type="time"
                          value={day.start}
                          onChange={e => setTime(key, "start", e.target.value)}
                          className="text-sm border border-[#E7E5E4] rounded-lg px-3 py-1.5 bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]"
                        />
                        <span className="text-sm text-[#A8A29E]">–</span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={e => setTime(key, "end", e.target.value)}
                          className="text-sm border border-[#E7E5E4] rounded-lg px-3 py-1.5 bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]"
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-xs text-[#A8A29E]">Off</span>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Save */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex items-center gap-4">
          <Button
            onClick={save}
            disabled={saving || loading}
            className="bg-[#F97316] hover:bg-[#ea6d04] text-white gap-2 px-6 shadow-sm"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save schedule</>
            }
          </Button>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 text-sm text-emerald-600"
            >
              <CheckCircle2 className="w-4 h-4" />
              Saved — AI is using your schedule
            </motion.span>
          )}
        </motion.div>
      </div>
    </div>
  )
}
