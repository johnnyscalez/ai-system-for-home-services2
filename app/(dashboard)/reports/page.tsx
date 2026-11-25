import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { buildFunnel, groupRevenueByJobType, normalizeLeadSource } from "@/lib/report-helpers"
import { ReportsClient } from "@/components/reports/ReportsClient"

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, companies(avg_job_value, plan)")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) redirect("/onboarding")

  const companyId = profile.company_id
  const company = (Array.isArray(profile.companies) ? profile.companies[0] : profile.companies) as {
    avg_job_value: number
    plan: string
  } | null

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Same filters as /api/reports/stats so the first paint and every later
  // date-range fetch agree: stats-excluded and deleted leads never count.
  const liveLeads = () => supabase.from("leads")
  const [
    leadsThisMonthRes,
    leadsLastMonthRes,
    allLeadsRes,
    appointmentsThisMonthRes,
    allAppointmentsRes,
    dailyLeadsRes,
    closedDealsRes,
    dealsRes,
  ] = await Promise.all([
    liveLeads()
      .select("id, status, source, created_at")
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .gte("created_at", startOfMonth),
    liveLeads()
      .select("id")
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .gte("created_at", startOfLastMonth)
      .lte("created_at", endOfLastMonth),
    liveLeads()
      .select("id, status, source, created_at")
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status")
      .eq("company_id", companyId)
      .gte("created_at", startOfMonth),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status")
      .eq("company_id", companyId),
    liveLeads()
      .select("created_at")
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true }),
    // All closed deals with revenue (period numbers are cut from this below)
    liveLeads()
      .select("deal_value, refund_amount, closed_job_type, closed_at")
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .in("status", ["closed", "closed_won"])
      .not("deal_value", "is", null),
    // Deals list (signed leads with deal_value), including refund fields
    liveLeads()
      .select("id, first_name, last_name, phone, deal_value, refund_amount, refund_note, closed_at, closed_job_type, status")
      .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      .in("status", ["closed", "closed_won"])
      .not("deal_value", "is", null)
      .order("closed_at", { ascending: false }),
  ])

  const leadsThisMonth = leadsThisMonthRes.data ?? []
  const leadsLastMonth = leadsLastMonthRes.data ?? []
  const allLeads = allLeadsRes.data ?? []
  const appointmentsThisMonth = appointmentsThisMonthRes.data ?? []
  const allAppointments = allAppointmentsRes.data ?? []
  const dailyLeadsRaw = dailyLeadsRes.data ?? []
  const allTimeClosed = closedDealsRes.data ?? []
  // The page opens on "This month", so period numbers use this month's data,
  // exactly like /api/reports/stats does after a range change.
  const closedDeals = allTimeClosed.filter((d) => !!d.closed_at && (d.closed_at as string) >= startOfMonth)
  // The deals table opens on "This month" too: same cut as the numbers above,
  // so the list under that label is this month's deals and not every deal ever.
  const initialDeals = (dealsRes.data ?? []).filter((d) => !!d.closed_at && (d.closed_at as string) >= startOfMonth)

  // Build daily lead counts for last 30 days
  const dailyMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = 0
  }
  for (const lead of dailyLeadsRaw) {
    const key = lead.created_at.slice(0, 10)
    if (key in dailyMap) dailyMap[key]++
  }
  const dailyLeads = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  // Status breakdown (all time, same as the stats route)
  const statusCounts: Record<string, number> = {}
  for (const lead of allLeads) {
    statusCounts[lead.status] = (statusCounts[lead.status] ?? 0) + 1
  }

  // Source breakdown (period)
  const sourceCounts: Record<string, number> = {}
  for (const lead of leadsThisMonth) {
    const src = normalizeLeadSource(lead.source)
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }

  // Conversion funnel (period), from current lead statuses
  const funnel = buildFunnel(leadsThisMonth)

  const bookingRate = leadsThisMonth.length > 0
    ? Math.round((appointmentsThisMonth.length / leadsThisMonth.length) * 100)
    : 0

  const activeLeads = leadsThisMonth.filter(
    (l) => !["closed", "closed_won", "closed_lost", "lost", "unqualified", "cold"].includes(l.status)
  ).length

  // Prefer the real average from all signed deals; fall back to the company setting
  const avgJobValue = allTimeClosed.length > 0
    ? Math.round(allTimeClosed.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0) / allTimeClosed.length)
    : (company?.avg_job_value ?? 0)
  const revenueAtRisk = activeLeads * avgJobValue

  const monthOverMonthDelta = leadsLastMonth.length > 0
    ? Math.round(((leadsThisMonth.length - leadsLastMonth.length) / leadsLastMonth.length) * 100)
    : null

  // Revenue signed (this month), net of any refunds
  const revenueClosed = closedDeals.reduce(
    (sum, d) => sum + Math.max(0, (Number(d.deal_value) || 0) - (Number(d.refund_amount) || 0)),
    0
  )
  const totalRefunded = closedDeals.reduce((sum, d) => sum + (Number(d.refund_amount) || 0), 0)
  const closedCount = closedDeals.length

  // Revenue by job type: enum values and labels collapse to one label
  const jobTypePerformance = groupRevenueByJobType(closedDeals)

  return (
    <ReportsClient
      leadsThisMonth={leadsThisMonth.length}
      leadsLastMonth={leadsLastMonth.length}
      monthOverMonthDelta={monthOverMonthDelta}
      totalLeads={allLeads.length}
      appointmentsThisMonth={appointmentsThisMonth.length}
      totalAppointments={allAppointments.length}
      bookingRate={bookingRate}
      revenueAtRisk={revenueAtRisk}
      revenueClosed={revenueClosed}
      totalRefunded={totalRefunded}
      closedCount={closedCount}
      avgJobValue={avgJobValue}
      dailyLeads={dailyLeads}
      statusCounts={statusCounts}
      sourceCounts={sourceCounts}
      funnel={funnel}
      jobTypePerformance={jobTypePerformance}
      initialDeals={initialDeals}
    />
  )
}
