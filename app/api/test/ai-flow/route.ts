/**
 * Full AI conversation flow tester.
 * POST /api/test/ai-flow
 * Body: { scenario: string, messages: string[] }
 *
 * Creates a fresh test lead, runs each message through processAndSave,
 * and returns the full trace — responses, actions, errors, DB state.
 * Never sends real SMS (fake phone number).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { runConversation } from "@/lib/ai-engine"
import { findSlotsForLead } from "@/lib/technician-booking"

const COMPANY_ID = "1b840058-fc41-4c90-9426-039c8088de2a"
const TEST_PHONE  = "+15550000099"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const scenario: string   = body.scenario ?? "unnamed"
  const messages: string[] = body.messages ?? []

  const db = createServiceRoleClient()

  // ── Clean up any previous test lead ──────────────────────────────────────
  const { data: old } = await db.from("leads").select("id").eq("phone", TEST_PHONE).eq("company_id", COMPANY_ID).maybeSingle()
  if (old?.id) {
    await db.from("sequences").delete().eq("lead_id", old.id)
    await db.from("conversations").delete().eq("lead_id", old.id)
    await db.from("appointments").delete().eq("lead_id", old.id)
    await db.from("leads").delete().eq("id", old.id)
  }

  // ── Create fresh test lead ─────────────────────────────────────────────
  const { data: lead, error: leadErr } = await db.from("leads").insert({
    company_id:   COMPANY_ID,
    phone:        TEST_PHONE,
    first_name:   "Test",
    last_name:    "Lead",
    source:       "webhook",
    service_type: "hvac",
    status:       "just_came_in",
    metadata:     { is_test: true, urgency: "this-week" },
  }).select("id").single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: "Failed to create test lead", detail: leadErr }, { status: 500 })
  }

  const trace: Record<string, unknown>[] = []

  // ── Step 0: Initial AI outreach (null message) ────────────────────────
  try {
    const r0 = await runConversation(lead.id, COMPANY_ID, null)
    trace.push({ step: 0, input: null, response: r0.response, action: r0.action ?? null, error: null })

    // Save the outbound message
    if (r0.response) {
      await db.from("conversations").insert({
        lead_id: lead.id, company_id: COMPANY_ID,
        direction: "outbound", sent_by: "ai", body: r0.response, channel: "sms",
      })
    }
  } catch (err) {
    trace.push({ step: 0, input: null, response: null, action: null, error: String(err), stack: (err as Error).stack })
  }

  // ── Steps 1-N: Simulate each inbound message ──────────────────────────
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    try {
      // Save inbound
      await db.from("conversations").insert({
        lead_id: lead.id, company_id: COMPANY_ID,
        direction: "inbound", sent_by: "human", body: msg, channel: "sms",
      })

      const r = await runConversation(lead.id, COMPANY_ID, msg)
      trace.push({ step: i + 1, input: msg, response: r.response, action: r.action ?? null, error: null })

      // Save outbound
      if (r.response) {
        await db.from("conversations").insert({
          lead_id: lead.id, company_id: COMPANY_ID,
          direction: "outbound", sent_by: "ai", body: r.response, channel: "sms",
        })
      }

      // Handle status action
      if (r.action?.type === "update_status") {
        await db.from("leads").update({ status: r.action.status }).eq("id", lead.id)
      }
      if (r.action?.type === "book_appointment") {
        const { scheduled_at, address, notes } = r.action
        await db.from("appointments").insert({
          lead_id: lead.id, company_id: COMPANY_ID,
          scheduled_at, address: address ?? null, notes: notes ?? null,
          status: "scheduled", confirmation_status: "pending_confirmation",
        })
        await db.from("leads").update({ status: "appointment_booked", address: address ?? null }).eq("id", lead.id)
      }
    } catch (err) {
      trace.push({ step: i + 1, input: msg, response: null, action: null, error: String(err), stack: (err as Error).stack })
    }
  }

  // ── Final DB state ────────────────────────────────────────────────────
  const { data: finalLead } = await db.from("leads").select("status, address, job_type").eq("id", lead.id).single()
  const { data: apts }      = await db.from("appointments").select("scheduled_at, address, status, technician_name").eq("lead_id", lead.id)
  const { data: convs }     = await db.from("conversations").select("direction, body").eq("lead_id", lead.id).order("created_at")

  return NextResponse.json({
    scenario,
    leadId: lead.id,
    finalStatus: finalLead?.status,
    appointment: apts?.[0] ?? null,
    trace,
    fullConversation: convs?.map(c => `${c.direction === "inbound" ? "Lead" : "AI"}: ${c.body}`),
  }, { status: 200 })
}

// ── Slot availability check ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const zip     = searchParams.get("zip")      ?? null
  const jobType = searchParams.get("job_type") ?? "ac_repair"

  const testZips = zip ? [zip] : ["33431", "33139", "33301", "33401", "10001", "90210"]

  const results = await Promise.all(testZips.map(async z => {
    const r = await findSlotsForLead(COMPANY_ID, jobType, z)
    return {
      zip: z,
      found: r.found,
      ...(r.found ? { slots: r.slots.length, first: r.slots[0]?.label } : { reason: r.reason }),
    }
  }))

  return NextResponse.json({ jobType, results })
}
