import { redirect } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { FacebookSetup } from "@/components/integrations/FacebookSetup"

export default async function FacebookSetupPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) redirect("/onboarding")

  const serviceSupabase = createServiceRoleClient()
  const { data: integration } = await serviceSupabase
    .from("integrations")
    .select("fb_pages_cache, setup_complete")
    .eq("company_id", profile.company_id)
    .eq("type", "facebook")
    .single()

  // Already set up — send back to integrations
  if (integration?.setup_complete) {
    redirect("/integrations")
  }

  // No integration at all — go start OAuth
  if (!integration?.fb_pages_cache) {
    redirect("/api/auth/facebook")
  }

  const pages = integration.fb_pages_cache as Array<{
    id: string
    name: string
    fan_count?: number
    access_token: string
  }>

  return <FacebookSetup pages={pages} companyId={profile.company_id} />
}
