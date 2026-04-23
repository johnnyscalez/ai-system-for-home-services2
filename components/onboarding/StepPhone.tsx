"use client"

import { Button } from "@/components/ui/button"
import { Phone, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  provisioning: boolean
  provisionedNumber: string
  loading: boolean
  error: string
  onBack: () => void
  onFinish: () => void
  onRetry?: () => void
}

export function StepPhone({ provisioning, provisionedNumber, loading, error, onBack, onFinish, onRetry }: Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Your AI phone number</h1>
      <p className="text-muted-foreground mb-8">
        We&apos;re provisioning a local number for your area. Every lead gets texted from this number.
      </p>

      <div className={cn(
        "border rounded-xl p-10 text-center mb-8 transition-all",
        provisioning ? "border-border" : "border-primary/30 bg-primary/5"
      )}>
        {provisioning ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="w-16 h-16 rounded-full border-2 border-primary/20 absolute" />
              <div className="w-16 h-16 rounded-full border-2 border-primary border-t-transparent animate-spin absolute" />
              <Phone className="w-6 h-6 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <p className="font-medium">Provisioning your local number...</p>
              <p className="text-sm text-muted-foreground mt-1">Finding the best number in your area</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
              <Phone className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-4xl font-bold font-mono tracking-wider">{provisionedNumber}</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Your AI will text every lead from this number. Reply from your CRM and leads won&apos;t know it switched to a human.
              </p>
            </div>
          </div>
        )}
      </div>

      {!provisioning && (
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
      )}

      <div className="flex items-center gap-3 mb-4">
        {[
          "AI will text every new lead within 60 seconds",
          "Follow-up sequences run automatically — no setup needed",
          "Appointments log directly to your CRM pipeline",
        ].map((item) => (
          <div key={item} className="hidden" />
        ))}
      </div>

      {!provisioning && (
        <div className="space-y-2 mb-8">
          {[
            "AI will text every new lead within 60 seconds",
            "Follow-up sequences run automatically — no setup needed",
            "Appointments log directly to your CRM pipeline",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5 text-sm">
              <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              </div>
              {item}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4 space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={provisioning || loading}>Back</Button>
        <Button
          onClick={onFinish}
          disabled={provisioning || loading || !!error || !provisionedNumber}
          className="gap-2"
        >
          {loading ? "Setting everything up..." : "Go to dashboard →"}
        </Button>
      </div>
    </div>
  )
}
