import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { DashboardClient } from "@/components/dashboard/DashboardClient"
import { AgentDashboard, type AgentBooking, type LeadRow, type RevenueEventRow } from "@/components/dashboard/AgentDashboard"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, full_name, companies(name, service_type, avg_job_value, notification_phone, integration_mode)")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) redirect("/onboarding")

  const company = (Array.isArray(profile.companies) ? profile.companies[0] : profile.companies) as {
    name: string; service_type: string | null; avg_job_value: number
    notification_phone: string | null; integration_mode: string | null
  } | null

  const firstName = profile.full_name?.split(" ")[0] ?? "there"

  // ── HCP integration mode → AI-agent performance dashboard (not a CRM) ──────
  if (company?.integration_mode === "housecall_pro") {
    return <HcpAgentDashboard companyId={profile.company_id} firstName={firstName} company={company} supabase={supabase} />
  }

  // ── Standalone mode → the full CRM dashboard ────────────────────────────────
  const now = new Date()
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
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .gte("created_at", sinceIso),
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "scheduled")
      .gte("created_at", sinceIso),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .in("status", ["active_conversation", "qualified", "nurturing"])
      .gte("last_inbound_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .not("status", "in", '("closed","closed_won","closed_lost","unqualified","appointment_booked","needs_attention")')
      .lt("last_inbound_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .eq("status", "needs_attention"),
    supabase.from("sequences").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "sent")
      .gte("sent_at", sinceIso),
    supabase.from("leads")
      .select("id, first_name, last_name, phone, status, source, created_at")
      .eq("company_id", profile.company_id)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("appointments")
      .select("*, leads(first_name, last_name, phone)")
      .eq("company_id", profile.company_id)
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .order("scheduled_at")
      .limit(4),
    supabase.from("leads")
      .select("deal_value, refund_amount")
      .eq("company_id", profile.company_id)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
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
  const revenueClosed = closedDeals.reduce(
    (sum, l) => sum + Math.max(0, (Number(l.deal_value) || 0) - (Number(l.refund_amount) || 0)),
    0
  )
  const closedCount = closedDeals.length

  const hour = now.getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

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

// ─────────────────────────────────────────────────────────────────────────────
// HCP-mode data assembly
// ─────────────────────────────────────────────────────────────────────────────

async function HcpAgentDashboard({ companyId, firstName, company, supabase }: {
  companyId: string
  firstName: string
  company: { name: string; avg_job_value: number }
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
}) {
  const now = new Date()

  // Hero stats window — last 30 days, matching the hero's revenue tile. The
  // owner logs in to see totals (revenue, leads, jobs, conversations), not
  // just last night's slice.
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const nightLabel = "Your AI agent — last 30 days, around the clock"

  // Raw 90-day window — the client filters by source + time range without refetching
  const since90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: nightBooked },
    { data: nightConvoLeads },
    { count: nightNewLeads },
    { count: callbackCount },
    { data: bookingsData },
    { data: leads90d },
    { data: leadsAttention },
    { data: revenueEvents },
    { data: hcpConn },
  ] = await Promise.all([
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .neq("status", "cancelled")
      .gte("created_at", since30d),
    supabase.from("conversations").select("lead_id")
      .eq("company_id", companyId)
      .eq("direction", "inbound")
      .gte("created_at", since30d),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .gte("created_at", since30d),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .eq("status", "needs_attention"),
    supabase.from("appointments")
      .select("id, scheduled_at, status, origin, address, notes, technician_name, hcp_job_id, hcp_manually_edited, created_at, quoted_amount_cents, quoted_source, leads(id, first_name, last_name, phone, source, channel, job_type)")
      .eq("company_id", companyId)
      .neq("status", "cancelled")
      .gte("created_at", since90d)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("leads")
      .select("id, first_name, last_name, phone, source, channel, status, created_at, last_message_at")
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .gte("created_at", since90d)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("leads")
      .select("id, first_name, last_name, phone, source, channel, status, created_at, last_message_at")
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .eq("status", "needs_attention")
      .limit(50),
    supabase.from("hcp_revenue_events")
      .select("lead_id, amount_cents, attribution, created_at")
      .eq("company_id", companyId)
      .gte("created_at", since90d),
    supabase.from("hcp_connections")
      .select("id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle(),
  ])

  const nightConversations = new Set((nightConvoLeads ?? []).map((c) => c.lead_id)).size

  // Merge 90d leads with any needs_attention leads older than the window
  const leadMap = new Map<string, LeadRow>()
  for (const l of (leads90d ?? []) as LeadRow[]) leadMap.set(l.id, l)
  for (const l of (leadsAttention ?? []) as LeadRow[]) leadMap.set(l.id, l)

  return (
    <AgentDashboard
      firstName={firstName}
      companyName={company.name}
      nightLabel={nightLabel}
      night={{
        booked: nightBooked ?? 0,
        conversations: nightConversations,
        newLeads: nightNewLeads ?? 0,
        callbacks: callbackCount ?? 0,
      }}
      avgJobValueCents={(company.avg_job_value ?? 0) * 100}
      bookings={(bookingsData ?? []) as unknown as AgentBooking[]}
      leadsAll={[...leadMap.values()]}
      revenueEvents={(revenueEvents ?? []) as RevenueEventRow[]}
      hcpConnected={!!hcpConn}
    />
  )
}
