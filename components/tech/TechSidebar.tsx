"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Calendar, LogOut, HardHat, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface Props {
  techName: string
  companyName: string
}

const NAV = [
  { href: "/tech/appointments", icon: Calendar, label: "My Appointments" },
]

export function TechSidebar({ techName, companyName }: Props) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/tech/login")
  }

  return (
    <aside className="w-[220px] shrink-0 h-screen bg-white border-r border-[#E7E5E4] flex flex-col sticky top-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[#E7E5E4]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center shadow-sm">
            <HardHat className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1C1917] truncate">{companyName}</p>
            <p className="text-[10px] text-[#A8A29E]">Tech Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-[#FFF3EC] text-[#F97316]"
                    : "text-[#78716C] hover:bg-[#F5F4F2] hover:text-[#1C1917]"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#F97316]" : "text-[#A8A29E]")} />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-[#F97316]/60" />}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-[#E7E5E4]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F5F4F2] mb-2">
          <div className="w-7 h-7 rounded-full bg-[#F97316]/20 flex items-center justify-center text-[#F97316] text-xs font-bold shrink-0">
            {techName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#1C1917] truncate">{techName}</p>
            <p className="text-[10px] text-[#A8A29E]">Technician</p>
          </div>
        </div>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#78716C] hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  )
}
