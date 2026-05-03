"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Save, Loader2, CheckCircle2, X, Settings2, Plus, Trash2, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PerDaySlots, DaySlot } from "@/lib/availability"

const ALL_DAYS = [
  { value: "monday",    label: "Mon", full: "Monday"    },
  { value: "tuesday",   label: "Tue", full: "Tuesday"   },
  { value: "wednesday", label: "Wed", full: "Wednesday" },
  { value: "thursday",  label: "Thu", full: "Thursday"  },
  { value: "friday",    label: "Fri", full: "Friday"    },
  { value: "saturday",  label: "Sat", full: "Saturday"  },
  { value: "sunday",    label: "Sun", full: "Sunday"    },
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

const DEFAULT_PER_DAY: PerDaySlots = {
  monday:    { enabled: true,  slots: [{ start: "08:00", end: "17:00" }] },
  tuesday:   { enabled: true,  slots: [{ start: "08:00", end: "17:00" }] },
  wednesday: { enabled: true,  slots: [{ start: "08:00", end: "17:00" }] },
  thursday:  { enabled: true,  slots: [{ start: "08:00", end: "17:00" }] },
  friday:    { enabled: true,  slots: [{ start: "08:00", end: "17:00" }] },
  saturday:  { enabled: false, slots: [] },
  sunday:    { enabled: false, slots: [] },
}

type Props = { onClose: () => void }

export function AvailabilityDrawer({ onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [perDaySlots, setPerDaySlots] = useState<PerDaySlots>(DEFAULT_PER_DAY)
  const [horizonDays, setHorizonDays] = useState(7)
  const [timezone, setTimezone] = useState("America/New_York")

  useEffect(() => {
    fetch("/api/settings/availability")
      .then((r) => r.json())
      .then((data) => {
        if (data.per_day_slots && Object.keys(data.per_day_slots).length > 0) {
          setPerDaySlots(data.per_day_slots)
        } else if (data.available_days) {
          // Migrate from legacy format
          const migrated: PerDaySlots = {}
          ALL_DAYS.forEach(({ value }) => {
            const enabled = (data.available_days as string[]).includes(value)
            migrated[value] = { enabled, slots: enabled ? [{ start: "08:00", end: "17:00" }] : [] }
          })
          setPerDaySlots(migrated)
        }
        if (data.booking_horizon_days) setHorizonDays(data.booking_horizon_days)
        if (data.timezone) setTimezone(data.timezone)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleDay = (day: string) => {
    setPerDaySlots((prev) => {
      const curr = prev[day] ?? { enabled: false, slots: [] }
      const nowEnabled = !curr.enabled
      return {
        ...prev,
        [day]: {
          enabled: nowEnabled,
          slots: nowEnabled && curr.slots.length === 0
            ? [{ start: "08:00", end: "17:00" }]
            : curr.slots,
        },
      }
    })
    setSaved(false)
  }

  const addSlot = (day: string) => {
    setPerDaySlots((prev) => {
      const curr = prev[day]
      const lastSlot = curr.slots[curr.slots.length - 1]
      const newStart = lastSlot ? lastSlot.end : "08:00"
      const [h] = newStart.split(":").map(Number)
      const newEndH = Math.min(h + 2, 21)
      const newEnd = `${newEndH.toString().padStart(2, "0")}:00`
      return {
        ...prev,
        [day]: { ...curr, slots: [...curr.slots, { start: newStart, end: newEnd }] },
      }
    })
    setSaved(false)
  }

  const removeSlot = (day: string, idx: number) => {
    setPerDaySlots((prev) => ({
      ...prev,
      [day]: { ...prev[day], slots: prev[day].slots.filter((_, i) => i !== idx) },
    }))
    setSaved(false)
  }

  const updateSlot = (day: string, idx: number, field: "start" | "end", value: string) => {
    setPerDaySlots((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
      },
    }))
    setSaved(false)
  }

  const copyToWeekdays = (sourceDay: string) => {
    const source = perDaySlots[sourceDay]
    if (!source) return
    setPerDaySlots((prev) => {
      const next = { ...prev }
      const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"]
      weekdays.forEach((d) => {
        if (d !== sourceDay) {
          next[d] = { enabled: source.enabled, slots: source.slots.map((s) => ({ ...s })) }
        }
      })
      return next
    })
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
          per_day_slots: perDaySlots,
          booking_horizon_days: horizonDays,
          timezone,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* non-fatal */ }
    finally { setSaving(false) }
  }, [perDaySlots, horizonDays, timezone])

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings2 style={{ width: 18, height: 18 }} className="text-primary" />
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
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-7 py-6 space-y-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
          </div>
        ) : (
          <>
            {/* Weekly schedule */}
            <div className="space-y-1">
              <div className="mb-4">
                <p className="text-sm font-semibold">Weekly schedule</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set available hours per day — add multiple slots to work around gaps
                </p>
              </div>

              {ALL_DAYS.map(({ value, full }, dayIdx) => {
                const dayConfig = perDaySlots[value] ?? { enabled: false, slots: [] }
                const isWeekday = dayIdx < 5

                return (
                  <div
                    key={value}
                    className={cn(
                      "flex items-start gap-4 py-3.5",
                      dayIdx < ALL_DAYS.length - 1 && "border-b border-border/50"
                    )}
                  >
                    {/* Toggle + day label */}
                    <div className="flex items-center gap-3 w-36 shrink-0 pt-0.5">
                      <button
                        role="switch"
                        aria-checked={dayConfig.enabled}
                        onClick={() => toggleDay(value)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                          dayConfig.enabled ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                            dayConfig.enabled ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                      <span className={cn(
                        "text-sm font-semibold",
                        dayConfig.enabled ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {full}
                      </span>
                    </div>

                    {/* Slots or unavailable */}
                    {dayConfig.enabled ? (
                      <div className="flex-1 space-y-2">
                        {dayConfig.slots.map((slot, slotIdx) => (
                          <div key={slotIdx} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateSlot(value, slotIdx, "start", e.target.value)}
                              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background w-[118px] focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            <span className="text-sm text-muted-foreground font-medium">–</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateSlot(value, slotIdx, "end", e.target.value)}
                              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background w-[118px] focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            <button
                              onClick={() => removeSlot(value, slotIdx)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                            >
                              <Trash2 style={{ width: 14, height: 14 }} />
                            </button>
                          </div>
                        ))}

                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => addSlot(value)}
                            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            <Plus style={{ width: 14, height: 14 }} />
                            Add time slot
                          </button>
                          {isWeekday && (
                            <button
                              onClick={() => copyToWeekdays(value)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Copy style={{ width: 12, height: 12 }} />
                              Copy to weekdays
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 pt-1">
                        <span className="text-sm text-muted-foreground italic">Unavailable</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" />

            {/* Booking window */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Booking window</p>
                <p className="text-xs text-muted-foreground mt-0.5">How far ahead the AI can schedule appointments</p>
              </div>
              <div className="flex gap-2">
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
                className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace("America/", "").replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
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
