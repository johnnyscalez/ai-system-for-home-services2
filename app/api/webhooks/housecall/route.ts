import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getHcpClient } from "@/lib/housecall"
import { upsertJobFromHcp } from "@/lib/housecall-sync"

// Housecall Pro webhook receiver.
// URL registered per company: /api/webhooks/housecall?companyId=<uuid>
// Events: job.created | job.updated | job.completed | job.canceled | customer.created
//
// Strategy: payloads vary by event and can be partial, so we extract the job id,
// fetch the FULL job from the API, and run it through the same upsert logic the
// reconciliation cron uses (lib/housecall-sync.ts). One code path, always coherent.

type HcpWebhookPayload = {
  event?: string
  event_type?: string
  job?: { id?: string }
  customer?: { id?: string }
  data?: { job?: { id?: string }; customer?: { id?: string } }
  [k: string]: unknown
}

export async function POST(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")
  if (!companyId) return NextResponse.json({ ok: true })

  const payload = (await req.json().catch(() => null)) as HcpWebhookPayload | null
  if (!payload) return NextResponse.json({ ok: true })

  const db = createServiceRoleClient()

  const { data: conn } = await db
    .from("hcp_connections")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle()
  if (!conn) return NextResponse.json({ ok: true })

  const eventType = String(payload.event ?? payload.event_type ?? "unknown")
  const jobId = payload.job?.id ?? payload.data?.job?.id ?? null
  const customerId = payload.customer?.id ?? payload.data?.customer?.id ?? null

  const client = await getHcpClient(companyId)
  if (!client) return NextResponse.json({ ok: true })

  try {
    if (jobId) {
      // Fetch the authoritative job state; a 404 on a job we track = deleted in HCP
      try {
        const job = await client.get<Parameters<typeof upsertJobFromHcp>[2]>(`/jobs/${jobId}`)
        await upsertJobFromHcp(companyId, client, job, eventType)
      } catch {
        const { data: apt } = await db
          .from("appointments")
          .select("id, lead_id, status")
          .eq("company_id", companyId)
          .eq("hcp_job_id", jobId)
          .maybeSingle()
        if (apt && apt.status !== "cancelled") {
          await db.from("appointments").update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancellation_reason: "Deleted in Housecall Pro",
            hcp_manually_edited: true,
          }).eq("id", apt.id)
          await db.from("leads").update({ status: "needs_attention" }).eq("id", apt.lead_id)
        }
      }
    } else if (eventType.startsWith("customer") && customerId) {
      // New customer in HCP — link to any un-linked lead by phone/email
      const customer = await client.get<{ id: string; email?: string; mobile_number?: string }>(
        `/customers/${customerId}`
      )
      const digits = (customer.mobile_number ?? "").replace(/\D/g, "").slice(-10)
      if (digits) {
        const { data: leads } = await db
          .from("leads")
          .select("id, phone")
          .eq("company_id", companyId)
          .is("hcp_customer_id", null)
          .like("phone", `%${digits}`)
          .limit(1)
        if (leads?.[0]) {
          await db.from("leads").update({ hcp_customer_id: customerId }).eq("id", leads[0].id)
        }
      }
    }
  } catch (err) {
    console.error(`[hcp-webhook] ${eventType} for company ${companyId} failed:`, err)
  }

  return NextResponse.json({ ok: true })
}
