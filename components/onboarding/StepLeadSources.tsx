"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Share2, Link2, Check, ChevronRight, Search, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export type LeadSourceState = {
  facebook: boolean
  googleAds: boolean
  webhook: boolean
}

interface Props {
  sources: LeadSourceState
  onChange: (s: LeadSourceState) => void
  onNext: () => void
}

function SourceCard({
  icon,
  title,
  badge,
  description,
  selected,
  onToggle,
  setupNote,
  howItWorks,
}: {
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  description: string
  selected: boolean
  onToggle: () => void
  setupNote: string
  howItWorks: string
}) {
  return (
    <div className={cn(
      "rounded-xl border p-5 transition-all space-y-4",
      selected ? "border-primary bg-primary/5" : "border-border bg-card"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            selected ? "bg-primary/15" : "bg-muted"
          )}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold">{title}</span>
              {badge}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant={selected ? "outline" : "default"}
          className="shrink-0"
          onClick={onToggle}
        >
          {selected ? (
            <><Check className="w-3.5 h-3.5 mr-1.5" /> Selected</>
          ) : "Select"}
        </Button>
      </div>

      {selected && (
        <div className="ml-14 space-y-2">
          {/* How it works */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            <span>{howItWorks}</span>
          </div>
          {/* What happens next */}
          <div className="flex items-start gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{setupNote}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function StepLeadSources({ sources, onChange, onNext }: Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Where do your leads come from?</h1>
      <p className="text-muted-foreground mb-8">
        Select all the sources you run ads or collect leads from. We&apos;ll walk you through the full connection after setup — takes 2 minutes each.
      </p>

      <div className="space-y-4 mb-8">

        {/* Facebook Lead Ads */}
        <SourceCard
          icon={<Share2 className={cn("w-5 h-5", sources.facebook ? "text-primary" : "text-muted-foreground")} />}
          title="Facebook Lead Ads"
          badge={<Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-200">Most popular</Badge>}
          description="Connect your Facebook ad account. Every lead that submits your lead form gets an AI text within 3.7 seconds."
          selected={sources.facebook}
          onToggle={() => onChange({ ...sources, facebook: !sources.facebook })}
          howItWorks="After completing setup, you'll connect your Facebook account in the Integrations tab — takes about 2 minutes. You'll pick exactly which Facebook Page, ad account, and lead form to sync."
          setupNote="After onboarding → go to Integrations → Facebook Lead Ads → authorize your account and select your lead form."
        />

        {/* Google Ads */}
        <SourceCard
          icon={<Search className={cn("w-5 h-5", sources.googleAds ? "text-primary" : "text-muted-foreground")} />}
          title="Google Ads Lead Forms"
          badge={<Badge variant="outline" className="text-xs">Webhook-based</Badge>}
          description="Capture leads from Google Ads Lead Form Extensions. Google delivers leads to your unique webhook URL — no OAuth required."
          selected={sources.googleAds}
          onToggle={() => onChange({ ...sources, googleAds: !sources.googleAds })}
          howItWorks="Google Ads Lead Form Extensions send lead data to a webhook URL. After setup, you'll get your unique URL to paste into Google Ads under 'Lead delivery → Webhook'."
          setupNote="After onboarding → go to Integrations → Google Ads → copy your webhook URL → paste it in Google Ads account settings."
        />

        {/* Webhook / Other */}
        <SourceCard
          icon={<Link2 className={cn("w-5 h-5", sources.webhook ? "text-primary" : "text-muted-foreground")} />}
          title="Webhook / Other sources"
          badge={<Badge variant="outline" className="text-xs">Universal</Badge>}
          description="Works with Angi, HomeAdvisor, your website contact form, Zapier, or anything else that can send an HTTP request."
          selected={sources.webhook}
          onToggle={() => onChange({ ...sources, webhook: !sources.webhook })}
          howItWorks="After setup you'll get a unique webhook URL. Paste it into any lead source that supports webhooks — or use Zapier to connect platforms that don't."
          setupNote="After onboarding → go to Integrations → Webhook → copy your URL → paste it into your lead source."
        />

      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onNext} className="gap-2">
          Continue <ChevronRight className="w-4 h-4" />
        </Button>
        <button
          onClick={onNext}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now →
        </button>
      </div>
    </div>
  )
}
