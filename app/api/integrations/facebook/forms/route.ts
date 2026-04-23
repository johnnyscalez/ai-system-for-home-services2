import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pageId = searchParams.get("page_id")

  if (!pageId) {
    return NextResponse.json({ error: "page_id required" }, { status: 400 })
  }

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

  const serviceSupabase = createServiceRoleClient()
  const { data: integration } = await serviceSupabase
    .from("integrations")
    .select("fb_pages_cache")
    .eq("company_id", profile.company_id)
    .eq("type", "facebook")
    .single()

  if (!integration?.fb_pages_cache) {
    return NextResponse.json({ error: "No pages cached" }, { status: 404 })
  }

  const pages: Array<{ id: string; name: string; access_token: string }> = integration.fb_pages_cache
  const page = pages.find((p) => p.id === pageId)

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const formsRes = await fetch(
    `https://graph.facebook.com/${pageId}/leadgen_forms?access_token=${page.access_token}&fields=id,name,status,leads_count,created_time`
  )
  const formsData = await formsRes.json()

  if (formsData.error) {
    return NextResponse.json({ error: formsData.error.message }, { status: 400 })
  }

  return NextResponse.json({ forms: formsData.data || [] })
}
