import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Lead } from "@/types/database"
import { PipelineBoard } from "@/components/leads/PipelineBoard"
import { LeadsTable } from "@/components/leads/LeadsTable"

export default async function LeadsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const [{ data: leads }, { data: technicians }] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("technicians")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .order("name"),
  ])

  const allLeads = (leads ?? []) as Lead[]
  const allTechs = (technicians ?? []) as { id: string; name: string }[]

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{allLeads.length} total leads</p>
      </div>

      {/* Pipeline board — columns cap at 300px height and scroll internally */}
      <PipelineBoard initialLeads={allLeads} technicians={allTechs} />

      {/* All leads — searchable list */}
      <LeadsTable initialLeads={allLeads} />
    </div>
  )
}
