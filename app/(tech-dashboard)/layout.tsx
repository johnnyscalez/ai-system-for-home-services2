import { redirect } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { TechSidebar } from "@/components/tech/TechSidebar"

export default async function TechDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/tech/login")
  if (user.app_metadata?.role !== "technician") redirect("/dashboard")

  const db = createServiceRoleClient()
  const { data: tech } = await db
    .from("technicians")
    .select("id, name, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) redirect("/tech/login")

  const { data: company } = await db
    .from("companies")
    .select("name")
    .eq("id", tech.company_id)
    .single()

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF8]">
      <TechSidebar techName={tech.name} companyName={company?.name ?? "Your Team"} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
