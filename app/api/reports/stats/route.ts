import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { buildFunnel, groupRevenueByJobType, normalizeLeadSource } from "@/lib/report-helpers"

function parseDate(p: string | null): string | null {
  if (!p) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return new Date(p + "T00:00:00.000Z").toISOString()
  const ms = parseInt(p)
  return isNaN(ms) ? null : new Date(ms).toISOString()
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, companies(avg_job_value, plan)")
    .eq("id", user.id)
    .single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const companyId = profile.company_id
  const company = (Array.isArray(profile.companies) ? profile.companies[0] : profile.companies) as {
    avg_job_value: number; plan: string
  } | null

  const since = parseDate(req.nextUrl.searchParams.get("since"))
  const untilRaw = parseDate(req.nextUrl.searchParams.get("until"))
  const until = untilRaw ? untilRaw.replace("T00:00:00.000Z", "T23:59:59.999Z") : null

  const [
    leadsInPeriodRes,
    allLeadsRes,
    appointmentsInPeriodRes,
    allAppointmentsRes,
    dailyLeadsRes,
    closedDealsRes,
    allTimeClosedRes,
  ] = await Promise.all([
    // Leads in the selected period
    (() => {
      let q = supabase.from("leads").select("id, status, source, created_at").eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null)
      if (since) q = q.gte("created_at", since)
      if (until) q = q.lte("created_at", until)
      return q
    })(),
    // All leads (for the status breakdown)
    supabase.from("leads").select("id, status, source, created_at").eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null),
    // Appointments in period
    (() => {
      let q = supabase.from("appointments").select("id, scheduled_at, status").eq("company_id", companyId)
      if (since) q = q.gte("created_at", since)
      if (until) q = q.lte("created_at", until)
      return q
    })(),
    // All appointments
    supabase.from("appointments").select("id, scheduled_at, status").eq("company_id", companyId),
    // Daily leads for the period (for sparkline — up to 90 days shown)
    (() => {
      let q = supabase.from("leads").select("created_at").eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null).order("created_at", { ascending: true })
      if (since) q = q.gte("created_at", since)
      if (until) q = q.lte("created_at", until)
      return q
    })(),
    // Closed deals in period — include refund_amount for net calculation
    (() => {
      let q = supabase.from("leads").select("deal_value, refund_amount, closed_job_type, closed_at")
        .eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null).in("status", ["closed", "closed_won"]).not("deal_value", "is", null)
      if (since) q = q.gte("closed_at", since)
      if (until) q = q.lte("closed_at", until)
      return q
    })(),
    // All-time closed deals — for computing real avg job value
    supabase.from("leads").select("deal_value").eq("company_id", companyId)
      .eq("excluded_from_stats", false)
      .is("deleted_at", null).in("status", ["closed", "closed_won"]).not("deal_value", "is", null),
  ])

  const leadsInPeriod = leadsInPeriodRes.data ?? []
  const allLeads = allLeadsRes.data ?? []
  const appointmentsInPeriod = appointmentsInPeriodRes.data ?? []
  const allAppointments = allAppointmentsRes.data ?? []
  const dailyLeadsRaw = dailyLeadsRes.data ?? []
  const closedDeals = closedDealsRes.data ?? []
  const allTimeClosed = allTimeClosedRes.data ?? []

  // Build daily sparkline — dynamic range based on period length
  const fromDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const toDate = until ? new Date(until) : new Date()
  const diffDays = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)))
  const showDays = Math.min(diffDays, 90)

  const dailyMap: Record<string, number> = {}
  for (let i = showDays - 1; i >= 0; i--) {
    const d = new Date(toDate)
    d.setDate(d.getDate() - i)
    dailyMap[d.toISOString().slice(0, 10)] = 0
  }
  for (const lead of dailyLeadsRaw) {
    const key = lead.created_at.slice(0, 10)
    if (key in dailyMap) dailyMap[key]++
  }
  const dailyLeads = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  // Status breakdown (all time)
  const statusCounts: Record<string, number> = {}
  for (const l of allLeads) { statusCounts[l.status] = (statusCounts[l.status] ?? 0) + 1 }

  // Source breakdown (period)
  const sourceCounts: Record<string, number> = {}
  for (const l of leadsInPeriod) {
    const src = normalizeLeadSource(l.source)
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }

  // Funnel (period), from current lead statuses
  const funnel = buildFunnel(leadsInPeriod)

  const bookingRate = leadsInPeriod.length > 0
    ? Math.round((appointmentsInPeriod.length / leadsInPeriod.length) * 100)
    : 0

  // Active leads in the period: replied (not cold/closed) — these represent pipeline value at risk
  const activeLeads = leadsInPeriod.filter(l =>
    !["closed", "closed_won", "closed_lost", "lost", "unqualified", "cold"].includes(l.status)
  ).length
  // Prefer real avg from all-time closed deals; fall back to company setting
  const avgJobValue = allTimeClosed.length > 0
    ? Math.round(allTimeClosed.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0) / allTimeClosed.length)
    : (company?.avg_job_value ?? 0)
  const revenueAtRisk = activeLeads * avgJobValue

  // Net revenue = deal_value minus refunds
  const revenueClosed = closedDeals.reduce(
    (sum, d) => sum + Math.max(0, (Number(d.deal_value) || 0) - (Number(d.refund_amount) || 0)),
    0
  )
  const totalRefunded = closedDeals.reduce((sum, d) => sum + (Number(d.refund_amount) || 0), 0)
  const closedCount = closedDeals.length

  // Revenue by job type: enum values and labels collapse to one label
  const jobTypePerformance = groupRevenueByJobType(closedDeals)

  return NextResponse.json({
    leadsInPeriod: leadsInPeriod.length,
    totalLeads: allLeads.length,
    appointmentsInPeriod: appointmentsInPeriod.length,
    totalAppointments: allAppointments.length,
    bookingRate,
    revenueAtRisk,
    revenueClosed,
    totalRefunded,
    closedCount,
    avgJobValue,
    dailyLeads,
    statusCounts,
    sourceCounts,
    funnel,
    jobTypePerformance,
  })
}
