"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  RefreshCw, Save, Plus, Trash2,
  CheckCircle2, CalendarDays, Clock, Lock, Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DEFAULT_WINDOWS, DEFAULT_DAYS } from "@/lib/availability"
import type { AppointmentWindow } from "@/lib/availability"

const DAYS_OF_WEEK = [
  { value: "monday",    label: "Mon" },
  { value: "tuesday",   label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday",  label: "Thu" },
  { value: "friday",    label: "Fri" },
  { value: "saturday",  label: "Sat" },
  { value: "sunday",    label: "Sun" },
]

const HORIZON_OPTIONS = [
  { value: 3,  label: "3 days" },
  { value: 5,  label: "5 days" },
  { value: 7,  label: "1 week" },
  { value: 10, label: "10 days" },
  { value: 14, label: "2 weeks" },
]

export default function AIAgentPage() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Fields the user can configure
  const [customInstructions, setCustomInstructions]     = useState("")
  const [qualifyingQuestions, setQualifyingQuestions]   = useState<{ id: string; question: string }[]>([])
  const [workingHoursStart, setWorkingHoursStart]       = useState(8)
  const [workingHoursEnd, setWorkingHoursEnd]           = useState(20)
  const [availableDays, setAvailableDays]               = useState<string[]>(DEFAULT_DAYS)
  const [appointmentWindows, setAppointmentWindows]     = useState<AppointmentWindow[]>(DEFAULT_WINDOWS)
  const [bookingHorizonDays, setBookingHorizonDays]     = useState(7)
  const [newWindowLabel, setNewWindowLabel]             = useState("")
  const [newWindowStart, setNewWindowStart]             = useState("09:00")
  const [newWindowEnd, setNewWindowEnd]                 = useState("11:00")
  const [showAddWindow, setShowAddWindow]               = useState(false)

  // Preserved from DB — never modified by user
  const [savedObjectionResponses, setSavedObjectionResponses] = useState<Record<string, string>>({})
  const [savedSystemPrompt, setSavedSystemPrompt]             = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", user.id)
        .single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: config } = await supabase
        .from("ai_agent_config")
        .select("*")
        .eq("company_id", profile.company_id)
        .single()

      if (config) {
        setCustomInstructions(config.custom_instructions ?? "")
        setQualifyingQuestions((config.qualifying_questions as { id: string; question: string }[]) ?? [])
        setWorkingHoursStart(config.working_hours_start ?? 8)
        setWorkingHoursEnd(config.working_hours_end ?? 20)
        if (config.available_days)      setAvailableDays(config.available_days as string[])
        if (config.appointment_windows) setAppointmentWindows(config.appointment_windows as AppointmentWindow[])
        if (config.booking_horizon_days) setBookingHorizonDays(config.booking_horizon_days as number)
        setSavedObjectionResponses((config.objection_responses as Record<string, string>) ?? {})
        setSavedSystemPrompt(config.generated_system_prompt ?? null)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!companyId) return
    setSaving(true)
    await supabase.from("ai_agent_config").upsert({
      company_id: companyId,
      agent_name: "Linda",
      tone: "friendly_professional",
      primary_goal: "book_estimate",
      custom_instructions: customInstructions || null,
      qualifying_questions: qualifyingQuestions,
      // Preserve — not editable by user
      objection_responses: savedObjectionResponses,
      generated_system_prompt: savedSystemPrompt,
      prompt_generated_at: savedSystemPrompt ? new Date().toISOString() : null,
      working_hours_start: workingHoursStart,
      working_hours_end: workingHoursEnd,
      available_days: availableDays,
      appointment_windows: appointmentWindows,
      booking_horizon_days: bookingHorizonDays,
    }, { onConflict: "company_id" })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Agent</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scheduling windows, qualifying questions, and business context for your agent.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Saving...</> :
           saved  ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved</> :
                    <><Save className="w-3.5 h-3.5" />Save</>}
        </Button>
      </div>

      {/* DFY notice */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
        <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Your AI is pre-built and optimized</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            The conversation playbook — how the AI opens, qualifies, handles objections, and closes — is managed by our team.
            You control scheduling, what the AI asks your leads, and additional business context below.
          </p>
        </div>
      </div>

      {/* ── Working hours ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Working hours</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your AI only texts leads and sends follow-ups during these hours.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={workingHoursStart}
            onChange={(e) => { setWorkingHoursStart(Number(e.target.value)); setSaved(false) }}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}</option>
            ))}
          </select>
          <span className="text-muted-foreground text-sm">to</span>
          <select
            value={workingHoursEnd}
            onChange={(e) => { setWorkingHoursEnd(Number(e.target.value)); setSaved(false) }}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Booking windows ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" />
            Booking Windows
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Your AI offers <strong>only</strong> these slots when booking appointments — never random times.
          </p>
        </div>

        {/* Day toggles */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Available days</p>
          <div className="flex gap-2 flex-wrap">
            {DAYS_OF_WEEK.map((day) => {
              const active = availableDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  onClick={() => {
                    setAvailableDays(active ? availableDays.filter((d) => d !== day.value) : [...availableDays, day.value])
                    setSaved(false)
                  }}
                  className={cn(
                    "w-11 h-11 rounded-lg border text-sm font-medium transition-all",
                    active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time windows */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Time windows</p>
          <div className="space-y-2">
            {appointmentWindows.map((win) => (
              <div
                key={win.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                  win.enabled ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border opacity-60"
                )}
              >
                <button
                  onClick={() => {
                    setAppointmentWindows(appointmentWindows.map((w) => w.id === win.id ? { ...w, enabled: !w.enabled } : w))
                    setSaved(false)
                  }}
                  className={cn("w-9 h-5 rounded-full relative transition-colors shrink-0", win.enabled ? "bg-primary" : "bg-muted-foreground/30")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all", win.enabled ? "left-[18px]" : "left-0.5")} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{win.label}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {win.start} – {win.end}
                  </p>
                </div>
                {!["morning", "midmorning", "afternoon", "late_afternoon"].includes(win.id) && (
                  <button
                    onClick={() => { setAppointmentWindows(appointmentWindows.filter((w) => w.id !== win.id)); setSaved(false) }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {showAddWindow ? (
            <div className="border border-dashed border-border rounded-xl p-4 space-y-3 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">New time window</p>
              <Input placeholder="Label (e.g. Early morning)" value={newWindowLabel} onChange={(e) => setNewWindowLabel(e.target.value)} className="h-8 text-sm" />
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">Start</p>
                  <Input type="time" value={newWindowStart} onChange={(e) => setNewWindowStart(e.target.value)} className="h-8 text-sm" />
                </div>
                <span className="text-muted-foreground text-sm mt-5">to</span>
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">End</p>
                  <Input type="time" value={newWindowEnd} onChange={(e) => setNewWindowEnd(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!newWindowLabel || !newWindowStart || !newWindowEnd}
                  onClick={() => {
                    const id = `custom_${Date.now()}`
                    setAppointmentWindows([...appointmentWindows, { id, label: newWindowLabel, start: newWindowStart, end: newWindowEnd, enabled: true }])
                    setNewWindowLabel(""); setNewWindowStart("09:00"); setNewWindowEnd("11:00")
                    setShowAddWindow(false); setSaved(false)
                  }}
                >
                  Add window
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddWindow(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddWindow(true)}>
              <Plus className="w-3.5 h-3.5" /> Add custom window
            </Button>
          )}
        </div>

        {/* Booking horizon */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">How far ahead can the AI book?</p>
          <div className="flex gap-2 flex-wrap">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setBookingHorizonDays(opt.value); setSaved(false) }}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm transition-all",
                  bookingHorizonDays === opt.value
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 w-fit">
          <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
          AI offers up to{" "}
          <span className="font-semibold text-foreground">
            {availableDays.length * appointmentWindows.filter((w) => w.enabled).length}
          </span>{" "}
          slots per week · books up to{" "}
          <span className="font-semibold text-foreground">{bookingHorizonDays} days</span> out
        </div>
      </div>

      {/* ── Qualifying questions ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Qualifying questions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Extra questions your AI weaves into the conversation to pre-qualify each lead.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setQualifyingQuestions([...qualifyingQuestions, { id: `q_${Date.now()}`, question: "" }]); setSaved(false) }}
            className="gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {qualifyingQuestions.map((q) => (
            <div key={q.id} className="flex gap-2">
              <Input
                value={q.question}
                onChange={(e) => { setQualifyingQuestions(qualifyingQuestions.map((x) => x.id === q.id ? { ...x, question: e.target.value } : x)); setSaved(false) }}
                placeholder="e.g. Is this storm damage or age-related wear?"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setQualifyingQuestions(qualifyingQuestions.filter((x) => x.id !== q.id)); setSaved(false) }}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {qualifyingQuestions.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No custom questions — AI uses smart defaults for your service type.</p>
          )}
        </div>
      </div>

      {/* ── Additional business context ───────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional business context</h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Anything specific the AI should know — seasonal promotions, current offers, special coverage areas, company policies.
            This is added to what the AI already knows from your knowledge base.
          </p>
        </div>
        <Textarea
          placeholder="e.g. We&apos;re running a $99 tune-up special through August. We do NOT service mobile homes. Mention our 10-year labor warranty when asked about price."
          value={customInstructions}
          onChange={(e) => { setCustomInstructions(e.target.value); setSaved(false) }}
          rows={4}
          className="resize-none"
        />
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>This supplements your agent — it doesn&apos;t change how the AI communicates or handles conversations.</span>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
        {saving ? "Saving..." : saved ? "✓ Saved" : "Save agent settings"}
      </Button>
    </div>
  )
}
