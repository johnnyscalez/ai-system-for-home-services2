import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { CalendarPageClient } from "@/components/calendar/CalendarPageClient"

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const { data: agentCfg } = await supabase
    .from("ai_agent_config")
    .select("timezone")
    .eq("company_id", profile.company_id)
    .maybeSingle()
  const companyTz = (agentCfg?.timezone as string | null) ?? "America/New_York"

  const { data: gcal } = await supabase
    .from("google_calendar_connections")
    .select("is_connected, google_email")
    .eq("company_id", profile.company_id)
    .single()

  return (
    <CalendarPageClient
      isGcalConnected={gcal?.is_connected ?? false}
      gcalEmail={gcal?.google_email}
      timezone={companyTz}
    />
  )
}
