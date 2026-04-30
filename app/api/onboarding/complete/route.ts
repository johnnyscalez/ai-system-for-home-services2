import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { generateSystemPrompt } from "@/lib/claude"
import type { KnowledgeBaseData, AgentConfigData } from "@/lib/claude"

export async function POST(req: NextRequest) {
  try {
    // Auth check using the user's session
    const userSupabase = await createServerSupabaseClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { business, intelligence, aiAgent, provisionedNumber, provisionedTwilioSid, sources } = body

    // Use service role to bypass RLS for all onboarding inserts
    const supabase = createServiceRoleClient()

    // Generate system prompt (non-fatal if fails)
    let systemPrompt = ""
    try {
      const kb: KnowledgeBaseData = {
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
      const config: AgentConfigData = {
        agentName: aiAgent.agentName,
        tone: aiAgent.tone,
        primaryGoal: "book_estimate",
        customInstructions: aiAgent.customInstructions,
        qualifyingQuestions: aiAgent.qualifyingQuestions,
        objectionResponses: aiAgent.objectionResponses,
        workingHoursStart: aiAgent.workingHoursStart,
        workingHoursEnd: aiAgent.workingHoursEnd,
        timezone: aiAgent.timezone,
      }
      systemPrompt = await generateSystemPrompt(kb, config)
    } catch {
      // Non-fatal — AI works without a generated prompt
    }

    const webhookSecret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    // 1. Create company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: business.companyName,
        owner_id: user.id,
        service_type: business.serviceType,
        service_area: business.serviceArea,
        notification_phone: business.notificationPhone,
        onboarding_completed: true,
        webhook_secret: webhookSecret,
      })
      .select()
      .single()

    if (companyError || !company) {
      console.error("Company insert error:", companyError)
      return NextResponse.json({ error: "Failed to create company" }, { status: 500 })
    }

    const companyId = company.id

    // Run remaining inserts in parallel — service role bypasses all RLS
    await Promise.all([
      // 2. Link user to company
      supabase.from("users").update({ company_id: companyId }).eq("id", user.id),

      // 3. Knowledge base
      supabase.from("knowledge_base").insert({
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
      }),

      // 4. AI agent config
      supabase.from("ai_agent_config").insert({
        company_id: companyId,
        agent_name: aiAgent.agentName,
        agent_persona: aiAgent.tone,
        primary_goal: "book_estimate",
        tone: aiAgent.tone,
        custom_instructions: aiAgent.customInstructions || null,
        qualifying_questions: aiAgent.qualifyingQuestions,
        objection_responses: aiAgent.objectionResponses,
        follow_up_enabled: true,
        working_hours_start: aiAgent.workingHoursStart,
        working_hours_end: aiAgent.workingHoursEnd,
        timezone: aiAgent.timezone,
        generated_system_prompt: systemPrompt || null,
        prompt_generated_at: systemPrompt ? new Date().toISOString() : null,
      }),

      // 5. Legacy settings record
      supabase.from("settings").insert({
        company_id: companyId,
        ai_name: aiAgent.agentName,
        qualifying_questions: aiAgent.qualifyingQuestions,
        objection_responses: aiAgent.objectionResponses,
        follow_up_enabled: true,
        working_hours_start: aiAgent.workingHoursStart,
        working_hours_end: aiAgent.workingHoursEnd,
        timezone: aiAgent.timezone,
      }),

      // 6. Phone number (if provisioned)
      ...(provisionedNumber ? [
        supabase.from("phone_numbers").insert({
          company_id: companyId,
          phone_number: provisionedNumber,
          twilio_sid: provisionedTwilioSid || null,
          is_active: true,
        }),
      ] : []),

      // 7. Facebook connection (if selected)
      ...(sources?.facebook ? [
        supabase.from("facebook_connections").insert({
          company_id: companyId,
          is_active: true,
        }),
      ] : []),
    ])

    return NextResponse.json({ success: true, companyId })
  } catch (err) {
    console.error("Onboarding complete error:", err)
    return NextResponse.json({ error: "Onboarding failed" }, { status: 500 })
  }
}
