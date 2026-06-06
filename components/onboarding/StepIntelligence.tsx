"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChevronRight, Scan, RefreshCw, Globe, Camera, Share2, CheckCircle2, AlertCircle, Sparkles, Plus, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

export type IntelligenceData = {
  websiteUrl: string
  socialFacebook: string
  socialInstagram: string
  businessDescription: string
  servicesOffered: string
  serviceAreas: string
  pricingInfo: string
  financingOptions: string
  teamInfo: string
  uniqueSellingPoints: string
  yearsInBusiness: string
  certifications: string
  testimonials: string
  customFacts: string
  customAiKnowledge: string
}

interface Props {
  data: IntelligenceData
  companyName: string
  onChange: (d: IntelligenceData) => void
  onNext: () => void
  onBack: () => void
}

const FIELDS: { key: keyof IntelligenceData; label: string; placeholder: string; long?: boolean }[] = [
  {
    key: "businessDescription",
    label: "Business overview",
    placeholder: "What your company does, who you serve, your mission...",
    long: true,
  },
  {
    key: "servicesOffered",
    label: "Services offered",
    placeholder: "AC repair, furnace replacement, new installs, maintenance plans, ductwork...",
    long: true,
  },
  { key: "serviceAreas", label: "Service areas", placeholder: "Dallas, Plano, Frisco, McKinney TX" },
  {
    key: "uniqueSellingPoints",
    label: "Why customers choose you",
    placeholder: "Carrier Factory Authorized, 24/7 emergency, family-owned, 15-year warranty...",
    long: true,
  },
  { key: "pricingInfo", label: "Pricing & offers", placeholder: "Free estimates, seasonal tune-up specials, $89 diagnostic fee..." },
  { key: "teamInfo", label: "Team & owner", placeholder: "Family-owned, 12 techs, owner Mike Smith — 20 years experience..." },
  { key: "yearsInBusiness", label: "Years in business", placeholder: "18 years, founded 2006..." },
  { key: "certifications", label: "Certifications & credentials", placeholder: "NATE-certified, EPA 608, Carrier Factory Authorized, licensed & insured..." },
  { key: "testimonials", label: "Customer testimonials", placeholder: '"Best HVAC company in Dallas" — Sarah M. Google Review 5★' },
]

// Clickable chips — each appends a ready-to-edit sentence to the custom knowledge textarea
const KNOWLEDGE_CHIPS: { label: string; text: string }[] = [
  { label: "Equipment brands",    text: "We carry and install Carrier, Lennox, and Trane equipment." },
  { label: "Factory Authorized",  text: "We are a Carrier Factory Authorized Dealer." },
  { label: "All brands serviced", text: "We service all major HVAC brands regardless of who installed them." },
  { label: "Financing",           text: "We offer 0% financing for 12 months through GreenSky Financing." },
  { label: "Maintenance plans",   text: "We offer annual maintenance plans starting at $149/year covering one tune-up and priority service." },
  { label: "Parts warranty",      text: "All parts and labor come with a 1-year warranty." },
  { label: "Emergency service",   text: "We offer emergency same-day service 24 hours a day, 7 days a week." },
  { label: "Residential only",    text: "We only service residential properties — we do not work on commercial buildings." },
  { label: "No oil/propane",      text: "We do not service oil or propane heating systems — gas and electric only." },
  { label: "Spanish speaking",    text: "Spanish-speaking technicians are available upon request." },
  { label: "No phone quotes",     text: "We never give price quotes over the phone — all estimates are done on-site and are completely free." },
  { label: "No hidden fees",      text: "We have a strict no-hidden-fees policy — the price quoted on-site is the price charged." },
  { label: "Free 2nd opinion",    text: "We offer free second opinions on any competitor quote." },
  { label: "Price match",         text: "We match any written quote from a licensed competitor for the same scope of work." },
  { label: "Licensed & insured",  text: "We are fully licensed and insured in [your state]." },
  { label: "Service area zips",   text: "We serve the following zip codes: [list zip codes here]." },
]

export function StepIntelligence({ data, companyName, onChange, onNext, onBack }: Props) {
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [scanError, setScanError] = useState("")

  function set(field: keyof IntelligenceData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...data, [field]: e.target.value })
  }

  function appendChip(text: string) {
    const current = data.customAiKnowledge.trim()
    const appended = current ? `${current}\n${text}` : text
    onChange({ ...data, customAiKnowledge: appended })
  }

  async function handleScan() {
    if (!data.websiteUrl) return
    setScanning(true)
    setScanError("")

    try {
      const res = await fetch("/api/onboarding/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: data.websiteUrl,
          socialFacebook: data.socialFacebook || undefined,
          socialInstagram: data.socialInstagram || undefined,
        }),
      })

      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const extracted = json.data
      onChange({
        ...data,
        businessDescription: extracted.businessDescription || data.businessDescription,
        servicesOffered:     extracted.servicesOffered     || data.servicesOffered,
        serviceAreas:        extracted.serviceAreas        || data.serviceAreas,
        pricingInfo:         extracted.pricingInfo         || data.pricingInfo,
        financingOptions:    extracted.financingOptions    || data.financingOptions,
        teamInfo:            extracted.teamInfo             || data.teamInfo,
        uniqueSellingPoints: extracted.uniqueSellingPoints || data.uniqueSellingPoints,
        yearsInBusiness:     extracted.yearsInBusiness     || data.yearsInBusiness,
        certifications:      extracted.certifications       || data.certifications,
        testimonials:        extracted.testimonials         || data.testimonials,
      })
      setScanned(true)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to scan. You can fill in manually.")
    } finally {
      setScanning(false)
    }
  }

  const hasAnyData = FIELDS.some((f) => data[f.key])
  const canProceed = !!data.financingOptions.trim()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Build your AI knowledge base</h1>
      <p className="text-muted-foreground mb-8">
        Enter your website and we&apos;ll automatically extract everything your AI needs to know about{" "}
        {companyName || "your business"}. You can review and edit everything it finds.
      </p>

      {/* URL scan */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="websiteUrl">
            <Globe className="w-3.5 h-3.5 inline mr-1.5" />
            Website URL
          </Label>
          <div className="flex gap-2">
            <Input
              id="websiteUrl"
              placeholder="https://acmeair.com"
              value={data.websiteUrl}
              onChange={set("websiteUrl")}
              className="flex-1"
            />
            <Button onClick={handleScan} disabled={!data.websiteUrl || scanning} className="shrink-0 gap-2">
              {scanning ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Scanning...</>
              ) : scanned ? (
                <><RefreshCw className="w-3.5 h-3.5" />Re-scan</>
              ) : (
                <><Scan className="w-3.5 h-3.5" />Scan my business</>
              )}
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="socialFacebook">
              <Share2 className="w-3.5 h-3.5 inline mr-1.5 text-blue-400" />
              Facebook page <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="socialFacebook" placeholder="facebook.com/acmeair" value={data.socialFacebook} onChange={set("socialFacebook")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="socialInstagram">
              <Camera className="w-3.5 h-3.5 inline mr-1.5 text-pink-400" />
              Instagram <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="socialInstagram" placeholder="instagram.com/acmeair" value={data.socialInstagram} onChange={set("socialInstagram")} />
          </div>
        </div>

        {scanning && (
          <div className="flex items-center gap-3 py-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">Reading your website and extracting business intelligence...</span>
          </div>
        )}
        {scanned && !scanning && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />Scan complete!
            </div>
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Review everything below before continuing</p>
                <p className="text-xs text-amber-400/80 mt-0.5">AI pulled this from your website — go through each field and correct anything that&apos;s wrong or missing. Your AI is only as accurate as what&apos;s here.</p>
              </div>
            </div>
          </div>
        )}
        {scanError && (
          <div className="flex items-start gap-2 text-sm text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{scanError} — fill in the fields below manually.</span>
          </div>
        )}
      </div>

      {/* Standard fields */}
      <div className="space-y-4 mb-8">
        {FIELDS.map(({ key, label, placeholder, long }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key} className={cn(data[key] ? "text-foreground" : "text-muted-foreground")}>
              {label}
              {data[key] && <span className="ml-2 text-xs text-emerald-400">✓ filled</span>}
            </Label>
            {long ? (
              <Textarea id={key} placeholder={placeholder} value={data[key]} onChange={set(key)} rows={3} className="resize-none" />
            ) : (
              <Input id={key} placeholder={placeholder} value={data[key]} onChange={set(key)} />
            )}
          </div>
        ))}
      </div>

      {/* ── Financing — required section ────────────────────────────────── */}
      <div className="relative mb-8">
        <div className={cn(
          "absolute inset-0 rounded-2xl p-[2px] pointer-events-none",
          !canProceed
            ? "bg-gradient-to-br from-red-500 via-red-400 to-orange-400"
            : "bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-400"
        )} />
        <div className="relative rounded-2xl bg-white dark:bg-background p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg text-white font-bold text-base",
              !canProceed ? "bg-gradient-to-br from-red-500 to-orange-400 shadow-red-500/25" : "bg-gradient-to-br from-emerald-500 to-teal-400 shadow-emerald-500/25"
            )}>
              $
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-foreground">Financing options</h3>
                {!canProceed ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white uppercase tracking-wide">
                    Required — can&apos;t continue without this
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white uppercase tracking-wide">
                    ✓ Filled
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Your AI needs to know <strong className="text-foreground">exactly</strong> how financing works so it can answer leads confidently.
                Include the lender name, interest rate, term length, and any current promotions.
                If you don&apos;t offer financing, write &quot;We do not offer financing.&quot;
              </p>
            </div>
          </div>
          <Textarea
            id="financingOptions"
            placeholder={
              "Examples:\n" +
              "We offer 0% financing for 18 months through GreenSky — no payments, no interest if paid in full.\n" +
              "We also have a 60-month option at 9.99% APR for larger system replacements.\n" +
              "Approval takes about 2 minutes online or over the phone.\n\n" +
              "— OR —\n\n" +
              "We do not currently offer in-house financing. We accept cash, check, and all major credit cards."
            }
            value={data.financingOptions}
            onChange={set("financingOptions")}
            rows={5}
            className={cn(
              "resize-none font-mono text-xs leading-relaxed",
              !canProceed && "border-red-400 focus:border-red-500"
            )}
          />
          {!canProceed && (
            <p className="text-xs text-red-500 font-medium">
              This field is required. Fill it in to continue — even if it&apos;s just &quot;We do not offer financing.&quot;
            </p>
          )}
        </div>
      </div>

      {/* ── AI Custom Knowledge — critical section ────────────────────────── */}
      <div className="relative mb-8">
        {/* Bold gradient border wrapper */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#F97316] via-[#EA580C] to-[#D97706] p-[2px] pointer-events-none" />
        <div className="relative rounded-2xl bg-white dark:bg-background p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-foreground">What your AI should always know</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white uppercase tracking-wide">
                  Most important
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                These facts get injected into <strong className="text-foreground">every call and text</strong> your AI makes.
                Don&apos;t skip this — it&apos;s the difference between an AI that sounds exactly like your business
                and a generic bot.
              </p>
            </div>
          </div>

          {/* Example chips */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Click anything that applies to your business:</p>
            <div className="flex flex-wrap gap-2">
              {KNOWLEDGE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => appendChip(chip.text)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#FFF3EC] border border-[#F97316]/20 text-[#EA580C] hover:bg-[#FFF3EC] hover:border-[#F97316] transition-colors font-medium"
                >
                  <Plus className="w-3 h-3" />
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <Textarea
              id="customAiKnowledge"
              placeholder={
                "Examples — replace with YOUR specific details:\n\n" +
                "We install Carrier, Trane, and Lennox — NOT Goodman or Rheem.\n" +
                "We offer 0% financing for 18 months through Wells Fargo Home Projects.\n" +
                "Minimum job size is $500 — we do not do minor repairs under that.\n" +
                "We do NOT service commercial or new construction — residential only.\n" +
                "Same-day emergency service available 7 days a week, including holidays.\n" +
                "We are a Carrier Factory Authorized Dealer since 2009.\n" +
                "Our most common question: 'Do you service all brands?' — YES we do.\n" +
                "Customers always ask about Nest/Ecobee thermostats — we install both.\n" +
                "We cover [your city], [nearby city], and [county] — NOT [city you don't serve]."
              }
              value={data.customAiKnowledge}
              onChange={set("customAiKnowledge")}
              rows={8}
              className="resize-none bg-[#FFF3EC]/50 border-[#F97316]/20 focus:border-[#F97316] font-mono text-xs leading-relaxed placeholder:text-muted-foreground/60"
            />
            <p className="text-[11px] text-muted-foreground">
              One fact per line. Mention brand names, what you don&apos;t do, common questions leads ask, local area specifics, and financing details. Your AI treats everything here as ground truth.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!canProceed} className="gap-2">
          {hasAnyData ? "Continue with this knowledge base" : "Continue"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      {!canProceed && (
        <p className="text-xs text-red-500 mt-2">Fill in the Financing options section above to continue.</p>
      )}
    </div>
  )
}
