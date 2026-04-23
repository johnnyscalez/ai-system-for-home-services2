"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ChevronRight, Sparkles, Plus, Trash2, RefreshCw,
  ChevronDown, ChevronUp, Eye, EyeOff
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { KnowledgeBaseData, AgentConfigData } from "@/lib/claude"

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

const GOALS = [
  { value: "book_estimate", label: "Book estimate appointment", desc: "Move every qualified lead to a scheduled appointment" },
  { value: "qualify_first", label: "Qualify first, then book", desc: "Fully qualify before offering appointment slots" },
  { value: "gather_info", label: "Gather project details", desc: "Collect detailed info for an accurate quote" },
]

const DEFAULT_OBJECTIONS: Record<string, string> = {
  "Just getting prices": "Totally understand! Our inspections are free and no obligation — we just want to give you an accurate number. Does Tuesday or Thursday work?",
  "Already talking to someone else": "That's smart to compare! Most of our customers did that. When's better — Tuesday at 10 or Thursday at 2?",
  "How much does it cost?": "It really depends on the scope — that's exactly what the free inspection figures out. Takes about 20 minutes. Which day works?",
  "Not interested right now": "No worries at all! Would it be okay if I checked back in a couple weeks when timing might work better?",
  "Call me instead": "Of course! What's the best time to call you today?",
}

export type AIAgentData = {
  agentName: string
  tone: string
  primaryGoal: string
  customInstructions: string
  qualifyingQuestions: { id: string; question: string }[]
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

export function StepAIAgent({ data, kb, companyName, serviceType, serviceArea, onChange, onNext, onBack }: Props) {
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(!!data.generatedPrompt)
  const [showPrompt, setShowPrompt] = useState(false)
  const [newObjection, setNewObjection] = useState("")
  const [newObjectionResponse, setNewObjectionResponse] = useState("")
  const [addingObjection, setAddingObjection] = useState(false)

  function set<K extends keyof AIAgentData>(field: K, value: AIAgentData[K]) {
    onChange({ ...data, [field]: value })
  }

  function addQuestion() {
    const id = `q_${Date.now()}`
    set("qualifyingQuestions", [...data.qualifyingQuestions, { id, question: "" }])
  }

  function updateQuestion(id: string, question: string) {
    set("qualifyingQuestions", data.qualifyingQuestions.map((q) => q.id === id ? { ...q, question } : q))
  }

  function removeQuestion(id: string) {
    set("qualifyingQuestions", data.qualifyingQuestions.filter((q) => q.id !== id))
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

  async function handleGenerate() {
    setGenerating(true)
    try {
      const config: AgentConfigData = {
        agentName: data.agentName,
        tone: data.tone,
        primaryGoal: data.primaryGoal,
        customInstructions: data.customInstructions,
        qualifyingQuestions: data.qualifyingQuestions.filter((q) => q.question),
        objectionResponses: data.objectionResponses,
        workingHoursStart: data.workingHoursStart,
        workingHoursEnd: data.workingHoursEnd,
        timezone: data.timezone,
      }

      const res = await fetch("/api/onboarding/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kb: { ...kb, companyName, serviceType, serviceArea }, config }),
      })

      const json = await res.json()
      if (json.prompt) {
        set("generatedPrompt", json.prompt)
        setGenerated(true)
        setShowPrompt(true)
      }
    } catch {
      // fall through
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Configure your AI agent</h1>
      <p className="text-muted-foreground mb-8">
        Define how your AI behaves, what it asks, and how it handles objections. Then generate its system prompt.
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

        {/* Goal */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Primary goal</h2>
          <div className="space-y-2">
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => set("primaryGoal", g.value)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4",
                  data.primaryGoal === g.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 shrink-0",
                  data.primaryGoal === g.value ? "border-primary bg-primary" : "border-muted-foreground"
                )} />
                <div>
                  <div className="font-medium text-sm">{g.label}</div>
                  <div className="text-xs text-muted-foreground">{g.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Qualifying questions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Qualifying questions</h2>
            <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add question
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your AI will ask these naturally during the conversation. 2-3 questions max recommended.
          </p>
          <div className="space-y-2">
            {data.qualifyingQuestions.map((q) => (
              <div key={q.id} className="flex gap-2">
                <Input
                  value={q.question}
                  onChange={(e) => updateQuestion(q.id, e.target.value)}
                  placeholder="e.g. Is this storm damage or just age?"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(q.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {data.qualifyingQuestions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No custom questions — AI will use smart defaults for {serviceType || "your service"}.
              </p>
            )}
          </div>
        </div>

        {/* Objection responses */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Objection responses</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingObjection(!addingObjection)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add objection
            </Button>
          </div>

          <div className="space-y-3">
            {Object.entries(data.objectionResponses).map(([objection, response]) => (
              <div key={objection} className="bg-card border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-amber-400">&ldquo;{objection}&rdquo;</span>
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
          <p className="text-xs text-muted-foreground">AI only texts leads during these hours (in lead&apos;s timezone).</p>
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custom instructions</h2>
          <Textarea
            placeholder="Anything else the AI should know or do... e.g. 'Always mention we offer 0% financing' or 'Never discuss competitor pricing'"
            value={data.customInstructions}
            onChange={(e) => set("customInstructions", e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Generate prompt */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI System Prompt
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                We generate a world-class SMS sales prompt using everything you&apos;ve configured.
                {generated && " You can edit it directly."}
              </p>
            </div>
            {generated && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                Generated
              </Badge>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant={generated ? "outline" : "default"}
            className="gap-2"
          >
            {generating ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Generating prompt...</>
            ) : generated ? (
              <><RefreshCw className="w-4 h-4" /> Regenerate</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate my AI prompt</>
            )}
          </Button>

          {generated && data.generatedPrompt && (
            <div className="space-y-2">
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                {showPrompt ? <><EyeOff className="w-3 h-3" /> Hide prompt</> : <><Eye className="w-3 h-3" /> View & edit prompt</>}
                {showPrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showPrompt && (
                <Textarea
                  value={data.generatedPrompt}
                  onChange={(e) => set("generatedPrompt", e.target.value)}
                  rows={20}
                  className="font-mono text-xs resize-y"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onNext} className="gap-2">
            {generated ? "Continue with this prompt" : "Skip, use defaults"}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
