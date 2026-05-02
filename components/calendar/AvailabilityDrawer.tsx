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
      {/* Header */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings2 className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-base font-semibold">Edit Availability</p>
            <p className="text-xs text-muted-foreground mt-0.5">Control when the AI books appointments</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-7 py-7 space-y-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
          </div>
        ) : (
          <>
            {/* Available days */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Available days</p>
                <p className="text-xs text-muted-foreground mt-0.5">Days the AI can offer appointment slots</p>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {ALL_DAYS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => toggleDay(value)}
                    className={cn(
                      "py-3 rounded-xl text-sm font-semibold border transition-all",
                      availableDays.includes(value)
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 text-muted-foreground border-transparent hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" />

            {/* Time windows */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Time windows</p>
                <p className="text-xs text-muted-foreground mt-0.5">Which parts of the day can be booked</p>
              </div>
              <div className="space-y-2.5">
                {windows.map((w) => (
                  <div
                    key={w.id}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-all",
                      w.enabled
                        ? "bg-primary/5 border-primary/25 shadow-sm"
                        : "bg-muted/20 border-border/60"
                    )}
                  >
                    {/* Toggle */}
                    <button
                      role="switch"
                      aria-checked={w.enabled}
                      onClick={() => toggleWindow(w.id)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        w.enabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                          w.enabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>

                    {/* Label */}
                    <span className={cn("text-sm font-medium w-28 shrink-0", !w.enabled && "text-muted-foreground")}>
                      {w.label}
                    </span>

                    {/* Times */}
                    <div className="flex items-center gap-2 ml-auto">
                      <input
                        type="time"
                        value={w.start}
                        onChange={(e) => updateWindowTime(w.id, "start", e.target.value)}
                        disabled={!w.enabled}
                        className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <span className="text-sm text-muted-foreground font-medium">–</span>
                      <input
                        type="time"
                        value={w.end}
                        onChange={(e) => updateWindowTime(w.id, "end", e.target.value)}
                        disabled={!w.enabled}
                        className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" />

            {/* Booking window + max per day side by side */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Booking window</p>
                  <p className="text-xs text-muted-foreground mt-0.5">How far ahead the AI schedules</p>
                </div>
                <div className="flex gap-1.5">
                  {HORIZON_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => { setHorizonDays(d); setSaved(false) }}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all",
                        horizonDays === d
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 text-muted-foreground border-transparent hover:border-primary/30 hover:bg-primary/5"
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Max per day</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Appointments cap per day</p>
                </div>
                <div className="flex gap-1.5">
                  {[null, 1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={String(n)}
                      onClick={() => { setMaxPerDay(n); setSaved(false) }}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all",
                        maxPerDay === n
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 text-muted-foreground border-transparent hover:border-primary/30 hover:bg-primary/5"
                      )}
                    >
                      {n === null ? "∞" : n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" />

            {/* Timezone */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Timezone</p>
                <p className="text-xs text-muted-foreground mt-0.5">All appointment times use this timezone</p>
              </div>
              <select
                value={timezone}
                onChange={(e) => { setTimezone(e.target.value); setSaved(false) }}
                className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-background"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace("America/", "").replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Footer — save pinned to bottom */}
      <div className="px-7 py-5 border-t border-border shrink-0 bg-card space-y-3">
        <Button onClick={save} disabled={saving || loading} size="lg" className="w-full gap-2 text-sm">
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Save className="w-4 h-4" /> Save availability</>
          }
        </Button>
        {saved && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-500">
            <CheckCircle2 className="w-4 h-4" /> Saved — AI is using these slots
          </p>
        )}
      </div>
    </>
  )
}
