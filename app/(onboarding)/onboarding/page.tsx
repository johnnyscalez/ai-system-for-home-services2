"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Zap, Check, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { StepLeadSources, type LeadSourceState } from "@/components/onboarding/StepLeadSources"
import { StepBusiness, type BusinessData } from "@/components/onboarding/StepBusiness"
import { StepIntelligence, type IntelligenceData } from "@/components/onboarding/StepIntelligence"
import { StepAIAgent, type AIAgentData } from "@/components/onboarding/StepAIAgent"
import { StepPhone } from "@/components/onboarding/StepPhone"
import { StepTechnicians } from "@/components/onboarding/StepTechnicians"
import { StepGmail } from "@/components/onboarding/StepGmail"

const STEPS = [
  { n: 1, label: "Lead sources" },
  { n: 2, label: "Your business" },
  { n: 3, label: "Knowledge base" },
  { n: 4, label: "AI agent" },
  { n: 5, label: "Phone number" },
  { n: 6, label: "Your team" },
  { n: 7, label: "Connect Gmail" },
]

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [provisionedNumber, setProvisionedNumber] = useState("")
  const [provisionedTwilioSid, setProvisionedTwilioSid] = useState("")

  const [sources, setSources] = useState<LeadSourceState>({
    facebook: false,
    googleAds: false,
    webhook: false,
  })

  const [business, setBusiness] = useState<BusinessData>({
    companyName: "",
    serviceType: "",
    state: "",
    officeAddress: "",
    serviceRadius: "",
    notificationPhone: "",
    country: "US",
  })

  const [intelligence, setIntelligence] = useState<IntelligenceData>({
    websiteUrl: "",
    socialFacebook: "",
    socialInstagram: "",
    businessDescription: "",
    servicesOffered: "",
    serviceAreas: "",
    pricingInfo: "",
    financingOptions: "",
    teamInfo: "",
    uniqueSellingPoints: "",
    yearsInBusiness: "",
    certifications: "",
    testimonials: "",
    customFacts: "",
    customAiKnowledge: "",
  })

  const [aiAgent, setAiAgent] = useState<AIAgentData>({
    agentName: "Linda",
    tone: "friendly_professional",
    primaryGoal: "book_estimate",
    customInstructions: "",
    qualifyingQuestions: [],
    disqualifiers: "",
    qualifyingPropertyType: "residential_only",
    qualifyingHomeTypes: ["single_family", "townhouse", "condo", "mobile_home", "multi_family", "new_construction"],
    qualifyingCustomQuestion: "",
    objectionResponses: {},
    workingHoursStart: 8,
    workingHoursEnd: 20,
    // Auto-detect browser timezone — overridden in useEffect below
    timezone: "America/New_York",
    generatedPrompt: "",
  })

  // Detect browser timezone on mount and apply to AI agent config
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) setAiAgent(a => ({ ...a, timezone: tz }))
    } catch { /* fallback to New York */ }
  }, [])

  // Scroll to top whenever step changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [step])

  function handleStep2Next() {
    if (!business.companyName || !business.serviceType || !/\b\d{5}\b/.test(business.officeAddress) || !(Number(business.serviceRadius) > 0)) {
      setError("Please fill in all required fields — the office address needs its 5-digit zip code.")
      return
    }
    setError("")
    setStep(3)
  }

  function handleStep4Next() {
    setStep(5)
    setError("")
  }

  async function handleProvisionPhone() {
    setProvisioning(true)
    setError("")

    try {
      const res = await fetch("/api/onboarding/provision-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: "US", state: business.state }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Failed to provision phone number. Please try again.")
      } else {
        setProvisionedNumber(data.phoneNumber)
        setProvisionedTwilioSid(data.twilioSid)
      }
    } catch {
      setError("Network error — could not provision phone number. Please try again.")
    } finally {
      setProvisioning(false)
    }
  }

  async function handleFinish() {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business,
          intelligence,
          aiAgent,
          provisionedNumber,
          provisionedTwilioSid,
          sources,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Setup failed. Please try again.")
        return
      }

      // Company is now created — advance to Technicians step
      setStep(6)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const kbForAgent = {
    companyName: business.companyName,
    serviceType: business.serviceType,
    serviceArea: business.serviceRadius
      ? `Within ${business.serviceRadius} miles of ${business.officeAddress}`
      : business.officeAddress,
    businessDescription: intelligence.businessDescription,
    servicesOffered: intelligence.servicesOffered,
    pricingInfo: intelligence.pricingInfo,
    teamInfo: intelligence.teamInfo,
    uniqueSellingPoints: intelligence.uniqueSellingPoints,
    yearsInBusiness: intelligence.yearsInBusiness,
    certifications: intelligence.certifications,
    testimonials: intelligence.testimonials,
    customFacts: intelligence.customFacts,
    websiteUrl: intelligence.websiteUrl,
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">FieldBuilt AI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:block">Setup — takes under 10 minutes</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-border px-4 py-4 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center gap-2 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                  step > s.n ? "bg-primary text-primary-foreground" :
                  step === s.n ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {step > s.n ? <Check className="w-3 h-3" /> : s.n}
                </div>
                <span className={cn(
                  "text-xs sm:text-sm whitespace-nowrap",
                  step === s.n ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px w-6 sm:w-10 shrink-0", step > s.n ? "bg-primary" : "bg-border")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-10">
          {step === 1 && (
            <StepLeadSources
              sources={sources}
              onChange={setSources}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <StepBusiness
              data={business}
              onChange={setBusiness}
              onNext={handleStep2Next}
              onBack={() => setStep(1)}
              error={error}
            />
          )}

          {step === 3 && (
            <StepIntelligence
              data={intelligence}
              companyName={business.companyName}
              onChange={setIntelligence}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <StepAIAgent
              data={aiAgent}
              kb={kbForAgent}
              companyName={business.companyName}
              serviceType={business.serviceType}
              serviceArea={kbForAgent.serviceArea}
              onChange={setAiAgent}
              onNext={handleStep4Next}
              onBack={() => setStep(3)}
            />
          )}

          {step === 5 && (
            <StepPhone
              provisioning={provisioning}
              provisionedNumber={provisionedNumber}
              loading={loading}
              error={error}
              onBack={() => setStep(4)}
              onProvision={handleProvisionPhone}
              onFinish={handleFinish}
              onRetry={handleProvisionPhone}
            />
          )}

          {step === 6 && (
            <StepTechnicians
              onNext={() => setStep(7)}
              onSkip={() => setStep(7)}
            />
          )}

          {step === 7 && (
            <StepGmail
              onSkip={() => {
                router.push("/dashboard")
                router.refresh()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
