import Anthropic from "@anthropic-ai/sdk"
import { logUsage } from "./usage-log"

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
  financingOptions?: string
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

// ── Website scan ─────────────────────────────────────────────────────────────
// Reads the homepage plus a few linked pages (services, about, gallery,
// financing, contact) inside a 20 second budget. The model writes the business
// fields from the page TEXT; the logo, photos, colors, phone and social links
// are read straight from the markup, so none of those can be invented.

export type WebsiteScan = {
  businessDescription?: string | null
  servicesOffered?: string | null
  serviceAreas?: string | null
  pricingInfo?: string | null
  financingOptions?: string | null
  teamInfo?: string | null
  uniqueSellingPoints?: string | null
  yearsInBusiness?: string | null
  certifications?: string | null
  testimonials?: string | null
  logoUrl: string | null
  brandColor: string | null
  /** Absolute URLs of content photos found on the site, largest version first seen, capped */
  imageUrls: string[]
  socialLinks: { facebook?: string; instagram?: string; google?: string; youtube?: string; tiktok?: string; yelp?: string }
  phone: string | null
  /** Pages that were actually read */
  pagesRead: string[]
  /** False when the homepage could not be fetched at all */
  reachable: boolean
}

const SCAN_BUDGET_MS = 20_000
const SCAN_MAX_IMAGES = 24
const SCAN_UA = "Mozilla/5.0 (compatible; FieldBuiltBot/1.0; +https://fieldbuiltai.com)"

/** Only public http(s) hosts: the scan runs on our server, so it must never be pointed inward. */
function publicHttpUrl(raw: string): URL | null {
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`)
  } catch {
    return null
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null
  const host = u.hostname.toLowerCase()
  if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.includes(":")) return null
  return u
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  if (timeoutMs < 500) return null
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": SCAN_UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    })
    if (!res.ok) return null
    const type = res.headers.get("content-type") ?? ""
    if (type && !/html|text\/plain/i.test(type)) return null
    return (await res.text()).slice(0, 1_500_000)
  } catch {
    return null
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function tagAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : null
}

function absoluteUrl(href: string | null, base: URL): string | null {
  if (!href) return null
  const h = href.trim().replace(/&amp;/g, "&")
  if (!h || h.startsWith("data:") || h.startsWith("javascript:") || h.startsWith("#")) return null
  try {
    const u = new URL(h, base)
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
}

const SUBPAGE_PRIORITY: Array<[RegExp, number]> = [
  [/service|flooring|products?|what-we-do/, 1],
  [/about|our-story|company|who-we-are/, 2],
  [/gallery|portfolio|projects?|our-work|photos/, 3],
  [/financ/, 4],
  [/contact|areas?|locations?/, 5],
  [/reviews?|testimonials?/, 6],
]

/** Up to four same-site pages worth reading, most useful first. */
function pickSubpages(html: string, base: URL): string[] {
  const host = base.hostname.replace(/^www\./, "")
  const found = new Map<string, { url: string; rank: number }>()
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const abs = absoluteUrl(tagAttr(tag, "href"), base)
    if (!abs) continue
    const u = new URL(abs)
    if (u.hostname.replace(/^www\./, "") !== host) continue
    const path = u.pathname.toLowerCase().replace(/\/+$/, "")
    if (!path || /\.(pdf|jpe?g|png|webp|gif|zip|docx?)$/.test(path)) continue
    const rank = SUBPAGE_PRIORITY.find(([re]) => re.test(path))?.[1]
    if (!rank) continue
    const existing = found.get(path)
    // Prefer the shallowest path for a topic ("/services" over "/services/lvp/plano").
    if (!existing) found.set(path, { url: `${u.origin}${u.pathname}`, rank: rank * 10 + path.split("/").length })
  }
  return [...found.values()].sort((a, b) => a.rank - b.rank).slice(0, 4).map((p) => p.url)
}

const NOT_A_PHOTO =
  /logo|icon|sprite|favicon|badge|avatar|placeholder|pixel|spacer|loader|loading|payment|flag|emoji|star|rating|arrow|button|pattern|blank|captcha|gravatar|widget|banner-ad/i

function collectImages(html: string, base: URL, into: Map<string, { url: string; score: number }>) {
  const add = (raw: string | null) => {
    let abs = absoluteUrl(raw, base)
    if (!abs) return
    let u = new URL(abs)
    // Next.js sites serve photos through /_next/image?url=<the real file>.
    if (u.pathname === "/_next/image" && u.searchParams.get("url")) {
      abs = absoluteUrl(u.searchParams.get("url"), base)
      if (!abs) return
      u = new URL(abs)
    }
    const path = u.pathname
    if (!/\.(jpe?g|png|webp|avif)$/i.test(path)) return
    if (NOT_A_PHOTO.test(path)) return
    if (/facebook\.com\/tr|doubleclick|google-analytics|googletagmanager/i.test(u.hostname + path)) return
    // WordPress and friends publish "floor-300x200.jpg" next to "floor.jpg".
    // Treat them as one photo and keep the biggest version that was linked.
    const sized = path.match(/-(\d{2,4})x(\d{2,4})(?=\.\w+$)/)
    if (sized && (Number(sized[1]) < 200 || Number(sized[2]) < 150)) return
    const key = `${u.hostname}${path.replace(/-\d{2,4}x\d{2,4}(?=\.\w+$)/, "")}`.toLowerCase()
    const score = sized ? Number(sized[1]) * Number(sized[2]) : Number.MAX_SAFE_INTEGER
    const existing = into.get(key)
    if (!existing || score > existing.score) into.set(key, { url: abs, score })
  }

  const og = html.match(/<meta\b[^>]*property\s*=\s*["']og:image["'][^>]*>/i)?.[0]
  if (og) add(tagAttr(og, "content"))

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const w = Number(tagAttr(tag, "width"))
    const h = Number(tagAttr(tag, "height"))
    if ((w > 0 && w < 200) || (h > 0 && h < 150)) continue
    if (/logo/i.test(`${tagAttr(tag, "alt") ?? ""} ${tagAttr(tag, "class") ?? ""} ${tagAttr(tag, "id") ?? ""}`)) continue
    const srcset = tagAttr(tag, "srcset") ?? tagAttr(tag, "data-srcset")
    if (srcset) {
      // Last candidate is the widest in every srcset we have seen in the wild.
      const last = srcset.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean).pop()
      add(last ?? null)
    }
    add(tagAttr(tag, "data-src") ?? tagAttr(tag, "data-lazy-src") ?? tagAttr(tag, "src"))
  }

  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add(m[1])
}

function findLogo(html: string, base: URL): string | null {
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const hay = `${tagAttr(tag, "src") ?? ""} ${tagAttr(tag, "alt") ?? ""} ${tagAttr(tag, "class") ?? ""} ${tagAttr(tag, "id") ?? ""}`
    if (!/logo/i.test(hay)) continue
    const abs = absoluteUrl(tagAttr(tag, "data-src") ?? tagAttr(tag, "src"), base)
    if (abs) return abs
  }
  const links = html.match(/<link\b[^>]*>/gi) ?? []
  const touch = links.find((t) => /apple-touch-icon/i.test(tagAttr(t, "rel") ?? ""))
  if (touch) return absoluteUrl(tagAttr(touch, "href"), base)
  return null
}

function findBrandColor(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/^(theme-color|msapplication-TileColor)$/i.test(tagAttr(tag, "name") ?? "")) continue
    const c = (tagAttr(tag, "content") ?? "").trim().toLowerCase()
    const hex = /^#[0-9a-f]{6}$/.test(c) ? c : /^#[0-9a-f]{3}$/.test(c) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : null
    // White and black are browser chrome defaults, not a brand color.
    if (hex && hex !== "#ffffff" && hex !== "#000000") return hex
  }
  return null
}

function findSocialLinks(html: string): WebsiteScan["socialLinks"] {
  const out: WebsiteScan["socialLinks"] = {}
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = (tagAttr(tag, "href") ?? "").replace(/&amp;/g, "&")
    if (!/^https?:\/\//i.test(href)) continue
    if (!out.facebook && /facebook\.com\/(?!sharer|share|tr\b|plugins|dialog|login)[\w.\-/]+/i.test(href)) out.facebook = href
    else if (!out.instagram && /instagram\.com\/[\w.\-]+/i.test(href)) out.instagram = href
    else if (!out.google && /(g\.page\/|maps\.app\.goo\.gl\/|google\.[a-z.]+\/maps|business\.google\.com|g\.co\/kgs)/i.test(href)) out.google = href
    else if (!out.youtube && /youtube\.com\/(channel\/|@|c\/|user\/)/i.test(href)) out.youtube = href
    else if (!out.tiktok && /tiktok\.com\/@/i.test(href)) out.tiktok = href
    else if (!out.yelp && /yelp\.com\/biz\//i.test(href)) out.yelp = href
  }
  return out
}

function findPhone(html: string, text: string): string | null {
  const fmt = (digits: string) => {
    const d = digits.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")
    return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null
  }
  const tel = html.match(/href\s*=\s*["']tel:([^"']+)["']/i)?.[1]
  if (tel) {
    const f = fmt(decodeURIComponent(tel))
    if (f) return f
  }
  const m = text.match(/\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/)
  return m ? fmt(m[0]) : null
}

export async function scrapeAndExtractBusinessInfo(
  url: string,
  socialLinks: { facebook?: string; instagram?: string } = {}
): Promise<WebsiteScan> {
  const scan: WebsiteScan = {
    logoUrl: null, brandColor: null, imageUrls: [], socialLinks: {}, phone: null, pagesRead: [], reachable: false,
  }
  const home = publicHttpUrl(url)
  if (!home) return scan

  const deadline = Date.now() + SCAN_BUDGET_MS
  const remaining = () => deadline - Date.now()

  const homeHtml = await fetchHtml(home.toString(), Math.min(10_000, remaining()))
  if (!homeHtml) return scan
  scan.reachable = true
  scan.pagesRead.push(home.toString())

  const subUrls = pickSubpages(homeHtml, home)
  const subHtml = await Promise.all(subUrls.map((u) => fetchHtml(u, Math.min(8_000, remaining() - 500))))
  const pages: Array<{ url: string; html: string }> = [{ url: home.toString(), html: homeHtml }]
  subUrls.forEach((u, i) => {
    const html = subHtml[i]
    if (html) { pages.push({ url: u, html }); scan.pagesRead.push(u) }
  })

  // Markup facts
  const images = new Map<string, { url: string; score: number }>()
  for (const p of pages) collectImages(p.html, new URL(p.url), images)
  scan.imageUrls = [...images.values()].map((i) => i.url).slice(0, SCAN_MAX_IMAGES)
  scan.logoUrl = findLogo(homeHtml, home)
  scan.brandColor = findBrandColor(homeHtml)
  for (const p of pages) scan.socialLinks = { ...findSocialLinks(p.html), ...scan.socialLinks }
  const homeText = htmlToText(homeHtml)
  scan.phone = findPhone(homeHtml, homeText)

  // Text for the model: homepage first, then each extra page under its own heading.
  const websiteContent = pages
    .map((p, i) => `--- PAGE: ${p.url} ---\n${(i === 0 ? homeText : htmlToText(p.html)).slice(0, i === 0 ? 10_000 : 4_500)}`)
    .join("\n\n")

  const socialContext = [
    socialLinks.facebook || scan.socialLinks.facebook ? `Facebook: ${socialLinks.facebook || scan.socialLinks.facebook}` : "",
    socialLinks.instagram || scan.socialLinks.instagram ? `Instagram: ${socialLinks.instagram || scan.socialLinks.instagram}` : "",
  ].filter(Boolean).join(", ")

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are reading a flooring contractor's website to fill in a knowledge base that an AI assistant will answer homeowners from. The owner reviews every field afterwards.

Website URL: ${home.toString()}
${socialContext ? `Social media: ${socialContext}` : ""}

Website text (several pages):
${websiteContent}

Return a JSON object with these fields. Use null for anything the site does not actually say. Never guess, never fill a field from general knowledge of the flooring trade, and never invent a price, a promotion, a warranty or a review.
{
  "businessDescription": "2-3 sentences on what the company does and who it serves",
  "servicesOffered": "the flooring types and services they list (LVP, hardwood, carpet, tile, refinishing, stairs, removal, and so on), one per line",
  "serviceAreas": "the cities, counties or neighborhoods they say they serve, comma separated",
  "pricingInfo": "anything said about the in-home measure or estimate (free or not), current promotions and discounts. Exclude financing.",
  "financingOptions": "every financing detail stated: lender, rate, term length, approval steps, promotions. null if none.",
  "teamInfo": "owner name, crews, how the team works",
  "uniqueSellingPoints": "what they say sets them apart: own crews, warranties, brands carried, guarantees, awards",
  "yearsInBusiness": "how long they have been in business, as stated",
  "certifications": "licenses, insurance, certifications, memberships (NWFA, CFI, BBB and similar)",
  "testimonials": "1-2 customer quotes copied word for word, with the name if shown"
}

Return ONLY the JSON object.`,
        },
      ],
    })
    logUsage({ site: "claude-scrape-business-info", model: "claude-sonnet-4-6", usage: message.usage })
    const text = message.content[0].type === "text" ? message.content[0].text : "{}"
    const jsonText = text.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(jsonText.slice(jsonText.indexOf("{"), jsonText.lastIndexOf("}") + 1)) as Record<string, unknown>
    const str = (v: unknown) => {
      if (Array.isArray(v)) v = v.join("\n")
      return typeof v === "string" && v.trim() && !/^(null|n\/a|none|not found)$/i.test(v.trim()) ? v.trim() : null
    }
    scan.businessDescription = str(parsed.businessDescription)
    scan.servicesOffered = str(parsed.servicesOffered)
    scan.serviceAreas = str(parsed.serviceAreas)
    scan.pricingInfo = str(parsed.pricingInfo)
    scan.financingOptions = str(parsed.financingOptions)
    scan.teamInfo = str(parsed.teamInfo)
    scan.uniqueSellingPoints = str(parsed.uniqueSellingPoints)
    scan.yearsInBusiness = str(parsed.yearsInBusiness)
    scan.certifications = str(parsed.certifications)
    scan.testimonials = str(parsed.testimonials)
  } catch (err) {
    // The markup facts (photos, logo, phone, links) are still worth returning.
    console.error("[scan] could not extract business fields:", err)
  }
  return scan
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
    flooring: "The goal is an in-home measure. Qualify one question at a time using the company's own qualifying questions (listed below when the owner chose them; the live list is also injected into every conversation, so do not hardcode a different one). Never quote a flooring price, a price per square foot or a range: the quote comes after the measure. Never recommend a specific brand, product or install method. Must get the zip code, then the full street address, before booking.",
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

RULE 2 — MAX 2 SENTENCES PER MESSAGE: SMS is not email. Every message must be short, two sentences maximum. Never write a paragraph.

RULE 2b — NO DASHES, NO ASTERISKS: never use an em dash, en dash, or a hyphen standing in for a comma or a pause, and never use an asterisk. Dash-joined sentences are the clearest sign a message was machine-written. Use a second short sentence, a comma, or "to" for time ranges ("8 to 11am"). Hyphens inside words and phone numbers are fine.

RULE 2c — TONE: relaxed, everyday, professional. Write like a competent person at a local company texting, not a brochure and not a friend. No "Awesome!", "Perfect!", "Amazing!". At most one exclamation mark in a whole conversation, usually none. Always use contractions.

RULE 3 — NO FILLER PHRASES: The agent must never open a reply with "Certainly", "Absolutely", "Great question", "Of course", "Happy to help", "Great!", "Perfect!", "Sounds great!", "Wonderful!", or any hollow affirmation. These phrases signal AI and destroy trust instantly. A brief "Got it." or going directly to the next question is always better.

RULE 4 — INFORMATION COLLECTOR PERSONA: The agent collects information and books the visit. It does not advise, diagnose, or speculate. It asks natural questions and moves toward the appointment. Technical and product questions from the lead are redirected to the team at the visit.

RULE 4b — HONEST ABOUT BEING AN AI: The agent introduces itself as the company's AI assistant in its first message and says so plainly whenever asked. It never claims to be a person.

RULE 4c — TEXT ONLY: The agent works by text message. Never write a rule that tells it to call the lead, say "calling you now", or use a call tool. If a lead asks for a phone call, the agent says it will have someone from the team call them and flags the lead for a person (its runtime instructions cover how).

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
${kb.financingOptions ? `FINANCING OPTIONS (agent must know this precisely): ${kb.financingOptions}` : ""}
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

===== THE OWNER'S QUALIFYING QUESTIONS =====
${config.qualifyingQuestions?.length
  ? config.qualifyingQuestions.map((q) => `- ${q.question}`).join("\n") + "\nThese are asked one at a time, in a natural order. Some are required before booking; the runtime instructions mark which."
  : "None chosen. Use the service intelligence above."}

===== OBJECTION HANDLING =====
${Object.entries(config.objectionResponses).map(([obj, resp]) => `When lead says "${obj}": ${resp}`).join("\n") || "Use best-practice objection handling for home services."}

===== WHAT TO WRITE =====
Write a system prompt that makes this AI agent:

1. KNOW THE BUSINESS DEEPLY — like someone who's worked there for years. It should be able to answer questions about services, pricing approach, certifications, service area, and why customers choose this company over competitors.

2. COLLECT INFORMATION NATURALLY — The agent does NOT follow a visible checklist. It reads the conversation and asks the single most relevant question at each moment. For ${kb.serviceType}, it needs to gather: ${serviceIntelligence[kb.serviceType] || "the nature of the job, urgency, ownership, and location"}. It collects this naturally over 2-3 exchanges, one question per reply, never making the lead feel interrogated.

2b. ALWAYS CAPTURE THE CUSTOMER'S NAME — The agent asks who it is speaking with early ("Who am I speaking with?") and, when it only has a first name, asks for the surname once at booking ("And your last name for the booking?"). It saves the name with update_lead_details the moment it hears it. A name mentioned only in conversation notes never reaches the CRM or the confirmation, and the customer then shows up as "Unknown". The agent never invents a name and never asks twice.

2c. ALWAYS ASK FOR THE EMAIL — While collecting booking details the agent asks for the email as a normal booking step ("And what's your email for the confirmation?") and saves it with update_lead_details immediately. The confirmation email and the CRM record depend on it. One direct ask only: if the lead declines or ignores it, book anyway — a booking is never lost over an email address. Never ask for an email (or any field) that is already on file.

3. SCREEN OUT DISQUALIFIED LEADS NATURALLY — If the company has specified leads they don't want to book, the agent discovers this through normal conversation. Once it determines a lead doesn't qualify, it politely lets them know and doesn't push to book.

4. ANSWER QUESTIONS AND BUILD TRUST — If a lead asks about process, credentials, or timeline, the agent answers helpfully using the company's knowledge base. Price questions get the honest answer (the exact number comes after the visit) plus anything the company wrote about its visit fee or current offer, never a number of its own. Technical or product questions are redirected to the team at the visit.

5. MOVE TOWARD BOOKING — Once the lead is qualified, the agent offers two specific time slots and locks in the appointment. Never "when are you available?" — always drive with two specific options.

5b. USE THE COMPANY'S OFFER — If the pricing notes have a CURRENT ADVERTISED OFFER (the offer this company picked for its ads: a free estimate, a percent off, free design help and so on), the lead most likely answered it. The agent brings it up itself, without waiting to be asked: in its first message, as the reason to grab a time when offering slots, and once in the booking confirmation, never in back-to-back messages. It always words the offer exactly as the notes do, never improves or stacks it, and with no such line it never invents one.

6. HANDLE OBJECTIONS WITHOUT FEELING PUSHY — Use the objection responses provided, adapted naturally to the conversation.

7. RESPECT WORKING HOURS — Only when a lead replies outside ${config.workingHoursStart}:00–${config.workingHoursEnd}:00: acknowledge warmly and say someone will follow up first thing during business hours.

8. ENFORCE THESE HARD RULES (include them explicitly in the generated prompt):
   • ONE QUESTION PER MESSAGE — never combine two questions
   • MAX 2 SENTENCES PER MESSAGE — never write a paragraph over SMS
   • NO FILLER PHRASES — never start with "Certainly", "Absolutely", "Great question", "Of course", "Happy to help", "Great!", "Perfect!", or any hollow affirmation
   • NO PRICE QUOTES — the price comes after the visit. Never call the visit "free" unless the company's pricing notes say so
   • DISCLOSE AI STATUS HONESTLY — introduce yourself as the company's AI assistant; never claim to be a person
   • NEVER ASK TWICE — never ask for information already provided (name, phone, email, address, form answers)
   • TEXT ONLY — never say you are calling or will call; if the lead asks for a call, say someone from the team will call them
   ${kb.serviceType === "hvac" ? `• HVAC NO-DIAGNOSIS RULE — never suggest, imply, or guess a technical cause. Collect the lead's exact description in their words. Redirect all diagnostic questions to the technician.` : ""}

The system prompt should read as deep behavioral instructions — NOT a script or checklist.
It should make this AI feel like a sharp, knowledgeable human rep who earns trust fast and moves the conversation forward.`,
      },
    ],
  })

  logUsage({ site: "claude-generate-system-prompt", model: "claude-sonnet-4-6", usage: message.usage })
  return message.content[0].type === "text" ? message.content[0].text : ""
}
