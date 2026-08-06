import { anthropic } from "@/lib/claude"
import { buildQualificationBlock, saveLeadDetailsForLead } from "@/lib/ai-engine"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { kbValue } from "@/lib/kb-utils"
import { createCalendarEvent } from "@/lib/google-calendar"
import { determineAgentType, getAgentPrompt, getJobKnowledgeBlock } from "@/lib/voice-agents"
import { updateSession, appendMessages } from "@/lib/voice-session"
import { getJobTypeLabel, JOB_TYPES, JOB_TYPE_TOOL_DESCRIPTION } from "@/lib/job-types"
import { selectTechnician, getTechnicianContextForCompany, findSlotsForLead, sameWindowBucket } from "@/lib/technician-booking"
import { zipFromAddress, isCompleteServiceAddress } from "@/lib/routing"
import { zipToTimeZone } from "@/lib/timezones"
import type { VoiceSession, VoiceMessage } from "@/lib/voice-session"

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceAction =
  | { type: "continue" }
  | { type: "book"; scheduled_at: string; address: string; notes?: string }
  | { type: "end"; reason: string }
  | { type: "transfer"; reason: string; summary: string }

export type VoiceEngineResult = {
  text: string
  action: VoiceAction
}

// ─── Universal voice rules — injected at top of every system prompt ────────────

const VOICE_RULES = `=== VOICE CALL RULES — THESE OVERRIDE EVERYTHING ELSE ===
You are on a LIVE PHONE CALL. Every word you write is spoken aloud by text-to-speech.

MANDATORY RULES — never break these:
1. Maximum 2 sentences per response. Absolute maximum 3 for complex situations.
2. No bullet points. No dashes. No asterisks. No markdown of any kind.
3. One question per response — ask it, then stop. Never stack two questions.
4. Speak naturally: say "around ten years old" not "10". Say "Thursday morning" not "8:00 AM".
5. Never say AI, software, system, bot, or anything technical.
6. If asked "are you a real person?": "Yes, I'm [AgentName] — just your contact here. What can I help you with?"
7. When booking: confirm day, time, and address naturally in one sentence.
8. When calling most tools: include your verbal response in the same message turn.
9. Keep filler natural and brief: "Got it.", "Sure thing." — then continue.
10. Never read out a list of slots — offer exactly two naturally: "I've got Thursday morning or Friday afternoon."
11. SERVICE AREA RULE: You MUST call find_available_slots after learning the lead's zip code. Say ONE short natural sentence AND call the tool in the SAME turn — saying "let me check" without actually calling the tool is a failure; the lead will be left waiting for nothing. The slot offer comes after the results return.
12. TIMEZONE RULE: When booking, use the exact ISO 8601 datetime from the find_available_slots results. Never construct your own datetime string — the slots returned are already in the correct timezone.
13. OUTSIDE SERVICE AREA: If find_available_slots says outside service area, say warmly that you don't serve that area, then call update_lead_status("closed_lost") and end_call.
14. PIVOT AFTER ANSWERING: When you answer a question the lead asked (cost, timeline, what's included) without needing their input, end that same response with your next qualifying question. Do NOT stop and wait silently after answering.
15. VISIT FEE / TRIP CHARGE: If a SERVICE CALL FEE POLICY block appears in this system prompt, follow it exactly when asked about cost to come out. Never say "free" unless that policy says so. If no SERVICE CALL FEE POLICY block is present, say "It's completely free — no trip charge."
16. BOOKING — NO DISAMBIGUATION LOOPS: When the lead accepts a day or day-part ("Monday morning works", "tomorrow's fine"), pick the EARLIEST matching slot from the find_available_slots results and book it immediately: confirm once with the specific window ("Perfect — Monday morning, eight to ten, at [Address]") and call book_appointment in that same turn. NEVER re-ask which window. NEVER say "I've got you down" without calling book_appointment.
17. BOOK ONCE: book_appointment is called EXACTLY ONE TIME per call. If an "APPOINTMENT ALREADY BOOKED THIS CALL" block appears in this prompt, the booking is DONE — "okay", "yes", "thank you", "bye" are NOT requests to book again. Never call book_appointment after that block appears; for a time change call reschedule_appointment instead.
18. PRICE CAPTURE: When a total price was agreed on this call, ALWAYS pass quoted_total (total dollars, all units combined) and unit_count when calling book_appointment. Use the FINAL corrected numbers — if the caller first said two furnaces and then corrected to one, one is the truth.
19. CHANGED DETAILS: When the caller states something that CONTRADICTS the lead file (a different address, furnace count, property type, name), acknowledge both and confirm once: "I have [old] on file — should I go with [new]?" The LAST CONFIRMED value is the truth: book with it, quote with it. A full street address (house number + street) is required for a visit — a zip code alone is never an address.
=== END VOICE RULES ===`

// ─── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Parameters<typeof anthropic.messages.create>[0]["tools"] = [
  {
    name: "find_available_slots",
    description:
      "Check real technician availability and service area coverage for a lead's zip code. Call this immediately after learning the lead's zip code — say ONE short natural sentence first ('Give me just a second to check who's available.'), then call this tool. Returns either: available booking slots tied to actual technicians, or an OUTSIDE_SERVICE_AREA signal. You MUST call this before offering any appointment times. Use the exact ISO datetimes returned when calling book_appointment.",
    input_schema: {
      type: "object" as const,
      properties: {
        zip:      { type: "string", description: "5-digit ZIP code from the lead's address" },
        // enum is load-bearing: without it the model invents strings like
        // "air_duct_cleaning" which used to fail routing and DECLINE the
        // company's core service (audit finding C2)
        job_type: {
          type: "string",
          enum: JOB_TYPES as unknown as string[],
          description: JOB_TYPE_TOOL_DESCRIPTION,
        },
      },
      required: ["zip"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Book a new appointment. Call ONLY when: (1) caller confirmed a specific date and time, AND (2) you have their full service address. Convert relative times to ISO 8601 using today's date from the lead file. Never call without address. Call this ONCE per call — if an APPOINTMENT ALREADY BOOKED block is in your prompt, the job is booked; use reschedule_appointment for changes, never this tool again.",
    input_schema: {
      type: "object" as const,
      properties: {
        scheduled_at: { type: "string", description: "ISO 8601 datetime" },
        address: { type: "string", description: "Full service address. REQUIRED." },
        zip: { type: "string", description: "The 5-digit ZIP code of the service address (the zip at the END of the address, never the house number)." },
        notes: { type: "string", description: "System type, age, issue description, urgency" },
        quoted_total: { type: "number", description: "TOTAL dollars the caller agreed to for this job, all units combined. Pass whenever a fixed price was agreed — use the FINAL corrected agreement. Omit for free-estimate visits. Never invent a number." },
        unit_count: { type: "number", description: "How many units the price covers (furnaces / systems) — the final corrected count." },
        property_type: { type: "string", description: "house | townhome | condo | apartment | commercial" },
      },
      required: ["scheduled_at", "address"],
    },
  },
  {
    name: "reschedule_appointment",
    description:
      "Reschedule an existing appointment to a new time. Use ONLY when caller has confirmed a NEW specific date and time. Get the appointment_id from the UPCOMING APPOINTMENTS section of the LEAD FILE (listed as [ID: ...]). Never call without confirming the new time first.",
    input_schema: {
      type: "object" as const,
      properties: {
        appointment_id: { type: "string", description: "The appointment ID from UPCOMING APPOINTMENTS in the lead file" },
        new_scheduled_at: { type: "string", description: "ISO 8601 datetime for the rescheduled time" },
        reason: { type: "string", description: "Why the appointment was rescheduled" },
      },
      required: ["appointment_id", "new_scheduled_at", "reason"],
    },
  },
  {
    name: "cancel_appointment",
    description:
      "Cancel an existing appointment. Use ONLY when caller explicitly says they do NOT want to reschedule. Always offer to reschedule first. Get appointment_id from the UPCOMING APPOINTMENTS section of the LEAD FILE.",
    input_schema: {
      type: "object" as const,
      properties: {
        appointment_id: { type: "string", description: "The appointment ID from UPCOMING APPOINTMENTS in the lead file" },
        reason: { type: "string", description: "Why the appointment was cancelled" },
      },
      required: ["appointment_id", "reason"],
    },
  },
  {
    name: "schedule_callback",
    description:
      "Schedule an automated outbound callback at a specific date and time. Use when caller says 'call me back', 'I'll be free tomorrow', 'reach me at 3pm', or similar. Pick a reasonable business-hours time if they're vague ('tomorrow morning' → 9am tomorrow).",
    input_schema: {
      type: "object" as const,
      properties: {
        scheduled_at: { type: "string", description: "ISO 8601 datetime — when to call them back" },
        reason: { type: "string", description: "Why the callback was requested (brief)" },
        notes: { type: "string", description: "Context to pass to the agent on the callback" },
      },
      required: ["scheduled_at", "reason"],
    },
  },
  // NOTE: add_note and update_lead_details were removed from the LIVE call.
  // Every tool-only turn cost a second sequential Claude call — audible dead
  // air on the phone. Lead details and notes are now extracted ONCE from the
  // full transcript after the call ends (lib/call-notes.ts, Haiku) — the lead
  // file stays just as complete, the call gets faster.
  {
    name: "update_lead_status",
    description:
      "Update the lead's CRM status. 'qualified' = good fit, interested. 'closed_lost' = not interested or chose someone else. 'needs_attention' = frustrated caller, commercial property, renter without landlord authorization, or unclear complex situation.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["qualified", "closed_lost", "needs_attention"] },
      },
      required: ["status"],
    },
  },
  {
    name: "transfer_to_human",
    description:
      "Transfer the call to a human rep. Use when: caller explicitly asks for a person, caller is frustrated or escalating, commercial property, renter without landlord authorization, complaint about previous service, or complex situation outside your scope.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: { type: "string", description: "Why you are transferring" },
        summary: { type: "string", description: "Brief summary for the human rep picking up" },
      },
      required: ["reason", "summary"],
    },
  },
  {
    name: "end_call",
    description:
      "End the call cleanly. Use when: booking fully confirmed and said aloud, caller says goodbye, reschedule/cancel complete, or conversation is clearly finished.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: { type: "string", enum: ["booked", "rescheduled", "cancelled", "not_interested", "transferred", "completed"] },
        farewell: { type: "string", description: "The final sentence to say before hanging up" },
      },
      required: ["reason", "farewell"],
    },
  },
]

// ─── Main engine ──────────────────────────────────────────────────────────────

export async function runVoiceTurn(
  session: VoiceSession,
  userMessage: string | null  // null = initial greeting turn
): Promise<VoiceEngineResult> {
  const db = createServiceRoleClient()

  // ── Do-not-call compliance — deterministic, never left to the model ─────────
  // "Stop calling me" MUST end the call immediately: goodbye, closed_lost,
  // voice AI paused for this lead (no future outbound), hang up.
  if (userMessage && /stop calling|don'?t call( me)?|do not call|take me off|remove (me|my number)|leave me alone|unsubscribe|never call/i.test(userMessage)) {
    const farewell = "Of course — I'll take you off our list right away. Sorry to bother you, take care."
    const ts = new Date().toISOString()
    const { data: dncLead } = await db.from("leads").select("notes").eq("id", session.lead_id).single()
    const dncNote = `[${new Date().toLocaleString("en-US")}] Lead asked not to be called. Voice AI paused, marked closed_lost.`
    await Promise.all([
      db.from("leads").update({
        status: "closed_lost",
        ai_voice_paused: true,
        last_message_at: ts,
        notes: dncLead?.notes ? `${dncLead.notes}\n${dncNote}` : dncNote,
      }).eq("id", session.lead_id),
      updateSession(session.call_sid, { status: "completed" }),
    ])
    await appendMessages(session, [
      { role: "user", content: userMessage },
      { role: "assistant", content: farewell },
    ])
    return { text: farewell, action: { type: "end", reason: "not_interested" } }
  }

  // HCP jobs are an external API lookup (~1-2s) — fetch once per call, cache
  // the formatted summary in session.collected so later turns skip the fetch.
  const hcpJobsCached = session.collected?.hcp_jobs_summary

  const [leadRes, agentRes, kbRes, appointmentsRes, technicianContext, companyRes, historyRes, hcpJobs] = await Promise.all([
    db.from("leads").select("*").eq("id", session.lead_id).single(),
    db.from("ai_agent_config")
      .select("generated_system_prompt, agent_name, working_hours_start, working_hours_end, timezone, available_days, appointment_windows, booking_horizon_days, max_appointments_per_day, disqualifiers")
      .eq("company_id", session.company_id).single(),
    db.from("knowledge_base")
      .select("business_description, services_offered, service_areas, custom_ai_knowledge, pricing_info, financing_options")
      .eq("company_id", session.company_id).single(),
    db.from("appointments")
      .select("id, scheduled_at, status, address, notes, created_at")
      .eq("lead_id", session.lead_id)
      .order("scheduled_at", { ascending: false }),
    getTechnicianContextForCompany(session.company_id),
    // Same fallback-identity bug as lib/ai-engine.ts: without this, the
    // inline fallback prompt below has no company name and the model can
    // invent one when introducing itself on the call.
    db.from("companies").select("name").eq("id", session.company_id).single(),
    // Prior SMS + past-call history — everything BEFORE this call started,
    // so Linda remembers the whole relationship, not just this conversation.
    db.from("conversations")
      .select("direction, body, channel, created_at")
      .eq("lead_id", session.lead_id)
      .eq("company_id", session.company_id)
      .lt("created_at", session.created_at ?? new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(15),
    hcpJobsCached !== undefined
      ? Promise.resolve(null)
      : import("@/lib/housecall-sync")
          .then(m => m.findJobsForLead(session.company_id, session.lead_id))
          .catch(() => []),
  ])

  const lead        = leadRes.data
  const agent       = agentRes.data
  const kb          = kbRes.data
  const appointments = appointmentsRes.data ?? []
  const company      = companyRes.data
  const priorHistory = (historyRes.data ?? []).reverse() // oldest first

  if (!lead) throw new Error("Lead not found")

  const tz        = agent?.timezone   ?? "America/New_York"
  const agentName = agent?.agent_name ?? "Linda"
  const jobLabel  = lead.job_type ? getJobTypeLabel(lead.job_type as string) : null

  // ── Determine which agent persona to use ────────────────────────────────────
  const isFollowUp  = session.collected?.is_follow_up === "true"
  const agentType   = determineAgentType(appointments, isFollowUp)
  const agentPrompt = getAgentPrompt(agentType, agentName)

  // ── Build system prompt layers ──────────────────────────────────────────────
  const companyName = company?.name ?? "the company"
  const basePrompt = agent?.generated_system_prompt ||
    `You are ${agentName}, a sales rep for ${companyName}, a ${lead.service_type ?? "HVAC"} company.
${kbValue(kb?.business_description) ? `About us: ${kbValue(kb?.business_description)}` : ""}
${kbValue(kb?.services_offered) ? `Services: ${kbValue(kb?.services_offered)}` : ""}
${kbValue(kb?.service_areas) ? `Service area: ${kbValue(kb?.service_areas)}` : ""}

IDENTITY RULE — NEVER BREAK THIS: The company you work for is "${companyName}".
Every time you say who you're calling from, use exactly this name. Never invent,
guess, or substitute a different company name, even one that sounds plausible
from the description above.`

  const leadContext = buildVoiceLeadContext(lead, appointments, session.collected, tz)

  const customKnowledgeBlock = kbValue(kb?.custom_ai_knowledge)
    ? `=== YOUR COMPANY-SPECIFIC KNOWLEDGE ===\n${kbValue(kb?.custom_ai_knowledge)}\n=== END COMPANY-SPECIFIC KNOWLEDGE ===`
    : ""

  // Voice had no financing block at all, so the job-knowledge blocks used to
  // hardcode "we do have financing options" — a promise for companies that
  // offer none. Now it mirrors the SMS engine: real details when configured,
  // an explicit prohibition when not.
  const financingBlock = kbValue(kb?.financing_options)
    ? `=== FINANCING OPTIONS (know this precisely) ===\n${kbValue(kb?.financing_options)}\n=== END FINANCING ===`
    : `=== FINANCING ===\nThis company has NOT given you any financing or payment-plan information. Never say or imply that financing, payment plans, or monthly payments are available. If asked, say you're not the one who handles payment details and the tech can go over options on-site.\n=== END FINANCING ===`

  const pricingPolicyBlock = (() => {
    const info = kbValue((kb as Record<string, unknown> | null)?.pricing_info as string | null)
    if (!info) return ""
    const feeLines = info.split("\n").map((l: string) => l.trim()).filter((l: string) =>
      /service.?call|trip.?charge|trip.?fee|visit.?fee|diagnostic.?fee|call.?out|dispatch.?fee/i.test(l)
    )
    if (feeLines.length === 0) return ""
    return [
      "=== SERVICE CALL FEE POLICY — USE THIS WHEN LEADS ASK ABOUT COST TO COME OUT ===",
      `When leads ask "Is it free?", "Do you charge to come out?", or "How much just to visit?", answer using ONLY the following — never assume or guess:`,
      "",
      ...feeLines.map((l: string) => `• ${l.replace(/^[•\-*]\s*/, "")}`),
      "",
      `Never say "free to come out" unless this policy explicitly says so. Never contradict this policy.`,
      `If the policy is CONDITIONAL (e.g. "$0 with repair", "waived if you proceed"), you MUST say the condition out loud — "There's no service call fee as long as we do the repair." NEVER shorten a conditional policy to just "free" or "no trip charge".`,
      "=== END SERVICE CALL FEE POLICY ===",
    ].join("\n")
  })()

  const qualificationBlock = buildQualificationBlock(agent?.disqualifiers ?? null)

  // ── Prior conversation history (SMS + past calls) ───────────────────────────
  const fmtHistDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", {
    timeZone: tz, month: "numeric", day: "numeric",
  })
  const historyBlock = priorHistory.length === 0 ? "" : [
    "=== PRIOR CONVERSATION HISTORY — everything before this call. You remember ALL of this. ===",
    ...priorHistory.map(m => {
      const who     = m.direction === "inbound" ? "Lead" : "You"
      const channel = m.channel === "voice" ? "call" : "SMS"
      const body    = (m.body ?? "").slice(0, 200)
      return `[${channel} ${fmtHistDate(m.created_at)}] ${who}: ${body}`
    }),
    "Never re-ask anything already answered above. Reference it naturally like a person who remembers.",
    "=== END PRIOR HISTORY ===",
  ].join("\n")

  // ── HousecallPro jobs on file for this phone number ─────────────────────────
  let hcpJobsSummary: string
  if (hcpJobsCached !== undefined) {
    hcpJobsSummary = hcpJobsCached
  } else {
    const jobs = (hcpJobs ?? []) as Array<{
      work_status?: string
      schedule?: { scheduled_start?: string }
      total_amount?: number
    }>
    hcpJobsSummary = jobs.length === 0 ? "" : jobs.slice(0, 8).map(j => {
      const when = j.schedule?.scheduled_start
        ? new Date(j.schedule.scheduled_start).toLocaleString("en-US", {
            timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
          })
        : "unscheduled"
      const amount = typeof j.total_amount === "number" && j.total_amount > 0
        ? ` — $${Math.round(j.total_amount / 100)}`
        : ""
      return `• ${j.work_status ?? "unknown"} — ${when}${amount}`
    }).join("\n")
    // Cache (including empty string) so later turns skip the HCP API call
    await updateSession(session.call_sid, {
      collected: { ...session.collected, hcp_jobs_summary: hcpJobsSummary },
    })
    session.collected = { ...session.collected, hcp_jobs_summary: hcpJobsSummary }
  }
  const hcpBlock = hcpJobsSummary
    ? `=== HOUSECALL PRO — JOBS ON FILE FOR THIS CUSTOMER (office CRM, matched by phone number) ===\n${hcpJobsSummary}\nThis customer has real history with the company. Treat them as a known customer, not a stranger.\n=== END HOUSECALL PRO JOBS ===`
    : ""

  // Job-type-specific knowledge — shorter and more focused than the full HVAC_KNOWLEDGE block.
  // A lead calling about furnace repair gets heating knowledge only, reducing prompt size
  // and improving Linda's attention on the content that actually matters for that call.
  const jobKnowledgeBlock = getJobKnowledgeBlock(lead.job_type as string | null)

  let voiceRules = VOICE_RULES.replaceAll("[AgentName]", agentName)
  // When a fee policy exists, remove the parrot-able "completely free" fallback
  // from rule 15 entirely — small models latch onto quoted sayable phrases even
  // when told they're conditional.
  if (pricingPolicyBlock) {
    voiceRules = voiceRules.replace(
      `15. VISIT FEE / TRIP CHARGE: If a SERVICE CALL FEE POLICY block appears in this system prompt, follow it exactly when asked about cost to come out. Never say "free" unless that policy says so. If no SERVICE CALL FEE POLICY block is present, say "It's completely free — no trip charge."`,
      `15. VISIT FEE / TRIP CHARGE: A SERVICE CALL FEE POLICY block exists in this prompt. When asked what it costs to come out, answer ONLY from that policy and say its conditions out loud (e.g. "no service call fee as long as we do the repair"). The visit is NOT unconditionally free — never say "completely free" or "no trip charge" as a blanket statement.`
    )
  }

  // Once a booking exists, the slots block and its "book IMMEDIATELY" pressure
  // must DISAPPEAR from the prompt — leaving it in produced one booking per
  // conversational turn for the rest of a live call ("Okay" → book, "Thanks"
  // → book, "Bye" → book: 10 duplicate HCP jobs, live incident: Wafaa). The
  // booked block replaces it and points every change at reschedule/cancel.
  const bookedBlock = session.collected?.appointment_booked === "true"
    ? `=== APPOINTMENT ALREADY BOOKED THIS CALL — BOOKING IS DONE ===
${session.collected.appointment_label ? `Booked: ${session.collected.appointment_label}${session.collected.address ? ` at ${session.collected.address}` : ""}.` : "The appointment is booked."}
NEVER call book_appointment again on this call — every repeat call creates a duplicate job on the company's schedule.
"Okay", "yes", "sounds good", "thank you", "bye" are the caller ACKNOWLEDGING the booking, not asking to book again.
If the caller wants a DIFFERENT day or time: call reschedule_appointment${session.collected.appointment_id ? ` with appointment_id "${session.collected.appointment_id}"` : " (ID in UPCOMING APPOINTMENTS)"}.
If they want to cancel: offer to reschedule first, then cancel_appointment.
Otherwise just answer their questions and wrap up warmly.
=== END APPOINTMENT ALREADY BOOKED ===`
    : ""

  // Slots fetched earlier in THIS call — inject so the model books with the
  // exact ISO instead of re-calling find_available_slots every turn.
  const offeredSlotsBlock = !bookedBlock && session.collected?.available_slots
    ? `=== SLOTS ALREADY CHECKED THIS CALL — DO NOT CHECK AGAIN ===
These real slots were already fetched for the caller's zip (do NOT call find_available_slots again unless the address changes):
${session.collected.available_slots}
The moment the caller accepts a day or time, call book_appointment IMMEDIATELY with the matching ISO datetime and their address — in that same turn. If they accept a broad time like "Monday morning", use the EARLIEST matching slot.
=== END SLOTS ===`
    : ""

  // Note: no pre-computed slots block on fresh calls — the agent calls find_available_slots after getting zip code.
  const systemPrompt = [voiceRules, basePrompt, pricingPolicyBlock, financingBlock, jobKnowledgeBlock, customKnowledgeBlock, qualificationBlock, technicianContext, agentPrompt, leadContext, bookedBlock, offeredSlotsBlock, hcpBlock, historyBlock]
    .filter(Boolean)
    .join("\n\n")

  // Prompt caching: the cache breakpoint on the system block also covers the
  // TOOLS definitions serialized before it. Turn 1 of a call writes the cache;
  // every later turn (and the 2nd/3rd sequential calls inside slot-check and
  // booking turns) reads it — a direct time-to-first-token cut on a live phone
  // call where every 100ms of silence is audible. Identical output, same prompt.
  const cachedSystem = [
    { type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const } },
  ]

  // ── Build message list for Claude ───────────────────────────────────────────
  const isGreeting = userMessage === null
  let messages: VoiceMessage[] = [...session.messages]

  if (isGreeting) {
    const callbackReason = session.collected?.callback_reason
    let directionHint: string

    // Build a rich context snippet from what we know about this lead
    const firstName  = (lead.first_name as string | null) ?? null
    const notes      = (lead.notes as string | null) ?? null
    const meta       = lead.metadata as Record<string, unknown> | null
    const metaLines  = meta
      ? Object.entries(meta)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : null
    const leadDetails = [
      firstName   ? `Name: ${firstName}`          : null,
      jobLabel    ? `Job type: ${jobLabel}`        : null,
      notes       ? `Notes from form: ${notes}`   : null,
      metaLines   ? `Form fields: ${metaLines}`   : null,
    ].filter(Boolean).join(" | ")

    if (session.direction === "outbound") {
      if (callbackReason) {
        directionHint = `CALLBACK — this lead texted "call me" in the SMS conversation. Here is the SMS context so you know exactly what this call is about: "${callbackReason}". Lead details: ${leadDetails || "none on file"}. Open naturally using what you already know — do NOT ask "what's going on with your HVAC?" if you already know. React to what they say. Start the call now.`
      } else {
        directionHint = `OUTBOUND CALL — you called this lead. Lead details: ${leadDetails || "none on file"}. Open by referencing the SPECIFIC issue or job type from the lead file — not a generic "what's going on with your HVAC?" Use their name. Be specific. Start the call now.`
      }
    } else {
      directionHint = `INBOUND CALL — they called us. Lead details: ${leadDetails || "none on file"}. If you have their name, use it. If you already know why they're calling from the lead file (notes, job type, form fields), reference that naturally. If you don't know why they're calling yet, find out with ONE question. Start the call now.`
    }

    messages.push({ role: "user", content: directionHint })
  } else {
    messages.push({ role: "user", content: userMessage! })
  }

  // ── First Claude call ────────────────────────────────────────────────────────
  // Haiku for speed during discovery/qualification. Once slots have been offered,
  // the call is in the booking-critical stage — Sonnet reliably pairs the verbal
  // confirmation with the actual book_appointment tool call; Haiku often says
  // "you're all set" without booking. 1-2 turns per call, latency cost is minor.
  const mainModel = session.collected?.slots_offered === "true"
    ? "claude-sonnet-4-6"
    : "claude-haiku-4-5-20251001"
  const response = await anthropic.messages.create({
    model: mainModel,
    max_tokens: 150,
    system: cachedSystem,
    tools: TOOLS,
    messages: messages as Parameters<typeof anthropic.messages.create>[0]["messages"],
  })

  // The model can emit MULTIPLE tool_use blocks in one response (e.g.
  // update_lead_details + book_appointment together). Every tool_use id MUST
  // get a tool_result in the next message or the API 400s — so we always
  // parse ALL blocks and answer ALL of them.
  type ToolBlock = { name: string; id: string; input: Record<string, unknown> }
  const parseResponse = (content: typeof response.content) => {
    let text = ""
    const tools: ToolBlock[] = []
    for (const block of content) {
      if (block.type === "text")     text = block.text.trim()
      if (block.type === "tool_use") tools.push({ name: block.name, id: block.id, input: block.input as Record<string, unknown> })
    }
    return { text, tools }
  }
  const allResults = (tools: ToolBlock[], primaryId: string | null, primaryContent: string) =>
    tools.map(t => ({
      type: "tool_result" as const,
      tool_use_id: t.id,
      content: t.id === primaryId ? primaryContent : "Action recorded.",
    }))

  const first = parseResponse(response.content)
  let responseText = first.text
  // Tools queued for real execution at the end of the turn (find_available_slots
  // is handled inline below and never queued).
  const toolsToExecute: ToolBlock[] = first.tools.filter(t => t.name !== "find_available_slots")
  const slotToolBlock = first.tools.find(t => t.name === "find_available_slots") ?? null

  // ── find_available_slots — run real lookup and feed results back to Claude ──
  // This is the voice equivalent of the SMS agent's find_available_slots tool.
  // We run findSlotsForLead(), pass real slot data or outside-area signal back,
  // then get Claude's verbal response (slot offer or warm rejection).
  //
  // FORCED TRIGGER: the model sometimes says "let me check availability" WITHOUT
  // calling the tool, leaving the lead waiting for slots that never come. If the
  // lead's message contains a zip code and no slot check has run this call, run
  // the lookup ourselves — deterministic, not dependent on model compliance.
  const forcedZip = !slotToolBlock && first.tools.length === 0 && userMessage && session.collected?.slots_offered !== "true"
    ? (userMessage.match(/\b\d{5}\b/g)?.slice(-1)[0] ?? null)
    : null
  const isRealSlotCall = slotToolBlock !== null

  if (isRealSlotCall || forcedZip) {
    const bridgingPhrase = responseText.trim() // e.g. "Give me just a second to check who's available."
    responseText = ""
    const { zip, job_type } = isRealSlotCall
      ? slotToolBlock!.input as { zip: string; job_type?: string }
      : { zip: forcedZip!, job_type: (lead.job_type as string | undefined) ?? undefined }

    const slotsResult = await findSlotsForLead(session.company_id, job_type ?? null, zip ?? null)

    // Remember that slots were checked so the forced trigger never double-fires.
    // Also capture the address text from this message — the booking safety net
    // below needs it if the model later confirms verbally without booking.
    session.collected = { ...session.collected, slots_offered: "true" }
    if (userMessage) {
      const addrStart = userMessage.search(/\d/)
      if (addrStart >= 0) session.collected.candidate_address = userMessage.slice(addrStart).trim()
    }
    await updateSession(session.call_sid, { collected: session.collected })

    let toolResultContent: string
    if (!slotsResult.found) {
      if (slotsResult.reason === "job_not_offered") {
        toolResultContent =
          `SERVICE_NOT_OFFERED: the company does not offer this type of job. ` +
          `Respond warmly in 2 sentences — say that's not something they handle, and you hope they find the right person for it. ` +
          `Do NOT offer an appointment. Then call update_lead_status("closed_lost") and end_call("not_interested").`
      } else if (slotsResult.reason === "no_zip_match") {
        toolResultContent =
          `OUTSIDE_SERVICE_AREA: zip code "${zip}" is not covered by any active technician. ` +
          `Respond warmly in 2 sentences — say you unfortunately don't serve that area and you hope they find someone quickly. ` +
          `Then call update_lead_status("closed_lost") and end_call("not_interested").`
      } else if (slotsResult.reason === "no_technicians") {
        toolResultContent =
          "NO_TECHNICIANS: No active technicians on file right now. " +
          "Apologize briefly and offer to have someone call them back. Call schedule_callback."
      } else {
        toolResultContent =
          "NO_SLOTS: No availability in the next 7 days. " +
          "Offer to call back when scheduling opens up. Call schedule_callback."
      }
    } else {
      const slotLines = slotsResult.slots.slice(0, 6)
        .map(s => `${s.label} — ISO: ${s.isoStart}`)
        .join("\n")
      toolResultContent =
        `IN_SERVICE_AREA. Available slots (offer exactly 2 — use the ISO values when calling book_appointment):\n${slotLines}`
      // Persist the slot list — future turns need the ISO datetimes to book.
      // Without this the model re-calls find_available_slots every turn and
      // never reaches book_appointment.
      session.collected = { ...session.collected, available_slots: slotLines }
      await updateSession(session.call_sid, { collected: session.collected })
      // Slot→tech map, same shape the SMS engine writes: the slot engine just
      // decided WHICH tech each slot belongs to — throwing that away forced a
      // post-insert re-selection that raced the HCP push, and every voice job
      // landed in HCP unassigned (live: Wafaa → stamped onto the wrong tech).
      // book_appointment reads this map to insert WITH the technician.
      const voiceSlotMap: Record<string, { tech_id: string; tech_name: string; iso?: string }> = {}
      for (const s of slotsResult.slots) {
        voiceSlotMap[s.isoStart.substring(0, 16)] = { tech_id: s.techId, tech_name: s.techName, iso: s.isoStart }
      }
      await db.from("leads").update({ selected_slots: voiceSlotMap }).eq("id", session.lead_id)
    }

    // Real tool call → proper tool_result exchange (answering EVERY tool_use id).
    // Forced trigger → the model never emitted tool_use, so feed results as a
    // system-style user note.
    const slotMessages: VoiceMessage[] = isRealSlotCall
      ? [
          ...messages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: allResults(first.tools, slotToolBlock!.id, toolResultContent),
          },
        ]
      : [
          ...messages,
          ...(bridgingPhrase ? [{ role: "assistant" as const, content: bridgingPhrase }] : []),
          {
            role: "user",
            content: `(SYSTEM — the availability check for zip ${zip} just completed automatically. ${toolResultContent}\nRespond to the caller now — do NOT say you'll check availability, it's already done.)`,
          },
        ]

    const slotResponse = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 150,
      system:     cachedSystem,
      tools:      TOOLS,
      messages:   slotMessages as Parameters<typeof anthropic.messages.create>[0]["messages"],
    })

    const second = parseResponse(slotResponse.content)
    responseText = second.text
    toolsToExecute.push(...second.tools)

    // The follow-up may call silent tools (update_lead_status, update_lead_details)
    // instead of speaking — without this, the lead hears only the bridging phrase
    // and then dead air. Force one more turn to get the verbal slot offer.
    if (second.tools.length > 0 && !responseText) {
      const nestedMessages: VoiceMessage[] = [
        ...slotMessages,
        { role: "assistant", content: slotResponse.content },
        {
          role: "user",
          content: allResults(second.tools, second.tools[0].id,
            "Action recorded. Now say your verbal response to the caller — offer two slots from the results (or the outcome of what just happened). 1-2 natural sentences."),
        },
      ]
      const nested = await anthropic.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 150,
        system:     cachedSystem,
        tools:      TOOLS,
        messages:   nestedMessages as Parameters<typeof anthropic.messages.create>[0]["messages"],
      })
      const third = parseResponse(nested.content)
      responseText = third.text
      toolsToExecute.push(...third.tools)
    }

    // Prepend the bridging phrase so the lead hears one fluid response:
    // "Give me just a second to check who's available. Okay — I've got Thursday morning or Friday afternoon."
    if (bridgingPhrase && responseText) {
      responseText = `${bridgingPhrase} ${responseText}`
    }
  }
  // ── Other tools called without verbal — get verbal response ─────────────────
  else if (first.tools.length > 0 && !responseText) {
    const followUpMessages: VoiceMessage[] = [
      ...messages,
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: allResults(first.tools, first.tools[0].id,
          "Action recorded. Now respond verbally to confirm what just happened — 1-2 natural sentences."),
      },
    ]

    const followUp = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 100,
      system:     cachedSystem,
      tools:      TOOLS,
      messages:   followUpMessages as Parameters<typeof anthropic.messages.create>[0]["messages"],
    })

    const fu = parseResponse(followUp.content)
    responseText = fu.text
    toolsToExecute.push(...fu.tools)
  }

  // ── Never-silent guarantee ───────────────────────────────────────────────────
  // A live call can never play empty text. If the model called tools without
  // speaking, synthesize the confirmation from the most significant tool.
  if (!responseText && toolsToExecute.length > 0) {
    const names = toolsToExecute.map(t => t.name)
    if (names.includes("end_call")) {
      const ec = toolsToExecute.find(t => t.name === "end_call")!
      responseText = (ec.input.farewell as string | undefined)?.trim() || "Thanks so much — take care!"
    } else if (names.includes("book_appointment")) {
      responseText = "Perfect — you're all set. Our tech will give you a call about thirty minutes before heading over. Anything else I can help with?"
    } else if (names.includes("transfer_to_human")) {
      responseText = "Let me get you over to someone on our team — one moment."
    } else {
      responseText = "Got it. Anything else I can help you with?"
    }
  }

  // ── Booking safety net ───────────────────────────────────────────────────────
  // Worst failure mode on a call: Linda TELLS the lead they're booked but never
  // calls book_appointment — the lead waits for a tech who never comes. If the
  // response reads as a booking confirmation, slots were offered, and nothing is
  // booked yet, book the matching slot deterministically.
  const alreadyBooking = toolsToExecute.some(t => t.name === "book_appointment")
  const savedSlots = session.collected?.available_slots
  if (!alreadyBooking && savedSlots && session.collected?.appointment_booked !== "true" &&
      /got you down|you're all set|youre all set|all set for|booked (you |you're |for )|see you (then|on|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tech will (give you a call|call you) about (30|thirty) minutes/i.test(responseText)) {
    const lines      = savedSlots.split("\n")
    const respLower  = responseText.toLowerCase()
    const dayNames   = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const mentioned  = dayNames.filter(d => respLower.includes(d))
    const dayLines   = lines.filter(l => mentioned.some(d => l.toLowerCase().includes(d)))
    const wantsPm    = /afternoon|evening/i.test(responseText)
    const wantsAm    = /morning/i.test(responseText)
    const windowFit  = dayLines.filter(l => wantsPm ? /afternoon|evening/i.test(l) : wantsAm ? /morning/i.test(l) : true)
    const chosen     = windowFit[0] ?? dayLines[0]
    const iso        = chosen?.match(/ISO:\s*(\S+)/)?.[1]
    const addr       = (lead.address as string | null) ?? session.collected?.candidate_address ?? null
    if (iso && addr) {
      console.log("[voice] booking safety net fired — model confirmed verbally without booking. Slot:", iso)
      toolsToExecute.push({ name: "book_appointment", id: "safety_net_booking", input: { scheduled_at: iso, address: addr } })
    }
  }

  // ── Persist turn to session ──────────────────────────────────────────────────
  const newMessages: VoiceMessage[] = [
    { role: "user",      content: isGreeting ? "(call connected)" : userMessage! },
    { role: "assistant", content: responseText },
  ]
  await appendMessages(session, newMessages)

  // ── Update lead last_message_at ─────────────────────────────────────────────
  await db.from("leads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", session.lead_id)

  // ── Execute ALL queued tools; first terminal action wins ───────────────────
  let finalAction: VoiceAction = { type: "continue" }
  for (const tb of toolsToExecute) {
    const action = await executeTool(tb, session, db, tz)
    if (action.type !== "continue" && finalAction.type === "continue") {
      finalAction = action
    }
  }

  return { text: responseText, action: finalAction }
}

// ─── Tool execution ────────────────────────────────────────────────────────────
// Exported for the booking test battery — production callers stay in-module.

export async function executeTool(
  tool: { name: string; id: string; input: Record<string, unknown> },
  session: VoiceSession,
  db: ReturnType<typeof createServiceRoleClient>,
  tz = "America/New_York"
): Promise<VoiceAction> {
  switch (tool.name) {

    // find_available_slots is handled inline in runVoiceTurn before executeTool is called.
    // If it somehow reaches here, it's a no-op.
    case "find_available_slots":
      return { type: "continue" }

    case "book_appointment": {
      const { scheduled_at, address, notes, quoted_total, unit_count, property_type, zip: zipInput } = tool.input as {
        scheduled_at: string; address: string; notes?: string
        quoted_total?: number; unit_count?: number; property_type?: string; zip?: string
      }

      // Guard: the model must pass a parseable datetime. A bad value would
      // fail the insert silently while the lead is told they're booked.
      if (!scheduled_at || isNaN(new Date(scheduled_at).getTime())) {
        console.error("[voice] book_appointment got invalid scheduled_at:", JSON.stringify(scheduled_at))
        return { type: "continue" }
      }
      const bookMs = new Date(scheduled_at).getTime()

      const { data: leadRow } = await db.from("leads")
        .select("job_type, address, selected_slots")
        .eq("id", session.lead_id)
        .single()
      const jobType = (leadRow?.job_type as string | null) ?? null
      // Zip resolution: the model's structured zip → the address it passed →
      // the address on file. Extraction is always last-5-digit-group so a
      // 5-digit HOUSE number can never win (live: Wafaa, HCP zip "13496").
      const zip =
        (typeof zipInput === "string" && /^\d{5}$/.test(zipInput.trim()) ? zipInput.trim() : null) ??
        zipFromAddress(address) ??
        zipFromAddress(leadRow?.address as string | null)

      // Tech decided at SLOT time — find_available_slots wrote the slot→tech
      // map, and the booking inherits it so the HCP push carries the
      // assignment from the first second instead of racing a re-selection
      // (live: every voice job reached HCP unassigned → wrong tech stamped).
      const slotMap = (leadRow?.selected_slots ?? {}) as Record<string, { tech_id?: string; tech_name?: string }>
      const mapTech = slotMap[new Date(bookMs).toISOString().substring(0, 16)] ?? null

      const rememberBooking = async (aptId: string, atMs: number) => {
        const label = new Date(atMs).toLocaleString("en-US", {
          timeZone: zipToTimeZone(zip) ?? tz,
          weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
        })
        session.collected = {
          ...session.collected,
          appointment_booked: "true",
          appointment_id: aptId,
          appointment_label: label,
          ...(address ? { address } : {}),
        }
        await updateSession(session.call_sid, { stage: "confirmation", collected: session.collected })
      }

      // Policy audit AFTER the caller is answered — flags loudly, never blocks
      // a live call. Same validator the SMS engine runs before its inserts:
      // company service area, tech territory, window capacity, daily cap,
      // anchor day, minimum lead time.
      const auditBooking = (aptId: string, techId: string | null) => {
        if (!techId) return
        import("@/lib/technician-booking")
          .then(({ techCanTakeBooking }) => techCanTakeBooking(techId, jobType, zip, scheduled_at, session.lead_id, aptId))
          .then(async (ok) => {
            if (ok) return
            console.error(`[voice] booking ${aptId} failed policy audit (tech=${techId} zip=${zip} at=${scheduled_at})`)
            await db.from("leads").update({ status: "needs_attention" }).eq("id", session.lead_id)
            const { data: aptRow } = await db.from("appointments").select("notes").eq("id", aptId).maybeSingle()
            await db.from("appointments").update({
              notes: [aptRow?.notes, "⚠️ Voice booking outside policy (zip coverage / capacity / lead time) — office review needed."]
                .filter(Boolean).join(" | "),
            }).eq("id", aptId)
            const { notifyNeedsAttention } = await import("@/lib/notifications")
            notifyNeedsAttention(session.company_id, "Voice booking needs review — outside coverage or capacity", "").catch(() => {})
          })
          .catch((e) => console.error("[voice] booking audit failed:", e))
      }

      // ── One active AI booking per lead ────────────────────────────────────
      // Mirrors the SMS engine's guard (a DB unique index backstops both):
      // the same slot again → no-op; a different time → MOVE the existing
      // appointment. Without this, every acknowledgement after the first
      // booking ("okay", "thanks", "bye") became another appointment — ten
      // duplicate HCP jobs on one call (live: Wafaa).
      const { data: existing } = await db.from("appointments")
        .select("id, scheduled_at, hcp_job_id, technician_id, technician_name, address, notes")
        .eq("lead_id", session.lead_id)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        const sameTime = Math.abs(Date.parse(existing.scheduled_at) - bookMs) < 60_000
        const duplicate = sameTime ||
          await sameWindowBucket(session.company_id, existing.scheduled_at, scheduled_at, zip).catch(() => false)
        if (duplicate) {
          console.log(`[voice] duplicate booking suppressed — lead ${session.lead_id} already booked at ${existing.scheduled_at}`)
          await rememberBooking(existing.id, Date.parse(existing.scheduled_at))
          return { type: "continue" }
        }

        // Different day/window while an appointment exists = a reschedule.
        const pushed = !!existing.hcp_job_id && !String(existing.hcp_job_id).startsWith("pending:")
        const updates: Record<string, unknown> = {
          scheduled_at,
          rescheduled_from: existing.scheduled_at,
          confirmation_sms_sent: false, confirmation_email_sent: false,
          reminder_2d_email_sent: false, reminder_2d_sms_sent: false,
          reminder_1d_email_sent: false, reminder_1d_sms_sent: false,
          reminder_2h_email_sent: false, reminder_2h_sms_sent: false,
        }
        if (mapTech?.tech_id) {
          updates.technician_id = mapTech.tech_id
          updates.technician_name = mapTech.tech_name ?? null
        }
        if (address) updates.address = address
        if (pushed) {
          // The HCP API cannot move a job — the office must, by hand. Say so
          // on the row; the reconcile pass knows not to revert this change.
          updates.notes = [existing.notes, "Customer rescheduled by phone — move the Housecall Pro job to the new time manually."]
            .filter(Boolean).join(" | ")
        }
        await db.from("appointments").update(updates).eq("id", existing.id)
        await db.from("leads").update({
          status: "appointment_booked",
          last_message_at: new Date().toISOString(),
          ...(address ? { address } : {}),
        }).eq("id", session.lead_id)
        await rememberBooking(existing.id, bookMs)
        if (pushed) {
          const { notifyNeedsAttention } = await import("@/lib/notifications")
          notifyNeedsAttention(session.company_id, "Phone reschedule — move the Housecall Pro job manually", "").catch(() => {})
        } else {
          import("@/lib/housecall-sync")
            .then(({ pushBookingToHcp }) => pushBookingToHcp(existing.id))
            .catch((err) => console.error("[hcp-sync] voice reschedule push failed:", err))
        }
        auditBooking(existing.id, (mapTech?.tech_id ?? existing.technician_id) as string | null)
        console.log(`[voice] duplicate booking collapsed into ${existing.id} — moved to ${scheduled_at}`)
        return { type: "book", scheduled_at, address: address ?? (existing.address as string | null) ?? "", notes }
      }

      const { data: apt, error: aptErr } = await db.from("appointments").insert({
        lead_id:             session.lead_id,
        company_id:          session.company_id,
        scheduled_at,
        address:             address ?? null,
        notes:               notes ?? null,
        status:              "scheduled",
        origin:              "ai",
        confirmation_status: "pending_confirmation",
        technician_id:       mapTech?.tech_id ?? null,
        technician_name:     mapTech?.tech_name ?? null,
      }).select().single()
      if (aptErr) {
        // Unique-index race (two bookings landing simultaneously): the other
        // writer already created the row — adopt it instead of failing.
        if ((aptErr as { code?: string }).code === "23505") {
          const { data: raced } = await db.from("appointments")
            .select("id, scheduled_at")
            .eq("lead_id", session.lead_id).eq("status", "scheduled")
            .order("created_at", { ascending: false }).limit(1).maybeSingle()
          if (raced) {
            console.log(`[voice] duplicate insert blocked by unique index — adopting ${raced.id}`)
            await rememberBooking(raced.id, Date.parse(raced.scheduled_at))
            return { type: "continue" }
          }
        }
        console.error("[voice] appointment insert FAILED:", aptErr.message, "| scheduled_at:", scheduled_at)
      }

      await db.from("leads").update({
        status:          "appointment_booked",
        last_message_at: new Date().toISOString(),
        address:         address ?? undefined,
      }).eq("id", session.lead_id)

      if (apt) {
        await rememberBooking(apt.id, bookMs)

        // Structured scope facts → lead file (last confirmed wins; pricing
        // and future conversations read them)
        if (typeof unit_count === "number" || typeof property_type === "string") {
          saveLeadDetailsForLead(db, session.lead_id, session.company_id, {
            unit_count: typeof unit_count === "number" ? unit_count : undefined,
            property_type: typeof property_type === "string" ? property_type : undefined,
          }).catch((e) => console.error("[voice] scope-fact save failed:", e))
        }

        // Record what was SOLD (same ladder as SMS/Messenger). Non-blocking:
        // never delay a live call on pricing bookkeeping.
        import("@/lib/pricing").then(async ({ resolveQuotedAmount, saveQuotedAmount }) => {
          const q = await resolveQuotedAmount({
            companyId: session.company_id, leadId: session.lead_id,
            jobType,
            agentTotalCents: typeof quoted_total === "number" ? Math.round(quoted_total * 100) : null,
            agentUnitCount: typeof unit_count === "number" ? Math.round(unit_count) : null,
            agentPropertyType: typeof property_type === "string" ? property_type : null,
          })
          await saveQuotedAmount(apt.id, session.lead_id, q)
        }).catch((e) => console.error("[voice] quoted-amount resolution failed:", e))

        // Tech, then audit, then the HCP push — strictly ORDERED in one chain
        // (still fire-and-forget for the caller). The old code launched
        // selectTechnician and pushBookingToHcp in parallel; the push always
        // won the race, read technician_id as NULL, and every voice job
        // landed in HCP unassigned — where it got stamped onto the wrong
        // tech and mirrored back over our own data (live: Wafaa / Jason B).
        const finalize = async () => {
          let techId: string | null = mapTech?.tech_id ?? null
          if (!techId) {
            try {
              const res = await selectTechnician(session.company_id, apt.id, scheduled_at, jobType, zip)
              if (res.found) {
                techId = res.technician.id
              } else {
                const { flagNoTechAvailable } = await import("@/lib/technician-booking")
                await flagNoTechAvailable(apt.id, res.reason, session.company_id)
                const { notifyNeedsAttention } = await import("@/lib/notifications")
                notifyNeedsAttention(session.company_id, "Voice booking needs manual dispatch", "").catch(() => {})
              }
            } catch (e) {
              console.error("[voice] selectTechnician failed:", e)
            }
          }
          // No real street address (zip-only, or none) → the tech has an
          // area, not a door. Flag it loudly; the office collects the street
          // before dispatch. Never blocks — the confirmation is already
          // spoken by the time tools run on a voice turn.
          if (!isCompleteServiceAddress(address ?? (leadRow?.address as string | null))) {
            console.error(`[voice] booking ${apt.id} has no full street address (have: ${JSON.stringify(address ?? leadRow?.address ?? null)})`)
            await db.from("leads").update({ status: "needs_attention" }).eq("id", session.lead_id)
            const { data: aptRow } = await db.from("appointments").select("notes").eq("id", apt.id).maybeSingle()
            await db.from("appointments").update({
              notes: [aptRow?.notes, "⚠️ No full street address on file — collect it before dispatch."].filter(Boolean).join(" | "),
            }).eq("id", apt.id)
            const { notifyNeedsAttention } = await import("@/lib/notifications")
            notifyNeedsAttention(session.company_id, "Voice booking has no street address — collect before dispatch", "").catch(() => {})
          }
          auditBooking(apt.id, techId)
          // HCP-mode companies: mirror the booking into Housecall Pro — same
          // as the SMS/Messenger engine. Failed pushes retry via the cron.
          await import("@/lib/housecall-sync").then(({ pushBookingToHcp }) => pushBookingToHcp(apt.id))
        }
        finalize().catch((err) => console.error("[hcp-sync] voice booking push failed:", err))
      }

      // Google Calendar sync
      if (apt) {
        try {
          const { data: gcal } = await db.from("google_calendar_connections")
            .select("access_token, refresh_token, calendar_id, is_connected")
            .eq("company_id", session.company_id).single()

          if (gcal?.is_connected && gcal.access_token && gcal.refresh_token) {
            const { data: lead } = await db.from("leads")
              .select("first_name, last_name, phone").eq("id", session.lead_id).single()

            const gcalEvent = await createCalendarEvent(
              gcal.access_token, gcal.refresh_token, gcal.calendar_id ?? "primary",
              {
                summary:     `Estimate: ${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim(),
                description: notes ?? "",
                location:    address,
                startTime:   scheduled_at,
                endTime:     new Date(new Date(scheduled_at).getTime() + 60 * 60000).toISOString(),
              }
            )
            await db.from("appointments")
              .update({ google_event_id: gcalEvent.id ?? null })
              .eq("id", apt.id)
          }
        } catch { /* non-blocking */ }
      }

      return { type: "book", scheduled_at, address, notes }
    }

    case "reschedule_appointment": {
      const { appointment_id, new_scheduled_at, reason } = tool.input as {
        appointment_id: string; new_scheduled_at: string; reason: string
      }

      const { data: oldApt } = await db.from("appointments")
        .select("scheduled_at, google_event_id, hcp_job_id, notes")
        .eq("id", appointment_id)
        .single()

      // A job already mirrored into Housecall Pro can't be moved via their
      // API — the office must move it by hand. Mark the row (the reconcile
      // pass reads rescheduled_from and won't revert us to HCP's stale time)
      // and ping the office.
      const hcpPushed = !!oldApt?.hcp_job_id && !String(oldApt.hcp_job_id).startsWith("pending:")

      await db.from("appointments").update({
        scheduled_at: new_scheduled_at,
        notes: [reason, hcpPushed ? "Customer rescheduled by phone — move the Housecall Pro job to the new time manually." : null]
          .filter(Boolean).join(" | "),
        rescheduled_from: oldApt?.scheduled_at ?? null,
        confirmation_sms_sent: false,
        confirmation_email_sent: false,
        reminder_2d_email_sent: false,
        reminder_2d_sms_sent: false,
        reminder_1d_email_sent: false,
        reminder_1d_sms_sent: false,
        reminder_2h_email_sent: false,
        reminder_2h_sms_sent: false,
      }).eq("id", appointment_id).eq("company_id", session.company_id)

      await db.from("leads")
        .update({ status: "appointment_booked", last_message_at: new Date().toISOString() })
        .eq("id", session.lead_id)

      if (hcpPushed) {
        const { notifyNeedsAttention } = await import("@/lib/notifications")
        notifyNeedsAttention(session.company_id, "Phone reschedule — move the Housecall Pro job manually", "").catch(() => {})
      }
      // Fresh confirmation for the NEW time (reminder clocks restarted above)
      import("@/lib/appointment-reminders")
        .then(({ sendConfirmations }) => sendConfirmations(appointment_id))
        .catch(() => {})
      // Session state: the call's booked appointment moved
      if (session.collected?.appointment_booked === "true") {
        const newLabel = new Date(new_scheduled_at).toLocaleString("en-US", {
          timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
        })
        session.collected = { ...session.collected, appointment_id, appointment_label: newLabel }
        await updateSession(session.call_sid, { collected: session.collected })
      }

      if (oldApt?.google_event_id) {
        try {
          const { data: gcal } = await db.from("google_calendar_connections")
            .select("access_token, refresh_token, calendar_id, is_connected")
            .eq("company_id", session.company_id).single()
          if (gcal?.is_connected && gcal.access_token && gcal.refresh_token) {
            const { deleteCalendarEvent, createCalendarEvent } = await import("@/lib/google-calendar")
            await deleteCalendarEvent(gcal.access_token, gcal.refresh_token, gcal.calendar_id ?? "primary", oldApt.google_event_id)
            const { data: lead } = await db.from("leads").select("first_name, last_name").eq("id", session.lead_id).single()
            const newGcalEvent = await createCalendarEvent(
              gcal.access_token, gcal.refresh_token, gcal.calendar_id ?? "primary",
              {
                summary: `Estimate: ${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim(),
                description: reason ?? "",
                startTime: new_scheduled_at,
                endTime: new Date(new Date(new_scheduled_at).getTime() + 60 * 60000).toISOString(),
              }
            )
            await db.from("appointments").update({ google_event_id: newGcalEvent.id ?? null }).eq("id", appointment_id)
          }
        } catch { /* non-blocking */ }
      }

      return { type: "continue" }
    }

    case "cancel_appointment": {
      const { appointment_id, reason } = tool.input as { appointment_id: string; reason: string }
      await db.from("appointments")
        .update({ status: "cancelled", notes: reason })
        .eq("id", appointment_id)
        .eq("company_id", session.company_id)
      await db.from("leads")
        .update({ status: "cold", last_message_at: new Date().toISOString() })
        .eq("id", session.lead_id)
      return { type: "end", reason: "cancelled" }
    }

    case "schedule_callback": {
      const { scheduled_at, reason, notes } = tool.input as {
        scheduled_at: string; reason: string; notes?: string
      }

      await db.from("scheduled_calls").insert({
        lead_id:      session.lead_id,
        company_id:   session.company_id,
        scheduled_at,
        reason,
        notes:        notes ?? null,
        status:       "pending",
      })

      // Append a timestamped note to the lead
      const { data: lead } = await db.from("leads").select("notes").eq("id", session.lead_id).single()
      const ts      = new Date().toLocaleString("en-US", { timeZone: tz })
      const newNote = `[${ts}] Callback scheduled for ${new Date(scheduled_at).toLocaleString("en-US")}. Reason: ${reason}`
      const merged  = lead?.notes ? `${lead.notes}\n${newNote}` : newNote
      await db.from("leads").update({ notes: merged, status: "nurturing" }).eq("id", session.lead_id)

      return { type: "continue" }
    }

    case "update_lead_details": {
      const { job_type, system_type, system_age } = tool.input as {
        job_type?: string; system_type?: string; system_age?: string
      }
      const updates: Record<string, string> = {}
      if (job_type)    updates.job_type    = job_type
      if (system_type) updates.system_type = system_type
      if (system_age)  updates.system_age  = system_age

      if (Object.keys(updates).length > 0) {
        await db.from("leads").update(updates).eq("id", session.lead_id)
        await updateSession(session.call_sid, {
          collected: { ...session.collected, ...updates },
        })
      }
      return { type: "continue" }
    }

    case "add_note": {
      const { note } = tool.input as { note: string }
      const { data: lead } = await db.from("leads").select("notes").eq("id", session.lead_id).single()
      const ts      = new Date().toLocaleString("en-US", { timeZone: tz })
      const newNote = `[${ts}] ${note}`
      const merged  = lead?.notes ? `${lead.notes}\n${newNote}` : newNote
      await db.from("leads").update({ notes: merged }).eq("id", session.lead_id)
      return { type: "continue" }
    }

    case "update_lead_status": {
      const { status } = tool.input as { status: string }
      // Never let a post-booking status call slide a booked lead back to a
      // discovery stage (same guard as the SMS engine)
      const { statusDowngradeBlocked } = await import("@/lib/sequences")
      const { data: cur } = await db.from("leads").select("status").eq("id", session.lead_id).maybeSingle()
      if (!(await statusDowngradeBlocked(db, session.lead_id, cur?.status, status))) {
        await db.from("leads").update({ status, last_message_at: new Date().toISOString() }).eq("id", session.lead_id)
      }
      await updateSession(session.call_sid, { stage: status === "closed_lost" ? "closing" : session.stage })
      return { type: "continue" }
    }

    case "transfer_to_human": {
      const { reason, summary } = tool.input as { reason: string; summary: string }
      await db.from("leads").update({ status: "needs_attention", last_message_at: new Date().toISOString() }).eq("id", session.lead_id)
      await updateSession(session.call_sid, { stage: "transferred", status: "transferred" })
      return { type: "transfer", reason, summary }
    }

    case "end_call": {
      const { reason } = tool.input as { reason: string }
      await updateSession(session.call_sid, { status: "completed" })
      // CRM hygiene: models often end "not interested" calls without calling
      // update_lead_status first — set it deterministically so the lead
      // doesn't sit in the pipeline as "new" forever.
      if (reason === "not_interested") {
        await db.from("leads")
          .update({ status: "closed_lost", last_message_at: new Date().toISOString() })
          .eq("id", session.lead_id)
          .in("status", ["new", "contacted", "nurturing"])
      }
      return { type: "end", reason }
    }

    default:
      return { type: "continue" }
  }
}

// ─── Lead context block ────────────────────────────────────────────────────────

function buildVoiceLeadContext(
  lead: Record<string, unknown>,
  appointments: Array<{ id: string; scheduled_at: string; status: string; address?: string | null; notes?: string | null }>,
  collected: Record<string, string>,
  timezone: string
): string {
  const now      = new Date()
  const past     = appointments.filter((a) => new Date(a.scheduled_at) < now)
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at) >= now && a.status === "scheduled")
  const isReturning = past.length > 0

  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", {
    timeZone: timezone, weekday: "long", month: "long", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit",
  })

  const nowFmt = now.toLocaleString("en-US", {
    timeZone: timezone, weekday: "long", month: "long", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit",
  })

  const _jobLabel = lead.job_type ? getJobTypeLabel(lead.job_type as string) : null

  const upcomingDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000)
    return `  +${i + 1}: ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: timezone })}`
  }).join("\n")

  let ctx = `=== LEAD FILE ===
Name: ${lead.first_name ?? ""} ${lead.last_name ?? ""}
Phone: ${lead.phone}
Service: ${lead.service_type ?? "HVAC"}
Customer type: ${isReturning ? "RETURNING — has history with this company" : "NEW LEAD"}
Current date/time: ${nowFmt}
Upcoming dates (use THESE exact dates — do NOT compute dates yourself):
${upcomingDays}`

  if (lead.status)      ctx += `\nCRM status: ${lead.status}`
  if (lead.source)      ctx += `\nLead source: ${lead.source}`
  if (lead.created_at)  ctx += `\nFirst came in: ${new Date(lead.created_at as string).toLocaleDateString("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric", year: "numeric" })}`
  if (lead.last_message_at) ctx += `\nLast contact: ${fmt(lead.last_message_at as string)}`
  if (_jobLabel)        ctx += `\nJob type: ${_jobLabel} (${lead.job_type})`
  if (lead.system_type) ctx += `\nSystem type: ${lead.system_type}`
  if (lead.system_age)  ctx += `\nSystem age: ${lead.system_age}`
  if (lead.address)     ctx += `\nAddress on file: ${lead.address}`
  if (lead.email)       ctx += `\nEmail: ${lead.email}`
  if (lead.notes)       ctx += `\nCRM notes: ${lead.notes}`

  if (Object.keys(collected).length > 0) {
    ctx += `\n\nCOLLECTED THIS CALL:`
    if (collected.callback_reason) ctx += `\n  Callback reason: ${collected.callback_reason}`
    if (collected.system_type)     ctx += `\n  System type: ${collected.system_type}`
    if (collected.issue)           ctx += `\n  Issue: ${collected.issue}`
    if (collected.age)             ctx += `\n  System age: ${collected.age}`
    if (collected.urgency)         ctx += `\n  Running? ${collected.urgency}`
    if (collected.ownership)       ctx += `\n  Ownership: ${collected.ownership}`
    if (collected.address)         ctx += `\n  Address: ${collected.address}`
  }

  if (past.length > 0) {
    ctx += `\n\nPAST APPOINTMENTS:`
    past.forEach((a) => {
      ctx += `\n  • ${fmt(a.scheduled_at)} — ${a.status}${a.notes ? ` | ${a.notes}` : ""}`
    })
  }

  if (upcoming.length > 0) {
    ctx += `\n\nUPCOMING APPOINTMENTS:`
    upcoming.forEach((a) => {
      ctx += `\n  • [ID: ${a.id}] ${fmt(a.scheduled_at)} — ${a.status}`
      if (a.address) ctx += ` at ${a.address}`
    })
    ctx += `\n(Use the [ID: ...] value for reschedule_appointment or cancel_appointment)`
  }

  ctx += "\n=== END LEAD FILE ==="
  return ctx.trim()
}
