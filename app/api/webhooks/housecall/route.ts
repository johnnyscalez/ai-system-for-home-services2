import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

// Housecall Pro webhook receiver.
// URL registered per company: /api/webhooks/housecall?companyId=<uuid>
//
// Attribution model (customer-level — see docs/after-hours-pivot.md):
// every job event is matched against leads the AI sourced (leads.hcp_customer_id).
// - Event on a job WE created (appointments.hcp_job_id match)  → attribution: booked_by_ai
// - Event on another job for an AI-sourced customer            → attribution: sourced_by_ai
//   (covers office re-bookings and estimate→install conversions; the linked
//    appointment is tagged hcp_manually_edited)
// - No match                                                   → unattributed (logged for debugging)
//
// Exact payload field names are confirmed against live webhooks during the
// pilot — extraction below is defensive across the shapes HCP documents.

type HcpWebhookPayload = {
  event?: string
  event_type?: string
  job?: { id?: string; customer?: { id?: string }; total_amount?: number; work_status?: string }
  customer?: { id?: string }
  data?: Record<string, unknown>
  [k: string]: unknown
}

function extract(payload: HcpWebhookPayload) {
  const data = (payload.data ?? {}) as Record<string, unknown>
  const dataJob = (data.job ?? data) as Record<string, unknown>
  const job = payload.job ?? (typeof dataJob === "object" ? dataJob as HcpWebhookPayload["job"] : undefined)

  const eventType =
    payload.event ?? payload.event_type ?? (typeof data.event === "string" ? data.event : "unknown")

  const jobId = job?.id ? String(job.id) : undefined
  const customerId =
    job?.customer?.id ? String(job.customer.id)
    : payload.customer?.id ? String(payload.customer.id)
    : undefined

  // HCP amounts are documented as cents in some payloads, dollars in others —
  // stored raw here, normalized when live payloads confirm the unit.
  const amount = typeof job?.total_amount === "number" ? job.total_amount : undefined

  return { eventType: String(eventType), jobId, customerId, amount }
}

export async function POST(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")
  if (!companyId) return NextResponse.json({ ok: true })

  const payload = (await req.json().catch(() => null)) as HcpWebhookPayload | null
  if (!payload) return NextResponse.json({ ok: true })

  const db = createServiceRoleClient()

  // Only accept events for companies with an active HCP connection
  const { data: conn } = await db
    .from("hcp_connections")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle()
  if (!conn) return NextResponse.json({ ok: true })

  const { eventType, jobId, customerId, amount } = extract(payload)

  // 1. Direct match: a job the AI created
  let leadId: string | null = null
  let attribution = "unattributed"

  if (jobId) {
    const { data: apt } = await db
      .from("appointments")
      .select("id, lead_id")
      .eq("company_id", companyId)
      .eq("hcp_job_id", jobId)
      .maybeSingle()

    if (apt) {
      leadId = apt.lead_id
      attribution = "booked_by_ai"
      // Office edited/cancelled a job the AI booked → tag it, keep attribution
      if (/updated|canceled|cancelled|deleted|rescheduled/i.test(eventType)) {
        await db
          .from("appointments")
          .update({ hcp_manually_edited: true })
          .eq("id", apt.id)
      }
    }
  }

  // 2. Customer-level match: any other job for an AI-sourced customer
  if (!leadId && customerId) {
    const { data: lead } = await db
      .from("leads")
      .select("id")
      .eq("company_id", companyId)
      .eq("hcp_customer_id", customerId)
      .maybeSingle()
    if (lead) {
      leadId = lead.id
      attribution = "sourced_by_ai"
    }
  }

  await db.from("hcp_revenue_events").insert({
    company_id:      companyId,
    lead_id:         leadId,
    hcp_customer_id: customerId ?? null,
    hcp_job_id:      jobId ?? null,
    event_type:      eventType,
    amount_cents:    amount != null ? Math.round(amount) : null,
    attribution,
    raw_payload:     payload,
  })

  return NextResponse.json({ ok: true })
}
