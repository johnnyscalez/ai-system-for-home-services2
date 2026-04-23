"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChevronRight, Scan, RefreshCw, Globe, Camera, Share2, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type IntelligenceData = {
  websiteUrl: string
  socialFacebook: string
  socialInstagram: string
  businessDescription: string
  servicesOffered: string
  serviceAreas: string
  pricingInfo: string
  teamInfo: string
  uniqueSellingPoints: string
  yearsInBusiness: string
  certifications: string
  testimonials: string
  customFacts: string
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
    placeholder: "Full roof replacement, storm damage repair, gutters, inspections...",
    long: true,
  },
  { key: "serviceAreas", label: "Service areas", placeholder: "Dallas, Plano, Frisco, McKinney TX" },
  {
    key: "uniqueSellingPoints",
    label: "Why customers choose you",
    placeholder: "Lifetime warranty, 24/7 response, GAF Master Elite certified, A+ BBB...",
    long: true,
  },
  { key: "pricingInfo", label: "Pricing & offers", placeholder: "Free inspections, financing available, insurance claims specialist..." },
  { key: "teamInfo", label: "Team & owner", placeholder: "Family-owned, 15 employees, owner Mike Smith with 20 years experience..." },
  { key: "yearsInBusiness", label: "Years in business", placeholder: "15 years, founded 2009..." },
  { key: "certifications", label: "Certifications & credentials", placeholder: "GAF Master Elite, Owens Corning Preferred, licensed & insured..." },
  { key: "testimonials", label: "Customer testimonials", placeholder: "\"Best roofing company in Dallas\" — John S. Google Review 5★" },
  {
    key: "customFacts",
    label: "Anything else the AI should know",
    placeholder: "Common local questions, seasonal promotions, competitor differentiators, local context...",
    long: true,
  },
]

export function StepIntelligence({ data, companyName, onChange, onNext, onBack }: Props) {
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [scanError, setScanError] = useState("")

  function set(field: keyof IntelligenceData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...data, [field]: e.target.value })
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
        servicesOffered: extracted.servicesOffered || data.servicesOffered,
        serviceAreas: extracted.serviceAreas || data.serviceAreas,
        pricingInfo: extracted.pricingInfo || data.pricingInfo,
        teamInfo: extracted.teamInfo || data.teamInfo,
        uniqueSellingPoints: extracted.uniqueSellingPoints || data.uniqueSellingPoints,
        yearsInBusiness: extracted.yearsInBusiness || data.yearsInBusiness,
        certifications: extracted.certifications || data.certifications,
        testimonials: extracted.testimonials || data.testimonials,
      })
      setScanned(true)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to scan. You can fill in manually.")
    } finally {
      setScanning(false)
    }
  }

  const hasAnyData = FIELDS.some((f) => data[f.key])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Build your AI knowledge base</h1>
      <p className="text-muted-foreground mb-8">
        Enter your website and we&apos;ll automatically extract everything your AI needs to know about {companyName || "your business"}. You can review and edit everything it finds.
      </p>

      {/* URL inputs */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="websiteUrl">
            <Globe className="w-3.5 h-3.5 inline mr-1.5" />
            Website URL
          </Label>
          <div className="flex gap-2">
            <Input
              id="websiteUrl"
              placeholder="https://apexroofing.com"
              value={data.websiteUrl}
              onChange={set("websiteUrl")}
              className="flex-1"
            />
            <Button
              onClick={handleScan}
              disabled={!data.websiteUrl || scanning}
              className="shrink-0 gap-2"
            >
              {scanning ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
              ) : scanned ? (
                <><RefreshCw className="w-3.5 h-3.5" /> Re-scan</>
              ) : (
                <><Scan className="w-3.5 h-3.5" /> Scan my business</>
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
            <Input
              id="socialFacebook"
              placeholder="facebook.com/apexroofing"
              value={data.socialFacebook}
              onChange={set("socialFacebook")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="socialInstagram">
              <Camera className="w-3.5 h-3.5 inline mr-1.5 text-pink-400" />
              Instagram <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="socialInstagram"
              placeholder="instagram.com/apexroofing"
              value={data.socialInstagram}
              onChange={set("socialInstagram")}
            />
          </div>
        </div>

        {scanning && (
          <div className="flex items-center gap-3 py-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              Reading your website and extracting business intelligence...
            </span>
          </div>
        )}

        {scanned && !scanning && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            Scan complete — review and edit the fields below
          </div>
        )}

        {scanError && (
          <div className="flex items-start gap-2 text-sm text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{scanError} — fill in the fields below manually.</span>
          </div>
        )}
      </div>

      {/* Editable fields */}
      <div className="space-y-4 mb-8">
        {FIELDS.map(({ key, label, placeholder, long }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key} className={cn(data[key] ? "text-foreground" : "text-muted-foreground")}>
              {label}
              {data[key] && <span className="ml-2 text-xs text-emerald-400">✓ filled</span>}
            </Label>
            {long ? (
              <Textarea
                id={key}
                placeholder={placeholder}
                value={data[key]}
                onChange={set(key)}
                rows={3}
                className="resize-none"
              />
            ) : (
              <Input
                id={key}
                placeholder={placeholder}
                value={data[key]}
                onChange={set(key)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} className="gap-2">
          {hasAnyData ? "Continue with this knowledge base" : "Skip, I'll add this later"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
