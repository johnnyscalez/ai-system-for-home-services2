/**
 * Smart-dispatch verification for the voice/SMS slot engine.
 * GET /api/test/dispatch?zip=33431&job_type=ac_repair
 *
 * Three phases, fully self-cleaning (all test rows deleted in `finally`):
 *  1. BASELINE  — findSlotsForLead, record the first slot + assigned tech
 *  2. ALL BUSY  — block every active tech at that slot → the window must
 *                 disappear from the offers (busy-interval overlap logic)
 *  3. WINNER BUSY — block only the baseline winner → the window must come
 *                 back with a DIFFERENT tech assigned (conflict re-routing)
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { findSlotsForLead } from "@/lib/technician-booking"

const COMPANY_ID = "1b840058-fc41-4c90-9426-039c8088de2a"
const TEST_PHONE = "+15550000077"
const BLOCKER_NOTE = "DISPATCH_TEST_BLOCKER — auto-deleted"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const zip     = searchParams.get("zip")      ?? "33431"
  const jobType = searchParams.get("job_type") ?? "ac_repair"

  const db = createServiceRoleClient()
  const results: Record<string, unknown> = {}
  let testLeadId: string | null = null

  try {
    // Test lead to attach blocker appointments to
    const { data: lead } = await db.from("leads").insert({
      company_id: COMPANY_ID, phone: TEST_PHONE, first_name: "Dispatch", last_name: "Test",
      source: "webhook", service_type: "hvac", status: "new", metadata: { is_test: true },
    }).select("id").single()
    if (!lead) return NextResponse.json({ error: "failed to create test lead" }, { status: 500 })
    testLeadId = lead.id

    const { data: techs } = await db.from("technicians")
      .select("id, name").eq("company_id", COMPANY_ID).eq("status", "active")
    const activeTechs = techs ?? []

    // ── Phase 1: baseline ────────────────────────────────────────────────
    const baseline = await findSlotsForLead(COMPANY_ID, jobType, zip)
    if (!baseline.found) {
      return NextResponse.json({ error: "no baseline slots", reason: baseline.reason }, { status: 500 })
    }
    const target = baseline.slots[0]
    results.phase1_baseline = {
      slot: target.label, iso: target.isoStart, assignedTech: target.techName,
      totalSlots: baseline.slots.length,
    }

    // ── Phase 2: block ALL techs at that slot ────────────────────────────
    await db.from("appointments").insert(activeTechs.map(t => ({
      company_id: COMPANY_ID, lead_id: testLeadId, scheduled_at: target.isoStart,
      address: "100 Blocker St, Miami, FL 33101", status: "scheduled",
      notes: BLOCKER_NOTE, technician_id: t.id, technician_name: t.name,
    })))

    const allBusy = await findSlotsForLead(COMPANY_ID, jobType, zip)
    const windowGone = allBusy.found && !allBusy.slots.some(s => s.isoStart === target.isoStart)
    results.phase2_all_techs_busy = {
      pass: windowGone,
      expected: `slot ${target.label} removed from offers`,
      firstOfferedNow: allBusy.found ? allBusy.slots[0]?.label : allBusy.reason,
    }

    // ── Phase 3: block ONLY the baseline winner ──────────────────────────
    await db.from("appointments").delete()
      .eq("lead_id", testLeadId).eq("notes", BLOCKER_NOTE)
      .neq("technician_name", target.techName)

    const winnerBusy = await findSlotsForLead(COMPANY_ID, jobType, zip)
    const sameWindow = winnerBusy.found ? winnerBusy.slots.find(s => s.isoStart === target.isoStart) : undefined
    results.phase3_winner_busy = {
      pass: !!sameWindow && sameWindow.techName !== target.techName,
      expected: `slot ${target.label} offered again with a tech other than ${target.techName}`,
      reassignedTo: sameWindow?.techName ?? "(window not offered)",
    }

    const allPass =
      (results.phase2_all_techs_busy as { pass: boolean }).pass &&
      (results.phase3_winner_busy as { pass: boolean }).pass
    return NextResponse.json({ allPass, activeTechs: activeTechs.map(t => t.name), ...results })
  } finally {
    // Self-cleaning — no test rows survive this request
    if (testLeadId) {
      await db.from("appointments").delete().eq("lead_id", testLeadId)
      await db.from("leads").delete().eq("id", testLeadId)
    }
  }
}
