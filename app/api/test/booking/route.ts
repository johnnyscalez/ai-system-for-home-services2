import { NextResponse } from "next/server"
import { findSlotsForLead } from "@/lib/technician-booking"
import { createServiceRoleClient } from "@/lib/supabase-server"

// GET /api/test/booking?company_id=...&job_type=...&zip=...
// Directly exercises findSlotsForLead and processAndSave booking path.
// Only runs in non-production or when ALLOW_TEST_ROUTES=true.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const db = createServiceRoleClient()

  // Resolve company_id — accept explicit param or look up by owner email
  let companyId = searchParams.get("company_id")
  if (!companyId) {
    const email = searchParams.get("email") ?? "jonathan@scalezz.com"
    const { data: u } = await db.from("users").select("company_id").eq("email", email).single()
    companyId = u?.company_id ?? null
  }
  if (!companyId) return NextResponse.json({ error: "company_id not found" }, { status: 400 })

  const jobType  = searchParams.get("job_type")  ?? null
  const zip      = searchParams.get("zip")        ?? null

  const scenarios = jobType
    ? [{ label: `${jobType} @ zip=${zip ?? "any"}`, jobType, zip }]
    : [
        { label: "AC repair @ 75201 (Mike covers)", jobType: "ac_repair", zip: "75201" },
        { label: "Furnace repair @ 75206 (Sarah covers)", jobType: "furnace_repair", zip: "75206" },
        { label: "AC repair @ 75210 (no tech covers this zip)", jobType: "ac_repair", zip: "75210" },
        { label: "Plumbing (no tech has this spec)", jobType: "plumbing", zip: "75201" },
        { label: "General (any tech)", jobType: "general", zip: "75201" },
      ]

  const results: Record<string, unknown>[] = []

  for (const s of scenarios) {
    const result = await findSlotsForLead(companyId, s.jobType, s.zip)
    results.push({
      scenario: s.label,
      found: result.found,
      ...(result.found
        ? { slotCount: result.slots.length, slots: result.slots.slice(0, 3) }
        : { reason: result.reason }),
    })
  }

  // Also verify the slot→tech map structure that gets saved to leads.selected_slots
  const slotMapExample: Record<string, { tech_id: string; tech_name: string }> = {}
  const firstFound = results.find(r => r.found)
  if (firstFound && Array.isArray((firstFound as { slots?: unknown[] }).slots)) {
    const slots = (firstFound as { slots: { isoStart: string; techId: string; techName: string }[] }).slots
    for (const s of slots.slice(0, 3)) {
      slotMapExample[s.isoStart.substring(0, 16)] = { tech_id: s.techId, tech_name: s.techName }
    }
  }

  return NextResponse.json({
    companyId,
    results,
    slotMapExample,
    note: "slotMapExample shows the structure saved to leads.selected_slots. Keys are YYYY-MM-DDTHH:MM.",
  })
}
