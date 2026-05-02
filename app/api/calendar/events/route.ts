import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCalendarEvents } from "@/lib/google-calendar"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const timeMin = searchParams.get("timeMin")
  const timeMax = searchParams.get("timeMax")
  if (!timeMin || !timeMax) return NextResponse.json({ error: "Missing params" }, { status: 400 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ googleEvents: [], appointments: [] })

  // Get appointments from our DB
  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, leads(first_name, last_name, phone, status)")
    .eq("company_id", profile.company_id)
    .gte("scheduled_at", timeMin)
    .lte("scheduled_at", timeMax)
    .order("scheduled_at")

  // Get Google Calendar events if connected
  const { data: gcal } = await supabase
    .from("google_calendar_connections")
    .select("access_token, refresh_token, calendar_id, is_connected")
    .eq("company_id", profile.company_id)
    .single()

  let googleEvents: object[] = []
  if (gcal?.is_connected && gcal.access_token && gcal.refresh_token) {
    try {
      const saveRefreshedToken = async (newToken: string) => {
        await supabase
          .from("google_calendar_connections")
          .update({ access_token: newToken })
          .eq("company_id", profile.company_id)
      }
      googleEvents = await getCalendarEvents(
        gcal.access_token,
        gcal.refresh_token,
        gcal.calendar_id ?? "primary",
        timeMin,
        timeMax,
        saveRefreshedToken
      )
    } catch (err) {
      console.error("[calendar/events] Google Calendar fetch failed:", err)
      googleEvents = []
    }
  }

  return NextResponse.json({ appointments: appointments ?? [], googleEvents })
}
