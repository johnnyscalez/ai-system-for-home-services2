import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { validateHcpKey } from "@/lib/housecall"
import { reconcileCompany } from "@/lib/housecall-sync"

// Connect a company to Housecall Pro with their API key (MAX/XL plans).
// This is THE switch that puts a company on V2: it validates the key against
// HCP, stores the connection, flips integration_mode to "housecall_pro"
// (thin AI-performance dashboard + bookings push to HCP), and kicks the
// first sync (imports techs, registers webhooks). One call, no manual SQL.

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const apiKey = String(body.api_key ?? "").trim()
  if (apiKey.length < 20) {
    return NextResponse.json({ error: "Paste the full API key from Housecall Pro → Settings → API (requires the MAX or XL plan)" }, { status: 400 })
  }

  const validation = await validateHcpKey(apiKey)
  if (!validation.ok) {
    const unauthorized = validation.attempts.every((a) => a.status === 401 || a.status === 403)
    return NextResponse.json({
      error: unauthorized
        ? "Housecall Pro rejected this key. Double-check it was copied fully, and that the account is on the MAX or XL plan (lower plans don't expose API keys)."
        : "Couldn't reach Housecall Pro to validate the key — try again in a minute.",
    }, { status: 422 })
  }

  const db = createServiceRoleClient()
  const now = new Date().toISOString()

  await db.from("hcp_connections").upsert({
    company_id: profile.company_id,
    api_key: apiKey,
    auth_scheme: validation.scheme,
    is_active: true,
    last_validated_at: now,
    updated_at: now,
  }, { onConflict: "company_id" })

  // The V2 switch — bookings now push to HCP, dashboard becomes the
  // AI-performance view.
  await db.from("companies")
    .update({ integration_mode: "housecall_pro" })
    .eq("id", profile.company_id)

  // First sync in the background: imports technicians, registers webhooks.
  // Slow (paginates HCP), so don't hold the response for it.
  reconcileCompany(profile.company_id)
    .catch((e) => console.error("[hcp/connect] initial sync failed:", e))

  return NextResponse.json({ success: true })
}
