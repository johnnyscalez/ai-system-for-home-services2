import { redirect } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { TechWeekCalendar } from "@/components/tech/TechWeekCalendar"

export const dynamic = "force-dynamic"

export default async function TechCalendarPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/tech/login")
  if (user.app_metadata?.role !== "technician") redirect("/dashboard")

  const db = createServiceRoleClient()
  const { data: tech } = await db
    .from("technicians")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) redirect("/tech/login")

  // Fetch the next 30 days — client handles week slicing
  const now = new Date()
  const start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0)
  const end   = new Date(now); end.setDate(now.getDate() + 30);   end.setHours(23, 59, 59)

  const { data: appointments } = await db
    .from("appointments")
    .select(`
      id, scheduled_at, address, notes, status, technician_name,
      leads(id, first_name, last_name, phone, service_type, job_type, status)
    `)
    .eq("technician_id", tech.id)
    .eq("company_id", tech.company_id)
    .neq("status", "cancelled")
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString())
    .order("scheduled_at", { ascending: true })

  return (
    <div className="relative flex flex-col h-screen bg-[#FAFAF8] overflow-hidden">
      {/* Header */}
      <div className="relative z-10 px-6 py-4 border-b border-[#E7E5E4] bg-white/90 backdrop-blur-sm shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1C1917]">My Calendar</h1>
          <p className="text-xs text-[#78716C] mt-0.5">All your scheduled jobs at a glance</p>
        </div>
      </div>

      {/* Calendar fills remaining height */}
      <div className="relative z-10 flex-1 min-h-0 bg-white/60">
        <TechWeekCalendar initialAppointments={(appointments ?? []) as never} />
      </div>
    </div>
  )
}
