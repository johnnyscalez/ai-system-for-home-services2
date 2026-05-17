import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { TechniciansClient } from "@/components/settings/TechniciansClient"
import { SmartDispatchBanner } from "@/components/settings/SmartDispatchBanner"
import type { Technician } from "@/types/database"

export default async function TechniciansPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const { data: technicians } = await supabase
    .from("technicians")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("name")

  return (
    <div className="relative min-h-screen">
      {/* Visual background layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(rgba(124,58,237,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(124,58,237,0.05)", top: "-10%", left: "-5%" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.04)", bottom: "-5%", right: "10%" }} />
      </div>

      <div className="relative z-10 p-6 max-w-3xl space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
            Technicians
          </h1>
          <p className="text-sm text-[#78716C] mt-1">
            Your field team. The AI uses this to book the right person for every job.
          </p>
        </div>

        {/* Smart Dispatch explanation banner */}
        <SmartDispatchBanner techCount={(technicians ?? []).length} />

        {/* Management UI */}
        <TechniciansClient initial={(technicians ?? []) as Technician[]} />
      </div>
    </div>
  )
}
