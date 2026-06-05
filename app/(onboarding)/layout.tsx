import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("company_id, companies(onboarding_completed)")
      .eq("id", user.id)
      .single()

    const company = (Array.isArray(profile?.companies) ? profile?.companies[0] : profile?.companies) as { onboarding_completed: boolean } | null

    // Already onboarded — don't let them create a second company
    if (profile?.company_id && company?.onboarding_completed) {
      redirect("/dashboard")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
