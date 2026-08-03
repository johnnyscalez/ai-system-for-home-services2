import { createServiceRoleClient } from "@/lib/supabase-server"
import { anthropic } from "@/lib/claude"

/**
 * Deterministic backstop for lead names.
 *
 * The agent is instructed to save a name via update_lead_details the moment it
 * hears one, and usually does — but "usually" is not good enough at the seam
 * where it matters: a nameless lead becomes a Housecall Pro customer literally
 * called "Unknown", which is what the technician then sees on their schedule.
 * Observed live in a Spanish-language thread where the agent greeted the
 * customer by name in its reply and simply never called the tool.
 *
 * So rather than trusting the model to remember, we re-read the transcript
 * once, at booking time, whenever the name is still missing. One cheap Haiku
 * call per booking, only when needed.
 *
 * No-ops (zero cost) when the lead already has a name.
 */
export async function ensureLeadName(leadId: string): Promise<void> {
  const db = createServiceRoleClient()

  const { data: lead } = await db
    .from("leads").select("id, first_name, last_name").eq("id", leadId).maybeSingle()
  if (!lead || lead.first_name) return

  const { data: msgs } = await db
    .from("conversations")
    .select("direction, body")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(40)
  if (!msgs?.length) return

  const transcript = msgs
    .map((m) => `${m.direction === "inbound" ? "Customer" : "Agent"}: ${m.body ?? ""}`)
    .join("\n")
    .slice(-6000)

  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      tools: [{
        name: "record_name",
        description: "Record the customer's name as stated in the conversation.",
        input_schema: {
          type: "object" as const,
          properties: {
            first_name: { type: "string", description: "Customer's first name, exactly as they gave it. Omit if never stated." },
            last_name: { type: "string", description: "Customer's last name, exactly as given. Omit if never stated." },
          },
        },
      }],
      tool_choice: { type: "any" },
      messages: [{
        role: "user",
        content:
          `Read this conversation and extract ONLY the customer's own name, if they stated it.\n\n` +
          `Rules: the customer is the one labelled "Customer". Ignore the agent's name, the company name, ` +
          `technician names, and street names. Any language is fine — keep the name in its original spelling ` +
          `and accents. If the customer never gave a name, omit both fields.\n\n${transcript}`,
      }],
    })

    const block = res.content.find((b) => b.type === "tool_use")
    if (!block || block.type !== "tool_use") return
    const out = block.input as { first_name?: string; last_name?: string }

    const clean = (v: string | undefined) => {
      const s = (v ?? "").trim().replace(/^[\s,.]+|[\s,.]+$/g, "")
      if (!s || s.length > 60) return null
      if (/^(unknown|n\/?a|none|null|customer|cliente|lead|there|sir|ma.?am)$/i.test(s)) return null
      return s
    }
    const first = clean(out.first_name)
    const last = clean(out.last_name)
    if (!first && !last) return

    const patch: Record<string, string> = {}
    if (first) patch.first_name = first
    if (last && !lead.last_name) patch.last_name = last
    if (Object.keys(patch).length === 0) return

    await db.from("leads").update(patch).eq("id", leadId)
    console.log(`[lead-name] recovered name for lead ${leadId}: ${JSON.stringify(patch)}`)
  } catch (err) {
    // Never block a booking over this
    console.error("[lead-name] extraction failed:", err)
  }
}
