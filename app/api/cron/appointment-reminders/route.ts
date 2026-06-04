import { NextResponse } from "next/server"
import { processAppointmentReminders } from "@/lib/appointment-reminders"

export const runtime = "nodejs"

export async function GET(req: Request) {
  // Accept both Authorization header (preferred) and ?secret= query param for backward compat
  const authHeader = (req as { headers: { get: (k: string) => string | null } }).headers.get("authorization")
  const querySecret = new URL(req.url).searchParams.get("secret")
  const provided = authHeader?.replace("Bearer ", "") ?? querySecret
  if (provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processAppointmentReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/appointment-reminders]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
