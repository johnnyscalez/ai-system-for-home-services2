import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Redirect to onboarding if not completed
  const { data: profile } = await supabase
    .from("users")
    .select("company_id, companies(onboarding_completed)")
    .eq("id", user.id)
    .single()

  const company = (Array.isArray(profile?.companies) ? profile?.companies[0] : profile?.companies) as { onboarding_completed: boolean } | null
  if (!profile?.company_id || !company?.onboarding_completed) {
    redirect("/onboarding")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
