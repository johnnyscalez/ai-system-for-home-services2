"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Save, Loader2, CheckCircle2, X, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { DEFAULT_WINDOWS, DEFAULT_DAYS } from "@/lib/availability"
import type { AppointmentWindow } from "@/lib/availability"

const ALL_DAYS = [
  { value: "monday",    label: "Mon" },
  { value: "tuesday",   label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday",  label: "Thu" },
  { value: "friday",    label: "Fri" },
  { value: "saturday",  label: "Sat" },
  { value: "sunday",    label: "Sun" },
]

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
]

const HORIZON_OPTIONS = [3, 5, 7, 10, 14]

type Props = { onClose: () => void }

export function AvailabilityDrawer({ onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [availableDays, setAvailableDays] = useState<string[]>(DEFAULT_DAYS)
  const [windows, setWindows] = useState<AppointmentWindow[]>(DEFAULT_WINDOWS)
  const [horizonDays, setHorizonDays] = useState(7)
  const [maxPerDay, setMaxPerDay] = useState<number | null>(null)
  const [timezone, setTimezone] = useState("America/New_York")

  useEffect(() => {
    fetch("/api/settings/availability")
      .then((r) => r.json())
      .then((data) => {
        if (data.available_days) setAvailableDays(data.available_days)
        if (data.appointment_windows) setWindows(data.appointment_windows)
        if (data.booking_horizon_days) setHorizonDays(data.booking_horizon_days)
        if (data.max_appointments_per_day !== undefined) setMaxPerDay(data.max_appointments_per_day)
        if (data.timezone) setTimezone(data.timezone)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleDay = (day: string) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
    setSaved(false)
  }

  const toggleWindow = (id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)))
    setSaved(false)
  }

  const updateWindowTime = (id: string, field: "start" | "end", value: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)))
    setSaved(false)
  }

  const save = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch("/api/settings/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          available_days: availableDays,
          appointment_windows: windows,
          booking_horizon_days: horizonDays,
          max_appointments_per_day: maxPerDay,
          timezone,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* non-fatal */ }
    finally { setSaving(false) }
  }, [availableDays, windows, horizonDays, maxPerDay, timezone])

  return (
    <>
      {/* Drawer header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Availability</p>
            <p className="text-[10px] text-muted-foreground">When the AI can book appointments</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer body — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading settings…
          </div>
        ) : (
          <>
            {/* Available days */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available days</p>
              <div className="grid grid-cols-7 gap-1">
                {ALL_DAYS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => toggleDay(value)}
                    className={cn(
                      "py-2 rounded-lg text-xs font-medium border transition-all",
                      availableDays.includes(value)
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time windows */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time windows</p>
              <div className="space-y-2">
                {windows.map((w) => (
                  <div
                    key={w.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      w.enabled ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"
                    )}
                  >
                    <button
                      role="switch"
                      aria-checked={w.enabled}
                      onClick={() => toggleWindow(w.id)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        w.enabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                          w.enabled ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                    <span className={cn("text-xs font-medium w-24", !w.enabled && "text-muted-foreground")}>
                      {w.label}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <input
                        type="time"
                        value={w.start}
                        onChange={(e) => updateWindowTime(w.id, "start", e.target.value)}
                        disabled={!w.enabled}
                        className="text-xs border border-border rounded-lg px-2 py-1 bg-background disabled:opacity-40 disabled:cursor-not-allowed w-24"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={w.end}
                        onChange={(e) => updateWindowTime(w.id, "end", e.target.value)}
                        disabled={!w.enabled}
                        className="text-xs border border-border rounded-lg px-2 py-1 bg-background disabled:opacity-40 disabled:cursor-not-allowed w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Booking window */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking window</p>
              <div className="flex gap-1.5">
                {HORIZON_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setHorizonDays(d); setSaved(false) }}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-medium border transition-all",
                      horizonDays === d
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">How far ahead the AI can schedule</p>
            </div>

            {/* Max per day */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max appointments per day</p>
              <div className="flex gap-1.5">
                {[null, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={String(n)}
                    onClick={() => { setMaxPerDay(n); setSaved(false) }}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-medium border transition-all",
                      maxPerDay === n
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {n === null ? "∞" : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timezone</p>
              <select
                value={timezone}
                onChange={(e) => { setTimezone(e.target.value); setSaved(false) }}
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace("America/", "").replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Drawer footer — save button pinned to bottom */}
      <div className="px-5 py-4 border-t border-border shrink-0 bg-card">
        <Button onClick={save} disabled={saving || loading} className="w-full gap-2">
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
            : <><Save className="w-3.5 h-3.5" /> Save availability</>
          }
        </Button>
        {saved && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved — AI is using these slots
          </p>
        )}
      </div>
    </>
  )
}
