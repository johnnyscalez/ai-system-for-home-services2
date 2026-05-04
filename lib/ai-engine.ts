import { anthropic } from "@/lib/claude"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { createCalendarEvent, getCalendarEvents } from "@/lib/google-calendar"
import { getConversationFlow } from "@/lib/conversation-flows"
import { getAvailableSlots, formatSlotsForPrompt, DEFAULT_WINDOWS, DEFAULT_DAYS } from "@/lib/availability"
import type { AppointmentWindow, PerDaySlots } from "@/lib/availability"

export type ConversationAction =
  | { type: "book_appointment"; scheduled_at: string; address?: string; notes?: string }
  | { type: "update_status"; status: "qualified" | "closed_lost" | "needs_attention" }
  | { type: "cancel_appointment"; appointment_id: string; reason?: string }
  | { type: "reschedule_appointment"; appointment_id: string; new_scheduled_at: string }

export type EngineResult = {
  response: string
  action?: ConversationAction
  outboundConversationId?: string
}

const TOOLS: Parameters<typeof anthropic.messages.create>[0]["tools"] = [
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
    name: "update_lead_status",
    description:
      "Update the lead's status. Use 'qualified' when they've answered key questions and are a good fit. Use 'closed_lost' when they explicitly say they're not interested or already chose someone else. Use 'needs_attention' when they seem frustrated or there's a situation that needs human review.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["qualified", "closed_lost", "needs_attention"] },
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

  // Load everything in parallel — lead history, agent config, availability, company schedule
  const [leadRes, historyRes, agentRes, kbRes, appointmentsRes, companyAptsRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).single(),
    supabase
      .from("conversations")
      .select("direction, body, sent_by, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_agent_config")
      .select("generated_system_prompt, agent_name, working_hours_start, working_hours_end, timezone, available_days, appointment_windows, booking_horizon_days, max_appointments_per_day, per_day_slots")
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("knowledge_base")
      .select("business_description, services_offered, service_areas, custom_ai_knowledge")
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
  // 3. Real available slots (the AI must offer only these)
  // 4. Lead file (live lead data, history, returning vs new)
  const customKnowledgeBlock = kb?.custom_ai_knowledge
    ? `=== YOUR COMPANY-SPECIFIC KNOWLEDGE ===\n${kb.custom_ai_knowledge}\n=== END COMPANY-SPECIFIC KNOWLEDGE ===`
    : ""

  const systemPrompt = [baseSystemPrompt, customKnowledgeBlock, conversationFlow, slotsBlock, leadContext]
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
- Feel personal, not mass-text.
- Do NOT start with "Hi!" — be natural.
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
    // Normal reply to an inbound message — build full conversation history
    for (const msg of history) {
      messages.push({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content: msg.body,
      })
    }
    // Add the new incoming message
    messages.push({
      role: "user",
      content: incomingMessage!,
    })
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

  for (const block of claudeResponse.content) {
    if (block.type === "text") {
      responseText = block.text.trim()
    } else if (block.type === "tool_use") {
      if (block.name === "book_appointment") {
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
      }
    }
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
              : "Action recorded. Now send your confirmation text to the lead.",
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
  disqualifiers: string,
  serviceType: string
): Promise<"qualified" | "unqualified" | "unknown"> {
  if (!disqualifiers?.trim()) return "unknown"

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{
        role: "user",
        content: `You determine if a ${serviceType} lead qualifies or not.

Disqualifiers (reasons to NOT book):
${disqualifiers}

Conversation:
${conversationHistory}

Reply with exactly one word — QUALIFIED, UNQUALIFIED, or UNKNOWN.
Only say QUALIFIED or UNQUALIFIED if there is clear evidence. Otherwise say UNKNOWN.`,
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

      // Create appointment
      const { data: apt } = await supabase
        .from("appointments")
        .insert({
          lead_id: leadId,
          company_id: companyId,
          scheduled_at,
          address: address ?? null,
          notes: notes ?? null,
          status: "scheduled",
        })
        .select()
        .single()

      // Update lead status
      await supabase
        .from("leads")
        .update({ status: "appointment_booked", last_message_at: new Date().toISOString() })
        .eq("id", leadId)

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
        needs_attention: "active_conversation",
      }
      await supabase
        .from("leads")
        .update({
          status: legacyMap[result.action.status] ?? result.action.status,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", leadId)
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

        if ((inboundCount ?? 0) >= 2) {
          // Fetch full conversation + company disqualifiers
          const [{ data: convRows }, { data: config }] = await Promise.all([
            supabase
              .from("conversations")
              .select("direction, body")
              .eq("lead_id", leadId)
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

          if (convRows && config?.disqualifiers) {
            const history = convRows
              .map((m) => `${m.direction === "inbound" ? "Lead" : "AI"}: ${m.body}`)
              .join("\n")

            const verdict = await checkQualification(
              history,
              config.disqualifiers,
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
`

  if (lead.address) ctx += `Address on file: ${lead.address}\n`
  if (lead.email) ctx += `Email: ${lead.email}\n`
  if (lead.notes) ctx += `Notes from lead form: ${lead.notes}\n`

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
  return `You are ${agentName}, texting leads for a ${serviceType} company. Get a reply, qualify them, book a free estimate.
${businessDescription ? `Company: ${businessDescription}` : ""}
${services ? `Services: ${services}` : ""}

WHO YOU ARE
You're a real person — been with this company a while, know the trade, text like a normal human. Not a bot, not a script. A rep who actually wants to help people get their problem fixed.

YOUR ONLY JOB
Get replies → collect info → book the free on-site estimate.

HOW LONG YOUR TEXTS SHOULD BE
Before every message ask: "what's the shortest thing a real person would text here?"

Message types and their limits:
- Quick nudge / follow-up → 6–15 words. "Hey, still need help with your AC?"
- Clarifying question → 8–18 words. "Is it not cooling at all or just blowing warm air?"
- Simple answer → 10–25 words. "Yeah we handle that — just need to take a look first."
- Informative reply → 15–35 words. "Usually depends on the issue, but the tech explains everything before doing any work."
- Booking message → 15–30 words. "Got morning Thursday 8–10 or afternoon Friday 1–3 — what works better?"
- Reassurance → 15–35 words. "Tech walks you through everything on-site before touching anything — no surprise charges."

THE RULE: 1 idea per message. No fluff. Readable in one glance.

YOUR PERSONALITY
Casual, real, like texting a real person.
Use: "yeah", "got it", "no worries", "sounds good", "for sure", "totally", "makes sense"
Use their first name — not every message, roughly 1 in 3.
Never use: "Absolutely!", "Great question!", "I completely understand your concern", "I'd be happy to assist!"
Never open with "Hi!" or "Hello!" — just start talking.

NEVER DO THIS
- Paragraph-length texts
- Two questions in one message
- Corporate or call center language
- Sounding like a chatbot

ALWAYS DO THIS
- One thought, one question, send
- Match their energy — casual lead = casual reply
- One gentle follow-up if they ghost, then stop
- Acknowledge frustration before anything else

HARD RULES
1. Never ask 2 questions in the same message — ever
2. Never call book_appointment without the address — collect it first, always
3. Never quote prices — "we do a free on-site estimate so you get a real number, not a guess"
4. Never admit to being AI. If asked: "Ha, nope — ${agentName} here 😄 What's going on with it?"
5. Never send more than 2 unanswered messages — then stop completely
6. Frustrated or angry → "That makes sense — want me to have someone call you directly?" Then stop pushing
7. Commercial property → flag needs_attention immediately. Don't book. "I'll have our commercial team reach out."
8. Active gas leak or CO mentioned → "This sounds urgent — please call 911 or us directly right now. Don't wait."

TOOLS
- book_appointment → only when (1) specific date AND time confirmed AND (2) address in hand. Both required.
- update_lead_status "qualified" → clearly warming up, asking smart questions, ready to move
- update_lead_status "closed_lost" → explicitly not interested or already hired someone else
- update_lead_status "needs_attention" → frustrated, commercial, renter without auth, anything needing a human

The service-specific conversation playbook follows below.`
}
