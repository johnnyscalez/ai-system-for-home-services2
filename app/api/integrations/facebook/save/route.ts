import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: "No company" }, { status: 400 })
  }

  const body = await req.json()
  const { page_id, form_ids } = body as { page_id: string; form_ids: string[] }

  if (!page_id || !form_ids?.length) {
    return NextResponse.json({ error: "page_id and form_ids required" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()

  const { data: integration } = await serviceSupabase
    .from("integrations")
    .select("fb_pages_cache")
    .eq("company_id", profile.company_id)
    .eq("type", "facebook")
    .single()

  if (!integration?.fb_pages_cache) {
    return NextResponse.json({ error: "No integration found" }, { status: 404 })
  }

  const pages: Array<{ id: string; name: string; access_token: string }> = integration.fb_pages_cache
  const page = pages.find((p) => p.id === page_id)

  if (!page) {
    return NextResponse.json({ error: "Page not found in cache" }, { status: 404 })
  }

  // Subscribe the page to leadgen + Messenger webhooks
  const subRes = await fetch(
    `https://graph.facebook.com/${page_id}/subscribed_apps?subscribed_fields=leadgen,messages,messaging_postbacks&access_token=${page.access_token}`,
    { method: "POST" }
  )
  const subData = await subRes.json()
  if (!subData.success) {
    console.error("Page subscription failed:", subData)
  }

  const { error: updateError } = await serviceSupabase
    .from("integrations")
    .update({
      fb_page_id: page_id,
      fb_page_name: page.name,
      fb_access_token: page.access_token,
      fb_selected_form_ids: form_ids,
      setup_complete: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", profile.company_id)
    .eq("type", "facebook")

  if (updateError) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
