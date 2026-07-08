import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { reconcileCompany } from "@/lib/housecall-sync"

// Reconciliation cron — runs every 15 minutes (same scheduler as /api/cron/follow-up).
// Webhooks make HCP sync fast; this pass makes it TRUE:
//   - pulls every job HCP changed since the last pass (missed webhooks included)
//   - refreshes the technician roster from HCP employees
//   - registers webhooks if not yet registered
//   - retries AI bookings that failed to push into HCP

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createServiceRoleClient()

  const { data: connections } = await db
    .from("hcp_connections")
    .select("company_id")
    .eq("is_active", true)
    .limit(100)

  const results: Record<string, unknown> = {}
  for (const conn of connections ?? []) {
    try {
      results[conn.company_id] = await reconcileCompany(conn.company_id)
    } catch (err) {
      console.error(`[hcp-sync] reconcile failed for ${conn.company_id}:`, err)
      results[conn.company_id] = { error: String(err).slice(0, 200) }
    }
  }

  return NextResponse.json({ companies: (connections ?? []).length, results })
}
