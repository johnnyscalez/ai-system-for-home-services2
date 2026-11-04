import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { TechniciansClient } from "@/components/settings/TechniciansClient"
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
          style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(249,115,22,0.05)", top: "-10%", left: "-5%" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.04)", bottom: "-5%", right: "10%" }} />
      </div>

      <div className="relative z-10 p-6 max-w-3xl">
        <TechniciansClient initial={(technicians ?? []) as Technician[]} />
      </div>
    </div>
  )
}
