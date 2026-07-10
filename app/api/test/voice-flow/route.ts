/**
 * Voice AI conversation flow tester.
 * POST /api/test/voice-flow
 * Body: { scenario?: string, messages?: string[], direction?: "inbound" | "outbound" }
 *
 * Creates a fresh test lead + voice session, runs each message through runVoiceTurn,
 * and returns the full trace. Never makes a real phone call.
 * Call ends automatically when the engine returns action "end" or "transfer".
 *
 * GET /api/test/voice-flow?zip=33431&job_type=ac_repair
 * Same slot availability check as the SMS tester.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { runVoiceTurn } from "@/lib/voice-engine"
import { getOrCreateSession } from "@/lib/voice-session"
import { findSlotsForLead } from "@/lib/technician-booking"
import type { VoiceSession } from "@/lib/voice-session"

const COMPANY_ID    = "1b840058-fc41-4c90-9426-039c8088de2a"
const TEST_PHONE    = "+15550000088"
const TEST_CALL_SID = "CA_TEST_VOICE_FLOW_001"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const scenario: string              = body.scenario  ?? "unnamed"
  const messages: string[]            = body.messages  ?? []
  const direction: "inbound" | "outbound" = body.direction ?? "outbound"

  const db = createServiceRoleClient()

  // ── Clean up previous test session + lead ─────────────────────────────
  await db.from("voice_sessions").delete().eq("call_sid", TEST_CALL_SID)

  const { data: old } = await db.from("leads")
    .select("id")
    .eq("phone", TEST_PHONE)
    .eq("company_id", COMPANY_ID)
    .maybeSingle()
  if (old?.id) {
    await Promise.all([
      db.from("conversations").delete().eq("lead_id", old.id),
      db.from("appointments").delete().eq("lead_id", old.id),
    ])
    await db.from("leads").delete().eq("id", old.id)
  }

  // ── Create fresh test lead ─────────────────────────────────────────────
  const { data: lead, error: leadErr } = await db.from("leads").insert({
    company_id:   COMPANY_ID,
    phone:        TEST_PHONE,
    first_name:   "Marcus",
    last_name:    "TestLead",
    source:       "webhook",
    service_type: "hvac",
    status:       "new",
    metadata:     { is_test: true, "What's going on with your HVAC?": "AC is running but not cooling" },
  }).select("id").single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: "Failed to create test lead", detail: leadErr }, { status: 500 })
  }

  // ── Create voice session ───────────────────────────────────────────────
  const session = await getOrCreateSession(TEST_CALL_SID, lead.id, COMPANY_ID, direction)

  const trace: Record<string, unknown>[] = []

  // ── Step 0: Greeting turn (null = call just connected) ─────────────────
  try {
    const r0 = await runVoiceTurn(session, null)
    trace.push({ step: 0, role: "Linda", input: "(call connected)", response: r0.text, action: r0.action, error: null })
  } catch (err) {
    trace.push({ step: 0, role: "Linda", input: "(call connected)", response: null, action: null, error: String(err) })
    const { data: finalLead } = await db.from("leads").select("status, address, job_type, system_type, system_age").eq("id", lead.id).single()
    return NextResponse.json({ scenario, leadId: lead.id, direction, abortedAt: 0, finalStatus: finalLead?.status, trace }, { status: 200 })
  }

  // ── Steps 1-N: Simulate each spoken message ────────────────────────────
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    try {
      // Re-read session after each turn to pick up updated messages state
      const { data: updated } = await db.from("voice_sessions")
        .select("*")
        .eq("call_sid", TEST_CALL_SID)
        .single()
      if (!updated) throw new Error("Session not found after turn")

      const r = await runVoiceTurn(updated as VoiceSession, msg)
      trace.push({ step: i + 1, role: "Linda", input: msg, response: r.text, action: r.action, error: null })

      if (r.action.type === "end" || r.action.type === "transfer") break
    } catch (err) {
      trace.push({ step: i + 1, role: "Linda", input: msg, response: null, action: null, error: String(err) })
    }
  }

  // ── Final DB state ─────────────────────────────────────────────────────
  const [{ data: finalLead }, { data: apts }, { data: convs }] = await Promise.all([
    db.from("leads").select("status, address, job_type, system_type, system_age").eq("id", lead.id).single(),
    db.from("appointments").select("scheduled_at, address, status, technician_name, technician_id").eq("lead_id", lead.id),
    db.from("conversations").select("direction, body, channel").eq("lead_id", lead.id).order("created_at"),
  ])

  return NextResponse.json({
    scenario,
    leadId:      lead.id,
    direction,
    finalStatus: finalLead?.status,
    jobType:     finalLead?.job_type,
    systemType:  finalLead?.system_type,
    systemAge:   finalLead?.system_age,
    appointment: apts?.[0] ?? null,
    smartDispatch: apts?.[0] ? {
      technicianName: apts[0].technician_name,
      technicianId:   apts[0].technician_id,
      scheduledAt:    apts[0].scheduled_at,
    } : null,
    trace,
    fullConversation: convs?.map(c =>
      `${c.direction === "inbound" ? "Lead" : "Linda"}: ${c.body}`
    ),
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
      ...(r.found ? {
        slots:         r.slots.length,
        first:         r.slots[0]?.label,
        techAssigned:  r.slots[0]?.techName,
        allSlots:      r.slots.map(s => ({ label: s.label, tech: s.techName, iso: s.isoStart })),
      } : { reason: r.reason }),
    }
  }))

  return NextResponse.json({ jobType, results })
}
