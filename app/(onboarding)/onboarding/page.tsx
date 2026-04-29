"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Zap, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { StepLeadSources, type LeadSourceState } from "@/components/onboarding/StepLeadSources"
import { StepBusiness, type BusinessData } from "@/components/onboarding/StepBusiness"
import { StepIntelligence, type IntelligenceData } from "@/components/onboarding/StepIntelligence"
import { StepAIAgent, type AIAgentData } from "@/components/onboarding/StepAIAgent"
import { StepPhone } from "@/components/onboarding/StepPhone"
import type { ServiceType } from "@/types/database"

const DEFAULT_OBJECTIONS: Record<string, string> = {
  "Just getting prices": "Totally understand! Our inspections are free and no obligation — we just want to give you an accurate number. Does Tuesday or Thursday work?",
  "Already talking to someone else": "That's smart to compare! Most of our customers did that. When's better — Tuesday at 10 or Thursday at 2?",
  "How much does it cost?": "It really depends on the scope — that's exactly what the free inspection figures out. Takes about 20 minutes. Which day works?",
  "Not interested right now": "No worries at all! Would it be okay if I checked back in a couple weeks when timing might work better?",
  "Call me instead": "Of course! What's the best time to call you today?",
}

const DEFAULT_QUESTIONS: Record<ServiceType, { id: string; question: string }[]> = {
  roofing: [
    { id: "q1", question: "Is this storm damage or just age?" },
    { id: "q2", question: "Are you looking to go through insurance or pay out of pocket?" },
    { id: "q3", question: "What's the property address so we can check your area?" },
  ],
  solar: [
    { id: "q1", question: "Do you own your home?" },
    { id: "q2", question: "What's your average monthly electric bill?" },
    { id: "q3", question: "What's the address — we need to check roof size and sun exposure?" },
  ],
  hvac: [
    { id: "q1", question: "Is it your AC, heat, or both that needs attention?" },
    { id: "q2", question: "How old is your current system?" },
    { id: "q3", question: "Is this a repair or are you looking at replacement?" },
  ],
  windows: [
    { id: "q1", question: "Are you replacing all windows or just specific ones?" },
    { id: "q2", question: "Is this primarily for energy savings, aesthetics, or damage?" },
    { id: "q3", question: "What's the property address?" },
  ],
  bath_remodel: [
    { id: "q1", question: "Are you thinking a full remodel or just fixtures/tub?" },
    { id: "q2", question: "Do you have a timeline in mind?" },
    { id: "q3", question: "Do you own the home?" },
  ],
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
  const supabase = createClient()

  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState("")
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
    avgJobValue: "",
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
    objectionResponses: DEFAULT_OBJECTIONS,
    workingHoursStart: 8,
    workingHoursEnd: 20,
    timezone: "America/New_York",
    generatedPrompt: "",
  })

  // Pre-fill qualifying questions when service type is chosen
  useEffect(() => {
    if (business.serviceType && aiAgent.qualifyingQuestions.length === 0) {
      const defaults = DEFAULT_QUESTIONS[business.serviceType as ServiceType]
      if (defaults) setAiAgent((prev) => ({ ...prev, qualifyingQuestions: defaults }))
    }
  }, [business.serviceType]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleStep2Next() {
    if (!business.companyName || !business.serviceType || !business.serviceArea || !business.notificationPhone) {
      setError("Please fill in all required fields.")
      return
    }
    setError("")
    setStep(3)
  }

  async function handleStep4Next() {
    setStep(5)
    setProvisioning(true)
    setError("")

    try {
      const res = await fetch("/api/onboarding/provision-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: "US",
          state: business.state,
        }),
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    // Auto-generate the AI system prompt if the user skipped it in Step 4
    let finalPrompt = aiAgent.generatedPrompt
    if (!finalPrompt) {
      try {
        const res = await fetch("/api/onboarding/generate-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kb: {
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
            },
            config: {
              agentName: aiAgent.agentName,
              tone: aiAgent.tone,
              primaryGoal: aiAgent.primaryGoal,
              customInstructions: aiAgent.customInstructions,
              qualifyingQuestions: aiAgent.qualifyingQuestions,
              objectionResponses: aiAgent.objectionResponses,
            },
          }),
        })
        if (res.ok) {
          const data = await res.json()
          finalPrompt = data.prompt ?? ""
        }
      } catch {
        // Non-fatal — fallback prompt handles it
      }
    }

    // 1. Create company
    const webhookSecret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: business.companyName,
        owner_id: user.id,
        service_type: business.serviceType,
        service_area: business.serviceArea,
        notification_phone: business.notificationPhone,
        avg_job_value: business.avgJobValue ? parseFloat(business.avgJobValue) : 0,
        onboarding_completed: true,
        webhook_secret: webhookSecret,
      })
      .select()
      .single()

    if (companyError || !company) {
      setError("Failed to create company. Please try again.")
      setLoading(false)
      return
    }

    const companyId = company.id

    // 2. Link user to company
    await supabase.from("users").update({ company_id: companyId }).eq("id", user.id)

    // 3. Save knowledge base
    await supabase.from("knowledge_base").insert({
      company_id: companyId,
      website_url: intelligence.websiteUrl || null,
      business_description: intelligence.businessDescription || null,
      services_offered: intelligence.servicesOffered || null,
      service_areas: intelligence.serviceAreas || null,
      pricing_info: intelligence.pricingInfo || null,
      team_info: intelligence.teamInfo || null,
      unique_selling_points: intelligence.uniqueSellingPoints || null,
      years_in_business: intelligence.yearsInBusiness || null,
      certifications: intelligence.certifications || null,
      testimonials: intelligence.testimonials || null,
      custom_facts: intelligence.customFacts || null,
      custom_ai_knowledge: intelligence.customAiKnowledge || null,
      social_facebook: intelligence.socialFacebook || null,
      social_instagram: intelligence.socialInstagram || null,
    })

    // 4. Save AI agent config
    await supabase.from("ai_agent_config").insert({
      company_id: companyId,
      agent_name: aiAgent.agentName,
      agent_persona: aiAgent.tone,
      primary_goal: aiAgent.primaryGoal,
      tone: aiAgent.tone,
      custom_instructions: aiAgent.customInstructions || null,
      qualifying_questions: aiAgent.qualifyingQuestions,
      objection_responses: aiAgent.objectionResponses,
      follow_up_enabled: true,
      working_hours_start: aiAgent.workingHoursStart,
      working_hours_end: aiAgent.workingHoursEnd,
      timezone: aiAgent.timezone,
      generated_system_prompt: finalPrompt || null,
      prompt_generated_at: finalPrompt ? new Date().toISOString() : null,
    })

    // 5. Save legacy settings record for backwards compat
    await supabase.from("settings").insert({
      company_id: companyId,
      ai_name: aiAgent.agentName,
      qualifying_questions: aiAgent.qualifyingQuestions,
      objection_responses: aiAgent.objectionResponses,
      follow_up_enabled: true,
      working_hours_start: aiAgent.workingHoursStart,
      working_hours_end: aiAgent.workingHoursEnd,
      timezone: aiAgent.timezone,
    })

    // 6. Save phone number
    if (provisionedNumber) {
      await supabase.from("phone_numbers").insert({
        company_id: companyId,
        phone_number: provisionedNumber,
        twilio_sid: provisionedTwilioSid || null,
        is_active: true,
      })
    }

    // 7. Save facebook connection if selected
    if (sources.facebook) {
      await supabase.from("facebook_connections").insert({
        company_id: companyId,
        is_active: true,
      })
    }

    router.push("/dashboard")
    router.refresh()
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
      <div className="flex-1 overflow-y-auto">
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
              onFinish={handleFinish}
              onRetry={handleStep4Next}
            />
          )}
        </div>
      </div>
    </div>
  )
}
