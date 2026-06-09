import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

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
    technicianApptsRes,
    closedByTechRes,
    techniciansRes,
    allTimeClosedRes,
  ] = await Promise.all([
    // Leads in the selected period
    (() => {
      let q = supabase.from("leads").select("id, status, source, created_at").eq("company_id", companyId)
      if (since) q = q.gte("created_at", since)
      if (until) q = q.lte("created_at", until)
      return q
    })(),
    // All leads (for funnel, source breakdown)
    supabase.from("leads").select("id, status, source, created_at").eq("company_id", companyId),
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
      let q = supabase.from("leads").select("created_at").eq("company_id", companyId).order("created_at", { ascending: true })
      if (since) q = q.gte("created_at", since)
      if (until) q = q.lte("created_at", until)
      return q
    })(),
    // Closed deals in period — include refund_amount for net calculation
    (() => {
      let q = supabase.from("leads").select("deal_value, refund_amount, closed_job_type, closed_technician_id, closed_technician_name, closed_at")
        .eq("company_id", companyId).in("status", ["closed", "closed_won"]).not("deal_value", "is", null)
      if (since) q = q.gte("closed_at", since)
      if (until) q = q.lte("closed_at", until)
      return q
    })(),
    // Appointments per tech (in period)
    (() => {
      let q = supabase.from("appointments").select("technician_id, technician_name").eq("company_id", companyId).not("technician_id", "is", null)
      if (since) q = q.gte("created_at", since)
      if (until) q = q.lte("created_at", until)
      return q
    })(),
    // Closed jobs per tech (in period) — include refund_amount
    (() => {
      let q = supabase.from("leads").select("closed_technician_id, closed_technician_name, deal_value, refund_amount")
        .eq("company_id", companyId).in("status", ["closed", "closed_won"]).not("closed_technician_id", "is", null)
      if (since) q = q.gte("closed_at", since)
      if (until) q = q.lte("closed_at", until)
      return q
    })(),
    // Technicians
    supabase.from("technicians").select("id, name, status").eq("company_id", companyId).order("name"),
    // All-time closed deals — for computing real avg job value
    supabase.from("leads").select("deal_value").eq("company_id", companyId).in("status", ["closed", "closed_won"]).not("deal_value", "is", null),
  ])

  const leadsInPeriod = leadsInPeriodRes.data ?? []
  const allLeads = allLeadsRes.data ?? []
  const appointmentsInPeriod = appointmentsInPeriodRes.data ?? []
  const allAppointments = allAppointmentsRes.data ?? []
  const dailyLeadsRaw = dailyLeadsRes.data ?? []
  const closedDeals = closedDealsRes.data ?? []
  const technicianApts = technicianApptsRes.data ?? []
  const closedByTech = closedByTechRes.data ?? []
  const allTechnicians = techniciansRes.data ?? []
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
    const src = l.source ?? "unknown"
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }

  // Funnel (period)
  const funnelStages = ["new", "contacted", "qualified", "appointment_booked", "closed_lost"]
  const funnel = funnelStages.map(stage => ({
    stage,
    count: leadsInPeriod.filter(l => l.status === stage).length,
  }))

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

  // Technician performance
  const aptsByTech: Record<string, number> = {}
  for (const a of technicianApts) {
    if (a.technician_id) aptsByTech[a.technician_id] = (aptsByTech[a.technician_id] ?? 0) + 1
  }
  const closedByTechMap: Record<string, { count: number; revenue: number; name: string }> = {}
  for (const c of closedByTech) {
    const id = c.closed_technician_id ?? "unknown"
    if (!closedByTechMap[id]) closedByTechMap[id] = { count: 0, revenue: 0, name: c.closed_technician_name ?? "Unknown" }
    closedByTechMap[id].count++
    const net = Math.max(0, (Number(c.deal_value) || 0) - (Number(c.refund_amount) || 0))
    closedByTechMap[id].revenue += net
  }
  const techIds = new Set([...allTechnicians.map(t => t.id), ...Object.keys(closedByTechMap)])
  const techPerformance = Array.from(techIds).map(id => {
    const tech = allTechnicians.find(t => t.id === id)
    const closed = closedByTechMap[id] ?? { count: 0, revenue: 0, name: tech?.name ?? "Unknown" }
    return {
      id, name: tech?.name ?? closed.name, status: tech?.status ?? "active",
      appointments: aptsByTech[id] ?? 0,
      closedJobs: closed.count,
      revenue: closed.revenue,
    }
  }).sort((a, b) => b.revenue - a.revenue)

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
    techPerformance,
  })
}
