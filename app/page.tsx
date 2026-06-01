"use client"

import { motion, useInView, AnimatePresence } from "framer-motion"
import { useRef, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Zap, ArrowRight, Check, MessageSquare,
  Clock, Play, Star, Menu, X,
  CheckCircle2, Phone, Shield, Mic,
  CalendarCheck, Bell, PhoneCall,
  BarChart3, Brain, Kanban, Repeat, TrendingUp,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#FAFAF8",
  surface:     "#FFFFFF",
  primary:     "#F97316",
  primaryDark: "#EA580C",
  success:     "#16A34A",
  text:        "#1C1917",
  muted:       "#78716C",
  border:      "#E7E5E4",
  subtle:      "#F5F4F2",
} as const

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

const CONVO = [
  { role: "ai",   text: "Hey Mike, saw you reached out about your AC — what's it doing?" },
  { role: "lead", text: "Not cooling. Been going since yesterday." },
  { role: "ai",   text: "Is it still running at all, or completely off?" },
  { role: "lead", text: "Runs but blows warm air" },
  { role: "ai",   text: "How long has it been doing that?" },
  { role: "lead", text: "Started yesterday afternoon" },
  { role: "ai",   text: "Got it. Our tech will figure out exactly what's going on. What's the address?" },
  { role: "lead", text: "2241 Ridgeline Dr, Frisco TX" },
  { role: "ai",   text: "Thursday morning or Friday afternoon — which works?" },
  { role: "lead", text: "Thursday morning works" },
] as const

const FOLLOW_UP_STEPS = [
  { step: 1, time: "30 min",     type: "voice", label: "Voice call",    preview: "Your AI calls Mike. Real conversation, natural human voice." },
  { step: 2, time: "24 hours",   type: "sms",   label: "SMS",           preview: "\"Hey Mike, just making sure this came through...\"" },
  { step: 3, time: "Day 2, 9am", type: "sms",   label: "SMS",           preview: "Fresh morning message — different angle, not a copy." },
  { step: 4, time: "Day 2, noon",type: "voice", label: "Voice call",    preview: "Second call. Lunchtime. Still a real conversation." },
  { step: 5, time: "Day 4",      type: "sms",   label: "SMS",           preview: "Value angle — something useful, not just chasing." },
  { step: 6, time: "Day 7",      type: "sms",   label: "SMS",           preview: "Closing the loop. Easy to reply, no pressure." },
  { step: 7, time: "Day 14",     type: "sms",   label: "SMS",           preview: "Long game. Seasonal angle. Stays relevant." },
] as const

const GUARDRAILS = [
  "Quote a price — always redirects to the free in-home estimate",
  "Send more than 2 unanswered messages in a row",
  "Book without collecting a physical address first",
  "Call or text outside your working hours",
  "Handle commercial properties — flags those for you",
  "Book for a renter without landlord authorization — flags it",
  "Reveal it's an AI — deflects naturally if a lead asks",
]

const TESTIMONIALS = [
  {
    quote: "I was spending $4,000 a month on Facebook ads and felt like I was throwing money in a hole. Now I wake up most mornings with appointments already on the schedule from the night before. I finally feel like I'm running a real business.",
    name:  "Dave K.",
    role:  "Owner, ProTemp HVAC — Dallas, TX",
    stars: 5,
  },
  {
    quote: "I couldn't afford a call center. Now I have one — and it's better than any human I'd hire. It booked an $8,400 replacement job on a follow-up call while I was on a roof. That's money I would have lost in my sleep.",
    name:  "James M.",
    role:  "Owner, Arctic Air Services — Phoenix, AZ",
    stars: 5,
  },
  {
    quote: "The install took two days. Now I check my CRM in the morning and see what the AI booked overnight. My techs get dispatched automatically to the right jobs. I went from scrambling to just showing up. That's the whole difference.",
    name:  "Carlos R.",
    role:  "Owner, Premier Comfort — Miami, FL",
    stars: 5,
  },
]

const INSTALL_INCLUDES = [
  "Custom AI script written for your business — not a template",
  "Facebook Lead Ads integration",
  "Local phone number provisioned in your area code",
  "14-day follow-up sequences pre-loaded and tested",
  "Appointment confirmation + 3-step reminders activated",
  "Google Calendar + Gmail connected",
  "CRM configured with your pipeline stages",
  "Live test run + hands-on handoff call with your team",
]

const MONTHLY_INCLUDES = [
  "AI SMS follow-up on every lead",
  "AI voice calls — outbound and inbound",
  "14-day auto follow-up sequences",
  "Built-in CRM + lead pipeline",
  "Appointment reminders (4-step automated)",
  "Google Calendar sync",
  "Ongoing system monitoring",
  "Support included",
]

const ADDONS = [
  {
    name:  "Smart Dispatch",
    price: 200,
    desc:  "AI routes every incoming call to the right tech by skill, distance, and availability. No dispatcher needed.",
  },
  {
    name:  "Monthly Optimization",
    price: 200,
    desc:  "We review your AI script, conversion data, and sequences monthly and improve them.",
  },
  {
    name:  "Seasonal Campaigns",
    price: 150,
    desc:  "Pre-season and post-season outreach to your existing customer list — automated.",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND
// ─────────────────────────────────────────────────────────────────────────────
function Background() {
  return (
    <>
      <style>{`
        @keyframes orbPulse {
          0%, 100% { opacity: 0.10; }
          50%       { opacity: 0.14; }
        }
        @keyframes orbPulse2 {
          0%, 100% { opacity: 0.13; }
          50%       { opacity: 0.18; }
        }
        @keyframes orbDrift {
          0%, 100% { opacity: 0.06; }
          50%       { opacity: 0.09; }
        }
        @keyframes underlineDraw {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes callPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* Glow orbs — orange/amber brand palette, low opacity */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-5%", right: "-5%",
          width: 600, height: 600, borderRadius: "50%",
          background: "#F97316", filter: "blur(120px)", opacity: 0.07,
          animation: "orbPulse 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-5%", left: "-5%",
          width: 500, height: 500, borderRadius: "50%",
          background: "#FBBF24", filter: "blur(100px)", opacity: 0.06,
          animation: "orbPulse2 11s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "20%",
          width: 400, height: 400, borderRadius: "50%",
          background: "#F97316", filter: "blur(80px)", opacity: 0.04,
          animation: "orbDrift 9s ease-in-out infinite",
        }} />
      </div>

      {/* Dot grid — orange radial dots, masked to fade */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.18) 1.4px, transparent 1.4px)",
          backgroundSize: "26px 26px",
          opacity: 0.8,
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 80%)",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 80%)",
        }}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HVAC DECORATIVE SVGs
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const links = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Features",     href: "#features" },
    { label: "Pricing",      href: "#pricing" },
    { label: "Results",      href: "#results" },
  ]

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(255,255,255,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1A1614] flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#fff" />
              <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#fff" />
              <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
              <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
            </svg>
          </div>
          <span className="font-extrabold text-xl tracking-tight" style={{ color: scrolled ? C.text : "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            FIELDBUILT
            <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
                  style={{ fontSize: "0.42em", background: "#F97316", padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}>
              AI
            </span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.label} href={l.href} className="text-sm transition-colors duration-200 hover:text-[#F97316]"
               style={{ color: scrolled ? C.muted : "rgba(250,250,248,0.65)" }}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 hover:text-[#F97316]"
                style={{ color: scrolled ? C.muted : "rgba(250,250,248,0.55)" }}>
            Log in
          </Link>
          <Link href="/signup?new=1"
                className="text-sm font-semibold text-white px-5 py-2.5 rounded-full transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: C.primary, boxShadow: "0 4px 14px rgba(249,115,22,0.40)" }}>
            Get Installed
          </Link>
        </div>

        <button className="md:hidden p-2 rounded-lg" style={{ color: C.text }}
                onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="md:hidden border-t px-6 py-4 space-y-3"
                    style={{ background: "rgba(255,255,255,0.96)", borderColor: C.border }}>
          {links.map(l => (
            <a key={l.label} href={l.href} className="block py-2 text-sm font-medium"
               style={{ color: C.text }} onClick={() => setMobileOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href="/signup?new=1" className="block w-full text-center text-sm font-semibold text-white py-3 rounded-full mt-2"
                style={{ background: C.primary }}>
            Get Installed
          </Link>
        </motion.div>
      )}
    </motion.nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CONVERSATION DEMO — fixed height, no layout shift
// ─────────────────────────────────────────────────────────────────────────────
function LiveConversation() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [done, setDone] = useState(false)

  const tick = useCallback(() => {
    setVisibleCount(n => {
      if (n >= CONVO.length) { setDone(true); return n }
      return n + 1
    })
  }, [])

  useEffect(() => {
    setVisibleCount(0)
    setDone(false)
    const t = setTimeout(tick, 900)
    return () => clearTimeout(t)
  }, [tick])

  useEffect(() => {
    if (done) return
    const nextRole = CONVO[visibleCount]?.role
    const delay = visibleCount === 0 ? 1200 : nextRole === "ai" ? 2200 : 1400
    const t = setTimeout(tick, delay)
    return () => clearTimeout(t)
  }, [visibleCount, done, tick])

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => {
      setVisibleCount(0)
      setDone(false)
    }, 3200)
    return () => clearTimeout(t)
  }, [done])

  return (
    <div className="flex flex-col rounded-xl overflow-hidden"
         style={{ background: C.surface, height: 420, border: `1px solid ${C.border}`,
                  boxShadow: "0 8px 32px rgba(249,115,22,0.10)" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: C.border }}>
        <div className="w-8 h-8 rounded-lg bg-[#1A1614] flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#fff" />
            <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#fff" />
            <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
            <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-semibold" style={{ color: C.text }}>FieldBuilt AI</div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs" style={{ color: C.muted }}>Responding in 3.7 seconds</span>
          </div>
        </div>
        <div className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "#F0FDF4", color: C.success }}>
          Live AI
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end gap-2 px-3 py-3">
        <AnimatePresence initial={false}>
          {(CONVO as readonly { role: string; text: string }[]).slice(0, visibleCount).map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className={`shrink-0 flex ${msg.role === "lead" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                   style={{
                     background: msg.role === "ai" ? C.subtle : C.primary,
                     color:      msg.role === "ai" ? C.text : "#fff",
                     borderRadius: msg.role === "ai" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                   }}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {visibleCount < CONVO.length && visibleCount > 0 && CONVO[visibleCount]?.role === "ai" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex justify-start shrink-0">
            <div className="px-3 py-2 rounded-2xl flex items-center gap-1" style={{ background: C.subtle }}>
              {[0, 1, 2].map(i => (
                <motion.span key={i} className="w-1.5 h-1.5 rounded-full"
                             style={{ background: C.muted }}
                             animate={{ opacity: [0.3, 1, 0.3] }}
                             transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Appointment booked bar — always rendered at fixed height, opacity only */}
      <div className="shrink-0 flex items-center gap-2 px-4"
           style={{ height: 48, background: "#F0FDF4", borderTop: "1px solid #BBF7D0", overflow: "hidden" }}>
        <motion.div
          initial={false}
          animate={{ opacity: done ? 1 : 0, y: done ? 0 : 6 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-2 w-full"
        >
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-green-800">Appointment booked</span>
          <span className="text-xs text-green-700 ml-1">· Thu 9am · 2241 Ridgeline Dr, Frisco TX</span>
        </motion.div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex flex-col justify-center pt-28 pb-20 px-6 overflow-hidden"
      style={{ background: "#1A1614", zIndex: 10 }}
    >
      {/* Blueprint crosshatch texture — center-fade masked */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
           style={{
             backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
             backgroundSize: "44px 44px",
             opacity: 0.07,
             WebkitMaskImage: "radial-gradient(ellipse 85% 80% at 50% 40%, #000 25%, transparent 75%)",
             maskImage: "radial-gradient(ellipse 85% 80% at 50% 40%, #000 25%, transparent 75%)",
           }} />

      {/* Glow orbs */}
      <motion.div
        animate={{ y: [0, -22, 0], x: [0, 12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 650, height: 650, background: "rgba(249,115,22,0.10)", top: "-15%", left: "-8%" }}
      />
      <motion.div
        animate={{ y: [0, 18, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 450, height: 450, background: "rgba(251,191,36,0.07)", bottom: "-5%", right: "5%" }}
      />

      <div className="relative max-w-7xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* LEFT — Copy */}
          <div>
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="flex items-center gap-3 mb-7"
            >
              <span className="block w-6 h-px" style={{ background: "#F97316" }} />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "#F97316", fontFamily: "var(--font-jetbrains)" }}>
                AI operations · installed for you
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.65 }}
              className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.02] mb-7"
              style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}
            >
              Wake up with<br />
              jobs on the<br />
              <span className="relative inline-block" style={{ color: "#F97316" }}>
                schedule.
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
                      style={{ background: "linear-gradient(90deg, #F97316, #EA580C)",
                               transformOrigin: "left", animation: "underlineDraw 0.7s ease forwards 1.4s",
                               transform: "scaleX(0)" }} />
              </span>
            </motion.h1>

            {/* Subhead — short, direct, contractor language */}
            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              className="text-lg leading-relaxed mb-9 max-w-md"
              style={{ color: "rgba(250,250,248,0.60)" }}
            >
              Every Facebook lead texted in 3.7 seconds. AI qualifies them, handles every objection,
              and books the appointment. Your tech shows up. You find out in a push notification.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 mb-9"
            >
              <Link href="/signup?new=1"
                    className="inline-flex items-center justify-center gap-2 font-semibold text-white px-7 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: "#F97316", boxShadow: "0 8px 28px rgba(249,115,22,0.38)" }}>
                Get Your System Installed
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a href="#how-it-works"
                 className="inline-flex items-center justify-center gap-2 font-medium px-7 py-4 rounded-xl border transition-all duration-200 hover:border-white/30"
                 style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(250,250,248,0.65)" }}>
                <Play className="w-4 h-4" aria-hidden="true" />
                See How It Works
              </a>
            </motion.div>

            {/* Proof row */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
              className="flex flex-wrap items-center gap-x-6 gap-y-2"
            >
              {[
                "200+ home service companies",
                "Live in 48 hours",
                "Done for you — zero setup",
              ].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#F97316" }} aria-hidden="true" />
                  <span className="text-sm" style={{ color: "rgba(250,250,248,0.45)" }}>{item}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* RIGHT — Live conversation demo */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.45, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Blueprint corner brackets */}
            <div className="absolute -top-3 -left-3 w-6 h-6 pointer-events-none z-20"
                 style={{ borderTop: "2px solid rgba(249,115,22,0.6)", borderLeft: "2px solid rgba(249,115,22,0.6)" }} />
            <div className="absolute -top-3 -right-3 w-6 h-6 pointer-events-none z-20"
                 style={{ borderTop: "2px solid rgba(249,115,22,0.6)", borderRight: "2px solid rgba(249,115,22,0.6)" }} />
            <div className="absolute -bottom-3 -left-3 w-6 h-6 pointer-events-none z-20"
                 style={{ borderBottom: "2px solid rgba(249,115,22,0.6)", borderLeft: "2px solid rgba(249,115,22,0.6)" }} />
            <div className="absolute -bottom-3 -right-3 w-6 h-6 pointer-events-none z-20"
                 style={{ borderBottom: "2px solid rgba(249,115,22,0.6)", borderRight: "2px solid rgba(249,115,22,0.6)" }} />

            {/* Demo card */}
            <div className="rounded-2xl overflow-hidden"
                 style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 4px 16px rgba(249,115,22,0.12)" }}>
              {/* Dark browser chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b"
                   style={{ background: "#141210", borderColor: "rgba(255,255,255,0.06)" }}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                <div className="flex-1 mx-4 h-5 rounded px-2 flex items-center"
                     style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-xs" style={{ color: "rgba(250,250,248,0.35)", fontFamily: "var(--font-jetbrains)" }}>
                    FieldBuilt AI · Mike Johnson · AC Repair
                  </span>
                </div>
              </div>
              <LiveConversation />
            </div>

            {/* Floating appointment badge */}
            <motion.div
              initial={{ opacity: 0, x: 16, y: 8 }} animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
              className="absolute -right-5 top-8 px-3.5 py-2.5 rounded-xl text-xs font-medium"
              style={{ background: C.surface, border: `1px solid ${C.border}`,
                       boxShadow: "0 12px 32px rgba(0,0,0,0.20), 0 2px 8px rgba(249,115,22,0.08)" }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: "#F0FDF4" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" aria-hidden="true" />
                </div>
                <div>
                  <div className="font-semibold" style={{ color: C.text }}>Appointment booked</div>
                  <div style={{ color: C.muted }}>Thu 9am · Frisco TX</div>
                </div>
              </div>
            </motion.div>

            {/* Live indicator */}
            <motion.div
              initial={{ opacity: 0, x: -16, y: 8 }} animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1.7, duration: 0.5 }}
              className="absolute -left-5 bottom-12 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
              style={{ background: "#1A1614", border: "1px solid rgba(249,115,22,0.25)",
                       color: "#F97316", fontFamily: "var(--font-jetbrains)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: "callPulse 2s ease-in-out infinite" }} />
              3.7s response
            </motion.div>
          </motion.div>

        </div>{/* end 2-col grid */}

        {/* Stats row — anchored to bottom of dark hero, no separate section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className="mt-20 pt-8 border-t"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0">
            {[
              { value: "3.7",  unit: "s",   label: "First contact — day or night" },
              { value: "94",   unit: "%",   label: "Contact rate vs. 11% industry avg" },
              { value: "3–5",  unit: "×",   label: "Average ROI on ad spend in 60 days" },
              { value: "24/7", unit: "",    label: "Your AI back office never clocks out" },
            ].map((s, i) => (
              <div
                key={i}
                className={`${i > 0 ? "md:border-l" : ""} md:pl-8`}
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div className="text-3xl font-black mb-1 tabular-nums"
                     style={{ color: "#F97316", fontFamily: "var(--font-jetbrains)" }}>
                  {s.value}<span className="text-base font-semibold ml-0.5" style={{ color: "rgba(249,115,22,0.65)" }}>{s.unit}</span>
                </div>
                <div className="text-xs leading-snug" style={{ color: "rgba(250,250,248,0.40)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI OFFICE SECTION — Loop video + CRM reveal
// ─────────────────────────────────────────────────────────────────────────────
function AIOfficeSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const crmCards = [
    {
      title: "Lead Intelligence File",
      subtitle: "Built automatically from every conversation",
      color: C.primary,
      bg: "#FFF3EC",
      icon: <Brain className="w-4 h-4" aria-hidden="true" />,
      fields: [
        { label: "Lead",         value: "Mike Johnson — Facebook Ad" },
        { label: "System",       value: "Central AC · Split System" },
        { label: "Unit age",     value: "12 years" },
        { label: "Issue",        value: "Blows warm air · 2 days" },
        { label: "Urgency",      value: "High — no cooling" },
        { label: "Homeowner",    value: "Yes — confirmed" },
        { label: "Address",      value: "2241 Ridgeline Dr, Frisco TX" },
        { label: "Appointment",  value: "Thu 9am — booked by AI" },
        { label: "Tech assigned", value: "Marcus T. — briefed" },
      ],
      badge: { label: "Booked", color: C.success },
    },
    {
      title: "Full Conversation History",
      subtitle: "Every message, every call — permanently logged",
      color: "#0EA5E9",
      bg: "#F0F9FF",
      icon: <MessageSquare className="w-4 h-4" aria-hidden="true" />,
      messages: [
        { role: "ai",    text: "Hey Mike, saw you reached out about your AC — what's it doing?",          channel: "SMS" },
        { role: "lead",  text: "Not cooling. Been 2 days.",                                                channel: "SMS" },
        { role: "ai",    text: "Running but blowing warm air, or completely off?",                         channel: "SMS" },
        { role: "lead",  text: "Runs but blows warm. Can someone call me?",                               channel: "SMS" },
        { role: "ai",    text: "Voice call triggered. Duration: 4m 12s. Appointment booked: Thu 9am.",    channel: "CALL" },
      ],
    },
    {
      title: "Live Pipeline — Every Lead Tracked",
      subtitle: "Real-time status on every lead in your market",
      color: C.success,
      bg: "#F0FDF4",
      icon: <TrendingUp className="w-4 h-4" aria-hidden="true" />,
      pipeline: [
        { name: "Mike Johnson",   status: "Appt Booked",   time: "Thu 9am",       color: C.success,  value: "$8,400" },
        { name: "Sarah Martinez", status: "Active Convo",  time: "Replying now",  color: "#0EA5E9",  value: "$4,200" },
        { name: "Tom Richards",   status: "Follow-Up Day 2", time: "Auto running", color: "#D97706", value: "$6,800" },
        { name: "Lisa Chen",      status: "Just Came In",  time: "3.7s ago",      color: C.primary,  value: "$5,100" },
        { name: "David Park",     status: "Appt Booked",   time: "Fri 2pm",       color: C.success,  value: "$12,400" },
      ],
    },
  ]

  return (
    <section ref={ref} className="relative overflow-hidden" style={{ zIndex: 10 }}>

      {/* ── PART 1: VIDEO LOOP — dark section ── */}
      <div className="relative py-24 px-6 overflow-hidden" style={{ background: "#1A1614" }}>
        {/* Blueprint crosshatch */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
             style={{
               backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
               backgroundSize: "44px 44px", opacity: 0.06,
               WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, #000 20%, transparent 75%)",
               maskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, #000 20%, transparent 75%)",
             }} />
        {/* Glow orb behind video */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="w-[700px] h-[400px] rounded-full blur-3xl"
               style={{ background: "rgba(249,115,22,0.06)" }} />
        </div>

        {/* Headline — contained width */}
        <div className="relative max-w-4xl mx-auto text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="block w-8 h-px" style={{ background: "#F97316" }} />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]"
                    style={{ color: "#F97316", fontFamily: "var(--font-jetbrains)" }}>
                The AI Office
              </span>
              <span className="block w-8 h-px" style={{ background: "#F97316" }} />
            </div>

            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
              While you&rsquo;re on a job.
              <br />
              <span style={{ color: "#F97316" }}>Your AI office</span>
              {" is running everything else."}
            </h2>

            <p className="text-lg max-w-2xl mx-auto leading-relaxed"
               style={{ color: "rgba(250,250,248,0.58)" }}>
              Not a chatbot. Not a text bot. A fully connected AI operating system —
              where every agent is aware of every lead, every detail, every next step.
              Watch it work.
            </p>
          </motion.div>
        </div>

        {/* Video — full section width, no extra chrome wrapper */}
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Blueprint corner brackets */}
            <div className="absolute -top-3 -left-3 w-7 h-7 pointer-events-none z-10"
                 style={{ borderTop: "2px solid rgba(249,115,22,0.45)", borderLeft: "2px solid rgba(249,115,22,0.45)" }} />
            <div className="absolute -top-3 -right-3 w-7 h-7 pointer-events-none z-10"
                 style={{ borderTop: "2px solid rgba(249,115,22,0.45)", borderRight: "2px solid rgba(249,115,22,0.45)" }} />
            <div className="absolute -bottom-3 -left-3 w-7 h-7 pointer-events-none z-10"
                 style={{ borderBottom: "2px solid rgba(249,115,22,0.45)", borderLeft: "2px solid rgba(249,115,22,0.45)" }} />
            <div className="absolute -bottom-3 -right-3 w-7 h-7 pointer-events-none z-10"
                 style={{ borderBottom: "2px solid rgba(249,115,22,0.45)", borderRight: "2px solid rgba(249,115,22,0.45)" }} />

            {/* iframe — no outer chrome, animation has its own UI */}
            <iframe
              src="/ai-office-loop.html"
              style={{
                width: "100%",
                aspectRatio: "16/9",
                border: "none",
                display: "block",
                borderRadius: 16,
                boxShadow: "0 40px 120px rgba(0,0,0,0.7), 0 4px 32px rgba(249,115,22,0.12)",
              }}
              title="FieldBuilt AI — Live operation loop"
              loading="lazy"
            />
          </motion.div>

          {/* Agent flow labels below video */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="flex items-center justify-center gap-2 flex-wrap mt-8"
          >
            {[
              { label: "SMS Agent",         color: "#0EA5E9" },
              { label: "→",                color: "rgba(250,250,248,0.2)" },
              { label: "Voice Agent",       color: "#F97316" },
              { label: "→",                color: "rgba(250,250,248,0.2)" },
              { label: "Lead Intelligence", color: "#D97706" },
              { label: "→",                color: "rgba(250,250,248,0.2)" },
              { label: "AI Dispatcher",     color: "#16A34A" },
              { label: "→",                color: "rgba(250,250,248,0.2)" },
              { label: "CRM",               color: "#F97316" },
            ].map((item, i) => (
              <span key={i} className="text-xs font-semibold"
                    style={{ color: item.color, fontFamily: item.label === "→" ? undefined : "var(--font-jetbrains)" }}>
                {item.label}
              </span>
            ))}
            <span className="text-xs ml-1" style={{ color: "rgba(250,250,248,0.3)" }}>— all connected · all aware</span>
          </motion.div>
        </div>
      </div>

      {/* ── PART 2: CRM BENTO — cream section, tight gap to video ── */}
      <div className="relative pt-12 pb-20 px-6" style={{ background: C.bg }}>
        {/* Subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{
               backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.15) 1.4px, transparent 1.4px)",
               backgroundSize: "26px 26px",
               WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, #000 30%, transparent 80%)",
               maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, #000 30%, transparent 80%)",
             }} />

        <div className="relative max-w-7xl mx-auto">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center mb-10"
          >
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="block w-6 h-px" style={{ background: C.primary }} />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: C.primary, fontFamily: "var(--font-jetbrains)" }}>
                Built-in CRM
              </span>
              <span className="block w-6 h-px" style={{ background: C.primary }} />
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
              Every lead. A complete file.
              <br />
              <span style={{ color: C.primary }}>Logged automatically. Nothing missed.</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: C.muted }}>
              No manual entry. Every conversation, every qualification detail, every appointment —
              written automatically to the lead&rsquo;s file. You open your CRM and know exactly where everything stands.
            </p>
          </motion.div>

          {/* Bento grid — same rich UI cards as the product overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">

            {/* Analytics Dashboard — spans 2 cols */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="md:col-span-2 rounded-2xl p-6 border"
              style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFF3EC", color: C.primary }}>
                  <BarChart3 className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: C.text }}>Analytics Dashboard</div>
                  <div className="text-xs" style={{ color: C.muted }}>Revenue and conversion — live</div>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F0FDF4", color: C.success }}>Live</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Revenue this month",  value: "$284K", sub: "recovered from ad spend", color: C.success },
                  { label: "Leads reached",       value: "94%",   sub: "within 3.7 seconds",      color: C.primary },
                  { label: "Avg response time",   value: "3.7s",  sub: "while you were on a job", color: "#0EA5E9" },
                  { label: "Show rate",           value: "91%",   sub: "of booked appointments",  color: "#D97706" },
                ].map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.93 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.2 + i * 0.07 }} className="rounded-xl p-3 border"
                    style={{ background: C.subtle, borderColor: C.border }}>
                    <div className="text-2xl font-black mb-0.5" style={{ color: m.color, fontFamily: "var(--font-mono)" }}>{m.value}</div>
                    <div className="text-xs font-semibold mb-0.5" style={{ color: C.text }}>{m.label}</div>
                    <div className="text-xs" style={{ color: C.muted }}>{m.sub}</div>
                  </motion.div>
                ))}
              </div>
              <div className="border-t pt-4" style={{ borderColor: C.border }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: C.muted }}>Appointments booked — last 7 days</span>
                  <span className="text-xs font-bold" style={{ color: C.primary }}>49 total this week</span>
                </div>
                <div className="flex items-end gap-1.5" style={{ height: 48 }}>
                  {[3, 7, 5, 9, 6, 11, 8].map((h, i) => (
                    <motion.div key={i} className="flex-1 rounded-t-sm"
                      style={{ background: i === 5 ? C.primary : `${C.primary}35`, height: `${(h / 11) * 100}%` }}
                      initial={{ scaleY: 0, originY: "100%" }} animate={inView ? { scaleY: 1 } : {}}
                      transition={{ delay: 0.55 + i * 0.05, duration: 0.45, ease: "easeOut" }} />
                  ))}
                </div>
                <div className="flex mt-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                    <div key={i} className="flex-1 text-center text-xs" style={{ color: C.muted }}>{d}</div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Lead Intelligence */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-2xl p-6 border"
              style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFF3EC", color: C.primary }}>
                  <Brain className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: C.text }}>Lead Intelligence</div>
                  <div className="text-xs" style={{ color: C.muted }}>Built from every conversation</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: C.subtle }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: C.primary }}>M</div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate" style={{ color: C.text }}>Mike Johnson</div>
                  <div className="text-xs truncate" style={{ color: C.muted }}>Facebook Ad · AC Repair</div>
                </div>
                <span className="ml-auto shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#F0FDF4", color: C.success }}>Booked</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "System type", value: "Central AC · Split" },
                  { label: "Unit age",    value: "12 years" },
                  { label: "Issue",       value: "Blows warm air" },
                  { label: "Urgency",     value: "High — 2 days down" },
                  { label: "Homeowner",   value: "Yes — confirmed" },
                  { label: "Address",     value: "2241 Ridgeline, Frisco TX" },
                ].map((f, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    className="flex items-start justify-between gap-3 pb-2 border-b last:border-0 last:pb-0"
                    style={{ borderColor: C.border }}>
                    <span className="text-xs shrink-0" style={{ color: C.muted }}>{f.label}</span>
                    <span className="text-xs font-semibold text-right" style={{ color: C.text }}>{f.value}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* AI SMS Agent */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="rounded-2xl p-6 border"
              style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0F9FF", color: "#0EA5E9" }}>
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: C.text }}>AI SMS Agent</div>
                  <div className="text-xs" style={{ color: C.muted }}>Responds in 3.7s, books in minutes</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { role: "ai",   text: "Hey Mike, saw you reached out about your AC — what's it doing?" },
                  { role: "lead", text: "Not cooling. Been two days." },
                  { role: "ai",   text: "Running but warm air, or completely off?" },
                  { role: "lead", text: "Runs but warm." },
                  { role: "ai",   text: "How old is the unit?" },
                ].map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className={`flex ${m.role === "lead" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[85%] px-3 py-2 text-xs leading-snug"
                         style={{
                           background: m.role === "ai" ? C.subtle : C.primary,
                           color:      m.role === "ai" ? C.text : "#fff",
                           borderRadius: m.role === "ai" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                         }}>
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Lead Pipeline CRM */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="rounded-2xl p-6 border"
              style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0FDF4", color: C.success }}>
                  <Kanban className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: C.text }}>Lead Pipeline CRM</div>
                  <div className="text-xs" style={{ color: C.muted }}>Every lead at a glance</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: "New",       count: 12, color: C.primary },
                  { label: "Talking",   count: 8,  color: "#0EA5E9" },
                  { label: "Qualified", count: 5,  color: "#D97706" },
                  { label: "Booked",    count: 19, color: C.success },
                ].map((col, i) => (
                  <div key={i} className="text-center">
                    <div className="text-xs mb-1 truncate" style={{ color: C.muted }}>{col.label}</div>
                    <div className="text-2xl font-black" style={{ color: col.color, fontFamily: "var(--font-mono)" }}>{col.count}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {[
                  { name: "Mike Johnson",   stage: "Booked",    color: C.success },
                  { name: "Sarah Martinez", stage: "Qualified",  color: "#D97706" },
                  { name: "Tom Richards",   stage: "Talking",    color: "#0EA5E9" },
                  { name: "Lisa Chen",      stage: "New",        color: C.primary },
                  { name: "David Park",     stage: "Booked",     color: C.success },
                ].map((l, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.45 + i * 0.07 }}
                    className="flex items-center gap-2 p-2 rounded-lg" style={{ background: C.subtle }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                         style={{ background: l.color }}>{l.name[0]}</div>
                    <span className="text-xs font-medium flex-1 truncate" style={{ color: C.text }}>{l.name}</span>
                    <span className="text-xs shrink-0 font-semibold" style={{ color: l.color }}>{l.stage}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* 14-Day Follow-Up Engine */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="rounded-2xl p-6 border"
              style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFF7ED", color: "#D97706" }}>
                  <Repeat className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: C.text }}>14-Day Follow-Up Engine</div>
                  <div className="text-xs" style={{ color: C.muted }}>SMS + voice calls, no setup</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { time: "Instant", type: "sms",   label: "First text" },
                  { time: "30 min",  type: "voice", label: "AI voice call" },
                  { time: "24 hrs",  type: "sms",   label: "Follow-up text" },
                  { time: "Day 2",   type: "voice", label: "2nd AI call" },
                  { time: "Day 4",   type: "sms",   label: "Value message" },
                  { time: "Day 7",   type: "sms",   label: "Check-in" },
                  { time: "Day 14",  type: "sms",   label: "Long game" },
                ].map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.5 + i * 0.06 }} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                         style={{ background: s.type === "voice" ? "#FFF3EC" : "#F0F9FF",
                                  color:      s.type === "voice" ? C.primary : "#0EA5E9" }}>
                      {s.type === "voice"
                        ? <PhoneCall className="w-3 h-3" aria-hidden="true" />
                        : <MessageSquare className="w-3 h-3" aria-hidden="true" />}
                    </div>
                    <span className="text-xs w-12 shrink-0" style={{ color: C.muted, fontFamily: "var(--font-mono)" }}>{s.time}</span>
                    <span className="text-xs" style={{ color: C.text }}>{s.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

          </div>

          {/* Bottom anchor line */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="rounded-2xl p-8 text-center border"
            style={{ background: "#1A1614", borderColor: "rgba(249,115,22,0.15)",
                     boxShadow: "0 4px 32px rgba(0,0,0,0.25)" }}
          >
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
              There is no other product like this
              <br />
              <span style={{ color: "#F97316" }}>in the home services market.</span>
            </h3>
            <p className="text-base max-w-2xl mx-auto" style={{ color: "rgba(250,250,248,0.55)" }}>
              Other tools have a text bot. FieldBuilt AI is a complete AI operating system —
              every agent connected, every lead tracked, every detail logged, your whole operation
              running on one aware, intelligent back office.
            </p>
          </motion.div>

        </div>
      </div>

    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM OVERVIEW — "The front office your HVAC company never had"
// ─────────────────────────────────────────────────────────────────────────────
function SystemOverviewSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const dashMetrics = [
    { label: "Revenue this month",  value: "$284K", sub: "recovered from ad spend", color: C.success },
    { label: "Leads reached",       value: "94%",   sub: "within 60 seconds",       color: C.primary },
    { label: "Avg response time",   value: "14s",   sub: "while you were on a job", color: "#0EA5E9" },
    { label: "Show rate",           value: "91%",   sub: "of booked appointments",  color: "#D97706" },
  ]

  const leadProfile = [
    { label: "System type",  value: "Central AC · Split" },
    { label: "Unit age",     value: "12 years" },
    { label: "Issue",        value: "Blows warm air" },
    { label: "Urgency",      value: "High — 2 days down" },
    { label: "Homeowner",    value: "Yes — confirmed" },
    { label: "Address",      value: "2241 Ridgeline, Frisco TX" },
  ]

  const pipeline = [
    { label: "New",       count: 12, color: C.primary },
    { label: "Talking",   count: 8,  color: "#0EA5E9" },
    { label: "Qualified", count: 5,  color: "#D97706" },
    { label: "Booked",    count: 19, color: C.success },
  ]

  const miniConvo = [
    { role: "ai",   text: "Hey Mike, saw you reached out about your AC — what's it doing?" },
    { role: "lead", text: "Not cooling. Been two days." },
    { role: "ai",   text: "Running but warm air, or completely off?" },
    { role: "lead", text: "Runs but warm." },
    { role: "ai",   text: "How old is the unit?" },
  ]

  const followUpSteps = [
    { time: "Instant", type: "sms",   label: "First text" },
    { time: "30 min",  type: "voice", label: "AI voice call" },
    { time: "24 hrs",  type: "sms",   label: "Follow-up text" },
    { time: "Day 2",   type: "voice", label: "2nd AI call" },
    { time: "Day 4",   type: "sms",   label: "Value message" },
    { time: "Day 7",   type: "sms",   label: "Check-in" },
    { time: "Day 14",  type: "sms",   label: "Long game" },
  ]

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-7xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="block w-6 h-px" style={{ background: C.primary }} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ color: C.primary, fontFamily: "var(--font-jetbrains)" }}>
              What you get
            </span>
            <span className="block w-6 h-px" style={{ background: C.primary }} />
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            Everything your back office does.
            <br />
            <span style={{ color: C.primary }}>Done by AI.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: C.muted }}>
            Lead qualification, appointment booking, tech dispatch, follow-up sequences, revenue tracking —
            all connected, all automated. Here&rsquo;s what you see every morning.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Analytics Dashboard — spans 2 cols */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:col-span-2 rounded-2xl p-6 border"
            style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFF3EC", color: C.primary }}>
                <BarChart3 className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>Analytics Dashboard</div>
                <div className="text-xs" style={{ color: C.muted }}>Revenue and conversion — live</div>
              </div>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F0FDF4", color: C.success }}>Live</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {dashMetrics.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.93 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="rounded-xl p-3 border"
                  style={{ background: C.subtle, borderColor: C.border }}
                >
                  <div className="text-2xl font-black mb-0.5" style={{ color: m.color, fontFamily: "var(--font-mono)" }}>{m.value}</div>
                  <div className="text-xs font-semibold mb-0.5" style={{ color: C.text }}>{m.label}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{m.sub}</div>
                </motion.div>
              ))}
            </div>

            <div className="border-t pt-4" style={{ borderColor: C.border }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: C.muted }}>Appointments booked — last 7 days</span>
                <span className="text-xs font-bold" style={{ color: C.primary }}>49 total this week</span>
              </div>
              <div className="flex items-end gap-1.5" style={{ height: 48 }}>
                {[3, 7, 5, 9, 6, 11, 8].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{ background: i === 5 ? C.primary : `${C.primary}35`, height: `${(h / 11) * 100}%` }}
                    initial={{ scaleY: 0, originY: "100%" }}
                    animate={inView ? { scaleY: 1 } : {}}
                    transition={{ delay: 0.55 + i * 0.05, duration: 0.45, ease: "easeOut" }}
                  />
                ))}
              </div>
              <div className="flex mt-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                  <div key={i} className="flex-1 text-center text-xs" style={{ color: C.muted }}>{d}</div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Lead Intelligence */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl p-6 border"
            style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFF3EC", color: C.primary }}>
                <Brain className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>Lead Intelligence</div>
                <div className="text-xs" style={{ color: C.muted }}>Built from every conversation</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: C.subtle }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                   style={{ background: C.primary }}>M</div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: C.text }}>Mike Johnson</div>
                <div className="text-xs truncate" style={{ color: C.muted }}>Google Ads · AC Repair</div>
              </div>
              <span className="ml-auto shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: "#F0FDF4", color: C.success }}>Booked</span>
            </div>

            <div className="space-y-2.5">
              {leadProfile.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="flex items-start justify-between gap-3 pb-2 border-b last:border-0 last:pb-0"
                  style={{ borderColor: C.border }}
                >
                  <span className="text-xs shrink-0" style={{ color: C.muted }}>{f.label}</span>
                  <span className="text-xs font-semibold text-right" style={{ color: C.text }}>{f.value}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* AI SMS Agent */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-2xl p-6 border"
            style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0F9FF", color: "#0EA5E9" }}>
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>AI SMS Agent</div>
                <div className="text-xs" style={{ color: C.muted }}>Responds in seconds, books in minutes</div>
              </div>
            </div>

            <div className="space-y-2">
              {miniConvo.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className={`flex ${m.role === "lead" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[85%] px-3 py-2 text-xs leading-snug"
                       style={{
                         background: m.role === "ai" ? C.subtle : C.primary,
                         color:      m.role === "ai" ? C.text : "#fff",
                         borderRadius: m.role === "ai" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                       }}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Lead Pipeline CRM */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="rounded-2xl p-6 border"
            style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0FDF4", color: C.success }}>
                <Kanban className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>Lead Pipeline CRM</div>
                <div className="text-xs" style={{ color: C.muted }}>Every lead at a glance</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {pipeline.map((col, i) => (
                <div key={i} className="text-center">
                  <div className="text-xs mb-1 truncate" style={{ color: C.muted }}>{col.label}</div>
                  <div className="text-2xl font-black" style={{ color: col.color, fontFamily: "var(--font-mono)" }}>{col.count}</div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              {[
                { name: "Mike Johnson",   stage: "Booked",    color: C.success },
                { name: "Sarah Martinez", stage: "Qualified",  color: "#D97706" },
                { name: "Tom Richards",   stage: "Talking",    color: "#0EA5E9" },
                { name: "Lisa Chen",      stage: "New",        color: C.primary },
                { name: "David Park",     stage: "Booked",     color: C.success },
              ].map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.45 + i * 0.07 }}
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ background: C.subtle }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                       style={{ background: l.color }}>{l.name[0]}</div>
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: C.text }}>{l.name}</span>
                  <span className="text-xs shrink-0 font-semibold" style={{ color: l.color }}>{l.stage}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* 14-Day Follow-Up Engine */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="rounded-2xl p-6 border"
            style={{ background: C.surface, borderColor: C.border, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFF7ED", color: "#D97706" }}>
                <Repeat className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>14-Day Follow-Up Engine</div>
                <div className="text-xs" style={{ color: C.muted }}>SMS + voice calls, no setup</div>
              </div>
            </div>

            <div className="space-y-2">
              {followUpSteps.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.5 + i * 0.06 }}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                       style={{ background: s.type === "voice" ? "#FFF3EC" : "#F0F9FF",
                                color:      s.type === "voice" ? C.primary : "#0EA5E9" }}>
                    {s.type === "voice"
                      ? <PhoneCall className="w-3 h-3" aria-hidden="true" />
                      : <MessageSquare className="w-3 h-3" aria-hidden="true" />}
                  </div>
                  <span className="text-xs w-12 shrink-0" style={{ color: C.muted, fontFamily: "var(--font-mono)" }}>{s.time}</span>
                  <span className="text-xs" style={{ color: C.text }}>{s.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM SECTION — "You paid $80 for that lead"
// ─────────────────────────────────────────────────────────────────────────────
function ProblemSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const withoutSteps = [
    { time: "9:04 PM", text: "Sarah's AC dies. Fills out your Facebook form.", bad: false },
    { time: "9:04 PM", text: "She fills out 3 competitor forms. You don't know this.", bad: true },
    { time: "9:11 PM", text: "Big HVAC company's system texts her back.", bad: true },
    { time: "9:14 PM", text: "She's booked. $8,400 AC replacement. Gone.", bad: true },
    { time: "8:30 AM", text: "You call the lead. Voicemail. She's already home with another tech.", bad: true },
  ]

  const withSteps = [
    { time: "9:04 PM", text: "Sarah's AC dies. Fills out your Facebook form.", good: false },
    { time: "9:04 PM", text: "\"Hey Sarah, saw you reached out about your AC — what's it doing?\"", good: true },
    { time: "9:09 PM", text: "She replies. AI qualifies her.", good: true },
    { time: "9:17 PM", text: "Appointment booked. $8,400 job on your calendar.", good: true },
    { time: "9:17 PM", text: "You get a push notification. You're already asleep. That's fine.", good: true },
  ]

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }} id="features">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
               style={{ background: "#FEF2F2", color: "#DC2626" }}>
            The invisible money problem
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Jobs are leaving your pocket.<br />You&rsquo;ll never know they existed.
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: C.muted }}>
            A homeowner&rsquo;s AC dies at 9pm. She fills out your form — and three competitor forms.
            Whoever texts back first gets the job. You find the lead at 8:30am.
            You call. Voicemail. She booked someone else at 9:14pm. That $8,400 job is gone.
            You&rsquo;ll never know it existed.
          </p>
        </motion.div>

        {/* Side-by-side comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* WITHOUT */}
          <motion.div
            initial={{ opacity: 0, x: -24 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-2xl p-6 border"
            style={{ background: "#FFF8F8", borderColor: "#FECACA" }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
              </div>
              <span className="font-bold text-sm text-red-700">Without FieldBuilt AI</span>
            </div>
            <div className="space-y-4">
              {withoutSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="text-xs font-mono pt-0.5 shrink-0 w-16" style={{ color: "#78716C" }}>{s.time}</div>
                  <div className={`text-sm leading-snug ${s.bad ? "font-medium text-red-700" : ""}`}
                       style={{ color: s.bad ? "#DC2626" : C.text }}>
                    {s.bad && <span className="mr-1">↳</span>}{s.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-red-200">
              <p className="text-sm font-semibold text-red-700">
                $80–$150 in ad spend. $0 back. You&rsquo;ll never know the job existed.
              </p>
            </div>
          </motion.div>

          {/* WITH */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl p-6 border"
            style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-green-600" aria-hidden="true" />
              </div>
              <span className="font-bold text-sm text-green-700">With FieldBuilt AI</span>
            </div>
            <div className="space-y-4">
              {withSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="text-xs font-mono pt-0.5 shrink-0 w-16" style={{ color: "#78716C" }}>{s.time}</div>
                  <div className={`text-sm leading-snug ${s.good ? "font-semibold text-green-800" : ""}`}
                       style={{ color: s.good ? "#166534" : C.text }}>
                    {s.good && i > 0 && <span className="mr-1">✓</span>}{s.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-green-200">
              <p className="text-sm font-semibold text-green-700">
                $80 ad spend. $8,400 job booked. You found out at 9:17pm — in a push notification.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS — Connected OS differentiator
// ─────────────────────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const timelineSteps = [
    {
      agent: "Lead submits form",
      time: "9:04 PM",
      nodeColor: "#78716C",
      nodeBg: "#F5F4F2",
      action: "Mike fills out your Facebook Lead Ad. Lead instantly enters FieldBuilt AI.",
      learned: [],
      trigger: null,
    },
    {
      agent: "SMS Agent",
      time: "9:04:03 PM — 3.7 seconds later",
      nodeColor: "#0EA5E9",
      nodeBg: "#F0F9FF",
      action: "\"Hey Mike, saw you reached out about your AC — what's it doing?\" Qualifies with trade-specific questions. Logs everything.",
      learned: ["System: Central AC, 12yr", "Issue: Blows warm air", "Duration: 2 days down"],
      trigger: null,
    },
    {
      agent: "SMS Agent",
      time: "9:06 PM",
      nodeColor: "#0EA5E9",
      nodeBg: "#F0F9FF",
      action: "Mike says: \"Can someone call me?\" — FieldBuilt AI reads the intent and triggers the voice agent automatically. No human involved.",
      learned: ["Call preference detected", "Urgency: High"],
      trigger: { label: "Voice Agent triggered automatically →", color: "#F97316" },
    },
    {
      agent: "Voice Agent",
      time: "9:07 PM",
      nodeColor: "#F97316",
      nodeBg: "#FFF3EC",
      action: "Calls Mike with the full SMS context already loaded. Opens: \"You mentioned the AC's been blowing warm air — is that right?\" Mike doesn't repeat a single thing. Appointment booked.",
      learned: ["Homeowner: Yes — confirmed", "Address: 2241 Ridgeline, Frisco TX", "Appointment: Thu 9am"],
      trigger: { label: "Dispatcher notified instantly →", color: "#16A34A" },
    },
    {
      agent: "AI Dispatcher",
      time: "9:07 PM",
      nodeColor: "#16A34A",
      nodeBg: "#F0FDF4",
      action: "Routes Marcus T. (AC Repair, closest available). Sends full brief: \"Central AC, 12yr, blowing warm air, urgent — 2241 Ridgeline, Frisco TX.\" Your tech arrives knowing the job.",
      learned: ["Marcus T. assigned — AC Repair, 2.3mi", "Tech brief sent with full context"],
      trigger: { label: "Push notification sent to you →", color: "#78716C" },
    },
  ]

  const fileEntries = [
    { section: "ON FORM SUBMIT", color: "#78716C", items: ["Mike Johnson · Facebook Lead Ad", "Phone: +1 (214) 555-0192"] },
    { section: "SMS AGENT LEARNED", color: "#0EA5E9", items: ["System: Central AC · Split", "Unit age: 12 years", "Issue: Blows warm air · 2 days", "Prefers a phone call"] },
    { section: "VOICE AGENT CONFIRMED", color: "#F97316", items: ["Homeowner: Yes — confirmed", "2241 Ridgeline Dr, Frisco TX", "Appointment: Thu 9am booked"] },
    { section: "DISPATCHER BRIEFED", color: "#16A34A", items: ["Marcus T. — AC Repair — 2.3mi", "\"12yr Central AC, warm air, urgent\""] },
  ]

  return (
    <section ref={ref} className="relative py-24 px-6 overflow-hidden" style={{ zIndex: 10 }} id="how-it-works">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="block w-6 h-px" style={{ background: C.primary }} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ color: C.primary, fontFamily: "var(--font-jetbrains)" }}>
              Why it&rsquo;s different
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            Not a chatbot.
            <br />
            <span style={{ color: C.primary }}>A connected operating system.</span>
          </h2>
          <p className="text-lg max-w-2xl" style={{ color: C.muted }}>
            Other AI tools send a text and the information dies there. FieldBuilt AI builds a live file
            on every lead — and every agent picks up exactly where the last one left off.
            Nothing repeated. Nothing lost. Nothing cold.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-10 items-start">

          {/* LEFT — Connected flow timeline */}
          <div className="relative">
            {/* Connecting vertical line */}
            <div className="absolute left-[9px] top-4 bottom-4 w-px"
                 style={{ background: `linear-gradient(to bottom, ${C.primary}50, transparent)` }}
                 aria-hidden="true" />

            {timelineSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -18 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="relative pl-8 pb-8 last:pb-0"
              >
                {/* Node */}
                <div className="absolute left-0 top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center"
                     style={{ background: step.nodeBg, borderColor: step.nodeColor }}>
                  <div className="w-[6px] h-[6px] rounded-full" style={{ background: step.nodeColor }} />
                </div>

                {/* Agent + time */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: step.nodeBg, color: step.nodeColor }}>
                    {step.agent}
                  </span>
                  <span className="text-xs" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
                    {step.time}
                  </span>
                </div>

                {/* Action */}
                <p className="text-sm leading-relaxed mb-2" style={{ color: C.text }}>
                  {step.action}
                </p>

                {/* What was learned */}
                {step.learned.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {step.learned.map((item, j) => (
                      <span key={j} className="text-xs px-2 py-0.5 rounded-md"
                            style={{ background: C.subtle, color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                )}

                {/* Trigger to next agent */}
                {step.trigger && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-4 h-px block" style={{ background: step.trigger.color }} aria-hidden="true" />
                    <span className="text-xs font-semibold" style={{ color: step.trigger.color }}>
                      {step.trigger.label}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* RIGHT — Live lead file (shared context visual) */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="rounded-2xl overflow-hidden border sticky top-24"
            style={{ background: C.surface, borderColor: C.border,
                     boxShadow: "0 8px 32px rgba(249,115,22,0.08)" }}
          >
            {/* File header */}
            <div className="px-5 py-4 border-b"
                 style={{ borderColor: C.border, background: C.subtle }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] mb-0.5"
                       style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
                    Shared Lead File
                  </div>
                  <div className="text-sm font-bold" style={{ color: C.text }}>Mike Johnson</div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                     style={{ background: "#F0FDF4", color: C.success }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  Booked · Thu 9am
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: C.muted }}>
                Every agent reads and writes to this file in real time.
              </p>
            </div>

            {/* Sections */}
            <div className="divide-y" style={{ borderColor: C.border }}>
              {fileEntries.map((section, si) => (
                <motion.div
                  key={si}
                  initial={{ opacity: 0, y: 6 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.35 + si * 0.15 }}
                  className="px-5 py-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: section.color }} aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-[0.1em]"
                          style={{ color: section.color, fontFamily: "var(--font-jetbrains)" }}>
                      {section.section}
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-4">
                    {section.items.map((item, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: section.color }} aria-hidden="true" />
                        <span className="text-xs" style={{ color: C.text }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom contrast callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 grid md:grid-cols-2 gap-4"
        >
          <div className="rounded-xl p-5 border" style={{ background: "#FFF8F8", borderColor: "#FECACA" }}>
            <div className="flex items-center gap-2 mb-3">
              <X className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
              <span className="text-sm font-bold text-red-700">Other AI tools</span>
            </div>
            <div className="space-y-1.5">
              {[
                "Text bot sends a message — context ends there",
                "Each agent has no idea what the others did",
                "Lead says \"call me\" — nothing happens",
                "Tech shows up cold with no job context",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-400 text-sm shrink-0 leading-none mt-0.5" aria-hidden="true">✗</span>
                  <span className="text-xs leading-snug" style={{ color: "#78716C" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-5 border" style={{ background: "#FFF3EC", borderColor: "rgba(249,115,22,0.3)" }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: C.primary }} aria-hidden="true" />
              <span className="text-sm font-bold" style={{ color: C.primaryDark }}>FieldBuilt AI</span>
            </div>
            <div className="space-y-1.5">
              {[
                "Every agent shares one live lead file",
                "SMS agent triggers a voice call when lead asks",
                "Voice agent calls with full SMS context — no repeating",
                "Tech arrives briefed with the exact issue and address",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-sm shrink-0 leading-none mt-0.5" style={{ color: C.primary }} aria-hidden="true">✓</span>
                  <span className="text-xs leading-snug" style={{ color: C.text }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO SECTION — live conversation
// ─────────────────────────────────────────────────────────────────────────────
function DemoSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }} id="demo">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left — chat */}
          <motion.div
            initial={{ opacity: 0, x: -32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="rounded-2xl overflow-hidden"
                 style={{ boxShadow: "0 20px 60px rgba(249,115,22,0.12)" }}>
              <div className="flex items-center gap-1.5 px-4 py-3 border-b"
                   style={{ background: "#F8F7F5", borderColor: C.border }}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="ml-3 text-xs" style={{ color: C.muted }}>
                  SMS conversation · Mike Johnson · +1 (214) 555-0192
                </span>
              </div>
              <LiveConversation />
            </div>
          </motion.div>

          {/* Right — copy */}
          <motion.div
            initial={{ opacity: 0, x: 32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
                 style={{ background: "#FFF3EC", color: C.primary }}>
              HVAC qualification in real time
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              The AI knows HVAC. Not just texting — qualifying.
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>
              FieldBuilt AI doesn&rsquo;t send a generic "We got your request" message. It opens
              with a trade-specific question, learns what&rsquo;s wrong, figures out urgency,
              checks homeownership, collects the address, and books the appointment — all
              in one conversation.
            </p>

            <div className="space-y-3 mb-8">
              {[
                "Asks about system type, age, and what it's doing",
                "Handles \"just getting prices\" and every other objection",
                "Requires a physical address before any booking",
                "Offers two specific time windows — never \"when are you free?\"",
                "Flags commercial properties and renters for your team",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                  <span className="text-sm" style={{ color: C.text }}>{item}</span>
                </div>
              ))}
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
                 style={{ background: "#FFF7ED", color: "#C2410C" }}>
              <Mic className="w-3 h-3" aria-hidden="true" />
              Works for HVAC, Roofing, Solar, Windows, Bath Remodel
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP SEQUENCE — 2-week timeline
// ─────────────────────────────────────────────────────────────────────────────
function FollowUpSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-4"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
               style={{ background: "#FFF3EC", color: C.primary }}>
            Automatic follow-up
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            If they don&rsquo;t respond, your AI keeps going.
            <br />
            <span style={{ color: C.muted, fontWeight: 400 }}>You don&rsquo;t.</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto mb-12" style={{ color: C.muted }}>
            Every lead that doesn&rsquo;t reply gets followed up for two weeks —
            different message, different angle, every time. The moment they book, everything stops.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Timeline */}
          <div className="space-y-3">
            {FOLLOW_UP_STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="flex items-start gap-4 p-4 rounded-xl border"
                style={{ background: C.surface, borderColor: C.border }}
              >
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                       style={{ background: s.type === "voice" ? "#FFF3EC" : "#F0F9FF",
                                color:      s.type === "voice" ? C.primary : "#0EA5E9" }}>
                    {s.type === "voice"
                      ? <PhoneCall className="w-4 h-4" aria-hidden="true" />
                      : <MessageSquare className="w-4 h-4" aria-hidden="true" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold"
                          style={{ color: s.type === "voice" ? C.primary : "#0EA5E9" }}>
                      {s.time}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: s.type === "voice" ? "#FFF3EC" : "#F0F9FF",
                                   color:      s.type === "voice" ? C.primary : "#0EA5E9" }}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-xs leading-snug" style={{ color: C.muted }}>{s.preview}</p>
                </div>
                <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                     style={{ background: C.subtle, color: C.muted }}>
                  {s.step}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right — explainer */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-5"
          >
            <div className="rounded-2xl p-6 border"
                 style={{ background: C.surface, borderColor: C.border }}>
              <h3 className="font-bold mb-2" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                No-reply sequence — 7 steps over 14 days
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                Starts 30 minutes after the lead arrives. Includes 2 voice calls
                and 5 SMS messages. Each one has a different angle — value, urgency,
                closing the loop, seasonal — so it doesn&rsquo;t feel like a spam chain.
              </p>
            </div>

            <div className="rounded-2xl p-6 border"
                 style={{ background: C.surface, borderColor: C.border }}>
              <h3 className="font-bold mb-2" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                Replied-but-didn&rsquo;t-book — 3 more steps
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                If they text back but don&rsquo;t commit, a separate sequence kicks in:
                SMS at 4 hours, voice call at 48 hours, final SMS at 5 days.
                Timers reset on every new reply.
              </p>
            </div>

            <div className="rounded-2xl p-6 border"
                 style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}>
              <h3 className="font-bold mb-2 text-green-800" style={{ fontFamily: "var(--font-jakarta)" }}>
                Appointment booked? Everything stops.
              </h3>
              <p className="text-sm leading-relaxed text-green-700">
                The second a lead books, all pending follow-ups are cancelled automatically.
                No awkward messages after they&rsquo;ve already signed up.
              </p>
            </div>

            <div className="rounded-2xl p-5 border"
                 style={{ background: "#FFF3EC", borderColor: "rgba(249,115,22,0.2)" }}>
              <p className="text-sm font-medium" style={{ color: C.primary }}>
                Calls are gated to your working hours. Your AI never texts at 2 AM or
                calls someone during dinner.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART DISPATCH SECTION
// ─────────────────────────────────────────────────────────────────────────────
function SmartDispatchSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const features = [
    "Routes by technician specialty and job type — AC, heat, commercial",
    "Dispatches to the nearest available tech by location",
    "Notifies the tech by SMS: lead name, address, and issue",
    "Matches call urgency to tech availability in real time",
    "Logs every dispatch automatically in the CRM",
    "Works 24/7 — overnight calls and weekends included",
  ]

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }} id="smart-dispatch">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
                 style={{ background: "#F0FDF4", color: C.success }}>
              Smart Dispatch · add-on
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              Every call. The right tech.
              <br />
              <span style={{ color: C.success }}>No dispatcher needed.</span>
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>
              When a lead calls in, your AI answers, learns their issue, and routes the job
              to the right technician on your team — by skill, by location, by availability.
              The right person shows up. You didn&rsquo;t touch it.
            </p>
            <div className="space-y-3">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                  <span className="text-sm" style={{ color: C.text }}>{f}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — dispatch mockup */}
          <motion.div
            initial={{ opacity: 0, x: 32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div className="rounded-2xl overflow-hidden border"
                 style={{ background: C.surface, borderColor: C.border,
                          boxShadow: "0 20px 60px rgba(77,124,15,0.10)" }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b"
                   style={{ borderColor: C.border, background: "#FAFAF8" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: C.success }} />
                  <span className="text-sm font-semibold" style={{ color: C.text }}>Smart Dispatch</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#F0FDF4", color: C.success }}>Auto</span>
              </div>

              {/* Incoming lead */}
              <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
                <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>Incoming call</div>
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: C.subtle }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                       style={{ background: C.primary }}>M</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: C.text }}>Mike Johnson</div>
                    <div className="text-xs" style={{ color: C.muted }}>AC not cooling · Frisco TX · Urgent</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                        style={{ background: "#FEF3C7", color: "#92400E" }}>Urgent</span>
                </div>
              </div>

              {/* Tech matching */}
              <div className="px-5 py-4">
                <div className="text-xs font-semibold mb-3" style={{ color: C.muted }}>Matched technician</div>
                {[
                  { name: "Marcus T.", detail: "AC Repair · 2.3 mi away", avail: "Available now", best: true },
                  { name: "David R.",  detail: "AC Repair · 5.1 mi away", avail: "Available",    best: false },
                ].map((tech, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.35 + i * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-xl mb-2 border"
                    style={{
                      background:   tech.best ? "#F0FDF4" : C.subtle,
                      borderColor:  tech.best ? "#BBF7D0" : "transparent",
                    }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                         style={{ background: tech.best ? C.success : C.muted }}>
                      {tech.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: C.text }}>{tech.name}</div>
                      <div className="text-xs" style={{ color: C.muted }}>{tech.detail}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold" style={{ color: tech.best ? C.success : C.muted }}>
                        {tech.avail}
                      </div>
                      {tech.best && (
                        <div className="text-xs font-bold mt-0.5" style={{ color: C.success }}>Best match</div>
                      )}
                    </div>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-2 mt-4 p-3 rounded-xl"
                  style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-green-800">Marcus dispatched · SMS sent to tech</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE CALL SECTION
// ─────────────────────────────────────────────────────────────────────────────
function VoiceCallSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const turns = [
    { who: "ai",   text: "Hey Mike, this is Linda with Cool Air HVAC — you reached out about your AC?" },
    { who: "lead", text: "Yeah, it's not cooling at all." },
    { who: "ai",   text: "Sorry to hear that. Is it running at all, or completely shut off?" },
    { who: "lead", text: "It runs but blows warm air." },
    { who: "ai",   text: "Got it. We do free estimates — Thursday morning or Friday afternoon work for you?" },
  ]

  const capabilities = [
    "Natural human-sounding voice — not robotic IVR",
    "Discovers the issue, qualifies, and books live on the call",
    "Hangs up automatically when it reaches voicemail",
    "Schedules callbacks when a lead asks to be called later",
    "Never calls outside your set working hours",
    "Transfers to a human rep when the situation is too complex",
  ]

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
                 style={{ background: "#FFF3EC", color: C.primary }}>
              AI voice calls
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              Real phone calls. Not a recording, not a menu — a conversation.
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>
              Your AI places and receives actual phone calls with a natural, human-sounding voice.
              It asks what&rsquo;s wrong with the system, handles the &ldquo;just getting prices&rdquo; brush-off,
              and books the appointment live on the call — without you on the line.
            </p>
            <div className="space-y-3">
              {capabilities.map((cap, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                  <span className="text-sm" style={{ color: C.text }}>{cap}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — phone mockup */}
          <motion.div
            initial={{ opacity: 0, x: 32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex justify-center"
          >
            <div className="relative w-72">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] overflow-hidden border-4 border-gray-800"
                   style={{ boxShadow: "0 32px 64px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset" }}>
                {/* Status bar */}
                <div className="flex items-center justify-between px-6 pt-4 pb-2 bg-gray-900">
                  <span className="text-white text-xs font-semibold" style={{ fontFamily: "var(--font-mono)" }}>9:41</span>
                  <div className="flex gap-1">
                    <div className="w-4 h-2 border border-white/60 rounded-sm">
                      <div className="w-3/4 h-full bg-green-400 rounded-sm" />
                    </div>
                  </div>
                </div>

                {/* Call screen */}
                <div className="bg-gray-900 px-6 py-8 text-center">
                  <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-bold"
                       style={{ background: C.primary }}>LC</div>
                  <div className="text-white font-semibold mb-1">Cool Air HVAC</div>
                  <div className="text-green-400 text-xs mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                    <span style={{ animation: "callPulse 2s ease-in-out infinite", display: "inline-block" }}>●</span>
                    {" "}Call active · 0:47
                  </div>
                  <div className="text-gray-400 text-xs mb-6">Mike Johnson · +1 (214) 555-0192</div>

                  {/* Conversation bubbles */}
                  <div className="space-y-2 text-left mb-6">
                    {turns.map((t, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.6 + i * 0.3 }}
                        className={`flex ${t.who === "lead" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[10px] leading-snug ${
                          t.who === "ai" ? "bg-gray-700 text-gray-100" : "bg-[#F97316] text-white"
                        }`}>
                          {t.text}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Call controls */}
                  <div className="flex items-center justify-center gap-6">
                    <div className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center">
                      <Mic className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center"
                         style={{ boxShadow: "0 0 20px rgba(239,68,68,0.5)" }}>
                      <Phone className="w-5 h-5 text-white rotate-[135deg]" aria-hidden="true" />
                    </div>
                    <div className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.9 }}
                className="absolute -right-6 top-1/2 -translate-y-1/2 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: C.surface, border: `1px solid ${C.border}`,
                         boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-600" aria-hidden="true" />
                  <span style={{ color: C.text }}>Appointment booked</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>Thu 9am · Frisco TX</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI GUARDRAILS — what it won't do
// ─────────────────────────────────────────────────────────────────────────────
function GuardrailsSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-20 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="rounded-2xl p-10 border"
          style={{ background: C.surface, borderColor: C.border,
                   boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}
        >
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                   style={{ background: "#FFF3EC", color: C.primary }}>
                <Shield className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight mb-3"
                  style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                Your AI knows where the line is.
              </h2>
              <p className="text-base leading-relaxed" style={{ color: C.muted }}>
                FieldBuilt AI never goes rogue. It has hard rules baked in — the same ones
                your best sales rep would follow without being told.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4"
                 style={{ color: C.muted }}>Your AI will never:</p>
              <div className="space-y-3">
                {GUARDRAILS.map((g, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.4, delay: i * 0.07 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                         style={{ background: "#FEF2F2" }}>
                      <X className="w-2.5 h-2.5 text-red-500" aria-hidden="true" />
                    </div>
                    <span className="text-sm leading-snug" style={{ color: C.text }}>{g}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM SECTION
// ─────────────────────────────────────────────────────────────────────────────
function CRMSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const pipeline = [
    { label: "Just Came In",       count: 12, color: C.primary,  bg: "#FFF3EC" },
    { label: "Following Up",       count: 8,  color: "#D97706",  bg: "#FFF7ED" },
    { label: "Active Convo",       count: 5,  color: "#2563EB",  bg: "#EFF6FF" },
    { label: "Appt Booked",        count: 19, color: C.success,  bg: "#F0FDF4" },
  ]

  const leads = [
    { name: "Mike Johnson",  status: "Appointment Booked", time: "Thu 9am", dot: C.success },
    { name: "Sarah Martinez",status: "Active Convo",       time: "Just replied", dot: "#2563EB" },
    { name: "Tom Richards",  status: "Following Up",       time: "Day 2",   dot: "#D97706" },
    { name: "Lisa Chen",     status: "Just Came In",       time: "2 min ago",dot: C.primary },
  ]

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }} id="results">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left — CRM mockup */}
          <motion.div
            initial={{ opacity: 0, x: -32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="rounded-2xl overflow-hidden border"
                 style={{ background: C.surface, borderColor: C.border,
                          boxShadow: "0 20px 60px rgba(249,115,22,0.10)" }}>
              {/* CRM header */}
              <div className="flex items-center justify-between px-5 py-4 border-b"
                   style={{ borderColor: C.border, background: "#FAFAF8" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: C.primary }} />
                  <span className="text-sm font-semibold" style={{ color: C.text }}>FieldBuilt AI CRM</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#F0FDF4", color: C.success }}>Live</span>
              </div>

              {/* Analytics strip */}
              <div className="px-5 py-4 grid grid-cols-4 gap-3 border-b"
                   style={{ borderColor: C.border, background: C.subtle }}>
                {[
                  { label: "Revenue",    value: "$284K", color: C.success },
                  { label: "Booked",     value: "34",    color: C.primary },
                  { label: "Contact",    value: "94%",   color: "#0EA5E9" },
                  { label: "Show rate",  value: "91%",   color: "#D97706" },
                ].map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.15 + i * 0.07 }}
                    className="text-center"
                  >
                    <div className="text-base font-black" style={{ color: m.color, fontFamily: "var(--font-mono)" }}>{m.value}</div>
                    <div className="text-xs" style={{ color: C.muted }}>{m.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Pipeline columns */}
              <div className="p-4 grid grid-cols-4 gap-2">
                {pipeline.map((col, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-semibold truncate" style={{ color: C.muted }}>
                        {col.label}
                      </span>
                      <span className="text-xs font-bold ml-1" style={{ color: col.color }}>{col.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full mb-3" style={{ background: col.bg }}>
                      <div className="h-full rounded-full transition-all duration-700"
                           style={{ background: col.color, width: `${Math.min(col.count * 5, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Lead list */}
              <div className="px-4 pb-4 space-y-2">
                {leads.map((lead, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-xl border"
                    style={{ borderColor: C.border, background: C.subtle }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                         style={{ background: lead.dot }}>
                      {lead.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: C.text }}>{lead.name}</div>
                      <div className="text-xs truncate" style={{ color: C.muted }}>{lead.status}</div>
                    </div>
                    <div className="text-xs shrink-0" style={{ color: C.muted }}>{lead.time}</div>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: lead.dot }} />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right — copy */}
          <motion.div
            initial={{ opacity: 0, x: 32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
                 style={{ background: "#FFF3EC", color: C.primary }}>
              Built-in CRM + analytics
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              The command center.
              <br />
              <span style={{ color: C.muted, fontWeight: 400 }}>Every lead. Every call. Every dollar.</span>
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>
              Revenue recovered from ad spend. Contact rates. Booking rates. Show rates.
              Every conversation your AI had — logged, searchable, readable.
              Every piece of intel it gathered — system age, issue, address, objections —
              saved automatically to the lead profile.
            </p>

            <div className="space-y-4 mb-8">
              {[
                { icon: <MessageSquare className="w-4 h-4" aria-hidden="true" />, title: "Every conversation logged",
                  body: "Read every SMS thread and call transcript, from first message to booking." },
                { icon: <Shield className="w-4 h-4" aria-hidden="true" />, title: "Pause AI on any lead, instantly",
                  body: "One toggle. The AI stops, you take over. The rest keep running automatically." },
                { icon: <Bell className="w-4 h-4" aria-hidden="true" />, title: "Real-time updates",
                  body: "New leads and messages appear as they happen. No refreshing, no delays." },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                       style={{ background: "#FFF3EC", color: C.primary }}>
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-0.5" style={{ color: C.text }}>{f.title}</div>
                    <div className="text-sm" style={{ color: C.muted }}>{f.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REMINDERS SECTION
// ─────────────────────────────────────────────────────────────────────────────
function RemindersSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const reminders = [
    { icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" />, label: "Booking confirmed", time: "Immediately", color: C.success, bg: "#F0FDF4", desc: "SMS + email the moment they book" },
    { icon: <CalendarCheck className="w-4 h-4" aria-hidden="true" />, label: "2-day reminder",   time: "48 hours before", color: "#2563EB", bg: "#EFF6FF", desc: "SMS + email with date, time, address" },
    { icon: <Bell className="w-4 h-4" aria-hidden="true" />,          label: "1-day reminder",   time: "24 hours before", color: "#D97706", bg: "#FFF7ED", desc: "Final confirmation before the visit" },
    { icon: <Clock className="w-4 h-4" aria-hidden="true" />,          label: "2-hour reminder",  time: "2 hours before",  color: C.primary,  bg: "#FFF3EC", desc: "\"Tech is on his way\" level urgency" },
  ]

  return (
    <section ref={ref} className="relative py-20 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Booked is only halfway there.
          </h2>
          <p className="text-base" style={{ color: C.muted }}>
            Once a lead books, they get a confirmation and three reminders automatically —
            all from your phone number and your email address. No-shows drop. You don&rsquo;t think about reminders again.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {reminders.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-xl p-5 border"
              style={{ background: r.bg, borderColor: `${r.color}30` }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                   style={{ background: C.surface, color: r.color }}>
                {r.icon}
              </div>
              <div className="font-semibold text-sm mb-0.5" style={{ color: C.text }}>{r.label}</div>
              <div className="text-xs mb-2 font-mono" style={{ color: r.color }}>{r.time}</div>
              <div className="text-xs" style={{ color: C.muted }}>{r.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WHAT WE INSTALL — done for you
// ─────────────────────────────────────────────────────────────────────────────
function SetupSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const howItWorks = [
    { num: "1", title: "30-minute kickoff call",
      body: "Tell us your service area, what you offer, and how your best sales rep talks to leads. That's all we need." },
    { num: "2", title: "We build your AI system",
      body: "Custom AI script, follow-up sequences, and CRM configured for your business — not a template copied from someone else." },
    { num: "3", title: "We connect everything",
      body: "Facebook Lead Ads, your local phone number, Google Calendar, Gmail. Takes us one day. You do nothing." },
    { num: "4", title: "Live test → you're live",
      body: "We run a full test with you on the call. You see it work. Then it's live and handling every lead 24/7." },
  ]

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
               style={{ background: "#FFF3EC", color: C.primary }}>
            Done for you
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            We install it. You don&rsquo;t touch it.
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: C.muted }}>
            One kickoff call. We handle everything else. Most clients are live within 48 hours.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* How we install it */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: C.muted }}>How we install it</p>
            <div className="space-y-4">
              {howItWorks.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-start gap-4 p-5 rounded-xl border"
                  style={{ background: C.surface, borderColor: C.border }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                       style={{ background: i === 3 ? C.primary : C.subtle,
                                color: i === 3 ? "#fff" : C.primary }}>
                    {i === 3 ? <Check className="w-4 h-4" aria-hidden="true" /> : s.num}
                  </div>
                  <div>
                    <div className="text-sm font-bold mb-1" style={{ color: C.text }}>{s.title}</div>
                    <div className="text-xs leading-relaxed" style={{ color: C.muted }}>{s.body}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* What's included in the install */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl p-8 border"
            style={{ background: C.surface, borderColor: C.border,
                     boxShadow: "0 8px 32px rgba(249,115,22,0.08)" }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: "#FFF3EC", color: C.primary }}>
                <Check className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>What&rsquo;s included in the install</div>
                <div className="text-xs" style={{ color: C.muted }}>Everything. No a la carte surprises.</div>
              </div>
            </div>
            <div className="space-y-3">
              {INSTALL_INCLUDES.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.success }} aria-hidden="true" />
                  <span className="text-sm leading-snug" style={{ color: C.text }}>{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING SECTION
// ─────────────────────────────────────────────────────────────────────────────
function PricingSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }} id="pricing">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
               style={{ background: "#FFF3EC", color: C.primary }}>
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Less than one missed job. Every month.
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: C.muted }}>
            One $6,000–$15,000 job was slipping through your fingers every week.
            The install pays for itself in the first booking. The monthly fee pays for itself in one or two.
            Every lead after that is money you were already losing.
          </p>
        </motion.div>

        {/* Installation package — full width */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl p-8 border mb-6 relative overflow-hidden"
          style={{ background: C.surface, borderColor: C.border,
                   boxShadow: "0 8px 32px rgba(249,115,22,0.08)" }}
        >
          <div className="absolute -top-3 left-8">
            <span className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: C.primary, color: "#fff" }}>
              One-time install
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-center pt-2">
            <div>
              <div className="text-xl font-bold mb-1" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                System Installation
              </div>
              <div className="text-sm mb-5" style={{ color: C.muted }}>
                We build and install the complete system for your business.
              </div>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-5xl font-black" style={{ color: C.text, fontFamily: "var(--font-mono)" }}>
                  $2,250
                </span>
                <span className="text-sm mb-2" style={{ color: C.muted }}>one-time</span>
              </div>
              <Link href="/signup?new=1"
                    className="inline-flex items-center gap-2 font-semibold text-white px-8 py-3.5 rounded-full transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: C.primary, boxShadow: "0 6px 20px rgba(249,115,22,0.30)" }}>
                Get Your System Installed
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="space-y-2.5">
              {INSTALL_INCLUDES.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.25 + i * 0.06 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.success }} aria-hidden="true" />
                  <span className="text-sm leading-snug" style={{ color: C.text }}>{item}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Monthly + Add-ons — two column */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Core System monthly */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl p-7 border relative overflow-hidden"
            style={{ background: "#1A1614", borderColor: "transparent",
                     boxShadow: "0 16px 48px rgba(249,115,22,0.22)" }}
          >
            {/* Blueprint crosshatch texture */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
                 style={{
                   backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
                   backgroundSize: "44px 44px", opacity: 0.06,
                 }} />
            <div className="absolute -top-3 left-7 relative z-10">
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: C.success, color: "#fff" }}>
                Monthly retainer
              </span>
            </div>
            <div className="pt-2 relative z-10">
              <div className="text-lg font-bold text-white mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
                Core System
              </div>
              <div className="text-sm mb-5" style={{ color: "rgba(250,250,248,0.65)" }}>Everything running, every month.</div>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-5xl font-black text-white" style={{ fontFamily: "var(--font-mono)" }}>
                  $597
                </span>
                <span className="text-sm mb-2" style={{ color: "rgba(250,250,248,0.65)" }}>/month</span>
              </div>
              <div className="space-y-2.5">
                {MONTHLY_INCLUDES.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#F97316" }} aria-hidden="true" />
                    <span className="text-sm" style={{ color: "rgba(250,250,248,0.85)" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Add-ons */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-2xl p-7 border"
            style={{ background: C.surface, borderColor: C.border,
                     boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}
          >
            <div className="text-lg font-bold mb-1" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              Optional add-ons
            </div>
            <div className="text-sm mb-6" style={{ color: C.muted }}>Enhance the system as you grow.</div>
            <div className="space-y-5">
              {ADDONS.map((addon, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.4 + i * 0.09 }}
                  className="pb-5 border-b last:border-0 last:pb-0"
                  style={{ borderColor: C.border }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold" style={{ color: C.text }}>{addon.name}</span>
                    <span className="text-sm font-black" style={{ color: C.primary, fontFamily: "var(--font-mono)" }}>
                      +${addon.price}/mo
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{addon.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="text-center text-sm mt-8" style={{ color: C.muted }}>
          No long-term contracts on the monthly retainer. Cancel with 30 days notice.
        </motion.p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTIMONIALS
// ─────────────────────────────────────────────────────────────────────────────
function TestimonialsSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-24 px-6 overflow-hidden"
             style={{ background: "#1A1614", zIndex: 10 }}>
      {/* Blueprint crosshatch */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
           style={{
             backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
             backgroundSize: "44px 44px", opacity: 0.05,
           }} />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="block w-6 h-px" style={{ background: "#F97316" }} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "#F97316", fontFamily: "var(--font-jetbrains)" }}>
              What contractors say
            </span>
            <span className="block w-6 h-px" style={{ background: "#F97316" }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            Contractors who wake up with jobs on the schedule
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="rounded-2xl p-7 relative"
              style={{ background: "#221D1A", border: "1px solid rgba(255,255,255,0.07)",
                       boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}
            >
              {/* Orange quote mark accent */}
              <div className="text-5xl font-black leading-none mb-3 select-none"
                   style={{ color: "#F97316", opacity: 0.25, fontFamily: "Georgia, serif" }}
                   aria-hidden="true">&ldquo;</div>
              <div className="flex gap-0.5 mb-4 -mt-3">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(250,250,248,0.72)" }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="text-sm font-bold" style={{ color: "#F5F3F0" }}>{t.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(250,250,248,0.40)" }}>{t.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────
function FinalCTASection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="rounded-3xl px-8 py-16 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1A1614 0%, #0F0E0D 100%)",
                   boxShadow: "0 32px 80px rgba(249,115,22,0.20)", border: "1px solid rgba(249,115,22,0.15)" }}
        >
          {/* Decorative background elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div style={{ position: "absolute", top: "-20%", right: "-10%",
                          width: 400, height: 400, borderRadius: "50%",
                          background: "rgba(255,255,255,0.05)", filter: "blur(60px)" }} />
            <div style={{ position: "absolute", bottom: "-20%", left: "-10%",
                          width: 300, height: 300, borderRadius: "50%",
                          background: "rgba(255,255,255,0.04)", filter: "blur(60px)" }} />
            <div className="absolute inset-0 opacity-10"
                 style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
                          backgroundSize: "24px 24px" }} />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
                 style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"
                    style={{ animation: "callPulse 2s ease-in-out infinite" }} />
              Installation call · done for you · live in 48 hours
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 text-balance"
                style={{ fontFamily: "var(--font-jakarta)" }}>
              Wake up with jobs on the schedule.
              <br />
              Every morning.
            </h2>

            <p className="text-lg mb-10 max-w-xl mx-auto"
               style={{ color: "rgba(250,250,248,0.70)" }}>
              Your AI call center, appointment setter, and dispatcher — installed and running 24/7.
              Every Facebook lead texted in 3.7 seconds. Every tech dispatched automatically.
              You find out in a push notification. You just show up.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup?new=1"
                    className="inline-flex items-center justify-center gap-2 font-semibold text-base px-8 py-4 rounded-full transition-all duration-200 hover:-translate-y-1"
                    style={{ background: "#fff", color: C.primary,
                             boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
                Get Your System Installed
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a href="#demo"
                 className="inline-flex items-center justify-center gap-2 font-medium text-base px-8 py-4 rounded-full border transition-all duration-200 hover:bg-white/10"
                 style={{ color: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.3)" }}>
                <Play className="w-4 h-4" aria-hidden="true" />
                Watch It Work
              </a>
            </div>

            <p className="mt-6 text-sm" style={{ color: "rgba(250,250,248,0.45)" }}>
              Custom script built for your business · Installation call included · Live in 48 hours
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="relative max-w-7xl mx-auto px-8 py-10 border-t" style={{ zIndex: 10, borderColor: C.border }}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#1A1614] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#fff" />
              <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#fff" />
              <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
              <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
            </svg>
          </div>
          <span className="font-extrabold" style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            FIELDBUILT
            <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
                  style={{ fontSize: "0.42em", background: "#F97316", padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}>
              AI
            </span>
          </span>
          <span className="text-sm" style={{ color: C.muted }}>— AI operations installed for home service companies</span>
        </div>

        <div className="flex items-center gap-6 text-sm" style={{ color: C.muted }}>
          {["Privacy", "Terms", "Support"].map(l => (
            <a key={l} href="#" className="hover:text-[#F97316] transition-colors">{l}</a>
          ))}
        </div>

        <p className="text-xs" style={{ color: C.muted }}>
          © {new Date().getFullYear()} FieldBuilt AI. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <main className="relative min-h-screen" style={{ background: C.bg }}>
      <Background />
      <Nav />
      <HeroSection />
      <AIOfficeSection />
      <ProblemSection />
      <HowItWorksSection />
      <FollowUpSection />
      <CRMSection />
      <TestimonialsSection />
      <SmartDispatchSection />
      <SetupSection />
      <PricingSection />
      <FinalCTASection />
      <Footer />
    </main>
  )
}
