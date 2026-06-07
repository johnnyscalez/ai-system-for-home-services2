import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { PropertyImageLookup } from "@/components/property/PropertyImageLookup"

export default async function PropertyImagePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  return (
    <div className="relative min-h-screen">
      {/* Visual background layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(249,115,22,0.05)", top: "-10%", right: "-5%" }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.04)", bottom: "-5%", left: "10%" }}
        />
      </div>

      <div className="relative z-10 p-6 md:p-8 max-w-2xl">
        {/* Page header */}
        <div className="mb-8">
          <h1
            className="text-2xl font-bold text-[#1C1917]"
            style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans')" }}
          >
            Property Image Lookup
          </h1>
          <p className="text-sm text-[#78716C] mt-1">
            Enter any US address to pull a real Street View photo or satellite image directly from Google Maps.
          </p>
        </div>

        {/* Lookup card */}
        <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6">
          <PropertyImageLookup />
        </div>

        {/* Info footer */}
        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          {[
            {
              icon: "📸",
              title: "Street View first",
              desc: "We always try to find a ground-level photo of the property before falling back to satellite.",
            },
            {
              icon: "🛰️",
              title: "Satellite fallback",
              desc: "When no Street View exists, you get a high-zoom satellite map centred on the address.",
            },
            {
              icon: "🔒",
              title: "Secure by design",
              desc: "Your Google API key never leaves the server — images are proxied so the key stays private.",
            },
          ].map(item => (
            <div
              key={item.title}
              className="bg-white border border-[#E7E5E4] rounded-xl p-4 text-sm shadow-sm"
            >
              <div className="text-xl mb-2">{item.icon}</div>
              <p className="font-semibold text-[#1C1917] mb-0.5">{item.title}</p>
              <p className="text-xs text-[#78716C] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
