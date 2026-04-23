"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Share2, Link2, Check, ChevronRight, ExternalLink, Search } from "lucide-react"
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

export function StepLeadSources({ sources, onChange, onNext }: Props) {
  const anyConnected = sources.facebook || sources.googleAds || sources.webhook
  const hasFbAppId = !!process.env.NEXT_PUBLIC_FB_APP_ID

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Connect your lead sources</h1>
      <p className="text-muted-foreground mb-8">
        Where do your leads come from? We&apos;ll start texting them the moment they submit. You can connect multiple sources.
      </p>

      <div className="space-y-4 mb-8">
        {/* Facebook */}
        <div className={cn(
          "rounded-xl border p-5 transition-all",
          sources.facebook ? "border-primary bg-primary/5" : "border-border bg-card"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <Share2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Facebook Lead Ads</span>
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">Most popular</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your Facebook ad account and select which lead form to sync. Every submission triggers an instant AI text.
                </p>
                {sources.facebook && (
                  <p className="text-xs text-primary mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Connected — will be fully configured after setup
                  </p>
                )}
                {!hasFbAppId && !sources.facebook && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Requires your Facebook App credentials in settings after setup.
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={sources.facebook ? "outline" : "default"}
              className="shrink-0"
              onClick={() => onChange({ ...sources, facebook: !sources.facebook })}
            >
              {sources.facebook ? "Disconnect" : "Connect"}
            </Button>
          </div>
        </div>

        {/* Google Ads */}
        <div className={cn(
          "rounded-xl border p-5 transition-all",
          sources.googleAds ? "border-primary bg-primary/5" : "border-border bg-card"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                <Search className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <span className="font-semibold">Google Ads Lead Forms</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your Google Ads account to sync leads from Google Lead Form extensions directly.
                </p>
                {sources.googleAds && (
                  <p className="text-xs text-primary mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Connected — will be fully configured after setup
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={sources.googleAds ? "outline" : "default"}
              className="shrink-0"
              onClick={() => onChange({ ...sources, googleAds: !sources.googleAds })}
            >
              {sources.googleAds ? "Disconnect" : "Connect"}
            </Button>
          </div>
        </div>

        {/* Webhook */}
        <div className={cn(
          "rounded-xl border p-5 transition-all",
          sources.webhook ? "border-primary bg-primary/5" : "border-border bg-card"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Webhook / Other sources</span>
                  <Badge variant="outline" className="text-xs">Universal</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Angi, HomeAdvisor, your website form, Zapier — paste your unique webhook URL anywhere. Works with anything.
                </p>
                {sources.webhook && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Your webhook URL will be shown after setup completes:</p>
                    <code className="text-xs text-primary">https://app.leadreply.ai/api/webhooks/lead?secret=••••</code>
                    <a
                      href="https://docs.leadreply.ai/webhook"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline mt-1"
                    >
                      View docs <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={sources.webhook ? "outline" : "default"}
              className="shrink-0"
              onClick={() => onChange({ ...sources, webhook: !sources.webhook })}
            >
              {sources.webhook ? "Remove" : "Add"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onNext} disabled={!anyConnected} className="gap-2">
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
