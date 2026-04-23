import Anthropic from "@anthropic-ai/sdk"

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export type KnowledgeBaseData = {
  companyName: string
  serviceType: string
  serviceArea: string
  businessDescription?: string
  servicesOffered?: string
  pricingInfo?: string
  teamInfo?: string
  uniqueSellingPoints?: string
  yearsInBusiness?: string
  certifications?: string
  testimonials?: string
  customFacts?: string
  websiteUrl?: string
}

export type AgentConfigData = {
  agentName: string
  tone: string
  primaryGoal: string
  customInstructions?: string
  qualifyingQuestions: { question: string }[]
  objectionResponses: Record<string, string>
  workingHoursStart: number
  workingHoursEnd: number
  timezone: string
  avgJobValue?: number
  notificationPhone?: string
}

export async function scrapeAndExtractBusinessInfo(
  url: string,
  socialLinks: { facebook?: string; instagram?: string }
): Promise<Partial<KnowledgeBaseData>> {
  let websiteContent = ""

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadReplyBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    websiteContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000)
  } catch {
    websiteContent = `Could not fetch website at ${url}`
  }

  const socialContext = [
    socialLinks.facebook ? `Facebook: ${socialLinks.facebook}` : "",
    socialLinks.instagram ? `Instagram: ${socialLinks.instagram}` : "",
  ]
    .filter(Boolean)
    .join(", ")

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are extracting business information from a home services company's website to build an AI knowledge base.

Website URL: ${url}
${socialContext ? `Social media: ${socialContext}` : ""}

Website text content:
${websiteContent}

Extract and return a JSON object with these fields (use null for anything not found):
{
  "businessDescription": "2-3 sentence description of what the company does and who they serve",
  "servicesOffered": "bullet list of specific services they offer",
  "serviceAreas": "cities, counties, or zip codes they serve",
  "pricingInfo": "any pricing info, free estimates, financing options mentioned",
  "teamInfo": "owner name, team size, anything about the people",
  "uniqueSellingPoints": "what makes them different - warranties, response time, guarantees, awards",
  "yearsInBusiness": "how long they've been in business",
  "certifications": "licenses, certifications, insurance, memberships (BBB, GAF, etc.)",
  "testimonials": "1-2 strong customer quotes if found"
}

Return ONLY the JSON object, no other text.`,
      },
    ],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : "{}"
  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim()
    return JSON.parse(clean)
  } catch {
    return {}
  }
}

export async function generateSystemPrompt(
  kb: KnowledgeBaseData,
  config: AgentConfigData
): Promise<string> {
  const toneDescriptions: Record<string, string> = {
    friendly_professional: "warm, friendly, and professional — like a trusted local business owner texting personally",
    casual: "casual and conversational — like a friend texting, relaxed and easy-going",
    formal: "professional and formal — respectful and business-like",
  }

  const goalDescriptions: Record<string, string> = {
    book_estimate: "book a free estimate/inspection appointment",
    qualify_first: "qualify the lead fully before offering an appointment",
    gather_info: "gather detailed project information for an accurate quote",
  }

  const serviceQualifyingContext: Record<string, string> = {
    roofing: "storm damage vs age, insurance claim or cash pay, address for service area check, urgency",
    solar: "home ownership, roof age, average electric bill, shading issues",
    hvac: "system type (AC/heat/both), age of system, repair or replacement, urgency",
    windows: "number of windows, full home or specific rooms, reason (energy savings, aesthetics, damage)",
    bath_remodel: "scope (full remodel vs fixtures), timeline, ownership, budget range",
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: `You are an expert AI sales trainer who writes world-class system prompts for AI SMS sales agents. You specialize in home services contractor sales. You know that:
- The best SMS sales conversations are SHORT (1-2 sentences per message)
- They feel like a real person texting, not a bot
- They guide naturally through stages: open → qualify → handle objection → book → confirm
- They use the lead's name, reference exactly what they inquired about
- They always make the next step dead simple (offer two specific time slots, not "when are you available?")
- They never give up after one no — they follow up with different angles
- They know the business deeply and can speak to specific services, areas, certifications`,
    messages: [
      {
        role: "user",
        content: `Write a complete, world-class system prompt for an AI SMS sales agent with these exact specs:

COMPANY: ${kb.companyName}
SERVICE TYPE: ${kb.serviceType}
SERVICE AREAS: ${kb.serviceArea}
AGENT NAME: ${config.agentName}
TONE: ${toneDescriptions[config.tone] || config.tone}
PRIMARY GOAL: ${goalDescriptions[config.primaryGoal] || config.primaryGoal}

BUSINESS KNOWLEDGE BASE:
${kb.businessDescription ? `Company Overview: ${kb.businessDescription}` : ""}
${kb.servicesOffered ? `Services: ${kb.servicesOffered}` : ""}
${kb.uniqueSellingPoints ? `Why Choose Us: ${kb.uniqueSellingPoints}` : ""}
${kb.pricingInfo ? `Pricing/Offers: ${kb.pricingInfo}` : ""}
${kb.teamInfo ? `Team: ${kb.teamInfo}` : ""}
${kb.yearsInBusiness ? `Experience: ${kb.yearsInBusiness}` : ""}
${kb.certifications ? `Certifications: ${kb.certifications}` : ""}
${kb.testimonials ? `Customer Proof: ${kb.testimonials}` : ""}
${kb.customFacts ? `Additional Context: ${kb.customFacts}` : ""}

KEY QUALIFYING INFO FOR ${kb.serviceType.toUpperCase()}:
${serviceQualifyingContext[kb.serviceType] || "address, timeline, project details, budget"}

CUSTOM INSTRUCTIONS FROM OWNER:
${config.customInstructions || "None"}

QUALIFYING QUESTIONS TO USE:
${config.qualifyingQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n") || "Use service-appropriate defaults"}

OBJECTION RESPONSES:
${Object.entries(config.objectionResponses).map(([obj, resp]) => `"${obj}": ${resp}`).join("\n") || "Use best-practice defaults"}

WORKING HOURS: ${config.workingHoursStart}:00 to ${config.workingHoursEnd}:00 (${config.timezone})

Write a complete system prompt that:
1. Defines the agent's identity and knowledge of the business
2. Gives a clear conversation playbook with exact stage guidance
3. Includes specific objection handling scripts
4. Defines follow-up behavior when leads go cold
5. Sets absolute rules (2-sentence max, never reveal AI, always use first name, always work toward booking)
6. Includes example message templates for each stage
7. Handles edge cases (angry leads, insurance questions, wrong number, etc.)

The prompt should be so good that an AI reading it becomes an expert closer for this specific business.`,
      },
    ],
  })

  return message.content[0].type === "text" ? message.content[0].text : ""
}
