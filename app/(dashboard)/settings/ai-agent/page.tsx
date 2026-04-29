"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles, RefreshCw, Save, Plus, Trash2,
  Eye, EyeOff, CheckCircle2, CalendarDays, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { KnowledgeBaseData, AgentConfigData } from "@/lib/claude"
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

const TONES = [
  { value: "friendly_professional", label: "Friendly & Professional" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
]

const GOALS = [
  { value: "book_estimate", label: "Book estimate appointment" },
  { value: "qualify_first", label: "Qualify first, then book" },
  { value: "gather_info", label: "Gather project details" },
]

export default function AIAgentPage() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [company, setCompany] = useState<{ name: string; service_type: string; service_area: string } | null>(null)
  const [kb, setKb] = useState<Partial<KnowledgeBaseData>>({})

  const [agentName, setAgentName] = useState("Alex")
  const [tone, setTone] = useState("friendly_professional")
  const [primaryGoal, setPrimaryGoal] = useState("book_estimate")
  const [customInstructions, setCustomInstructions] = useState("")
  const [qualifyingQuestions, setQualifyingQuestions] = useState<{ id: string; question: string }[]>([])
  const [objectionResponses, setObjectionResponses] = useState<Record<string, string>>({})
  const [workingHoursStart, setWorkingHoursStart] = useState(8)
  const [workingHoursEnd, setWorkingHoursEnd] = useState(20)
  const [generatedPrompt, setGeneratedPrompt] = useState("")
  const [showPrompt, setShowPrompt] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newObjection, setNewObjection] = useState("")
  const [newResponse, setNewResponse] = useState("")

  // Booking availability
  const [availableDays, setAvailableDays] = useState<string[]>(DEFAULT_DAYS)
  const [appointmentWindows, setAppointmentWindows] = useState<AppointmentWindow[]>(DEFAULT_WINDOWS)
  const [bookingHorizonDays, setBookingHorizonDays] = useState(7)
  const [newWindowLabel, setNewWindowLabel] = useState("")
  const [newWindowStart, setNewWindowStart] = useState("09:00")
  const [newWindowEnd, setNewWindowEnd] = useState("11:00")
  const [showAddWindow, setShowAddWindow] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("users")
        .select("company_id, companies(name, service_type, service_area)")
        .eq("id", user.id)
        .single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const co = (Array.isArray(profile.companies) ? profile.companies[0] : profile.companies) as { name: string; service_type: string; service_area: string } | null
      setCompany(co)

      const { data: config } = await supabase.from("ai_agent_config").select("*").eq("company_id", profile.company_id).single()
      if (config) {
        setAgentName(config.agent_name ?? "Alex")
        setTone(config.tone ?? "friendly_professional")
        setPrimaryGoal(config.primary_goal ?? "book_estimate")
        setCustomInstructions(config.custom_instructions ?? "")
        setQualifyingQuestions((config.qualifying_questions as { id: string; question: string }[]) ?? [])
        setObjectionResponses((config.objection_responses as Record<string, string>) ?? {})
        setWorkingHoursStart(config.working_hours_start ?? 8)
        setWorkingHoursEnd(config.working_hours_end ?? 20)
        setGeneratedPrompt(config.generated_system_prompt ?? "")
        if (config.available_days) setAvailableDays(config.available_days as string[])
        if (config.appointment_windows) setAppointmentWindows(config.appointment_windows as AppointmentWindow[])
        if (config.booking_horizon_days) setBookingHorizonDays(config.booking_horizon_days as number)
      }

      const { data: kbData } = await supabase.from("knowledge_base").select("*").eq("company_id", profile.company_id).single()
      if (kbData) {
        setKb({
          businessDescription: kbData.business_description ?? undefined,
          servicesOffered: kbData.services_offered ?? undefined,
          pricingInfo: kbData.pricing_info ?? undefined,
          teamInfo: kbData.team_info ?? undefined,
          uniqueSellingPoints: kbData.unique_selling_points ?? undefined,
          yearsInBusiness: kbData.years_in_business ?? undefined,
          certifications: kbData.certifications ?? undefined,
          testimonials: kbData.testimonials ?? undefined,
          customFacts: kbData.custom_facts ?? undefined,
          websiteUrl: kbData.website_url ?? undefined,
        })
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    if (!company) return
    setGenerating(true)
    try {
      const fullKb: KnowledgeBaseData = {
        companyName: company.name,
        serviceType: company.service_type,
        serviceArea: company.service_area,
        ...kb,
      }
      const config: AgentConfigData = {
        agentName,
        tone,
        primaryGoal,
        customInstructions,
        qualifyingQuestions: qualifyingQuestions.filter((q) => q.question),
        objectionResponses,
        workingHoursStart,
        workingHoursEnd,
        timezone: "America/New_York",
      }
      const res = await fetch("/api/onboarding/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kb: fullKb, config }),
      })
      const json = await res.json()
      if (json.prompt) { setGeneratedPrompt(json.prompt); setShowPrompt(true) }
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!companyId) return
    setSaving(true)
    await supabase.from("ai_agent_config").upsert({
      company_id: companyId,
      agent_name: agentName,
      tone,
      primary_goal: primaryGoal,
      custom_instructions: customInstructions || null,
      qualifying_questions: qualifyingQuestions,
      objection_responses: objectionResponses,
      working_hours_start: workingHoursStart,
      working_hours_end: workingHoursEnd,
      generated_system_prompt: generatedPrompt || null,
      prompt_generated_at: generatedPrompt ? new Date().toISOString() : null,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Agent Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure your AI&apos;s identity, behavior, and conversation playbook.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Saving...</> :
           saved ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved</> :
           <><Save className="w-3.5 h-3.5" />Save</>}
        </Button>
      </div>

      {/* Identity */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identity</h2>
        <div className="space-y-1.5 max-w-xs">
          <Label>Agent name</Label>
          <Input value={agentName} onChange={(e) => { setAgentName(e.target.value); setSaved(false) }} placeholder="Alex" />
        </div>
      </div>

      {/* Tone */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tone</h2>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTone(t.value); setSaved(false) }}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm transition-all",
                tone === t.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Primary goal</h2>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => { setPrimaryGoal(g.value); setSaved(false) }}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm transition-all",
                primaryGoal === g.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Working hours */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Working hours</h2>
        <div className="flex items-center gap-3">
          <select value={workingHoursStart} onChange={(e) => { setWorkingHoursStart(Number(e.target.value)); setSaved(false) }} className="bg-card border border-border rounded-md px-3 py-2 text-sm">
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}</option>
            ))}
          </select>
          <span className="text-muted-foreground text-sm">to</span>
          <select value={workingHoursEnd} onChange={(e) => { setWorkingHoursEnd(Number(e.target.value)); setSaved(false) }} className="bg-card border border-border rounded-md px-3 py-2 text-sm">
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Booking windows */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" />
            Booking Windows
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Your AI Agent offers ONLY these slots when booking appointments — never random times.
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
                    setAvailableDays(
                      active
                        ? availableDays.filter((d) => d !== day.value)
                        : [...availableDays, day.value]
                    )
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
                  win.enabled
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-border opacity-60"
                )}
              >
                {/* Toggle */}
                <button
                  onClick={() => {
                    setAppointmentWindows(
                      appointmentWindows.map((w) =>
                        w.id === win.id ? { ...w, enabled: !w.enabled } : w
                      )
                    )
                    setSaved(false)
                  }}
                  className={cn(
                    "w-9 h-5 rounded-full relative transition-colors shrink-0",
                    win.enabled ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all",
                      win.enabled ? "left-[18px]" : "left-0.5"
                    )}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{win.label}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {win.start.replace(":", ":")} – {win.end.replace(":", ":")}
                  </p>
                </div>

                {/* Delete custom windows only */}
                {!["morning", "midmorning", "afternoon", "late_afternoon"].includes(win.id) && (
                  <button
                    onClick={() => {
                      setAppointmentWindows(appointmentWindows.filter((w) => w.id !== win.id))
                      setSaved(false)
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add custom window */}
          {showAddWindow ? (
            <div className="border border-dashed border-border rounded-xl p-4 space-y-3 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">New time window</p>
              <Input
                placeholder="Label (e.g. Early morning)"
                value={newWindowLabel}
                onChange={(e) => setNewWindowLabel(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">Start</p>
                  <Input
                    type="time"
                    value={newWindowStart}
                    onChange={(e) => setNewWindowStart(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <span className="text-muted-foreground text-sm mt-5">to</span>
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">End</p>
                  <Input
                    type="time"
                    value={newWindowEnd}
                    onChange={(e) => setNewWindowEnd(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!newWindowLabel || !newWindowStart || !newWindowEnd}
                  onClick={() => {
                    const id = `custom_${Date.now()}`
                    setAppointmentWindows([
                      ...appointmentWindows,
                      { id, label: newWindowLabel, start: newWindowStart, end: newWindowEnd, enabled: true },
                    ])
                    setNewWindowLabel("")
                    setNewWindowStart("09:00")
                    setNewWindowEnd("11:00")
                    setShowAddWindow(false)
                    setSaved(false)
                  }}
                >
                  Add window
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddWindow(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowAddWindow(true)}
            >
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

        {/* Summary pill */}
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

      {/* Qualifying questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Qualifying questions</h2>
          <Button variant="outline" size="sm" onClick={() => setQualifyingQuestions([...qualifyingQuestions, { id: `q_${Date.now()}`, question: "" }])} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {qualifyingQuestions.map((q) => (
            <div key={q.id} className="flex gap-2">
              <Input
                value={q.question}
                onChange={(e) => { setQualifyingQuestions(qualifyingQuestions.map((x) => x.id === q.id ? { ...x, question: e.target.value } : x)); setSaved(false) }}
                placeholder="e.g. Is this storm damage or just age?"
                className="flex-1"
              />
              <Button variant="ghost" size="icon" onClick={() => setQualifyingQuestions(qualifyingQuestions.filter((x) => x.id !== q.id))} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {qualifyingQuestions.length === 0 && <p className="text-xs text-muted-foreground italic">No custom questions — using smart defaults.</p>}
        </div>
      </div>

      {/* Objection responses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Objection responses</h2>
        </div>
        <div className="space-y-3">
          {Object.entries(objectionResponses).map(([objection, response]) => (
            <div key={objection} className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-400">&ldquo;{objection}&rdquo;</span>
                <Button variant="ghost" size="icon" onClick={() => { const n = { ...objectionResponses }; delete n[objection]; setObjectionResponses(n); setSaved(false) }} className="w-6 h-6 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Textarea
                value={response}
                onChange={(e) => { setObjectionResponses({ ...objectionResponses, [objection]: e.target.value }); setSaved(false) }}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          ))}
          <div className="bg-muted/30 border border-dashed border-border rounded-lg p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Add new objection</p>
            <Input placeholder='Lead says: "I need to think about it"' value={newObjection} onChange={(e) => setNewObjection(e.target.value)} />
            <Textarea placeholder="AI responds: No problem at all! Can I check back in a couple days?" value={newResponse} onChange={(e) => setNewResponse(e.target.value)} rows={2} className="resize-none" />
            <Button size="sm" variant="outline" onClick={() => { if (!newObjection) return; setObjectionResponses({ ...objectionResponses, [newObjection]: newResponse }); setNewObjection(""); setNewResponse(""); setSaved(false) }} disabled={!newObjection}>
              Add objection
            </Button>
          </div>
        </div>
      </div>

      {/* Custom instructions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custom instructions</h2>
        <Textarea
          placeholder="Anything else the AI should know or do..."
          value={customInstructions}
          onChange={(e) => { setCustomInstructions(e.target.value); setSaved(false) }}
          rows={4}
          className="resize-none"
        />
      </div>

      {/* System prompt */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Generated System Prompt
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Claude reads this prompt before every conversation. {generatedPrompt ? "You can edit it directly." : "Generate it from your settings above."}
            </p>
          </div>
          {generatedPrompt && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Active</Badge>}
        </div>

        <Button onClick={handleGenerate} disabled={generating || !company} variant={generatedPrompt ? "outline" : "default"} className="gap-2">
          {generating ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating...</> :
           generatedPrompt ? <><RefreshCw className="w-4 h-4" />Regenerate prompt</> :
           <><Sparkles className="w-4 h-4" />Generate system prompt</>}
        </Button>

        {generatedPrompt && (
          <div className="space-y-2">
            <button onClick={() => setShowPrompt(!showPrompt)} className="text-xs text-primary flex items-center gap-1 hover:underline">
              {showPrompt ? <><EyeOff className="w-3 h-3" />Hide</> : <><Eye className="w-3 h-3" />View & edit</>} prompt
            </button>
            {showPrompt && (
              <Textarea
                value={generatedPrompt}
                onChange={(e) => { setGeneratedPrompt(e.target.value); setSaved(false) }}
                rows={24}
                className="font-mono text-xs resize-y"
              />
            )}
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
        {saving ? "Saving..." : saved ? "✓ Saved" : "Save AI agent settings"}
      </Button>
    </div>
  )
}
