import { anthropic } from "@/lib/claude"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { createCalendarEvent } from "@/lib/google-calendar"

export type ConversationAction =
  | { type: "book_appointment"; scheduled_at: string; address?: string; notes?: string }
  | { type: "update_status"; status: "qualified" | "closed_lost" | "needs_attention" }

export type EngineResult = {
  response: string
  action?: ConversationAction
}

const TOOLS: Parameters<typeof anthropic.messages.create>[0]["tools"] = [
  {
    name: "book_appointment",
    description:
      "Call this when the lead has agreed to a specific appointment date and time. Convert relative times like 'tomorrow at 2pm' to an ISO 8601 datetime based on today's date.",
    input_schema: {
      type: "object" as const,
      properties: {
        scheduled_at: {
          type: "string",
          description: "ISO 8601 datetime e.g. 2024-06-15T14:00:00",
        },
        address: {
          type: "string",
          description: "Job site address if provided by the lead",
        },
        notes: {
          type: "string",
          description: "Any notes about the appointment",
        },
      },
      required: ["scheduled_at"],
    },
  },
  {
    name: "update_lead_status",
    description:
      "Update the lead's status. Use 'qualified' when they've answered key questions and are a good fit. Use 'closed_lost' when they explicitly say they're not interested or already chose someone else. Use 'needs_attention' when they seem frustrated or there's a situation that needs human review.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["qualified", "closed_lost", "needs_attention"],
        },
      },
      required: ["status"],
    },
  },
]

export async function runConversation(
  leadId: string,
  companyId: string,
  incomingMessage: string | null
): Promise<EngineResult> {
  const supabase = createServiceRoleClient()

  // Load everything in parallel
  const [leadRes, historyRes, agentRes, kbRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).single(),
    supabase
      .from("conversations")
      .select("direction, body, sent_by, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_agent_config")
      .select("generated_system_prompt, agent_name, working_hours_start, working_hours_end, timezone")
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("knowledge_base")
      .select("business_description, services_offered, service_areas")
      .eq("company_id", companyId)
      .single(),
  ])

  const lead = leadRes.data
  const history = historyRes.data ?? []
  const agent = agentRes.data
  const kb = kbRes.data

  if (!lead) throw new Error("Lead not found")

  const firstName = lead.first_name ?? "there"
  const isInitialOutreach = incomingMessage === null

  // Build system prompt
  const systemPrompt =
    agent?.generated_system_prompt ||
    buildFallbackSystemPrompt(
      agent?.agent_name ?? "Alex",
      kb?.business_description ?? "",
      kb?.services_offered ?? "",
      lead.service_type ?? "home services"
    )

  // Build message history for Claude
  const messages: Parameters<typeof anthropic.messages.create>[0]["messages"] = []

  if (isInitialOutreach) {
    // First contact — ask Claude to write the initial outreach SMS
    messages.push({
      role: "user",
      content: `NEW LEAD CONTEXT:
Name: ${firstName} ${lead.last_name ?? ""}
Phone: ${lead.phone}
Service interested in: ${lead.service_type ?? "home services"}
Lead source: ${lead.source}
${lead.address ? `Address: ${lead.address}` : ""}
${lead.notes ? `Notes from form: ${lead.notes}` : ""}

Write the first SMS to send to this new lead right now. Keep it to 1-2 sentences. Make it feel personal and not like a mass text. Do NOT start with "Hi!" — be natural.`,
    })
  } else {
    // Build full conversation history
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
      } else if (block.name === "update_lead_status") {
        const input = block.input as { status: "qualified" | "closed_lost" | "needs_attention" }
        action = { type: "update_status", status: input.status }
      }
    }
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
            content: "Action recorded. Now send your confirmation text to the lead.",
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

export async function processAndSave(
  leadId: string,
  companyId: string,
  incomingMessage: string | null,
  incomingTwilioSid?: string
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

    // Update lead last_message_at and status to contacted if still new
    await supabase
      .from("leads")
      .update({
        last_message_at: new Date().toISOString(),
        status: "contacted",
      })
      .eq("id", leadId)
      .eq("status", "new") // only change if still new
  }

  // Run the AI engine
  const result = await runConversation(leadId, companyId, incomingMessage)

  // Save outbound AI message
  if (result.response) {
    await supabase.from("conversations").insert({
      lead_id: leadId,
      company_id: companyId,
      direction: "outbound",
      sent_by: "ai",
      body: result.response,
    })
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
              }
            )

            // Store google_event_id on the appointment
            await supabase
              .from("appointments")
              .update({ google_event_id: gcalEvent.id ?? null })
              .eq("id", apt.id)
          }
        } catch {
          // Calendar sync failure is non-blocking
        }
      }
    } else if (result.action.type === "update_status") {
      await supabase
        .from("leads")
        .update({
          status: result.action.status,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", leadId)
    }
  } else if (incomingMessage !== null) {
    // Update last_message_at
    await supabase
      .from("leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", leadId)
  }

  return result
}

function buildFallbackSystemPrompt(
  agentName: string,
  businessDescription: string,
  services: string,
  serviceType: string
): string {
  return `You are ${agentName}, an AI sales assistant for a ${serviceType} company.
${businessDescription ? `Business: ${businessDescription}` : ""}
${services ? `Services: ${services}` : ""}

Your job: respond to leads via SMS, qualify them, and book an estimate appointment.

Rules:
- Keep every message to 1-2 short sentences
- Use the lead's first name naturally
- Always move toward booking an appointment
- When they agree to a specific time, use the book_appointment tool immediately
- When they're clearly qualified (ready to book, good fit), use update_lead_status with "qualified"
- When they say they're not interested, use update_lead_status with "closed_lost"
- Never reveal you are an AI
- Never send more than 2 follow-up messages without a reply`
}
