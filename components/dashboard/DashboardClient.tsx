"use client"

import { motion, useInView } from "framer-motion"
import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import {
  Users, CalendarCheck, TrendingUp,
  Snowflake, AlertTriangle, Zap, ArrowRight,
  DollarSign, BarChart3, Clock, Sparkles, Flame, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DateRangePicker, type DateRange, PRESETS } from "@/components/ui/DateRangePicker"

// ── Count-up hook ──────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400, delay = 0) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView || target === 0) { setValue(target); return }
    const timeout = setTimeout(() => {
      const steps = 50
      const increment = target / steps
      const interval = duration / steps
      let current = 0
      const timer = setInterval(() => {
        current = Math.min(current + increment, target)
        setValue(Math.round(current))
        if (current >= target) clearInterval(timer)
      }, interval)
      return () => clearInterval(timer)
    }, delay)
    return () => clearTimeout(timeout)
  }, [inView, target, duration, delay])

  return { value, ref }
}

// ── Dot grid background ────────────────────────────────────────────────────────
function DotGrid() {
  return (
    <div
      className="absolute inset-0 opacity-50"
      style={{
        backgroundImage: "radial-gradient(rgba(249,115,22,0.18) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  )
}

// ── Floating glow orbs ─────────────────────────────────────────────────────────
function GlowOrbs() {
  return (
    <>
      <motion.div
        animate={{ y: [0, -28, 0], x: [0, 14, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 700, height: 700, background: "radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 70%)", top: "-15%", left: "-8%" }}
      />
      <motion.div
        animate={{ y: [0, 22, 0], x: [0, -18, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 600, height: 600, background: "radial-gradient(circle, rgba(77,124,15,0.08) 0%, transparent 70%)", bottom: "-10%", right: "-8%" }}
      />
      <motion.div
        animate={{ y: [0, -16, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 450, height: 450, background: "radial-gradient(circle, rgba(249,115,22,0.04) 0%, transparent 70%)", top: "35%", right: "10%" }}
      />
    </>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({
  label, subLabel, value, icon: Icon, iconBg, iconColor, valueColor, suffix = "", prefix = "",
  shadowColor = "rgba(249,115,22,0.10)", delay = 0,
}: {
  label: string; subLabel?: string; value: number; icon: React.ElementType
  iconBg: string; iconColor: string; valueColor?: string
  suffix?: string; prefix?: string; shadowColor?: string; delay?: number
}) {
  const { value: displayed, ref } = useCountUp(value, 1400, delay)

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ scale: 1.02, y: -3, transition: { type: "spring", stiffness: 400, damping: 20 } }}
      className="relative bg-white rounded-2xl p-4 md:p-6 overflow-hidden cursor-default border border-[#E7E5E4]/60"
      style={{ boxShadow: `0 4px 24px ${shadowColor}, 0 1px 3px rgba(0,0,0,0.03)` }}
    >
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.02) 0%, transparent 60%)" }} />
      <div className="relative">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        <span
          ref={ref}
          className={cn("text-3xl font-bold tracking-tight block", valueColor ?? "text-[#1C1917]")}
          style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
        >
          {prefix}{displayed.toLocaleString()}{suffix}
        </span>
        <p className="text-sm text-[#78716C] mt-1 font-medium">{label}</p>
        {subLabel && <p className="text-[11px] text-[#A8A29E] mt-0.5 leading-tight">{subLabel}</p>}
      </div>
    </motion.div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; cls: string }> = {
  just_came_in:        { label: "Just came in", cls: "bg-sky-50 text-sky-700 border border-sky-100" },
  new:                 { label: "Just came in", cls: "bg-sky-50 text-sky-700 border border-sky-100" },
  contacted:           { label: "Just came in", cls: "bg-sky-50 text-sky-700 border border-sky-100" },
  active_conversation: { label: "Active",       cls: "bg-[#FFF3EC] text-[#EA580C] border border-[#F97316]/20" },
  followed_up:         { label: "Active",       cls: "bg-[#FFF3EC] text-[#EA580C] border border-[#F97316]/20" },
  nurturing:           { label: "Active",       cls: "bg-[#FFF3EC] text-[#EA580C] border border-[#F97316]/20" },
  qualified:           { label: "Qualified",    cls: "bg-amber-50 text-amber-700 border border-amber-100" },
  unqualified:         { label: "Unqualified",  cls: "bg-red-50 text-red-600 border border-red-100" },
  appointment_booked:  { label: "Booked",       cls: "bg-green-50 text-green-700 border border-green-100" },
  closed:              { label: "Closed",       cls: "bg-green-50 text-green-700 border border-green-100" },
  closed_won:          { label: "Closed",       cls: "bg-green-50 text-green-700 border border-green-100" },
  lost:                { label: "Lost",         cls: "bg-slate-50 text-slate-500 border border-slate-200" },
  cold:                { label: "Lost",         cls: "bg-slate-50 text-slate-500 border border-slate-200" },
  closed_lost:         { label: "Lost",         cls: "bg-slate-50 text-slate-500 border border-slate-200" },
  needs_attention:     { label: "Attention",    cls: "bg-red-50 text-red-600 border border-red-100" },
}

// Default range: last 30 days
function defaultRange(): DateRange {
  const today = new Date().toISOString().slice(0, 10)
  const from30 = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { from: from30, until: today, label: "Last 30 days" }
}

type DashboardStats = {
  newLeads: number; booked: number; qualified: number; cold: number
  needsAttention: number; followUpsSent: number; bookingRate: number
  revenueProjected: number; revenueClosed: number; closedCount: number; avgJobValue: number
}

// ── Props ──────────────────────────────────────────────────────────────────────
type Props = {
  greeting: string; firstName: string; companyName: string
  initialStats: DashboardStats
  recentLeads: {
    id: string; first_name: string | null; last_name: string | null
    phone: string; status: string; source: string; created_at: string
  }[]
  upcomingApts: {
    id: string; scheduled_at: string; address: string | null
    leads: { first_name: string | null; last_name: string | null; phone: string } | null
  }[]
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function DashboardClient({ greeting, firstName, companyName, initialStats, recentLeads, upcomingApts }: Props) {
  const [range, setRange]   = useState<DateRange>(defaultRange())
  const [stats, setStats]   = useState<DashboardStats>(initialStats)
  const [fetching, setFetching] = useState(false)

  const fetchStats = useCallback(async (r: DateRange) => {
    setFetching(true)
    try {
      const params = new URLSearchParams({ since: r.from, until: r.until })
      const res = await fetch(`/api/dashboard/stats?${params}`)
      if (res.ok) setStats(await res.json())
    } catch { /* non-fatal */ }
    finally { setFetching(false) }
  }, [])

  // Skip the initial fetch since server already loaded Last 30 days
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    fetchStats(range)
  }, [range, fetchStats])

  const needsAttn = stats.needsAttention

  return (
    <div className="relative min-h-full bg-[#FAFAF8] overflow-x-hidden">

      {/* ── Visual background layer ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <DotGrid />
        <GlowOrbs />
      </div>

      {/* ── Content layer ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-5 md:py-8 space-y-6 md:space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, delay: 0.8, repeat: Infinity, repeatDelay: 5 }}
              >
                <Sparkles className="w-5 h-5 text-[#F97316]" />
              </motion.div>
              <span className="text-xs font-semibold text-[#F97316] uppercase tracking-widest">Dashboard</span>
            </div>
            <h1
              className="text-3xl font-bold text-[#1C1917]"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-[#78716C] mt-1">
              Here&apos;s how{" "}
              <span className="font-semibold text-[#1C1917]">{companyName}</span>{" "}
              is performing
            </p>
          </div>

          {needsAttn > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
            >
              <Link
                href="/leads?status=needs_attention"
                className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors"
                style={{ boxShadow: "0 4px 16px rgba(220,38,38,0.12)" }}
              >
                <AlertTriangle className="w-4 h-4" />
                {needsAttn} lead{needsAttn !== 1 ? "s" : ""} need attention
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          )}
        </motion.div>

        {/* Revenue spotlight */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {/* REAL closed revenue — primary card */}
          <motion.div
            whileHover={{ scale: 1.005 }}
            className="relative overflow-hidden rounded-2xl p-6 text-white"
            style={{
              background: "linear-gradient(135deg, #14532d 0%, #166534 60%, #14532d 100%)",
              boxShadow: "0 8px 40px rgba(21,128,61,0.30), 0 2px 8px rgba(21,128,61,0.15)",
            }}
          >
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <p className="text-green-200 text-xs font-semibold uppercase tracking-widest">
                  Revenue Closed
                </p>
              </div>
              <motion.p
                key={stats.revenueClosed}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="text-4xl font-bold mt-2"
                style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                ${stats.revenueClosed.toLocaleString()}
              </motion.p>
              <p className="text-green-200 text-sm mt-1.5">
                {stats.closedCount} deal{stats.closedCount !== 1 ? "s" : ""} closed · {range.label}
              </p>
              {stats.closedCount === 0 && (
                <p className="text-green-300/60 text-xs mt-2">
                  Drag a lead to the Closed column to log revenue
                </p>
              )}
            </div>
          </motion.div>

          {/* Projected pipeline revenue — secondary card */}
          {stats.booked > 0 && stats.avgJobValue > 0 && (
            <motion.div
              whileHover={{ scale: 1.005 }}
              className="relative overflow-hidden rounded-2xl p-6 text-white"
              style={{
                background: "linear-gradient(135deg, #1A1614 0%, #0F0E0D 60%, #1A1614 100%)",
                boxShadow: "0 8px 40px rgba(249,115,22,0.20), 0 2px 8px rgba(249,115,22,0.10)",
              }}
            >
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
              <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#F97316]/10 blur-2xl" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-orange-200 text-xs font-semibold uppercase tracking-widest">
                    Pipeline Value
                  </p>
                </div>
                <motion.p
                  key={stats.revenueProjected}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="text-4xl font-bold mt-2"
                  style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                >
                  ${stats.revenueProjected.toLocaleString()}
                </motion.p>
                <p className="text-orange-200 text-sm mt-1.5">
                  {stats.booked} apt{stats.booked !== 1 ? "s" : ""} × ${stats.avgJobValue.toLocaleString()} avg
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Stats section header with date range picker */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">Performance</p>
              {fetching && <RefreshCw className="w-3 h-3 text-[#78716C] animate-spin" />}
            </div>
            <DateRangePicker value={range} onChange={r => setRange(r)} />
          </div>

          {/* Stripe-style gradient band */}
          <div className="absolute left-0 right-0 h-64 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(249,115,22,0.03) 0%, rgba(77,124,15,0.02) 100%)" }} />

          <motion.div
            key={range.label}
            variants={stagger}
            initial="hidden"
            animate="show"
            className="relative grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4"
          >
            <StatCard
              label="New leads"
              subLabel={range.label}
              value={stats.newLeads} icon={Users} iconBg="bg-blue-50" iconColor="text-blue-600" delay={0}
            />
            <StatCard
              label="Appointments booked"
              subLabel={range.label}
              value={stats.booked} icon={CalendarCheck} iconBg="bg-green-50" iconColor="text-green-600"
              valueColor="text-[#4D7C0F]" shadowColor="rgba(77,124,15,0.12)" delay={80}
            />
            <StatCard
              label="Booking rate"
              subLabel="Leads → appointments"
              value={stats.bookingRate} icon={BarChart3} iconBg="bg-amber-50" iconColor="text-amber-600"
              suffix="%" delay={160}
            />
            <StatCard
              label="Follow-ups sent by AI"
              subLabel="Proactive check-ins only"
              value={stats.followUpsSent} icon={Zap} iconBg="bg-[#FFF3EC]" iconColor="text-[#EA580C]"
              shadowColor="rgba(249,115,22,0.10)" delay={240}
            />
            <StatCard
              label="Hot leads"
              subLabel="Replied but not yet booked"
              value={stats.qualified} icon={Flame} iconBg="bg-orange-50" iconColor="text-orange-500"
              valueColor="text-orange-600" shadowColor="rgba(249,115,22,0.10)" delay={320}
            />
            <StatCard
              label="Cold leads"
              subLabel="No reply in 7+ days"
              value={stats.cold} icon={Snowflake} iconBg="bg-slate-100" iconColor="text-slate-500"
              valueColor="text-[#78716C]" shadowColor="rgba(0,0,0,0.05)" delay={400}
            />
          </motion.div>
        </div>

        {/* Bottom row */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
        >
          {/* Recent leads */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }}
            className="bg-white rounded-2xl overflow-hidden border border-[#E7E5E4]/60"
            style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.08), 0 1px 3px rgba(0,0,0,0.03)" }}
          >
            <div className="px-6 py-4 border-b border-[#F5F4F2] flex items-center justify-between">
              <h2 className="font-semibold text-[#1C1917]"
                style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Recent Leads
              </h2>
              <Link href="/leads"
                className="text-xs text-[#F97316] font-medium hover:underline flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-[#F5F4F2]">
              {recentLeads.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F4F2] flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-[#E7E5E4]" />
                  </div>
                  <p className="text-sm font-medium text-[#78716C]">No leads yet</p>
                  <p className="text-xs text-[#78716C] mt-1 opacity-70">Connect a lead source to get started</p>
                </div>
              ) : (
                recentLeads.map((lead, i) => {
                  const s = STATUS[lead.status] ?? { label: lead.status, cls: "bg-slate-50 text-slate-500 border border-slate-200" }
                  return (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.07, ease: "easeOut" }}
                    >
                      <Link href={`/leads/${lead.id}`}
                        className="flex items-center justify-between px-6 py-3.5 hover:bg-[#FAFAF8] transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F97316]/10 to-[#F97316]/5 flex items-center justify-center text-xs font-bold text-[#F97316] border border-[#F97316]/10">
                            {lead.first_name?.[0] ?? "?"}{lead.last_name?.[0] ?? ""}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1C1917] group-hover:text-[#F97316] transition-colors">
                              {lead.first_name ?? "Unknown"} {lead.last_name ?? ""}
                            </p>
                            <p className="text-xs text-[#78716C]"
                              style={{ fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace" }}>
                              {lead.phone}
                            </p>
                          </div>
                        </div>
                        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", s.cls)}>
                          {s.label}
                        </span>
                      </Link>
                    </motion.div>
                  )
                })
              )}
            </div>
          </motion.div>

          {/* Upcoming appointments */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }}
            className="bg-white rounded-2xl overflow-hidden border border-[#E7E5E4]/60"
            style={{ boxShadow: "0 4px 24px rgba(77,124,15,0.08), 0 1px 3px rgba(0,0,0,0.03)" }}
          >
            <div className="px-6 py-4 border-b border-[#F5F4F2] flex items-center justify-between">
              <h2 className="font-semibold text-[#1C1917]"
                style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Upcoming Appointments
              </h2>
              <Link href="/appointments"
                className="text-xs text-[#F97316] font-medium hover:underline flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-[#F5F4F2]">
              {upcomingApts.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F4F2] flex items-center justify-center mx-auto mb-3">
                    <CalendarCheck className="w-6 h-6 text-[#E7E5E4]" />
                  </div>
                  <p className="text-sm font-medium text-[#78716C]">No upcoming appointments</p>
                  <p className="text-xs text-[#78716C] mt-1 opacity-70">Your AI will book them automatically</p>
                </div>
              ) : (
                upcomingApts.map((apt, i) => {
                  const date = new Date(apt.scheduled_at)
                  const lead = apt.leads
                  return (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.07, ease: "easeOut" }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-[#FAFAF8] transition-colors"
                    >
                      <div className="w-12 shrink-0 text-center bg-gradient-to-b from-[#F97316]/5 to-transparent rounded-xl py-1.5 border border-[#F97316]/10">
                        <p className="text-[10px] font-bold text-[#F97316] uppercase tracking-wider">
                          {date.toLocaleDateString("en-US", { month: "short" })}
                        </p>
                        <p className="text-2xl font-bold text-[#1C1917] leading-none mt-0.5"
                          style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                          {date.getDate()}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1C1917] truncate">
                          {lead?.first_name ?? "Unknown"} {lead?.last_name ?? ""}
                        </p>
                        <p className="text-xs text-[#78716C] flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {apt.address && <span className="truncate">· {apt.address}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#4D7C0F]" />
                        <span className="text-xs text-[#4D7C0F] font-medium">Confirmed</span>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* Decorative bottom line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
          className="h-px w-full origin-left"
          style={{ background: "linear-gradient(90deg, #F97316, rgba(77,124,15,0.5), transparent)" }}
        />

      </div>
    </div>
  )
}
