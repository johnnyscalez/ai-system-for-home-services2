import { anthropic } from "@/lib/claude"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { updateSession } from "@/lib/voice-session"
import { JOB_TYPES, JOB_TYPE_TOOL_DESCRIPTION } from "@/lib/job-types"
import type { VoiceSession } from "@/lib/voice-session"

// ─── Post-call lead intelligence extraction ───────────────────────────────────
//
// During a live call the agent used to write lead details to the CRM turn by
// turn (update_lead_details / add_note tool calls). Every one of those turns
// cost a second sequential Claude call — audible dead air on the phone. Now
// the live call carries zero note-taking duty: when the call completes, this
// runs ONCE over the full transcript with Haiku (cheap, fast) and writes
// everything to the lead file. It sees the whole conversation at once, so the
// extraction is at least as complete as the incremental version was.

type ExtractedIntel = {
  first_name?: string
  last_name?: string
  email?: string
  job_type?: string
  system_type?: string
  system_age?: string
  address?: string
  unit_count?: number
  notes?: string[]
}

const EXTRACT_TOOL = {
  name: "record_lead_intel",
  description: "Record structured lead intelligence extracted from the call transcript.",
  input_schema: {
    type: "object" as const,
    properties: {
      first_name: {
        type: "string",
        description: "The caller's first name, ONLY if they actually said it on the call. Never guess from the phone number or infer it. Omit if never stated.",
      },
      last_name: {
        type: "string",
        description: "The caller's last name, ONLY if actually stated. Omit if never stated.",
      },
      email: {
        type: "string",
        description: "The caller's email address, ONLY if they spelled it out or stated it. Omit otherwise.",
      },
      job_type: {
        type: "string",
        enum: JOB_TYPES as unknown as string[],
        description: JOB_TYPE_TOOL_DESCRIPTION,
      },
      system_type: {
        type: "string",
        description: "Type of HVAC system, in plain English as the lead described it. Examples: 'Central AC', 'Gas furnace', 'Heat pump', 'Mini-split'. Omit if never mentioned.",
      },
      system_age: {
        type: "string",
        description: "Age of the system, verbatim as the lead said it: '15 years', 'about 10 years', 'no idea'. Omit if never mentioned.",
      },
      address: {
        type: "string",
        description: "The FULL service street address (house number + street, plus city/zip if said), ONLY if actually stated on the call. If the caller CORRECTED an address, record the FINAL corrected version. NEVER a bare zip code. Omit if no street address was spoken.",
      },
      unit_count: {
        type: "number",
        description: "How many furnaces/systems the home has — the FINAL corrected count if the caller changed it mid-call ('two… actually one' → 1). Omit if never discussed.",
      },
      notes: {
        type: "array",
        items: { type: "string" },
        description:
          "Short factual notes the next person contacting this lead must know. Include ONLY things actually said on the call: objections, competitor quotes with amounts, spouse/partner approval needed, budget concerns, access details (gate codes, dogs), scheduling preferences, urgency, homeowner vs renter, issue symptoms worth remembering. One fact per note. No filler, no restating the appointment itself.",
      },
    },
  },
}

/** Flatten session messages into a readable transcript, skipping tool machinery. */
function buildTranscript(session: VoiceSession): string {
  const lines: string[] = []
  for (const m of session.messages ?? []) {
    if (typeof m.content === "string") {
      // Skip injected system-style direction hints
      if (m.role === "user" && /^(\(SYSTEM|INBOUND CALL|OUTBOUND CALL|CALLBACK)/.test(m.content)) continue
      lines.push(`${m.role === "user" ? "Lead" : "Agent"}: ${m.content}`)
    } else if (Array.isArray(m.content)) {
      for (const block of m.content as Array<{ type?: string; text?: string }>) {
        if (block.type === "text" && block.text?.trim()) {
          lines.push(`${m.role === "user" ? "Lead" : "Agent"}: ${block.text.trim()}`)
        }
      }
    }
  }
  return lines.join("\n")
}

/** Extract lead intel from a completed call and persist it to the lead file.
 *  Safe to call on any call end — bails on empty/near-empty transcripts and
 *  guards against running twice for the same call. */
export async function summarizeCompletedCall(session: VoiceSession): Promise<void> {
  if (session.collected?.post_call_summary === "true") return

  const transcript = buildTranscript(session)
  // No-answer, instant hangups, voicemail drops — nothing to extract
  if (transcript.split("\n").filter((l) => l.startsWith("Lead:")).length < 2) return

  // Mark BEFORE the model call — a duplicate status webhook arriving mid-run
  // must not double-extract (double notes on the lead file).
  await updateSession(session.call_sid, {
    collected: { ...session.collected, post_call_summary: "true" },
  })

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_lead_intel" },
    messages: [
      {
        role: "user",
        content:
          `Below is the transcript of a phone call between an HVAC company's scheduling agent and a lead. ` +
          `Extract the lead intelligence. Record only what was actually said — for job_type, ` +
          `pick the job discussed on the call; if it's ambiguous between repair and replacement, ` +
          `choose repair unless the lead explicitly wanted a replacement.\n\n<transcript>\n${transcript}\n</transcript>`,
      },
    ],
  })

  const toolBlock = response.content.find((b) => b.type === "tool_use")
  if (!toolBlock || toolBlock.type !== "tool_use") return
  const intel = toolBlock.input as ExtractedIntel

  const db = createServiceRoleClient()

  const updates: Record<string, string> = {}
  if (intel.job_type && (JOB_TYPES as unknown as string[]).includes(intel.job_type)) {
    updates.job_type = intel.job_type
  }
  if (intel.system_type?.trim()) updates.system_type = intel.system_type.trim()
  if (intel.system_age?.trim())  updates.system_age  = intel.system_age.trim()

  // Identity: fill ONLY what's still blank — a name captured earlier (lead
  // form, prior conversation) is more trustworthy than one heard over the
  // phone, and must never be overwritten by a transcription artifact.
  const cleanName = (v: string | undefined) => {
    const s = (v ?? "").trim().replace(/^[\s,.]+|[\s,.]+$/g, "")
    if (!s || s.length > 60) return null
    if (/^(unknown|n\/?a|none|null|customer|caller|sir|ma.?am)$/i.test(s)) return null
    return s
  }
  const { data: existing } = await db
    .from("leads").select("first_name, last_name, email").eq("id", session.lead_id).single()
  const first = cleanName(intel.first_name)
  const last = cleanName(intel.last_name)
  if (first && !existing?.first_name) updates.first_name = first
  if (last && !existing?.last_name) updates.last_name = last
  if (intel.email && !existing?.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(intel.email.trim())) {
    updates.email = intel.email.trim().toLowerCase()
  }

  if (Object.keys(updates).length > 0) {
    await db.from("leads").update(updates).eq("id", session.lead_id)
  }

  // Address and unit-count corrections heard on the call: LAST CONFIRMED
  // WINS, and the shared writer propagates the address onto the active
  // appointment (and flags an HCP-pushed job for a manual fix) — the same
  // path the SMS/Messenger tool uses.
  if (intel.address?.trim() || typeof intel.unit_count === "number") {
    try {
      const { saveLeadDetailsForLead } = await import("@/lib/ai-engine")
      await saveLeadDetailsForLead(db, session.lead_id, session.company_id, {
        address: intel.address?.trim() || undefined,
        unit_count: typeof intel.unit_count === "number" ? intel.unit_count : undefined,
      })
    } catch (err) {
      console.error("[call-notes] address/unit-count save failed:", err)
    }
  }

  const noteLines = (intel.notes ?? []).map((n) => n.trim()).filter(Boolean)
  if (noteLines.length > 0) {
    const { data: settings } = await db
      .from("settings").select("timezone").eq("company_id", session.company_id).single()
    const tz = settings?.timezone ?? "America/New_York"
    const ts = new Date().toLocaleString("en-US", { timeZone: tz })
    const stamped = noteLines.map((n) => `[${ts}] ${n}`).join("\n")
    const { data: lead } = await db.from("leads").select("notes").eq("id", session.lead_id).single()
    const merged = lead?.notes ? `${lead.notes}\n${stamped}` : stamped
    await db.from("leads").update({ notes: merged }).eq("id", session.lead_id)
  }
}
