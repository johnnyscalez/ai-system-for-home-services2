import { NextRequest, NextResponse } from "next/server"
import { refreshAllPendingA2p } from "@/lib/a2p"

export const runtime = "nodejs"

// Files every client's texting registration once it is ready, polls Twilio for
// the ones under review and moves them forward (brand approved → campaign
// created → numbers attached), and adds numbers bought after approval.
// Called by cron-worker.mjs every 30 minutes.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await refreshAllPendingA2p()
  if (result.filed > 0 || result.checked > 0) console.log(`[cron/a2p] filed=${result.filed} checked=${result.checked} approved=${result.approved}`)
  return NextResponse.json(result)
}
