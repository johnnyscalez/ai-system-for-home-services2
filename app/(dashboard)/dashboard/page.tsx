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
  // Default window: last 30 days
  const since30d = new Date(now)
  since30d.setDate(since30d.getDate() - 30)
  since30d.setHours(0, 0, 0, 0)
  const sinceIso = since30d.toISOString()

  const [
    { count: newLeads },
    { count: booked },
    { count: qualified },
    { count: cold },
    { count: needsAttention },
    { count: followUpsSent },
    { data: recentLeads },
    { data: upcomingApts },
    closedLeadsRes,
  ] = await Promise.all([
    // Leads that came in during the last 30 days
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .gte("created_at", sinceIso),
    // Appointments booked in the last 30 days
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "scheduled")
      .gte("created_at", sinceIso),
    // Hot leads: replied but haven't booked yet
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .in("status", ["active_conversation", "qualified", "nurturing"]),
    // Cold leads: no inbound reply in 7+ days (regardless of exact status label)
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .not("status", "in", '("closed","closed_won","closed_lost","unqualified","appointment_booked","needs_attention")')
      .lt("last_inbound_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    // Current needs-attention leads
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "needs_attention"),
    // Actual follow-up sequences fired — NOT all AI replies
    supabase.from("sequences").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "sent")
      .gte("sent_at", sinceIso),
    // 5 most recent leads
    supabase.from("leads")
      .select("id, first_name, last_name, phone, status, source, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(5),
    // Next 4 upcoming appointments
    supabase.from("appointments")
      .select("*, leads(first_name, last_name, phone)")
      .eq("company_id", profile.company_id)
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .order("scheduled_at")
      .limit(4),
    // Closed deals revenue (last 30 days)
    supabase.from("leads")
      .select("deal_value")
      .eq("company_id", profile.company_id)
      .in("status", ["closed", "closed_won"])
      .not("deal_value", "is", null)
      .gte("closed_at", sinceIso),
  ])

  const leads = newLeads ?? 0
  const aptBooked = booked ?? 0
  const bookingRate = leads > 0 ? Math.round((aptBooked / leads) * 100) : 0
  const avgJobValue = company?.avg_job_value ?? 0
  const revenueProjected = aptBooked * avgJobValue
  const closedDeals = closedLeadsRes.data ?? []
  const revenueClosed = closedDeals.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0)
  const closedCount = closedDeals.length

  const hour = now.getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = profile.full_name?.split(" ")[0] ?? "there"

  return (
    <DashboardClient
      greeting={greeting}
      firstName={firstName}
      companyName={company?.name ?? ""}
      initialStats={{
        newLeads: leads,
        booked: aptBooked,
        qualified: qualified ?? 0,
        cold: cold ?? 0,
        needsAttention: needsAttention ?? 0,
        followUpsSent: followUpsSent ?? 0,
        bookingRate,
        revenueProjected,
        revenueClosed,
        closedCount,
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
