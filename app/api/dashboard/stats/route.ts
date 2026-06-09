import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, companies(avg_job_value)")
    .eq("id", user.id)
    .single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const companyId = profile.company_id
  const company = (
    Array.isArray(profile.companies) ? profile.companies[0] : profile.companies
  ) as { avg_job_value: number } | null

  // `since`/`until` can be Unix ms timestamps OR YYYY-MM-DD strings
  const sinceParam = req.nextUrl.searchParams.get("since")
  const untilParam = req.nextUrl.searchParams.get("until")

  function parseDate(p: string | null): string | null {
    if (!p) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return new Date(p + "T00:00:00.000Z").toISOString()
    const ms = parseInt(p)
    return isNaN(ms) ? null : new Date(ms).toISOString()
  }

  const since = parseDate(sinceParam)
  // until: end of day
  const untilRaw = parseDate(untilParam)
  const until = untilRaw ? untilRaw.replace("T00:00:00.000Z", "T23:59:59.999Z") : null

  const [
    { count: newLeads },
    { count: booked },
    { count: followUpsSent },
    { count: qualified },
    { count: cold },
    { count: needsAttention },
    closedLeadsRes,
    allTimeClosedRes,
  ] = await Promise.all([
    // Leads that arrived in the period
    (() => {
      let q = supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", companyId)
      if (since) q = q.gte("created_at", since)
      if (until) q = q.lte("created_at", until)
      return q
    })(),
    // Appointments booked in the period
    (() => {
      let q = supabase.from("appointments").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "scheduled")
      if (since) q = q.gte("created_at", since)
      if (until) q = q.lte("created_at", until)
      return q
    })(),
    // Follow-up sequences fired in the period
    (() => {
      let q = supabase.from("sequences").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "sent")
      if (since) q = q.gte("sent_at", since)
      if (until) q = q.lte("sent_at", until)
      return q
    })(),
    // Hot leads: replied within last 7 days, not yet booked
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["active_conversation", "qualified", "nurturing"])
      .gte("last_inbound_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    // Cold leads: no inbound reply in 7+ days, not closed/booked/unqualified
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("status", "in", '("closed","closed_won","closed_lost","unqualified","appointment_booked","needs_attention")')
      .lt("last_inbound_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    // Current needs-attention
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "needs_attention"),
    // Closed deals with revenue in the period
    (() => {
      let q = supabase.from("leads").select("deal_value").eq("company_id", companyId).in("status", ["closed", "closed_won"]).not("deal_value", "is", null)
      if (since) q = q.gte("closed_at", since)
      if (until) q = q.lte("closed_at", until)
      return q
    })(),
    // All-time closed deals — for computing real avg job value
    supabase.from("leads").select("deal_value").eq("company_id", companyId).in("status", ["closed", "closed_won"]).not("deal_value", "is", null),
  ])

  const leads = newLeads ?? 0
  const aptBooked = booked ?? 0
  const bookingRate = leads > 0 ? Math.round((aptBooked / leads) * 100) : 0

  // Prefer real avg from all-time closed deals; fall back to company setting
  const allTimeClosed = allTimeClosedRes.data ?? []
  const avgJobValue = allTimeClosed.length > 0
    ? Math.round(allTimeClosed.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0) / allTimeClosed.length)
    : (company?.avg_job_value ?? 0)

  const revenueProjected = aptBooked * avgJobValue
  const closedLeads = closedLeadsRes.data ?? []
  const revenueClosed = closedLeads.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0)
  const closedCount = closedLeads.length

  return NextResponse.json({
    newLeads: leads,
    booked: aptBooked,
    followUpsSent: followUpsSent ?? 0,
    qualified: qualified ?? 0,
    cold: cold ?? 0,
    needsAttention: needsAttention ?? 0,
    bookingRate,
    revenueProjected,
    revenueClosed,
    closedCount,
    avgJobValue,
  })
}
