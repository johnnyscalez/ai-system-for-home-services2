import { NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { refreshA2p, publicA2pState, a2pSubmitEnabled, legalUrls } from "@/lib/a2p"
import { loadIntake } from "@/lib/intake"

export const runtime = "nodejs"

// GET /api/a2p/status: where the texting registration stands, refreshed from Twilio when one is in flight.
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const db = createServiceRoleClient()
  const intake = await loadIntake(db, profile.company_id)
  let state = intake.a2p
  if (state && ["submitted", "brand_pending", "campaign_pending"].includes(state.status)) {
    state = await refreshA2p(profile.company_id)
  }
  const { data: number } = await db
    .from("phone_numbers").select("phone_number").eq("company_id", profile.company_id).eq("is_active", true).limit(1).maybeSingle()

  return NextResponse.json({
    ...publicA2pState(state),
    business: state?.business ?? {},
    phoneNumber: number?.phone_number ?? null,
    submitEnabled: a2pSubmitEnabled(),
    legal: legalUrls(profile.company_id, state?.business),
  })
}
