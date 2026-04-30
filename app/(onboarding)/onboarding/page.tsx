"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Zap, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { StepLeadSources, type LeadSourceState } from "@/components/onboarding/StepLeadSources"
import { StepBusiness, type BusinessData } from "@/components/onboarding/StepBusiness"
import { StepIntelligence, type IntelligenceData } from "@/components/onboarding/StepIntelligence"
import { StepAIAgent, type AIAgentData } from "@/components/onboarding/StepAIAgent"
import { StepPhone } from "@/components/onboarding/StepPhone"

const DEFAULT_OBJECTIONS: Record<string, string> = {
  "Just getting prices": "Totally understand! Our inspections are free and no obligation — we just want to give you an accurate number. Does Tuesday or Thursday work?",
  "Already talking to someone else": "That's smart to compare! Most of our customers did that. When's better — Tuesday at 10 or Thursday at 2?",
  "How much does it cost?": "It really depends on the scope — that's exactly what the free inspection figures out. Takes about 20 minutes. Which day works?",
  "Not interested right now": "No worries at all! Would it be okay if I checked back in a couple weeks when timing might work better?",
  "Call me instead": "Of course! What's the best time to call you today?",
}


const STEPS = [
  { n: 1, label: "Lead sources" },
  { n: 2, label: "Your business" },
  { n: 3, label: "Knowledge base" },
  { n: 4, label: "AI agent" },
  { n: 5, label: "Phone number" },
]

type Step = 1 | 2 | 3 | 4 | 5

export default function OnboardingPage() {
  const router = useRouter()

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
    serviceArea: "",
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
    objectionResponses: DEFAULT_OBJECTIONS,
    workingHoursStart: 8,
    workingHoursEnd: 20,
    timezone: "America/New_York",
    generatedPrompt: "",
  })

  // Scroll to top whenever step changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [step])

  function handleStep2Next() {
    if (!business.companyName || !business.serviceType || !business.serviceArea || !business.notificationPhone) {
      setError("Please fill in all required fields.")
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

      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const kbForAgent = {
    companyName: business.companyName,
    serviceType: business.serviceType,
    serviceArea: business.serviceArea,
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
          <span className="font-semibold tracking-tight">LeadReply</span>
        </div>
        <span className="text-sm text-muted-foreground hidden sm:block">Setup — takes under 10 minutes</span>
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
              serviceArea={business.serviceArea}
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
        </div>
      </div>
    </div>
  )
}
