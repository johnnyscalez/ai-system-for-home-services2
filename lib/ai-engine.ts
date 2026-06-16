import { anthropic } from "@/lib/claude"
import { createServiceRoleClient } from "@/lib/supabase-server"
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
      "ALWAYS call this before offering any time slots to the lead. Call it once you (1) understand the job type from conversation AND (2) have the lead's zip code or full address. Returns real appointment slots filtered by which technician can handle this specific job in this area — and their actual calendar availability. Never offer slots from the AVAILABLE BOOKING SLOTS reference list without calling this tool first.",
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
      "Update the lead's status. Use 'qualified' the moment the lead has answered the discover-stage questions (what's wrong, how old the unit is, whether they own the home). Call this DURING Stage 2–3, NOT after booking — it moves them into the qualified pipeline. Do not wait until after the appointment is booked. Use 'closed_lost' when they explicitly say they're not interested or already chose someone else. Use 'needs_attention' when they seem frustrated, it's a renter without landlord auth, or a commercial property. Use 'returning_client' when an existing customer (RETURNING CUSTOMER in the lead file) initiates a new service request — this re-enters them into the active pipeline.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["qualified", "closed_lost", "needs_attention", "returning_client"] },
      },
      required: ["status"],
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
  const [leadRes, historyRes, agentRes, kbRes, appointmentsRes, companyAptsRes, technicianContext] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).single(),
    supabase
      .from("conversations")
      .select("direction, body, sent_by, created_at")
      .eq("lead_id", leadId)
      .eq("channel", "sms")
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_agent_config")
      .select("generated_system_prompt, agent_name, working_hours_start, working_hours_end, timezone, available_days, appointment_windows, booking_horizon_days, max_appointments_per_day, per_day_slots, disqualifiers")
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("knowledge_base")
      .select("business_description, services_offered, service_areas, custom_ai_knowledge, financing_options")
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
  ])

  const lead = leadRes.data
  const history = historyRes.data ?? []
  const agent = agentRes.data
  const kb = kbRes.data
  const appointments = appointmentsRes.data ?? []
  const companyApts = companyAptsRes.data ?? []

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
  const conversationFlow = getConversationFlow(lead.service_type as string | null)

  // Format available slots block — AI offers ONLY these real times, never invents them
  const slotsBlock = formatSlotsForPrompt(availableSlots)

  // Build system prompt
  const baseSystemPrompt =
    agent?.generated_system_prompt ||
    buildFallbackSystemPrompt(
      agent?.agent_name ?? "Linda",
      kb?.business_description ?? "",
      kb?.services_offered ?? "",
      lead.service_type ?? "home services"
    )

  // System prompt order:
  // 1. Who the agent is + business knowledge
  // 2. HVAC conversation flow + stage rules
  // 3. Qualification rules (company-specific disqualifiers)
  // 4. Real available slots (the AI must offer only these)
  // 5. Lead file (live lead data, history, returning vs new)
  const customKnowledgeBlock = kb?.custom_ai_knowledge
    ? `=== YOUR COMPANY-SPECIFIC KNOWLEDGE ===\n${kb.custom_ai_knowledge}\n=== END COMPANY-SPECIFIC KNOWLEDGE ===`
    : ""

  const financingBlock = kb?.financing_options
    ? `=== FINANCING OPTIONS (know this precisely — leads ask about this) ===\n${kb.financing_options}\n=== END FINANCING ===`
    : ""

  const qualificationBlock = buildQualificationBlock(agent?.disqualifiers ?? null)

  const smsHardRules = `=== SMS HARD RULES — THESE OVERRIDE EVERYTHING ABOVE ===

FORMATTING:
• Plain text only. NO markdown. No **bold**, no _italic_, no bullet points with *, no headers.
• Numbers and times in plain text: "tomorrow at 9am", not "**tomorrow at 9am**".
• SMS renders plain text. Asterisks show up literally. Never use them.

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

BOOKING FLOW:
• Lead confirms time → ask for address (if not on file) → book immediately.
• If address IS already on file, book without asking for it again.
• After booking: one short confirmation — day, time, address. Done.

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

  const systemPrompt = [baseSystemPrompt, financingBlock, customKnowledgeBlock, conversationFlow, qualificationBlock, technicianContext, slotsBlock, leadContext, smsHardRules]
    .filter(Boolean)
    .join("\n\n")

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

  for (const block of claudeResponse.content) {
    if (block.type === "text") {
      responseText = block.text.trim()
    } else if (block.type === "tool_use") {
      if (block.name === "find_available_slots") {
        findSlotsToolId  = block.id
        const inp = block.input as { job_type?: string; zip_code?: string }
        findSlotsJobType = inp.job_type ?? null
        findSlotsZip     = inp.zip_code ?? null
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
        action = { type: "update_status", status: input.status }
      } else if (block.name === "request_callback") {
        action = { type: "request_callback" }
      }
    }
  }

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
    const slotMessages = [
      ...messages,
      { role: "assistant" as const, content: claudeResponse.content },
      {
        role: "user" as const,
        content: [{ type: "tool_result" as const, tool_use_id: findSlotsToolId, content: toolResultText }],
      },
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
          action = { type: "update_status", status: input.status }
        } else if (block.name === "book_appointment") {
          const input = block.input as { scheduled_at: string; address?: string; notes?: string }
          action = { type: "book_appointment", ...input }
        }
      }
    }

    // Fallback: if Claude called a tool but produced no text, force a text-only reply
    if (!responseText) {
      // Need to provide a tool_result for the tool Claude just called so the
      // message history stays valid (Anthropic requires tool_use and tool_result
      // to alternate). Build a minimal result and ask for the final text.
      const lastToolUse = slotReply.content.find(b => b.type === "tool_use") as
        { type: "tool_use"; id: string; name: string } | undefined
      const toolResultContent = lastToolUse?.name === "book_appointment"
        ? "Appointment booked. Now send the lead a brief confirmation text."
        : "Done. Now send the lead a brief, warm text reply."
      const fallbackMessages: typeof slotMessages = [
        ...slotMessages,
        { role: "assistant" as const, content: slotReply.content },
        {
          role: "user" as const,
          content: lastToolUse
            ? [{ type: "tool_result" as const, tool_use_id: lastToolUse.id, content: toolResultContent }]
            : "You must send a text message to the lead now. Write only the SMS text — no tool calls.",
        } as { role: "user"; content: string | Array<{ type: "tool_result"; tool_use_id: string; content: string }> },
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
  // send tool result back and get the final text
  if (action && !responseText) {
    const toolResultMessages = [
      ...messages,
      { role: "assistant" as const, content: claudeResponse.content },
      {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: (claudeResponse.content.find((b) => b.type === "tool_use") as { id: string })?.id ?? "",
            content: action?.type === "cancel_appointment"
              ? "Appointment cancelled. Send a brief, warm confirmation to the lead that it's been cancelled."
              : action?.type === "reschedule_appointment"
              ? "Appointment rescheduled. Confirm the new date and time to the lead in a short, friendly text."
              : action?.type === "request_callback"
              ? "Call initiated. Send exactly this message and nothing else: 'Calling you now!' Do NOT ask any more questions."
              : "Appointment booked. Confirm to the lead with the scheduled day, time, and address. Do NOT include a technician name — the system assigns the right tech automatically and they will reach out directly. Say: 'You're on the schedule — [Day] at [Time] at [Address]. Our tech will reach out before heading over.'",
          },
        ],
      },
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
        weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York",
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
      // absolute last resort — better than silence
      responseText = "Got your message — let me check on that and get right back to you."
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
  followUpAngle?: string
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

  // Run the AI engine
  const result = await runConversation(leadId, companyId, incomingMessage, followUpAngle)

  // Save outbound AI message and capture its ID for Twilio SID update
  let outboundConversationId: string | undefined
  if (result.response) {
    const { data: conv } = await supabase.from("conversations").insert({
      lead_id: leadId,
      company_id: companyId,
      direction: "outbound",
      sent_by: "ai",
      body: result.response,
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
          await flagNoTechAvailable(apt.id, techResult.reason)
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
          // Fetch recent SMS context so voice agent knows exactly what this call is about
          const { data: smsHistory } = await supabase
            .from("conversations")
            .select("direction, body")
            .eq("lead_id", leadId)
            .eq("channel", "sms")
            .order("created_at", { ascending: false })
            .limit(8)

          const smsSummary = (smsHistory ?? [])
            .reverse()
            .map((m) => `${m.direction === "inbound" ? "Lead" : "AI"}: ${m.body}`)
            .join(" | ")

          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://leadcloser.app"
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

export function buildQualificationBlock(disqualifiers: string | null): string {
  if (!disqualifiers?.trim()) {
    return `=== QUALIFICATION RULES ===
Every lead starts unqualified. Your job is to qualify them through natural conversation.

WHO QUALIFIES: Any lead who is interested, reachable, owns the property (or has authority to book), and the job falls within your service area and scope.

WHEN TO CALL update_lead_status "qualified":
- They've answered the discover-stage questions (what's wrong, property details, ownership)
- Nothing in the conversation disqualifies them
- Call it in the same response as you move toward booking — do NOT wait until after the appointment is booked

WHEN TO CALL update_lead_status "closed_lost":
- They explicitly say they're not interested or already chose someone else
- They are a renter without landlord authorization
- Commercial property (unless you serve commercial)
=== END QUALIFICATION RULES ===`
  }

  return `=== QUALIFICATION RULES ===
This company has defined who they do NOT want to book. Read this carefully — it defines what "qualified" means for every lead you talk to.

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

  let ctx = `=== LEAD FILE (READ THIS BEFORE EVERY RESPONSE) ===
Name: ${`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unknown"}
Phone: ${lead.phone}
Service requested: ${lead.service_type ?? "home services"}
Lead source: ${lead.source ?? "unknown"}
Current status: ${lead.status}
Customer type: ${isReturning ? "⭐ RETURNING CUSTOMER — has history with this company" : "NEW LEAD — first contact, no prior jobs"}
Today / current time: ${nowFmt}
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
  businessDescription: string,
  services: string,
  serviceType: string
): string {
  return `You are ${agentName}, a scheduling coordinator for a ${serviceType} company.
${businessDescription ? `Company: ${businessDescription}` : ""}
${services ? `Services: ${services}` : ""}

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
INFORMATION TO COLLECT (one question at a time, in natural order)
═══════════════════════════════════════════════════

Collect these through natural conversation. Never ask two at once.
Ask them in the order that feels most natural given what the lead says first.

1. WHAT IS HAPPENING — let them describe it in their own words
   Ask: "What's it doing?" or "Tell me what's going on with it."
   Record their description verbatim. Add nothing to it. Interpret nothing.

2. HOW LONG — "How long has it been like this?"

3. STILL WORKING? — "Is it completely off or still running at all?"
   If completely off → move faster, prioritize booking soonest slot

4. ADDRESS (WITH ZIP CODE) — needed to match the right technician
   Ask: "What's the address we'd be coming to?"
   If they only give a zip, that's okay — accept it. Note full address TBD.

5. OWN OR RENT — "Is this your place?"
   If renter: flag needs_attention. Some jobs require homeowner authorization.
   Do not book without checking this.

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
    const [leadRes, phoneRes, companyRes] = await Promise.all([
      db.from("leads").select("first_name, last_name, phone").eq("id", leadId).single(),
      db.from("phone_numbers").select("phone_number").eq("company_id", companyId).eq("is_active", true).limit(1).maybeSingle(),
      db.from("companies").select("name").eq("id", companyId).single(),
    ])

    const fromPhone = phoneRes.data?.phone_number
    if (!fromPhone) return

    const lead = leadRes.data
    const leadName = `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim() || "New lead"
    const companyName = companyRes.data?.name ?? "your company"

    const dateLabel = new Date(scheduledAt).toLocaleString("en-US", {
      timeZone: "America/New_York",
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
function inferJobType(notes: string): string | null {
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
