import { redirect } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { TechAppointmentsList, type AppointmentWithLead } from "@/components/tech/TechAppointmentsList"

export const dynamic = "force-dynamic"

export default async function TechAppointmentsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/tech/login")
  if (user.app_metadata?.role !== "technician") redirect("/dashboard")

  const db = createServiceRoleClient()

  const { data: tech } = await db
    .from("technicians")
    .select("id, name, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) redirect("/tech/login")

  const { data: appointments } = await db
    .from("appointments")
    .select(`
      id, scheduled_at, address, notes, status,
      leads(id, first_name, last_name, phone, address, service_type, job_type, status)
    `)
    .eq("technician_id", tech.id)
    .eq("company_id", tech.company_id)
    .order("scheduled_at", { ascending: true })

  const now      = new Date()
  const all      = (appointments ?? []) as unknown as AppointmentWithLead[]
  const upcoming = all.filter(a => new Date(a.scheduled_at) >= now && a.status === "scheduled")
  const past     = all.filter(a => new Date(a.scheduled_at) < now || a.status !== "scheduled")

  return (
    <TechAppointmentsList
      upcoming={upcoming}
      past={past}
      techName={tech.name}
    />
  )
}
