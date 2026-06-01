"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import {
  LayoutDashboard, Users, CalendarDays, Calendar,
  Settings, LogOut, MessageSquare, TrendingUp,
  Plug, Mail, HardHat,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
  { href: "/leads",         icon: Users,           label: "Leads" },
  { href: "/conversations", icon: MessageSquare,   label: "Conversations" },
  { href: "/appointments",  icon: Calendar,        label: "Appointments" },
  { href: "/calendar",      icon: CalendarDays,    label: "Calendar" },
  { href: "/technicians",   icon: HardHat,         label: "Technicians" },
  { href: "/email",         icon: Mail,            label: "Email & SMS" },
  { href: "/integrations",  icon: Plug,            label: "Integrations" },
  { href: "/reports",       icon: TrendingUp,      label: "Reports" },
]

// FieldBuilt AI — Field F mark (orange top arm, never bottom bar so it never reads as E)
function FieldFMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#1C1917" />
      <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#1C1917" />
      <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
      <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
    </svg>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full bg-white border-r border-[#E7E5E4]">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#E7E5E4]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1A1614] flex items-center justify-center shadow-sm shrink-0">
            <FieldFMark size={20} />
          </div>
          <span
            className="font-extrabold text-[#1C1917] tracking-tight leading-none"
            style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
          >
            FIELDBUILT
            <span
              className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
              style={{ fontSize: "0.42em", background: "#F97316", padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}
            >
              AI
            </span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[#FFF3EC] text-[#EA580C]"
                  : "text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F2]"
              )}
            >
              <Icon
                className={cn("w-4 h-4 shrink-0", active ? "text-[#F97316]" : "text-[#A8A29E]")}
                aria-hidden="true"
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
              ? "bg-[#FFF3EC] text-[#EA580C]"
              : "text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F2]"
          )}
        >
          <Settings className={cn("w-4 h-4", pathname.startsWith("/settings") ? "text-[#F97316]" : "text-[#A8A29E]")} aria-hidden="true" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F2] transition-all duration-150"
        >
          <LogOut className="w-4 h-4 text-[#A8A29E]" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
