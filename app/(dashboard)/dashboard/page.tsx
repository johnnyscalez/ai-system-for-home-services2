import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { DashboardClient } from "@/components/dashboard/DashboardClient"
import { AgentDashboard, type AgentBooking, type CallbackLead } from "@/components/dashboard/AgentDashboard"

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
      .gte("created_at", sinceIso),
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "scheduled")
      .gte("created_at", sinceIso),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .in("status", ["active_conversation", "qualified", "nurturing"])
      .gte("last_inbound_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .not("status", "in", '("closed","closed_won","closed_lost","unqualified","appointment_booked","needs_attention")')
      .lt("last_inbound_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "needs_attention"),
    supabase.from("sequences").select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "sent")
      .gte("sent_at", sinceIso),
    supabase.from("leads")
      .select("id, first_name, last_name, phone, status, source, created_at")
      .eq("company_id", profile.company_id)
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

  // Overnight window from the company's working hours (default 8–18, America/New_York)
  const { data: agentCfg } = await supabase
    .from("ai_agent_config")
    .select("working_hours_start, working_hours_end, timezone")
    .eq("company_id", companyId)
    .maybeSingle()

  const startHour = agentCfg?.working_hours_start ?? 8
  const endHour = agentCfg?.working_hours_end ?? 18
  const tz = agentCfg?.timezone ?? "America/New_York"
  const hourNow = parseInt(now.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }), 10)

  const officeOpen = hourNow >= startHour && hourNow < endHour
  // Hours elapsed since the most recent close
  const hoursSinceClose = ((hourNow - endHour + 24) % 24) || 24
  const closeStart = new Date(now.getTime() - hoursSinceClose * 60 * 60 * 1000)
  closeStart.setMinutes(0, 0, 0)
  // If office is open now, the window ended at this morning's open; otherwise it's still running
  const closedNightHours = (startHour - endHour + 24) % 24
  const closeEnd = officeOpen ? new Date(closeStart.getTime() + closedNightHours * 60 * 60 * 1000) : now

  const nightLabel = officeOpen ? "Last night, while you were closed" : "Tonight, while your office is closed"

  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: nightBooked },
    { data: nightConvoLeads },
    { count: nightNewLeads },
    { count: callbackCount },
    { data: bookingsData },
    { data: callbacksData },
    { data: revenueEvents },
    { count: upcomingCount },
    { data: bars14 },
    { data: sourceRows },
    { data: hcpConn },
  ] = await Promise.all([
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", closeStart.toISOString())
      .lte("created_at", closeEnd.toISOString()),
    supabase.from("conversations").select("lead_id")
      .eq("company_id", companyId)
      .eq("direction", "inbound")
      .gte("created_at", closeStart.toISOString())
      .lte("created_at", closeEnd.toISOString()),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", closeStart.toISOString())
      .lte("created_at", closeEnd.toISOString()),
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "needs_attention"),
    supabase.from("appointments")
      .select("id, scheduled_at, address, notes, technician_name, hcp_job_id, hcp_manually_edited, created_at, leads(id, first_name, last_name, phone, source, channel, job_type)")
      .eq("company_id", companyId)
      .neq("status", "cancelled")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("leads")
      .select("id, first_name, last_name, phone, source, last_message_at")
      .eq("company_id", companyId)
      .eq("status", "needs_attention")
      .order("last_message_at", { ascending: false })
      .limit(6),
    supabase.from("hcp_revenue_events")
      .select("amount_cents, attribution")
      .eq("company_id", companyId)
      .gte("created_at", since30d),
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString()),
    supabase.from("appointments")
      .select("created_at")
      .eq("company_id", companyId)
      .gte("created_at", since14d),
    supabase.from("leads")
      .select("source")
      .eq("company_id", companyId)
      .gte("created_at", since30d),
    supabase.from("hcp_connections")
      .select("id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle(),
  ])

  const nightConversations = new Set((nightConvoLeads ?? []).map((c) => c.lead_id)).size

  const events = revenueEvents ?? []
  const bookedEvents = events.filter((e) => e.attribution === "booked_by_ai" && e.amount_cents)
  const bookedCents = bookedEvents.reduce((s, e) => s + Number(e.amount_cents), 0)
  const sourcedCents = events
    .filter((e) => e.attribution === "sourced_by_ai" && e.amount_cents)
    .reduce((s, e) => s + Number(e.amount_cents), 0)
  const pipelineCents = (upcomingCount ?? 0) * (company.avg_job_value ?? 0) * 100

  // Bookings per day, last 14 days
  const dayKey = (d: Date) => d.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" })
  const barMap = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    barMap.set(dayKey(d), 0)
  }
  for (const a of bars14 ?? []) {
    const k = dayKey(new Date(a.created_at))
    if (barMap.has(k)) barMap.set(k, (barMap.get(k) ?? 0) + 1)
  }
  const bars = [...barMap.entries()].map(([label, count]) => ({ day: label, label, count }))

  // Source breakdown
  const srcMap = new Map<string, number>()
  for (const r of sourceRows ?? []) {
    const s = r.source ?? "direct"
    srcMap.set(s, (srcMap.get(s) ?? 0) + 1)
  }
  const sources = [...srcMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

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
      money={{
        bookedCents,
        bookedCount: bookedEvents.length,
        sourcedCents,
        pipelineCents,
        pipelineCount: upcomingCount ?? 0,
      }}
      bookings={(bookingsData ?? []) as unknown as AgentBooking[]}
      callbacks={(callbacksData ?? []) as CallbackLead[]}
      bars={bars}
      sources={sources}
      hcpConnected={!!hcpConn}
    />
  )
}
