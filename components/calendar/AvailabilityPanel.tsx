"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Save, Loader2, CheckCircle2, ChevronDown, ChevronUp, Settings2 } from "lucide-react"
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

export function AvailabilityPanel() {
  const [open, setOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [availableDays, setAvailableDays] = useState<string[]>(DEFAULT_DAYS)
  const [windows, setWindows] = useState<AppointmentWindow[]>(DEFAULT_WINDOWS)
  const [horizonDays, setHorizonDays] = useState(7)
  const [maxPerDay, setMaxPerDay] = useState<number | null>(null)
  const [timezone, setTimezone] = useState("America/New_York")

  // Load current settings
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
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    )
    setSaved(false)
  }

  const updateWindowTime = (id: string, field: "start" | "end", value: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    )
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
    <div className="border-b border-border bg-card shrink-0">
      {/* Panel toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Availability</span>
          <span className="text-xs text-muted-foreground">
            — {availableDays.length} days · {windows.filter((w) => w.enabled).length} time windows · {horizonDays}d horizon
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {/* Days */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available days</p>
                <div className="flex gap-1.5 flex-wrap">
                  {ALL_DAYS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => toggleDay(value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        availableDays.includes(value)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time windows */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time windows</p>
                <div className="space-y-2">
                  {windows.map((w) => (
                    <div key={w.id} className="flex items-center gap-3">
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
                      <span className={cn("text-xs w-24", !w.enabled && "text-muted-foreground")}>
                        {w.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={w.start}
                          onChange={(e) => updateWindowTime(w.id, "start", e.target.value)}
                          disabled={!w.enabled}
                          className="text-xs border border-border rounded-md px-2 py-1 bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <input
                          type="time"
                          value={w.end}
                          onChange={(e) => updateWindowTime(w.id, "end", e.target.value)}
                          disabled={!w.enabled}
                          className="text-xs border border-border rounded-md px-2 py-1 bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Horizon + max + timezone row */}
              <div className="flex flex-wrap gap-5">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking window</p>
                  <div className="flex gap-1.5">
                    {HORIZON_OPTIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => { setHorizonDays(d); setSaved(false) }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                          horizonDays === d
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max per day</p>
                  <div className="flex gap-1.5">
                    {[null, 1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={String(n)}
                        onClick={() => { setMaxPerDay(n); setSaved(false) }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                          maxPerDay === n
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                        )}
                      >
                        {n === null ? "∞" : n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timezone</p>
                  <select
                    value={timezone}
                    onChange={(e) => { setTimezone(e.target.value); setSaved(false) }}
                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-background"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz.replace("America/", "").replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center gap-3">
                <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
                  {saving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : <><Save className="w-3.5 h-3.5" /> Save availability</>
                  }
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved — AI is using these slots
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
