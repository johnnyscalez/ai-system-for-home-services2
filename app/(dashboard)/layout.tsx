import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Sidebar } from "@/components/layout/sidebar"
import { AgentModeGate } from "@/components/layout/AgentModeGate"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Redirect to onboarding if not completed
  const { data: profile } = await supabase
    .from("users")
    .select("company_id, companies(onboarding_completed, integration_mode)")
    .eq("id", user.id)
    .single()

  const company = (Array.isArray(profile?.companies) ? profile?.companies[0] : profile?.companies) as {
    onboarding_completed: boolean; integration_mode: string | null
  } | null
  if (!profile?.company_id || !company?.onboarding_completed) {
    redirect("/onboarding")
  }

  const integrationMode = company?.integration_mode ?? "standalone"

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar integrationMode={integrationMode} />
      {/* pt-14 on mobile offsets the fixed top bar; desktop needs none */}
      <main className="flex-1 overflow-y-auto bg-background pt-14 md:pt-0">
        <AgentModeGate integrationMode={integrationMode}>
          {children}
        </AgentModeGate>
      </main>
    </div>
  )
}
