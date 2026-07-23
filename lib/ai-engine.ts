import { anthropic } from "@/lib/claude"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { kbValue } from "@/lib/kb-utils"
import { createCalendarEvent, getCalendarEvents } from "@/lib/google-calendar"
import { getConversationFlow } from "@/lib/conversation-flows"
import { getAvailableSlots, formatSlotsForPrompt, DEFAULT_WINDOWS, DEFAULT_DAYS } from "@/lib/availability"
import { getTwilioClient } from "@/lib/twilio"
import { selectTechnician, flagNoTechAvailable, findSlotsForLead, getTechnicianContextForCompany } from "@/lib/technician-booking"
import type { AppointmentWindow, PerDaySlots } from "@/lib/availability"

export type ConversationAction =
  | { type: "book_appointment"; scheduled_at: string; address?: string; notes?: string }
  | { type: "update_status"; status: "qualified" | "closed_lost" | "needs_attention" }
  | { type: "cancel_appointment"; appointment_id: string; reason?: string }
  | { type: "reschedule_appointment"; appointment_id: string; new_scheduled_at: string }
  | { type: "request_callback" }

export type EngineResult = {
  response: string
  action?: ConversationAction
  outboundConversationId?: string
}

const TOOLS: Parameters<typeof anthropic.messages.create>[0]["tools"] = [
  {
    name: "find_available_slots",
    description:
      "Look up real available appointment slots, filtered by technician availability and zip coverage. Call this when your playbook's BOOKING GATE for this lead's job type is satisfied (the required discovery questions answered — or the lead explicitly pushed to book immediately) AND you have a zip code or address. Do NOT call it just because you happen to have an address early — an address in hand does not mean discovery is done; finish the gate first. Never offer times without calling this first, and never invent times.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_type: {
          type: "string",
          description: "The specific job type. One of: ac_repair, ac_installation, ac_not_cooling, furnace_repair, furnace_not_working, heat_pump_repair, heat_pump_installation, mini_split_repair, mini_split_installation, duct_cleaning, duct_repair, boiler_repair, commercial_hvac, hvac_tune_up, hvac_replacement, air_quality, electrical, plumbing, general",
        },
        zip_code: {
          type: "string",
          description: "5-digit zip code extracted from the lead's address. If you only have a city, pass what you know.",
        },
      },
      required: [],
    },
  },
  {
    name: "book_appointment",
    description:
      "Call this ONLY when: (1) the lead has confirmed a specific date and time, AND (2) you have their service address. Never call this tool without address — go back and collect it first if missing. Convert relative times like 'tomorrow at 2pm' to an ISO 8601 datetime using the current date from the lead file.",
    input_schema: {
      type: "object" as const,
      properties: {
        scheduled_at: { type: "string", description: "ISO 8601 datetime e.g. 2024-06-15T14:00:00" },
        address: { type: "string", description: "Full service address (street, city, state). REQUIRED — do not call this tool without it." },
        notes: { type: "string", description: "Summary of the job: system type, age, issue description, urgency level, ownership status" },
      },
      required: ["scheduled_at", "address"],
    },
  },
  {
    name: "cancel_appointment",
    description:
      "Cancel the lead's scheduled appointment. Use ONLY when the lead explicitly and clearly says they want to cancel and will NOT be rescheduling. Always confirm first: 'Just to confirm — you'd like to cancel your appointment?' then call this tool on confirmation. Never use this if they might want to reschedule.",
    input_schema: {
      type: "object" as const,
      properties: {
        appointment_id: { type: "string", description: "The appointment ID from the lead file" },
        reason: { type: "string", description: "Cancellation reason if provided by the lead" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "reschedule_appointment",
    description:
      "Reschedule the lead's appointment to a new time slot. Use when the lead says they want to change their appointment time. ONLY offer slots from the AVAILABLE BOOKING SLOTS list. Get their preferred slot, confirm it, then call this tool.",
    input_schema: {
      type: "object" as const,
      properties: {
        appointment_id: { type: "string", description: "The appointment ID from the lead file" },
        new_scheduled_at: { type: "string", description: "New ISO 8601 datetime for the appointment, chosen from available slots" },
      },
      required: ["appointment_id", "new_scheduled_at"],
    },
  },
  {
    name: "request_callback",
    description:
      "Use IMMEDIATELY when the lead says 'call me', 'give me a call', 'can you call me', 'just call me', 'phone me', or anything clearly requesting a phone call. This triggers an outbound call to the lead right now. Rules: (1) Call this tool first, (2) send ONE message only — 'Calling you now!' — nothing else. Do NOT ask if the phone number is correct — you already have it in the lead file. Do NOT ask for their address before calling. Do NOT ask any more questions. Just confirm you're calling and stop.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "update_lead_status",
    description:
      "Update the lead's status. Use 'qualified' the moment the lead has answered the BOOKING GATE questions for their job type with nothing disqualifying. Call this DURING discovery, NOT after booking — it moves them into the qualified pipeline. Do not wait until after the appointment is booked. Use 'closed_lost' when they explicitly say they're not interested or already chose someone else. Use 'needs_attention' when they seem frustrated, it's a renter without landlord auth, or a commercial property. Use 'returning_client' when an existing customer (RETURNING CUSTOMER in the lead file) initiates a new service request — this re-enters them into the active pipeline.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["qualified", "closed_lost", "needs_attention", "returning_client"] },
      },
      required: ["status"],
    },
  },
  {
    name: "update_lead_details",
    description:
      "Save job details to the lead's file the MOMENT you learn them mid-conversation — do not wait for booking. Call it as soon as the lead reveals or confirms: what the job is (job_type), what system they have (system_type), how old it is (system_age), or anything else meaningful (situation_notes). The CRM, dispatch logic, and reports all read these fields — and situation_notes is how the office and the tech see the lead's real situation even if they never book. Calling this sends no message and costs nothing — you can call it alongside your normal reply in the same turn. Only pass the fields you actually learned; never guess.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_type: {
          type: "string",
          description: "One of: ac_repair, ac_installation, ac_not_cooling, furnace_repair, furnace_not_working, heat_pump_repair, heat_pump_installation, mini_split_repair, mini_split_installation, duct_cleaning, duct_repair, boiler_repair, commercial_hvac, hvac_tune_up, hvac_replacement, air_quality, electrical, plumbing, general",
        },
        system_type: { type: "string", description: "What they have, in plain words — e.g. 'Central AC', 'Gas furnace', 'Heat pump', 'None (new construction)'" },
        system_age: { type: "string", description: "Rough age as stated — e.g. '~2006, about 20 years', '5-7 years'" },
        situation_notes: { type: "string", description: "One short factual line of NEW information learned this turn that doesn't fit the fields above — symptoms in their words, urgency signals, vulnerable occupants, what they've tried, access notes, decision-maker situation. Appended to the lead's notes for the office and tech. Facts only, no interpretation. Check the lead file's existing notes first — never re-save a fact that's already noted, even reworded." },
      },
      required: [],
    },
  },
]

export async function runConversation(
  leadId: string,
  companyId: string,
  incomingMessage: string | null,
  followUpAngle?: string
): Promise<EngineResult> {
  const supabase = createServiceRoleClient()

  const horizonMs = 14 * 24 * 60 * 60 * 1000

  // Load everything in parallel — lead history, agent config, availability, company schedule, technicians
  const [leadRes, historyRes, agentRes, kbRes, appointmentsRes, companyAptsRes, technicianContext, companyRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).single(),
    supabase
      .from("conversations")
      .select("direction, body, sent_by, created_at")
      .eq("lead_id", leadId)
      // All text channels — sms, messenger, whatsapp (legacy rows are null).
      // Filtering to sms-only made the AI amnesiac on messenger/whatsapp:
      // every inbound looked like a first contact and it re-greeted forever.
      .or("channel.is.null,channel.neq.voice")
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_agent_config")
      .select("generated_system_prompt, agent_name, working_hours_start, working_hours_end, timezone, available_days, appointment_windows, booking_horizon_days, max_appointments_per_day, per_day_slots, disqualifiers, qualifying_questions")
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("knowledge_base")
      .select("business_description, services_offered, service_areas, custom_ai_knowledge, financing_options, pricing_info")
      .eq("company_id", companyId)
      .single(),
    // Lead's own appointment history (past + upcoming) — include id for cancel/reschedule tools
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, address, notes, created_at, confirmation_sms_sent, reminder_1d_sms_sent, reminder_2h_sms_sent, rescheduled_from, cancelled_at")
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: false }),
    // All company appointments in the booking horizon (to know which slots are taken)
    supabase
      .from("appointments")
      .select("scheduled_at")
      .eq("company_id", companyId)
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .lte("scheduled_at", new Date(Date.now() + horizonMs).toISOString()),
    // Technician context block for system prompt
    getTechnicianContextForCompany(companyId),
    // Company name — the fallback prompt path (used when generated_system_prompt
    // hasn't been produced yet) has no other source for this and the model will
    // invent a plausible-sounding one otherwise (observed: "Family HVAC", pulled
    // from the word "Family" in an unrelated business_description sentence).
    supabase.from("companies").select("name").eq("id", companyId).single(),
  ])

  const lead = leadRes.data
  const history = historyRes.data ?? []
  const agent = agentRes.data
  const kb = kbRes.data
  const appointments = appointmentsRes.data ?? []
  const companyApts = companyAptsRes.data ?? []
  const company = companyRes.data

  if (!lead) throw new Error("Lead not found")

  // True initial outreach = AI-first contact, no prior conversation
  // Follow-up = proactive AI touch after a time delay, lead has received prior messages
  const isInitialOutreach = incomingMessage === null && history.length === 0
  const isFollowUp = incomingMessage === null && history.length > 0
  const tz = agent?.timezone ?? "America/New_York"

  // Fetch Google Calendar busy times for the booking horizon (non-blocking — failure is silent)
  let googleBusyTimes: { start: string; end: string }[] = []
  try {
    const { data: gcal } = await supabase
      .from("google_calendar_connections")
      .select("access_token, refresh_token, calendar_id, is_connected")
      .eq("company_id", companyId)
      .single()

    if (gcal?.is_connected && gcal.access_token && gcal.refresh_token) {
      const saveRefreshedToken = async (newToken: string) => {
        await supabase
          .from("google_calendar_connections")
          .update({ access_token: newToken })
          .eq("company_id", companyId)
      }

      const events = await getCalendarEvents(
        gcal.access_token,
        gcal.refresh_token,
        gcal.calendar_id ?? "primary",
        new Date().toISOString(),
        new Date(Date.now() + horizonMs).toISOString(),
        saveRefreshedToken
      )
      googleBusyTimes = events
        .filter((e) => e.start?.dateTime && e.end?.dateTime)
        .map((e) => ({ start: e.start!.dateTime!, end: e.end!.dateTime! }))
    }
  } catch (err) {
    console.error("[ai-engine] Google Calendar fetch failed — slots will not be filtered:", err)
  }

  // Compute real available booking slots — excludes system appointments AND Google Calendar events
  const availableSlots = getAvailableSlots(
    {
      available_days: (agent?.available_days as string[] | null) ?? DEFAULT_DAYS,
      appointment_windows: (agent?.appointment_windows as AppointmentWindow[] | null) ?? DEFAULT_WINDOWS,
      booking_horizon_days: agent?.booking_horizon_days ?? 7,
      max_appointments_per_day: agent?.max_appointments_per_day ?? null,
      timezone: tz,
      per_day_slots: (agent?.per_day_slots as PerDaySlots | null) ?? null,
    },
    companyApts,
    googleBusyTimes
  )

  // Build rich lead context block — injected into every system prompt call
  const leadContext = buildLeadContext(lead, appointments, tz)

  // Build service-specific conversation flow playbook
  const conversationFlow = getConversationFlow(lead.service_type as string | null, lead.job_type as string | null)

  // Format available slots block — AI offers ONLY these real times, never invents them
  const slotsBlock = formatSlotsForPrompt(availableSlots)

  // Build system prompt
  const baseSystemPrompt =
    agent?.generated_system_prompt ||
    buildFallbackSystemPrompt(
      agent?.agent_name ?? "Linda",
      company?.name ?? "the company",
      kbValue(kb?.business_description) ?? "",
      kbValue(kb?.services_offered) ?? "",
      lead.service_type ?? "home services"
    )

  // System prompt order:
  // 1. Who the agent is + business knowledge
  // 2. HVAC conversation flow + stage rules
  // 3. Qualification rules (company-specific disqualifiers)
  // 4. Real available slots (the AI must offer only these)
  // 5. Lead file (live lead data, history, returning vs new)
  const customKnowledgeBlock = kbValue(kb?.custom_ai_knowledge)
    ? `=== YOUR COMPANY-SPECIFIC KNOWLEDGE ===\n${kbValue(kb?.custom_ai_knowledge)}\n=== END COMPANY-SPECIFIC KNOWLEDGE ===`
    : ""

  // When a company hasn't configured financing, say so explicitly rather than
  // staying silent — an empty block let the model fall back on generic
  // industry assumptions and offer payment plans that don't exist.
  const financingBlock = kbValue(kb?.financing_options)
    ? `=== FINANCING OPTIONS (know this precisely — leads ask about this) ===\n${kbValue(kb?.financing_options)}\n=== END FINANCING ===`
    : `=== FINANCING ===\nThis company has NOT given you any financing or payment-plan information. Never say or imply that financing, payment plans, or monthly payments are available. If asked, say you're not the one who handles payment details and the tech can go over the options on-site.\n=== END FINANCING ===`

  // Give the model the company's RAW pricing info plus hard rules, and let
  // it identify the visit fee semantically — whatever the company calls it.
  // The previous regex extractor failed both ways: synonyms it didn't know
  // ("consultation fee", "$79 to come out") silently dropped the entire
  // policy block, and its dollar-range filter could nuke legitimate lines
  // like "Service call $89, repairs from $250". Phrasing recognition is a
  // language task — the model's job, not a regex's. The block now ALWAYS
  // exists (even with no pricing info at all) so the never-assume /
  // never-quote rules are always in force.
  const pricingPolicyBlock = (() => {
    const info = (kb as { pricing_info?: string } | null)?.pricing_info?.trim()
    return [
      "=== SERVICE CALL FEE POLICY — THE ONLY PRICES YOU MAY EVER DISCUSS ===",
      info
        ? "The company's raw pricing information is below. From it, the ONLY number you may ever state to a lead is the fee for the visit itself — whatever the company calls it: service call, service fee, trip charge, visit fee, diagnostic fee, dispatch fee, call-out fee, consultation, assessment, \"$X to come out\", or any similar wording. If that fee is waived or credited toward the work and the info says so, always say that too — it's your strongest line."
        : "This company has not provided any pricing information.",
      ...(info ? ["--- COMPANY PRICING INFO (raw, verbatim from the company) ---", info, "--- END COMPANY PRICING INFO ---"] : []),
      "HARD RULES, NO EXCEPTIONS:",
      "• Any job, repair, replacement, or install prices/ranges in the info above are INTERNAL REFERENCE ONLY — never state them, never hint at them, never confirm or deny a number the lead floats (\"is it more than $500?\" still gets no number). The tech gives the exact, honest price on-site before any work happens.",
      "• If no visit/service-call fee appears above: do NOT assume the visit is free, and do NOT invent or estimate a fee. Say the tech provides an exact price on-site before any work; if the lead pushes specifically on what the visit itself costs, say the office confirms that when the appointment is set — never a guess.",
      "• Never say \"free to come out\" or \"free estimate\" unless the info above explicitly says so (and if free applies only to estimates/replacements but not service calls, keep that distinction exact).",
      "• Make ZERO assumptions beyond what is written above. Raw information only.",
      "=== END SERVICE CALL FEE POLICY ===",
    ].join("\n")
  })()

  const qualifyingQs = Array.isArray(agent?.qualifying_questions)
    ? (agent.qualifying_questions as Array<{ question: string }>).map(q => q.question)
    : []
  const qualificationBlock = buildQualificationBlock(agent?.disqualifiers ?? null, qualifyingQs)

  const reasoningBlock = `=== BEFORE EVERY REPLY — SILENT REASONING (never show any of this to the lead) ===
You are not a script-follower. You are a sharp human rep who thinks before every message. Run through this, in order, every single turn:

1. JOB — What exactly does this lead need? If you can't name the job type yet, your next message asks it — nothing else matters until you know. The moment you learn it (or any system details), call update_lead_details so it's saved to their file.
2. KNOWN — What has this lead already told me, anywhere? Re-read the lead file and the whole conversation, including things they volunteered without being asked. Never re-ask any of it. Volunteered info counts as captured.
3. GATE — For this job type, which required discovery/qualification items are still missing? (Your playbook defines them; your QUALIFICATION RULES define who qualifies.) Count them one by one — one covered item does not check off the others.
4. QUALIFIED? — Based on what I know: qualified (say so via update_lead_status and move toward booking), disqualified (handle it with respect, per the rules), or not enough information yet (keep discovering).
5. NEXT — What is the single most useful question or action right now, and why am I asking it? Every question should have a purpose you could explain: it qualifies them, sizes the job for the tech, or sets urgency. If you can't say why you're asking, don't ask it.
6. SHAPE — When the lead just described a problem, order the reply acknowledge → reassure → ask, in one short text: name their problem back in their words, one beat of "you're in the right place," then the single question. And NO DEAD-END MESSAGES: every message either asks one question, offers slots, or confirms a booking — ending a viable conversation without asking for the booking is the #1 way reps lose winnable leads.

The feel to aim for: a person texting from the office who's genuinely paying attention — curious about the specifics, remembers everything said, asks what a real dispatcher or comfort advisor would actually need to know, and never rushes a big considered purchase to a calendar link after one exchange. Speed matters on urgent repairs; attention matters on everything else. Homeowners ghost when they feel interrogated, hear jargon, or get a fumbled price answer — and they book with whoever responds fastest and sounds most like a competent human who actually cares.
=== END SILENT REASONING ===`

  const smsHardRules = `=== SMS HARD RULES — THESE OVERRIDE EVERYTHING ABOVE ===

FORMATTING:
• Plain text only. NO markdown. No **bold**, no _italic_, no bullet points with *, no headers.
• Numbers and times in plain text: "tomorrow at 9am", not "**tomorrow at 9am**".
• SMS renders plain text. Asterisks show up literally. Never use them.
• Keep messages SHORT — aim under ~160 characters when it reads naturally. One idea per text, plain everyday words, zero HVAC jargon.
• Emoji: at most one, occasionally, only in a warm moment (a booking locked, a friendly nudge). Never in safety, price, or problem-description messages. When in doubt, none.

OPT-OUT — ABSOLUTE:
• Any message that reads as wanting out — "stop", "unsubscribe", "quit texting me", "leave me alone", "not interested, stop" — gets ONE polite goodbye at most, closed_lost status, and total silence after. No follow-ups, no sequences, no exceptions.

CONVERSATION STYLE:
• Never repeat or paraphrase what the lead just said. Never echo their words back.
  ✗ "That works for your 'tomorrow at 9am' request!"
  ✗ "Got it, so you said tomorrow at 9am — perfect!"
  ✓ Just respond to the next thing you need.
• Never re-announce a time slot after the lead has already picked one. Move forward.
• When the lead confirms a time, your ONLY job is to get the address (if missing) and book.
  ✗ "Great! Wednesday June 17th morning works!"
  ✓ "What's the address we're coming to?"
• One thing per message. If you need an address, ask ONLY for the address. Nothing else.
• Never use exclamation points after confirming what the lead already said.
• NEVER show self-correction in a message — no "actually scratch that", "wait", "let me rephrase", no correcting yourself mid-text. Decide what to say BEFORE writing; the lead only ever sees the final, single version. If you realize mid-thought the lead already answered something, simply don't ask it.
• NO DEAD-END MESSAGES: until a booking is confirmed, EVERY message you send must end with your next question or a slot offer. A bare acknowledgment ("Perfect.", "Got it.", "That makes sense.") with nothing after it stalls the conversation and loses the lead. Acknowledge AND ask, in the same message — this applies even when you're also calling a tool in the same turn.

AFTER ANSWERING AN OBJECTION — PIVOT IMMEDIATELY:
When a lead asks a question (cost, free visit, timeline, etc.) that you can answer without their input, end that same message with the next unanswered question. Do NOT stop and wait.
  ✗ "Pricing depends on what the tech finds." [full stop — AI is now silent waiting]
  ✓ "Pricing depends on what the tech finds — they give you the exact number on-site. What's the address we'd be coming to?"
Exception: if the lead is venting frustration or describing a bad prior experience, lead with empathy first — that message is the acknowledgment. Ask the next question in your following message.

BOOKING FLOW:
• NEVER tell the lead they're booked ("you're on the schedule", "you're all set") unless you are calling book_appointment in this exact turn. Saying it without the tool call means the appointment does not exist — the worst failure this system can produce.
• Lead confirms time → ask for address (if not on file) → book immediately.
• If address IS already on file, book without asking for it again.
• After booking: one short confirmation — day, time, address. Done.
• Normal flow: lead picks a time → you ask for address → they give it → book immediately. Do NOT ask "does that still work?" — the time was already confirmed.
• Only re-confirm the time if there was an explicit rejection in between: you told them their address is outside your service area, OR they said "actually, wrong address" and corrected themselves. In those cases, say "Does [time] still work for you?" before booking.
• The address being given is part of the normal booking flow — it is NOT an interruption and does NOT require re-confirmation.

YOU ARE REAL-TIME — NEVER DEFER:
You are an AI that operates instantly. When you call find_available_slots, that IS the check — it runs in real time and you already have the answer.
NEVER say any of the following (or anything that means the same thing):
  ✗ "Let me check availability"
  ✗ "I'll look into that"
  ✗ "Give me a moment"
  ✗ "I'll follow up with some times"
  ✗ "Let me check with our team"
  ✗ "I'll get back to you"
  ✗ "I want to make sure we get the right tech — let me check"
Why: Every one of these implies you are about to go check something. But you already checked — the tool ran and the result is in front of you. Saying "let me check" after already checking is a lie. It makes you sound like a confused human, not a professional AI.
What to do instead: Tell the lead what the system found RIGHT NOW. If there are slots, offer them. If there are no slots, say so directly and tell them what happens next. Always answer with what you know, not with a promise to find out later.

=== END SMS HARD RULES ===`

  const staticPrefix = [baseSystemPrompt, financingBlock, pricingPolicyBlock, customKnowledgeBlock, conversationFlow, qualificationBlock, technicianContext]
    .filter(Boolean)
    .join("\n\n")
  const dynamicTail = [slotsBlock, leadContext, reasoningBlock, smsHardRules]
    .filter(Boolean)
    .join("\n\n")
  const systemPrompt: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> = [
    { type: "text", text: staticPrefix, cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamicTail },
  ]

  // Build message history for Claude
  const messages: Parameters<typeof anthropic.messages.create>[0]["messages"] = []

  if (isInitialOutreach) {
    // First contact — ask Claude to write the initial outreach SMS
    messages.push({
      role: "user",
      content: `Write the opening SMS to send to this new lead. Rules:
- Output ONLY the message text. No notes, no timing commentary, no explanations, no markdown.
- 1-2 sentences max.
- ALWAYS introduce yourself by name and company in the first message. Format: "Hey [FirstName]! It's [AgentName] from [CompanyName] — ..." Use the agent name and company name from your identity in the system prompt.
- Feel personal, not mass-text.
- Do NOT start with "Hi!" — be natural. "Hey [name]!" is fine.
- If "Notes from lead form" appears in the lead file, use that specific detail to personalize the message — say "AC repair" not "HVAC", say "new roof" not "roofing". Be specific about what they need, not just the service category.
- If the notes describe a PROBLEM (broken, not cooling, no heat, leaking), add one brief beat of acknowledgment before your question — e.g. "no AC in this heat is rough — you're in the right place." One beat, then the question. If it's a quote/install/tune-up request, skip the sympathy and lead with helpful energy instead.
- If there are no notes, reference their general service interest naturally.
- Never say "I saw you reached out about [service category]" — that sounds like a form letter.
- Working hours rules do NOT apply here — just write the message text.`,
    })
  } else if (isFollowUp) {
    // Proactive follow-up — lead hasn't booked yet, no new inbound message.
    // Give Claude the conversation history as plain text so it can avoid
    // repeating what was already said and write a natural check-in.
    const convoLines = history
      .slice(-10)
      .map((m) => `${m.direction === "inbound" ? "Lead" : "You"}: ${m.body}`)
      .join("\n")
    const angleInstruction = followUpAngle
      ? `\n\nSPECIFIC ANGLE FOR THIS FOLLOW-UP:\n${followUpAngle}`
      : ""
    messages.push({
      role: "user",
      content: `Conversation so far:\n${convoLines}\n\nThe lead hasn't booked yet. You're sending a proactive follow-up — a natural, brief check-in. Write one short SMS, under 15 words. Don't repeat what you've already said. Be casual and human, not salesy or pushy.${angleInstruction}`,
    })
  } else {
    // Normal reply to an inbound message — build full conversation history.
    // Sanitize: Anthropic API requires strictly alternating user/assistant turns.
    // Consecutive same-role messages (can happen if a send failed mid-turn) are
    // collapsed: keep only the LAST message in each consecutive run so the
    // history remains valid without losing the most recent context.
    const sanitized: Array<{ role: "user" | "assistant"; content: string }> = []
    for (const msg of history) {
      const role = msg.direction === "inbound" ? "user" : "assistant"
      if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === role) {
        // Merge: append the new content to the previous same-role message
        sanitized[sanitized.length - 1].content += "\n" + msg.body
      } else {
        sanitized.push({ role, content: msg.body })
      }
    }
    for (const msg of sanitized) {
      messages.push(msg)
    }
    // Ensure the last history message is assistant before appending the new user turn
    if (messages.length > 0 && messages[messages.length - 1].role === "user") {
      // Last history entry is user — merge with incoming rather than stacking
      messages[messages.length - 1].content += "\n" + incomingMessage!
    } else {
      messages.push({ role: "user", content: incomingMessage! })
    }
  }

  // Call Claude
  const claudeResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  })

  let responseText = ""
  let action: ConversationAction | undefined

  // Track find_available_slots tool call separately — it's a lookup, not an action
  let findSlotsToolId:    string | null = null
  let findSlotsJobType:   string | null = null
  let findSlotsZip:       string | null = null
  let detailsSaved = false

  // update_lead_details is a pure side-effect write, executed immediately —
  // deliberately NOT routed through the single `action` slot, so it can
  // never clobber (or be clobbered by) a booking/status action called in
  // the same turn.
  const saveLeadDetails = async (input: { job_type?: string; system_type?: string; system_age?: string; situation_notes?: string }) => {
    const patch: Record<string, string> = {}
    if (input.job_type) patch.job_type = input.job_type
    if (input.system_type) patch.system_type = input.system_type
    if (input.system_age) patch.system_age = input.system_age
    if (input.situation_notes?.trim()) {
      // Append, never overwrite — notes accumulate across the conversation
      // so the office sees the full picture even if the lead never books.
      const { data: current } = await supabase.from("leads").select("notes").eq("id", leadId).single()
      patch.notes = current?.notes
        ? `${current.notes} | ${input.situation_notes.trim()}`
        : input.situation_notes.trim()
    }
    if (Object.keys(patch).length === 0) return
    detailsSaved = true
    try {
      await supabase.from("leads").update(patch).eq("id", leadId)
    } catch (err) {
      console.error("[ai-engine] update_lead_details write failed:", err)
    }
  }

  // update_lead_status is also executed immediately, for the same reason —
  // the model is coached to call it DURING discovery, which means it now
  // routinely co-occurs with book_appointment in the same turn. When both
  // shared the single `action` slot, whichever block came last silently
  // clobbered the other: observed live as the lead being told "you're on
  // the schedule" while no appointment was ever created, because
  // update_lead_status arrived after book_appointment and overwrote it.
  // The status write happens here; the action slot only carries it when
  // nothing more important claimed the slot (the SMS webhook still reads
  // the action for its needs_attention owner notification).
  const saveLeadStatus = async (status: string) => {
    const legacyMap: Record<string, string> = {
      qualified: "qualified",
      closed_lost: "lost",
      needs_attention: "needs_attention",
      returning_client: "contacted",
    }
    try {
      await supabase
        .from("leads")
        .update({ status: legacyMap[status] ?? status, last_message_at: new Date().toISOString() })
        .eq("id", leadId)
    } catch (err) {
      console.error("[ai-engine] update_lead_status write failed:", err)
    }
  }

  for (const block of claudeResponse.content) {
    if (block.type === "text") {
      responseText = block.text.trim()
    } else if (block.type === "tool_use") {
      if (block.name === "find_available_slots") {
        findSlotsToolId  = block.id
        const inp = block.input as { job_type?: string; zip_code?: string }
        findSlotsJobType = inp.job_type ?? null
        findSlotsZip     = inp.zip_code ?? null
      } else if (block.name === "update_lead_details") {
        await saveLeadDetails(block.input as { job_type?: string; system_type?: string; system_age?: string; situation_notes?: string })
      } else if (block.name === "book_appointment") {
        const input = block.input as { scheduled_at: string; address?: string; notes?: string }
        action = { type: "book_appointment", ...input }
      } else if (block.name === "cancel_appointment") {
        const input = block.input as { appointment_id: string; reason?: string }
        action = { type: "cancel_appointment", ...input }
      } else if (block.name === "reschedule_appointment") {
        const input = block.input as { appointment_id: string; new_scheduled_at: string }
        action = { type: "reschedule_appointment", ...input }
      } else if (block.name === "update_lead_status") {
        const input = block.input as { status: "qualified" | "closed_lost" | "needs_attention" }
        await saveLeadStatus(input.status)
        // Only claim the action slot when nothing more important has —
        // a status update must never displace a booking from the same turn.
        if (!action) action = { type: "update_status", status: input.status }
      } else if (block.name === "request_callback") {
        action = { type: "request_callback" }
      }
    }
  }

  // If find_available_slots was called, discard any text Claude produced alongside it.
  // That text is always "thinking out loud" (e.g. "Let me check...") — the real SMS
  // comes from the slot-flow response below, never from the same turn as the tool call.
  if (findSlotsToolId) responseText = ""

  // Bracket-only text is the model narrating an action instead of writing
  // the SMS — never send stage directions to a lead's phone.
  if (/^\s*\[[^\]]*\]\s*$/.test(responseText)) responseText = ""

  // ── find_available_slots: run the lookup, save slot→tech map, get Claude's slot-offer text ──
  if (findSlotsToolId) {
    const slotsResult = await findSlotsForLead(companyId, findSlotsJobType, findSlotsZip)

    let toolResultText: string

    if (slotsResult.found && slotsResult.slots.length > 0) {
      // Save slot→tech map to the lead record (persists across turns so booking-time lookup works)
      const slotMap: Record<string, { tech_id: string; tech_name: string }> = {}
      for (const s of slotsResult.slots) {
        slotMap[s.isoStart.substring(0, 16)] = { tech_id: s.techId, tech_name: s.techName }
      }
      await supabase.from("leads").update({ selected_slots: slotMap }).eq("id", leadId)

      const slotLines = slotsResult.slots.slice(0, 5).map(s =>
        `• ${s.label} | scheduled_at for book_appointment: "${s.isoStart}"`
      ).join("\n")

      toolResultText = `Available slots for this job and location:\n${slotLines}\n\n` +
        `Before offering the slots, briefly set context in one sentence — e.g.: "I'll have one of our technicians come out — they'll walk you through everything and go over all your options on-site." Then offer exactly 2 of these slots.\n\n` +
        `NEVER mention the technician by name. Always say "our technician" or "one of our techs".\n` +
        `Use the exact scheduled_at string when calling book_appointment.\n\n` +
        `IMPORTANT: You MUST include a plain-text SMS message in your response — do not call any tool without also outputting the text you are sending to the lead.`
    } else {
      // No slots available — take over immediately with a direct, honest reply.
      // Do NOT go through the tool-result chain: an unresolved tool call in the
      // message history confuses the fallback, and the global catch-all has no
      // slot context so Claude invents times from the system prompt. Instead,
      // make one clean call with explicit "no slots, here's why" context.
      const reasonLabels: Record<string, string> = {
        no_technicians:          "no technicians have been configured yet",
        no_specialization_match: "no technician is trained for this service type",
        no_zip_match:            "this zip code is outside our current service area",
        no_slots:                "all technicians are fully booked for the next few days",
      }
      const why = slotsResult.found === false
        ? (reasonLabels[slotsResult.reason] ?? slotsResult.reason)
        : reasonLabels.no_slots

      // Save the extracted zip to the lead record so the CRM reflects it
      if (findSlotsZip) {
        const existingMeta = (typeof lead.metadata === "object" && lead.metadata !== null)
          ? lead.metadata as Record<string, unknown>
          : {}
        try {
          await supabase
            .from("leads")
            .update({ metadata: { ...existingMeta, service_zip: findSlotsZip } })
            .eq("id", leadId)
        } catch { /* non-critical */ }
      }

      // Build a reason-specific honest message. The key rule: you already checked
      // right now — never say "let me check" or "I'll follow up to look into this."
      // Those phrases imply future checking that won't happen. Be direct about what
      // the system found (or didn't find) and what happens next.
      const noSlotsContext = slotsResult.found === false ? {
        no_zip_match:
          `You just checked in real time and found that zip code ${findSlotsZip ?? "provided"} is outside the current service area. ` +
          `Say: we checked and unfortunately that area is a bit outside where we currently operate, but our team will personally reach out within 24 hours to see if we can make it work. ` +
          `Do NOT say "let me check" or "I'll look into it" — you already checked. Be warm, direct, and honest.`,
        no_specialization_match:
          `You just checked in real time and found no technician trained for this specific service type in this area. ` +
          `Say: we checked and don't currently have a tech certified for that service nearby, but your details have been flagged for our team who will reach out within 24 hours with options. ` +
          `Do NOT say "let me check" — you already checked.`,
        no_technicians:
          `You just checked in real time and found no technicians have been set up in the system yet. ` +
          `Say: you've been flagged as a priority and someone from our team will reach out within 24 hours to get you scheduled. ` +
          `Do NOT say "let me check" — you already checked.`,
        no_slots:
          `You just checked in real time and found all technicians are fully booked for the next several days. ` +
          `Say: we're fully booked right now, but your name is at the top of the list and our team will reach out within 24 hours the moment a slot opens. ` +
          `Do NOT say "let me check" — you already checked.`,
      }[slotsResult.reason] ?? `You already checked and found no availability (${why}). Be honest and direct about this. Do NOT say "let me check" or imply future checking.`
      : `You already checked and found no availability (${why}). Be direct about this.`

      const noSlotsReply = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        system: systemPrompt,
        messages: [
          ...messages,
          {
            role: "user" as const,
            content: `IMPORTANT — YOU ALREADY CHECKED AVAILABILITY RIGHT NOW AND THIS IS THE RESULT:\n${noSlotsContext}\n\n` +
              `Write one warm, brief SMS based on this. Plain text only, no markdown, no asterisks. ` +
              `NEVER say "let me check", "I'll look into it", "give me a moment", or any phrase that implies you are about to check — because you already did.`,
          },
        ],
      })
      for (const block of noSlotsReply.content) {
        if (block.type === "text") responseText = block.text.trim()
      }
      if (!responseText) {
        responseText = slotsResult.found === false && slotsResult.reason === "no_zip_match"
          ? "We checked and that area is just outside our current coverage — our team will reach out within 24 hours to see if we can make it work!"
          : "We checked and we're fully booked right now — our team will reach out within 24 hours the moment something opens up!"
      }
      action = { type: "update_status", status: "needs_attention" }
      return { response: responseText, action }
    }

    // Get Claude's slot-offering reply (reached only when slotsResult.found === true)
    // Provide tool_results for EVERY tool_use in the response (Claude sometimes calls
    // update_lead_status alongside find_available_slots in the same turn — every tool_use
    // must have a corresponding tool_result or the API returns a 400).
    const slotToolResults = (claudeResponse.content as Array<{ type: string; id?: string; name?: string }>)
      .filter(b => b.type === "tool_use")
      .map(b => ({
        type: "tool_result" as const,
        tool_use_id: b.id!,
        content: b.id === findSlotsToolId
          ? toolResultText
          : b.name === "update_lead_details" ? "Details saved. Your reply must still move the conversation forward — a question or a slot offer, never a bare acknowledgment." : "Status updated.",
      }))

    const slotMessages = [
      ...messages,
      { role: "assistant" as const, content: claudeResponse.content },
      { role: "user" as const, content: slotToolResults },
    ]

    const slotReply = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: systemPrompt,
      tools: TOOLS,
      messages: slotMessages,
    })

    for (const block of slotReply.content) {
      if (block.type === "text") responseText = block.text.trim()
      else if (block.type === "tool_use") {
        if (block.name === "update_lead_status") {
          const input = block.input as { status: "qualified" | "closed_lost" | "needs_attention" }
          await saveLeadStatus(input.status)
          if (!action || action.type === "update_status") {
            action = { type: "update_status", status: input.status }
          }
        } else if (block.name === "book_appointment") {
          const input = block.input as { scheduled_at: string; address?: string; notes?: string }
          action = { type: "book_appointment", ...input }
        } else if (block.name === "update_lead_details") {
          await saveLeadDetails(block.input as { job_type?: string; system_type?: string; system_age?: string; situation_notes?: string })
        }
      }
    }

    // A response that is ONLY a bracketed meta line (observed live:
    // "[calling find_available_slots for new install / zip 28211]") is the
    // model narrating a tool call instead of writing the SMS. Sending it
    // would put literal stage directions on a lead's phone — treat it as
    // no response so the forced-reply fallback below kicks in.
    if (/^\s*\[[^\]]*\]\s*$/.test(responseText)) responseText = ""

    // Fallback: if Claude called a tool but produced no text, force a text-only reply.
    // Provide tool_results for ALL tool_use blocks in slotReply — not just the first.
    if (!responseText) {
      const slotReplyToolResults = (slotReply.content as Array<{ type: string; id?: string; name?: string }>)
        .filter(b => b.type === "tool_use")
        .map(b => ({
          type: "tool_result" as const,
          tool_use_id: b.id!,
          content: b.name === "book_appointment"
            ? "Appointment booked. Now send the lead a brief confirmation text."
            : "Done. Now send the lead a brief, warm text reply.",
        }))

      const fallbackContent: string | Array<{ type: "tool_result"; tool_use_id: string; content: string }> =
        slotReplyToolResults.length > 0
          ? slotReplyToolResults
          : "You must send a text message to the lead now. Write only the SMS text — no tool calls."

      const fallbackMessages: typeof slotMessages = [
        ...slotMessages,
        { role: "assistant" as const, content: slotReply.content },
        { role: "user" as const, content: fallbackContent } as { role: "user"; content: typeof fallbackContent },
      ]
      const fallbackReply = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        system: systemPrompt,
        messages: fallbackMessages,
      })
      for (const block of fallbackReply.content) {
        if (block.type === "text") responseText = block.text.trim()
      }
    }

    // Hard guarantee — slots path returns early before global catch-all, so enforce
    // text here. If book_appointment fired we can build confirmation from data.
    // Otherwise ask Claude text-only with no tools so it must reply.
    if (!responseText) {
      if (action?.type === "book_appointment") {
        const a = action as { type: "book_appointment"; scheduled_at: string; address?: string }
        const day = new Date(a.scheduled_at).toLocaleDateString("en-US", {
          weekday: "long", month: "short", day: "numeric", timeZone: tz,
        })
        responseText = a.address
          ? `You're on the schedule — ${day} at ${a.address}. Our tech will reach out before heading over.`
          : `You're on the schedule for ${day}. Our tech will reach out before heading over.`
      } else {
        try {
          const lastResort = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 100,
            system: systemPrompt,
            messages: [
              ...messages,
              { role: "user" as const, content: "Reply to this lead now with 1-2 sentences. Plain text only. No tool calls." },
            ],
          })
          for (const b of lastResort.content) {
            if (b.type === "text") responseText = b.text.trim()
          }
        } catch { /* ignore */ }
        if (!responseText) responseText = "I can get a tech out to you this week — does morning or afternoon work better?"
      }
    }

    // Strip meta-commentary for initial outreach (same as below)
    if (isInitialOutreach && responseText) {
      const firstLine = responseText.split("\n").find(l => l.trim().length > 0 && !l.startsWith("Note:") && !l.startsWith("**")) ?? responseText
      responseText = firstLine.replace(/^---+\s*/, "").replace(/\s*---+$/, "").trim()
    }

    return { response: responseText, action }
  }

  // For initial outreach, strip any meta-commentary Claude might add — keep only the first real line
  if (isInitialOutreach && responseText) {
    const firstLine = responseText.split("\n").find(l => l.trim().length > 0 && !l.startsWith("Note:") && !l.startsWith("**")) ?? responseText
    responseText = firstLine.replace(/^---+\s*/, "").replace(/\s*---+$/, "").trim()
  }

  // If Claude used a tool and needs to continue to get the text response,
  // send tool result back and get the final text.
  // Provide tool_results for ALL tool_use blocks — Claude sometimes calls multiple
  // tools in one turn (e.g. update_lead_details + update_lead_status). Every tool_use
  // must have a corresponding tool_result or the API returns a 400. This also covers
  // the details/status-only turn (no action-slot tool, no text): the model saved data
  // but still owes the lead an actual reply.
  if ((action || detailsSaved) && !responseText) {
    const actionToolResults = (claudeResponse.content as Array<{ type: string; id?: string; name?: string }>)
      .filter(b => b.type === "tool_use")
      .map(b => ({
        type: "tool_result" as const,
        tool_use_id: b.id!,
        content: b.name === "update_lead_details"
          ? "Details saved to the lead file. Now send the lead your next SMS — it MUST move the conversation forward: your next unanswered gate question, or a slot offer. Never a bare acknowledgment like 'Perfect.' or 'Got it.'"
          : b.name === "update_lead_status"
          ? "Status updated. Now send the lead your next SMS — it MUST move the conversation forward: your next unanswered gate question, or a slot offer. Never a bare acknowledgment."
          : action?.type === "cancel_appointment"
          ? "Appointment cancelled. Send a brief, warm confirmation to the lead that it's been cancelled."
          : action?.type === "reschedule_appointment"
          ? "Appointment rescheduled. Confirm the new date and time to the lead in a short, friendly text."
          : action?.type === "request_callback"
          ? "Call initiated. Send exactly this message and nothing else: 'Calling you now!' Do NOT ask any more questions."
          : "Appointment booked. Confirm to the lead with the scheduled day, time, and address. Do NOT include a technician name — the system assigns the right tech automatically and they will reach out directly. Say: 'You're on the schedule — [Day] at [Time] at [Address]. Our tech will reach out before heading over.'",
      }))

    const toolResultMessages = [
      ...messages,
      { role: "assistant" as const, content: claudeResponse.content },
      { role: "user" as const, content: actionToolResults },
    ]

    const followUp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: systemPrompt,
      tools: TOOLS,
      messages: toolResultMessages,
    })

    for (const block of followUp.content) {
      if (block.type === "text") {
        responseText = block.text.trim()
      }
    }

    // If follow-up returned only another tool call (no text), generate a minimal fallback
    // so the conversation history stays valid and the lead gets a response.
    if (!responseText && action?.type === "book_appointment") {
      const a = action as { type: "book_appointment"; scheduled_at: string; address?: string }
      const day = new Date(a.scheduled_at).toLocaleDateString("en-US", {
        weekday: "long", month: "short", day: "numeric", timeZone: tz,
      })
      responseText = a.address
        ? `You're on the schedule — ${day} at ${a.address}. Tech will reach out before heading over.`
        : `You're on the schedule for ${day}. Tech will reach out before heading over.`
    }
  }

  // Global catch-all: if we still have no text by this point (tool-only reply, failed
  // second call, or any other silent path) force one text-only response so the lead
  // always gets a reply and the conversation never just stops.
  if (!responseText && !isInitialOutreach) {
    try {
      const catchAllReply = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        system: systemPrompt,
        messages: [
          ...messages,
          {
            role: "user" as const,
            content: "You have not sent a reply yet. Write a short SMS response to the lead now. Plain text only.",
          },
        ],
      })
      for (const block of catchAllReply.content) {
        if (block.type === "text") responseText = block.text.trim()
      }
    } catch {
      // absolute last resort — never imply deferred follow-up the AI won't do
      responseText = "I can get a tech out to you this week — does morning or afternoon work better?"
    }
  }

  return { response: responseText, action }
}

/**
 * Runs a fast Haiku call to determine if the lead is qualified, unqualified,
 * or if there's not yet enough information. Only fires when the lead has sent
 * at least 2 messages so there's meaningful context.
 */
async function checkQualification(
  conversationHistory: string,
  disqualifiers: string | null,
  serviceType: string
): Promise<"qualified" | "unqualified" | "unknown"> {
  try {
    const disqualifierSection = disqualifiers?.trim()
      ? `Reasons this company does NOT want to book a lead:\n${disqualifiers.trim()}`
      : `No specific disqualifiers set — any interested, reachable homeowner who needs ${serviceType} work qualifies.`

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{
        role: "user",
        content: `Determine if this ${serviceType} lead is QUALIFIED, UNQUALIFIED, or UNKNOWN based on the conversation.

${disqualifierSection}

A lead is QUALIFIED when:
- They have answered the key discovery questions (what's wrong, property details, ownership)
- Nothing in the conversation matches a disqualifier
- They appear genuinely interested and reachable

A lead is UNQUALIFIED when:
- They clearly match one of the disqualifiers above
- They are a renter without landlord authorization
- They are a commercial property (if residential only)
- They have explicitly said they're not interested or already booked someone else

Reply UNKNOWN if there is not yet enough information to decide.

Conversation:
${conversationHistory}

Reply with exactly one word: QUALIFIED, UNQUALIFIED, or UNKNOWN.`,
      }],
    })
    const text = ((response.content[0] as { text: string }).text ?? "").trim().toUpperCase()
    if (text.startsWith("UNQUALIFIED")) return "unqualified"
    if (text.startsWith("QUALIFIED")) return "qualified"
    return "unknown"
  } catch {
    return "unknown"
  }
}

export async function processAndSave(
  leadId: string,
  companyId: string,
  incomingMessage: string | null,
  incomingTwilioSid?: string,
  followUpAngle?: string,
  channel: "sms" | "messenger" | "whatsapp" = "sms"
): Promise<EngineResult> {
  const supabase = createServiceRoleClient()

  // Save the inbound message first
  if (incomingMessage !== null) {
    await supabase.from("conversations").insert({
      lead_id: leadId,
      company_id: companyId,
      direction: "inbound",
      sent_by: "human",
      body: incomingMessage,
      twilio_sid: incomingTwilioSid ?? null,
      channel,
    })

    // Move to active_conversation on first reply (from any "just came in" state)
    await supabase
      .from("leads")
      .update({
        last_message_at: new Date().toISOString(),
        status: "active_conversation",
      })
      .eq("id", leadId)
      .in("status", ["just_came_in", "new", "contacted", "following_up", "followed_up", "nurturing", "cold"])
  }

  // Run the AI engine — wrapped so any internal crash still gets a reply to the lead
  let result: EngineResult
  try {
    result = await runConversation(leadId, companyId, incomingMessage, followUpAngle)
  } catch (err) {
    console.error("[ai-engine] runConversation threw — sending fallback reply:", err)
    result = { response: "I can get a tech out to you this week — does morning or afternoon work better?" }
  }

  // Final guard — runConversation returned empty text. Call Claude text-only for real response.
  // Never use deferred-action language ("get back to you") — AI won't follow up manually.
  if (!result.response && incomingMessage !== null) {
    try {
      const { data: hist } = await supabase
        .from("conversations")
        .select("direction, body")
        .eq("lead_id", leadId)
        .or("channel.is.null,channel.neq.voice")
        .order("created_at", { ascending: true })
        .limit(20)
      const histLines = (hist ?? []).map(m => `${m.direction === "inbound" ? "Lead" : "AI"}: ${m.body}`).join("\n")
      const { data: agentCfg } = await supabase.from("ai_agent_config").select("generated_system_prompt").eq("company_id", companyId).single()
      const sp = agentCfg?.generated_system_prompt ?? "You are an HVAC scheduling assistant. Reply with 1 short SMS."
      const rescue = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system: sp + "\n\nRULE: Reply with 1-2 sentences. Plain text only. No tool calls. Move the conversation toward booking.",
        messages: [
          { role: "user" as const, content: `Conversation:\n${histLines}\n\nLead just said: "${incomingMessage}"\n\nReply now.` },
        ],
      })
      for (const b of rescue.content) {
        if (b.type === "text" && b.text.trim()) result = { ...result, response: b.text.trim() }
      }
    } catch { /* ignore */ }
    // If even rescue fails, use contextual fallback — never "get back to you"
    if (!result.response) {
      result = { ...result, response: "I can get a tech out to you this week — does morning or afternoon work better?" }
    }
  }

  // Save outbound AI message and capture its ID for Twilio SID update
  let outboundConversationId: string | undefined
  if (result.response) {
    const { data: conv } = await supabase.from("conversations").insert({
      lead_id: leadId,
      company_id: companyId,
      direction: "outbound",
      sent_by: "ai",
      body: result.response,
      channel,
    }).select("id").single()
    outboundConversationId = conv?.id
  }

  // Handle actions
  if (result.action) {
    if (result.action.type === "book_appointment") {
      const { scheduled_at, address, notes } = result.action

      // Look up pre-selected tech from find_available_slots (saved to leads.selected_slots mid-conversation)
      const { data: freshLead } = await supabase
        .from("leads")
        .select("job_type, address, selected_slots")
        .eq("id", leadId)
        .single()

      const selectedSlots = freshLead?.selected_slots as Record<string, { tech_id: string; tech_name: string }> | null
      const normalKey = scheduled_at.substring(0, 16) // YYYY-MM-DDTHH:MM
      const preSelected = selectedSlots
        ? Object.entries(selectedSlots).find(([k]) => k.substring(0, 16) === normalKey)?.[1]
        : null

      // Create appointment — with pre-selected tech if available
      const { data: apt } = await supabase
        .from("appointments")
        .insert({
          lead_id:              leadId,
          company_id:           companyId,
          scheduled_at,
          address:              address ?? null,
          notes:                notes ?? null,
          status:               "scheduled",
          confirmation_status:  "pending_confirmation",
          technician_id:        preSelected?.tech_id   ?? null,
          technician_name:      preSelected?.tech_name ?? null,
        })
        .select()
        .single()

      // Update lead status
      await supabase
        .from("leads")
        .update({ status: "appointment_booked", last_message_at: new Date().toISOString() })
        .eq("id", leadId)

      // Always infer and save job_type (even when tech was pre-selected — needed for Reports)
      const inferredJobType = inferJobType(notes ?? "")
      if (inferredJobType) {
        await supabase
          .from("leads")
          .update({ job_type: inferredJobType })
          .eq("id", leadId)
          .is("job_type", null)
      }

      // Save address to lead record if not already stored
      if (address) {
        await supabase
          .from("leads")
          .update({ address })
          .eq("id", leadId)
          .is("address", null)
      }

      // If no pre-selected tech (AI skipped find_available_slots or slots expired), fall back to selectTechnician
      if (!preSelected && apt) {
        const jobType = inferredJobType ?? (freshLead?.job_type as string | null)
        const zip     = extractZip(address ?? freshLead?.address ?? "")
        const techResult = await selectTechnician(companyId, apt.id, scheduled_at, jobType, zip)
        if (techResult.found) {
          await notifyTechnician(supabase, companyId, leadId, scheduled_at, address, notes,
            techResult.technician.id, techResult.technician.name, techResult.technician.phone)
        } else {
          await flagNoTechAvailable(apt.id, techResult.reason, companyId)
        }
      } else if (preSelected && apt) {
        // Pre-selected path — look up tech phone for notification
        const { data: tech } = await supabase
          .from("technicians")
          .select("phone")
          .eq("id", preSelected.tech_id)
          .single()
        await notifyTechnician(supabase, companyId, leadId, scheduled_at, address, notes,
          preSelected.tech_id, preSelected.tech_name, tech?.phone ?? null)
      }

      // HCP-mode companies: mirror the booking into Housecall Pro as a real job.
      // Fire-and-forget so the lead's confirmation SMS is never delayed by HCP
      // latency; failed pushes are retried by the reconciliation cron.
      if (apt) {
        import("@/lib/housecall-sync")
          .then(({ pushBookingToHcp }) => pushBookingToHcp(apt.id))
          .catch((err) => console.error("[hcp-sync] booking push failed:", err))
      }

      // Try to create Google Calendar event
      if (apt) {
        try {
          const { data: gcal } = await supabase
            .from("google_calendar_connections")
            .select("access_token, refresh_token, calendar_id, is_connected")
            .eq("company_id", companyId)
            .single()

          if (gcal?.is_connected && gcal.access_token && gcal.refresh_token) {
            const { data: lead } = await supabase
              .from("leads")
              .select("first_name, last_name, phone")
              .eq("id", leadId)
              .single()

            const saveRefreshedToken = async (newToken: string) => {
              await supabase
                .from("google_calendar_connections")
                .update({ access_token: newToken })
                .eq("company_id", companyId)
            }

            const gcalEvent = await createCalendarEvent(
              gcal.access_token,
              gcal.refresh_token,
              gcal.calendar_id ?? "primary",
              {
                summary: `Estimate: ${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim(),
                description: notes ?? "",
                location: address ?? "",
                startTime: scheduled_at,
                endTime: new Date(new Date(scheduled_at).getTime() + 60 * 60000).toISOString(),
              },
              saveRefreshedToken
            )

            // Store google_event_id on the appointment
            await supabase
              .from("appointments")
              .update({ google_event_id: gcalEvent.id ?? null })
              .eq("id", apt.id)
          }
        } catch (err) {
          console.error("[ai-engine] Google Calendar event creation failed:", err)
        }
      }
    } else if (result.action.type === "cancel_appointment") {
      const { appointment_id, reason } = result.action
      await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason ?? null,
        })
        .eq("id", appointment_id)
        .eq("company_id", companyId)

      await supabase
        .from("leads")
        .update({ status: "active_conversation", last_message_at: new Date().toISOString() })
        .eq("id", leadId)

    } else if (result.action.type === "reschedule_appointment") {
      const { appointment_id, new_scheduled_at } = result.action

      // Capture the old time before overwriting
      const { data: oldApt } = await supabase
        .from("appointments")
        .select("scheduled_at, google_event_id")
        .eq("id", appointment_id)
        .eq("company_id", companyId)
        .single()

      await supabase
        .from("appointments")
        .update({
          scheduled_at: new_scheduled_at,
          rescheduled_from: oldApt?.scheduled_at ?? null,
          // Reset reminder flags so new reminders fire for the new time
          reminder_2d_email_sent: false,
          reminder_2d_sms_sent: false,
          reminder_1d_email_sent: false,
          reminder_1d_sms_sent: false,
          reminder_2h_email_sent: false,
          reminder_2h_sms_sent: false,
        })
        .eq("id", appointment_id)
        .eq("company_id", companyId)

      await supabase
        .from("leads")
        .update({ status: "appointment_booked", last_message_at: new Date().toISOString() })
        .eq("id", leadId)

      // Update Google Calendar event if it exists
      if (oldApt?.google_event_id) {
        try {
          const { data: gcal } = await supabase
            .from("google_calendar_connections")
            .select("access_token, refresh_token, calendar_id, is_connected")
            .eq("company_id", companyId)
            .single()
          if (gcal?.is_connected && gcal.access_token && gcal.refresh_token) {
            const { deleteCalendarEvent, createCalendarEvent } = await import("@/lib/google-calendar")
            await deleteCalendarEvent(gcal.access_token, gcal.refresh_token, gcal.calendar_id ?? "primary", oldApt.google_event_id)
            const { data: leadData } = await supabase.from("leads").select("first_name, last_name").eq("id", leadId).single()
            const newGcalEvent = await createCalendarEvent(
              gcal.access_token, gcal.refresh_token, gcal.calendar_id ?? "primary",
              {
                summary: `Estimate: ${leadData?.first_name ?? ""} ${leadData?.last_name ?? ""}`.trim(),
                description: "",
                startTime: new_scheduled_at,
                endTime: new Date(new Date(new_scheduled_at).getTime() + 60 * 60000).toISOString(),
              }
            )
            await supabase.from("appointments").update({ google_event_id: newGcalEvent.id ?? null }).eq("id", appointment_id)
          }
        } catch (err) {
          console.error("[ai-engine] Google Calendar reschedule failed:", err)
        }
      }

    } else if (result.action.type === "update_status") {
      // Map legacy statuses to new pipeline stages
      const legacyMap: Record<string, string> = {
        qualified: "qualified",
        closed_lost: "lost",
        needs_attention: "needs_attention",
        returning_client: "contacted",
      }
      await supabase
        .from("leads")
        .update({
          status: legacyMap[result.action.status] ?? result.action.status,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", leadId)

    } else if (result.action.type === "request_callback") {
      // Trigger an outbound Twilio call to the lead
      try {
        const { data: leadData } = await supabase
          .from("leads")
          .select("phone")
          .eq("id", leadId)
          .single()

        const { data: phoneRecord } = await supabase
          .from("phone_numbers")
          .select("phone_number")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()

        if (leadData?.phone && phoneRecord?.phone_number) {
          // Fetch recent text context (sms/messenger/whatsapp) so the voice
          // agent knows exactly what this call is about
          const { data: smsHistory } = await supabase
            .from("conversations")
            .select("direction, body")
            .eq("lead_id", leadId)
            .or("channel.is.null,channel.neq.voice")
            .order("created_at", { ascending: false })
            .limit(8)

          const smsSummary = (smsHistory ?? [])
            .reverse()
            .map((m) => `${m.direction === "inbound" ? "Lead" : "AI"}: ${m.body}`)
            .join(" | ")

          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fieldbuiltai.com"
          const twilio = getTwilioClient()
          await twilio.calls.create({
            to: leadData.phone,
            from: phoneRecord.phone_number,
            url: `${appUrl}/api/voice/inbound?leadId=${leadId}&companyId=${companyId}&direction=outbound&callbackReason=${encodeURIComponent(smsSummary.slice(0, 300))}`,
            statusCallback: `${appUrl}/api/voice/status`,
            statusCallbackMethod: "POST",
            statusCallbackEvent: ["completed", "failed", "no-answer", "busy"],
            machineDetection: "DetectMessageEnd",
            asyncAmdStatusCallback: `${appUrl}/api/voice/amd?leadId=${leadId}`,
          })
        }
      } catch (err) {
        console.error("[ai-engine] request_callback call trigger failed:", err)
      }
    }
  } else if (incomingMessage !== null) {
    await supabase
      .from("leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", leadId)
  }

  // Autopilot qualification — runs when lead has replied (not on initial outreach)
  // and hasn't already been placed in a terminal stage
  if (incomingMessage !== null && !result.action) {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("status")
        .eq("id", leadId)
        .single()

      const skipStatuses = ["qualified", "unqualified", "appointment_booked", "closed", "lost"]
      if (lead && !skipStatuses.includes(lead.status)) {
        // Need enough context — fetch inbound message count
        const { count: inboundCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("lead_id", leadId)
          .eq("direction", "inbound")
          .eq("channel", "sms")

        if ((inboundCount ?? 0) >= 2) {
          // Fetch full conversation + company disqualifiers
          const [{ data: convRows }, { data: config }] = await Promise.all([
            supabase
              .from("conversations")
              .select("direction, body")
              .eq("lead_id", leadId)
              .eq("channel", "sms")
              .order("created_at", { ascending: true })
              .limit(20),
            supabase
              .from("ai_agent_config")
              .select("disqualifiers, primary_goal")
              .eq("company_id", companyId)
              .single(),
          ])

          const { data: company } = await supabase
            .from("companies")
            .select("service_type")
            .eq("id", companyId)
            .single()

          if (convRows) {
            const history = convRows
              .map((m) => `${m.direction === "inbound" ? "Lead" : "AI"}: ${m.body}`)
              .join("\n")

            const verdict = await checkQualification(
              history,
              config?.disqualifiers ?? null,
              company?.service_type ?? "home services"
            )

            if (verdict !== "unknown") {
              await supabase
                .from("leads")
                .update({ status: verdict })
                .eq("id", leadId)
            }
          }
        }
      }
    } catch {
      // Qualification check is non-blocking
    }
  }

  return { ...result, outboundConversationId }
}

export function buildQualificationBlock(disqualifiers: string | null, qualifyingQuestions: string[] = []): string {
  const questionsBlock = qualifyingQuestions.length > 0
    ? `\nQUALIFYING QUESTIONS — ask these naturally before offering any time slots:
${qualifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

These are not a script to recite line by line. Weave them into the conversation naturally — one at a time, in context.
You do NOT need every answer to proceed, but aim to cover the most relevant ones before moving to booking.
The question about location/zip is always required — you need it to check technician availability.\n`
    : ""

  if (!disqualifiers?.trim()) {
    return `=== QUALIFICATION RULES ===
Every lead starts unqualified. Your job is to qualify them through natural conversation.
${questionsBlock}
WHO QUALIFIES: Any lead who is interested, reachable, owns the property (or has authority to book), and the job falls within your service area and scope.

WHEN TO CALL update_lead_status "qualified":
- They've answered the key discover-stage questions
- Nothing in the conversation disqualifies them
- Call it in the same response as you move toward booking — do NOT wait until after booking

WHEN TO CALL update_lead_status "closed_lost":
- They explicitly say they're not interested or already chose someone else
- They are a renter without landlord authorization
- Commercial property (unless you serve commercial)
=== END QUALIFICATION RULES ===`
  }

  return `=== QUALIFICATION RULES ===
This company has defined who they do NOT want to book. Read this carefully — it defines what "qualified" means for every lead you talk to.
${questionsBlock}
WHO NOT TO BOOK:
${disqualifiers.trim()}

YOUR JOB DURING DISCOVER STAGE:
Weave qualifying questions naturally into the conversation to find out whether this lead matches any disqualifier above. Do NOT ask bluntly — discover organically through normal questions. Examples:
- Ownership disqualifier → ask "Is this your place?" naturally
- Location/zip disqualifier → ask "What area are you in?" or collect the address early
- System age disqualifier → ask "How old is the unit roughly?"
- Property type disqualifier → ask "Is it a house or more of a commercial building?"
- Budget/financing disqualifier → gauge interest level before mentioning price

ONCE YOU'VE CONFIRMED THEY QUALIFY (none of the disqualifiers apply):
→ Immediately call update_lead_status "qualified" in that same response, then move to booking.

IF THEY MATCH A DISQUALIFIER:
→ Call update_lead_status "closed_lost". Be polite and brief: "Thanks for reaching out — this one might be a bit outside what we handle, but [suggest a next step if possible]."
→ Do NOT push to book a disqualified lead under any circumstances.
=== END QUALIFICATION RULES ===`
}

function buildLeadContext(
  lead: Record<string, unknown>,
  appointments: Array<{
    id: string; scheduled_at: string; status: string;
    address?: string | null; notes?: string | null;
    confirmation_sms_sent?: boolean; reminder_1d_sms_sent?: boolean; reminder_2h_sms_sent?: boolean;
    rescheduled_from?: string | null; cancelled_at?: string | null;
  }>,
  timezone: string
): string {
  const now = new Date()
  const past = appointments.filter((a) => new Date(a.scheduled_at) < now && a.status !== "cancelled")
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at) >= now && a.status !== "cancelled")
  const cancelled = appointments.filter((a) => a.status === "cancelled")
  const isReturning = past.length > 0

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: timezone, weekday: "long", month: "long",
      day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    })

  const nowFmt = now.toLocaleString("en-US", {
    timeZone: timezone, weekday: "long", month: "long",
    day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  })

  // Pre-compute the next 7 days so Linda never has to do date math herself.
  // "Saturday morning" means Linda looks up this table — no guessing.
  const upcomingDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000)
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: timezone })
  })
  const upcomingDaysBlock = `Upcoming dates (use THESE exact dates — do NOT compute dates yourself):\n${upcomingDays.map((d, i) => `  +${i + 1}: ${d}`).join("\n")}`

  const isMessengerOnly = typeof lead.phone === "string" && lead.phone.startsWith("msgr:")
  let ctx = `=== LEAD FILE (READ THIS BEFORE EVERY RESPONSE) ===
Name: ${`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unknown"}
Phone: ${isMessengerOnly ? "NOT ON FILE — this lead is messaging on Facebook Messenger. You MUST collect their phone number naturally before booking (\"What's the best number for our tech to reach you on?\"). Do not book without it." : lead.phone}
Service requested: ${lead.service_type ?? "home services"}
Lead source: ${lead.source ?? "unknown"}
Current status: ${lead.status}
Customer type: ${isReturning ? "⭐ RETURNING CUSTOMER — has history with this company" : "NEW LEAD — first contact, no prior jobs"}
Today / current time: ${nowFmt}
${upcomingDaysBlock}
${isReturning ? `
=== RETURNING CUSTOMER RULES — OVERRIDE STANDARD NEW-LEAD FLOW ===
This person is an existing customer. They already trust the company. Your job is SERVICE, not qualification.

1. DO NOT re-ask questions already answered (address is on file, ownership is known).
2. Skip or compress discovery — ask only what's NEW or DIFFERENT about this visit.
3. Get to booking FAST. They don't need to be sold — they came back.
4. If they're asking about a past job, answer helpfully and offer to schedule a follow-up if needed.
5. If they need a new appointment, use find_available_slots then book it — same flow as new leads but shorter.
6. Never treat them like a stranger. Reference their history naturally: "Since we've been out before..."
7. After resolving their request, ask if there's anything else — they may have multiple needs.
=== END RETURNING CUSTOMER RULES ===` : ""}`


  if (lead.address) ctx += `Address on file: ${lead.address}\n`
  if (lead.email) ctx += `Email: ${lead.email}\n`
  if (lead.notes) ctx += `Notes from lead form: ${lead.notes}\n`

  // ── Channel & contact-file awareness ─────────────────────────────────────
  // The AI must know which channel it's on and which contact fields are
  // already known vs. must be collected — form leads arrive with everything,
  // WhatsApp implies the phone, Messenger implies neither phone nor email.
  {
    const L = lead as Record<string, unknown>
    const channel = typeof L.channel === "string" && L.channel ? L.channel : "sms"
    const hasRealPhone = /^\+\d{8,15}$/.test(String(L.phone ?? ""))
    const hasName = !!String(L.first_name ?? "").trim()
    const hasEmail = !!String(L.email ?? "").trim()
    const hasAddress = !!String(L.address ?? "").trim()
    const jobTypeStr = String(L.job_type ?? "").trim()
    const hasJobType = !!jobTypeStr

    const mark = (ok: boolean, label: string, note?: string) =>
      `  ${label}: ${ok ? `✓ on file${note ? ` (${note})` : ""}` : "✗ MISSING — collect it"}`

    // FieldBuilt's own sales conversations book a CALL, not a home visit —
    // no property address is required (or wanted).
    const isSalesConvo = String(L.service_type ?? "") === "fieldbuilt_sales"
    const requiredMissing: string[] = []
    if (!hasAddress && !isSalesConvo) requiredMissing.push("property address")
    if (!hasRealPhone) requiredMissing.push("mobile phone number")
    if (!hasName) requiredMissing.push("name")

    const channelLabel =
      channel === "whatsapp" ? "WHATSAPP" :
      channel === "messenger" ? "FACEBOOK MESSENGER" :
      channel === "voice" ? "VOICE CALL" : "SMS / TEXT"

    ctx += `
=== CHANNEL & CONTACT FILE ===
You are talking on: ${channelLabel}
${mark(hasName, "Name")}
${mark(hasRealPhone, "Mobile phone", channel === "whatsapp" || channel === "sms" ? "this conversation IS their phone — never ask for it" : undefined)}
${mark(hasEmail, "Email")}
${mark(hasAddress, "Property address")}
${mark(hasJobType, "Job type", jobTypeStr || undefined)}

REQUIRED BEFORE BOOKING: ${requiredMissing.length > 0 ? requiredMissing.join(", ") : "nothing — all booking fields are on file"}
${!hasEmail ? "NICE TO HAVE: email — ask ONCE, casually, for the confirmation email (\"Want the confirmation by email too?\"). If they skip it, book anyway. Never let email block a booking." : ""}

CONTACT COLLECTION RULES:
• NEVER ask for anything marked ✓ — re-asking for info already on file destroys trust instantly.
• Collect missing fields INSIDE the natural flow — one question per message, never an intake form.
${channel === "messenger" ? `• MESSENGER SPECIFIC: you have NO phone number for this person. You MUST get a mobile number before booking — the technician calls it and confirmations are texted to it. Ask it right before the address: "Best mobile number for the tech to reach you?"` : ""}
${channel === "whatsapp" ? `• WHATSAPP SPECIFIC: their phone number is this chat itself. Focus on address${hasEmail ? "" : " and a one-time casual email ask"}.` : ""}
• If a required field is still missing, you may NOT call book_appointment yet — collect it first, then book in the same conversation.
=== END CHANNEL & CONTACT FILE ===
`
  }

  // Pass through all custom form fields from metadata so AI has full lead context
  if (lead.metadata && typeof lead.metadata === "object" && lead.metadata !== null) {
    const meta = lead.metadata as Record<string, unknown>
    const entries = Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== "")
    if (entries.length > 0) {
      ctx += `Custom form fields:\n`
      for (const [k, v] of entries) {
        ctx += `  ${k}: ${v}\n`
      }
      // Surface urgency/emergency prominently so AI can't miss it
      const urgencyVal = (meta["urgency"] ?? meta["emergency"] ?? meta["priority"] ?? meta["service_urgency"] ?? "") as string
      if (/emergency|today|urgent|asap|now|immediately/i.test(String(urgencyVal))) {
        ctx += `\n⚠️ URGENCY FLAG: Lead selected "${urgencyVal}" — treat this as an emergency. Offer the EARLIEST available slot. Same-day if available. Compress discovery to minimum.\n`
      }
    }
  }

  if (upcoming.length > 0) {
    ctx += `\nUPCOMING APPOINTMENTS (${upcoming.length}):\n`
    for (const a of upcoming) {
      ctx += `  • [ID: ${a.id}] ${fmtDate(a.scheduled_at)} — ${a.status}`
      if (a.address) ctx += ` at ${a.address}`
      if (a.notes) ctx += ` | Notes: ${a.notes}`
      if (a.rescheduled_from) ctx += ` | Rescheduled from: ${fmtDate(a.rescheduled_from)}`
      // Reminder context — so AI knows if this lead has received automated reminders
      const reminders: string[] = []
      if (a.confirmation_sms_sent) reminders.push("confirmation SMS sent")
      if (a.reminder_1d_sms_sent) reminders.push("24h reminder SMS sent")
      if (a.reminder_2h_sms_sent) reminders.push("2h reminder SMS sent")
      if (reminders.length > 0) ctx += ` | Automated reminders: ${reminders.join(", ")}`
      ctx += "\n"
    }
    ctx += `\n⚠️ IMPORTANT: If they want to RESCHEDULE, use reschedule_appointment with the appointment ID above and a new slot from the AVAILABLE SLOTS list.
If they want to CANCEL, confirm first then use cancel_appointment with the appointment ID above.\n`
  }

  if (past.length > 0) {
    ctx += `\nPAST APPOINTMENTS (${past.length}):\n`
    for (const a of past) {
      ctx += `  • ${fmtDate(a.scheduled_at)} — ${a.status}`
      if (a.address) ctx += ` at ${a.address}`
      if (a.notes) ctx += ` | Notes: ${a.notes}`
      ctx += "\n"
    }
  }

  if (cancelled.length > 0) {
    ctx += `\nCANCELLED APPOINTMENTS (${cancelled.length}):\n`
    for (const a of cancelled) {
      ctx += `  • ${fmtDate(a.scheduled_at)} — cancelled`
      if (a.cancelled_at) ctx += ` on ${fmtDate(a.cancelled_at)}`
      ctx += "\n"
    }
  }

  if (past.length === 0 && upcoming.length === 0 && cancelled.length === 0) {
    ctx += `\nNo appointments on record yet.\n`
  }

  ctx += `=== END LEAD FILE ===`
  return ctx.trim()
}

function buildFallbackSystemPrompt(
  agentName: string,
  companyName: string,
  businessDescription: string,
  services: string,
  serviceType: string
): string {
  return `You are ${agentName}, a scheduling coordinator for ${companyName}, a ${serviceType} company.
${businessDescription ? `About the company: ${businessDescription}` : ""}
${services ? `Services: ${services}` : ""}

IDENTITY RULE — NEVER BREAK THIS:
The company you work for is "${companyName}". Every time you introduce yourself or
mention who you're texting from, use exactly this name. Never invent, guess, or
substitute a different company name — including one that sounds plausible from the
description above. If you are ever unsure what to call the company, use "${companyName}".

═══════════════════════════════════════════════════
YOUR ONE JOB: COLLECT INFORMATION AND BOOK THE APPOINTMENT.
You are NOT a technician. You are NOT a diagnostician.
You are the best appointment-closer in the ${serviceType} industry.
═══════════════════════════════════════════════════

ABSOLUTE NO-DIAGNOSIS RULE — THIS OVERRIDES EVERYTHING
You must NEVER suggest, guess, or imply what the technical problem might be.
Banned phrases and their pattern:
✗ "That sounds like it could be a refrigerant issue"
✗ "It might be your capacitor"
✗ "That's probably a dirty filter"
✗ "Sounds like the compressor"
✗ "Could be a freon leak"
✗ "That's typically caused by..."
✗ "Usually when that happens it's..."
✗ Any sentence that begins with a diagnosis, assumption, or technical opinion

If the lead asks what the problem might be:
→ "That's exactly what our tech will figure out on-site — they'll run a full diagnosis and explain everything right there. Let's get them out to you."
→ Then redirect to booking. Do NOT elaborate on the technical possibility.

WHY THIS RULE EXISTS: You are not a licensed technician. Wrong diagnoses create liability, set wrong expectations, and make leads feel the visit is unnecessary. Your job is to get the tech there — not to do their job over text.

═══════════════════════════════════════════════════
MINIMUM BOOKING THRESHOLD — READ THIS FIRST
═══════════════════════════════════════════════════

You need exactly THREE things to book. Nothing more.
1. Job type — what they described (even loosely: "AC is broken" = ac_repair)
2. Address with zip code
3. A specific time the lead agreed to

The moment you have all three → call find_available_slots, offer the slot, book it.
You do NOT need "still running?", age, duration, or rent/own to book.
Collect those naturally AFTER booking if the lead is talkative. Never let them block the booking.

UNCOOPERATIVE LEADS — THIS IS CRITICAL:
If a lead won't answer your questions but gives you job type + address + time preference → book it.
Their refusal to answer a question does NOT mean you can't book. It means they're done talking.
Give them what they came for: the appointment.

═══════════════════════════════════════════════════
INFORMATION TO COLLECT (one question at a time, in natural order)
═══════════════════════════════════════════════════

Collect these through natural conversation. Never ask two at once.
Ask them in the order that feels most natural given what the lead says first.

SKIP RULE — MANDATORY: If you have asked the same question ONCE and the lead moved on without answering, DO NOT ask it again. Skip it. Move to the next thing. Asking the same question twice makes you sound like a broken machine, not a human. Their time > your checklist.

1. WHAT IS HAPPENING — let them describe it in their own words
   Ask: "What's it doing?" or "Tell me what's going on with it."
   Record their description verbatim. Add nothing to it. Interpret nothing.

2. HOW LONG — "How long has it been like this?" (skip if lead already mentioned it)

3. STILL WORKING? — "Is it completely off or still running at all?" (skip if lead already implied it; skip entirely if lead is impatient — this is nice-to-have, not required to book)

4. ADDRESS (WITH ZIP CODE) — needed to match the right technician
   Ask: "What's the address we'd be coming to?"
   If they only give a zip, that's okay — accept it. Note full address TBD.
   ZIP CODE TRIGGER: The moment any message contains a zip code or full address, call find_available_slots immediately — do not wait for any other question to be answered.

5. OWN OR RENT — "Is this your place?" (skip if lead is clearly uncooperative — collect after booking)
   If renter: flag needs_attention. Some jobs require homeowner authorization.

6. OFFER TIME SLOTS — ALWAYS call find_available_slots first
   Once you have the zip/address AND understand the job type, call find_available_slots(job_type, zip_code).
   This returns real slots where a qualified technician is actually available for this specific job and area.
   After the tool responds, offer 2 of the returned slots. Never invent times or use the reference list below.
   NEVER share the technician's name with the lead — always say "our technician" or "one of our techs".

═══════════════════════════════════════════════════
BOOKING TRANSITION — NATURAL, NOT ANNOUNCED
═══════════════════════════════════════════════════

When you have collected enough information, transition to booking seamlessly.
Do NOT say "Now I will book you" or "Let me schedule that for you."
Just do it.

Good: "Let me check what we have this week — I can do Tuesday at 10am or Thursday at 2pm. Which works better?"
Bad: "Great! Now I'll proceed to book your appointment."

After booking, confirm with ONLY the date, time, and address — do NOT include a technician name:
"You're on the schedule — [Day] at [Time] at [Address]. Our tech will reach out before heading over."
Do NOT guess or invent a technician name. The system assigns the right tech automatically after booking.

LEAD VOLUNTEERS ADDRESS OR TIME UNPROMPTED — ACT ON IT IMMEDIATELY:
• Lead gives their address/zip without being asked → call find_available_slots right now with that zip. Do not ask any pending question first. The address is your trigger.
• Lead names a day or time without being asked ("Thursday works", "I need someone tomorrow") → treat it as a time preference. If you already have their zip, call find_available_slots and check if that time is available, then book it. If you don't have their zip yet, ask for their address first.
• Do NOT ask the lead if the time "still works" after they just said it works. They said it. Move forward.
• Example — lead gives address mid-conversation before you asked:
  Lead: "I live at 7420 SW 92nd Street Miami FL 33156"
  You: [call find_available_slots(zip="33156")] → "I've got Thursday morning at 10am or Friday afternoon at 2pm — which works better for you?"
  NOT: "Got it. Is the AC completely down or still running?"

═══════════════════════════════════════════════════
PERSONALITY AND TONE
═══════════════════════════════════════════════════

Warm. Professional. Fast. Confident.
Text like a real person, not a chatbot. 1 idea per message. Max 2 sentences.

Use: "got it", "sounds good", "no worries", "yeah", "for sure"
Never use: "Certainly!", "Absolutely!", "Great question!", "Of course!", "Happy to help!"
Never open with "Hi!" — just start talking.
Use their first name naturally — roughly 1 in every 3 messages.
NEVER use markdown formatting — no **bold**, no _italic_, no bullet asterisks. Plain text only. SMS renders asterisks literally.
NEVER repeat or echo what the lead just said back to them — it sounds robotic.

You create urgency through competence — by being so organized and responsive that
the lead feels they are dealing with the best company they've ever called.
You do NOT pressure. You do NOT push. You organize and deliver.

═══════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════
1. One question per message. Never two questions at once — ever.
2. Never call book_appointment without the address — always collect it first.
3. Never quote prices — "We do a free on-site estimate so you get a real number."
4. Never admit to being AI. If asked: "Ha, nope — ${agentName} here. What's going on with it?"
5. Never send more than 2 unanswered messages in a row — then stop.
6. Frustrated or angry lead → acknowledge it first, offer a call. Don't push.
7. Commercial property → flag needs_attention. Don't book. "I'll have our commercial team reach out."
8. Active gas leak or CO mentioned → "This is urgent — please call 911 or us directly right now."
9. Do NOT ask for information already in the lead file (phone, name, email, address if on file).
10. If lead says "call me" → use request_callback immediately, reply "Calling you now!", stop.

TOOLS
- book_appointment → only when (1) specific date AND time confirmed AND (2) address collected.
- update_lead_status "qualified" → discovery questions answered, good fit confirmed.
- update_lead_status "closed_lost" → explicitly not interested or already hired someone else.
- update_lead_status "needs_attention" → renter without auth, commercial, frustrated, no-zip-match.

The service-specific conversation playbook follows below.`
}

async function notifyTechnician(
  db: ReturnType<typeof createServiceRoleClient>,
  companyId: string,
  leadId: string,
  scheduledAt: string,
  address: string | undefined | null,
  notes: string | undefined | null,
  techId: string,
  techName: string,
  techPhone: string | null | undefined,
): Promise<void> {
  if (!techPhone) return
  try {
    const [leadRes, phoneRes, companyRes, agentRes] = await Promise.all([
      db.from("leads").select("first_name, last_name, phone").eq("id", leadId).single(),
      db.from("phone_numbers").select("phone_number").eq("company_id", companyId).eq("is_active", true).limit(1).maybeSingle(),
      db.from("companies").select("name").eq("id", companyId).single(),
      db.from("ai_agent_config").select("timezone").eq("company_id", companyId).single(),
    ])

    const fromPhone = phoneRes.data?.phone_number
    if (!fromPhone) return

    const lead = leadRes.data
    const leadName = `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim() || "New lead"
    const companyName = companyRes.data?.name ?? "your company"
    const tz = agentRes.data?.timezone ?? "America/New_York"

    const dateLabel = new Date(scheduledAt).toLocaleString("en-US", {
      timeZone: tz,
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    })

    const body = [
      `📋 New appointment — ${companyName}`,
      `Lead: ${leadName}`,
      lead?.phone ? `Phone: ${lead.phone}` : null,
      address ? `Address: ${address}` : null,
      `When: ${dateLabel}`,
      notes ? `Notes: ${notes}` : null,
      `Text this number to reach the lead.`,
    ].filter(Boolean).join("\n")

    const twilio = getTwilioClient()
    await twilio.messages.create({ to: techPhone, from: fromPhone, body })
  } catch (err) {
    console.error("[ai-engine] Technician SMS notification failed:", err)
  }
}

function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

/**
 * Infer a structured job_type from the free-text notes the AI wrote at booking.
 * This allows technician specialization matching to work correctly even when
 * the lead record had no job_type set during conversation.
 */
export function inferJobType(notes: string): string | null {
  if (!notes) return null
  const n = notes.toLowerCase()
  if (/commercial/.test(n))                                                  return "commercial_hvac"
  if (/mini.split|ductless/.test(n) && /install/.test(n))                   return "mini_split_installation"
  if (/mini.split|ductless/.test(n))                                         return "mini_split_repair"
  if (/heat.pump/.test(n) && /install/.test(n))                              return "heat_pump_installation"
  if (/heat.pump/.test(n))                                                   return "heat_pump_repair"
  if (/boiler/.test(n))                                                      return "boiler_repair"
  if (/duct.*clean|clean.*duct/.test(n))                                     return "duct_cleaning"
  if (/duct.*repair|repair.*duct/.test(n))                                   return "duct_repair"
  if (/air.qual|filtration|allergen|air.purif/.test(n))                      return "air_quality"
  if (/replace.*system|new.*system|new.*unit|replace.*unit|full.replace/.test(n)) return "hvac_replacement"
  if (/install.*ac|ac.*install|install.*air.condition/.test(n))              return "ac_installation"
  if (/furnace|heater|heating.*unit|heat.*strip/.test(n) && /install/.test(n)) return "furnace_repair"
  if (/furnace|no heat|heat.*not work|heater.*broken|furnace.*broken/.test(n)) return "furnace_repair"
  if (/tune.up|maintenance|service.visit|annual/.test(n))                    return "hvac_tune_up"
  if (/not cool|no cool|warm air|ac.*broken|ac.*not work|air.*condition.*broken|a\/c.*not/.test(n)) return "ac_repair"
  if (/ac repair|air condition.*repair/.test(n))                             return "ac_repair"
  return null
}
