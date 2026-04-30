"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { KnowledgeBaseData } from "@/lib/claude"

const TONES = [
  {
    value: "friendly_professional",
    label: "Friendly & Professional",
    desc: "Warm and personable, like a trusted local business. Most effective for home services.",
  },
  {
    value: "casual",
    label: "Casual",
    desc: "Relaxed and conversational, like texting a friend. Works well for younger audiences.",
  },
  {
    value: "formal",
    label: "Formal",
    desc: "Business-like and respectful. Better for high-ticket or corporate clients.",
  },
]

export type AIAgentData = {
  agentName: string
  tone: string
  primaryGoal: string
  customInstructions: string
  qualifyingQuestions: { id: string; question: string }[]
  disqualifiers: string
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

export function StepAIAgent({ data, onChange, onNext, onBack }: Props) {
  const [newObjection, setNewObjection] = useState("")
  const [newObjectionResponse, setNewObjectionResponse] = useState("")
  const [addingObjection, setAddingObjection] = useState(false)

  function set<K extends keyof AIAgentData>(field: K, value: AIAgentData[K]) {
    onChange({ ...data, [field]: value })
  }

  function addObjection() {
    if (!newObjection) return
    set("objectionResponses", { ...data.objectionResponses, [newObjection]: newObjectionResponse })
    setNewObjection("")
    setNewObjectionResponse("")
    setAddingObjection(false)
  }

  function removeObjection(key: string) {
    const next = { ...data.objectionResponses }
    delete next[key]
    set("objectionResponses", next)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Configure your AI agent</h1>
      <p className="text-muted-foreground mb-8">
        Set your agent&apos;s personality, who it should never book, and how it handles common pushbacks.
        The AI figures out the right questions to ask on its own — like a smart rep would.
      </p>

      <div className="space-y-8">

        {/* Identity */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identity</h2>
          <div className="space-y-1.5">
            <Label htmlFor="agentName">Agent name</Label>
            <Input
              id="agentName"
              placeholder="Alex"
              value={data.agentName}
              onChange={(e) => set("agentName", e.target.value)}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">What name your AI uses when texting leads.</p>
          </div>
        </div>

        {/* Tone */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tone</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {TONES.map((t) => (
              <button
                key={t.value}
                onClick={() => set("tone", t.value)}
                className={cn(
                  "text-left p-4 rounded-xl border transition-all",
                  data.tone === t.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="font-medium text-sm mb-1">{t.label}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Disqualifiers */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Who should the AI never book?</h2>
          <p className="text-xs text-muted-foreground">
            The AI will naturally figure out early in the conversation whether a lead matches these criteria — and politely move on if they don&apos;t.
          </p>
          <Textarea
            id="disqualifiers"
            placeholder={
              "Be specific — the AI will use its judgment to screen these out naturally:\n\n" +
              "— Renters or tenants (homeowners only)\n" +
              "— Leads outside Miami-Dade and Broward County\n" +
              "— Commercial or industrial properties\n" +
              "— Units under 2 years old (still under manufacturer warranty)\n" +
              "— Anyone looking for a free repair estimate on a unit we didn't install"
            }
            value={data.disqualifiers}
            onChange={(e) => set("disqualifiers", e.target.value)}
            rows={6}
            className="resize-none text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave blank and the AI will try to book every qualified lead.
          </p>
        </div>

        {/* Objection responses */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Objection responses</h2>
              <p className="text-xs text-muted-foreground mt-1">How your AI handles common pushbacks.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingObjection(!addingObjection)}
              className="gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>

          <div className="space-y-3">
            {Object.entries(data.objectionResponses).map(([objection, response]) => (
              <div key={objection} className="bg-card border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-amber-500">&ldquo;{objection}&rdquo;</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeObjection(objection)}
                    className="w-6 h-6 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Textarea
                  value={response}
                  onChange={(e) => set("objectionResponses", { ...data.objectionResponses, [objection]: e.target.value })}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            ))}

            {addingObjection && (
              <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>What the lead says</Label>
                  <Input
                    placeholder="e.g. I need to talk to my wife first"
                    value={newObjection}
                    onChange={(e) => setNewObjection(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>How the AI responds</Label>
                  <Textarea
                    placeholder="Of course! What's the best time to follow up — tomorrow morning or afternoon?"
                    value={newObjectionResponse}
                    onChange={(e) => setNewObjectionResponse(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addObjection} disabled={!newObjection}>Add</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingObjection(false)}>Cancel</Button>
                </div>
              </div>
            )}
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
          <Textarea
            placeholder={
              "Extra instructions for your AI — anything not covered above.\n\n" +
              "Examples:\n" +
              "— Always mention our senior discount (10% off for 65+)\n" +
              "— Never promise a specific price over text\n" +
              "— If a lead mentions a competitor by name, don't respond negatively\n" +
              "— Always offer our maintenance plan after booking an appointment"
            }
            value={data.customInstructions}
            onChange={(e) => set("customInstructions", e.target.value)}
            rows={5}
            className="resize-none text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onNext} className="gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
