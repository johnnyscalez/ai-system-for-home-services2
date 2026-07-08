"use client"

import { motion, useInView } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Moon, CalendarCheck, MessagesSquare, UserPlus, PhoneCall,
  DollarSign, TrendingUp, Sparkles, ArrowRight, Phone, MessageSquare,
  Megaphone, MessageCircle, Globe, Webhook as WebhookIcon, CheckCircle2, PencilLine, CircleDashed,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Agent Performance Dashboard — HCP integration mode.
// Not a CRM. One job: show the owner what the AI made them while they slept.
// The night hero is fixed to last night; everything below obeys the
// source + time-range filters.
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    if (target === 0) { setValue(0); return }
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

  // When the target changes after the initial animation (filters), snap to it
  const animated = useRef(false)
  useEffect(() => {
    if (animated.current) setValue(target)
    const t = setTimeout(() => { animated.current = true }, duration + delay + 100)
    return () => clearTimeout(t)
  }, [target, duration, delay])

  return { value, ref }
}

// ── Source + channel badges ────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; cls: string; icon?: React.ElementType }> = {
  facebook:            { label: "FB Lead Ad", cls: "bg-blue-50 text-blue-700 border-blue-100", icon: Megaphone },
  facebook_lead_ads:   { label: "FB Lead Ad", cls: "bg-blue-50 text-blue-700 border-blue-100", icon: Megaphone },
  messenger:           { label: "Messenger", cls: "bg-violet-50 text-violet-700 border-violet-100", icon: MessageCircle },
  whatsapp:            { label: "WhatsApp", cls: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: MessageSquare },
  website:             { label: "Website form", cls: "bg-stone-100 text-stone-700 border-stone-200", icon: Globe },
  "hvac-lead-capture": { label: "Website form", cls: "bg-stone-100 text-stone-700 border-stone-200", icon: Globe },
  typeform:            { label: "Typeform", cls: "bg-stone-100 text-stone-700 border-stone-200", icon: Globe },
  google:              { label: "Google", cls: "bg-amber-50 text-amber-700 border-amber-100", icon: Globe },
  webhook:             { label: "Webhook", cls: "bg-stone-100 text-stone-700 border-stone-200", icon: WebhookIcon },
  voice_inbound:       { label: "Phone call", cls: "bg-orange-50 text-orange-700 border-orange-100", icon: Phone },
  sms_inbound:         { label: "Text in", cls: "bg-orange-50 text-orange-700 border-orange-100", icon: MessageSquare },
  sms:                 { label: "Text in", cls: "bg-orange-50 text-orange-700 border-orange-100", icon: MessageSquare },
}

function sourceMeta(source: string | null) {
  return SOURCE_META[source ?? ""] ?? { label: source ?? "Direct", cls: "bg-stone-100 text-stone-600 border-stone-200" }
}

function SourceBadge({ source }: { source: string | null }) {
  const b = sourceMeta(source)
  const Icon = b.icon
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", b.cls)}>
      {Icon && <Icon className="w-3 h-3" />}
      {b.label}
    </span>
  )
}

function ChannelIcon({ channel }: { channel: string | null }) {
  if (channel === "voice") return <Phone className="w-3.5 h-3.5 text-[#78716C]" aria-label="Voice conversation" />
  return <MessageSquare className="w-3.5 h-3.5 text-[#78716C]" aria-label="Text conversation" />
}

function HcpChip({ jobId, edited }: { jobId: string | null; edited: boolean }) {
  if (jobId && edited) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
      <PencilLine className="w-3 h-3" /> Edited in Housecall Pro
    </span>
  )
  if (jobId) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-lime-50 text-lime-800 border border-lime-100">
      <CheckCircle2 className="w-3 h-3" /> In Housecall Pro
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-500 border border-stone-200">
      <CircleDashed className="w-3 h-3" /> Not synced
    </span>
  )
}

// ── Night stat tile (fixed hero) ───────────────────────────────────────────────

function NightStat({ label, value, icon: Icon, accent, delay = 0 }: {
  label: string; value: number; icon: React.ElementType; accent: string; delay?: number
}) {
  const { value: displayed, ref } = useCountUp(value, 1200, delay)
  return (
    <div className="relative rounded-xl px-4 py-3.5 bg-white/[0.06] border border-white/10 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
      </div>
      <span ref={ref} className="text-3xl font-bold text-white tabular-nums"
        style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
        {displayed.toLocaleString()}
      </span>
    </div>
  )
}

// ── Money stat card ────────────────────────────────────────────────────────────

function MoneyCard({ label, subLabel, cents, count, delay = 0, estimated = false }: {
  label: string; subLabel: string; cents: number; count?: number; delay?: number; estimated?: boolean
}) {
  const dollars = Math.round(cents / 100)
  const { value: displayed, ref } = useCountUp(dollars, 1400, delay)
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="relative bg-white rounded-2xl p-5 md:p-6 border border-[#E7E5E4]/60 overflow-hidden"
      style={{ boxShadow: "0 4px 24px rgba(77,124,15,0.08), 0 1px 3px rgba(0,0,0,0.03)" }}
    >
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: "linear-gradient(135deg, rgba(77,124,15,0.03) 0%, transparent 60%)" }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#1C1917]">{label}</p>
          {count != null && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F5F4F2] text-[#78716C]">
              {count} {count === 1 ? "job" : "jobs"}
            </span>
          )}
        </div>
        <span ref={ref}
          className={cn("text-3xl md:text-[34px] font-bold tracking-tight block tabular-nums", estimated ? "text-[#78716C]" : "text-[#4D7C0F]")}
          style={{ fontFamily: "var(--font-mono), 'JetBrains Mono', monospace" }}>
          ${displayed.toLocaleString()}
        </span>
        <p className="text-xs text-[#78716C] mt-1.5">{subLabel}</p>
      </div>
    </motion.div>
  )
}

// ── Bookings bar chart ─────────────────────────────────────────────────────────

function BookingBars({ data, unitLabel }: {
  data: Array<{ key: string; label: string; count: number }>
  unitLabel: string
}) {
  const max = Math.max(1, ...data.map(d => d.count))
  const labelEvery = data.length > 16 ? 4 : data.length > 8 ? 2 : 1
  return (
    <div>
      <div className="flex items-end gap-[5px] h-[120px]" role="img"
        aria-label={`Bookings per ${unitLabel}`}>
        {data.map((d) => (
          <div key={d.key} className="group relative flex-1 flex flex-col items-center justify-end h-full min-w-0">
            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10
              bg-[#1C1917] text-white text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap">
              {d.label}: {d.count} {d.count === 1 ? "job" : "jobs"}
            </div>
            <div
              className="w-full rounded-t-[4px] transition-colors group-hover:bg-[#EA580C]"
              style={{
                height: `${Math.max(d.count === 0 ? 2 : 8, (d.count / max) * 112)}px`,
                background: d.count === 0 ? "#E7E5E4" : "#F97316",
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[5px] mt-1.5 border-t border-[#E7E5E4] pt-1.5">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center text-[9px] text-[#A8A29E] font-medium tabular-nums truncate">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type AgentBooking = {
  id: string
  scheduled_at: string
  status: string
  address: string | null
  notes: string | null
  technician_name: string | null
  hcp_job_id: string | null
  hcp_manually_edited: boolean
  created_at: string
  leads: {
    id: string; first_name: string | null; last_name: string | null
    phone: string; source: string | null; channel: string | null; job_type: string | null
  } | null
}

export type LeadRow = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  source: string | null
  channel: string | null
  status: string
  created_at: string
  last_message_at: string | null
}

export type RevenueEventRow = {
  lead_id: string | null
  amount_cents: number | null
  attribution: string | null
  created_at: string
}

type Props = {
  firstName: string
  companyName: string
  nightLabel: string
  night: { booked: number; conversations: number; newLeads: number; callbacks: number }
  avgJobValueCents: number
  bookings: AgentBooking[]        // last 90 days
  leadsAll: LeadRow[]             // last 90 days + all current needs_attention
  revenueEvents: RevenueEventRow[] // last 90 days
  hcpConnected: boolean
}

// ── Filters ────────────────────────────────────────────────────────────────────

const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d",    label: "7 days", days: 7 },
  { key: "30d",   label: "30 days", days: 30 },
  { key: "90d",   label: "90 days", days: 90 },
] as const
type RangeKey = typeof RANGES[number]["key"]

// ── Main ───────────────────────────────────────────────────────────────────────

export function AgentDashboard({
  firstName, companyName, nightLabel, night, avgJobValueCents,
  bookings, leadsAll, revenueEvents, hcpConnected,
}: Props) {
  const [range, setRange] = useState<RangeKey>("30d")
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const rangeDays = RANGES.find(r => r.key === range)?.days ?? 30

  const { filteredBookings, money, bars, barUnit, sources, callbacks, totalLeadsInRange } = useMemo(() => {
    const now = Date.now()
    const cutoff = range === "today"
      ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : now - rangeDays * 24 * 60 * 60 * 1000

    // Group facebook aliases for filter matching
    const norm = (s: string | null) => {
      if (!s) return "direct"
      if (s === "facebook_lead_ads") return "facebook"
      if (s === "hvac-lead-capture") return "website"
      if (s === "sms") return "sms_inbound"
      return s
    }
    const matchesSource = (s: string | null) => !sourceFilter || norm(s) === sourceFilter

    const leadSource = new Map<string, string | null>()
    for (const l of leadsAll) leadSource.set(l.id, l.source)

    const inRangeLeads = leadsAll.filter(l => new Date(l.created_at).getTime() >= cutoff)
    const totalLeadsInRange = inRangeLeads.filter(l => matchesSource(l.source)).length

    const filteredBookings = bookings.filter(b =>
      new Date(b.created_at).getTime() >= cutoff && matchesSource(b.leads?.source ?? null)
    )

    // Money — revenue events in range, source-matched via the lead they belong to
    const evMatches = (e: RevenueEventRow) => {
      if (new Date(e.created_at).getTime() < cutoff) return false
      if (!sourceFilter) return true
      const src = e.lead_id ? leadSource.get(e.lead_id) ?? null : null
      return norm(src) === sourceFilter
    }
    const inRangeEvents = revenueEvents.filter(evMatches)
    const bookedEvents = inRangeEvents.filter(e => e.attribution === "booked_by_ai" && e.amount_cents)
    const bookedCents = bookedEvents.reduce((s, e) => s + Number(e.amount_cents), 0)
    const sourcedCents = inRangeEvents
      .filter(e => e.attribution === "sourced_by_ai" && e.amount_cents)
      .reduce((s, e) => s + Number(e.amount_cents), 0)

    const upcoming = bookings.filter(b =>
      b.status === "scheduled" &&
      new Date(b.scheduled_at).getTime() > now &&
      matchesSource(b.leads?.source ?? null)
    )
    const pipelineCents = upcoming.length * avgJobValueCents

    // Bars — bucket by day (or by week for 90d)
    const weekly = rangeDays > 35
    const bucketCount = range === "today" ? 1 : weekly ? Math.ceil(rangeDays / 7) : rangeDays
    const bucketMs = (weekly ? 7 : 1) * 24 * 60 * 60 * 1000
    const buckets: Array<{ key: string; label: string; count: number; start: number }> = []
    for (let i = bucketCount - 1; i >= 0; i--) {
      const start = range === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : now - (i + 1) * bucketMs
      const d = new Date(range === "today" ? start : start + bucketMs)
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      buckets.push({ key: `${i}`, label, count: 0, start })
    }
    for (const b of filteredBookings) {
      const t = new Date(b.created_at).getTime()
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (t >= buckets[i].start) { buckets[i].count++; break }
      }
    }

    // Source breakdown for the range (unfiltered by source — it IS the filter UI)
    const srcMap = new Map<string, number>()
    for (const l of inRangeLeads) {
      const s = norm(l.source)
      srcMap.set(s, (srcMap.get(s) ?? 0) + 1)
    }
    const sources = [...srcMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    // Callback queue — current state, source-filtered but not time-filtered
    const callbacks = leadsAll
      .filter(l => l.status === "needs_attention" && matchesSource(l.source))
      .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""))
      .slice(0, 6)

    return {
      filteredBookings: filteredBookings.slice(0, 15),
      money: { bookedCents, bookedCount: bookedEvents.length, sourcedCents, pipelineCents, pipelineCount: upcoming.length },
      bars: buckets,
      barUnit: weekly ? "week" : "day",
      sources,
      callbacks,
      totalLeadsInRange,
    }
  }, [bookings, leadsAll, revenueEvents, range, sourceFilter, rangeDays, avgJobValueCents])

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

  return (
    <div className="relative min-h-full">
      {/* Visual background layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 opacity-50" style={{
          backgroundImage: "radial-gradient(rgba(249,115,22,0.14) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />
        <motion.div animate={{ y: [0, -24, 0], x: [0, 12, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full blur-3xl"
          style={{ width: 650, height: 650, background: "radial-gradient(circle, rgba(249,115,22,0.09) 0%, transparent 70%)", top: "-12%", left: "-8%" }} />
        <motion.div animate={{ y: [0, 20, 0], x: [0, -16, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          className="absolute rounded-full blur-3xl"
          style={{ width: 550, height: 550, background: "radial-gradient(circle, rgba(77,124,15,0.07) 0%, transparent 70%)", bottom: "-8%", right: "-6%" }} />
      </div>

      <motion.div
        className="relative z-10 p-4 md:p-8 max-w-[1200px] mx-auto"
        initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      >
        {/* ── Night hero (always last night — not affected by filters) ── */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          className="relative rounded-3xl overflow-hidden mb-5 p-6 md:p-8"
          style={{ background: "linear-gradient(135deg, #1C1917 0%, #292420 100%)", boxShadow: "0 8px 40px rgba(28,25,23,0.25)" }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-60" style={{
            backgroundImage: "radial-gradient(rgba(249,115,22,0.14) 1px, transparent 1px)", backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to bottom, black, transparent 80%)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent 80%)",
          }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1.5">
              <Moon className="w-4 h-4 text-[#F97316]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#F97316]">{nightLabel}</span>
            </div>
            <h1 className="text-2xl md:text-[28px] font-bold text-white mb-1"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              Good morning, {firstName}
            </h1>
            <p className="text-sm text-white/50 mb-6">
              Here&apos;s what your AI agent handled while {companyName} was closed.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <NightStat label="Jobs booked" value={night.booked} icon={CalendarCheck} accent="#FB923C" />
              <NightStat label="Conversations" value={night.conversations} icon={MessagesSquare} accent="#FB923C" delay={80} />
              <NightStat label="New leads" value={night.newLeads} icon={UserPlus} accent="#FB923C" delay={160} />
              <NightStat label="Need a callback" value={night.callbacks} icon={PhoneCall} accent={night.callbacks > 0 ? "#FBBF24" : "#84CC16"} delay={240} />
            </div>
          </div>
        </motion.div>

        {/* ── Filter bar ── */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          className="flex flex-wrap items-center gap-2 mb-5"
        >
          <div className="flex items-center rounded-xl bg-white border border-[#E7E5E4]/80 p-1 shadow-sm">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={cn("px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors",
                  range === r.key ? "bg-[#1C1917] text-white" : "text-[#78716C] hover:text-[#1C1917]")}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setSourceFilter(null)}
              className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors",
                !sourceFilter ? "bg-[#F97316] text-white border-[#F97316]" : "bg-white text-[#78716C] border-[#E7E5E4] hover:border-[#F97316]/40")}>
              All sources
            </button>
            {sources.map(s => {
              const m = sourceMeta(s.source)
              const active = sourceFilter === s.source
              return (
                <button key={s.source} onClick={() => setSourceFilter(active ? null : s.source)}
                  className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors",
                    active ? "bg-[#F97316] text-white border-[#F97316]" : cn("bg-white hover:border-[#F97316]/40", m.cls.replace(/bg-\S+/, "").trim(), "border-[#E7E5E4]"))}>
                  {m.label}
                  <span className={cn("tabular-nums text-[11px] font-bold", active ? "text-white/80" : "text-[#A8A29E]")}>{s.count}</span>
                </button>
              )
            })}
          </div>
          <span className="ml-auto text-[12px] text-[#78716C] font-medium tabular-nums">
            {totalLeadsInRange} {totalLeadsInRange === 1 ? "lead" : "leads"} in this view
          </span>
        </motion.div>

        {/* ── Money row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MoneyCard label="Booked by your AI" subLabel="Closed revenue from jobs the AI booked" cents={money.bookedCents} count={money.bookedCount} />
          <MoneyCard label="Sourced by your AI" subLabel="Revenue from customers the AI brought in" cents={money.sourcedCents} delay={100} />
          <MoneyCard label="Pipeline on the calendar" subLabel={`${money.pipelineCount} upcoming jobs × your average ticket`} cents={money.pipelineCents} count={money.pipelineCount} delay={200} estimated />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Booked appointments list ── */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="lg:col-span-2 bg-white rounded-2xl border border-[#E7E5E4]/60 overflow-hidden self-start"
            style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.07), 0 1px 3px rgba(0,0,0,0.03)" }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#F97316]" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-[#1C1917]"
                    style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                    Booked by your AI
                  </h2>
                  <p className="text-[11px] text-[#78716C]">
                    {sourceFilter ? `${sourceMeta(sourceFilter).label} leads only · ` : ""}Every appointment, with the lead and where it came from
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-[#F5F4F2]">
              {filteredBookings.length === 0 && (
                <p className="px-5 py-8 text-sm text-[#78716C] text-center">
                  No bookings match this filter — try a wider time range or another source.
                </p>
              )}
              {filteredBookings.map((b) => {
                const lead = b.leads
                const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Unknown lead"
                return (
                  <Link key={b.id} href={lead ? `/conversations?lead=${lead.id}` : "#"}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#FAFAF8] transition-colors group">
                    <div className="w-9 h-9 rounded-full bg-[#F5F4F2] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-[#78716C]">{name.slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#1C1917] truncate">{name}</span>
                        <ChannelIcon channel={lead?.channel ?? null} />
                        <SourceBadge source={lead?.source ?? null} />
                      </div>
                      <p className="text-xs text-[#78716C] mt-0.5 truncate">
                        {lead?.job_type ? `${lead.job_type} · ` : ""}{b.address ?? lead?.phone}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-[#1C1917] tabular-nums bg-[#F5F4F2] px-2 py-0.5 rounded-full">
                          {fmtTime(b.scheduled_at)}
                        </span>
                        {b.technician_name && (
                          <span className="text-[11px] font-semibold text-[#4D7C0F] bg-lime-50 border border-lime-100 px-2 py-0.5 rounded-full">
                            {b.technician_name}
                          </span>
                        )}
                        <HcpChip jobId={b.hcp_job_id} edited={b.hcp_manually_edited} />
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#D6D3D1] group-hover:text-[#F97316] transition-colors shrink-0 mt-3" />
                  </Link>
                )
              })}
            </div>
          </motion.div>

          {/* ── Right column ── */}
          <div className="space-y-4">
            {/* Callback queue */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              className="bg-white rounded-2xl border border-[#E7E5E4]/60 p-5"
              style={{ boxShadow: "0 4px 24px rgba(217,119,6,0.08), 0 1px 3px rgba(0,0,0,0.03)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4 text-[#D97706]" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-[#1C1917]"
                    style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                    Call these people back
                  </h2>
                  <p className="text-[11px] text-[#78716C]">The AI couldn&apos;t finish these — a human should</p>
                </div>
              </div>
              {callbacks.length === 0 ? (
                <p className="text-sm text-[#78716C] py-2">Nothing waiting. The AI handled everything. 👌</p>
              ) : (
                <div className="space-y-2">
                  {callbacks.map((c) => {
                    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"
                    return (
                      <Link key={c.id} href={`/conversations?lead=${c.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 hover:bg-amber-50 transition-colors">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#1C1917] truncate">{name}</p>
                          <p className="text-[11px] text-[#78716C] tabular-nums">{c.phone}</p>
                        </div>
                        <SourceBadge source={c.source} />
                      </Link>
                    )
                  })}
                </div>
              )}
            </motion.div>

            {/* Bookings over time */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              className="bg-white rounded-2xl border border-[#E7E5E4]/60 p-5"
              style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.07), 0 1px 3px rgba(0,0,0,0.03)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#F97316]" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-[#1C1917]"
                    style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                    Bookings per {barUnit}
                  </h2>
                  <p className="text-[11px] text-[#78716C]">
                    {RANGES.find(r => r.key === range)?.label}{sourceFilter ? ` · ${sourceMeta(sourceFilter).label}` : ""}
                  </p>
                </div>
              </div>
              <BookingBars data={bars} unitLabel={barUnit} />
            </motion.div>

            {/* Lead sources */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              className="bg-white rounded-2xl border border-[#E7E5E4]/60 p-5"
              style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.07), 0 1px 3px rgba(0,0,0,0.03)" }}
            >
              <h2 className="text-[15px] font-bold text-[#1C1917] mb-1"
                style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Where leads came from
              </h2>
              <p className="text-[11px] text-[#78716C] mb-3">Click a source to filter the whole page</p>
              <div className="space-y-1">
                {sources.map((s) => {
                  const active = sourceFilter === s.source
                  return (
                    <button key={s.source} onClick={() => setSourceFilter(active ? null : s.source)}
                      className={cn("w-full flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors",
                        active ? "bg-orange-50 ring-1 ring-[#F97316]/30" : "hover:bg-[#FAFAF8]")}>
                      <SourceBadge source={s.source} />
                      <span className="text-sm font-bold text-[#1C1917] tabular-nums"
                        style={{ fontFamily: "var(--font-mono), 'JetBrains Mono', monospace" }}>
                        {s.count}
                      </span>
                    </button>
                  )
                })}
                {sources.length === 0 && <p className="text-sm text-[#78716C]">No leads in this range.</p>}
              </div>
            </motion.div>

            {/* HCP connection state */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              className={cn("rounded-2xl border p-4 flex items-center gap-3",
                hcpConnected ? "bg-lime-50/60 border-lime-100" : "bg-white border-dashed border-[#D6D3D1]")}
            >
              {hcpConnected ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-[#4D7C0F] shrink-0" />
                  <p className="text-[13px] text-[#1C1917]"><span className="font-semibold">Housecall Pro connected.</span>{" "}
                    <span className="text-[#78716C]">Jobs sync automatically — your CRM stays the system of record.</span></p>
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5 text-[#F97316] shrink-0" />
                  <div className="text-[13px] text-[#1C1917]">
                    <span className="font-semibold">Connect Housecall Pro</span>{" "}
                    <span className="text-[#78716C]">to sync bookings and track real closed revenue.</span>{" "}
                    <Link href="/settings" className="font-semibold text-[#F97316] hover:underline">Settings →</Link>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
