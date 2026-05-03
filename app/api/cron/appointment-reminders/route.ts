import { NextResponse } from "next/server"
import { processAppointmentReminders } from "@/lib/appointment-reminders"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET) {
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
