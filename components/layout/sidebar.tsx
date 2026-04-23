"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import {
  LayoutDashboard, Users, CalendarDays, Calendar,
  FileText, Settings, LogOut, MessageSquare, TrendingUp,
  Zap, Plug,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/leads", icon: Users, label: "Leads" },
  { href: "/conversations", icon: MessageSquare, label: "Conversations" },
  { href: "/appointments", icon: Calendar, label: "Appointments" },
  { href: "/integrations", icon: Plug, label: "Integrations" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/invoices", icon: FileText, label: "Invoices" },
  { href: "/reports", icon: TrendingUp, label: "Reports" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full bg-white border-r border-[#E7E5E4]">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[#E7E5E4]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span
            className="font-bold text-[#1C1917] tracking-tight"
            style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            LeadReply
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[#7C3AED]/8 text-[#7C3AED]"
                  : "text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F2]"
              )}
            >
              <Icon
                className={cn("w-4 h-4 shrink-0", active ? "text-[#7C3AED]" : "text-[#78716C]")}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[#E7E5E4] space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            pathname.startsWith("/settings")
              ? "bg-[#7C3AED]/8 text-[#7C3AED]"
              : "text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F2]"
          )}
        >
          <Settings className={cn("w-4 h-4", pathname.startsWith("/settings") ? "text-[#7C3AED]" : "text-[#78716C]")} />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F2] transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
