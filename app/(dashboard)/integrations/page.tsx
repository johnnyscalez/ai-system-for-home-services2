import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { IntegrationsClient } from "@/components/integrations/IntegrationsClient"

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
    .select("company_id, companies(webhook_secret)")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) redirect("/onboarding")

  const company = (
    Array.isArray(profile.companies) ? profile.companies[0] : profile.companies
  ) as { webhook_secret: string } | null

  const { data: integrations } = await supabase
    .from("integrations")
    .select("type, is_active, setup_complete, fb_page_name, fb_page_id, fb_selected_form_ids, lead_count, last_lead_at, created_at")
    .eq("company_id", profile.company_id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const webhookSecret = company?.webhook_secret ?? ""
  const params = await searchParams

  return (
    <IntegrationsClient
      integrations={integrations ?? []}
      webhookSecret={webhookSecret}
      appUrl={appUrl}
      toast={params.success ?? params.error ?? null}
      toastType={params.success ? "success" : params.error ? "error" : null}
    />
  )
}
