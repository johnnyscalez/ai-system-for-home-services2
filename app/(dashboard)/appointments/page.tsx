import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { AppointmentsCalendar } from "./AppointmentsCalendar"
import { DEFAULT_WINDOWS, DEFAULT_DAYS } from "@/lib/availability"
import type { AppointmentWindow } from "@/lib/availability"

export default async function AppointmentsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()
  if (!profile?.company_id) redirect("/onboarding")

  const { data: config } = await supabase
    .from("ai_agent_config")
    .select("timezone, available_days, appointment_windows, booking_horizon_days")
    .eq("company_id", profile.company_id)
    .single()

  const timezone          = config?.timezone ?? "America/New_York"
  const availableDays     = (config?.available_days as string[] | null)          ?? DEFAULT_DAYS
  const appointmentWindows = (config?.appointment_windows as AppointmentWindow[] | null) ?? DEFAULT_WINDOWS

  return (
    <div className="relative min-h-screen">
      {/* Visual background layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(249,115,22,0.05)", top: "-10%", left: "-5%" }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.04)", bottom: "-5%", right: "-5%" }}
        />
      </div>

      <div className="relative z-10 p-6 max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Booked by your AI agent · updates in real-time · click any slot to manage it
          </p>
        </div>

        <AppointmentsCalendar
          companyId={profile.company_id}
          timezone={timezone}
          availableDays={availableDays}
          appointmentWindows={appointmentWindows}
        />
      </div>
    </div>
  )
}
