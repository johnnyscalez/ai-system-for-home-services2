"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import {
  LayoutDashboard, Users, CalendarDays, Calendar,
  Settings, LogOut, MessageSquare, TrendingUp,
  Plug, Mail, HardHat, Menu, X, HomeIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Full CRM navigation — standalone mode (we are the system of record)
const CRM_NAV = [
  { href: "/dashboard",      icon: LayoutDashboard, label: "Dashboard" },
  { href: "/leads",          icon: Users,           label: "Leads" },
  { href: "/conversations",  icon: MessageSquare,   label: "Conversations" },
  { href: "/appointments",   icon: Calendar,        label: "Appointments" },
  { href: "/calendar",       icon: CalendarDays,    label: "Calendar" },
  { href: "/technicians",    icon: HardHat,         label: "Technicians" },
  { href: "/property-image", icon: HomeIcon,        label: "Property Image" },
  { href: "/email",          icon: Mail,            label: "Email & SMS" },
  { href: "/integrations",   icon: Plug,            label: "Integrations" },
  { href: "/reports",        icon: TrendingUp,      label: "Reports" },
]

// Agent-product navigation — Housecall Pro mode. Their CRM owns the pipeline,
// calendar, invoicing, and reporting; we only surface the AI agent itself.
const AGENT_NAV = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "AI Performance" },
  { href: "/conversations", icon: MessageSquare,   label: "Conversations" },
  { href: "/technicians",   icon: HardHat,         label: "Dispatch Setup" },
  { href: "/integrations",  icon: Plug,            label: "Integrations" },
]

function FieldFMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#FFFFFF" />
      <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#FFFFFF" />
      <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
      <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
    </svg>
  )
}

function LogoLockup({ size = 20 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-[#1A1614] flex items-center justify-center shadow-sm shrink-0">
        <FieldFMark size={size} />
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
    </div>
  )
}

function NavLinks({ onNavigate, items }: { onNavigate?: () => void; items: typeof CRM_NAV }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
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

      <div className="px-3 py-4 border-t border-[#E7E5E4] space-y-0.5">
        <Link
          href="/settings"
          onClick={onNavigate}
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
    </div>
  )
}

export function Sidebar({ integrationMode }: { integrationMode?: string | null }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const items = integrationMode === "housecall_pro" ? AGENT_NAV : CRM_NAV

  // Close drawer whenever route changes
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  return (
    <>
      {/* ── Mobile top bar (only visible below md) ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#E7E5E4] flex items-center justify-between px-4 z-40">
        <Link href="/dashboard">
          <LogoLockup />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-[#78716C] hover:bg-[#F5F4F2] transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col h-full bg-white border-r border-[#E7E5E4]">
        <div className="px-5 py-5 border-b border-[#E7E5E4]">
          <Link href="/dashboard">
            <LogoLockup />
          </Link>
        </div>
        <NavLinks items={items} />
      </aside>

      {/* ── Mobile slide-out drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="relative w-72 max-w-[85vw] flex flex-col h-full bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between shrink-0">
              <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                <LogoLockup />
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-[#78716C] hover:bg-[#F5F4F2] transition-colors"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks items={items} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
