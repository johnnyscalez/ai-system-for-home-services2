import { redirect } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { FacebookSetup } from "@/components/integrations/FacebookSetup"
import { adAccountStatusLabel, fbReturnUrl, parseFbReturnTarget, readFbCache } from "@/lib/meta-ads"

// The Facebook connect wizard. It lives OUTSIDE the dashboard layout on purpose:
// a contractor who is still in onboarding has no dashboard yet (that layout sends
// them back to /onboarding), and they connect Facebook from the onboarding flow.
// Reached from the OAuth callback, from "Change page / forms" on Integrations, and
// from the old /integrations/facebook-setup link.
export const dynamic = "force-dynamic"

export default async function ConnectFacebookPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>
}) {
  const sp = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, companies(onboarding_completed)")
    .eq("id", user.id)
    .single()
  if (!profile?.company_id) redirect("/onboarding")

  const company = (Array.isArray(profile.companies) ? profile.companies[0] : profile.companies) as
    { onboarding_completed: boolean | null } | null
  // No explicit target: someone still onboarding goes back to onboarding.
  const returnTo = sp.return_to ? parseFbReturnTarget(sp.return_to) : company?.onboarding_completed ? "integrations" : "onboarding"

  const db = createServiceRoleClient()
  const [{ data: integration }, { data: conns }] = await Promise.all([
    db.from("integrations")
      .select("fb_pages_cache, fb_page_id, fb_selected_form_ids, setup_complete, is_active")
      .eq("company_id", profile.company_id).eq("type", "facebook").maybeSingle(),
    db.from("facebook_connections")
      .select("fb_ad_account_id, updated_at")
      .eq("company_id", profile.company_id).order("updated_at", { ascending: false }).limit(5),
  ])

  const cache = readFbCache(integration?.fb_pages_cache)
  // Nothing from Facebook yet: start the login.
  if (!integration || cache.pages.length === 0) redirect(`/api/auth/facebook?return_to=${returnTo}`)

  const adAccountId =
    ((conns ?? []) as Array<{ fb_ad_account_id: string | null }>).find((c) => c.fb_ad_account_id)?.fb_ad_account_id ?? null

  // Ids, names and status only. Page and user tokens never reach the browser.
  return (
    <FacebookSetup
      pages={cache.pages.map((p) => ({ id: p.id, name: p.name, fan_count: p.fan_count ?? null, hasToken: !!p.access_token }))}
      adAccounts={cache.adAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        status: adAccountStatusLabel(a.account_status),
        active: a.account_status === 1 || a.account_status == null,
        currency: a.currency ?? null,
        business: a.business_name ?? null,
      }))}
      adAccountsError={cache.adAccountsError ?? null}
      current={{
        pageId: (integration.fb_page_id as string | null) ?? null,
        adAccountId,
        formIds: ((integration.fb_selected_form_ids as string[] | null) ?? []),
      }}
      live={!!integration.is_active && !!integration.setup_complete}
      doneUrl={fbReturnUrl(returnTo, "connected")}
      skipUrl={fbReturnUrl(returnTo, "skipped")}
      reconnectUrl={`/api/auth/facebook?return_to=${returnTo}`}
    />
  )
}
