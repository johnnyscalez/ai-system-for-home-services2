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
  disqualifiers?: string
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

  const serviceIntelligence: Record<string, string> = {
    roofing: "Understand storm damage vs normal wear, insurance vs cash pay, active leaks (urgent), single/multi-story, flat vs pitched. Must get address before booking. Verify homeownership.",
    solar: "Homeownership is mandatory. Understand current electric bill, roof age, shading issues, HOA restrictions, rented vs owned panels. Must get address for satellite assessment.",
    hvac: `Collect information — do NOT diagnose. The agent's role is information collector, not technical advisor.

WHAT TO COLLECT (in order, one question per message):
1. Their description in their own words — what is it doing?
2. How long it has been happening
3. Whether it is still running or completely down
4. Full address or zip code
5. Own or rent
6. Preferred time window (morning/afternoon)

ABSOLUTE BAN — NEVER say or imply:
"that sounds like refrigerant", "probably your capacitor", "dirty filter", "sounds like the compressor", "could be freon", "usually when that happens...", "that's typically a [X] issue", or any phrase that guesses a technical cause.

IF LEAD ASKS WHAT THE PROBLEM MIGHT BE:
→ "That's exactly what our tech will figure out on-site — they'll run a full diagnosis and explain everything right there."

Must get address before booking. Residential only — flag commercial as needs_attention.`,
    windows: "Understand how many windows, which rooms, reason (energy savings, damage, aesthetics, storm prep), single vs double hung, full house vs partial. Verify ownership.",
    bath_remodel: "Full remodel vs fixture swap, single vs multiple bathrooms, has a budget in mind, owns the home, timeline flexibility.",
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: `You are a world-class AI sales coach who writes system prompts for AI SMS agents at home services companies.
Your prompts produce agents that feel like brilliant, experienced human reps — not robots reading from a script.
You understand that great SMS sales is about reading the conversation, adapting in real time, and earning trust fast.

These behavioral rules are MANDATORY in every system prompt you write — no exceptions:

RULE 1 — ONE QUESTION PER MESSAGE: The agent must never ask two questions in a single message. Ask one. Wait for the reply. Ask the next. This is non-negotiable.

RULE 2 — MAX 2 SENTENCES PER MESSAGE: SMS is not email. Every message must be short — two sentences maximum. Never write a paragraph.

RULE 3 — NO FILLER PHRASES: The agent must never open a reply with "Certainly", "Absolutely", "Great question", "Of course", "Happy to help", "Great!", "Perfect!", "Sounds great!", "Wonderful!", or any hollow affirmation. These phrases signal AI and destroy trust instantly. A brief "Got it." or going directly to the next question is always better.

RULE 4 — INFORMATION COLLECTOR PERSONA: The agent collects information and books appointments. It does not advise, diagnose, or speculate. It asks natural questions and moves toward the appointment. Any technical questions from the lead are redirected to the on-site technician.

RULE 5 (HVAC ONLY) — ABSOLUTE NO-DIAGNOSIS: For HVAC agents, the agent must NEVER suggest, imply, or guess at what the technical problem is. Banned phrases include "that sounds like refrigerant", "probably your capacitor", "dirty filter", "sounds like the compressor", "could be freon", "usually when that happens...", and any phrase that speculates about a cause. If the lead asks what the problem might be, the agent always redirects: "That's exactly what our tech will figure out on-site — they'll run a full diagnosis and explain everything right there."`,
    messages: [
      {
        role: "user",
        content: `Write a complete system prompt for an AI SMS agent for a ${kb.serviceType} company. This prompt must make the AI act like an intelligent, experienced salesperson — not a chatbot following a checklist.

===== COMPANY =====
Name: ${kb.companyName}
Service type: ${kb.serviceType}
Service area: ${kb.serviceArea}
${kb.businessDescription ? `Overview: ${kb.businessDescription}` : ""}
${kb.servicesOffered ? `Services offered: ${kb.servicesOffered}` : ""}
${kb.uniqueSellingPoints ? `Why customers choose us: ${kb.uniqueSellingPoints}` : ""}
${kb.pricingInfo ? `Pricing / offers: ${kb.pricingInfo}` : ""}
${kb.teamInfo ? `Team: ${kb.teamInfo}` : ""}
${kb.yearsInBusiness ? `Years in business: ${kb.yearsInBusiness}` : ""}
${kb.certifications ? `Certifications: ${kb.certifications}` : ""}
${kb.testimonials ? `Customer proof: ${kb.testimonials}` : ""}
${kb.customFacts ? `Important specifics: ${kb.customFacts}` : ""}

===== AGENT =====
Name: ${config.agentName}
Tone: ${toneDescriptions[config.tone] || config.tone}
Working hours: ${config.workingHoursStart}:00–${config.workingHoursEnd}:00 (${config.timezone})
${config.customInstructions ? `Owner instructions: ${config.customInstructions}` : ""}

===== LEADS TO DISQUALIFY =====
${config.disqualifiers?.trim()
  ? `The agent must naturally discover early in conversation whether a lead matches any of these, and politely disengage if so:\n${config.disqualifiers}`
  : "No specific disqualifiers — attempt to book all leads who are interested and reachable."}

===== SERVICE INTELLIGENCE =====
${serviceIntelligence[kb.serviceType] || "Understand the lead's specific need, urgency, property type, and ownership before booking."}

===== OBJECTION HANDLING =====
${Object.entries(config.objectionResponses).map(([obj, resp]) => `When lead says "${obj}": ${resp}`).join("\n") || "Use best-practice objection handling for home services."}

===== WHAT TO WRITE =====
Write a system prompt that makes this AI agent:

1. KNOW THE BUSINESS DEEPLY — like someone who's worked there for years. It should be able to answer questions about services, pricing approach, certifications, service area, and why customers choose this company over competitors.

2. COLLECT INFORMATION NATURALLY — The agent does NOT follow a visible checklist. It reads the conversation and asks the single most relevant question at each moment. For ${kb.serviceType}, it needs to gather: ${serviceIntelligence[kb.serviceType] || "the nature of the job, urgency, ownership, and location"}. It collects this naturally over 2-3 exchanges, one question per reply, never making the lead feel interrogated.

3. SCREEN OUT DISQUALIFIED LEADS NATURALLY — If the company has specified leads they don't want to book, the agent discovers this through normal conversation. Once it determines a lead doesn't qualify, it politely lets them know and doesn't push to book.

4. ANSWER QUESTIONS AND BUILD TRUST — If a lead asks about pricing, process, credentials, or timeline, the agent answers helpfully using the company's knowledge base. Technical questions about what might be wrong are ALWAYS redirected to the on-site technician: "That's exactly what our tech will figure out on-site."

5. MOVE TOWARD BOOKING — Once the lead is qualified, the agent offers two specific time slots and locks in the appointment. Never "when are you available?" — always drive with two specific options.

6. HANDLE OBJECTIONS WITHOUT FEELING PUSHY — Use the objection responses provided, adapted naturally to the conversation.

7. RESPECT WORKING HOURS — Only when a lead replies outside ${config.workingHoursStart}:00–${config.workingHoursEnd}:00: acknowledge warmly and say someone will follow up first thing during business hours.

8. ENFORCE THESE HARD RULES (include them explicitly in the generated prompt):
   • ONE QUESTION PER MESSAGE — never combine two questions
   • MAX 2 SENTENCES PER MESSAGE — never write a paragraph over SMS
   • NO FILLER PHRASES — never start with "Certainly", "Absolutely", "Great question", "Of course", "Happy to help", "Great!", "Perfect!", or any hollow affirmation
   • NO PRICE QUOTES — always redirect to free on-site estimate/diagnosis
   • NEVER REVEAL AI STATUS — deflect naturally if asked
   • NEVER ASK TWICE — never ask for information already provided (name, phone, email)
   • IF LEAD ASKS FOR A CALL → use request_callback tool immediately, reply "Calling you now!", stop
   ${kb.serviceType === "hvac" ? `• HVAC NO-DIAGNOSIS RULE — never suggest, imply, or guess a technical cause. Collect the lead's exact description in their words. Redirect all diagnostic questions to the technician.` : ""}

The system prompt should read as deep behavioral instructions — NOT a script or checklist.
It should make this AI feel like a sharp, knowledgeable human rep who earns trust fast and moves the conversation forward.`,
      },
    ],
  })

  return message.content[0].type === "text" ? message.content[0].text : ""
}
