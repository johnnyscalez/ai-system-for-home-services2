"use client"

import { motion, useInView } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import {
  Users, CalendarCheck, TrendingUp, DollarSign,
  ArrowUpRight, ArrowDownRight, Minus,
  BarChart3, PieChart, GitMerge,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  leadsThisMonth: number
  leadsLastMonth: number
  monthOverMonthDelta: number | null
  totalLeads: number
  appointmentsThisMonth: number
  totalAppointments: number
  bookingRate: number
  revenueAtRisk: number
  avgJobValue: number
  dailyLeads: { date: string; count: number }[]
  statusCounts: Record<string, number>
  sourceCounts: Record<string, number>
  funnel: { stage: string; count: number }[]
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
      style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.06)" }}
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
  qualified: "bg-violet-500",
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

export function ReportsClient({
  leadsThisMonth,
  monthOverMonthDelta,
  totalLeads,
  appointmentsThisMonth,
  totalAppointments,
  bookingRate,
  revenueAtRisk,
  avgJobValue,
  dailyLeads,
  statusCounts,
  sourceCounts,
  funnel,
}: Props) {
  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1)

  return (
    <div className="relative min-h-screen bg-[#FAFAF8]">
      {/* Visual background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "radial-gradient(rgba(124,58,237,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(124,58,237,0.06)", top: "-5%", left: "-5%" }} />
        <motion.div animate={{ y: [0, 18, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.05)", bottom: "0", right: "0" }} />
      </div>

      <div className="relative z-10 p-8 max-w-6xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Performance overview — all time and this month
          </p>
        </motion.div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Leads this month"
            value={leadsThisMonth}
            delta={monthOverMonthDelta}
            icon={Users}
            iconColor="bg-violet-100 text-violet-600"
            delay={0}
          />
          <StatCard
            label="Appointments booked this month"
            value={appointmentsThisMonth}
            icon={CalendarCheck}
            iconColor="bg-emerald-100 text-emerald-600"
            delay={100}
          />
          <StatCard
            label="Booking rate (all time)"
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
          style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Lead volume — last 30 days</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">{totalLeads} leads all time</p>
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
            style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.06)" }}
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
            style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.06)" }}
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
                    const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
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

        {/* All-time summary strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/20"
        >
          <h2 className="font-semibold text-sm mb-4">All-time summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <AllTimeStat label="Total leads" value={totalLeads} />
            <AllTimeStat label="Appointments booked" value={totalAppointments} />
            <AllTimeStat
              label="Avg. job value"
              value={avgJobValue}
              format={(v) => `$${v.toLocaleString()}`}
            />
            <AllTimeStat
              label="Revenue potential booked"
              value={totalAppointments * avgJobValue}
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
