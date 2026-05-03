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

  // `since` is a Unix timestamp in milliseconds from the client
  const sinceParam = req.nextUrl.searchParams.get("since")
  const since = sinceParam ? new Date(parseInt(sinceParam)).toISOString() : null

  const [
    { count: newLeads },
    { count: booked },
    { count: followUpsSent },
    { count: qualified },
    { count: cold },
    { count: needsAttention },
  ] = await Promise.all([
    // Leads that arrived in the period
    (() => {
      let q = supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
      if (since) q = q.gte("created_at", since)
      return q
    })(),
    // Appointments booked in the period
    (() => {
      let q = supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "scheduled")
      if (since) q = q.gte("created_at", since)
      return q
    })(),
    // Actual follow-up sequence steps sent (not AI replies)
    (() => {
      let q = supabase
        .from("sequences")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "sent")
      if (since) q = q.gte("sent_at", since)
      return q
    })(),
    // Current hot leads (qualified, replied but not booked)
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "qualified"),
    // Current cold / lost leads
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["cold", "lost"]),
    // Current needs-attention leads
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "needs_attention"),
  ])

  const leads = newLeads ?? 0
  const aptBooked = booked ?? 0
  const bookingRate = leads > 0 ? Math.round((aptBooked / leads) * 100) : 0
  const avgJobValue = company?.avg_job_value ?? 0
  const revenueProjected = aptBooked * avgJobValue

  return NextResponse.json({
    newLeads: leads,
    booked: aptBooked,
    followUpsSent: followUpsSent ?? 0,
    qualified: qualified ?? 0,
    cold: cold ?? 0,
    needsAttention: needsAttention ?? 0,
    bookingRate,
    revenueProjected,
    avgJobValue,
  })
}
