import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { WeekCalendar } from "@/components/calendar/WeekCalendar"
import { AvailabilityPanel } from "@/components/calendar/AvailabilityPanel"
import { CalendarCheck, ExternalLink } from "lucide-react"

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const { data: gcal } = await supabase
    .from("google_calendar_connections")
    .select("is_connected, google_email")
    .eq("company_id", profile.company_id)
    .single()

  const isGcalConnected = gcal?.is_connected ?? false

  return (
    <div className="flex flex-col h-screen">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold">Calendar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">All booked appointments at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          {isGcalConnected ? (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-muted-foreground">Google Calendar synced</span>
              <span className="text-emerald-400 font-medium">{gcal?.google_email}</span>
            </div>
          ) : (
            <a
              href="/api/auth/google-calendar"
              className="flex items-center gap-2 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              Connect Google Calendar
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Availability panel — collapsible, sits above the calendar */}
      <AvailabilityPanel />

      {/* Calendar fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <WeekCalendar />
      </div>
    </div>
  )
}
