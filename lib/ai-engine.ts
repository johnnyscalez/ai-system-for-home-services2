import { anthropic } from "@/lib/claude"
import { logUsage } from "@/lib/usage-log"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { kbValue } from "@/lib/kb-utils"
import { createCalendarEvent, getCalendarEvents } from "@/lib/google-calendar"
import { getConversationFlow } from "@/lib/conversation-flows"
import { getAvailableSlots, formatSlotsForPrompt, DEFAULT_WINDOWS, DEFAULT_DAYS } from "@/lib/availability"
import { getTwilioClient } from "@/lib/twilio"
import { selectTechnician, flagNoTechAvailable, findSlotsForLead, getTechnicianContextForCompany } from "@/lib/technician-booking"
import type { AppointmentWindow, PerDaySlots } from "@/lib/availability"
import { serviceCopy, HOLDING_REPLY, type ServiceCopy } from "@/lib/service-copy"
import { voiceEnabled } from "@/lib/voice-enabled"
import {
  buildQualificationBlock, parseRuntimeQuestions, leadAnswers, ensureRequiredAnswers,
  qualificationVerdict, missingRequired,
} from "@/lib/qualification"

// The voice engine builds its prompt from the same block.
export { buildQualificationBlock }

export type ConversationAction =
  | { type: "book_appointment"; scheduled_at: string; address?: string; notes?: string; quoted_total?: number; unit_count?: number; property_type?: string; outcome?: "created" | "moved" | "noop"
      /** Set when the lead said yes to a recap: their yes IS the intent, including a move. */
      consented?: boolean }
  | { type: "update_status"; status: "qualified" | "closed_lost" | "needs_attention" }
  | { type: "cancel_appointment"; appointment_id: string; reason?: string }
  | { type: "reschedule_appointment"; appointment_id: string; new_scheduled_at: string }
  | { type: "request_callback" }

export type EngineResult = {
  response: string
  action?: ConversationAction
  outboundConversationId?: string
  // Set when the agent intentionally stays silent (e.g. a Messenger duct lead
  // who refused the required upsell). Tells processAndSave NOT to regenerate a
  // fallback reply, and the channel send skips an empty response.
  silent?: boolean
}

const TOOLS: Parameters<typeof anthropic.messages.create>[0]["tools"] = [
  {
    name: "find_available_slots",
    description:
      "Look up the real open times for a visit at the lead's home, checked against the company calendar and service area. Call this only when the BOOKING GATE is satisfied: every REQUIRED qualifying question is answered and saved, AND you have a zip code or address. Having an address early does not mean qualification is done, so finish the required questions first. Never offer times without calling this first, and never invent times.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_type: {
          type: "string",
          description: "The specific job type. One of: lvp, laminate, hardwood, engineered_hardwood, carpet, tile, refinishing, stairs, whole_home, commercial_flooring, other",
        },
        zip_code: {
          type: "string",
          description: "5-digit zip code extracted from the lead's address. If you only have a city, pass what you know.",
        },
        preferred_date: {
          type: "string",
          description: "ONLY when the lead asked for a specific day ('Friday', 'next Tuesday', 'the 3rd'): that date as YYYY-MM-DD, taken from the Upcoming dates table in the lead file. Omit when they have no preference.",
        },
        preferred_time_of_day: {
          type: "string",
          enum: ["morning", "midday", "afternoon", "evening"],
          description: "ONLY when the lead asked for a part of the day. Omit otherwise.",
        },
      },
      required: [],
    },
  },
  {
    name: "book_appointment",
    description:
      "For visits to the home: call this ONLY after the lead replied YES to your booking recap (day, window, address). The recap consent is a mandatory step before this tool. You must also have every field the lead file's CHANNEL & CONTACT FILE block lists as REQUIRED BEFORE BOOKING, and every REQUIRED qualifying question answered. A home visit always needs the FULL street address (house number + street; a zip code alone is NOT an address), and the customer's full name for the booking (if the file marks the name as an unverified Facebook profile name, ask 'And what's your full name for the booking?' before the recap). The system refuses a booking that is missing any of these. For phone/video appointments no address exists or is needed. scheduled_at MUST be the exact ISO datetime string returned by find_available_slots for the slot the lead agreed to — copy it verbatim, character for character. NEVER compose, convert, or re-derive the datetime yourself: a hand-built datetime books the customer at the wrong hour. Call it ONCE: if the lead file already shows this appointment booked, acknowledge it instead of calling again — only call again when the lead explicitly asks for a DIFFERENT time.",
    input_schema: {
      type: "object" as const,
      properties: {
        scheduled_at: { type: "string", description: "ISO 8601 datetime e.g. 2024-06-15T14:00:00" },
        address: { type: "string", description: "Full street address of the home (street, city, state, zip). Required for any visit to the property. Omit only for phone/video appointments, which have no address. NEVER a bare zip code." },
        notes: { type: "string", description: "Short summary for whoever runs the visit: what the lead wants, which rooms and roughly how big, their timeline, who decides, and anything they should know before arriving" },
        quoted_total: { type: "number", description: "ONLY for companies that sell a fixed-price service and ONLY when the customer agreed to a specific total in this conversation. Omit for measures, estimates and quotes, where no price has been agreed. Never invent or estimate a number." },
        unit_count: { type: "number", description: "For fixed-price services only: how many units the agreed price covers. Omit otherwise." },
        property_type: { type: "string", description: "one of: house, townhome, condo, apartment" },
      },
      required: ["scheduled_at"],
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
      "Reschedule the lead's appointment to a new time slot. Use when the lead says they want to change their appointment time. ONLY offer times that came from find_available_slots in this conversation (or from the AVAILABLE BOOKING SLOTS list, if your prompt has one). Get their preferred slot, confirm it, then call this tool.",
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
      "Use IMMEDIATELY when the lead says 'call me', 'give me a call', 'can you call me', 'just call me', 'phone me', or anything clearly requesting a phone call. This triggers an outbound call to the lead right now. Rules: (1) Call this tool first, (2) send ONE message only — 'Calling you now!' — nothing else. Do NOT ask if the phone number is correct — you already have it in the lead file. Do NOT ask for their address before calling. Do NOT ask any more questions. Just confirm you're calling and stop. ONLY call this when a REAL phone number is on file (the lead file shows one, not a msgr:/fbform: placeholder). If there is no real number, ask for the best number to call FIRST — never announce a call you cannot place.",
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
        reason: { type: "string", description: "Only with needs_attention: what the person needs to do, in under 10 plain words, e.g. 'wants a call about the quote price' or 'upset about a missed visit'. The owner gets this in a text." },
      },
      required: ["status"],
    },
  },
  {
    name: "update_lead_details",
    description:
      "Save lead details to their file the MOMENT you learn them mid-conversation. Do not wait for booking. Call it as soon as the lead reveals or confirms: their name (first_name / last_name), their email, what the project is (job_type), an answer to a qualifying question (answers), their address or zip, or anything else meaningful (situation_notes). The CRM, the booking, and reports all read these fields, and it is how the company sees the lead's real situation even if they never book. NAME IS CRITICAL: the moment a lead tells you their name, save it here. A name written only into situation_notes does NOT reach the CRM, and the customer shows up as \"Unknown\". Calling this sends no message and costs nothing, so call it alongside your normal reply in the same turn. Only pass the fields you actually learned; never guess.",
    input_schema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string", description: "The lead's first name exactly as they gave it. Save it the moment you learn it." },
        last_name: { type: "string", description: "The lead's last name / surname, if they gave one. Never invent one." },
        email: { type: "string", description: "The lead's email address, if they give one." },
        timezone: { type: "string", description: "The lead's IANA timezone, the moment you learn where they are — 'America/Phoenix', 'America/Chicago', 'America/Los_Angeles', 'America/New_York', 'America/Denver'. Derive it from whatever they say: a state, a city, or a plain 'we're mountain time'. Save it BEFORE calling find_available_slots so every time you offer is already in their clock." },
        job_type: {
          type: "string",
          description: "One of: lvp, laminate, hardwood, engineered_hardwood, carpet, tile, refinishing, stairs, whole_home, commercial_flooring, other",
        },
        answers: {
          type: "array",
          description: "Answers to the company's QUALIFYING QUESTIONS, the moment the lead gives them. Use the key exactly as listed in your QUALIFICATION RULES block, and the answer in the lead's own words, kept short. Example: [{ key: 'project_size', answer: 'kitchen and living room, about 800 sq ft' }]. Required answers that are not saved here block the booking.",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "The question key from the QUALIFICATION RULES block" },
              answer: { type: "string", description: "What the lead said, short" },
            },
            required: ["key", "answer"],
          },
        },
        system_type: { type: "string", description: "What they have now, in plain words. For flooring: the floor that is down today, e.g. 'Old carpet', 'Worn hardwood', 'Builder-grade tile', 'Bare subfloor (new build)'" },
        system_age: { type: "string", description: "Rough size or age as stated, e.g. '1,200 sq ft, 3 rooms', 'floors are about 15 years old'" },
        address: { type: "string", description: "The FULL street address the moment the lead gives or corrects it: house number + street (+ city/state/zip when given). NEVER a bare zip code. A zip alone goes in the zip field. If the lead corrects an address already on file, save the NEW one here. The last confirmed address is the truth everywhere (CRM, the booking, confirmations)." },
        zip: { type: "string", description: "The lead's 5-digit ZIP code the moment they give it — its own field, separate from address. Save a bare zip HERE, never as the address." },
        unit_count: { type: "number", description: "For fixed-price services only: how many units the job covers, the moment the lead states or corrects it. The last confirmed number wins." },
        property_type: { type: "string", description: "house | townhome | condo | apartment | commercial — the moment they state or correct it." },
        situation_notes: { type: "string", description: "One short factual line of NEW information learned this turn that doesn't fit the fields above: what they want in their own words, urgency, pets or access notes, what they've already been quoted, who else decides. Appended to the lead's notes for the company. Facts only, no interpretation. Check the lead file's existing notes first and never re-save a fact that's already noted, even reworded." },
      },
      required: [],
    },
  },
]

/** Details the conversation can save onto the lead file. */
export type LeadDetailsInput = {
  first_name?: string; last_name?: string; email?: string; timezone?: string
  job_type?: string; system_type?: string; system_age?: string; situation_notes?: string
  address?: string; zip?: string; unit_count?: number; property_type?: string
  /** Answers to the company's qualifying questions, keyed as in ai_agent_config. */
  answers?: Array<{ key?: string; answer?: string }>
  /** True when the name came from the customer's own words this conversation —
   *  it verifies the record for booking (replaces a Facebook profile alias). */
  name_verified?: boolean
}

/**
 * Write conversation-learned details onto the lead — shared by the live SMS/
 * Messenger tool loop and the post-call voice extractor. Returns true when
 * anything was written.
 *
 * LAST CONFIRMED VALUE WINS, AND IT PROPAGATES: a corrected address updates
 * the scheduled appointment too; a job already mirrored into Housecall Pro
 * gets a manual-fix note + owner ping, because their API cannot edit a job
 * (live: Gina — the street arrived a minute after booking, the agent said
 * "got it", and nothing anywhere was updated).
 */
export async function saveLeadDetailsForLead(
  supabase: ReturnType<typeof createServiceRoleClient>,
  leadId: string,
  companyId: string,
  input: LeadDetailsInput
): Promise<boolean> {
  const patch: Record<string, unknown> = {}
  // Identity first (finding: the agent had no way to save a name, so names
  // lived only in notes and every HCP customer was created as "Unknown").
  // Never let the model overwrite a real name with junk or a placeholder.
  const cleanName = (v: string | undefined) => {
    const s = (v ?? "").trim().replace(/^[\s,.]+|[\s,.]+$/g, "")
    if (!s || s.length > 60) return null
    if (/^(unknown|n\/?a|none|null|customer|lead|there|sir|ma.?am)$/i.test(s)) return null
    return s
  }
  const first = cleanName(input.first_name)
  const last = cleanName(input.last_name)
  if (first) patch.first_name = first
  if (last) patch.last_name = last
  if (input.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) {
    patch.email = input.email.trim().toLowerCase()
  }
  // Only a real IANA zone — a bad string would silently render every
  // offered time in the wrong clock.
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone })
      patch.timezone = input.timezone
    } catch { /* not a valid zone — ignore rather than corrupt the record */ }
  }
  if (input.job_type) patch.job_type = input.job_type
  if (input.system_type) patch.system_type = input.system_type
  if (input.system_age) patch.system_age = input.system_age

  // Address: only a REAL street address may be stored — a bare zip would
  // recreate the exact failure this field exists to fix ("60706" as the
  // entire address on the booking, the HCP job, and the confirmation SMS).
  const { isCompleteServiceAddress, zipFromAddress } = await import("@/lib/routing")
  // ZIP is its own field, separate from the street address. A model saving a
  // zip never touches address; a full address also refreshes the zip.
  if (input.zip && /^\d{5}$/.test(input.zip.trim())) patch.zip = input.zip.trim()
  let addressChanged: string | null = null
  if (input.address) {
    let a = input.address.trim().replace(/\s{2,}/g, " ")
    if (isCompleteServiceAddress(a)) {
      const zipInAddr = zipFromAddress(a)
      if (!zipInAddr) {
        // Street without a zip: carry the zip we already know forward
        const { data: cur } = await supabase.from("leads").select("address, zip").eq("id", leadId).maybeSingle()
        const oldZip = (cur?.zip as string | null) ?? zipFromAddress(cur?.address as string | null)
        if (oldZip) a = `${a}, ${oldZip}`
      } else if (!patch.zip) {
        patch.zip = zipInAddr
      }
      patch.address = a
      addressChanged = a
    }
  }

  // Structured job-scope facts live in metadata — pricing reads them, so a
  // mid-conversation correction ("two furnaces… actually one") changes what
  // the booking is worth without any transcript archaeology.
  const metaPatch: Record<string, unknown> = {}
  if (typeof input.unit_count === "number" && Number.isFinite(input.unit_count)) {
    const n = Math.round(input.unit_count)
    if (n >= 1 && n <= 20) metaPatch.unit_count = n
  }
  if (input.property_type?.trim()) metaPatch.property_type = input.property_type.trim().toLowerCase()
  if (input.name_verified === true && (first || last)) {
    metaPatch.name_verified = true
    metaPatch.name_source = "customer_stated"
  }
  // Qualifying answers: merged key by key so a later answer never wipes an
  // earlier one, and only for keys with a real value.
  const answerPatch: Record<string, string> = {}
  for (const a of Array.isArray(input.answers) ? input.answers : []) {
    const key = (a?.key ?? "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    const val = (a?.answer ?? "").toString().trim().slice(0, 300)
    if (key && val) answerPatch[key] = val
  }
  if (Object.keys(metaPatch).length > 0 || Object.keys(answerPatch).length > 0) {
    const { data: cur } = await supabase.from("leads").select("metadata").eq("id", leadId).maybeSingle()
    const curMeta = (cur?.metadata as Record<string, unknown> | null) ?? {}
    const curAnswers = (curMeta.qualification && typeof curMeta.qualification === "object" ? curMeta.qualification : {}) as Record<string, unknown>
    patch.metadata = {
      ...curMeta,
      ...metaPatch,
      ...(Object.keys(answerPatch).length > 0 ? { qualification: { ...curAnswers, ...answerPatch } } : {}),
    }
  }

  if (input.situation_notes?.trim()) {
    // Append, never overwrite — notes accumulate across the conversation
    // so the office sees the full picture even if the lead never books.
    const { data: current } = await supabase.from("leads").select("notes").eq("id", leadId).single()
    patch.notes = current?.notes
      ? `${current.notes} | ${input.situation_notes.trim()}`
      : input.situation_notes.trim()
  }

  if (Object.keys(patch).length === 0) return false
  await supabase.from("leads").update(patch).eq("id", leadId)

  // Propagate a corrected address onto the active appointment — the lead
  // file and the job the tech drives to must never disagree.
  if (addressChanged) {
    const { data: apts } = await supabase
      .from("appointments")
      .select("id, address, hcp_job_id, notes")
      .eq("lead_id", leadId)
      .eq("status", "scheduled")
    for (const apt of apts ?? []) {
      if ((apt.address ?? "").trim() === addressChanged) continue
      const upd: Record<string, unknown> = { address: addressChanged }
      const pushed = !!apt.hcp_job_id && !String(apt.hcp_job_id).startsWith("pending:")
      if (pushed) {
        upd.notes = [apt.notes, `Service address corrected to "${addressChanged}" after the job reached Housecall Pro — update the job address there manually.`]
          .filter(Boolean).join(" | ")
      }
      await supabase.from("appointments").update(upd).eq("id", apt.id)
      if (pushed) {
        const { notifyNeedsAttention } = await import("@/lib/notifications")
        notifyNeedsAttention(companyId, "Address corrected after HCP push — fix the job address manually", "").catch(() => {})
      }
    }
  }
  return true
}

/**
 * Deterministic backstop for the Gina failure: an inbound message that IS a
 * street address, arriving while the lead's active appointment has no real
 * street on it, attaches itself — whether or not the model remembers to call
 * update_lead_details. Runs before the model turn so the lead file the model
 * reads is already correct.
 */
export async function attachStreetAddressIfMissing(
  supabase: ReturnType<typeof createServiceRoleClient>,
  leadId: string,
  companyId: string,
  inbound: string | null
): Promise<boolean> {
  if (!inbound) return false
  const t = inbound.trim().replace(/\s{2,}/g, " ")
  if (t.length < 6 || t.length > 120) return false
  const { isCompleteServiceAddress } = await import("@/lib/routing")
  if (!isCompleteServiceAddress(t)) return false
  // Ordinary sentences with numbers ("2 furnaces at 189") must not read as
  // addresses — require a street suffix or a PO Box.
  const streetish =
    /\b(ave|avenue|st|street|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|cir|circle|way|pl|place|ter|terrace|hwy|highway|pkwy|parkway|trl|trail)\b\.?/i.test(t) ||
    /\bp\.?\s*o\.?\s*box\s*\d+/i.test(t)
  if (!streetish) return false

  const [{ data: lead }, { data: apts }] = await Promise.all([
    supabase.from("leads").select("address").eq("id", leadId).maybeSingle(),
    supabase.from("appointments").select("id, address").eq("lead_id", leadId).eq("status", "scheduled"),
  ])
  const somethingNeedsIt =
    !isCompleteServiceAddress(lead?.address as string | null) ||
    (apts ?? []).some((a) => !isCompleteServiceAddress(a.address as string | null))
  if (!somethingNeedsIt) return false

  await saveLeadDetailsForLead(supabase, leadId, companyId, { address: t })
  console.log(`[ai-engine] street address auto-attached for lead ${leadId}: "${t.slice(0, 60)}"`)
  return true
}

/**
 * The qualification gate, shared by the slot-offer path and the booking path.
 * Returns null when every required answer is on file. Otherwise returns the
 * text to send instead: the missing question, or, after the same question has
 * been put to the lead twice by this gate with no answer, a handoff to a person
 * (the AI never books around a required answer, and never loops on one either).
 */
async function requiredAnswerHold(
  supabase: ReturnType<typeof createServiceRoleClient>,
  leadId: string,
  companyId: string,
  pendingInbound: string | null
): Promise<{ text: string; escalate: boolean; missingKeys: string[] } | null> {
  const gate = await ensureRequiredAnswers(supabase, leadId, companyId, pendingInbound)
  if (gate.missing.length === 0) return null
  const q = gate.missing[0]
  const { data: row } = await supabase.from("leads").select("metadata").eq("id", leadId).maybeSingle()
  const meta = ((row?.metadata ?? {}) as Record<string, unknown>) ?? {}
  const asks = ((meta.qualification_asks ?? {}) as Record<string, number>) ?? {}
  const asked = Number(asks[q.key] ?? 0) || 0
  const missingKeys = gate.missing.map((m) => m.key)
  if (asked >= 2) {
    return {
      text: "No problem. I'll have someone from our team reach out to get you scheduled.",
      escalate: true,
      missingKeys,
    }
  }
  await supabase.from("leads")
    .update({ metadata: { ...meta, qualification_asks: { ...asks, [q.key]: asked + 1 } } })
    .eq("id", leadId)
  return { text: q.question, escalate: false, missingKeys }
}

export async function runConversation(
  leadId: string,
  companyId: string,
  incomingMessage: string | null,
  followUpAngle?: string
): Promise<EngineResult> {
  const supabase = createServiceRoleClient()

  // Gina backstop first — if this inbound IS the missing street address, the
  // lead file must already show it by the time the model reads it.
  try {
    await attachStreetAddressIfMissing(supabase, leadId, companyId, incomingMessage)
  } catch (err) {
    console.error("[ai-engine] street auto-attach failed:", err)
  }

  const horizonMs = 14 * 24 * 60 * 60 * 1000

  // Load everything in parallel — lead history, agent config, availability, company schedule, technicians
  const [leadRes, historyRes, agentRes, kbRes, appointmentsRes, companyAptsRes, technicianContext, companyRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).single(),
    supabase
      .from("conversations")
      .select("direction, body, sent_by, created_at")
      .eq("lead_id", leadId)
      // All text channels — sms and messenger (legacy rows are null).
      // Filtering to sms-only made the AI amnesiac on messenger:
      // every inbound looked like a first contact and it re-greeted forever.
      .or("channel.is.null,channel.neq.voice")
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_agent_config")
      .select("generated_system_prompt, agent_name, working_hours_start, working_hours_end, timezone, available_days, appointment_windows, booking_horizon_days, max_appointments_per_day, per_day_slots, min_booking_lead_days, disqualifiers, qualifying_questions, messenger_instructions, min_bookable_price")
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
    supabase.from("companies").select("name, service_type").eq("id", companyId).single(),
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
      min_booking_lead_days: (agent?.min_booking_lead_days as number | null) ?? 0,
    },
    companyApts,
    googleBusyTimes
  )

  // Build rich lead context block — injected into every system prompt call
  // Fall back to the COMPANY's type: leads arriving by webhook rarely carry
  // one, and picking the wrong playbook is invisible until the agent says
  // something absurd for the business it represents.
  const effectiveServiceType =
    (lead.service_type as string | null) ?? (company?.service_type as string | null) ?? null
  const copy = serviceCopy(effectiveServiceType)
  const voiceOn = await voiceEnabled(companyId)
  const runtimeQuestions = parseRuntimeQuestions(agent?.qualifying_questions)
  const knownAnswers = leadAnswers(lead.metadata)
  const leadContext = buildLeadContext(lead, appointments, tz, effectiveServiceType, copy)

  // Build service-specific conversation flow playbook
  const conversationFlow = getConversationFlow(effectiveServiceType, lead.job_type as string | null)

  // Tools available for THIS conversation. For a sales call, "let's do a call"
  // is the booking intent, not a request to be dialled right now — leaving
  // request_callback in scope made the agent hang up on its own pitch.
  const isSalesConversation = effectiveServiceType === "fieldbuilt_sales"
  // request_callback places an AI phone call. With the voice agent off (the
  // default) the tool does not exist for the model: there is no call to place,
  // and a lead who asks for one is handed to a person instead (see PHONE CALLS).
  const activeTools = (isSalesConversation || !voiceOn)
    ? (TOOLS ?? []).filter((t) => (t as { name: string }).name !== "request_callback")
    : TOOLS

  // Format available slots block — AI offers ONLY these real times, never invents them
  // The company-wide list is a naive calendar (settings windows minus booked jobs): it knows
  // nothing about which technician can reach this lead's zip. On a company with technicians
  // every bookable time comes from find_available_slots, and the booking and reschedule guards
  // only accept those times, so showing the naive list can only mislead the model (live: Top Air
  // lead was told "Monday, October 5, 3 to 6pm", a window that existed only on that list, then
  // booked into the real Oct 24 opening). Companies without technicians keep the list.
  const { count: activeTechCount } = await supabase
    .from("technicians").select("id", { count: "exact", head: true })
    .eq("company_id", companyId).eq("status", "active")
  const slotsBlock = (activeTechCount ?? 0) > 0
    ? `=== BOOKABLE TIMES ===
You have no list of times in this prompt. The ONLY times you may offer, recap or book are the ones find_available_slots returned in this conversation (they are already checked against the calendar and the service area). Never state a day, date or window as available unless that tool returned it. Never infer a time from business hours, from "the next business day", or from anything the lead says. To offer or change to a different day, call find_available_slots again. For a reschedule, offer ONLY times from a find_available_slots result, then use reschedule_appointment.
=== END BOOKABLE TIMES ===`
    : formatSlotsForPrompt(availableSlots)

  // Build system prompt
  const baseSystemPrompt =
    agent?.generated_system_prompt ||
    buildFallbackSystemPrompt(
      agent?.agent_name ?? "the assistant",
      company?.name ?? "the company",
      kbValue(kb?.business_description) ?? "",
      kbValue(kb?.services_offered) ?? "",
      copy
    )

  // System prompt order:
  // 1. Who the agent is + business knowledge
  // 2. Trade conversation flow + stage rules
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
    : `=== FINANCING ===\nThis company has NOT given you any financing or payment-plan information. Never say or imply that financing, payment plans, or monthly payments are available. If asked, say you're not the one who handles payment details and the team goes over payment options at the ${copy.visit}.\n=== END FINANCING ===`

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
    if (copy.trade === "flooring") {
      // Flooring has no price to give by text: the quote exists only after the
      // measure. What the assistant MAY say is exactly two things the company
      // wrote down: what the measure costs, and the offer the ads are running.
      return [
        "=== PRICES, THE MEASURE AND THE OFFER: THE ONLY MONEY YOU MAY EVER DISCUSS ===",
        info
          ? "The company's own pricing and offer notes are below, word for word."
          : "This company has not given you any pricing or offer information.",
        ...(info ? ["--- COMPANY PRICING AND OFFER NOTES ---", info, "--- END NOTES ---"] : []),
        "HARD RULES, NO EXCEPTIONS:",
        "• Never quote a flooring price: no total, no price per square foot, no range, no \"starts at\", and never confirm or deny a number the lead floats. The exact quote comes from the team after the in-home measure, because it depends on the rooms, the subfloor and the product they pick. Say that, then move on.",
        "• THE MEASURE: if the notes have an IN-HOME MEASURE line, that is what the measure costs and you say exactly that. If there is no such line, do NOT say the measure is free and do NOT invent a fee: say the office confirms that when the visit is set.",
        "• THE OFFER: if the notes have a CURRENT ADVERTISED OFFER line, that is the offer this company picked for its ads and the lead most likely answered it. Bring it up yourself (first message, when offering times, in the booking confirmation), stated exactly as written with its conditions and end date. Never improve it, stack it, extend it, or promise it applies to this lead's project: say the team confirms what applies at the measure. With no such line, there is no offer and you never invent one.",
        "• Material prices, labor rates or past job prices anywhere in the notes are INTERNAL REFERENCE ONLY. Never state them.",
        "• Make ZERO assumptions beyond what is written above.",
        "=== END PRICES, THE MEASURE AND THE OFFER ===",
      ].join("\n")
    }
    return [
      "=== SERVICE CALL FEE POLICY — THE ONLY PRICES YOU MAY EVER DISCUSS ===",
      info
        ? "The company's raw pricing information is below. From it, the ONLY number you may ever state to a lead is the fee for the visit itself — whatever the company calls it: service call, service fee, trip charge, visit fee, diagnostic fee, dispatch fee, call-out fee, consultation, assessment, \"$X to come out\", or any similar wording. If that fee is waived or credited toward the work and the info says so, always say that too — it's your strongest line."
        : "This company has not provided any pricing information.",
      ...(info ? ["--- COMPANY PRICING INFO (raw, verbatim from the company) ---", info, "--- END COMPANY PRICING INFO ---"] : []),
      "HARD RULES, NO EXCEPTIONS:",
      "• Any job, repair, replacement, or install prices/ranges in the info above are INTERNAL REFERENCE ONLY — never state them, never hint at them, never confirm or deny a number the lead floats (\"is it more than $500?\" still gets no number). The exact, honest price is given on-site before any work happens.",
      "• If no visit/service-call fee appears above: do NOT assume the visit is free, and do NOT invent or estimate a fee. Say an exact price is given on-site before any work; if the lead pushes specifically on what the visit itself costs, say the office confirms that when the appointment is set — never a guess.",
      "• Never say \"free to come out\" or \"free estimate\" unless the info above explicitly says so (and if free applies only to estimates/replacements but not service calls, keep that distinction exact).",
      "• Make ZERO assumptions beyond what is written above. Raw information only.",
      "=== END SERVICE CALL FEE POLICY ===",
    ].join("\n")
  })()

  // With the voice agent off there is no AI phone call to offer. Tell the model
  // the truth so it does not promise one, and give it the honest alternative.
  const phoneCallsBlock = (!voiceOn && !isSalesConversation)
    ? `=== PHONE CALLS ===
You work by text only. You cannot place a phone call and you must never say you are calling, will call, or can call.
If the lead asks for a call or says they would rather talk: say plainly that you are the company's AI assistant working by text, that you will have someone from the team call them, then call update_lead_status with "needs_attention" so a person actually does. After that you may still answer their questions by text, but do not keep pushing questions on someone who asked for a call.
=== END PHONE CALLS ===`
    : ""

  // Static (no per-lead answers) so the cached prompt prefix is shared by every
  // lead of the company. Which answers THIS lead has given is in answersBlock,
  // in the dynamic tail.
  const qualificationBlock = buildQualificationBlock(agent?.disqualifiers ?? null, runtimeQuestions)
  const stillRequired = missingRequired(runtimeQuestions, {
    ...(lead.job_type ? { project_type: String(lead.job_type) } : {}),
    ...knownAnswers,
  })
  const answersBlock = runtimeQuestions.length > 0
    ? `=== THIS LEAD'S QUALIFYING ANSWERS ===
${runtimeQuestions.map((q) => {
  const a = knownAnswers[q.key] ?? (q.key === "project_type" && lead.job_type ? String(lead.job_type).replace(/_/g, " ") : "")
  return `- ${q.key}: ${a ? `ANSWERED, "${a}"` : q.required ? "NOT ANSWERED (required before booking)" : "not answered (optional)"}`
}).join("\n")}
${stillRequired.length > 0
  ? `You may not check availability or book until these are answered: ${stillRequired.map((q) => q.key).join(", ")}. Ask the next one now, unless the lead's last message already answers it (then save it).`
  : "Every required question is answered. Move to booking."}
=== END QUALIFYING ANSWERS ===`
    : ""

  const reasoningBlock = `=== BEFORE EVERY REPLY — SILENT REASONING (never show any of this to the lead) ===
You are not a script-follower. You are a sharp human rep who thinks before every message. Run through this, in order, every single turn:

1. PROJECT — What exactly does this lead want? If you can't name the project type yet, your next message asks it. The moment you learn it, call update_lead_details so it's saved to their file.
2. KNOWN — What has this lead already told me, anywhere? Re-read the lead file, their form answers and the whole conversation, including things they volunteered without being asked. Never re-ask any of it. Volunteered info counts as captured, and it must be SAVED (update_lead_details) to count for booking.
2b. NAME — Do I have this lead's name on file? If the lead file shows no name, getting it is part of the job: ask for it naturally early on ("Who am I speaking with?"), and when they give only a first name, ask for the last name once at booking time ("And your last name for the booking?"). The moment they tell you ANY part of their name, call update_lead_details with first_name (and last_name). Writing it into situation_notes does NOT save it. Never invent, guess, or infer a name, and never nag: ask for the surname once, and if they don't give it, book with the first name and move on. If the lead file marks the name as a FACEBOOK PROFILE NAME (not verified), it may be a nickname. Before the booking recap, ask "And what's your full name for the booking?", save the answer with update_lead_details, and put THAT name on the recap.
2c. CHANGED DETAILS — Did the lead just give a value that CONTRADICTS what's on file (a different address, email, phone, name, project)? Acknowledge both and confirm once: "I have [old] on file. Should I go with [new]?" The moment they confirm (or plainly assert the new value), call update_lead_details with it: the LAST CONFIRMED value is the truth everywhere. A correction acknowledged in words but never saved means the team drives to the OLD address.
2d. ADDRESS — A visit to the home needs a FULL street address (house number + street). A zip code alone is NOT an address: it tells us the area, not the door. If only a zip is on file when the lead picks a time, ask for the street address in the same breath ("What's the full street address?") and book once they give it and confirm the recap. The moment any full address appears, call update_lead_details with address.
3. GATE — Which REQUIRED qualifying questions are still unanswered for this lead? (THIS LEAD'S QUALIFYING ANSWERS lists them.) Count them one by one. One covered item does not check off the others. You may not check availability or book until that list is empty.
4. QUALIFIED? — Based on what I know: qualified (say so via update_lead_status and move toward booking), disqualified (handle it with respect, per the rules), or not enough information yet (keep going).
5. NEXT — What is the single most useful question or action right now, and why am I asking it? Every question should have a purpose you could explain: it qualifies them, it helps the team prepare for the visit, or it gets the visit on the calendar. If you can't say why you're asking, don't ask it.
6. SHAPE — When the lead just told you something about their project, one short clause of real acknowledgement, then the single question. And NO DEAD-END MESSAGES: every message either asks one question, offers times, or confirms a booking. Ending a viable conversation without asking for the booking is the #1 way reps lose winnable leads.
6b. PUSHBACK — When a lead challenges the price, the ads, or your honesty: one acknowledgment beat max, never validate an accusation, never apologize for an advertised offer. State the facts calmly. If they want a price by text, say why the quote comes after the measure (it depends on the rooms, the subfloor and the product they choose) and offer the visit. If they invoke a competitor, do not bash anyone. Banned surrender lines while they're still talking: "that's completely your call", "I understand if that doesn't work", "no worries if not". Every reply ends with forward motion; if they're truly done, one warm close that keeps the door open.

The feel to aim for: a person texting from the office who's genuinely paying attention. Curious about the specifics, remembers everything said, asks what the team would actually need to know before coming out, and never rushes a big purchase to a calendar after one exchange. Homeowners ghost when they feel interrogated, hear jargon, or get a fumbled price answer, and they book with whoever responds fastest and sounds most like a competent human who actually cares.
=== END SILENT REASONING ===`

  const smsHardRules = `=== SMS HARD RULES — THESE OVERRIDE EVERYTHING ABOVE ===

FORMATTING:
• Plain text only. NO markdown. No **bold**, no _italic_, no bullet points with *, no headers.
• Numbers and times in plain text: "tomorrow at 9am", not "**tomorrow at 9am**".
• NEVER use an asterisk. It renders literally and looks broken.
• NEVER use a dash as punctuation. No em dash, no en dash, no hyphen standing in for a comma or a pause. Dash-joined sentences are the clearest tell that a message was machine-written, and real people texting from an office almost never use them.
    ✗ "The measure is free — we check every room and the subfloor."
    ✓ "The measure is free. We check every room and the subfloor."
    ✗ "We have Friday morning (8–11am) or Monday afternoon — which works?"
    ✓ "We have Friday morning, 8 to 11am, or Monday afternoon. Which works better?"
  Write a second short sentence, or use a comma, or use "to" for a range. Hyphens INSIDE words ("single-family", "follow-up") and inside phone numbers are fine.
• Time ranges always use "to": "8 to 11am", "3 to 6pm". Never "8-11am".
• Keep messages SHORT. Aim under about 160 characters when it reads naturally. One idea per text, plain everyday words, zero trade jargon.
• Emoji: at most one, occasionally, only in a warm moment (a booking locked, a friendly nudge). Never in safety, price, or problem-description messages. When in doubt, none.

OPT-OUT — ABSOLUTE:
• Any message that reads as wanting out — "stop", "unsubscribe", "quit texting me", "leave me alone", "not interested, stop" — gets ONE polite goodbye at most, closed_lost status, and total silence after. No follow-ups, no sequences, no exceptions.

TONE — RELAXED, EVERYDAY, STILL PROFESSIONAL:
• Write the way a competent person at a local company actually texts: calm, easy, straightforward. Everyday words over polished ones ("we can come out and measure" beats "we would be delighted to schedule a consultation").
• Not bubbly and not salesy. You are not their friend and you are not a brochure. No "Awesome!", "Perfect!", "Amazing!", "So excited", "Fantastic". No hype, no exclamation stacking.
• At most ONE exclamation mark in an entire conversation, and usually none. A period is almost always the right ending.
• Contractions always: "we'll", "you're", "that's", "I'll". Never "we will", "you are".
• Say the useful thing and stop. No throat-clearing, no filler warmth, no restating what they just told you.

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
  ✗ "The quote comes after the measure." [full stop, and now you are silent waiting]
  ✓ "The quote comes after the measure, so the number is exact for your rooms. Which rooms are you looking to do?"
Exception: if the lead is venting frustration or describing a bad prior experience, lead with empathy first — that message is the acknowledgment. Ask the next question in your following message.

BOOKING FLOW:
• NEVER tell the lead they're booked ("you're on the schedule", "you're all set", "you're booked", "locked in") unless you are calling book_appointment in this exact turn or a booking already exists. The 30-minutes-before and day-before-reminder lines are POST-BOOKING language only. Saying any of it without a real booking means the appointment does not exist — the worst failure this system can produce.
• Lead picks a time → ask for the street address (if not on file) → send the BOOKING RECAP and ask for consent → they say yes → book in that same turn → THEN the confirmation.
• THE BOOKING RECAP (required before every visit booking): one short message with the day and date, the arrival window and the address, ending in a consent question. Shape: "Got you [first name]. Just to double check before I lock it in, [Day, Month D], [window], at [address]. Sounds good?" Only a clear yes triggers book_appointment. Never put a price in the recap unless the company sells a fixed-price service and the lead agreed to that price.
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
  ✗ "I want to make sure we have the right person, let me check"
Why: Every one of these implies you are about to go check something. But you already checked — the tool ran and the result is in front of you. Saying "let me check" after already checking is a lie. It makes you sound like a confused human, not a professional AI.
What to do instead: Tell the lead what the system found RIGHT NOW. If there are slots, offer them. If there are no slots, say so directly and tell them what happens next. Always answer with what you know, not with a promise to find out later.

=== END SMS HARD RULES ===`

  // Channel-specific override flow, injected ONLY for Messenger and ONLY when
  // the company has configured messenger_instructions (empty for everyone else,
  // so no other account changes). Placed LAST in the static prefix so it takes
  // precedence over the generic flow/pricing rules it is meant to override.
  const leadChannel = typeof (lead as Record<string, unknown>).channel === "string"
    ? (lead as Record<string, unknown>).channel as string : "sms"
  const messengerBlock = (leadChannel === "messenger" && kbValue(agent?.messenger_instructions))
    ? `=== MESSENGER CHANNEL FLOW — HIGHEST PRIORITY, OVERRIDES ANY CONFLICTING RULE ABOVE ===\n${agent!.messenger_instructions}\n=== END MESSENGER CHANNEL FLOW ===`
    : ""

  // The technician roster block names individual techs and tells the model to
  // share them. That is HVAC dispatch. For a flooring company the rows are
  // unnamed measure capacity ("Measure slot 1"), which must never reach a lead.
  const rosterBlock = copy.trade === "HVAC" ? technicianContext : ""
  const staticPrefix = [baseSystemPrompt, financingBlock, pricingPolicyBlock, customKnowledgeBlock, conversationFlow, qualificationBlock, phoneCallsBlock, rosterBlock, messengerBlock]
    .filter(Boolean)
    .join("\n\n")
  const dynamicTail = [slotsBlock, leadContext, answersBlock, reasoningBlock, smsHardRules]
    .filter(Boolean)
    .join("\n\n")
  // 1-hour TTL: SMS leads reply minutes to hours apart, so the 5-minute default mostly expired.
  // Used ONLY by calls that send the same `tools` array as the main call (they share its cache
  // entry). Calls without `tools` use systemPromptNoTools below.
  const systemPrompt: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral"; ttl?: "5m" | "1h" } }> = [
    { type: "text", text: staticPrefix, cache_control: { type: "ephemeral", ttl: "1h" } },
    { type: "text", text: dynamicTail },
  ]
  // Tools-less side calls (ask-zip, no-slots, fallback, catch-all, leak-rewrite, last-resort) have a
  // different cache prefix than the main call, so they can never read its entry. Keep them on the
  // default 5-minute TTL so they don't pay the 2x one-hour write price for a cache nobody reads.
  const systemPromptNoTools: typeof systemPrompt = [
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
- ALWAYS say who you are in the first message, honestly: your name, that you are the AI assistant, and the company. Shape: "Hey [FirstName], it's [AgentName], the AI assistant with [CompanyName]. ..." Use the agent name and company name from your identity in the system prompt. Never pose as a person.
- Feel personal, not mass-text. Do NOT start with "Hi!".
- If the lead file has form answers or notes, use the specific thing they asked about ("the LVP for your kitchen", not "your flooring project").
- End with ONE easy question that moves things forward: the first qualifying question that is not answered yet. If their form already answered the project type, ask the next unanswered one instead of asking what they already told you.
- If there are no notes or answers, ask what they're looking to do.
- Never say "I saw you reached out about [service category]". That sounds like a form letter.
- No price and no times in this message.
- If your PRICES block has a CURRENT ADVERTISED OFFER line, name that offer in a few words, exactly as written: it is what they answered ("...about the free in-home design consult"). Without that line, say nothing about offers or deals.
- Working hours rules do NOT apply here. Just write the message text.`,
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
    const quoteStage = lead.status === "quote_sent" || lead.status === "measure_done"
    messages.push({
      role: "user",
      content: quoteStage
        ? `Conversation so far:\n${convoLines}\n\nThe ${copy.visit} already happened and the quote is with this homeowner (see QUOTE STAGE in the lead file). You're sending a proactive follow-up on the quote. Write one short SMS, under 25 words. Don't repeat what you've already said, never state or discuss the price, and make it easy to answer.${angleInstruction}`
        : `Conversation so far:\n${convoLines}\n\nThe lead hasn't booked yet. You're sending a proactive follow-up, a natural, brief check-in. Write one short SMS, under 15 words. Don't repeat what you've already said. Be casual and human, not salesy or pushy.${angleInstruction}`,
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

  // ── RECAP CONSENT: a yes to the recap books, decided in code ───────────────
  // The visit flow ends with a recap ("Friday, November 27, 3 to 5pm, at 6412
  // Stonebrook Pkwy. Sounds good?") and the lead's yes. That yes must book (or
  // move) the visit. Left to the model, it did not, twice in the first flooring
  // simulation: once it asked for an email instead, once it re-checked
  // availability and then texted "Moved to Friday" without moving anything.
  // So when the last thing we sent was a recap (or a promise to book or move
  // right now) and the lead answers with a plain yes, the booking call is forced
  // here, before the model's turn, and nothing else can take its place.
  // Everything that protects a booking (the agreed-time contract, the address,
  // the name, the qualification gate) still runs in processAndSave.
  if (!isSalesConversation && incomingMessage && !isFollowUp) {
    const lastOutbound = [...history].reverse().find((m) => m.direction === "outbound")?.body ?? ""
    const namesTime = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(lastOutbound)
    const askedToConfirm =
      /\b(sounds good|does that work|work for you|is that right|all correct|shall i|should i|want me to|ok to)\b[^?]*\?/i.test(lastOutbound) &&
      /\b(lock (it|that|you) in|confirm|double check|book|move|switch|change|reschedul\w*)\b/i.test(lastOutbound)
    const promisedNow = /\b(moving|booking|locking|switching)\b[^.?!]*\b(now|right now|right away)\b/i.test(lastOutbound)
    const said = incomingMessage.trim().toLowerCase()
    const affirms =
      /^(yes|yea|yeah|yep|yup|ya|sure|ok|okay|k|correct|right|perfect|great|sounds good|sounds great|that works|works|works for me|looks good|good|go ahead|book it|do it|please do|lets do it|let's do it|confirmed|confirm)\b/.test(said) ||
      /\b(go ahead|book it|move it|lock it in|that works|works for me|sounds good|please do|do it)\b/.test(said)
    const objects = /\?|\b(but|actually|instead|different|another|earlier|later|not|n't|can we|could we|wait|wrong|cancel|hold off)\b/.test(said)
    const hasOfferedSlots =
      !!lead.selected_slots && Object.keys(lead.selected_slots as Record<string, unknown>).length > 0
    if (namesTime && (askedToConfirm || promisedNow) && affirms && !objects && hasOfferedSlots) {
      try {
        const slotList = Object.values(lead.selected_slots as Record<string, { iso?: string }>)
          .map((v) => v?.iso).filter(Boolean).sort()
        const forced = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 300,
          system: systemPrompt,
          tools: activeTools,
          tool_choice: { type: "tool", name: "book_appointment" },
          messages: [
            ...messages,
            {
              role: "user" as const,
              content:
                `SYSTEM: The lead just said yes to the time in your last message. Call book_appointment now for that time. ` +
                `The scheduled_at values you offered were: ${slotList.join(", ")}. Use the one your last message named, copied exactly. ` +
                `Pass the street address on file.`,
            },
          ],
        })
        logUsage({ site: "sms-recap-forced-book", companyId, leadId, model: "claude-sonnet-4-6", usage: forced.usage })
        const call = forced.content.find((b) => b.type === "tool_use" && b.name === "book_appointment")
        if (call && call.type === "tool_use") {
          const input = call.input as { scheduled_at: string; address?: string; notes?: string }
          const hadBooking = appointments.some((a) => a.status === "scheduled" && new Date(a.scheduled_at) > new Date())
          console.log(`[ai-engine] recap consent: ${hadBooking ? "moving" : "booking"} on a clear yes for lead ${leadId} (${input.scheduled_at})`)
          // Written in code: the confirmation text right after carries the day,
          // time and address, so this line states only what is certainly true.
          return {
            response: hadBooking
              ? `Done, it's moved. I'll text you the new details in a moment.`
              : `You're booked. I'll text the confirmation with the details in a moment.`,
            action: { type: "book_appointment", ...input, consented: true },
          }
        }
      } catch (err) {
        console.error("[ai-engine] recap consent booking failed, falling back to the normal turn:", err)
      }
    }
  }

  // Call Claude
  const claudeResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: systemPrompt,
    tools: activeTools,
    messages,
  })
  logUsage({ site: "sms-main", companyId, leadId, model: "claude-sonnet-4-6", usage: claudeResponse.usage })

  let responseText = ""
  let action: ConversationAction | undefined

  // Track find_available_slots tool call separately — it's a lookup, not an action
  let findSlotsToolId:    string | null = null
  let findSlotsJobType:   string | null = null
  let findSlotsZip:       string | null = null
  let findSlotsDate:      string | null = null
  let findSlotsPart:      string | null = null
  let detailsSaved = false

  // update_lead_details is a pure side-effect write, executed immediately —
  // deliberately NOT routed through the single `action` slot, so it can
  // never clobber (or be clobbered by) a booking/status action called in
  // the same turn.
  const saveLeadDetails = async (input: LeadDetailsInput) => {
    try {
      const wrote = await saveLeadDetailsForLead(supabase, leadId, companyId, input)
      if (wrote) detailsSaved = true
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
  const saveLeadStatus = async (status: string, reason?: string) => {
    const legacyMap: Record<string, string> = {
      qualified: "qualified",
      closed_lost: "lost",
      needs_attention: "needs_attention",
      returning_client: "contacted",
    }
    try {
      const next = legacyMap[status] ?? status
      // A booked lead must never slide back to a discovery-stage status just
      // because the model calls update_lead_status("qualified") on a
      // post-booking "thanks!" turn (observed live: booked lead showed
      // `qualified` in the CRM pipeline).
      const { statusDowngradeBlocked, aiMayNotOverwriteStatus } = await import("@/lib/sequences")
      const { data: cur } = await supabase.from("leads").select("status").eq("id", leadId).maybeSingle()
      if (aiMayNotOverwriteStatus(cur?.status, next)) {
        console.log(`[ai-engine] status write blocked: ${cur?.status} → ${next} for lead ${leadId} (signed or in the quote stage)`)
        return
      }
      if (await statusDowngradeBlocked(supabase, leadId, cur?.status, next)) {
        console.log(`[ai-engine] status downgrade blocked: ${cur?.status} → ${next} for lead ${leadId} (scheduled appointment exists)`)
        return
      }
      await supabase
        .from("leads")
        .update({ status: next, last_message_at: new Date().toISOString() })
        .eq("id", leadId)
      // The reason rides along to the owner's "Needs attention" text (lib/notifications.ts).
      if (next === "needs_attention" && typeof reason === "string" && reason.trim()) {
        const { markAttention } = await import("@/lib/attention")
        await markAttention(supabase, leadId, { reason: reason.trim().slice(0, 140) })
      }
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
        const inp = block.input as { job_type?: string; zip_code?: string; preferred_date?: string; preferred_time_of_day?: string }
        findSlotsJobType = inp.job_type ?? null
        findSlotsZip     = inp.zip_code ?? null
        findSlotsDate    = /^\d{4}-\d{2}-\d{2}$/.test(inp.preferred_date ?? "") ? inp.preferred_date! : null
        findSlotsPart    = inp.preferred_time_of_day ?? null
      } else if (block.name === "update_lead_details") {
        const detailsInput = { ...(block.input as LeadDetailsInput) }
        // A name counts as CUSTOMER-STATED (→ verified for booking) only when
        // it appears in the customer's own message this turn. Stops the model
        // from "verifying" the Facebook alias it already sees on the file.
        const claimedName = `${detailsInput.first_name ?? ""} ${detailsInput.last_name ?? ""}`.trim()
        if (claimedName && incomingMessage) {
          const inboundLower = incomingMessage.toLowerCase()
          const stated = claimedName
            .split(/\s+/)
            .some((w) => w.length >= 2 && inboundLower.includes(w.toLowerCase()))
          if (stated) detailsInput.name_verified = true
        }
        await saveLeadDetails(detailsInput)
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
        const input = block.input as { status: "qualified" | "closed_lost" | "needs_attention"; reason?: string }
        await saveLeadStatus(input.status, input.reason)
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
  // Extracted into a closure so the continuation path can re-enter it: a model
  // granted a turn after a details-save routinely spends that turn calling
  // find_available_slots (timezone/zip just landed — checking times IS the
  // right next move), and dropping that call shipped "Got it." as the reply.
  // One flow, every entry point — duplicating the lookup here would be the
  // playbook's class K (capability wired on one path only) inside one file.
  const runSlotsFlow = async (current: typeof claudeResponse): Promise<EngineResult> => {
    // Text bundled with a slots call is always "let me check…" narration —
    // the real SMS comes from the slot-offer exchange below. This reset also
    // covers re-entry, where the continuation turn may have left filler here.
    responseText = ""
    // A zip is REQUIRED before any slot is offered. Without one the candidate
    // pool ignores geography entirely — for a two-metro company that mixed
    // Chicago and Detroit techs in one list, and whatever the lead picked
    // locked in a tech 280 miles from them (audit C7).
    const zip5 = findSlotsZip?.match(/\d{5}/)?.[0] ?? null
    // Phone/video appointments have no service address — asking for one is
    // both nonsensical and a conversation-killer on a B2B sales call.
    const { data: travelCfg } = await supabase
      .from("ai_agent_config").select("requires_travel").eq("company_id", companyId).maybeSingle()
    const needsAddress = (travelCfg?.requires_travel as boolean | null) ?? true

    // ── THE QUALIFICATION GATE, at the earliest point it can bite ─────────────
    // The model asked for availability, which means it believes the lead is
    // qualified. Believing is not enough: every question the owner marked
    // "must answer before booking" has to be on the lead file. If one is
    // missing (after reading the form and the thread for answers the model
    // heard but did not save), no times are offered and the lead is asked
    // that question instead.
    if (needsAddress && !isSalesConversation) {
      const hold = await requiredAnswerHold(supabase, leadId, companyId, incomingMessage)
      if (hold) {
        console.log(`[ai-engine] availability held for lead ${leadId}, required answers missing: ${hold.missingKeys.join(", ")}${hold.escalate ? " (asked twice, handing to a person)" : ""}`)
        return {
          response: hold.text,
          action: hold.escalate ? { type: "update_status", status: "needs_attention" } : action,
        }
      }
    }

    if (!zip5 && needsAddress) {
      const askZipReply = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 120,
        system: systemPromptNoTools,
        messages: [
          ...messages,
          {
            role: "user" as const,
            content: `SYSTEM: You tried to check availability without a zip code. Availability depends on the service area, so you need the address (or at least the zip) FIRST. Write one short, natural SMS asking for the address of the home. Do not mention systems, tools, or zip codes as a requirement, just ask naturally ("What's the address we'd be coming out to?"). Plain text only.`,
          },
        ],
      })
      logUsage({ site: "sms-ask-zip", companyId, leadId, model: "claude-sonnet-4-6", usage: askZipReply.usage })
      for (const block of askZipReply.content) {
        if (block.type === "text") responseText = block.text.trim()
      }
      if (!responseText) responseText = "What's the address we'd be coming out to?"
      return { response: responseText, action }
    }
    // Read the zone FRESH. update_lead_details usually saves it in this very
    // turn ("seattle, pacific time" → America/Los_Angeles), but `lead` is a
    // snapshot taken before the tools ran, so trusting it left leadTz null on
    // the exact turn availability is first requested — which silently skipped
    // the GoHighLevel branch and fell through to the technician router,
    // answering a sales lead with slots off an entirely different calendar.
    const { data: tzFresh } = await supabase
      .from("leads").select("timezone").eq("id", leadId).maybeSingle()
    const leadTz =
      (tzFresh?.timezone as string | null) ??
      ((lead as Record<string, unknown>).timezone as string | null)

    // A company that books on its GoHighLevel calendar uses GHL's own
    // availability — it already reflects everything else in the owner's day.
    const ghlCal = await (async () => {
      try {
        const { getGhlCalendar } = await import("@/lib/ghl-calendar")
        return await getGhlCalendar(companyId)
      } catch { return null }
    })()

    let slotsResult: Awaited<ReturnType<typeof findSlotsForLead>>
    if (ghlCal && leadTz) {
      const { getGhlFreeSlots } = await import("@/lib/ghl-calendar")
      const ghlSlots = await getGhlFreeSlots(ghlCal, leadTz)
      slotsResult = ghlSlots.length > 0
        ? {
            found: true,
            slots: ghlSlots.map((sl) => ({
              label: sl.label,
              isoStart: sl.isoStart,
              isoEnd: sl.isoStart,
              techId: "",
              techName: "",
            })),
          }
        : { found: false, reason: "no_slots" }
    } else {
      // A requested day needs the search to reach it: ask for the whole horizon,
      // then put that day (and that part of the day) first. Without a preference
      // the eight earliest openings are plenty.
      slotsResult = await findSlotsForLead(companyId, findSlotsJobType, zip5, leadTz, leadId, findSlotsDate || findSlotsPart ? 60 : 8)
    }

    // ── The day the lead asked for ───────────────────────────────────────────
    let requestedNote = ""
    if (slotsResult.found && (findSlotsDate || findSlotsPart)) {
      const { zipToTimeZone } = await import("@/lib/timezones")
      const slotTz = leadTz || zipToTimeZone(zip5) || tz
      const localDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: slotTz })
      const localHour = (iso: string) => parseInt(new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", timeZone: slotTz }), 10)
      const partOf = (h: number) => (h < 11 ? "morning" : h < 14 ? "midday" : h < 17 ? "afternoon" : "evening")
      const all = slotsResult.slots
      const onDay = findSlotsDate ? all.filter((s) => localDate(s.isoStart) === findSlotsDate) : all
      const exact = findSlotsPart ? onDay.filter((s) => partOf(localHour(s.isoStart)) === findSlotsPart) : onDay
      const rest = (picked: typeof all) => all.filter((s) => !picked.includes(s))
      const dayLabel = findSlotsDate
        ? new Date(`${findSlotsDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
        : "that part of the day"
      let ordered: typeof all
      if (exact.length > 0) {
        ordered = [...exact, ...rest(exact)]
        requestedNote = `The lead asked for ${dayLabel}${findSlotsDate && findSlotsPart ? `, ${findSlotsPart}` : ""}. It IS open: the first ${exact.length === 1 ? "line" : `${Math.min(exact.length, 3)} lines`} below match what they asked for. Offer that first.\n`
      } else if (findSlotsDate && onDay.length > 0) {
        ordered = [...onDay, ...rest(onDay)]
        requestedNote = `The lead asked for ${dayLabel}, ${findSlotsPart}. That part of the day is taken, but other times on ${dayLabel} are open (the first lines below). Say so and offer those.\n`
      } else {
        // Nothing on the day: closest days first.
        const target = findSlotsDate ? Date.parse(`${findSlotsDate}T12:00:00Z`) : 0
        ordered = findSlotsDate
          ? [...all].sort((a, b) => Math.abs(Date.parse(a.isoStart) - target) - Math.abs(Date.parse(b.isoStart) - target))
          : all
        const { holidayOn } = await import("@/lib/holidays")
        const closedFor = findSlotsDate ? holidayOn(findSlotsDate) : null
        requestedNote = closedFor
          ? `The lead asked for ${dayLabel}. That is ${closedFor.name} and the company is closed that day. Say so in a few words and offer the closest times below.\n`
          : `The lead asked for ${dayLabel}${findSlotsPart ? `, ${findSlotsPart}` : ""}. Nothing is open then. Say that plainly and offer the closest times below.\n`
      }
      slotsResult = { found: true, slots: ordered.slice(0, 8) }
    }

    let toolResultText: string

    if (slotsResult.found && slotsResult.slots.length > 0) {
      // Save slot→tech map to the lead record (persists across turns so booking-time lookup works)
      const slotMap: Record<string, { tech_id: string; tech_name: string; iso?: string }> = {}
      for (const s of slotsResult.slots) {
        // Store the full ISO too: truncating to 16 chars drops the UTC offset,
        // and a naive "2026-08-05T08:00" then gets re-read in the COMPANY
        // timezone — which booked a Denver lead's 8am slot at 3pm their time.
        slotMap[s.isoStart.substring(0, 16)] = { tech_id: s.techId, tech_name: s.techName, iso: s.isoStart }
      }
      await supabase.from("leads").update({ selected_slots: slotMap }).eq("id", leadId)

      const slotLines = slotsResult.slots.slice(0, 5).map(s =>
        `• ${s.label} | scheduled_at for book_appointment: "${s.isoStart}"`
      ).join("\n")

      // The framing differs completely by appointment type: a visit sends a
      // technician to a house, a sales call sends nobody anywhere.
      toolResultText = isSalesConversation
        ? `Available times — ALREADY converted to this lead's own time zone:\n${slotLines}\n\n` +
          `Offer exactly 2 of these, worded exactly as written (the time zone stamp included). Never recalculate or re-label the hours.\n` +
          `CRITICAL: the time you SAY and the scheduled_at you BOOK must be the same slot. When they pick one, copy that line's scheduled_at verbatim into book_appointment and repeat that same label back in your confirmation. Saying one time while booking another is the worst failure this system can produce.\n` +
          `You do NOT need an email address to book — the link is texted. Book first; ask for an email afterwards if you want one.\n` +
          `THE MOMENT the lead picks one — "the first one", "2pm works", "yes to Wednesday" — call book_appointment in that SAME turn using the exact scheduled_at string. Do NOT ask for their email, a confirmation, or anything else before booking: a chosen time that isn't booked is a lost call. Ask for the email AFTER the booking is made, if at all.\n\n` +
          `IMPORTANT: You MUST include a plain-text SMS message in your response — never call a tool without also writing what you're sending.`
        : `${requestedNote}Open times for this lead's area:\n${slotLines}\n\n` +
          `Offer exactly 2 of these, in one short message, as the ${copy.visit}. One short clause of context is fine ("${copy.crew} comes out, measures the rooms and goes over your options"). Use "to" for the window ("9 to 11am").\n\n` +
          `Never name a person and never say who is coming. Say "${copy.crew}".\n` +
          `When the lead picks a time, do NOT book yet. First collect the full street address if it's missing. Then send the BOOKING RECAP (day and date, window, address) ending with a consent question ("Sounds good?"). ONLY after they reply with a clear yes do you call book_appointment with that slot's exact scheduled_at string. If they hesitate or want a change, adjust first. Never say "you're all set" until the booking call succeeds.\n\n` +
          `IMPORTANT: You MUST include a plain-text SMS message in your response — do not call any tool without also outputting the text you are sending to the lead.`
    } else {
      // No slots available — take over immediately with a direct, honest reply.
      // Do NOT go through the tool-result chain: an unresolved tool call in the
      // message history confuses the fallback, and the global catch-all has no
      // slot context so Claude invents times from the system prompt. Instead,
      // make one clean call with explicit "no slots, here's why" context.
      const reasonLabels: Record<string, string> = {
        no_technicians:          "the visit calendar has not been set up yet",
        no_specialization_match: "nobody on the team handles this type of work",
        no_zip_match:            "this zip code is outside our current service area",
        no_slots:                "the calendar is fully booked for the next few days",
        job_not_offered:         "this is not a service the company offers",
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
            .update({ metadata: { ...existingMeta, service_zip: findSlotsZip }, zip: findSlotsZip.match(/\d{5}/)?.[0] ?? undefined })
            .eq("id", leadId)
        } catch { /* non-critical */ }
      }

      // Build a reason-specific honest message. The key rule: you already checked
      // right now — never say "let me check" or "I'll follow up to look into this."
      // Those phrases imply future checking that won't happen. Be direct about what
      // the system found (or didn't find) and what happens next.
      const noSlotsContext = slotsResult.found === false ? {
        job_not_offered:
          `You just checked and this is NOT a service the company offers at all (not an availability or area issue). ` +
          `Say warmly and honestly: that's not something we handle, and you hope they find the right person for it. ` +
          `Do NOT offer an appointment, do NOT say "let me check", and do NOT promise a callback to do the work. Keep it brief and kind.`,
        no_zip_match:
          `You just checked in real time and found that zip code ${findSlotsZip ?? "provided"} is outside the current service area. ` +
          `Say: we checked and unfortunately that area is a bit outside where we currently operate, but our team will personally reach out within 24 hours to see if we can make it work. ` +
          `Do NOT say "let me check" or "I'll look into it" — you already checked. Be warm, direct, and honest.`,
        no_specialization_match:
          `You just checked in real time and found nobody on the team who handles this specific type of work in this area. ` +
          `Say: we checked and can't take that one on the calendar directly, but your details have been passed to our team, who will reach out within 24 hours with options. ` +
          `Do NOT say "let me check" — you already checked.`,
        no_technicians:
          `You just checked in real time and the visit calendar is not open for booking yet. ` +
          `Say: you've been flagged as a priority and someone from our team will reach out within 24 hours to get you scheduled. ` +
          `Do NOT say "let me check" — you already checked.`,
        no_slots:
          `You just checked in real time and the calendar is fully booked for the next several days. ` +
          `Say: we're fully booked right now, but your name is at the top of the list and our team will reach out within 24 hours the moment a slot opens. ` +
          `Do NOT say "let me check" — you already checked.`,
      }[slotsResult.reason] ?? `You already checked and found no availability (${why}). Be honest and direct about this. Do NOT say "let me check" or imply future checking.`
      : `You already checked and found no availability (${why}). Be direct about this.`

      const noSlotsReply = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        system: systemPromptNoTools,
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
      logUsage({ site: "sms-no-slots", companyId, leadId, model: "claude-sonnet-4-6", usage: noSlotsReply.usage })
      for (const block of noSlotsReply.content) {
        if (block.type === "text") responseText = block.text.trim()
      }
      if (!responseText) {
        responseText = slotsResult.found === false && slotsResult.reason === "no_zip_match"
          ? "We checked and that area is just outside where we currently work. Our team will reach out within 24 hours to see if we can make it work."
          : "We checked and the calendar is full right now. Our team will reach out within 24 hours as soon as a time opens up."
      }
      // A service we don't offer is a clean decline (closed_lost); everything
      // else (area, capacity, setup) is a human-follow-up flag.
      action = slotsResult.found === false && slotsResult.reason === "job_not_offered"
        ? { type: "update_status", status: "closed_lost" }
        : { type: "update_status", status: "needs_attention" }
      // The owner's needs-attention text says why: the home is outside the area.
      if (slotsResult.found === false && slotsResult.reason === "no_zip_match") {
        try {
          const { markAttention } = await import("@/lib/attention")
          await markAttention(supabase, leadId, { reason: "out_of_area" })
        } catch (err) {
          console.error("[ai-engine] could not mark the out-of-area hand-off:", err)
        }
      }
      return { response: responseText, action }
    }

    // Get Claude's slot-offering reply (reached only when slotsResult.found === true)
    // Provide tool_results for EVERY tool_use in the response (Claude sometimes calls
    // update_lead_status alongside find_available_slots in the same turn — every tool_use
    // must have a corresponding tool_result or the API returns a 400).
    const slotToolResults = (current.content as Array<{ type: string; id?: string; name?: string }>)
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
      { role: "assistant" as const, content: current.content },
      { role: "user" as const, content: slotToolResults },
    ]

    const slotReply = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: systemPrompt,
      tools: activeTools,
      messages: slotMessages,
    })
    logUsage({ site: "sms-slot-reply", companyId, leadId, model: "claude-sonnet-4-6", usage: slotReply.usage })

    for (const block of slotReply.content) {
      if (block.type === "text") responseText = block.text.trim()
      else if (block.type === "tool_use") {
        if (block.name === "update_lead_status") {
          const input = block.input as { status: "qualified" | "closed_lost" | "needs_attention"; reason?: string }
          await saveLeadStatus(input.status, input.reason)
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
        system: systemPromptNoTools,
        messages: fallbackMessages,
      })
      logUsage({ site: "sms-fallback", companyId, leadId, model: "claude-sonnet-4-6", usage: fallbackReply.usage })
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
          ? `You're booked for ${day} at ${a.address}. You'll get a reminder before the ${copy.visitShort}.`
          : `You're booked for ${day}. You'll get a reminder before the ${copy.visitShort}.`
      } else {
        try {
          const lastResort = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 100,
            system: systemPromptNoTools,
            messages: [
              ...messages,
              { role: "user" as const, content: "Reply to this lead now with 1-2 sentences. Plain text only. No tool calls." },
            ],
          })
          logUsage({ site: "sms-last-resort", companyId, leadId, model: "claude-haiku-4-5-20251001", usage: lastResort.usage })
          for (const b of lastResort.content) {
            if (b.type === "text") responseText = b.text.trim()
          }
        } catch { /* ignore */ }
        // Still nothing: leave it empty. processAndSave sends the holding
        // reply and hands the lead to a person, which is the honest outcome.
      }
    }

    // Strip meta-commentary for initial outreach (same as below)
    if (isInitialOutreach && responseText) {
      const firstLine = responseText.split("\n").find(l => l.trim().length > 0 && !l.startsWith("Note:") && !l.startsWith("**")) ?? responseText
      responseText = firstLine.replace(/^---+\s*/, "").replace(/\s*---+$/, "").trim()
    }

    return { response: responseText, action }
  }

  if (findSlotsToolId) return await runSlotsFlow(claudeResponse)

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
  //
  // BARE-ACK TURNS COUNT AS NO REPLY (the Chef-Dan incident, Aug 2026). A model
  // whose main act is a tool call writes token filler alongside it — "Got it,
  // two furnaces." — because it expects the tool result and another turn, like
  // any tool loop grants. This path only granted that turn when the text was
  // completely EMPTY, so the filler shipped as the entire SMS and a hot lead
  // who'd answered every question in 90 seconds sat overnight, one message
  // short of the per-furnace price quote. Filler has a recognizable shape:
  // short, no question, no price, no digits — nothing that moves anything.
  // Only side-effect turns (details/status) are re-run: booking, cancel,
  // reschedule and callback turns own their accompanying text, and re-rolling
  // a booking confirmation risks double-booking language.
  const sideEffectTurnOnly =
    !findSlotsToolId &&
    (detailsSaved || action?.type === "update_status") &&
    !["book_appointment", "cancel_appointment", "reschedule_appointment", "request_callback"]
      .includes(action?.type ?? "")
  const bareAck =
    !!responseText && responseText.length < 90 && !/[?$\d]/.test(responseText)
  if ((action || detailsSaved) && (!responseText || (bareAck && sideEffectTurnOnly))) {
    const actionToolResults = (claudeResponse.content as Array<{ type: string; id?: string; name?: string }>)
      .filter(b => b.type === "tool_use")
      .map(b => ({
        type: "tool_result" as const,
        tool_use_id: b.id!,
        content: b.name === "update_lead_details"
          ? "Details saved to the lead file. Now send the lead your next SMS — it MUST move the conversation forward: your next unanswered gate question, the exact price their answers now call for, or a slot offer. Never a bare acknowledgment like 'Perfect.' or 'Got it.' Only exception: if the conversation is naturally closed (appointment booked and confirmed, or the lead said goodbye), a short warm close is fine."
          : b.name === "update_lead_status"
          ? "Status updated. Now send the lead your next SMS — it MUST move the conversation forward: your next unanswered gate question, the exact price their answers now call for, or a slot offer. Never a bare acknowledgment. Only exception: if the conversation is naturally closed (appointment booked and confirmed, or the lead said goodbye), a short warm close is fine."
          : action?.type === "cancel_appointment"
          ? "Appointment cancelled. Send a brief, warm confirmation to the lead that it's been cancelled."
          : action?.type === "reschedule_appointment"
          ? "Appointment rescheduled. Confirm the new date and time to the lead in a short, friendly text."
          : action?.type === "request_callback"
          ? "Call initiated. Send exactly this message and nothing else: 'Calling you now!' Do NOT ask any more questions."
          : `Booked. Confirm to the lead in one short message with the day, the window and the address, and say they'll get a reminder before the ${copy.visitShort}. Never name who is coming.`,
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
      tools: activeTools,
      messages: toolResultMessages,
    })
    logUsage({ site: "sms-tool-followup", companyId, leadId, model: "claude-sonnet-4-6", usage: followUp.usage })

    // The granted turn is a REAL turn — every tool the model calls on it must
    // execute, exactly as it would on a first response. Reading only the text
    // here was the second layer of the Chef-Dan class: the continuation fired,
    // the model correctly spent its turn calling find_available_slots (the
    // timezone/zip it just saved makes checking times the natural next move),
    // the call was silently dropped, and "Got it." shipped anyway.
    for (const block of followUp.content) {
      if (block.type === "text") {
        responseText = block.text.trim()
      } else if (block.type === "tool_use") {
        if (block.name === "find_available_slots") {
          findSlotsToolId = block.id
          const inp = block.input as { job_type?: string; zip_code?: string; preferred_date?: string; preferred_time_of_day?: string }
          findSlotsJobType = inp.job_type ?? null
          findSlotsZip     = inp.zip_code ?? null
          findSlotsDate    = /^\d{4}-\d{2}-\d{2}$/.test(inp.preferred_date ?? "") ? inp.preferred_date! : null
          findSlotsPart    = inp.preferred_time_of_day ?? null
        } else if (block.name === "update_lead_details") {
          await saveLeadDetails(block.input as LeadDetailsInput)
        } else if (block.name === "update_lead_status") {
          const input = block.input as { status: "qualified" | "closed_lost" | "needs_attention"; reason?: string }
          await saveLeadStatus(input.status, input.reason)
          if (!action) action = { type: "update_status", status: input.status }
        } else if (block.name === "book_appointment") {
          const input = block.input as { scheduled_at: string; address?: string; notes?: string }
          action = { type: "book_appointment", ...input }
        }
      }
    }

    // Availability requested on the granted turn → run the full slots flow on
    // it (lookup, slot→tech map, offer text). Same flow as a first-response
    // call — one implementation, every entry point.
    if (findSlotsToolId) return await runSlotsFlow(followUp)

    // If follow-up returned only another tool call (no text), generate a minimal fallback
    // so the conversation history stays valid and the lead gets a response.
    if (!responseText && action?.type === "book_appointment") {
      const a = action as { type: "book_appointment"; scheduled_at: string; address?: string }
      const day = new Date(a.scheduled_at).toLocaleDateString("en-US", {
        weekday: "long", month: "short", day: "numeric", timeZone: tz,
      })
      responseText = a.address
        ? `You're booked for ${day} at ${a.address}. You'll get a reminder before the ${copy.visitShort}.`
        : `You're booked for ${day}. You'll get a reminder before the ${copy.visitShort}.`
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
        system: systemPromptNoTools,
        messages: [
          ...messages,
          {
            role: "user" as const,
            content: "You have not sent a reply yet. Write a short SMS response to the lead now. Plain text only.",
          },
        ],
      })
      logUsage({ site: "sms-catch-all", companyId, leadId, model: "claude-sonnet-4-6", usage: catchAllReply.usage })
      for (const block of catchAllReply.content) {
        if (block.type === "text") responseText = block.text.trim()
      }
    } catch {
      // Leave it empty: processAndSave sends the holding reply and flags the lead.
    }
  }

  // ── Invented-times guard (sales conversations only) ───────────────────────
  // Offering a time that does not exist costs as much as booking the wrong
  // one: the lead picks it, and the agent either books something else or has
  // to retract it ("I don't have 2:30 today"). Observed live — the model wrote
  // "today at 2:30 PM MT or Wednesday at 9:00 AM MT" having never called
  // find_available_slots, and on another run booked 1pm after saying 9am.
  // Instructions in the tool result did not stop it, because the failure is
  // that the tool is never called at all. So every clock time in an outgoing
  // sales message is checked against real availability before it can ship.
  if (isSalesConversation && !action && responseText) {
    const named = clockTimesIn(responseText)
    if (named.length > 0) {
      // Read the zone FRESH. update_lead_details usually saves it in this very
    // turn ("seattle, pacific time" → America/Los_Angeles), but `lead` is a
    // snapshot taken before the tools ran, so trusting it left leadTz null on
    // the exact turn availability is first requested — which silently skipped
    // the GoHighLevel branch and fell through to the technician router,
    // answering a sales lead with slots off an entirely different calendar.
    const { data: tzFresh } = await supabase
      .from("leads").select("timezone").eq("id", leadId).maybeSingle()
    const leadTz =
      (tzFresh?.timezone as string | null) ??
      ((lead as Record<string, unknown>).timezone as string | null)
      const { data: fresh } = await supabase
        .from("leads").select("selected_slots").eq("id", leadId).maybeSingle()
      const slotMap = (fresh?.selected_slots ?? {}) as Record<string, { iso?: string }>
      const realClocks = new Set(
        leadTz
          ? (Object.values(slotMap).map((v) => v?.iso).filter(Boolean) as string[])
              .map((iso) => slotClockLabel(iso, leadTz))
          : []
      )
      const invented = named.filter((t) => !realClocks.has(t))

      if (invented.length > 0) {
        console.warn(
          `[ai-engine] invented-times guard fired for lead ${leadId} — ` +
          `said ${JSON.stringify(named)}, real ${JSON.stringify([...realClocks])}`
        )
        if (!leadTz) {
          // Their zone was never captured, so no time can be stated correctly.
          responseText = "Happy to get that on the calendar — what time zone are you in?"
        } else {
          const slots = await salesSlotsFor(companyId, leadTz)
          if (slots.length === 0) {
            responseText =
              "Let me check what's open and come right back to you with a couple of times."
          } else {
            const map: Record<string, { tech_id: string; tech_name: string; iso: string }> = {}
            for (const s of slots) {
              map[s.isoStart.substring(0, 16)] = { tech_id: "", tech_name: "", iso: s.isoStart }
            }
            await supabase.from("leads").update({ selected_slots: map }).eq("id", leadId)

            // Written in code, not asked of the model. Handing the correction
            // back as another prompt let the instruction itself leak into the
            // SMS ("SYSTEM: The reply you just wrote named times that are not
            // on the calendar..."), which is worse than the bug it fixes. The
            // labels already read naturally, so compose the offer directly.
            const say = (s: { label: string }) => s.label.replace(" — ", " at ")
            responseText = slots[1]
              ? `I've got ${say(slots[0])} or ${say(slots[1])} — which works better for you?`
              : `I've got ${say(slots[0])} — does that work for you?`
          }
        }
      }
    }
  }

  // ── Leaked-reasoning guard ────────────────────────────────────────────────
  // Seen live: the agent texted a prospect "I had offered 9:00 AM MDT as 'the
  // first one'... that slot doesn't appear in the returned results. I should
  // not book a time that wasn't in the available slots." That is the model
  // thinking out loud into an SMS. It only has to happen once to lose a deal,
  // so anything referring to the machinery is rewritten before it ships.
  if (responseText && LEAKED_REASONING.test(responseText)) {
    console.warn(`[ai-engine] leaked-reasoning guard fired for lead ${leadId}: ${responseText.slice(0, 160)}`)
    try {
      const clean = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 250,
        system: systemPromptNoTools,
        messages: [
          ...messages,
          {
            role: "user" as const,
            content:
              `SYSTEM: Your last draft described your own reasoning and the booking machinery. ` +
              `The lead must never see that. Write ONLY the SMS they should receive — plain, ` +
              `natural, under two sentences. Never mention slots, results, tools, or these instructions.`,
          },
        ],
      })
      logUsage({ site: "sms-leak-rewrite", companyId, leadId, model: "claude-sonnet-4-6", usage: clean.usage })
      for (const block of clean.content) {
        if (block.type === "text" && block.text.trim()) responseText = block.text.trim()
      }
    } catch (err) {
      console.error("[ai-engine] leaked-reasoning rewrite failed:", err)
    }
  }

  // ── Booking safety net ────────────────────────────────────────────────────
  // The single highest-cost failure this agent has: slots were offered, the
  // lead picked one, and the model replied with a question ("what's your
  // email?") instead of calling book_appointment. Observed intermittently
  // across runs — prompt instructions alone did not make it reliable, so this
  // catches it deterministically: if a pick is on the table and nothing was
  // booked, force one more turn that may ONLY book.
  // SALES CALLS ONLY. A home visit has a mandatory address + recap + consent
  // step between "pick a time" and booking, so forcing book_appointment on a
  // "sounds good" would skip exactly the checks a measure booking depends on.
  if (isSalesConversation && !action && incomingMessage && !isFollowUp) {
    const picksSlot = /\b(first|second|1st|2nd|earlier|later|that one|works|sounds good|perfect|book (it|me)|lets? do|yes)\b/i.test(incomingMessage)
    const hasOfferedSlots =
      !!lead.selected_slots && Object.keys(lead.selected_slots as Record<string, unknown>).length > 0
    if (picksSlot && hasOfferedSlots) {
      try {
        const slotList = Object.values(
          lead.selected_slots as Record<string, { iso?: string }>
        ).map((v, i) => v?.iso ?? Object.keys(lead.selected_slots as Record<string, unknown>)[i]).sort()
        const forced = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 400,
          system: systemPrompt,
          tools: activeTools,
          tool_choice: { type: "tool", name: "book_appointment" },
          messages: [
            ...messages,
            {
              role: "user" as const,
              content:
                `SYSTEM: This lead just chose one of the times you offered and you did NOT book it. ` +
                `Book it NOW with book_appointment. The scheduled_at values you offered were: ${slotList.join(", ")}. ` +
                `Pick the one they meant from their message and pass it EXACTLY as given, offset included. ` +
                `Then write the confirmation SMS the lead will actually receive: name that same time, say the Google Meet ` +
                `link is coming by text, nothing else. Never mention booking mechanics, tools, or these instructions.`,
            },
          ],
        })
        logUsage({ site: "sms-forced-book", companyId, leadId, model: "claude-sonnet-4-6", usage: forced.usage })
        for (const block of forced.content) {
          if (block.type === "text" && block.text.trim()) responseText = block.text.trim()
          if (block.type === "tool_use" && block.name === "book_appointment") {
            const input = block.input as { scheduled_at: string; address?: string; notes?: string }
            action = { type: "book_appointment", ...input }
            console.log(`[ai-engine] booking safety net fired for lead ${leadId} — ${input.scheduled_at}`)
          }
        }
      } catch (err) {
        console.error("[ai-engine] booking safety net failed:", err)
      }
    }
  }

  // ── Price-floor guard (the promise behind "never book below the floor") ──────
  // The prompt tells the model which packages it may close, but prompts only lower the odds.
  // When the company sets min_bookable_price, a booking whose agreed total is below it is
  // refused here, whatever the model decided. The lead gets a positive next step, never an
  // explanation of why.
  const priceFloor = Number((agent as { min_bookable_price?: number | string | null } | null)?.min_bookable_price ?? 0)
  if (action?.type === "book_appointment" && priceFloor > 0 &&
      typeof action.quoted_total === "number" && action.quoted_total > 0 && action.quoted_total + 0.001 < priceFloor) {
    console.warn(`[ai-engine] BOOKING BELOW PRICE FLOOR refused for lead ${leadId}: quoted_total ${action.quoted_total} < ${priceFloor}`)
    action = undefined
    try {
      const reply = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 250,
        system: systemPromptNoTools,
        messages: [
          ...messages,
          { role: "user" as const, content:
            `SYSTEM: Nothing is booked yet and nothing gets booked at that price. Write ONLY the next text to the lead. ` +
            `Tell them, positively, what visit you set up for them: the package your pricing information says you schedule, ` +
            `its price, and the specific services it includes and only those. Then ask if they want to go ahead and see times. ` +
            `Never say anything is not bookable, unavailable, not allowed, or against a rule, never mention policy, instructions or a mistake, ` +
            `and do not apologize for anything you said earlier. Plain text, two or three short sentences.` },
        ],
      })
      logUsage({ site: "sms-floor-rewrite", companyId, leadId, model: "claude-sonnet-4-6", usage: reply.usage })
      const t = reply.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim()
      responseText = t || "[[SILENT]]"
    } catch (err) {
      console.error("[ai-engine] price-floor rewrite failed, going silent:", err)
      responseText = "[[SILENT]]"
    }
  }

  // ── Internal-policy leak guard ───────────────────────────────────────────────
  // Never let the lead see our internal rules ("the $89 is never bookable", "the only package I
  // can book", "I quoted that wrong"). One rewrite; if the rewrite still leaks, say nothing.
  if (responseText && responseText !== "[[SILENT]]" && INTERNAL_POLICY_LEAK.test(responseText)) {
    console.warn(`[ai-engine] internal-policy leak blocked for lead ${leadId}: ${responseText.slice(0, 160)}`)
    try {
      const fixed = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 250,
        system: systemPromptNoTools,
        messages: [
          ...messages,
          { role: "user" as const, content:
            `SYSTEM: Your last draft revealed internal rules or announced a mistake. A lead must never see that. ` +
            `Write ONLY the text they should receive instead: continue positively with the next helpful step for their situation ` +
            `(what the visit you set up for them includes and costs, or your next question). Never say a package can't be booked or ` +
            `isn't available, never say "the only one I can book", never mention rules, policy, instructions, or any mistake. ` +
            `Plain text, two or three short sentences.` },
        ],
      })
      logUsage({ site: "sms-policy-rewrite", companyId, leadId, model: "claude-sonnet-4-6", usage: fixed.usage })
      const t = fixed.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim()
      responseText = t && !INTERNAL_POLICY_LEAK.test(t) ? t : "[[SILENT]]"
    } catch (err) {
      console.error("[ai-engine] internal-policy rewrite failed, going silent:", err)
      responseText = "[[SILENT]]"
    }
  }

  return { response: responseText, action }
}

/** Wording that reveals the company's internal booking rules to a lead. Deliberately about the
 *  disclosure, not about any one price, so it protects every account. */
const INTERNAL_POLICY_LEAK = new RegExp(
  [
    String.raw`\b(never|not|isn'?t|aren'?t|can'?t|cannot|unable to)\s+(be\s+)?bookable\b`,
    String.raw`\bonly (package|option|service|one)( that)? (i|we) (can|am able to) (book|offer|schedule)\b`,
    String.raw`\bi('?m| am) only (able|allowed|permitted|authorized) to\b`,
    String.raw`\bi('?m| am) not (allowed|permitted|authorized) to (book|schedule|offer)\b`,
    String.raw`\b(company|internal|our) (policy|policies|rules)\b`,
    String.raw`\bmy (rules|instructions|guidelines|programming)\b`,
    String.raw`\bi (quoted|offered|mentioned|said)\b[^.?!]{0,60}\b(wrong|in error|by mistake|incorrectly|shouldn'?t have)\b`,
    String.raw`\b(that|it) was (a )?(mistake|wrong|an error)\b`,
  ].join("|"),
  "i"
)

/** Phrases that only ever appear when the model narrates its own plumbing. */
const LEAKED_REASONING =
  /\b(available slots?|returned results?|book_appointment|find_available_slots|update_lead_details|I should not book|I need to book|I had offered|the returned)\b/i

/** Every clock time named in a message, normalised to "9:00 am" / "2:30 pm". */
function clockTimesIn(text: string): string[] {
  const out: string[] = []
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const hour = parseInt(m[1], 10)
    if (hour < 1 || hour > 12) continue
    out.push(`${hour}:${m[2] ?? "00"} ${m[3].replace(/\./g, "").toLowerCase()}`)
  }
  return [...new Set(out)]
}

/** The same normalised clock label for a real slot, in the lead's own zone. */
function slotClockLabel(iso: string, tz: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .trim()
}

/**
 * Arrival-window labels like "3 to 6pm", "8-11am", "11 to 2pm" → the START
 * clock label ("3:00 pm"). Bare end-times must not count as agreement with a
 * slot: in "12 to 3pm or 3 to 6pm" the "3pm" that matters is a window START.
 */
export function windowStartsIn(text: string): string[] {
  const out: string[] = []
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|until|[-–—])\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const sh = parseInt(m[1], 10)
    const eh = parseInt(m[4], 10)
    if (sh < 1 || sh > 12 || eh < 1 || eh > 12) continue
    let mer = (m[3] ?? m[6]).toLowerCase()
    // "11 to 2pm" crosses noon: the start is on the OTHER side of it.
    // Compare on a 0-11 clock — hour 12 IS the start of its half ("12 to 3pm"
    // stays pm), so 12 ranks lowest, not highest.
    if (!m[3] && sh % 12 > eh % 12) mer = m[6].toLowerCase() === "pm" ? "am" : "pm"
    out.push(`${sh}:${m[2] ?? "00"} ${mer}`)
  }
  return [...new Set(out)]
}

/**
 * THE AGREED-TIME CONTRACT. The model is unreliable at composing datetimes
 * (live: KTrin — the lead agreed to "3 to 6pm" and the model passed an ISO
 * that resolved to 8:00 PM her time; the office had to drag the HCP job back
 * into the real window). The slot tool's ISOs and the words exchanged in the
 * thread are the only authorities on WHEN. The model's own datetime is a
 * HINT used to disambiguate — never the booked value.
 *
 *  1. Model time exactly matches an offered slot (±60s) → that slot, verbatim.
 *  2. Else scan the thread newest→oldest for a clock time / window label that
 *     names one offered slot (narrowed by month-day, weekday, then the model's
 *     calendar day when several days share a clock).
 *  3. Else, if exactly one offered slot sits on the model's calendar day →
 *     that slot.
 *  4. Else null → the caller refuses the booking and re-asks. Refuse-not-guess.
 *
 * Every possible return value is an ISO the slot engine itself generated —
 * which by construction is a configured arrival-window start on a bookable
 * day. An AI booking can no longer land outside the company's windows.
 */
export function resolveAgreedSlot(
  offeredIsos: string[],
  modelMs: number,
  leadTz: string,
  texts: string[]
): { iso: string; how: "exact" | "thread-text" | "same-day" } | null {
  if (offeredIsos.length === 0) return null
  const exact = offeredIsos.find((iso) => Math.abs(Date.parse(iso) - modelMs) < 60_000)
  if (exact) return { iso: exact, how: "exact" }

  const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: leadTz })
  const modelDay = dayKey(modelMs)

  for (const t of texts.slice(0, 8)) {
    if (!t) continue
    const starts = windowStartsIn(t)
    const said = starts.length ? starts : clockTimesIn(t)
    if (!said.length) continue
    let hits = offeredIsos.filter((iso) => said.includes(slotClockLabel(iso, leadTz)))
    if (hits.length > 1) {
      // Same clock on several days ("3pm" on Aug 18, 19, 28…) — narrow by
      // date words in the SAME text, then by the model's own calendar day.
      const monthDay = hits.filter((iso) => {
        const d = new Date(iso)
        const day = d.toLocaleDateString("en-US", { timeZone: leadTz, day: "numeric" })
        const long = d.toLocaleDateString("en-US", { timeZone: leadTz, month: "long" })
        const short = d.toLocaleDateString("en-US", { timeZone: leadTz, month: "short" })
        return new RegExp(`\\b(${long}|${short})\\.?\\s+${day}\\b`, "i").test(t)
      })
      if (monthDay.length >= 1) hits = monthDay
    }
    if (hits.length > 1) {
      const weekday = hits.filter((iso) =>
        new RegExp(`\\b${new Date(iso).toLocaleDateString("en-US", { timeZone: leadTz, weekday: "long" })}\\b`, "i").test(t)
      )
      if (weekday.length >= 1) hits = weekday
    }
    if (hits.length > 1) {
      const sameDay = hits.filter((iso) => dayKey(Date.parse(iso)) === modelDay)
      if (sameDay.length >= 1) hits = sameDay
    }
    if (hits.length === 1) return { iso: hits[0], how: "thread-text" }
    if (hits.length > 1) continue
  }

  const sameDay = offeredIsos.filter((iso) => dayKey(Date.parse(iso)) === modelDay)
  if (sameDay.length === 1) return { iso: sameDay[0], how: "same-day" }
  return null
}

/** Real openings on the company's GoHighLevel calendar, in the lead's zone. */
async function salesSlotsFor(companyId: string, leadTz: string) {
  try {
    const { getGhlCalendar, getGhlFreeSlots } = await import("@/lib/ghl-calendar")
    const cal = await getGhlCalendar(companyId)
    if (!cal) return []
    return await getGhlFreeSlots(cal, leadTz)
  } catch {
    return []
  }
}

/** Does this outbound text use post-booking language? Exported for tests. */
export function claimsBookingLanguage(text: string): boolean {
  return (
    /\byou'?re (all set|set for|booked|on the schedule)\b/i.test(text) ||
    /\ball set\b.*\b(for|on)\b\s+(mon|tues|wednes|thurs|fri|satur|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text) ||
    /\bgot you (booked|down for)\b/i.test(text) ||
    /\blocked (you )?in\b/i.test(text) ||
    /\b(text|reach out to|call) you (about )?(30|thirty) minutes\b/i.test(text) ||
    /\breminder\b[^.]*\bday before\b|\bday before\b[^.]*\breminder\b/i.test(text)
  )
}

/** Deterministic consent recap from REAL data — the replacement for a phantom
 *  booking claim, and the exact message the flow wants next anyway. */
export async function buildConsentRecap(
  supabase: ReturnType<typeof createServiceRoleClient>,
  leadId: string,
  companyId: string,
  modelText: string
): Promise<string> {
  const { data: lead } = await supabase
    .from("leads")
    .select("first_name, address, zip, selected_slots, job_type, metadata, timezone")
    .eq("id", leadId).maybeSingle()
  const slots = Object.values((lead?.selected_slots ?? {}) as Record<string, { iso?: string }>)
    .map((s) => s.iso).filter(Boolean) as string[]

  // Pick the slot that was actually talked about. The day alone is not enough:
  // a Friday with three open windows recapped the first one (9 to 11) when the
  // lead had asked for 3 to 5. So the same agreed-time contract that guards the
  // booking picks it here, reading the model's text and the lead's last words.
  const { zipToTimeZone } = await import("@/lib/timezones")
  const tz = zipToTimeZone(lead?.zip as string | null) ?? (lead?.timezone as string | null) ?? "America/New_York"
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: tz }).toLowerCase()
  const { data: lastIn } = await supabase
    .from("conversations").select("body").eq("lead_id", leadId).eq("direction", "inbound")
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  const texts = [modelText, (lastIn?.body as string | null) ?? ""]
  const mentioned = slots.filter((iso) => texts.some((t) => t.toLowerCase().includes(dayOf(iso))))
  const timed = mentioned.length > 1
    ? mentioned.filter((iso) => texts.some((t) => {
        const said = windowStartsIn(t).length ? windowStartsIn(t) : clockTimesIn(t)
        return said.includes(slotClockLabel(iso, tz))
      }))
    : mentioned
  const iso = timed.length === 1 ? timed[0]
    : mentioned.length === 1 ? mentioned[0]
    : slots.length === 1 ? slots[0]
    : null

  const name = (lead?.first_name as string | null)?.trim()
  if (!iso) {
    return `Almost there${name ? `, ${name}` : ""}. Which of the times I offered works best for you? I'll get you locked in right after you confirm.`
  }
  const start = new Date(iso)
  const dayLabel = start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz })
  // The arrival window comes from the company's own windows (the slot start is
  // always one of them). Guessing "start + 3 hours" told a lead "9 to 12" for a
  // 9 to 11 window.
  const startHm = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz })
  const { data: winCfg } = await supabase
    .from("ai_agent_config").select("appointment_windows").eq("company_id", companyId).maybeSingle()
  const win = ((winCfg?.appointment_windows ?? []) as Array<{ start?: string; end?: string }>)
    .find((w) => w.start === startHm)
  const toMin = (hm: string) => parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(3, 5), 10)
  const fmtHm = (mins: number) => {
    const h = Math.floor(mins / 60) % 24, m = mins % 60
    return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`
  }
  const startMin = toMin(startHm)
  const endMin = win?.end ? toMin(win.end) : startMin + 120
  // House style: "3 to 5pm", "11am to 1pm" (the first meridiem only when it differs).
  const sameHalf = (startMin < 720) === (endMin < 720)
  const windowLabel = `${sameHalf ? fmtHm(startMin).replace(/(am|pm)$/, "") : fmtHm(startMin)} to ${fmtHm(endMin)}`

  // Price from the book when computable — never invented
  let priceLine = ""
  try {
    const { priceFromRules, normalizePropertyType } = await import("@/lib/pricing")
    const { data: cfg } = await supabase
      .from("ai_agent_config").select("pricing_rules").eq("company_id", companyId).maybeSingle()
    const meta = (lead?.metadata as Record<string, unknown> | null) ?? {}
    const units = Number(meta.unit_count)
    const cents = priceFromRules(
      (cfg?.pricing_rules ?? null) as never,
      normalizePropertyType(typeof meta.property_type === "string" ? meta.property_type : null),
      (lead?.job_type as string | null) ?? null,
      Number.isFinite(units) && units >= 1 ? Math.round(units) : 1
    )
    if (cents != null) priceLine = ` for $${Math.round(cents / 100)}`
  } catch { /* recap works without a price */ }

  const addr = (lead?.address as string | null)?.trim()
  return `Got you${name ? `, ${name}` : ""}. Just to double check before I lock it in, ${dayLabel}, ${windowLabel}${addr ? `, at ${addr}` : ""}${priceLine}. Sounds good?`
}

// A call-back promise is only honest when the company can place calls. With the voice agent
// off, or no active number, "Calling you now!" is a lie the lead waits on, so the reply is
// swapped for a handoff to the office and the lead is flagged for a person to call.
const CALL_NOW_PROMISE =
  /\b(calling you( right)? now|giving you a call( right)? now|(i'?m|i am) (going to )?call(ing)? you( right)? now|call you right now)\b/i
const CALLBACK_HANDOFF = "Got it. I'll have someone from our team call you shortly."

async function companyCanPlaceCalls(
  supabase: ReturnType<typeof createServiceRoleClient>,
  companyId: string
): Promise<boolean> {
  if (!(await voiceEnabled(companyId))) return false
  const { data } = await supabase
    .from("phone_numbers").select("id").eq("company_id", companyId).eq("is_active", true).limit(1).maybeSingle()
  return !!data
}

async function flagCallRequestForOffice(
  supabase: ReturnType<typeof createServiceRoleClient>,
  leadId: string,
  companyId: string
): Promise<void> {
  try {
    const { data: ld } = await supabase.from("leads").select("first_name, phone, status").eq("id", leadId).single()
    if (ld && !["appointment_booked", "closed_won", "closed_lost", "lost", "needs_attention"].includes(ld.status as string)) {
      await supabase.from("leads").update({ status: "needs_attention" }).eq("id", leadId)
    }
    const { notifyNeedsAttention } = await import("@/lib/notifications")
    await notifyNeedsAttention(companyId, `${ld?.first_name ?? "Lead"} asked for a phone call, needs a rep to call them`, ld?.phone ?? "", leadId).catch(() => {})
  } catch { /* flagging is best-effort; the reply itself is already honest */ }
}

export async function processAndSave(
  leadId: string,
  companyId: string,
  incomingMessage: string | null,
  incomingTwilioSid?: string,
  followUpAngle?: string,
  channel: "sms" | "messenger" = "sms"
): Promise<EngineResult> {
  const supabase = createServiceRoleClient()

  // Save the inbound message first — it must exist even if this turn folds.
  let inboundStoredAt: string | null = null
  if (incomingMessage !== null) {
    const { data: inRow } = await supabase.from("conversations").insert({
      lead_id: leadId,
      company_id: companyId,
      direction: "inbound",
      sent_by: "human",
      body: incomingMessage,
      twilio_sid: incomingTwilioSid ?? null,
      channel,
    }).select("created_at").single()
    inboundStoredAt = (inRow?.created_at as string | null) ?? new Date().toISOString()

    // Move to active_conversation on first reply (from any "just came in" state)
    await supabase
      .from("leads")
      .update({
        last_message_at: new Date().toISOString(),
        status: "active_conversation",
      })
      .eq("id", leadId)
      // "lost" = follow-ups ran out or they passed earlier. A new message from
      // them reopens the conversation. An opt-out is closed_lost + ai_paused and
      // never reaches this point.
      .in("status", ["just_came_in", "new", "contacted", "following_up", "followed_up", "nurturing", "cold", "lost"])
  }

  // ── PER-LEAD TURN LOCK (the Hussein race, Oct 2026) ─────────────────────
  // Rapid-fire inbounds used to spawn CONCURRENT turns: one booked Friday,
  // a parallel turn re-checked availability 6 seconds later, saw the lead's
  // own fresh booking occupying the window, and told him "Friday isn't
  // available" — right after "you're all set". Turns now serialize per lead
  // through a DB claim (survives rolling deploys). A turn that cannot claim
  // in time folds: its inbound is already stored, and if the lock holder's
  // reply postdates it the burst was answered — stay silent instead of
  // double-replying.
  let turnClaimed = false
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: got } = await supabase.rpc("claim_lead_turn", { p_lead_id: leadId })
    if (got === true) { turnClaimed = true; break }
    await new Promise((r) => setTimeout(r, 3000))
  }
  if (!turnClaimed) {
    if (incomingMessage === null) {
      // Background turn (follow-up cron / sweep): let the caller retry later.
      throw new Error(`lead ${leadId} turn-locked — background turn deferred`)
    }
    const { data: newest } = await supabase
      .from("conversations").select("direction, created_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (newest?.direction === "outbound" && inboundStoredAt && newest.created_at > inboundStoredAt) {
      console.log(`[ai-engine] turn folded for lead ${leadId} — burst already answered by the lock holder`)
      return { response: "", action: undefined } as unknown as EngineResult
    }
    console.warn(`[ai-engine] lead ${leadId} lock wait exhausted and inbound unanswered — proceeding WITHOUT lock (last resort)`)
  }
  try {

  // After a late claim, the previous holder may have already answered this
  // very message (it was stored before we waited). One cheap read prevents
  // the double reply.
  if (turnClaimed && incomingMessage !== null && inboundStoredAt) {
    const { data: newest } = await supabase
      .from("conversations").select("direction, created_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (newest?.direction === "outbound" && newest.created_at > inboundStoredAt) {
      console.log(`[ai-engine] turn folded post-claim for lead ${leadId} — burst already answered`)
      return { response: "", action: undefined } as unknown as EngineResult
    }
  }


  // Billing gate (F36): cancelled subscription = AI hard-stop (pilots exempt).
  // The inbound message above is still recorded so the team sees the thread —
  // the AI just never answers or opens.
  {
    const { companyAiBlocked } = await import("@/lib/billing-gate")
    const billingBlock = await companyAiBlocked(companyId)
    if (billingBlock) {
      console.log(`[ai-engine] company ${companyId} blocked (${billingBlock}) — no AI reply for lead ${leadId}`)
      return { response: "", silent: true }
    }
  }

  // Run the AI engine — wrapped so any internal crash still gets a reply to the lead
  let result: EngineResult
  try {
    result = await runConversation(leadId, companyId, incomingMessage, followUpAngle)
  } catch (err) {
    console.error("[ai-engine] runConversation threw, sending the holding reply and flagging the lead:", err)
    // A background touch (follow-up, opener) that crashed sends nothing: an
    // unprompted "someone will text you back" would be noise. A lead who just
    // texted gets the holding line and a person is told to step in.
    result = incomingMessage === null
      ? { response: "", silent: true }
      : { response: HOLDING_REPLY, action: { type: "update_status", status: "needs_attention" } }
  }

  // Silent-stop sentinel: a channel flow (e.g. Top Air's Messenger duct upsell)
  // can instruct the agent to go silent by emitting [[SILENT]]. Strip it, send
  // nothing, and mark the result silent so the fallback guard below doesn't
  // "helpfully" generate a reply we explicitly don't want.
  if (result.response && /\[\[\s*SILENT\s*\]\]/i.test(result.response)) {
    result = { ...result, response: "", silent: true }
  }

  // Phantom-booking guard (Angela, then Syed): text that CLAIMS a booking may
  // only ship when a booking truly exists. Voice has had this net for weeks;
  // text channels now too. A phantom claim is replaced with the consent recap
  // built from real data, which is also the flow's intended next message.
  if (result.response && !result.silent && claimsBookingLanguage(result.response)) {
    const bookedThisTurn =
      (result.action?.type === "book_appointment") || result.action?.type === "reschedule_appointment"
    if (!bookedThisTurn) {
      const { count: hasApt } = await supabase
        .from("appointments").select("*", { count: "exact", head: true })
        .eq("lead_id", leadId).eq("status", "scheduled")
      if ((hasApt ?? 0) === 0) {
        const replacement = await buildConsentRecap(supabase, leadId, companyId, result.response)
        console.error(`[ai-engine] PHANTOM BOOKING CLAIM blocked for lead ${leadId} — replaced with consent recap`)
        if (result.outboundConversationId) {
          await supabase.from("conversations").update({ body: replacement }).eq("id", result.outboundConversationId)
        }
        result = { ...result, response: replacement, action: undefined }
      }
    }
  }

  // Phantom-MOVE guard. The guard above only fires when nothing is booked, so
  // a lead who already has a visit could be told "Moved to Friday" while the
  // visit stayed on Wednesday (first flooring simulation). Any text that says
  // the visit was moved, or names a booked day that is not the day on file,
  // ships only when this turn actually booked or moved something. Otherwise it
  // becomes a recap of the time they asked for, and their yes moves it (the
  // recap-consent path in runConversation).
  if (result.response && !result.silent) {
    const changedThisTurn =
      result.action?.type === "book_appointment" || result.action?.type === "reschedule_appointment"
    const movedClaim = /\b(moved|moving|rescheduled|switched|changed)\b/i.test(result.response) &&
      /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(result.response)
    if (!changedThisTurn && (movedClaim || claimsBookingLanguage(result.response))) {
      const { data: current } = await supabase
        .from("appointments").select("scheduled_at, address")
        .eq("lead_id", leadId).eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true }).limit(1).maybeSingle()
      if (current) {
        const { data: who } = await supabase.from("leads").select("timezone, zip").eq("id", leadId).maybeSingle()
        const { zipToTimeZone } = await import("@/lib/timezones")
        const aptTz = (who?.timezone as string | null) ?? zipToTimeZone(who?.zip as string | null) ?? "America/New_York"
        const bookedDay = new Date(current.scheduled_at as string)
          .toLocaleDateString("en-US", { weekday: "long", timeZone: aptTz }).toLowerCase()
        const daysNamed: string[] = result.response.toLowerCase().match(/\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/g) ?? []
        const wrongDay = daysNamed.length > 0 && !daysNamed.includes(bookedDay)
        if (movedClaim || wrongDay) {
          const replacement = await buildConsentRecap(supabase, leadId, companyId, result.response)
          console.error(`[ai-engine] PHANTOM MOVE CLAIM blocked for lead ${leadId} (visit is still ${current.scheduled_at}) — replaced with a recap`)
          if (result.outboundConversationId) {
            await supabase.from("conversations").update({ body: replacement }).eq("id", result.outboundConversationId)
          }
          result = { ...result, response: replacement, action: undefined }
        }
      }
    }
  }

  // Final guard — runConversation returned empty text. Call Claude text-only for real response.
  // Never use deferred-action language ("get back to you") — AI won't follow up manually.
  if (!result.response && !result.silent && incomingMessage !== null) {
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
      const sp = agentCfg?.generated_system_prompt ?? "You are a scheduling assistant for a local home services company, working by text. Reply with 1 short SMS."
      const rescue = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system: sp + "\n\nRULE: Reply with 1-2 sentences. Plain text only. No tool calls. Move the conversation toward booking.",
        messages: [
          { role: "user" as const, content: `Conversation:\n${histLines}\n\nLead just said: "${incomingMessage}"\n\nReply now.` },
        ],
      })
      logUsage({ site: "sms-empty-rescue", companyId, leadId, model: "claude-haiku-4-5-20251001", usage: rescue.usage })
      for (const b of rescue.content) {
        if (b.type === "text" && b.text.trim()) result = { ...result, response: b.text.trim() }
      }
    } catch { /* ignore */ }
    // Even the rescue failed: holding line, and a person is told to step in.
    if (!result.response) {
      result = { ...result, response: HOLDING_REPLY, action: result.action ?? { type: "update_status", status: "needs_attention" } }
    }
  }

  // Call-back promise guard: never say we are calling when the company has no line to call from.
  if (result.response && !result.silent && CALL_NOW_PROMISE.test(result.response) && !(await companyCanPlaceCalls(supabase, companyId))) {
    console.warn(`[ai-engine] "calling you now" blocked for lead ${leadId}: company ${companyId} has no active phone number. Replaced with office handoff`)
    if (result.outboundConversationId) {
      await supabase.from("conversations").update({ body: CALLBACK_HANDOFF }).eq("id", result.outboundConversationId)
    }
    result = { ...result, response: CALLBACK_HANDOFF }
    await flagCallRequestForOffice(supabase, leadId, companyId)
  }

  // Deterministic writing-style pass. The prompt forbids dash punctuation and
  // asterisks and the model usually complies, but "usually" still let a dash
  // through in about half of repeated test runs — and a dash-joined sentence
  // is the single clearest tell that a message was machine-written. Runs on
  // every written channel, right before the message is saved and sent, so the
  // stored copy and the delivered copy are always identical.
  // HARD STOP: never deliver the model's own reasoning to a customer. A lead
  // was once sent "Looking at the lead file carefully: I have the zip... the
  // instructions say... I need to follow Rule 14". Suppressing the turn and
  // handing it to a human is always better than letting that reach anyone.
  if (result.response) {
    const { looksLikeInternalReasoning } = await import("@/lib/agent-text")
    if (looksLikeInternalReasoning(result.response)) {
      console.error(`[ai-engine] REASONING LEAK BLOCKED for lead ${leadId}: ${result.response.slice(0, 200)}`)
      await supabase.from("leads")
        .update({ status: "needs_attention", ai_paused: true }).eq("id", leadId)
      try {
        const { notifyNeedsAttention } = await import("@/lib/notifications")
        const { data: ld } = await supabase.from("leads").select("first_name, phone").eq("id", leadId).single()
        notifyNeedsAttention(companyId,
          `${ld?.first_name ?? "Lead"} — AI reply blocked (internal reasoning), needs a human reply`,
          ld?.phone ?? "", leadId).catch(() => {})
      } catch { /* notification is best-effort */ }
      return { response: "", silent: true }
    }
    const { sanitizeAgentText } = await import("@/lib/agent-text")
    const cleaned = sanitizeAgentText(result.response)
    if (cleaned !== result.response) {
      console.log(`[ai-engine] style pass rewrote outbound text for lead ${leadId}`)
      result = { ...result, response: cleaned }
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
      const { scheduled_at: rawScheduledAt, address, notes, quoted_total, unit_count, property_type } = result.action

      // Look up pre-selected tech from find_available_slots (saved to leads.selected_slots mid-conversation)
      const { data: freshLead } = await supabase
        .from("leads")
        .select("job_type, address, zip, selected_slots, first_name, last_name, timezone, service_type, metadata")
        .eq("id", leadId)
        .single()

      // Timezone-normalize: the model occasionally emits a naive local
      // datetime ("2026-08-03T13:00:00" with no offset). Node would read that
      // as UTC and store the job 5-6 hours wrong (audit C7). No offset →
      // interpret in the COMPANY timezone.
      let scheduled_at = rawScheduledAt
      if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(rawScheduledAt.trim())) {
        try {
          const { data: tzRow } = await supabase
            .from("ai_agent_config").select("timezone").eq("company_id", companyId).single()
          const { localSlotToUtcIso } = await import("@/lib/technician-booking")
          const naive = rawScheduledAt.trim()
          // Prefer the LEAD's zone: every time we showed them was in their
          // clock, so an offsetless reply is in their clock too.
          const interpretTz =
            (freshLead?.timezone as string | null) || (tzRow?.timezone ?? "America/New_York")
          scheduled_at = localSlotToUtcIso(naive.slice(0, 10), naive.slice(11, 16) || "09:00", interpretTz)
        } catch {
          // Unparseable ("tomorrow 2pm") — leave as-is; the sanity gate below
          // rejects it and re-asks instead of crashing mid-booking
          scheduled_at = rawScheduledAt
        }
      }

      // Sanity-gate the datetime BEFORE inserting anything. The model can emit
      // garbage ("tomorrow 2pm" → RangeError AFTER the "you're booked" text
      // was already saved; "2" → year 2001) — a crash here left a Messenger
      // lead in total silence right after agreeing to book (adversarial
      // finding 5). Invalid/past/absurd date → no appointment; replace the
      // reply with a corrective slot re-ask.
      let bookMs = Date.parse(scheduled_at)
      const dateInvalid =
        Number.isNaN(bookMs) ||
        bookMs < Date.now() - 60 * 60 * 1000 ||
        bookMs > Date.now() + 366 * 24 * 60 * 60 * 1000
      if (dateInvalid) {
        console.error(`[ai-engine] book_appointment rejected — unusable scheduled_at "${rawScheduledAt}" (normalized "${scheduled_at}") for lead ${leadId}`)
        const corrective = "Almost there — which of the times I offered works best for you? I'll lock it in right away."
        if (outboundConversationId) {
          await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
        }
        return { response: corrective, action: undefined, outboundConversationId }
      }

      const inferredJobType = inferJobType(notes ?? "")
      const bookJobType = inferredJobType ?? (freshLead?.job_type as string | null)
      const bookZip = extractZip(address ?? freshLead?.address ?? "") ?? ((freshLead?.zip as string | null) ?? null)

      let svcTypeForBooking = freshLead?.service_type as string | null
      if (!svcTypeForBooking) {
        const { data: co } = await supabase
          .from("companies").select("service_type").eq("id", companyId).maybeSingle()
        svcTypeForBooking = (co?.service_type as string | null) ?? null
      }
      const salesBooking = svcTypeForBooking === "fieldbuilt_sales"
      const { data: travelCfg } = await supabase
        .from("ai_agent_config").select("requires_travel").eq("company_id", companyId).maybeSingle()
      const needsTravel = (travelCfg?.requires_travel as boolean | null) ?? true

      // ── THE AGREED-TIME CONTRACT (every booking, sales AND service) ────────
      // The booked ISO must be a slot the tool offered and the lead agreed to.
      // First shipped for sales only (live: 9:30 booked when "9am or 10am" was
      // offered); the service-visit hole booked KTrin at 8:00 PM — the model
      // composed the datetime itself and nothing checked it. resolveAgreedSlot
      // is the single authority now: exact match, else the thread's own words,
      // else refuse and re-ask. Never the model's arithmetic.
      {
        const offeredIsos = Object.values(
          (freshLead?.selected_slots ?? {}) as Record<string, { iso?: string }>
        ).map((v) => v?.iso).filter(Boolean) as string[]

        const refuseBooking = async (corrective: string, why: string) => {
          console.warn(`[ai-engine] booking refused for lead ${leadId} — ${why} (model sent ${rawScheduledAt} → ${scheduled_at})`)
          if (outboundConversationId) {
            await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
          }
          return { response: corrective, action: undefined, outboundConversationId }
        }

        if (offeredIsos.length > 0) {
          const { zipToTimeZone } = await import("@/lib/timezones")
          const agreeTz =
            (freshLead?.timezone as string | null) ?? zipToTimeZone(bookZip) ?? "America/New_York"
          const { data: recentRows } = await supabase
            .from("conversations")
            .select("body")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(6)
          const texts = [result.response ?? "", ...(recentRows ?? []).map((r) => (r.body as string) ?? "")]

          const agreed = resolveAgreedSlot(offeredIsos, bookMs, agreeTz, texts)
          if (!agreed) {
            return await refuseBooking(
              "Almost there — which of the times I offered works best for you? I'll lock it in right away.",
              `no offered slot matches (offered ${offeredIsos.join(", ")})`
            )
          }
          if (agreed.how !== "exact") {
            console.warn(
              `[ai-engine] snapped booking for lead ${leadId}: model sent ${scheduled_at} → ${agreed.iso} (${agreed.how})`
            )
          }
          scheduled_at = agreed.iso
          bookMs = Date.parse(agreed.iso)
        } else if (!salesBooking && needsTravel) {
          // No slots were ever offered — a visit booking has nothing agreed to
          // land on. The model must run find_available_slots first.
          return await refuseBooking(
            "Let me pull up our openings for you real quick — one moment and I'll send you the times.",
            "book_appointment with no offered slots on file"
          )
        }
      }

      // ── HOLIDAY GATE: closed on US holidays (lib/holidays.ts) ────────────────
      // The slot search never offers a holiday, but times offered before that
      // rule existed are still on lead files, and the model can name a day by
      // itself. Checked here, in code, on the final time.
      if (!salesBooking && needsTravel) {
        const { holidayAt } = await import("@/lib/holidays")
        const { zipToTimeZone } = await import("@/lib/timezones")
        const holidayTz = (freshLead?.timezone as string | null) ?? zipToTimeZone(bookZip) ?? "America/New_York"
        const holiday = holidayAt(bookMs, holidayTz)
        if (holiday) {
          const corrective = `We're closed on ${holiday.name}, so that day won't work. Want me to pull up the next openings after it?`
          console.warn(`[ai-engine] booking refused for lead ${leadId} — ${scheduled_at} is ${holiday.name}`)
          if (outboundConversationId) {
            await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
          }
          return { response: corrective, action: undefined, outboundConversationId }
        }
      }

      // ── THE QUALIFICATION GATE (the promise behind "qualified before booked") ──
      // A home visit is only created when (1) every question the owner marked
      // "must answer before booking" is on the lead file and (2) nothing the lead
      // said plainly matches what the company does not book. Checked here, in
      // code, whatever the model decided. Sales calls and no-travel bookings are
      // exempt, exactly like the address rule below.
      if (!salesBooking && needsTravel) {
        const hold = await requiredAnswerHold(supabase, leadId, companyId, incomingMessage)
        if (hold) {
          console.warn(`[ai-engine] booking held for lead ${leadId}, required answers missing: ${hold.missingKeys.join(", ")}${hold.escalate ? " (asked twice, handing to a person)" : ""}`)
          if (outboundConversationId) {
            await supabase.from("conversations").update({ body: hold.text }).eq("id", outboundConversationId)
          }
          if (hold.escalate) {
            await supabase.from("leads").update({ status: "needs_attention" }).eq("id", leadId)
            return { response: hold.text, action: { type: "update_status", status: "needs_attention" }, outboundConversationId }
          }
          return { response: hold.text, action: undefined, outboundConversationId }
        }

        const { data: qualCfg } = await supabase
          .from("ai_agent_config").select("disqualifiers").eq("company_id", companyId).maybeSingle()
        if ((qualCfg?.disqualifiers as string | null)?.trim()) {
          const { data: thread } = await supabase
            .from("conversations").select("direction, body")
            .eq("lead_id", leadId).or("channel.is.null,channel.neq.voice")
            .order("created_at", { ascending: true }).limit(40)
          const { data: answersRow } = await supabase.from("leads").select("metadata").eq("id", leadId).maybeSingle()
          const verdict = await qualificationVerdict({
            disqualifiers: qualCfg?.disqualifiers as string,
            answers: leadAnswers(answersRow?.metadata),
            transcript: (thread ?? []).map((m) => `${m.direction === "inbound" ? "Homeowner" : "Assistant"}: ${m.body}`).join("\n"),
            trade: serviceCopy(svcTypeForBooking).trade,
            companyId, leadId,
          })
          if (verdict.verdict === "unqualified") {
            // Not booked, and not thrown away either: a person decides. The
            // owner sees why in the lead notes.
            const handoff = "Thanks for all the details. Let me have someone from our team take a look at this and get back to you."
            console.warn(`[ai-engine] booking refused for lead ${leadId}, matches a disqualifier: ${verdict.reason}`)
            if (outboundConversationId) {
              await supabase.from("conversations").update({ body: handoff }).eq("id", outboundConversationId)
            }
            const { data: noteRow } = await supabase.from("leads").select("notes").eq("id", leadId).maybeSingle()
            const note = `Not booked by the assistant: ${verdict.reason || "matches something the company does not book"}`
            await supabase.from("leads").update({
              status: "needs_attention",
              notes: noteRow?.notes ? `${noteRow.notes} | ${note}` : note,
            }).eq("id", leadId)
            return { response: handoff, action: { type: "update_status", status: "needs_attention" }, outboundConversationId }
          }
        }
      }

      // Tech decided at SLOT time — looked up AFTER the agreed-time snap so a
      // corrected ISO inherits the technician the tool mapped to that slot.
      const selectedSlots = freshLead?.selected_slots as Record<string, { tech_id: string; tech_name: string }> | null
      const normalKey = scheduled_at.substring(0, 16) // YYYY-MM-DDTHH:MM
      let preSelected = selectedSlots
        ? Object.entries(selectedSlots).find(([k]) => k.substring(0, 16) === normalKey)?.[1] ?? null
        : null

      // A site visit cannot be dispatched to a zip alone (live: Gina — the
      // whole address was "60706"; the booking, the HCP job, and the
      // confirmation SMS all carried just the zip while the real street sat
      // unstored in the thread). No real street address → the booking does
      // NOT happen this turn: the reply becomes the address ask, and the
      // model books next turn with the street. Sales/video bookings (no
      // truck rolls) are exempt, as are requires_travel=false companies.
      if (!salesBooking) {
        const { isCompleteServiceAddress } = await import("@/lib/routing")
        const bookAddress = address ?? (freshLead?.address as string | null) ?? null
        if (needsTravel && !isCompleteServiceAddress(bookAddress)) {
          const corrective = "Perfect. And what's the full street address for the visit? I'll lock it in right away."
          if (outboundConversationId) {
            await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
          }
          console.warn(`[ai-engine] booking held for lead ${leadId} — no full street address on file (have: ${JSON.stringify(bookAddress)})`)
          return { response: corrective, action: undefined, outboundConversationId }
        }
        // The model passed a full address in the booking call — make sure the
        // lead record carries it even when update_lead_details wasn't called.
        if (address && isCompleteServiceAddress(address) && address !== freshLead?.address) {
          await saveLeadDetailsForLead(supabase, leadId, companyId, { address }).catch(() => false)
        }

        // A booking is made under the customer's OWN stated name, never a
        // Facebook profile alias (live: KTrin Brownskin — booked and pushed to
        // HCP under her Messenger display name; the office chased the real
        // name, "Katrina Lewis", that night). Facebook autofills lead-form
        // names from the profile, so an FB-sourced name is unverified until
        // the customer states their name in the conversation.
        const leadMeta = (freshLead?.metadata as Record<string, unknown> | null) ?? {}
        const fbAlias = leadMeta.name_source === "facebook_profile" && leadMeta.name_verified !== true
        if (needsTravel && (!freshLead?.first_name || fbAlias)) {
          const corrective = "Perfect. And what's your full name for the booking?"
          if (outboundConversationId) {
            await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
          }
          console.warn(`[ai-engine] booking held for lead ${leadId} — ${!freshLead?.first_name ? "no name on file" : "Facebook profile name not verified"}`)
          return { response: corrective, action: undefined, outboundConversationId }
        }
      }

      // Re-validate the pre-selected tech against the FINAL job type and
      // address zip. Slots can be offered before the address is known —
      // the tech locked in then may not cover where the lead actually lives
      // (audit C7). Invalid → drop it and let selectTechnician re-pick below.
      if (preSelected) {
        const { techCanTakeBooking } = await import("@/lib/technician-booking")
        const stillValid = await techCanTakeBooking(preSelected.tech_id, bookJobType, bookZip, scheduled_at, leadId).catch(() => false)
        if (!stillValid) {
          console.warn(`[ai-engine] pre-selected tech ${preSelected.tech_name} no longer valid for job=${bookJobType} zip=${bookZip} — re-selecting`)
          preSelected = null
        }
      }

      // One conversation must never leave two appointments behind. A second
      // book_appointment in the same exchange (observed: the model re-checked
      // availability and booked again) previously created a phantom at the
      // OTHER offered slot — invisible to the lead, real on the calendar.
      // Treat a repeat booking as a move of the existing one.
      let alreadyBookedId: string | null = null
      const { data: existingApt } = await supabase
        .from("appointments")
        .select("id, scheduled_at, ghl_event_id")
        .eq("lead_id", leadId)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      // Confirmation SMS/email fire once per real change: "created" and
      // "moved" send, "noop" must not — three texts went to one lead when
      // every collapsed duplicate re-triggered the webhook's confirmation
      // block (live: Gina).
      let bookingOutcome: "created" | "moved" | "noop" = "created"
      if (existingApt) {
        // Same minute OR same local day + arrival window = the SAME visit
        // being re-booked, not a reschedule (voice parity): re-booking "10:30"
        // over a 10-1 booking must not silently move the appointment.
        const { sameWindowBucket } = await import("@/lib/technician-booking")
        const sameTime =
          Math.abs(Date.parse(existingApt.scheduled_at) - bookMs) < 60_000 ||
          await sameWindowBucket(companyId, existingApt.scheduled_at, scheduled_at, bookZip).catch(() => false)
        // A booking may only MOVE when the customer's own message expresses a
        // time or a change ("3pm instead", "Thursday works better", "the other
        // option"). Observed live-class failure: on a bare "thanks!" the model
        // re-booked the OTHER offered window and silently relocated the visit.
        const moveIntent = result.action.consented === true || !!incomingMessage && (
          /\b(re-?schedul\w*|switch|change|move|instead|different|rather|actually|earlier|later|make it|can we do|how about|prefer)\b/i.test(incomingMessage) ||
          /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(incomingMessage) ||
          /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/i.test(incomingMessage) ||
          /\b(first|second|third|other|next|morning|afternoon|evening|noon|tomorrow)\b/i.test(incomingMessage)
        )
        if (!sameTime && !moveIntent) {
          console.warn(`[ai-engine] booking move SUPPRESSED for lead ${leadId} — model re-booked ${scheduled_at} over ${existingApt.scheduled_at} but the inbound ("${(incomingMessage ?? "").slice(0, 60)}") expresses no reschedule intent`)
        }
        if (!sameTime && moveIntent) {
          await supabase.from("appointments").update({
            scheduled_at,
            address: address ?? undefined,
            rescheduled_from: existingApt.scheduled_at,
            // Fresh confirmation + reminder cycle for the new time
            confirmation_sms_sent: false, confirmation_email_sent: false,
            reminder_2d_email_sent: false, reminder_2d_sms_sent: false,
            reminder_1d_email_sent: false, reminder_1d_sms_sent: false,
            reminder_2h_email_sent: false, reminder_2h_sms_sent: false,
          }).eq("id", existingApt.id)
          bookingOutcome = "moved"
          console.log(`[ai-engine] duplicate booking collapsed into ${existingApt.id} — moved to ${scheduled_at}`)
        } else {
          bookingOutcome = "noop"
          console.log(`[ai-engine] duplicate booking ignored for lead ${leadId} — already booked at ${scheduled_at}`)
        }
        alreadyBookedId = existingApt.id
      }

      // Create appointment — with pre-selected tech if available
      const insertRes = alreadyBookedId ? null : await supabase
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

      // One handle downstream, whether we inserted or matched an existing one.
      let apt = insertRes?.data ?? (alreadyBookedId ? { id: alreadyBookedId } : null)

      // The DB enforces ONE active AI appointment per lead (partial unique
      // index — Wafaa incident). If a concurrent writer won the race between
      // our guard's read and this insert, adopt their row instead of failing.
      if (!apt && insertRes?.error && (insertRes.error as { code?: string }).code === "23505") {
        const { data: raced } = await supabase
          .from("appointments")
          .select("id")
          .eq("lead_id", leadId).eq("status", "scheduled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (raced) {
          console.log(`[ai-engine] duplicate insert blocked by unique index — adopting ${raced.id}`)
          apt = { id: raced.id }
          bookingOutcome = "noop"
        }
      }
      if (result.action.type === "book_appointment") result.action.outcome = bookingOutcome

      // Mirror onto the GoHighLevel calendar when the company books there:
      // GHL owns the meeting link and the confirmation email, and the entry
      // lands on the owner's real Google Calendar through GHL's own sync.
      if (apt) {
        try {
          const { getGhlCalendar, createGhlAppointment } = await import("@/lib/ghl-calendar")
          const cal = await getGhlCalendar(companyId)
          if (cal) {
            const { ensureLeadGhlContact } = await import("@/lib/ghl")
            const link = await ensureLeadGhlContact(companyId, leadId)
            if (link) {
              const leadName = `${freshLead?.first_name ?? ""} ${freshLead?.last_name ?? ""}`.trim()
              const ev = await createGhlAppointment(cal, {
                contactId: link.contactId,
                startTimeIso: scheduled_at,
                title: leadName ? `FieldBuilt walkthrough — ${leadName}` : "FieldBuilt walkthrough",
                leadTimezone: (freshLead?.timezone as string | null) ?? undefined,
              })
              if (ev) {
                await supabase.from("appointments").update({
                  ghl_event_id: ev.id,
                  ...(ev.meetingUrl ? { google_meet_link: ev.meetingUrl } : {}),
                }).eq("id", apt.id)
              }
            }
          }
        } catch (err) {
          console.error("[ai-engine] GHL calendar sync failed:", err)
        }
      }

      // Update lead status
      await supabase
        .from("leads")
        .update({ status: "appointment_booked", last_message_at: new Date().toISOString() })
        .eq("id", leadId)

      // Always infer and save job_type (even when tech was pre-selected — needed for Reports)
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

      // If no valid pre-selected tech (AI skipped find_available_slots, slots
      // expired, or revalidation dropped it), fall back to selectTechnician —
      // which now hard-fails rather than guessing (audit C6/C7)
      if (!preSelected && apt) {
        const techResult = await selectTechnician(companyId, apt.id, scheduled_at, bookJobType, bookZip)
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

      // Quoted value: record what the AI actually SOLD, so the job carries a
      // price for the technician and "Potential revenue" is real rather than
      // inferred later from invoices. Awaited so the HCP push carries it.
      if (apt) {
        try {
          const { resolveQuotedAmount, saveQuotedAmount } = await import("@/lib/pricing")
          const q = await resolveQuotedAmount({
            companyId, leadId,
            jobType: bookJobType,
            agentTotalCents: typeof quoted_total === "number" ? Math.round(quoted_total * 100) : null,
            agentUnitCount: typeof unit_count === "number" ? Math.round(unit_count) : null,
            agentPropertyType: property_type ?? null,
          })
          await saveQuotedAmount(apt.id, leadId, q)
        } catch (err) {
          console.error("[ai-engine] quoted-amount resolution failed:", err)
        }
      }

      // New-route-day stamp: if this booking landed on a day where the tech
      // has NO other work (the anchored slot search fell back to an open day),
      // tell the office in the appointment notes so they can build a route
      // around it. Awaited so the HCP push below carries the note.
      if (apt) {
        try {
          // Re-read: the tech may have been assigned AFTER insert (selectTechnician path)
          const { data: freshApt } = await supabase
            .from("appointments").select("technician_id, notes").eq("id", apt.id).maybeSingle()
          if (freshApt?.technician_id && svcTypeForBooking === "hvac") {
            const { techAnchoredOn } = await import("@/lib/technician-booking")
            const anchored = await techAnchoredOn(companyId, freshApt.technician_id, scheduled_at, apt.id)
            if (!anchored) {
              const marker = "⚠️ NEW ROUTE DAY — first job scheduled for this technician on this day; plan the route around it."
              await supabase.from("appointments").update({
                notes: freshApt.notes ? `${freshApt.notes}\n${marker}` : marker,
              }).eq("id", apt.id)
            }
          }
        } catch (err) {
          console.error("[ai-engine] new-route-day stamp failed:", err)
        }
      }

      // Name backstop: the agent is told to save names via update_lead_details
      // but doesn't always call it (seen live on a Spanish thread where it
      // greeted the customer by name and never saved it). Recover it from the
      // transcript BEFORE the HCP push and the confirmation go out — those are
      // the two places a missing name becomes visible to the customer and the
      // technician. Awaited so the push below sees the recovered name.
      if (apt) {
        try {
          const { ensureLeadName } = await import("@/lib/lead-name")
          await ensureLeadName(leadId)
        } catch (err) {
          console.error("[ai-engine] name backstop failed:", err)
        }
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

            // A video appointment (no travel) becomes a real Google Meet room,
            // and the lead is invited so Google emails them the link directly.
            const isVideoAppointment = !((await supabase
              .from("ai_agent_config").select("requires_travel").eq("company_id", companyId).maybeSingle()
            ).data?.requires_travel ?? true)
            const durationMin = isVideoAppointment ? 30 : 60
            const leadName = `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim()

            const gcalEvent = await createCalendarEvent(
              gcal.access_token,
              gcal.refresh_token,
              gcal.calendar_id ?? "primary",
              {
                summary: isVideoAppointment
                  ? `FieldBuilt walkthrough — ${leadName || "lead"}`
                  : `In-home measure: ${leadName || "lead"}`,
                description: notes ?? "",
                location: isVideoAppointment ? undefined : (address ?? ""),
                startTime: scheduled_at,
                endTime: new Date(new Date(scheduled_at).getTime() + durationMin * 60000).toISOString(),
                attendeeEmail: (lead as { email?: string | null })?.email ?? undefined,
                timezone: (lead as { timezone?: string | null })?.timezone ?? undefined,
                withMeet: isVideoAppointment,
              },
              saveRefreshedToken
            )

            // Pull the Meet link out of whichever field Google populates.
            const meetLink =
              (gcalEvent as { hangoutLink?: string }).hangoutLink ??
              (gcalEvent as { conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } })
                .conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
              null

            await supabase
              .from("appointments")
              .update({ google_event_id: gcalEvent.id ?? null, google_meet_link: meetLink })
              .eq("id", apt.id)
          }
        } catch (err) {
          console.error("[ai-engine] Google Calendar event creation failed:", err)
        }
      }
    } else if (result.action.type === "cancel_appointment") {
      const { appointment_id, reason } = result.action
      // Verify the ID belongs to THIS lead before touching anything. The model
      // passes IDs as text — a hallucinated-but-valid ID could cancel another
      // customer's appointment, and a bogus ID updated zero rows while the
      // lead was still told "cancelled" (adversarial finding A7).
      const { data: target } = await supabase
        .from("appointments")
        .select("id, hcp_job_id")
        .eq("id", appointment_id)
        .eq("company_id", companyId)
        .eq("lead_id", leadId)
        .eq("status", "scheduled")
        .maybeSingle()

      if (!target) {
        console.warn(`[ai-engine] cancel_appointment: id ${appointment_id} not found for lead ${leadId} — correcting instead of confirming`)
        const corrective = "Let me double check your appointment before I change anything. Which day was it scheduled for?"
        if (outboundConversationId) {
          await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
        }
        return { response: corrective, action: undefined, outboundConversationId }
      }

      await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason ?? null,
        })
        .eq("id", target.id)

      // One-way HCP sync gap: our cancel never removed the mirrored HCP job.
      // Until HCP exposes a cancel API, flag the office loudly (finding F34).
      if (target.hcp_job_id && !String(target.hcp_job_id).startsWith("pending")) {
        const { notifyNeedsAttention } = await import("@/lib/notifications")
        notifyNeedsAttention(companyId, `Appointment cancelled by lead — REMOVE the matching job from Housecall Pro (HCP job ${target.hcp_job_id})`, "").catch(() => {})
        await supabase.from("appointments").update({
          notes: `⚠️ Cancelled here — HCP job ${target.hcp_job_id} must be removed manually in Housecall Pro.`,
        }).eq("id", target.id)
      }

      await supabase
        .from("leads")
        .update({ status: "active_conversation", last_message_at: new Date().toISOString() })
        .eq("id", leadId)

    } else if (result.action.type === "reschedule_appointment") {
      const { appointment_id, new_scheduled_at } = result.action

      // Same lead-scoped verification as cancel (finding A7): never touch an
      // appointment that isn't this lead's, never confirm a change that
      // matched zero rows.
      const { data: oldApt } = await supabase
        .from("appointments")
        .select("scheduled_at, google_event_id")
        .eq("id", appointment_id)
        .eq("company_id", companyId)
        .eq("lead_id", leadId)
        .maybeSingle()

      if (!oldApt) {
        console.warn(`[ai-engine] reschedule_appointment: id ${appointment_id} not found for lead ${leadId} — correcting instead of confirming`)
        const corrective = "Let me pull up your appointment to make sure I move the right one. Which day is it currently scheduled for?"
        if (outboundConversationId) {
          await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
        }
        return { response: corrective, action: undefined, outboundConversationId }
      }

      // THE AGREED-TIME CONTRACT applies to moves exactly as to bookings — this
      // path wrote the model's raw datetime until Aug 2026 (same composed-
      // datetime class that booked KTrin at 8 PM). The new time must resolve
      // to a tool-offered slot via the same ladder; a day we never offered
      // means the model must run find_available_slots first.
      let moveIso = new_scheduled_at
      {
        const { data: moveLead } = await supabase
          .from("leads").select("timezone, zip, selected_slots").eq("id", leadId).maybeSingle()
        const { zipToTimeZone } = await import("@/lib/timezones")
        const moveTz = (moveLead?.timezone as string | null) ?? zipToTimeZone(moveLead?.zip as string | null) ?? "America/New_York"
        if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(moveIso.trim())) {
          try {
            const { localSlotToUtcIso } = await import("@/lib/technician-booking")
            const naive = moveIso.trim()
            moveIso = localSlotToUtcIso(naive.slice(0, 10), naive.slice(11, 16) || "09:00", moveTz)
          } catch { /* sanity below handles it */ }
        }
        const moveMs = Date.parse(moveIso)
        const offeredIsos = Object.values(
          (moveLead?.selected_slots ?? {}) as Record<string, { iso?: string }>
        ).map((v) => v?.iso).filter(Boolean) as string[]
        const { data: recentRows } = await supabase
          .from("conversations").select("body").eq("lead_id", leadId)
          .order("created_at", { ascending: false }).limit(6)
        const texts = [result.response ?? "", ...(recentRows ?? []).map((r) => (r.body as string) ?? "")]
        let agreed = Number.isNaN(moveMs) ? null : resolveAgreedSlot(offeredIsos, moveMs, moveTz, texts)
        // Self-move tell: "rescheduling" onto the CURRENT time is never what
        // the customer asked (observed: the model composed 3 PM for a "12 to
        // 3pm" request — coincidentally the slot they already held). The
        // words name the real target — resolve again without the current time.
        const curMs = Date.parse(oldApt.scheduled_at as string)
        if (agreed && Math.abs(Date.parse(agreed.iso) - curMs) < 60_000) {
          const others = offeredIsos.filter((iso) => Math.abs(Date.parse(iso) - curMs) >= 60_000)
          agreed = resolveAgreedSlot(others, moveMs, moveTz, texts)
        }
        if (!agreed) {
          console.warn(`[ai-engine] reschedule refused for lead ${leadId} — ${new_scheduled_at} is not an offered slot (offered ${offeredIsos.join(", ") || "none"})`)
          const corrective = "Happy to move it! Which of the times I offered works best? If you need a different day, just tell me the day and I'll check our openings."
          if (outboundConversationId) {
            await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
          }
          return { response: corrective, action: undefined, outboundConversationId }
        }
        if (agreed.how !== "exact") {
          console.warn(`[ai-engine] reschedule snapped for lead ${leadId}: model sent ${new_scheduled_at} → ${agreed.iso} (${agreed.how})`)
        }
        moveIso = agreed.iso
        // Closed on US holidays: a move onto one is refused like a booking.
        const { holidayAt } = await import("@/lib/holidays")
        const holiday = holidayAt(moveIso, moveTz)
        if (holiday) {
          console.warn(`[ai-engine] reschedule refused for lead ${leadId} — ${moveIso} is ${holiday.name}`)
          const corrective = `We're closed on ${holiday.name}, so I can't move it there. Want me to pull up the next openings after it?`
          if (outboundConversationId) {
            await supabase.from("conversations").update({ body: corrective }).eq("id", outboundConversationId)
          }
          return { response: corrective, action: undefined, outboundConversationId }
        }
      }

      await supabase
        .from("appointments")
        .update({
          scheduled_at: moveIso,
          rescheduled_from: oldApt?.scheduled_at ?? null,
          // Reset confirmation + reminder flags so the new time gets a fresh
          // confirmation and its own reminder cycle
          confirmation_sms_sent: false,
          confirmation_email_sent: false,
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
                startTime: moveIso,
                endTime: new Date(new Date(moveIso).getTime() + 60 * 60000).toISOString(),
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

        // A callback against a placeholder phone is a phantom promise — the
        // model says "Calling you now!" and no call can ever be placed
        // (live: a Messenger lead with no number on file). Convert the reply
        // into the number ask deterministically; the prompt alone kept
        // reaching for the tool anyway.
        {
          const { isPlaceholderPhone } = await import("@/lib/twilio")
          if (!leadData?.phone || isPlaceholderPhone(leadData.phone)) {
            const corrective = "Happy to have someone call you! What's the best number to reach you on?"
            console.warn(`[ai-engine] request_callback blocked for lead ${leadId} — no real phone on file, asking for the number instead`)
            if (result.outboundConversationId) {
              await supabase.from("conversations").update({ body: corrective }).eq("id", result.outboundConversationId)
            }
            return { response: corrective, action: undefined, outboundConversationId: result.outboundConversationId }
          }
        }

        const { data: phoneRecord } = await supabase
          .from("phone_numbers")
          .select("phone_number")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()

        // No line to call from, or the voice agent is off: never say "Calling you now!".
        // Hand the request to the office instead.
        if (!phoneRecord?.phone_number || !(await voiceEnabled(companyId))) {
          console.warn(`[ai-engine] request_callback for lead ${leadId}: company ${companyId} has no active phone number, handing off to the office instead of calling`)
          if (result.outboundConversationId) {
            await supabase.from("conversations").update({ body: CALLBACK_HANDOFF }).eq("id", result.outboundConversationId)
          }
          await flagCallRequestForOffice(supabase, leadId, companyId)
          return { response: CALLBACK_HANDOFF, action: undefined, outboundConversationId: result.outboundConversationId }
        }

        if (leadData?.phone && phoneRecord?.phone_number) {
          // Fetch recent text context (sms/messenger) so the voice
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

  // Keep the lead file current: when a required qualifying answer is still
  // missing after a reply, read the thread for it (the model often hears an
  // answer and does not save it). Runs whatever the turn decided, except a
  // booking, which already ran the same check in the qualification gate.
  if (incomingMessage !== null && result.action?.type !== "book_appointment") {
    try {
      const [{ data: qCfg }, { data: qLead }] = await Promise.all([
        supabase.from("ai_agent_config").select("qualifying_questions").eq("company_id", companyId).maybeSingle(),
        supabase.from("leads").select("metadata, job_type").eq("id", leadId).maybeSingle(),
      ])
      const qs = parseRuntimeQuestions(qCfg?.qualifying_questions)
      const have = {
        ...(qLead?.job_type ? { project_type: String(qLead.job_type) } : {}),
        ...leadAnswers(qLead?.metadata),
      }
      if (missingRequired(qs, have).length > 0) {
        await ensureRequiredAnswers(supabase, leadId, companyId, null)
      }
    } catch (err) {
      console.error("[ai-engine] answer refresh failed:", err)
    }
  }

  // Autopilot qualification: after a lead replies, decide qualified / unqualified
  // from what is actually on file. Never touches a lead that is booked, in the
  // quote stage, signed, lost, or waiting on a person.
  if (incomingMessage !== null && !result.action) {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("status, metadata, job_type")
        .eq("id", leadId)
        .single()

      const { isTerminalLeadStatus, isPostMeasureStatus } = await import("@/lib/sequences")
      const openToVerdict =
        !!lead &&
        !isTerminalLeadStatus(lead.status) &&
        !isPostMeasureStatus(lead.status) &&
        !["qualified", "needs_attention", "cold"].includes(lead.status)

      if (openToVerdict) {
        const [{ data: config }, { data: company }] = await Promise.all([
          supabase.from("ai_agent_config").select("disqualifiers, qualifying_questions").eq("company_id", companyId).single(),
          supabase.from("companies").select("service_type").eq("id", companyId).single(),
        ])
        const questions = parseRuntimeQuestions(config?.qualifying_questions)
        let answers: Record<string, string> = {
          ...(lead!.job_type ? { project_type: String(lead!.job_type) } : {}),
          ...leadAnswers(lead!.metadata),
        }
        // The model does not always save what it heard (seen in the simulation:
        // "we're renting, I'm the only one deciding, next 2 weeks" and nothing
        // was saved). When a required answer is still missing, read the thread
        // for it now, one cheap pass, so the CRM shows it and the verdict below
        // judges on real answers.
        if (missingRequired(questions, answers).length > 0) {
          const refreshed = await ensureRequiredAnswers(supabase, leadId, companyId, null)
          answers = { ...answers, ...refreshed.answers }
        }
        const required = questions.filter((q) => q.required)
        // With required questions configured, "qualified" means they are all
        // answered. Without any, keep the old bar: at least two replies.
        let enoughToJudge = required.length > 0 && missingRequired(questions, answers).length === 0
        if (required.length === 0) {
          const { count: inboundCount } = await supabase
            .from("conversations")
            .select("*", { count: "exact", head: true })
            .eq("lead_id", leadId)
            .eq("direction", "inbound")
            .or("channel.is.null,channel.neq.voice")
          enoughToJudge = (inboundCount ?? 0) >= 2
        }

        if (enoughToJudge) {
          const { data: convRows } = await supabase
            .from("conversations")
            .select("direction, body")
            .eq("lead_id", leadId)
            .or("channel.is.null,channel.neq.voice")
            .order("created_at", { ascending: true })
            .limit(30)
          const verdict = await qualificationVerdict({
            disqualifiers: (config?.disqualifiers as string | null) ?? null,
            answers,
            transcript: (convRows ?? []).map((m) => `${m.direction === "inbound" ? "Homeowner" : "Assistant"}: ${m.body}`).join("\n"),
            trade: serviceCopy(company?.service_type as string | null).trade,
            companyId, leadId,
          })
          if (verdict.verdict !== "unknown") {
            // Conditional write: only if the status has not moved since we read it.
            await supabase
              .from("leads")
              .update({ status: verdict.verdict })
              .eq("id", leadId)
              .eq("status", lead!.status)
          }
        }
      }
    } catch {
      // Qualification check is non-blocking
    }
  }

  return { ...result, outboundConversationId }

  } finally {
    if (turnClaimed) {
      await supabase.rpc("release_lead_turn", { p_lead_id: leadId }).then(
        () => {}, (e: unknown) => console.error("[ai-engine] turn-lock release failed:", e))
    }
  }
}

function buildLeadContext(
  lead: Record<string, unknown>,
  appointments: Array<{
    id: string; scheduled_at: string; status: string;
    address?: string | null; notes?: string | null;
    confirmation_sms_sent?: boolean; reminder_1d_sms_sent?: boolean; reminder_2h_sms_sent?: boolean;
    rescheduled_from?: string | null; cancelled_at?: string | null;
  }>,
  timezone: string,
  effectiveServiceType: string | null,
  copy: ServiceCopy = serviceCopy(effectiveServiceType)
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
  const leadMetaCtx = (lead.metadata ?? {}) as Record<string, unknown>
  const fbNameUnverified =
    leadMetaCtx.name_source === "facebook_profile" && leadMetaCtx.name_verified !== true
  let ctx = `=== LEAD FILE (READ THIS BEFORE EVERY RESPONSE) ===
Name: ${`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unknown"}${fbNameUnverified ? ` — FACEBOOK PROFILE NAME, NOT VERIFIED FOR BOOKING. Profile names are often nicknames ("KTrin Brownskin" was really Katrina Lewis). Keep greeting them casually by the first name, but BEFORE the booking recap ask: "And what's your full name for the booking?" — then save their answer with update_lead_details (first_name + last_name) and use THAT name on the recap. The booking will not go through under an unverified profile name.` : ""}
Phone: ${isMessengerOnly ? "NOT ON FILE — this lead is messaging on Facebook Messenger. You MUST collect their phone number naturally before booking (\"What's the best mobile number to reach you on?\"). Do not book without it." : lead.phone}
Service requested: ${effectiveServiceType ?? "home services"}
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


  if (lead.address) ctx += `Street address on file: ${lead.address}\n`
  if ((lead as Record<string, unknown>).zip) ctx += `ZIP code on file: ${(lead as Record<string, unknown>).zip}\n`
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
    const hasZip = /^\d{5}/.test(String(L.zip ?? "").trim())
    const jobTypeStr = String(L.job_type ?? "").trim()
    const hasJobType = !!jobTypeStr

    const mark = (ok: boolean, label: string, note?: string) =>
      `  ${label}: ${ok ? `✓ on file${note ? ` (${note})` : ""}` : "✗ MISSING — collect it"}`

    // A sales conversation books a CALL, not a home visit: no property address
    // exists, but the lead's timezone does — and without it every time we
    // offer is in the wrong clock.
    const isSalesConvo = effectiveServiceType === "fieldbuilt_sales"
    const hasTimezone = !!String(L.timezone ?? "").trim()
    const requiredMissing: string[] = []
    if (!hasAddress && !isSalesConvo) requiredMissing.push("full street address (a zip alone is not an address)")
    if (!hasZip && !hasAddress && !isSalesConvo) requiredMissing.push("zip code (needed to check availability)")
    if (!hasTimezone && isSalesConvo) requiredMissing.push("their time zone (ask before offering times)")
    if (!hasRealPhone) requiredMissing.push("mobile phone number")
    if (!hasName) requiredMissing.push("name")

    const channelLabel =
      channel === "messenger" ? "FACEBOOK MESSENGER" :
      channel === "voice" ? "VOICE CALL" : "SMS / TEXT"

    ctx += `
=== CHANNEL & CONTACT FILE ===
You are talking on: ${channelLabel}
${mark(hasName, "Name")}
${mark(hasRealPhone, "Mobile phone", channel === "sms" ? "this conversation IS their phone — never ask for it" : undefined)}
${mark(hasEmail, "Email")}
${mark(hasAddress, "Street address")}
${mark(hasZip, "ZIP code")}
${mark(hasJobType, "Job type", jobTypeStr || undefined)}
${isSalesConvo ? mark(hasTimezone, "Time zone", String(L.timezone ?? "") || undefined) : ""}

REQUIRED BEFORE BOOKING: ${requiredMissing.length > 0 ? requiredMissing.join(", ") : "nothing — all booking fields are on file"}
${!hasEmail ? "EMAIL — ASK ONCE: ask for their email one time, phrased as the reason it exists: \"And what's your email for the confirmation?\" Ask it BEFORE the booking recap (for example right after they give the address) or AFTER the booking is made. NEVER ask it in reply to their yes on the recap: that yes means book now, in that same turn. Save it with update_lead_details the moment they give it. If they decline or ignore the one ask, move on. A booking is never held up over an email, and you never ask twice." : ""}

CONTACT COLLECTION RULES:
• NEVER ask for anything marked ✓ — re-asking for info already on file destroys trust instantly.
• Collect missing fields INSIDE the natural flow — one question per message, never an intake form.
${channel === "messenger" ? `• MESSENGER SPECIFIC: you have NO phone number for this person. You MUST get a mobile number before booking: the confirmation and the reminders are texted to it. Ask it right before the address: "What's the best mobile number for the confirmation?"` : ""}
${isSalesConvo && !hasTimezone ? `• TIME ZONE — you need it before offering any time, but WORK IT OUT rather than asking when you can. If they have named ANY location anywhere in this conversation (a city, a state, "we're in Phoenix", "all over Texas"), derive the IANA zone yourself and save it with update_lead_details immediately — asking "what time zone are you in?" right after someone told you their city reads as not listening. Only ASK when you genuinely have no location at all: "What time zone are you in? I'll line the times up to your clock." Either way it must be saved BEFORE find_available_slots.` : ""}
${isSalesConvo && hasTimezone ? `• Times you are given by find_available_slots are ALREADY in this lead's own time zone, stamped with their abbreviation. Offer them exactly as written — never add, subtract, or re-label hours.` : ""}
${isSalesConvo
  ? `• THE MOMENT they pick one of the times you offered, call book_appointment in that SAME turn. Do not ask for their email, a confirmation, or anything else first — a chosen slot that isn't booked is a lost appointment. Anything optional can be asked after the booking exists.`
  : `• When they pick one of the times you offered: collect the street address if missing, send the BOOKING RECAP (day and date, window, address) ending in "Sounds good?", and the MOMENT they confirm, call book_appointment in that SAME turn — a confirmed recap that isn't booked is a lost appointment. Anything optional (like email) can be asked after the booking exists.`}
• If a REQUIRED field (listed above) is still missing, you may not book yet — collect it, then book in the same conversation. Optional fields never block a booking.
=== END CHANNEL & CONTACT FILE ===
`
  }

  // Everything the lead already told a form, so the assistant never re-asks it.
  // Internal bookkeeping keys stay out of the prompt.
  if (lead.metadata && typeof lead.metadata === "object" && lead.metadata !== null) {
    const meta = lead.metadata as Record<string, unknown>
    const INTERNAL = new Set([
      "leadgen_id", "page_id", "form_id", "name_source", "name_verified", "service_zip", "ad",
      "qualification", "qualification_asks", "form_answers", "inbound_first_message", "missed_call_at",
      "measure_done_at", "measure_appointment_id", "quote_amount", "quote_sent_at",
    ])
    const lines: string[] = []
    const form = (meta.form_answers && typeof meta.form_answers === "object" ? meta.form_answers : {}) as Record<string, unknown>
    for (const [k, v] of Object.entries(form)) {
      if (v !== null && v !== undefined && String(v).trim()) lines.push(`  ${k}: ${String(v)}`)
    }
    for (const [k, v] of Object.entries(meta)) {
      if (INTERNAL.has(k) || v === null || v === undefined || v === "") continue
      if (typeof v === "object") continue
      lines.push(`  ${k}: ${String(v)}`)
    }
    if (typeof meta.inbound_first_message === "string" && meta.inbound_first_message.trim()) {
      lines.push(`  First message they sent: ${meta.inbound_first_message}`)
    }
    if (lines.length > 0) {
      ctx += `What they told the form (already answered, never ask again):\n${lines.join("\n")}\n`
      const urgencyVal = (meta["urgency"] ?? meta["emergency"] ?? meta["priority"] ?? meta["service_urgency"] ?? "") as string
      if (/emergency|today|urgent|asap|now|immediately/i.test(String(urgencyVal))) {
        ctx += `\nURGENCY FLAG: the lead selected "${urgencyVal}". Offer the EARLIEST available time and keep the questions to the required ones.\n`
      }
    }

    // After the visit: the conversation is about the quote, not about booking.
    if (lead.status === "measure_done" || lead.status === "quote_sent") {
      const amount = typeof meta.quote_amount === "number" || typeof meta.quote_amount === "string" ? String(meta.quote_amount) : ""
      ctx += `
=== QUOTE STAGE (this overrides the booking flow) ===
The ${copy.visit} with this homeowner already happened. ${lead.status === "quote_sent"
  ? `The quote has been sent to them${amount ? " (the amount is on file with the company; you never state it)" : ""}.`
  : "The team is preparing their quote. It has not been marked as sent yet."}
Your job now is to keep the conversation warm and get a clear decision: yes, no, or what is in the way.
- Never state, confirm, discount or negotiate a price. Never promise an install date. If they ask about price, changes to the quote, materials, scheduling the install, or a deposit, say you'll have the team get back to them on that and call update_lead_status "needs_attention".
- If they say YES or want to move forward: thank them, say the team will reach out to lock in the details, and call update_lead_status "needs_attention" so a person does.
- If they clearly say NO, or that they went with someone else: one gracious line, then call update_lead_status "closed_lost".
- If they need time: accept it, ask when a good time to check back is, and stop.
- Do not ask qualifying questions again and do not offer times for another ${copy.visitShort} unless they ask for one.
=== END QUOTE STAGE ===
`
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
    ctx += `\n⚠️ IMPORTANT: If they want to RESCHEDULE, use reschedule_appointment with the appointment ID above and a new time that find_available_slots returned (or one from the AVAILABLE BOOKING SLOTS list, if your prompt has one).
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
  copy: ServiceCopy
): string {
  return `You are ${agentName}, the AI assistant for ${companyName}, a ${copy.trade} company. You work by text message.
${businessDescription ? `About the company: ${businessDescription}` : ""}
${services ? `What the company does: ${services}` : ""}

IDENTITY RULE, NEVER BREAK THIS:
The company you work for is "${companyName}". Every time you introduce yourself or mention who you're texting from, use exactly this name. Never invent, guess, or substitute a different company name. You are an AI assistant and you say so plainly when you introduce yourself and whenever you are asked. Never claim to be a person.

YOUR ONE JOB: qualify the lead and get the ${copy.visit} on the calendar.
You are not the estimator and not the installer. You never give a price for the work, never diagnose a problem, never recommend a specific product or method, and never promise a date for the work itself. The team does all of that at the ${copy.visit}.

HOW YOU WORK:
1. Find out what they want, in their words.
2. Ask the company's qualifying questions, one at a time, and save each answer with update_lead_details. Skip anything they or their form already told you.
3. Once the required questions are answered and nothing disqualifies them, get their zip code (then the full street address), call find_available_slots, and offer two of the times it returns. Never invent a time.
4. When they pick a time: get the full street address if you do not have it, send the booking recap (day, window, address) and ask "Sounds good?". Book only after a clear yes.
5. After booking: one short confirmation with the day, the window and the address.

TONE:
Relaxed, everyday, professional. Text like a competent person at a local company. One idea per message, two sentences at most. Use contractions. No "Certainly", "Absolutely", "Great question", "Perfect". Never repeat back what the lead just said. Plain text only, no markdown, no asterisks, no dashes as punctuation.

HARD RULES:
1. One question per message.
2. Never book without the full street address and a yes to the recap.
3. Never quote a price for the work. The quote comes after the ${copy.visit}.
4. Never ask for something already on the lead file.
5. If the lead says stop or is not interested, one polite line and nothing more.
6. If the lead is frustrated, or is a business rather than a homeowner, or asks for something you cannot do, call update_lead_status "needs_attention" so a person steps in.
7. Anything that sounds like a safety emergency (gas, smoke, fire, flooding with electrical risk): tell them to call 911 first.

The company playbook follows below.`
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
  // LAST 5-digit group — zips end an address; 5-digit street numbers begin it
  // ("29901 Common Rd ... 48066" must yield 48066, not 29901)
  const matches = address.match(/\b\d{5}\b/g)
  return matches?.length ? matches[matches.length - 1] : null
}

/**
 * Infer a structured job_type from the free-text notes the AI wrote at booking.
 * This allows technician specialization matching to work correctly even when
 * the lead record had no job_type set during conversation.
 */
export function inferJobType(notes: string): string | null {
  if (!notes) return null
  const n = notes.toLowerCase()
  if (/commercial|office|retail|storefront/.test(n))                          return "commercial_flooring"
  if (/refinish|sand(ing)? (and|&) (refinish|finish)|resurface/.test(n))      return "refinishing"
  if (/stair|tread|riser|runner/.test(n))                                     return "stairs"
  if (/whole.(home|house)|entire (home|house)|all (the )?(rooms|floors)/.test(n)) return "whole_home"
  if (/engineered/.test(n))                                                   return "engineered_hardwood"
  if (/hardwood|solid wood|oak floor|maple floor/.test(n))                    return "hardwood"
  if (/lvp|luxury vinyl|vinyl plank|vinyl|coretec|lvt/.test(n))               return "lvp"
  if (/laminate/.test(n))                                                     return "laminate"
  if (/carpet/.test(n))                                                       return "carpet"
  if (/tile|backsplash|shower floor/.test(n))                                 return "tile"
  return null
}
