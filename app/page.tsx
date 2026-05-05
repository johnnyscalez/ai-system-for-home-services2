"use client"

import { motion, useInView, AnimatePresence } from "framer-motion"
import { useRef, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Zap, ArrowRight, Check, MessageSquare,
  Clock, Play, Star, Menu, X,
  CheckCircle2, Phone, Shield, Mic,
  CalendarCheck, Bell, PhoneCall,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#FAFAF8",
  surface:     "#FFFFFF",
  primary:     "#7C3AED",
  primaryDark: "#6D28D9",
  success:     "#4D7C0F",
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
  { role: "ai",   text: "Is it running at all, or completely off?" },
  { role: "lead", text: "Runs but blows warm air" },
  { role: "ai",   text: "Usually refrigerant or airflow — hard to say without a look. How old is the unit?" },
  { role: "lead", text: "Around 12 years" },
  { role: "ai",   text: "At 12 years it's worth looking at both options. All part of the free estimate. Thursday morning or Friday afternoon work?" },
  { role: "lead", text: "Thursday morning" },
  { role: "ai",   text: "What address should the tech come to?" },
  { role: "lead", text: "2241 Ridgeline Dr, Frisco TX" },
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
    quote: "We were losing leads left and right — nobody was following up fast enough. First week with LeadCloser, we booked 9 appointments off Facebook. Before, we were getting maybe 2 or 3.",
    name:  "Dave K.",
    role:  "Owner, ProTemp HVAC — Dallas, TX",
    stars: 5,
  },
  {
    quote: "I was skeptical about AI calling my leads. Then it booked an $8,400 replacement job on a follow-up call while I was on a roof. That closed me.",
    name:  "James M.",
    role:  "Owner, Arctic Air Services — Phoenix, AZ",
    stars: 5,
  },
  {
    quote: "Setup took me 20 minutes. I haven't manually followed up with a Facebook lead since. The CRM shows every conversation and the AI handles all of it.",
    name:  "Carlos R.",
    role:  "Owner, Premier Comfort — Miami, FL",
    stars: 5,
  },
]

const PLANS = [
  {
    name:      "Starter",
    price:     297,
    desc:      "For companies getting started with Facebook lead ads.",
    features:  ["100 leads/month", "AI SMS follow-up", "2-week auto sequences", "Built-in CRM", "Appointment reminders", "1 Facebook account", "Local area code number"],
    cta:       "Start Free Trial",
    highlight: false,
    badge:     null as string | null,
  },
  {
    name:      "Growth",
    price:     497,
    desc:      "For companies running consistent ad spend and growing fast.",
    features:  ["300 leads/month", "AI SMS + voice calls", "Custom AI script", "3 Facebook accounts", "3 team members", "Google Calendar sync", "Gmail for appointment emails"],
    cta:       "Start Free Trial",
    highlight: true,
    badge:     "Most Popular" as string | null,
  },
  {
    name:      "Scale",
    price:     997,
    desc:      "For multi-location operators and high-volume advertisers.",
    features:  ["Unlimited leads", "Unlimited users", "White-label option", "Multiple locations", "Priority support", "Custom setup call"],
    cta:       "Talk to Us",
    highlight: false,
    badge:     null as string | null,
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
        @keyframes airflowDrift {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -400; }
        }
        @keyframes particleDrift {
          0%   { transform: translateX(0px); opacity: 0; }
          5%   { opacity: 0.85; }
          92%  { opacity: 0.8; }
          100% { transform: translateX(1900px); opacity: 0; }
        }
        @keyframes hvSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes hvFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes hvDrift {
          0%, 100% { transform: translate(0, 0); }
          50%       { transform: translate(20px, -15px); }
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

      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-5%", right: "-5%",
          width: 500, height: 500, borderRadius: "50%",
          background: "#7C3AED", filter: "blur(100px)",
          animation: "orbPulse 5s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-5%", left: "-5%",
          width: 380, height: 380, borderRadius: "50%",
          background: "#4D7C0F", filter: "blur(80px)", opacity: 0.13,
          animation: "orbPulse2 5s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "20%",
          width: 200, height: 200, borderRadius: "50%",
          background: "#D97706", filter: "blur(60px)", opacity: 0.06,
          animation: "orbDrift 9s ease-in-out infinite",
        }} />
      </div>

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          backgroundImage: "radial-gradient(circle, #D4D0CC 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.5,
        }}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HVAC DECORATIVE SVGs
// ─────────────────────────────────────────────────────────────────────────────
function HvacCondenserFan({ size = 120, spin = 8 }: { size?: number; spin?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect x="6" y="6" width="108" height="108" rx="10" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
      <rect x="14" y="14" width="92" height="92" rx="6" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
      <circle cx="60" cy="60" r="40" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
      <circle cx="60" cy="60" r="32" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
      <circle cx="60" cy="60" r="24" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
      <circle cx="60" cy="60" r="16" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
      <g style={{ transformOrigin: "60px 60px", animation: `hvSpin ${spin}s linear infinite` }}>
        <path d="M60 60 C 60 35, 50 28, 38 30 C 48 38, 55 48, 60 60 Z" fill="currentColor" opacity="0.18" />
        <path d="M60 60 C 85 60, 92 50, 90 38 C 82 48, 72 55, 60 60 Z" fill="currentColor" opacity="0.18" />
        <path d="M60 60 C 60 85, 70 92, 82 90 C 72 82, 65 72, 60 60 Z" fill="currentColor" opacity="0.18" />
        <path d="M60 60 C 35 60, 28 70, 30 82 C 38 72, 48 65, 60 60 Z" fill="currentColor" opacity="0.18" />
        <circle cx="60" cy="60" r="6" fill="currentColor" opacity="0.5" />
      </g>
    </svg>
  )
}

function HvacVent({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 120 72" fill="none">
      <rect x="2" y="2" width="116" height="68" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1="10" y1={12 + i * 8} x2="110" y2={12 + i * 8}
              stroke="currentColor" strokeWidth="0.9" opacity="0.32" />
      ))}
    </svg>
  )
}

function HvacThermostat({ size = 100 }: { size?: number }) {
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2
    const x1 = 50 + Math.cos(a) * 36, y1 = 50 + Math.sin(a) * 36
    const x2 = 50 + Math.cos(a) * (i % 6 === 0 ? 30 : 33)
    const y2 = 50 + Math.sin(a) * (i % 6 === 0 ? 30 : 33)
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
  })
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
      <circle cx="50" cy="50" r="36" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      {ticks}
      <text x="50" y="56" textAnchor="middle" fontSize="18"
            fontFamily="'JetBrains Mono', monospace" fontWeight="600"
            fill="currentColor" opacity="0.55">72°</text>
    </svg>
  )
}

function AirflowParticles({ count = 14, color = "#60A5FA" }: { count?: number; color?: string }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    top: (i * 7.14) % 100,
    duration: 14 + (i * 1.37) % 10,
    delay: -((i * 1.9) % 22),
    size: 2 + (i * 0.71) % 3,
    opacity: 0.2 + (i * 0.043) % 0.35,
  }))
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <span key={p.id} className="absolute rounded-full" style={{
          top: `${p.top}%`, left: -20,
          width: p.size, height: p.size,
          background: color, opacity: p.opacity,
          boxShadow: `0 0 ${p.size * 3}px ${color}`,
          animation: `particleDrift ${p.duration}s linear infinite`,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
    </div>
  )
}

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
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.primary }}>
            <Zap className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            LeadCloser
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.label} href={l.href} className="text-sm transition-colors duration-200 hover:text-purple-600"
               style={{ color: C.muted }}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-200 hover:bg-gray-100"
                style={{ color: C.muted }}>
            Log in
          </Link>
          <Link href="/signup"
                className="text-sm font-semibold text-white px-5 py-2.5 rounded-full transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: C.primary, boxShadow: "0 4px 14px rgba(124,58,237,0.40)" }}>
            Start Free Trial
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
          <Link href="/signup" className="block w-full text-center text-sm font-semibold text-white py-3 rounded-full mt-2"
                style={{ background: C.primary }}>
            Start Free Trial
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

  return (
    <div className="flex flex-col rounded-xl overflow-hidden"
         style={{ background: C.surface, height: 420, border: `1px solid ${C.border}`,
                  boxShadow: "0 8px 32px rgba(124,58,237,0.10)" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: C.border }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
             style={{ background: C.primary }}>LC</div>
        <div>
          <div className="text-xs font-semibold" style={{ color: C.text }}>LeadCloser AI</div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs" style={{ color: C.muted }}>Responding in seconds</span>
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
    <section className="relative min-h-screen flex flex-col justify-center pt-28 pb-16 px-6 overflow-hidden" style={{ zIndex: 10 }}>
      {/* HVAC atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-16 left-8 opacity-10" style={{ color: C.primary }}>
          <HvacCondenserFan size={160} spin={12} />
        </div>
        <div className="absolute bottom-24 right-8 opacity-8" style={{ color: C.muted }}>
          <HvacThermostat size={110} />
        </div>
        <AirflowParticles count={10} color="#7C3AED" />
      </div>

      <div className="relative max-w-7xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* LEFT — Copy */}
          <div>
            {/* Social proof badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border mb-6"
              style={{ background: "#F5F3FF", borderColor: "rgba(124,58,237,0.2)", color: C.primary }}
            >
              <span className="w-2 h-2 rounded-full bg-green-500" style={{ animation: "callPulse 2s ease-in-out infinite" }} />
              207 HVAC companies · 14,000+ appointments booked
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6 text-balance"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}
            >
              Your HVAC leads go cold
              {" "}
              <span className="relative inline-block" style={{ color: C.primary }}>
                in minutes.
                <span className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
                      style={{ background: `linear-gradient(90deg, ${C.primary}, #8B5CF6)`,
                               transformOrigin: "left", animation: "underlineDraw 0.8s ease forwards 1.2s",
                               transform: "scaleX(0)" }} />
              </span>
              <br />
              <span style={{ color: C.success }}>LeadCloser texts them</span>{" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>in seconds.</span>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-lg leading-relaxed mb-8 max-w-lg"
              style={{ color: C.muted }}
            >
              The moment a lead fills out your Facebook form, your AI starts the conversation —
              qualifying them, handling every objection, and booking the estimate appointment.
              Nothing on your team has to touch it.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 mb-6"
            >
              <Link href="/signup"
                    className="inline-flex items-center justify-center gap-2 font-semibold text-white px-7 py-4 rounded-full transition-all duration-200 hover:-translate-y-1"
                    style={{ background: C.primary, boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}>
                Start Booking More Jobs
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a href="#demo"
                 className="inline-flex items-center justify-center gap-2 font-medium px-7 py-4 rounded-full border transition-all duration-200 hover:border-purple-300 hover:text-purple-600"
                 style={{ borderColor: C.border, background: C.surface, color: C.text }}>
                <Play className="w-4 h-4" aria-hidden="true" />
                Watch It Work
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
              className="text-sm" style={{ color: C.muted }}>
              No credit card required · Setup in under 10 minutes
            </motion.p>
          </div>

          {/* RIGHT — Live chat demo */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Browser chrome */}
            <div className="rounded-2xl overflow-hidden"
                 style={{ boxShadow: "0 24px 64px rgba(124,58,237,0.15), 0 4px 16px rgba(0,0,0,0.08)" }}>
              <div className="flex items-center gap-1.5 px-4 py-3 border-b"
                   style={{ background: "#F8F7F5", borderColor: C.border }}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <div className="flex-1 mx-4 h-5 rounded-md px-2 flex items-center"
                     style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <span className="text-xs" style={{ color: C.muted }}>AI conversation · Mike Johnson</span>
                </div>
              </div>
              <LiveConversation />
            </div>

            {/* Floating notification */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1.4, duration: 0.5 }}
              className="absolute -right-4 top-6 px-3 py-2 rounded-xl text-xs font-medium shadow-lg"
              style={{ background: C.surface, border: `1px solid ${C.border}`,
                       boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
              <div className="flex items-center gap-1.5">
                <Bell className="w-3 h-3" style={{ color: C.success }} aria-hidden="true" />
                <span style={{ color: C.text }}>Appt booked — Thu 9am</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1.6, duration: 0.5 }}
              className="absolute -left-4 bottom-16 px-3 py-2 rounded-xl text-xs font-medium shadow-lg"
              style={{ background: C.surface, border: `1px solid ${C.border}`,
                       boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" style={{ color: C.primary }} aria-hidden="true" />
                <span style={{ color: C.text }}>Response time: 14 seconds</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT STRIP
// ─────────────────────────────────────────────────────────────────────────────
function StatStrip() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  const stats = [
    { value: "60",   unit: "sec",  label: "Time to first contact", mono: true },
    { value: "94",   unit: "%",    label: "Lead contact rate",      mono: true },
    { value: "14",   unit: "days", label: "Follow-up runs automatically", mono: true },
    { value: "$0",   unit: "",     label: "Per automated follow-up", mono: true },
  ]

  return (
    <section ref={ref} className="relative" style={{ zIndex: 10 }}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-0 rounded-2xl overflow-hidden border"
          style={{ background: C.surface, borderColor: C.border,
                   boxShadow: "0 4px 24px rgba(124,58,237,0.06)" }}
        >
          {stats.map((s, i) => (
            <div key={i} className={`px-6 py-6 ${i < 3 ? "border-r border-b md:border-b-0" : "border-b md:border-b-0"}`}
                 style={{ borderColor: C.border }}>
              <div className="text-3xl font-black mb-1"
                   style={{ color: C.primary, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                {s.value}<span className="text-lg font-bold" style={{ color: C.muted }}>{s.unit}</span>
              </div>
              <div className="text-xs" style={{ color: C.muted }}>{s.label}</div>
            </div>
          ))}
        </motion.div>
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
    { time: "2:04 PM", text: "Mike submits your Facebook form", bad: false },
    { time: "2:09 PM", text: "Mike submits 2 competitor forms", bad: true },
    { time: "4:38 PM", text: "You see the email, call the number", bad: false },
    { time: "4:39 PM", text: "Voicemail. You leave a message.", bad: true },
    { time: "Next day", text: "Mike already booked someone else.", bad: true },
  ]

  const withSteps = [
    { time: "2:04 PM", text: "Mike submits your Facebook form", good: false },
    { time: "2:04 PM", text: "\"Hey Mike, saw you reached out about your AC...\"", good: true },
    { time: "2:09 PM", text: "Mike replies. AI qualifies him.", good: true },
    { time: "2:19 PM", text: "Appointment booked. $8,200 job on your calendar.", good: true },
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
            The $80 problem
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            You paid for that lead.<br />Someone else is getting the job.
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: C.muted }}>
            Speed-to-contact is the whole game in HVAC lead gen.
            A homeowner whose AC stops working calls whoever texts first.
            If you don't respond in minutes, you've already lost.
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
              <span className="font-bold text-sm text-red-700">Without LeadCloser</span>
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
                $80–$150 ad spend. $0 return. Lead is gone.
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
              <span className="font-bold text-sm text-green-700">With LeadCloser</span>
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
                $80 ad spend. Job booked. Tech goes Tuesday.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS — 3 steps
// ─────────────────────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const steps = [
    {
      num: "01",
      icon: <MessageSquare className="w-6 h-6" aria-hidden="true" />,
      title: "Lead submits your Facebook form",
      body: "Your AI gets the notification in seconds — no delay, no waiting for someone to check email. While you're on a job, your AI is already handling it.",
      color: C.primary,
      bg: "#F5F3FF",
    },
    {
      num: "02",
      icon: <PhoneCall className="w-6 h-6" aria-hidden="true" />,
      title: "AI texts them and books the appointment",
      body: "Asks what's wrong, how old the system is, whether they own the home. Handles every objection. Collects the address. Offers two appointment times. Books it.",
      color: "#0EA5E9",
      bg: "#F0F9FF",
    },
    {
      num: "03",
      icon: <Bell className="w-6 h-6" aria-hidden="true" />,
      title: "You get the booking notification",
      body: "A text to your phone: \"Appointment booked — Mike J., Thursday 9am, 2241 Ridgeline Dr, Frisco.\" You show up. That's your whole job.",
      color: C.success,
      bg: "#F0FDF4",
    },
  ]

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }} id="how-it-works">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
               style={{ background: "#F5F3FF", color: C.primary }}>
            How it works
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Three things happen when a lead comes in.
            <br />
            <span style={{ color: C.muted, fontWeight: 400 }}>You&rsquo;re only responsible for the third.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="rounded-2xl p-7 border relative"
              style={{ background: C.surface, borderColor: C.border,
                       boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                     style={{ background: s.bg, color: s.color }}>
                  {s.icon}
                </div>
                <span className="text-4xl font-black opacity-10"
                      style={{ color: s.color, fontFamily: "var(--font-mono)" }}>{s.num}</span>
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{s.body}</p>
            </motion.div>
          ))}
        </div>
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
                 style={{ boxShadow: "0 20px 60px rgba(124,58,237,0.12)" }}>
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
                 style={{ background: "#F5F3FF", color: C.primary }}>
              HVAC qualification in real time
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              The AI knows HVAC. Not just texting — qualifying.
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>
              LeadCloser doesn&rsquo;t send a generic "We got your request" message. It opens
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
               style={{ background: "#F5F3FF", color: C.primary }}>
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
                       style={{ background: s.type === "voice" ? "#F5F3FF" : "#F0F9FF",
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
                          style={{ background: s.type === "voice" ? "#F5F3FF" : "#F0F9FF",
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
                 style={{ background: "#F5F3FF", borderColor: "rgba(124,58,237,0.2)" }}>
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
                 style={{ background: "#F5F3FF", color: C.primary }}>
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
                          t.who === "ai" ? "bg-gray-700 text-gray-100" : "bg-purple-600 text-white"
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
                   style={{ background: "#F5F3FF", color: C.primary }}>
                <Shield className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight mb-3"
                  style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                Your AI knows where the line is.
              </h2>
              <p className="text-base leading-relaxed" style={{ color: C.muted }}>
                LeadCloser never goes rogue. It has hard rules baked in — the same ones
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
    { label: "Just Came In",       count: 12, color: C.primary,  bg: "#F5F3FF" },
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
                          boxShadow: "0 20px 60px rgba(124,58,237,0.10)" }}>
              {/* CRM header */}
              <div className="flex items-center justify-between px-5 py-4 border-b"
                   style={{ borderColor: C.border, background: "#FAFAF8" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: C.primary }} />
                  <span className="text-sm font-semibold" style={{ color: C.text }}>LeadCloser CRM</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#F0FDF4", color: C.success }}>Live</span>
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
                 style={{ background: "#F5F3FF", color: C.primary }}>
              Built-in CRM
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              See everything. Touch nothing.
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>
              Every lead flows through a visual pipeline from the moment they arrive to
              the day they book. Every SMS and every call is logged. Everything the AI
              learned — what&rsquo;s wrong, system age, address, objections — is saved to the
              lead profile automatically.
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
                       style={{ background: "#F5F3FF", color: C.primary }}>
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
    { icon: <Clock className="w-4 h-4" aria-hidden="true" />,          label: "2-hour reminder",  time: "2 hours before",  color: C.primary,  bg: "#F5F3FF", desc: "\"Tech is on his way\" level urgency" },
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
// SETUP SECTION — under 10 minutes
// ─────────────────────────────────────────────────────────────────────────────
function SetupSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const steps = [
    { num: "1", title: "Paste your website URL",
      body: "The AI reads your site and pulls your services, service area, certifications, and best reviews automatically." },
    { num: "2", title: "Add any extra facts",
      body: "One-click chips: \"We offer 0% financing,\" \"Emergency same-day service,\" \"Spanish-speaking techs.\" Done in 30 seconds." },
    { num: "3", title: "Connect your Facebook ads",
      body: "OAuth in two clicks. Select which forms to pull leads from. Disconnects cleanly if you ever want to stop." },
    { num: "4", title: "Connect Gmail",
      body: "Appointment emails send from your actual email address. Not noreply@someapp.com — from you." },
    { num: "5", title: "Get your local phone number",
      body: "A real number provisioned in your area code. Leads see a familiar local number, not an 800 number." },
    { num: "6", title: "Your AI is live",
      body: "The next lead that fills out your form gets a text within seconds. Most contractors are live before their next lead comes in." },
  ]

  return (
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
               style={{ background: "#F5F3FF", color: C.primary }}>
            Setup
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Live in under 10 minutes.
          </h2>
          <p className="text-lg" style={{ color: C.muted }}>
            No developer needed. No IT department. Just you and a browser.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.09 }}
              className="flex items-start gap-4 p-5 rounded-xl border"
              style={{ background: C.surface, borderColor: C.border }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                   style={{ background: i === 5 ? C.primary : C.subtle,
                            color: i === 5 ? "#fff" : C.primary }}>
                {i === 5 ? <Check className="w-4 h-4" aria-hidden="true" /> : s.num}
              </div>
              <div>
                <div className="text-sm font-bold mb-1" style={{ color: C.text }}>{s.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: C.muted }}>{s.body}</div>
              </div>
            </motion.div>
          ))}
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
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
               style={{ background: "#F5F3FF", color: C.primary }}>
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            One booked job covers the monthly cost.
          </h2>
          <p className="text-lg" style={{ color: C.muted }}>
            A single HVAC replacement job pays for months of LeadCloser.
            The leads you&rsquo;re currently losing pay for nothing.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="rounded-2xl p-8 border relative"
              style={{
                background:   plan.highlight ? C.primary : C.surface,
                borderColor:  plan.highlight ? "transparent" : C.border,
                color:        plan.highlight ? "#fff" : C.text,
                boxShadow:    plan.highlight
                  ? "0 20px 60px rgba(124,58,237,0.30)"
                  : "0 4px 20px rgba(0,0,0,0.04)",
              }}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full"
                     style={{ background: C.success, color: "#fff" }}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-1 font-bold text-lg" style={{ fontFamily: "var(--font-jakarta)" }}>
                {plan.name}
              </div>
              <div className="text-sm mb-5 opacity-70">{plan.desc}</div>

              <div className="flex items-end gap-1 mb-6">
                <span className="text-5xl font-black" style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                  ${plan.price}
                </span>
                <span className="text-sm opacity-60 mb-2">/month</span>
              </div>

              <div className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden="true" />
                    <span className="text-sm opacity-90">{f}</span>
                  </div>
                ))}
              </div>

              <Link href="/signup"
                    className="block w-full text-center font-semibold py-3 rounded-full transition-all duration-200"
                    style={{
                      background:   plan.highlight ? "#fff" : C.primary,
                      color:        plan.highlight ? C.primary : "#fff",
                      boxShadow:    plan.highlight ? "none" : "0 4px 14px rgba(124,58,237,0.30)",
                    }}>
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="text-center text-sm mt-8" style={{ color: C.muted }}>
          Overage: $0.05/SMS beyond your plan limit. No long-term contracts. Cancel anytime.
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
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            HVAC owners who stopped losing leads
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="rounded-2xl p-6 border"
              style={{ background: C.surface, borderColor: C.border,
                       boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-5" style={{ color: C.text }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>{t.name}</div>
                <div className="text-xs" style={{ color: C.muted }}>{t.role}</div>
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
          style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #6D28D9 100%)`,
                   boxShadow: "0 32px 80px rgba(124,58,237,0.35)" }}
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
              Start free — no credit card required
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 text-balance"
                style={{ fontFamily: "var(--font-jakarta)" }}>
              Stop losing the leads you already paid for.
            </h2>

            <p className="text-lg mb-10 max-w-xl mx-auto"
               style={{ color: "rgba(216,180,254,0.85)" }}>
              Setup takes 10 minutes. The next lead that fills out your form gets texted in seconds.
              Your only job after that is showing up to the estimate.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup"
                    className="inline-flex items-center justify-center gap-2 font-semibold text-base px-8 py-4 rounded-full transition-all duration-200 hover:-translate-y-1"
                    style={{ background: "#fff", color: C.primary,
                             boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
                Start Booking More Jobs
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a href="#demo"
                 className="inline-flex items-center justify-center gap-2 font-medium text-base px-8 py-4 rounded-full border transition-all duration-200 hover:bg-white/10"
                 style={{ color: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.3)" }}>
                <Play className="w-4 h-4" aria-hidden="true" />
                Watch It Work
              </a>
            </div>

            <p className="mt-6 text-sm" style={{ color: "rgba(216,180,254,0.7)" }}>
              No credit card · Setup in under 10 minutes · Cancel anytime
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
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.primary }}>
            <Zap className="w-3.5 h-3.5 text-white" aria-hidden="true" />
          </div>
          <span className="font-bold" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>LeadCloser</span>
          <span className="text-sm" style={{ color: C.muted }}>— AI lead follow-up for HVAC contractors</span>
        </div>

        <div className="flex items-center gap-6 text-sm" style={{ color: C.muted }}>
          {["Privacy", "Terms", "Support"].map(l => (
            <a key={l} href="#" className="hover:text-purple-600 transition-colors">{l}</a>
          ))}
        </div>

        <p className="text-xs" style={{ color: C.muted }}>
          © {new Date().getFullYear()} LeadCloser. All rights reserved.
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
      <StatStrip />
      <ProblemSection />
      <HowItWorksSection />
      <DemoSection />
      <FollowUpSection />
      <VoiceCallSection />
      <GuardrailsSection />
      <CRMSection />
      <RemindersSection />
      <SetupSection />
      <PricingSection />
      <TestimonialsSection />
      <FinalCTASection />
      <Footer />
    </main>
  )
}
