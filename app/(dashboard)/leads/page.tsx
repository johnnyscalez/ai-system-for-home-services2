import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Lead } from "@/types/database"
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace"

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  // First paint. LeadsWorkspace keeps the list current from here on.
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })

  return (
    <LeadsWorkspace
      companyId={profile.company_id}
      initialLeads={(leads ?? []) as Lead[]}
      initialStatus={status ?? null}
    />
  )
}
