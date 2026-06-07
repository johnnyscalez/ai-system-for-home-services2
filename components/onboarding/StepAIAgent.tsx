"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronRight, Building2, MapPin, Home, CheckCircle2,
  ShieldCheck, Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { KnowledgeBaseData } from "@/lib/claude"

export type AIAgentData = {
  agentName: string
  tone: string
  primaryGoal: string
  customInstructions: string
  qualifyingQuestions: { id: string; question: string }[]
  disqualifiers: string
  // Structured qualifying criteria (compiled into disqualifiers on submit)
  qualifyingPropertyType: "residential_only" | "commercial_only" | "both"
  qualifyingHomeTypes: string[]
  qualifyingCustomQuestion: string
  objectionResponses: Record<string, string>
  workingHoursStart: number
  workingHoursEnd: number
  timezone: string
  generatedPrompt: string
}

interface Props {
  data: AIAgentData
  kb: KnowledgeBaseData
  companyName: string
  serviceType: string
  serviceArea: string
  onChange: (d: AIAgentData) => void
  onNext: () => void
  onBack: () => void
}

const HOME_TYPES: { value: string; label: string }[] = [
  { value: "single_family",  label: "Single family home" },
  { value: "townhouse",      label: "Townhouse" },
  { value: "condo",          label: "Condo / Apartment" },
  { value: "mobile_home",    label: "Mobile / Manufactured" },
  { value: "multi_family",   label: "Multi-family / Duplex" },
  { value: "new_construction", label: "New construction" },
]

const PROPERTY_TYPE_OPTIONS: { value: AIAgentData["qualifyingPropertyType"]; label: string }[] = [
  { value: "residential_only", label: "Residential only" },
  { value: "commercial_only",  label: "Commercial only" },
  { value: "both",             label: "Both" },
]

export function StepAIAgent({ data, onChange, onNext, onBack }: Props) {
  function set<K extends keyof AIAgentData>(field: K, value: AIAgentData[K]) {
    onChange({ ...data, [field]: value })
  }

  function toggleHomeType(value: string) {
    const current = data.qualifyingHomeTypes
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onChange({ ...data, qualifyingHomeTypes: next })
  }

  function handleNext() {
    const parts: string[] = []

    if (data.qualifyingPropertyType === "residential_only") {
      parts.push("Only book residential properties. Do not book commercial, industrial, or multi-tenant commercial buildings — politely let those leads know you only serve residential.")
    } else if (data.qualifyingPropertyType === "commercial_only") {
      parts.push("Only book commercial properties. Do not book residential homeowners — politely redirect them.")
    }

    parts.push("Always ask for the lead's full address and confirm it falls within the service area before scheduling.")

    const excludedTypes = HOME_TYPES
      .filter(h => !data.qualifyingHomeTypes.includes(h.value))
      .map(h => h.label)
    if (excludedTypes.length > 0 && excludedTypes.length < HOME_TYPES.length) {
      parts.push(`Do not book the following home types: ${excludedTypes.join(", ")}. Politely let those leads know.`)
    }

    if (data.qualifyingCustomQuestion.trim()) {
      parts.push(`Additional qualifying question to ask naturally in conversation: "${data.qualifyingCustomQuestion.trim()}"`)
    }

    onChange({ ...data, disqualifiers: parts.join("\n") })
    onNext()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Configure your AI agent</h1>
      <p className="text-muted-foreground mb-8">
        Two things we need to know — Linda handles everything else on her own.
      </p>

      <div className="space-y-8">

        {/* ── Lead Qualifying Criteria ─────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Lead Qualifying Criteria</h2>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Your AI asks these questions naturally in conversation and only books leads who qualify.
          </p>

          {/* Criteria 1 — Property type */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">Is it residential or commercial?</span>
            </div>
            <div className="flex gap-2">
              {PROPERTY_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("qualifyingPropertyType", opt.value)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm border font-medium transition-colors",
                    data.qualifyingPropertyType === opt.value
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Criteria 2 — Service area (always on) */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">What&apos;s your address?</span>
              <span className="ml-auto px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 font-semibold shrink-0">
                Always on
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              AI always asks for the lead&apos;s address and verifies it&apos;s in your service area before booking.
            </p>
          </div>

          {/* Criteria 3 — Home type */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">What kind of home is it?</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Select every home type you serve — unselected types will be screened out.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {HOME_TYPES.map(ht => {
                const selected = data.qualifyingHomeTypes.includes(ht.value)
                return (
                  <button
                    key={ht.value}
                    type="button"
                    onClick={() => toggleHomeType(ht.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors",
                      selected
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {selected
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                    }
                    {ht.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom qualifying question */}
          <div className="space-y-1.5">
            <Label htmlFor="customQ" className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Plus className="w-3.5 h-3.5" />
              Add another qualifying question <span className="font-normal">(optional)</span>
            </Label>
            <Input
              id="customQ"
              placeholder='e.g. "Do you own the home?" or "Is the unit under warranty?"'
              value={data.qualifyingCustomQuestion}
              onChange={e => set("qualifyingCustomQuestion", e.target.value)}
            />
          </div>
        </div>

        {/* Working hours */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Working hours</h2>
          <p className="text-xs text-muted-foreground">AI only texts leads during these hours.</p>
          <div className="flex items-center gap-3">
            <select
              value={data.workingHoursStart}
              onChange={(e) => set("workingHoursStart", Number(e.target.value))}
              className="bg-card border border-border rounded-md px-3 py-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground text-sm">to</span>
            <select
              value={data.workingHoursEnd}
              onChange={(e) => set("workingHoursEnd", Number(e.target.value))}
              className="bg-card border border-border rounded-md px-3 py-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom instructions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Anything else?</h2>
          <p className="text-xs text-muted-foreground">Specific things your AI should always say, mention, or avoid.</p>
          <Textarea
            placeholder={
              "Examples:\n" +
              "— Always mention our senior discount (10% off for 65+)\n" +
              "— Never promise a specific price over text\n" +
              "— If a lead mentions a competitor by name, stay neutral\n" +
              "— Always bring up our maintenance plan after booking"
            }
            value={data.customInstructions}
            onChange={(e) => set("customInstructions", e.target.value)}
            rows={5}
            className="resize-none text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={handleNext} className="gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
