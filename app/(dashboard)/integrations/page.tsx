import { redirect } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { IntegrationsClient, type FacebookSummary } from "@/components/integrations/IntegrationsClient"
import { adAccountStatusLabel, readFbCache } from "@/lib/meta-ads"

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, companies(webhook_secret, name, integration_mode)")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) redirect("/onboarding")

  const company = (
    Array.isArray(profile.companies) ? profile.companies[0] : profile.companies
  ) as { webhook_secret: string; name: string | null; integration_mode: string | null } | null

  const { data: hcpConn } = await supabase
    .from("hcp_connections")
    .select("id")
    .eq("company_id", profile.company_id)
    .eq("is_active", true)
    .maybeSingle()

  const { data: integrations } = await supabase
    .from("integrations")
    .select("type, is_active, setup_complete, fb_page_name, fb_page_id, fb_selected_form_ids, lead_count, last_lead_at, created_at")
    .eq("company_id", profile.company_id)

  // The Facebook card shows names and counts. The stored Facebook data also holds
  // tokens, so it is read with the service role here and only names are passed on.
  let facebook: FacebookSummary | null = null
  const fbRow = (integrations ?? []).find((i) => i.type === "facebook")
  if (fbRow) {
    const db = createServiceRoleClient()
    const [{ data: cacheRow }, { data: conns }, leadsRes, { data: lastLead }, pendingRes] = await Promise.all([
      db.from("integrations").select("fb_pages_cache").eq("company_id", profile.company_id).eq("type", "facebook").maybeSingle(),
      db.from("facebook_connections").select("fb_ad_account_id, updated_at")
        .eq("company_id", profile.company_id).order("updated_at", { ascending: false }).limit(5),
      db.from("leads").select("id", { count: "exact", head: true })
        .eq("company_id", profile.company_id).eq("source", "facebook").is("deleted_at", null),
      db.from("leads").select("created_at")
        .eq("company_id", profile.company_id).eq("source", "facebook").is("deleted_at", null)
        .order("created_at", { ascending: false }).limit(1),
      db.from("leads").select("id", { count: "exact", head: true })
        .eq("company_id", profile.company_id).is("deleted_at", null).contains("metadata", { pending_fetch: true }),
    ])
    const cache = readFbCache(cacheRow?.fb_pages_cache)
    const adAccountId = ((conns ?? []) as Array<{ fb_ad_account_id: string | null }>).find((c) => c.fb_ad_account_id)?.fb_ad_account_id ?? null
    const adAccount = adAccountId ? cache.adAccounts.find((a) => a.id === adAccountId) : undefined
    const selectedIds = (fbRow.fb_selected_form_ids as string[] | null) ?? []
    const formNames = new Map((cache.selectedForms ?? []).map((f) => [f.id, f.name]))
    facebook = {
      adAccountName: adAccountId ? (adAccount?.name ?? adAccountId.replace(/^act_/, "Ad account ")) : null,
      adAccountStatus: adAccountId ? adAccountStatusLabel(adAccount?.account_status) : null,
      forms: selectedIds.map((id) => ({ id, name: formNames.get(id) ?? `Form ${id}` })),
      leadCount: leadsRes.count ?? 0,
      lastLeadAt: (lastLead?.[0]?.created_at as string | undefined) ?? (fbRow.last_lead_at as string | null) ?? null,
      pendingLeads: pendingRes.count ?? 0,
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const webhookSecret = company?.webhook_secret ?? ""
  const params = await searchParams

  return (
    <IntegrationsClient
      integrations={integrations ?? []}
      facebook={facebook}
      webhookSecret={webhookSecret}
      appUrl={appUrl}
      hcpConnected={Boolean(hcpConn)}
      integrationMode={company?.integration_mode ?? "standalone"}
      toast={params.success ?? params.error ?? null}
      toastType={params.success ? "success" : params.error ? "error" : null}
    />
  )
}
