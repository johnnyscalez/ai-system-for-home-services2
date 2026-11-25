import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import {
  GRAPH, clearAdInsightsCache, friendlyGraphError, graphGet, readFbCache, saveFacebookConnection,
} from "@/lib/meta-ads"

// What the Page is subscribed to on our app:
//   leadgen               Lead Ad submissions
//   messages, messaging_postbacks   Messenger conversations
//   message_echoes        what the Page itself sends, so a person replying from the
//                         Page inbox pauses the AI
const PAGE_SUBSCRIBED_FIELDS = "leadgen,messages,messaging_postbacks,message_echoes"

// POST /api/integrations/facebook/save
// Body: { page_id, ad_account_id?: string | null, form_ids?: string[] }
//
// Activates the connection. An empty form list is valid and means "every lead
// form on this Page", including ones created later; the Page subscription (leads
// and Messenger) is turned on either way. Nothing is marked active unless
// Facebook confirms the subscription, and a failed attempt leaves a connection
// that is already live exactly as it was.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })
  const companyId = profile.company_id as string

  const body = (await req.json().catch(() => ({}))) as { page_id?: string; ad_account_id?: string | null; form_ids?: string[] }
  const pageId = typeof body.page_id === "string" ? body.page_id : ""
  const formIds = Array.isArray(body.form_ids) ? [...new Set(body.form_ids.filter((f) => typeof f === "string" && f))] : []
  const adAccountId = typeof body.ad_account_id === "string" && body.ad_account_id ? body.ad_account_id : null
  if (!pageId) return NextResponse.json({ error: "Choose a Facebook Page first" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: integration } = await db
    .from("integrations")
    .select("fb_pages_cache, fb_user_access_token, fb_page_id, fb_access_token, is_active")
    .eq("company_id", companyId)
    .eq("type", "facebook")
    .maybeSingle()
  if (!integration) return NextResponse.json({ error: "Facebook is not connected. Connect Facebook first." }, { status: 404 })

  const cache = readFbCache(integration.fb_pages_cache)
  const page = cache.pages.find((p) => p.id === pageId)
  if (!page) return NextResponse.json({ error: "That Page is not part of this Facebook connection. Reconnect Facebook." }, { status: 404 })
  if (!page.access_token) {
    return NextResponse.json({
      code: "page_token_missing",
      error:
        "Facebook did not give us access to this Page. Reconnect Facebook, click \"Edit settings\" in the Facebook window (not \"Reconnect\"), then tick this Page and the business that owns it.",
    }, { status: 409 })
  }
  if (adAccountId && !cache.adAccounts.some((a) => a.id === adAccountId)) {
    return NextResponse.json({ error: "That ad account is not part of this Facebook connection. Reconnect Facebook." }, { status: 400 })
  }

  // One Page feeds one company. Two companies active on the same Page made every
  // lead ambiguous, so the second one is refused instead of silently winning.
  const { data: taken } = await db
    .from("integrations").select("company_id")
    .eq("type", "facebook").eq("fb_page_id", pageId).eq("is_active", true).neq("company_id", companyId).limit(1)
  if (taken?.length) {
    return NextResponse.json({ error: "This Facebook Page is already connected to another FieldBuilt account. Disconnect it there first." }, { status: 409 })
  }

  // ── Subscribe the Page. No confirmation from Facebook = not active. ─────────
  let subError: string | null = null
  try {
    const res = await fetch(
      `${GRAPH}/${pageId}/subscribed_apps?subscribed_fields=${PAGE_SUBSCRIBED_FIELDS}&access_token=${page.access_token}`,
      { method: "POST", signal: AbortSignal.timeout(15000) }
    )
    const data = await res.json().catch(() => ({}))
    if (!data?.success) {
      subError = data?.error
        ? friendlyGraphError({ message: data.error.message, code: data.error.code, subcode: data.error.error_subcode })
        : `Facebook did not confirm the subscription (HTTP ${res.status}).`
      console.error(`[fb-save] page ${pageId} subscription failed for company ${companyId}:`, data?.error?.message ?? data)
    }
  } catch (err) {
    subError = err instanceof Error ? err.message : "Could not reach Facebook"
  }
  if (subError) {
    return NextResponse.json({
      code: "subscription_failed",
      error: `Facebook would not turn on lead delivery for this Page: ${subError}`,
    }, { status: 502 })
  }

  // Form names, for the Integrations screen. Display only: failure is not an error.
  let selectedForms: Array<{ id: string; name: string }> = []
  if (formIds.length > 0) {
    const forms = await graphGet<{ data?: Array<{ id: string; name: string }> }>(
      `${pageId}/leadgen_forms`, { fields: "id,name", limit: "100" }, page.access_token
    )
    const names = new Map((forms.data?.data ?? []).map((f) => [f.id, f.name]))
    selectedForms = formIds.map((id) => ({ id, name: names.get(id) ?? `Form ${id}` }))
  }

  const previousPageId = integration.is_active ? (integration.fb_page_id as string | null) : null
  const previousPageToken = integration.fb_access_token as string | null

  const { error: updateError } = await db
    .from("integrations")
    .update({
      fb_page_id: pageId,
      fb_page_name: page.name,
      fb_access_token: page.access_token,
      fb_selected_form_ids: formIds,
      fb_pages_cache: { ...cache, selectedForms },
      setup_complete: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("type", "facebook")
  if (updateError) {
    console.error("[fb-save] integration update failed:", updateError)
    return NextResponse.json({ error: "Facebook is subscribed, but saving the selection failed. Try again." }, { status: 500 })
  }

  // The ad account lives on facebook_connections with the USER token (a page token
  // cannot read an ad account).
  await saveFacebookConnection(db, companyId, {
    fb_ad_account_id: adAccountId,
    fb_page_id: pageId,
    fb_page_name: page.name,
    access_token: (integration.fb_user_access_token as string | null) ?? null,
    is_active: true,
  })
  clearAdInsightsCache(companyId)

  // Switched Pages: stop delivery from the old one (best effort).
  if (previousPageId && previousPageId !== pageId && previousPageToken) {
    fetch(`${GRAPH}/${previousPageId}/subscribed_apps?access_token=${previousPageToken}`, { method: "DELETE" })
      .catch((e) => console.warn(`[fb-save] could not unsubscribe previous page ${previousPageId}:`, e))
  }

  // Leads Facebook refused to release while the connection was broken fill in now.
  const { retryPendingLeadgen } = await import("@/lib/meta-leadgen")
  const recovered = await retryPendingLeadgen(companyId).catch((e) => {
    console.error("[fb-save] pending lead retry failed:", e)
    return { recovered: 0, stillPending: 0 }
  })

  return NextResponse.json({
    success: true,
    page: page.name,
    adAccount: adAccountId ? (cache.adAccounts.find((a) => a.id === adAccountId)?.name ?? adAccountId) : null,
    forms: formIds.length,
    allForms: formIds.length === 0,
    recoveredLeads: recovered.recovered,
  })
}
