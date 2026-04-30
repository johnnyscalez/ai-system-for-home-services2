"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronRight, Sparkles, Plus, Trash2, RefreshCw, Wand2
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

export function StepAIAgent({ data, kb, companyName, serviceType, serviceArea, onChange, onNext, onBack }: Props) {
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [questionsGenerated, setQuestionsGenerated] = useState(data.qualifyingQuestions.length > 0)
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

  async function handleGenerateQuestions() {
    setGeneratingQuestions(true)
    try {
      const res = await fetch("/api/onboarding/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          serviceArea,
          companyName,
          disqualifiers: data.disqualifiers,
          kb: { ...kb, companyName, serviceType, serviceArea },
        }),
      })

      const json = await res.json()
      if (json.questions && Array.isArray(json.questions)) {
        const questions = json.questions.map((q: string, i: number) => ({
          id: `q_gen_${i}_${Date.now()}`,
          question: q,
        }))
        set("qualifyingQuestions", questions)
        setQuestionsGenerated(true)
      }
    } catch {
      // fall through
    } finally {
      setGeneratingQuestions(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Configure your AI agent</h1>
      <p className="text-muted-foreground mb-8">
        Your AI qualifies leads, handles objections, and books appointments. Set up its personality and how it qualifies leads.
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

        {/* Qualifying questions — smart generation */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Qualifying questions</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Your AI acts like an experienced salesperson — it figures out what to ask based on the conversation.
            Tell us who to <strong className="text-foreground">disqualify immediately</strong> and we&apos;ll generate the right set of smart qualifying questions.
          </p>

          {/* Disqualifiers */}
          <div className="space-y-1.5">
            <Label htmlFor="disqualifiers">
              Who should the AI <span className="text-destructive font-semibold">NOT book</span>?
            </Label>
            <Textarea
              id="disqualifiers"
              placeholder={
                "Examples:\n" +
                "— Renters (we only work with homeowners)\n" +
                "— Commercial / industrial properties\n" +
                "— Systems under 2 years old (still under manufacturer warranty)\n" +
                "— Leads outside [your service area]\n" +
                "— Anyone asking for an emergency same-day appointment on weekends"
              }
              value={data.disqualifiers}
              onChange={(e) => set("disqualifiers", e.target.value)}
              rows={5}
              className="resize-none text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Be specific. The AI will screen these out early in the conversation.</p>
          </div>

          {/* Generate button */}
          <Button
            type="button"
            onClick={handleGenerateQuestions}
            disabled={generatingQuestions}
            variant={questionsGenerated ? "outline" : "default"}
            className="gap-2"
          >
            {generatingQuestions ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Generating questions...</>
            ) : questionsGenerated ? (
              <><RefreshCw className="w-4 h-4" /> Regenerate questions</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Create qualifying questions the AI agent asks your leads</>
            )}
          </Button>

          {/* Question list */}
          {data.qualifyingQuestions.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  {data.qualifyingQuestions.length} questions generated — edit, remove, or add your own
                </p>
                <Button variant="ghost" size="sm" onClick={addQuestion} className="gap-1.5 text-xs h-7">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {data.qualifyingQuestions.map((q, i) => (
                  <div key={q.id} className="flex gap-2 items-center">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {i + 1}
                    </div>
                    <Input
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, e.target.value)}
                      placeholder="Enter a qualifying question..."
                      className="flex-1 text-sm"
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
              </div>
            </div>
          )}

          {data.qualifyingQuestions.length === 0 && !generatingQuestions && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border">
              <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Click the button above to generate smart qualifying questions tailored to your business.
                The AI will use them intelligently — not as a rigid script.
              </p>
            </div>
          )}
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
              "— If lead mentions a competitor by name, don't respond negatively\n" +
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
