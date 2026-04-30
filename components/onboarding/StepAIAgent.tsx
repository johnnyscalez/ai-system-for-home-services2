"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronRight } from "lucide-react"
import type { KnowledgeBaseData } from "@/lib/claude"

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
  function set<K extends keyof AIAgentData>(field: K, value: AIAgentData[K]) {
    onChange({ ...data, [field]: value })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Configure your AI agent</h1>
      <p className="text-muted-foreground mb-8">
        Two things we need to know — Linda handles everything else on her own.
      </p>

      <div className="space-y-8">

        {/* Disqualifiers */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Who should the AI never book?</h2>
          <p className="text-xs text-muted-foreground">
            The AI will figure this out naturally through conversation — it won&apos;t interrogate leads,
            just pick up on the right signals and politely move on if they don&apos;t qualify.
          </p>
          <Textarea
            id="disqualifiers"
            placeholder={
              "Be specific — the AI uses its judgment to screen these out naturally:\n\n" +
              "— Renters or tenants (homeowners only)\n" +
              "— Leads outside Miami-Dade and Broward County\n" +
              "— Commercial or industrial properties\n" +
              "— Units under 2 years old (still under manufacturer warranty)\n" +
              "— Anyone looking for a free repair on a unit we didn't install"
            }
            value={data.disqualifiers}
            onChange={(e) => set("disqualifiers", e.target.value)}
            rows={6}
            className="resize-none text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave blank and the AI will try to book every interested lead.
          </p>
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
          <Button onClick={onNext} className="gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
