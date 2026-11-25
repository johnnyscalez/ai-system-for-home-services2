import { NextRequest, NextResponse } from "next/server"
import { refreshAllPendingA2p } from "@/lib/a2p"

export const runtime = "nodejs"

// Polls Twilio for every texting registration that is still under review and
// moves it forward (brand approved → campaign created → number attached).
// Called by cron-worker.mjs every 30 minutes.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await refreshAllPendingA2p()
  if (result.checked > 0) console.log(`[cron/a2p] checked=${result.checked} approved=${result.approved}`)
  return NextResponse.json(result)
}
