import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { friendlyGraphError, graphGet, readFbCache } from "@/lib/meta-ads"

// GET /api/integrations/facebook/forms?page_id=
// The lead forms on a Page the owner granted. The page token never leaves the
// server: the wizard sends a Page id, the token is looked up here.
export async function GET(req: NextRequest) {
  const pageId = new URL(req.url).searchParams.get("page_id")
  if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: integration } = await db
    .from("integrations")
    .select("fb_pages_cache")
    .eq("company_id", profile.company_id)
    .eq("type", "facebook")
    .maybeSingle()

  const page = readFbCache(integration?.fb_pages_cache).pages.find((p) => p.id === pageId)
  if (!page) return NextResponse.json({ error: "That Page is not part of this Facebook connection. Reconnect Facebook." }, { status: 404 })

  if (!page.access_token) {
    return NextResponse.json({
      code: "page_token_missing",
      error:
        "Facebook did not give us access to this Page. Reconnect Facebook, click \"Edit settings\" in the Facebook window (not \"Reconnect\"), then tick this Page and the business that owns it.",
    }, { status: 409 })
  }

  const res = await graphGet<{ data?: Array<{ id: string; name: string; status: string; leads_count?: number; created_time: string }> }>(
    `${pageId}/leadgen_forms`,
    { fields: "id,name,status,leads_count,created_time", limit: "100" },
    page.access_token
  )
  if (res.error) {
    return NextResponse.json({ error: friendlyGraphError(res.error), detail: res.error.message }, { status: 400 })
  }

  // Active forms first, then newest.
  const forms = (res.data?.data ?? []).sort((a, b) => {
    if ((a.status === "ACTIVE") !== (b.status === "ACTIVE")) return a.status === "ACTIVE" ? -1 : 1
    return (b.created_time ?? "").localeCompare(a.created_time ?? "")
  })
  return NextResponse.json({ forms })
}
