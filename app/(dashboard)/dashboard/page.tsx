import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { DashboardClient } from "@/components/dashboard/DashboardClient"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, full_name, companies(name, service_type, avg_job_value, notification_phone)")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) redirect("/onboarding")

  const company = (Array.isArray(profile.companies) ? profile.companies[0] : profile.companies) as {
    name: string; service_type: string | null; avg_job_value: number; notification_phone: string | null;
  } | null

  const now = new Date()
  const startOfMonth = new Date(now); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: totalLeads },
    { count: newLeads },
    { count: contacted },
    { count: qualified },
    { count: booked },
    { count: cold },
    { count: needsAttention },
    { data: recentLeads },
    { data: upcomingApts },
    { count: followUpsSent },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("status", "new"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id).neq("status", "new"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("status", "qualified"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("status", "appointment_booked"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("status", "cold"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("status", "needs_attention"),
    supabase.from("leads").select("id, first_name, last_name, phone, status, source, created_at").eq("company_id", profile.company_id).order("created_at", { ascending: false }).limit(5),
    supabase.from("appointments").select("*, leads(first_name, last_name, phone)").eq("company_id", profile.company_id).eq("status", "scheduled").gte("scheduled_at", now.toISOString()).order("scheduled_at").limit(4),
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("direction", "outbound").eq("sent_by", "ai").gte("created_at", startOfMonth.toISOString()),
  ])

  const bookingRate = contacted && contacted > 0 ? Math.round(((booked ?? 0) / contacted) * 100) : 0
  const avgJobValue = company?.avg_job_value ?? 0
  const revenueProjected = (booked ?? 0) * avgJobValue

  const hour = now.getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = profile.full_name?.split(" ")[0] ?? "there"

  return (
    <DashboardClient
      greeting={greeting}
      firstName={firstName}
      companyName={company?.name ?? ""}
      stats={{
        totalLeads: totalLeads ?? 0,
        newLeads: newLeads ?? 0,
        contacted: contacted ?? 0,
        qualified: qualified ?? 0,
        booked: booked ?? 0,
        cold: cold ?? 0,
        needsAttention: needsAttention ?? 0,
        followUpsSent: followUpsSent ?? 0,
        bookingRate,
        revenueProjected,
        avgJobValue,
      }}
      recentLeads={(recentLeads ?? []) as {
        id: string; first_name: string | null; last_name: string | null;
        phone: string; status: string; source: string; created_at: string;
      }[]}
      upcomingApts={(upcomingApts ?? []) as {
        id: string; scheduled_at: string; address: string | null;
        leads: { first_name: string | null; last_name: string | null; phone: string } | null;
      }[]}
    />
  )
}
