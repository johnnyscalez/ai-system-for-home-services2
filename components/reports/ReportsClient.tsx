"use client"

import { motion, useInView } from "framer-motion"
import { useEffect, useRef, useState, useCallback } from "react"
import {
  Users, CalendarCheck, TrendingUp, DollarSign,
  ArrowUpRight, ArrowDownRight, Minus,
  BarChart3, PieChart, GitMerge, HardHat,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DateRangePicker, type DateRange, PRESETS } from "@/components/ui/DateRangePicker"

// ── Types ─────────────────────────────────────────────────────────────────────

type TechRow = {
  id: string; name: string; status: string
  appointments: number; closedJobs: number; revenue: number
}

type Props = {
  leadsThisMonth: number
  leadsLastMonth: number
  monthOverMonthDelta: number | null
  totalLeads: number
  appointmentsThisMonth: number
  totalAppointments: number
  bookingRate: number
  revenueAtRisk: number
  revenueClosed: number
  closedCount: number
  avgJobValue: number
  dailyLeads: { date: string; count: number }[]
  statusCounts: Record<string, number>
  sourceCounts: Record<string, number>
  funnel: { stage: string; count: number }[]
  techPerformance: TechRow[]
}

// ── Count-up ──────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView || target === 0) { setValue(target); return }
    const timeout = setTimeout(() => {
      const steps = 40
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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  suffix = "",
  prefix = "",
  delta,
  icon: Icon,
  iconColor,
  delay = 0,
}: {
  label: string
  value: number
  suffix?: string
  prefix?: string
  delta?: number | null
  icon: React.ElementType
  iconColor: string
  delay?: number
}) {
  const { value: animated, ref } = useCountUp(value, 1200, delay)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000 }}
      className="bg-white rounded-2xl p-5 border border-border/60"
      style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        {delta !== undefined && delta !== null && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            delta > 0 ? "bg-emerald-50 text-emerald-600" :
            delta < 0 ? "bg-red-50 text-red-500" :
            "bg-gray-100 text-gray-500"
          )}>
            {delta > 0 ? <ArrowUpRight className="w-3 h-3" /> :
             delta < 0 ? <ArrowDownRight className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {Math.abs(delta)}% vs last month
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-foreground tracking-tight font-mono">
        {prefix}<span ref={ref}>{animated.toLocaleString()}</span>{suffix}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </motion.div>
  )
}

// ── Sparkline bar chart ───────────────────────────────────────────────────────

function SparkBar({ dailyLeads }: { dailyLeads: { date: string; count: number }[] }) {
  const max = Math.max(...dailyLeads.map((d) => d.count), 1)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  return (
    <div ref={ref} className="flex items-end gap-0.5 h-16">
      {dailyLeads.map((d, i) => {
        const pct = (d.count / max) * 100
        return (
          <motion.div
            key={d.date}
            className="flex-1 rounded-sm bg-primary/20 hover:bg-primary/50 transition-colors cursor-default group relative"
            initial={{ height: 0 }}
            animate={inView ? { height: `${Math.max(pct, 4)}%` } : { height: 0 }}
            transition={{ duration: 0.4, delay: i * 0.01 }}
            title={`${d.date}: ${d.count} lead${d.count !== 1 ? "s" : ""}`}
          />
        )
      })}
    </div>
  )
}

// ── Funnel bar ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  appointment_booked: "Booked",
  closed_lost: "Lost",
}

const STAGE_COLORS: Record<string, string> = {
  new: "bg-sky-400",
  contacted: "bg-blue-500",
  qualified: "bg-[#F97316]",
  appointment_booked: "bg-emerald-500",
  closed_lost: "bg-red-400",
}

// ── Source labels ─────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook Ads",
  webhook: "Webhook / Other",
  manual: "Manual",
  organic: "Organic SMS",
  unknown: "Unknown",
}

// ── Main component ────────────────────────────────────────────────────────────

function defaultRange(): DateRange {
  const today = new Date().toISOString().slice(0, 10)
  const from = new Date()
  from.setDate(1)
  return { from: from.toISOString().slice(0, 10), until: today, label: "This month" }
}

export function ReportsClient({
  leadsThisMonth: initialLeadsInPeriod,
  monthOverMonthDelta,
  totalLeads: initialTotalLeads,
  appointmentsThisMonth: initialAptInPeriod,
  totalAppointments: initialTotalApts,
  bookingRate: initialBookingRate,
  revenueAtRisk: initialRevenueAtRisk,
  revenueClosed: initialRevenueClosed,
  closedCount: initialClosedCount,
  avgJobValue,
  dailyLeads: initialDailyLeads,
  statusCounts: initialStatusCounts,
  sourceCounts: initialSourceCounts,
  funnel: initialFunnel,
  techPerformance: initialTechPerf,
}: Props) {
  const [range, setRange]       = useState<DateRange>(defaultRange())
  const [fetching, setFetching] = useState(false)

  // Live data — starts from server-rendered props, updates on range change
  const [leadsInPeriod, setLeadsInPeriod]   = useState(initialLeadsInPeriod)
  const [totalLeads, setTotalLeads]         = useState(initialTotalLeads)
  const [aptInPeriod, setAptInPeriod]       = useState(initialAptInPeriod)
  const [totalApts, setTotalApts]           = useState(initialTotalApts)
  const [bookingRate, setBookingRate]       = useState(initialBookingRate)
  const [revenueAtRisk, setRevenueAtRisk]   = useState(initialRevenueAtRisk)
  const [revenueClosed, setRevenueClosed]   = useState(initialRevenueClosed)
  const [closedCount, setClosedCount]       = useState(initialClosedCount)
  const [dailyLeads, setDailyLeads]         = useState(initialDailyLeads)
  const [statusCounts, setStatusCounts]     = useState(initialStatusCounts)
  const [sourceCounts, setSourceCounts]     = useState(initialSourceCounts)
  const [funnel, setFunnel]                 = useState(initialFunnel)
  const [techPerformance, setTechPerf]      = useState(initialTechPerf)

  const fetchReports = useCallback(async (r: DateRange) => {
    setFetching(true)
    try {
      const params = new URLSearchParams({ since: r.from, until: r.until })
      const res = await fetch(`/api/reports/stats?${params}`)
      if (!res.ok) return
      const d = await res.json()
      setLeadsInPeriod(d.leadsInPeriod)
      setTotalLeads(d.totalLeads)
      setAptInPeriod(d.appointmentsInPeriod)
      setTotalApts(d.totalAppointments)
      setBookingRate(d.bookingRate)
      setRevenueAtRisk(d.revenueAtRisk)
      setRevenueClosed(d.revenueClosed)
      setClosedCount(d.closedCount)
      setDailyLeads(d.dailyLeads)
      setStatusCounts(d.statusCounts)
      setSourceCounts(d.sourceCounts)
      setFunnel(d.funnel)
      setTechPerf(d.techPerformance)
    } catch { /* non-fatal */ }
    finally { setFetching(false) }
  }, [])

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    fetchReports(range)
  }, [range, fetchReports])

  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1)

  return (
    <div className="relative min-h-screen bg-[#FAFAF8]">
      {/* Visual background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(249,115,22,0.06)", top: "-5%", left: "-5%" }} />
        <motion.div animate={{ y: [0, 18, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.05)", bottom: "0", right: "0" }} />
      </div>

      <div className="relative z-10 p-8 max-w-6xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Reports</h1>
              <p className="text-muted-foreground mt-1">
                Performance analytics · {range.label}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {fetching && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
              <DateRangePicker value={range} onChange={r => setRange(r)} />
            </div>
          </div>
        </motion.div>

        {/* Revenue spotlight — closed deals */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl p-6 text-white mb-6"
          style={{
            background: "linear-gradient(135deg, #14532d 0%, #166534 60%, #14532d 100%)",
            boxShadow: "0 8px 40px rgba(21,128,61,0.25), 0 2px 8px rgba(21,128,61,0.12)",
          }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <p className="text-green-200 text-xs font-bold uppercase tracking-widest">Total Revenue Closed</p>
              </div>
              <p className="text-5xl font-bold" style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                ${revenueClosed.toLocaleString()}
              </p>
              <p className="text-green-200 text-sm mt-2">
                {closedCount} deal{closedCount !== 1 ? "s" : ""} · {range.label}
                {closedCount > 0 && ` · avg $${Math.round(revenueClosed / closedCount).toLocaleString()} per deal`}
              </p>
            </div>
            <div className="flex gap-4 sm:flex-col sm:items-end">
              <div className="text-center sm:text-right">
                <p className="text-2xl font-bold">{closedCount}</p>
                <p className="text-green-200 text-xs">Deals closed</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-2xl font-bold">${avgJobValue.toLocaleString()}</p>
                <p className="text-green-200 text-xs">Avg job value</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label={`Leads · ${range.label}`}
            value={leadsInPeriod}
            icon={Users}
            iconColor="bg-[#FFF3EC] text-[#EA580C]"
            delay={0}
          />
          <StatCard
            label={`Appointments · ${range.label}`}
            value={aptInPeriod}
            icon={CalendarCheck}
            iconColor="bg-emerald-100 text-emerald-600"
            delay={100}
          />
          <StatCard
            label="Booking rate (period)"
            value={bookingRate}
            suffix="%"
            icon={TrendingUp}
            iconColor="bg-sky-100 text-sky-600"
            delay={200}
          />
          <StatCard
            label="Revenue at risk (active leads)"
            value={revenueAtRisk}
            prefix="$"
            icon={DollarSign}
            iconColor="bg-amber-100 text-amber-600"
            delay={300}
          />
        </div>

        {/* Daily lead volume */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white rounded-2xl p-6 border border-border/60 mb-6"
          style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Lead volume — last 30 days</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">{leadsInPeriod} leads · {range.label}</p>
          <SparkBar dailyLeads={dailyLeads} />
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">30 days ago</span>
            <span className="text-[10px] text-muted-foreground">Today</span>
          </div>
        </motion.div>

        {/* Funnel + Source grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Conversion funnel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-white rounded-2xl p-6 border border-border/60"
            style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <GitMerge className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Conversion funnel</h2>
            </div>
            <div className="space-y-3">
              {funnel.map((f) => {
                const pct = Math.round((f.count / maxFunnel) * 100)
                return (
                  <div key={f.stage}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-muted-foreground">{STAGE_LABELS[f.stage] ?? f.stage}</span>
                      <span className="text-xs font-semibold tabular-nums">{f.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", STAGE_COLORS[f.stage] ?? "bg-primary")}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Overall booking rate</span>
              <span className="text-sm font-bold text-emerald-600">{bookingRate}%</span>
            </div>
          </motion.div>

          {/* Lead sources */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="bg-white rounded-2xl p-6 border border-border/60"
            style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Leads by source</h2>
            </div>
            {Object.keys(sourceCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(sourceCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([src, count]) => {
                    const pct = leadsInPeriod > 0 ? Math.round((count / leadsInPeriod) * 100) : 0
                    return (
                      <div key={src}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">
                            {SOURCE_LABELS[src] ?? src}
                          </span>
                          <span className="text-xs font-semibold tabular-nums">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-primary/60"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.45 }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Technician Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="bg-white rounded-2xl border border-border/60 overflow-hidden mb-6"
          style={{ boxShadow: "0 4px 24px rgba(77,124,15,0.06)" }}
        >
          <div className="px-6 py-4 border-b border-border/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4D7C0F]/10 flex items-center justify-center">
              <HardHat className="w-3.5 h-3.5 text-[#4D7C0F]" />
            </div>
            <h2 className="font-semibold text-sm">Technician Performance</h2>
            <span className="text-xs text-muted-foreground ml-1">— AI-booked appointments & closed deals per tech</span>
          </div>

          {techPerformance.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <HardHat className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No technicians added yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your team in <a href="/technicians" className="text-[#4D7C0F] underline">Technicians</a> to track performance here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F5F4F2] text-[11px] font-semibold text-[#78716C] uppercase tracking-wider">
                    <th className="text-left px-6 py-3">Technician</th>
                    <th className="text-center px-4 py-3">Appointments booked</th>
                    <th className="text-center px-4 py-3">Jobs closed</th>
                    <th className="text-right px-6 py-3">Revenue generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {techPerformance.map((tech, i) => (
                    <motion.tr
                      key={tech.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className="hover:bg-[#F5F4F2]/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#4D7C0F]/10 flex items-center justify-center shrink-0">
                            <HardHat className="w-3.5 h-3.5 text-[#4D7C0F]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#1C1917]">{tech.name}</p>
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                              tech.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-500"
                            )}>
                              {tech.status}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-[#1C1917] font-mono">{tech.appointments}</span>
                          <span className="text-[10px] text-[#78716C]">booked by AI</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-[#1C1917] font-mono">{tech.closedJobs}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {tech.appointments > 0 && (
                              <span className="text-[10px] text-[#78716C]">
                                {Math.round((tech.closedJobs / tech.appointments) * 100)}% close rate
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "text-lg font-bold font-mono",
                          tech.revenue > 0 ? "text-[#4D7C0F]" : "text-[#78716C]"
                        )}>
                          ${tech.revenue.toLocaleString()}
                        </span>
                        {tech.closedJobs > 0 && (
                          <p className="text-[10px] text-[#78716C] mt-0.5">
                            avg ${Math.round(tech.revenue / tech.closedJobs).toLocaleString()}/job
                          </p>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                {techPerformance.length > 1 && (
                  <tfoot>
                    <tr className="bg-[#4D7C0F]/5 border-t-2 border-[#4D7C0F]/20">
                      <td className="px-6 py-3 text-xs font-bold text-[#1C1917]">Total</td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-[#1C1917] font-mono">
                        {techPerformance.reduce((s, t) => s + t.appointments, 0)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-[#1C1917] font-mono">
                        {techPerformance.reduce((s, t) => s + t.closedJobs, 0)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-[#4D7C0F] font-mono">
                        ${techPerformance.reduce((s, t) => s + t.revenue, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </motion.div>

        {/* All-time summary strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/20"
        >
          <h2 className="font-semibold text-sm mb-4">All-time totals</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <AllTimeStat label="Total leads" value={totalLeads} />
            <AllTimeStat label="Appointments booked" value={totalApts} />
            <AllTimeStat
              label="Avg. job value"
              value={avgJobValue}
              format={(v) => `$${v.toLocaleString()}`}
            />
            <AllTimeStat
              label="Revenue potential booked"
              value={totalApts * avgJobValue}
              format={(v) => `$${v.toLocaleString()}`}
              green
            />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function AllTimeStat({
  label,
  value,
  format,
  green,
}: {
  label: string
  value: number
  format?: (v: number) => string
  green?: boolean
}) {
  const { value: animated, ref } = useCountUp(value, 1400, 500)
  return (
    <div>
      <p className={cn("text-2xl font-bold font-mono", green ? "text-emerald-600" : "text-foreground")}>
        <span ref={ref}>{format ? format(animated) : animated.toLocaleString()}</span>
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
