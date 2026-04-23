"use client"

import { motion, useInView, useScroll, useTransform } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import Link from "next/link"
import { Zap, ArrowRight, Check, MessageSquare, Bot, Calendar, ChevronRight, Users, CalendarCheck, TrendingUp, BarChart3, Phone, Clock } from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Crosshair({ className }: { className: string }) {
  return (
    <div className={`absolute pointer-events-none select-none ${className}`}>
      <div className="relative w-5 h-5">
        <div className="absolute top-1/2 left-0 w-full h-px bg-gray-300" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-gray-300" />
      </div>
    </div>
  )
}

function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Purple orb — top right */}
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, -25, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full"
        style={{
          width: 400, height: 400,
          background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
          top: "5%", right: "-5%",
        }}
      />
      {/* Green orb — bottom left */}
      <motion.div
        animate={{ x: [0, -15, 0], y: [0, 20, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute rounded-full"
        style={{
          width: 300, height: 300,
          background: "radial-gradient(circle, rgba(77,124,15,0.10) 0%, transparent 70%)",
          filter: "blur(60px)",
          bottom: "10%", left: "-5%",
        }}
      />
      {/* Rose orb — center right */}
      <motion.div
        animate={{ x: [0, 12, 0], y: [0, -18, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute rounded-full"
        style={{
          width: 250, height: 250,
          background: "radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)",
          filter: "blur(70px)",
          top: "45%", right: "15%",
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNT-UP STAT
// ─────────────────────────────────────────────────────────────────────────────

function CountStat({ value, suffix = "", prefix = "", label }: {
  value: number; suffix?: string; prefix?: string; label: string
}) {
  const [displayed, setDisplayed] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 1800
    const steps = 60
    const increment = value / steps
    const interval = duration / steps
    let current = 0
    const timer = setInterval(() => {
      current = Math.min(current + increment, value)
      setDisplayed(Math.round(current * 10) / 10)
      if (current >= value) clearInterval(timer)
    }, interval)
    return () => clearInterval(timer)
  }, [inView, value])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <p
        className="text-[56px] font-bold leading-none tracking-tight text-[#1C1917]"
        style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
      >
        {prefix}{displayed % 1 === 0 ? displayed.toLocaleString() : displayed}{suffix}
      </p>
      <p className="text-[#78716C] mt-3 text-sm max-w-[160px] mx-auto leading-relaxed">{label}</p>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLE BURST SVG
// ─────────────────────────────────────────────────────────────────────────────

function ParticleBurst() {
  const count = 24
  return (
    <div className="relative w-full flex justify-center overflow-hidden" style={{ height: 220 }}>
      <svg viewBox="0 0 500 220" className="absolute bottom-0 w-full max-w-2xl">
        {Array.from({ length: count }).map((_, i) => {
          const angle = (i / count) * Math.PI
          const cx = 250, cy = 220
          const len = 80 + (i % 3) * 40
          const ex = cx + Math.cos(angle - Math.PI / 2) * len * 2.5
          const ey = cy + Math.sin(angle - Math.PI / 2) * len
          return (
            <g key={i}>
              <motion.line
                x1={cx} y1={cy} x2={ex} y2={ey}
                stroke="rgba(124,58,237,0.25)"
                strokeWidth="1"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: [0, 1, 0], opacity: [0, 0.5, 0] }}
                transition={{
                  duration: 2.5 + (i % 4) * 0.4,
                  delay: i * 0.08,
                  repeat: Infinity,
                  ease: "easeOut",
                  repeatDelay: 0.5,
                }}
              />
              <motion.circle
                cx={ex} cy={ey} r="2"
                fill="rgba(124,58,237,0.4)"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1, 0], opacity: [0, 0.8, 0] }}
                transition={{
                  duration: 2.5 + (i % 4) * 0.4,
                  delay: i * 0.08 + 0.8,
                  repeat: Infinity,
                  ease: "easeOut",
                  repeatDelay: 0.5,
                }}
              />
            </g>
          )
        })}
        {/* Center glow */}
        <motion.circle
          cx={250} cy={220} r="6"
          fill="#7C3AED"
          animate={{ r: [4, 8, 4], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM DASHBOARD PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE = [
  {
    col: "New", color: "bg-blue-50 text-blue-700 border-blue-100", count: 8,
    leads: [
      { name: "Josh Martinez", service: "Roofing", time: "2m ago", est: "$8,500", initials: "JM", ring: "from-blue-400 to-blue-600" },
      { name: "Amy Liu",       service: "Windows", time: "5m ago", est: "$4,200", initials: "AL", ring: "from-blue-400 to-indigo-500" },
    ],
  },
  {
    col: "Contacted", color: "bg-purple-50 text-purple-700 border-purple-100", count: 15,
    leads: [
      { name: "Sarah Chen",   service: "Solar",   time: "18m ago", est: "$24k", initials: "SC", ring: "from-purple-400 to-purple-600" },
      { name: "Carlos V.",    service: "Roofing", time: "1h ago",  est: "$11k", initials: "CV", ring: "from-purple-400 to-pink-500" },
    ],
  },
  {
    col: "Qualified", color: "bg-amber-50 text-amber-700 border-amber-100", count: 9,
    leads: [
      { name: "Mike Thompson", service: "HVAC",   time: "2h ago", est: "$3,100", initials: "MT", ring: "from-amber-400 to-orange-500" },
      { name: "Linda Kim",     service: "Bath",   time: "4h ago", est: "$18k",  initials: "LK", ring: "from-amber-400 to-yellow-500" },
    ],
  },
  {
    col: "Booked ✓", color: "bg-green-50 text-green-700 border-green-100", count: 12,
    leads: [
      { name: "Dave Richards", service: "Solar",  time: "Thu 2pm", est: "$31k",  initials: "DR", ring: "from-green-400 to-emerald-600" },
      { name: "Rosa Mendez",   service: "Roof",   time: "Fri 10am", est: "$9k", initials: "RM", ring: "from-emerald-400 to-green-600" },
    ],
  },
]

function CRMDashboardPreview() {
  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Glow behind card */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(124,58,237,0.14) 0%, transparent 70%)",
          filter: "blur(30px)",
          transform: "translateY(30px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 48 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -6, transition: { type: "spring", stiffness: 150, damping: 20 } }}
        className="relative bg-[#FAFAF8] rounded-2xl overflow-hidden"
        style={{
          boxShadow: "0 32px 72px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06), 0 8px 24px rgba(124,58,237,0.08)",
        }}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-5 py-3.5 bg-white border-b border-[#E7E5E4]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 bg-[#F5F4F2] rounded-lg px-4 py-1.5 border border-[#E7E5E4]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[#78716C] text-xs">LeadReply — Pipeline</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#7C3AED]" />
            <span className="text-xs font-semibold text-[#7C3AED]">AI Active</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 border-b border-[#E7E5E4] bg-white">
          {[
            { label: "New Leads",   value: "47", icon: Users,         color: "text-blue-600",    bg: "bg-blue-50"    },
            { label: "Contacted",   value: "39", icon: MessageSquare,  color: "text-[#7C3AED]",  bg: "bg-purple-50"  },
            { label: "Booked",      value: "12", icon: CalendarCheck,  color: "text-[#4D7C0F]",  bg: "bg-green-50"   },
            { label: "Booking Rate", value: "31%",icon: TrendingUp,    color: "text-amber-600",  bg: "bg-amber-50"   },
          ].map((stat, i) => (
            <div key={i} className={`flex items-center gap-3 px-5 py-4 ${i < 3 ? "border-r border-[#E7E5E4]" : ""}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-[#1C1917] leading-none"
                  style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  {stat.value}
                </p>
                <p className="text-xs text-[#78716C] mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline board */}
        <div className="grid grid-cols-4 gap-0 p-5 gap-4">
          {PIPELINE.map((col, ci) => (
            <div key={ci} className="space-y-3">
              {/* Column header */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${col.color}`}>
                  {col.col}
                </span>
                <span className="text-xs text-[#78716C] font-mono">{col.count}</span>
              </div>

              {/* Lead cards */}
              {col.leads.map((lead, li) => (
                <motion.div
                  key={li}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + ci * 0.08 + li * 0.06 }}
                  className="bg-white rounded-xl p-3.5 border border-[#E7E5E4] cursor-pointer hover:border-[#7C3AED]/20 transition-all group"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${lead.ring} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                      {lead.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#1C1917] truncate group-hover:text-[#7C3AED] transition-colors">
                        {lead.name}
                      </p>
                      <p className="text-[10px] text-[#78716C]">{lead.service}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#4D7C0F]">{lead.est}</span>
                    <span className="text-[10px] text-[#78716C] flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{lead.time}
                    </span>
                  </div>
                </motion.div>
              ))}

              {/* Ghost card */}
              <div className="border border-dashed border-[#E7E5E4] rounded-xl h-14 flex items-center justify-center">
                <span className="text-[10px] text-[#E7E5E4]">+{col.count - 2} more</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none rounded-b-2xl"
        style={{ background: "linear-gradient(to bottom, transparent, #f5f3ff)" }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT PREVIEW CARD
// ─────────────────────────────────────────────────────────────────────────────

const MESSAGES = [
  { role: "ai",   text: "Hey Mike! Saw you filled out our solar form — do you own your home?",          time: "just now" },
  { role: "lead", text: "Yeah, own it. About 2,800 sqft.",                                              time: "1 min ago" },
  { role: "ai",   text: "Perfect! What's your average monthly electric bill? Helps us estimate savings.",time: "1 min ago" },
  { role: "lead", text: "Around $280/month 😬",                                                         time: "2 min ago" },
  { role: "ai",   text: "You'd likely qualify for $0 down. Does Tue at 10am or Thu at 2pm work for a quick site visit?", time: "2 min ago" },
  { role: "lead", text: "Thursday works!",                                                              time: "3 min ago" },
]

function ProductPreview() {
  return (
    <div className="relative flex justify-center">
      {/* Glow behind card */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 80%, rgba(124,58,237,0.18) 0%, transparent 70%)",
          filter: "blur(24px)",
          transform: "translateY(40px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40, rotate: -1 }}
        whileInView={{ opacity: 1, y: 0, rotate: -1 }}
        whileHover={{ rotate: 0, y: -8, transition: { type: "spring", stiffness: 200, damping: 15 } }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: "#0E0E10",
          boxShadow: "0 40px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
          transformOrigin: "center bottom",
        }}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8"
          style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-md px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/50 text-xs font-mono">LeadReply — AI Conversation</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex" style={{ height: 360 }}>
          {/* Sidebar */}
          <div className="w-48 border-r border-white/6 py-3 shrink-0" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-white/30 text-[10px] uppercase tracking-widest px-3 mb-2">Active Leads</p>
            {[
              { name: "Mike Johnson", status: "Replied", dot: "bg-emerald-400" },
              { name: "Sarah Chen", status: "New", dot: "bg-blue-400" },
              { name: "James Rivera", status: "Booked", dot: "bg-purple-400" },
            ].map((lead, i) => (
              <div key={i} className={`px-3 py-2.5 cursor-pointer ${i === 0 ? "bg-white/8" : "hover:bg-white/4"}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${lead.dot} shrink-0`} />
                  <p className="text-white/80 text-xs font-medium truncate">{lead.name}</p>
                </div>
                <p className="text-white/30 text-[10px] mt-0.5 pl-3.5">{lead.status}</p>
              </div>
            ))}
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="px-4 py-2.5 border-b border-white/6 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[9px] font-bold text-white">MJ</div>
              <div>
                <p className="text-white/80 text-xs font-medium">Mike Johnson</p>
                <p className="text-white/30 text-[10px]">+1 (972) 555-0142</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden px-3 py-3 space-y-2.5">
              {MESSAGES.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  className={`flex ${msg.role === "lead" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "ai" && (
                    <div className="w-5 h-5 rounded-full bg-[#7C3AED] flex items-center justify-center shrink-0 mr-1.5 mt-0.5">
                      <Bot className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <div
                    className="max-w-[75%] px-2.5 py-1.5 rounded-xl text-[10px] leading-relaxed"
                    style={{
                      background: msg.role === "ai"
                        ? "rgba(124,58,237,0.25)"
                        : "rgba(255,255,255,0.08)",
                      color: msg.role === "ai" ? "rgba(220,200,255,0.95)" : "rgba(255,255,255,0.8)",
                      border: msg.role === "ai" ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {/* Appointment booked badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8, type: "spring" }}
                className="flex justify-center"
              >
                <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-3 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <p className="text-emerald-400 text-[9px] font-semibold">Appointment booked — Thu, May 1 · 2:00 PM</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING CARD
// ─────────────────────────────────────────────────────────────────────────────

const plans = [
  {
    name: "Starter", price: 297,
    features: ["100 leads/month", "AI SMS follow-up", "Built-in CRM", "1 user", "Local phone number"],
  },
  {
    name: "Growth", price: 497, highlight: true,
    features: ["300 leads/month", "Everything in Starter", "3 users", "3 Facebook accounts", "Custom AI script", "ROI dashboard"],
  },
  {
    name: "Scale", price: 997,
    features: ["Unlimited leads", "Everything in Growth", "Unlimited users", "Priority support", "White-label option"],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null)

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "#fafafa" }}
    >
      {/* ── Dot grid ── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Floating orbs ── */}
      <FloatingOrbs />

      {/* ── All content ── */}
      <div className="relative z-10">

        {/* ── NAV ── */}
        <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center shadow-lg"
              style={{ boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#1C1917] text-lg tracking-tight"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              LeadReply
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#78716C]">
            <a href="#features" className="hover:text-[#1C1917] transition-colors">Features</a>
            <a href="#how" className="hover:text-[#1C1917] transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-[#1C1917] transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors px-4 py-2 rounded-lg hover:bg-[#F5F4F2]">
              Sign in
            </Link>
            <Link href="/signup"
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                boxShadow: "0 4px 14px rgba(124,58,237,0.4)",
              }}>
              Start free trial <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section ref={heroRef} className="relative max-w-6xl mx-auto px-6 pt-16 pb-8 text-center min-h-[85vh] flex flex-col items-center justify-center">

          {/* Corner crosshairs */}
          <Crosshair className="top-0 left-0 -translate-x-1/2 -translate-y-1/2" />
          <Crosshair className="top-0 right-0 translate-x-1/2 -translate-y-1/2" />
          <Crosshair className="bottom-0 left-0 -translate-x-1/2 translate-y-1/2" />
          <Crosshair className="bottom-0 right-0 translate-x-1/2 translate-y-1/2" />

          {/* Radial glow behind hero text */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 600, height: 600,
              background: "radial-gradient(circle 300px at 50% 50%, rgba(124,58,237,0.08), transparent 70%)",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
            style={{
              background: "rgba(124,58,237,0.06)",
              border: "1px solid rgba(124,58,237,0.15)",
              color: "#7C3AED",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />
            AI-powered SMS for home services contractors
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl md:text-7xl font-bold leading-[1.08] tracking-tight text-[#1C1917] mb-6 max-w-4xl"
            style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            Every lead gets a{" "}
            <span
              className="relative inline-block"
              style={{
                backgroundImage: "linear-gradient(135deg, #7C3AED, #EC4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              response in 60s.
            </span>
            <br />
            <span className="text-[#78716C]">Not 6 hours.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-[#78716C] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            You&apos;re paying $50–150 per lead. Stop losing them to the contractor who responded first.
            LeadReply texts every lead the instant they submit your form — 24/7, even at 11pm on Sunday.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <Link href="/signup"
              className="flex items-center gap-2 text-base font-semibold text-white px-8 py-3.5 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
              }}>
              Start 14-day free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how"
              className="flex items-center gap-2 text-base font-medium text-[#1C1917] px-8 py-3.5 rounded-xl border border-[#E7E5E4] bg-white hover:bg-[#FAFAF8] hover:border-[#D1D5DB] transition-all"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              See how it works
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-[#78716C] mt-4"
          >
            No credit card required · Setup in under 10 minutes
          </motion.p>
        </section>

        {/* ── PRODUCT PREVIEW ── */}
        <section id="preview" className="max-w-2xl mx-auto px-6 pb-24">
          <ProductPreview />
        </section>

        {/* ── STATS — Stripe style ── */}
        <section className="relative overflow-hidden" style={{
          background: "linear-gradient(180deg, #f5f3ff 0%, #fafafa 100%)",
        }}>
          {/* Top border */}
          <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #7C3AED, transparent)" }} />

          <div className="max-w-5xl mx-auto px-6 py-20">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center text-sm font-semibold text-[#7C3AED] uppercase tracking-widest mb-12"
            >
              Built for contractors who run on ROI
            </motion.p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
              <CountStat value={2.3} suffix="M+" prefix="$" label="Revenue generated for customers this quarter" />
              <CountStat value={47} suffix="K+" label="Leads qualified by AI with no human involvement" />
              <CountStat value={91} suffix="%" label="Leads contacted within 60 seconds of form submit" />
              <CountStat value={3.2} suffix="x" label="Average booking rate increase vs. manual follow-up" />
            </div>

          <div className="mt-16">
            <CRMDashboardPreview />
          </div>
          </div>

          {/* Bottom border */}
          <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)" }} />
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how" className="max-w-5xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-[#7C3AED] uppercase tracking-widest mb-3">How it works</p>
            <h2
              className="text-4xl font-bold text-[#1C1917]"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Set up once. Books jobs forever.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01", icon: MessageSquare, iconBg: "bg-purple-50", iconColor: "text-[#7C3AED]",
                title: "Lead submits your form",
                desc: "Facebook Lead Ads, Google Ads, or any website form. Your AI is notified the instant it happens.",
                glow: "rgba(124,58,237,0.08)",
              },
              {
                step: "02", icon: Bot, iconBg: "bg-blue-50", iconColor: "text-blue-600",
                title: "AI texts within 60 seconds",
                desc: "A personal, conversational message — not a template blast. Qualifies, handles objections, and builds rapport.",
                glow: "rgba(59,130,246,0.08)",
              },
              {
                step: "03", icon: Calendar, iconBg: "bg-green-50", iconColor: "text-[#4D7C0F]",
                title: "Appointment booked automatically",
                desc: "AI proposes two specific time slots. When they confirm, it's logged in your CRM and synced to Google Calendar.",
                glow: "rgba(77,124,15,0.08)",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                whileHover={{ y: -4, transition: { type: "spring", stiffness: 300 } }}
                className="bg-white rounded-2xl p-7 border border-[#E7E5E4]/80"
                style={{ boxShadow: `0 4px 24px ${item.glow}, 0 1px 3px rgba(0,0,0,0.03)` }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                    <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                  </div>
                  <span
                    className="text-4xl font-bold text-[#E7E5E4]"
                    style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                  >
                    {item.step}
                  </span>
                </div>
                <h3
                  className="font-bold text-[#1C1917] text-lg mb-2"
                  style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                >
                  {item.title}
                </h3>
                <p className="text-[#78716C] text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="max-w-5xl mx-auto px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-sm font-semibold text-[#7C3AED] uppercase tracking-widest mb-3">Pricing</p>
            <h2
              className="text-4xl font-bold text-[#1C1917]"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Simple, transparent pricing
            </h2>
            <p className="text-[#78716C] mt-3">One roofing job pays for a year of LeadReply.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4, transition: { type: "spring", stiffness: 300 } }}
                className={`relative rounded-2xl p-7 flex flex-col border ${
                  plan.highlight
                    ? "border-[#7C3AED]/30 bg-white"
                    : "border-[#E7E5E4] bg-white"
                }`}
                style={{
                  boxShadow: plan.highlight
                    ? "0 8px 40px rgba(124,58,237,0.14), 0 1px 3px rgba(0,0,0,0.03)"
                    : "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                {plan.highlight && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold text-white px-4 py-1.5 rounded-full"
                    style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
                  >
                    Most popular
                  </div>
                )}
                <div className="mb-6">
                  <p className="text-sm font-semibold text-[#78716C] mb-1">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-5xl font-bold text-[#1C1917]"
                      style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                    >
                      ${plan.price}
                    </span>
                    <span className="text-[#78716C]">/mo</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-[#78716C]">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        plan.highlight ? "bg-[#7C3AED]/10" : "bg-[#F5F4F2]"
                      }`}>
                        <Check className={`w-2.5 h-2.5 ${plan.highlight ? "text-[#7C3AED]" : "text-[#78716C]"}`} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    plan.highlight
                      ? "text-white"
                      : "text-[#1C1917] border border-[#E7E5E4] hover:border-[#7C3AED]/30 hover:text-[#7C3AED]"
                  }`}
                  style={plan.highlight ? {
                    background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                    boxShadow: "0 4px 14px rgba(124,58,237,0.3)",
                  } : {}}
                >
                  Get started <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-sm text-[#78716C] mt-6">
            + $0.05 per SMS beyond your plan limit · 14-day free trial · Cancel anytime
          </p>
        </section>

        {/* ── CTA BAND ── */}
        <section className="relative overflow-hidden mx-6 mb-16 rounded-3xl"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 50%, #5B21B6 100%)",
            boxShadow: "0 20px 60px rgba(124,58,237,0.3)",
          }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative max-w-3xl mx-auto px-8 py-16 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-white mb-4"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Your next job is already waiting.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-purple-200 mb-8 text-lg"
            >
              The lead filled out a form. Someone&apos;s going to call them in the next 10 minutes.
              Make sure it&apos;s your AI.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-white text-[#7C3AED] text-base font-bold px-8 py-4 rounded-xl hover:scale-[1.03] active:scale-[0.98] transition-transform"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}
              >
                Start free — no card needed <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between border-t border-[#E7E5E4]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#7C3AED] flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-[#1C1917] text-sm">LeadReply</span>
          </div>
          <p className="text-sm text-[#78716C]">
            © {new Date().getFullYear()} LeadReply. Built for home services contractors.
          </p>
          <div className="flex items-center gap-4 text-sm text-[#78716C]">
            <Link href="/login" className="hover:text-[#1C1917] transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-[#1C1917] transition-colors">Sign up</Link>
          </div>
        </footer>

      </div>
    </div>
  )
}
