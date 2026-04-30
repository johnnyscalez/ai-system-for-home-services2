"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Phone, Check, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  provisioning: boolean
  provisionedNumber: string
  loading: boolean
  error: string
  onBack: () => void
  onProvision: () => void
  onFinish: () => void
  onRetry?: () => void
}

export function StepPhone({ provisioning, provisionedNumber, loading, error, onBack, onProvision, onFinish, onRetry }: Props) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Your AI phone number</h1>
      <p className="text-muted-foreground mb-6">
        Your AI needs a dedicated local phone number to text leads. This number is provisioned through Twilio.
      </p>

      {/* Step A: Cost disclosure — before provisioning starts */}
      {!provisionedNumber && !provisioning && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-blue-800">About your dedicated phone number</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>A local US phone number will be reserved in your state via Twilio (~$1.15/month)</li>
                <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>SMS usage is charged per message and is included in your LeadReply plan</li>
                <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>The number is yours for as long as your account is active</li>
                <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>No separate Twilio account needed — we handle everything</li>
              </ul>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <div
              onClick={() => setAcknowledged(!acknowledged)}
              className={cn(
                "w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer",
                acknowledged ? "bg-primary border-primary" : "border-muted-foreground hover:border-primary"
              )}
            >
              {acknowledged && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm text-foreground leading-relaxed" onClick={() => setAcknowledged(!acknowledged)}>
              I understand a dedicated phone number will be provisioned for my account.
              The ~$1.15/month Twilio cost is covered by my LeadReply subscription.
            </span>
          </label>

          {!acknowledged && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Check the box above to confirm and get your number.
            </p>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onBack}>Back</Button>
            <Button onClick={onProvision} disabled={!acknowledged} className="gap-2">
              <Phone className="w-4 h-4" /> Reserve my number
            </Button>
          </div>
        </div>
      )}

      {/* Step B: Provisioning spinner */}
      {provisioning && (
        <div className="border border-border rounded-xl p-10 text-center mb-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="w-16 h-16 rounded-full border-2 border-primary/20 absolute" />
              <div className="w-16 h-16 rounded-full border-2 border-primary border-t-transparent animate-spin absolute" />
              <Phone className="w-6 h-6 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <p className="font-medium">Reserving your local number...</p>
              <p className="text-sm text-muted-foreground mt-1">Finding the best number in your state</p>
            </div>
          </div>
        </div>
      )}

      {/* Step C: Number confirmed */}
      {provisionedNumber && !provisioning && (
        <>
          <div className="border border-primary/30 bg-primary/5 rounded-xl p-10 text-center mb-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                <Phone className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Your AI will text every lead from</p>
                <p className="text-4xl font-bold font-mono tracking-wider">{provisionedNumber}</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Reply from your CRM and leads won&apos;t know it switched to a human.
                </p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-8">
            {[
              { icon: "⚡", title: "60-second response", desc: "Every new lead texted automatically" },
              { icon: "🤖", title: "24/7 AI follow-up", desc: "Sequences run automatically" },
              { icon: "📅", title: "Appointments logged", desc: "Bookings go straight to your CRM" },
            ].map((item) => (
              <div key={item.title} className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-8">
            {[
              "AI will text every new lead within 60 seconds",
              "Follow-up sequences run automatically — no setup needed",
              "Appointments log directly to your CRM pipeline",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm">
                <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-emerald-500" />
                </div>
                {item}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4 space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={onFinish}
              disabled={loading || !!error}
              className="gap-2"
            >
              {loading ? "Setting everything up..." : "Go to dashboard →"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
