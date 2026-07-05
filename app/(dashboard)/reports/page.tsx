import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
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

  const [
    leadsThisMonthRes,
    leadsLastMonthRes,
    allLeadsRes,
    appointmentsThisMonthRes,
    allAppointmentsRes,
    dailyLeadsRes,
    closedDealsRes,
    technicianApptsRes,
    closedByTechRes,
    techniciansRes,
    dealsRes,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, status, source, created_at")
      .eq("company_id", companyId)
      .gte("created_at", startOfMonth),
    supabase
      .from("leads")
      .select("id")
      .eq("company_id", companyId)
      .gte("created_at", startOfLastMonth)
      .lte("created_at", endOfLastMonth),
    supabase
      .from("leads")
      .select("id, status, source, created_at")
      .eq("company_id", companyId),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status")
      .eq("company_id", companyId)
      .gte("created_at", startOfMonth),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status")
      .eq("company_id", companyId),
    supabase
      .from("leads")
      .select("created_at")
      .eq("company_id", companyId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true }),
    // All closed deals with revenue
    supabase
      .from("leads")
      .select("deal_value, refund_amount, closed_job_type, closed_technician_id, closed_technician_name, closed_at")
      .eq("company_id", companyId)
      .in("status", ["closed", "closed_won"])
      .not("deal_value", "is", null),
    // Appointments per technician
    supabase
      .from("appointments")
      .select("technician_id, technician_name")
      .eq("company_id", companyId)
      .not("technician_id", "is", null),
    // Closed jobs per technician — include unassigned deals, include refund_amount
    supabase
      .from("leads")
      .select("closed_technician_id, closed_technician_name, deal_value, refund_amount")
      .eq("company_id", companyId)
      .in("status", ["closed", "closed_won"]),
    // All technicians
    supabase
      .from("technicians")
      .select("id, name, status")
      .eq("company_id", companyId)
      .order("name"),
    // Deals list (closed leads with deal_value) — include refund fields
    supabase
      .from("leads")
      .select("id, first_name, last_name, phone, deal_value, refund_amount, refund_note, closed_at, closed_job_type, closed_technician_id, closed_technician_name, status")
      .eq("company_id", companyId)
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
  const closedDeals = closedDealsRes.data ?? []
  const technicianApts = technicianApptsRes.data ?? []
  const closedByTech = closedByTechRes.data ?? []
  const allTechnicians = techniciansRes.data ?? []
  const initialDeals = dealsRes.data ?? []

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

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  for (const lead of allLeads) {
    statusCounts[lead.status] = (statusCounts[lead.status] ?? 0) + 1
  }

  // Source breakdown
  const sourceCounts: Record<string, number> = {}
  for (const lead of allLeads) {
    const src = lead.source ?? "unknown"
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }

  // Conversion funnel
  const funnelStages = ["new", "contacted", "qualified", "appointment_booked", "closed_lost"]
  const funnel = funnelStages.map((stage) => ({
    stage,
    count: allLeads.filter((l) => l.status === stage).length,
  }))

  const bookingRate = allLeads.length > 0
    ? Math.round((allAppointments.length / allLeads.length) * 100)
    : 0

  const activeLeads = allLeads.filter(
    (l) => l.status !== "closed_lost" && l.status !== "closed_won"
  ).length

  const revenueAtRisk = activeLeads * (company?.avg_job_value ?? 0)

  const monthOverMonthDelta = leadsLastMonth.length > 0
    ? Math.round(((leadsThisMonth.length - leadsLastMonth.length) / leadsLastMonth.length) * 100)
    : null

  // Revenue closed (all time) — net of any refunds
  const revenueClosed = closedDeals.reduce(
    (sum, d) => sum + Math.max(0, (Number(d.deal_value) || 0) - (Number(d.refund_amount) || 0)),
    0
  )
  const totalRefunded = closedDeals.reduce((sum, d) => sum + (Number(d.refund_amount) || 0), 0)
  const closedCount = closedDeals.length

  // Build technician performance rows
  // Appointments count per tech
  const aptsByTech: Record<string, number> = {}
  for (const a of technicianApts) {
    if (a.technician_id) aptsByTech[a.technician_id] = (aptsByTech[a.technician_id] ?? 0) + 1
  }
  // Closed jobs + net revenue per tech (deal_value minus refund)
  const closedByTechMap: Record<string, { count: number; revenue: number; name: string }> = {}
  for (const c of closedByTech) {
    const id = c.closed_technician_id ?? "unassigned"
    if (!closedByTechMap[id]) closedByTechMap[id] = { count: 0, revenue: 0, name: c.closed_technician_name ?? "Unassigned" }
    closedByTechMap[id].count++
    const net = Math.max(0, (Number(c.deal_value) || 0) - (Number(c.refund_amount) || 0))
    closedByTechMap[id].revenue += net
  }
  // Merge into final rows — include all known technicians + any from closed jobs (including unassigned)
  const techIds = new Set([
    ...allTechnicians.map(t => t.id),
    ...Object.keys(closedByTechMap),
  ])
  const techPerformance = Array.from(techIds).map(id => {
    const tech = allTechnicians.find(t => t.id === id)
    const closed = closedByTechMap[id] ?? { count: 0, revenue: 0, name: tech?.name ?? "Unknown" }
    return {
      id,
      name: id === "unassigned" ? "Unassigned" : (tech?.name ?? closed.name),
      status: id === "unassigned" ? "unassigned" : (tech?.status ?? "active"),
      appointments: aptsByTech[id] ?? 0,
      closedJobs: closed.count,
      revenue: closed.revenue,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // Revenue by job type — same aggregation as /api/reports/stats (which
  // recomputes this timeline-filtered when the user changes the range).
  // Free-text field: group case-insensitively, blanks become Unspecified.
  const jobTypeMap: Record<string, { name: string; jobs: number; revenue: number }> = {}
  for (const d of closedDeals) {
    const raw = (d.closed_job_type ?? "").trim()
    const key = raw ? raw.toLowerCase() : "__unspecified__"
    if (!jobTypeMap[key]) jobTypeMap[key] = { name: raw || "Unspecified", jobs: 0, revenue: 0 }
    jobTypeMap[key].jobs++
    jobTypeMap[key].revenue += Math.max(0, (Number(d.deal_value) || 0) - (Number(d.refund_amount) || 0))
  }
  const jobTypePerformance = Object.values(jobTypeMap)
    .map(j => ({ ...j, avgJob: j.jobs > 0 ? Math.round(j.revenue / j.jobs) : 0 }))
    .sort((a, b) => b.revenue - a.revenue)

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
      avgJobValue={company?.avg_job_value ?? 0}
      dailyLeads={dailyLeads}
      statusCounts={statusCounts}
      sourceCounts={sourceCounts}
      funnel={funnel}
      techPerformance={techPerformance}
      jobTypePerformance={jobTypePerformance}
      technicians={allTechnicians}
      initialDeals={initialDeals}
    />
  )
}
