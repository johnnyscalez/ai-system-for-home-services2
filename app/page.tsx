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
          <div className="w-8 h-8 rounded-lg bg-[#1A1614] flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#fff" />
              <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#fff" />
              <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
              <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
            </svg>
          </div>
          <span className="font-extrabold text-xl tracking-tight" style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
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
    <section className="relative min-h-screen flex flex-col justify-center pt-28 pb-16 px-6 overflow-hidden" style={{ zIndex: 10 }}>
      {/* HVAC atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-16 left-8 opacity-10" style={{ color: C.primary }}>
          <HvacCondenserFan size={160} spin={12} />
        </div>
        <div className="absolute bottom-24 right-8 opacity-8" style={{ color: C.muted }}>
          <HvacThermostat size={110} />
        </div>
        <AirflowParticles count={10} color="#F97316" />
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
              style={{ background: "#FFF3EC", borderColor: "rgba(249,115,22,0.2)", color: C.primary }}
            >
              <span className="w-2 h-2 rounded-full bg-green-500" style={{ animation: "callPulse 2s ease-in-out infinite" }} />
              AI call center · appointment setter · dispatcher · 200+ HVAC companies
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6 text-balance"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}
            >
              Wake up with jobs
              {" "}
              <span className="relative inline-block" style={{ color: C.primary }}>
                on the schedule.
                <span className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
                      style={{ background: `linear-gradient(90deg, ${C.primary}, #EA580C)`,
                               transformOrigin: "left", animation: "underlineDraw 0.8s ease forwards 1.2s",
                               transform: "scaleX(0)" }} />
              </span>
              <br />
              <span style={{ color: C.success }}>Your AI worked</span>{" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>while you slept.</span>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-lg leading-relaxed mb-8 max-w-lg"
              style={{ color: C.muted }}
            >
              You can&rsquo;t afford a call center. FieldBuilt AI gives you one — plus an appointment setter
              and dispatcher that runs 24/7. Every Facebook lead gets texted in 3.7 seconds, qualified,
              and booked. Your techs get dispatched to the right jobs automatically.
              You just show up.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 mb-6"
            >
              <Link href="/signup?new=1"
                    className="inline-flex items-center justify-center gap-2 font-semibold text-white px-7 py-4 rounded-full transition-all duration-200 hover:-translate-y-1"
                    style={{ background: C.primary, boxShadow: "0 8px 24px rgba(249,115,22,0.35)" }}>
                Get Your System Installed
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a href="#demo"
                 className="inline-flex items-center justify-center gap-2 font-medium px-7 py-4 rounded-full border transition-all duration-200 hover:border-[#F97316] hover:text-[#F97316]"
                 style={{ borderColor: C.border, background: C.surface, color: C.text }}>
                <Play className="w-4 h-4" aria-hidden="true" />
                Watch It Work
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
              className="text-sm" style={{ color: C.muted }}>
              Installation call included · Done for you · Live in 48 hours
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
                 style={{ boxShadow: "0 24px 64px rgba(249,115,22,0.15), 0 4px 16px rgba(0,0,0,0.08)" }}>
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
    { value: "3.7",  unit: "sec",  label: "First contact — day or night",         mono: true },
    { value: "94",  unit: "%",    label: "Contact rate vs. 11% industry average", mono: true },
    { value: "3–5", unit: "×",    label: "Average ROI on ad spend in 60 days",   mono: true },
    { value: "24/7", unit: "",    label: "Your AI call center never clocks out",  mono: true },
  ]

  return (
    <section ref={ref} className="relative" style={{ zIndex: 10 }}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-0 rounded-2xl overflow-hidden border"
          style={{ background: C.surface, borderColor: C.border,
                   boxShadow: "0 4px 24px rgba(249,115,22,0.06)" }}
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
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
               style={{ background: "#FFF3EC", color: C.primary }}>
            Your AI office — working 24/7
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Three AI employees.
            <br />
            <span style={{ color: C.primary }}>Zero payroll.</span>{" "}
            <span style={{ color: C.muted, fontWeight: 400 }}>On duty around the clock.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: C.muted }}>
            An AI receptionist contacts every lead in 3.7 seconds. An AI appointment setter
            qualifies them and books the estimate. An AI dispatcher routes each tech to the right job.
            Every conversation logged. Every dispatch tracked. You get notified. You just show up.
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
// HOW IT WORKS — 3 steps
// ─────────────────────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const steps = [
    {
      num: "01",
      icon: <MessageSquare className="w-6 h-6" aria-hidden="true" />,
      title: "AI receptionist — texts every lead in 3.7 seconds",
      body: "The moment a form hits — at 9pm, 2am, Saturday morning — your AI receptionist reaches out with a trade-specific opener. Not a generic 'we got your message.' A real conversation, before your competitor blinks.",
      color: C.primary,
      bg: "#FFF3EC",
    },
    {
      num: "02",
      icon: <PhoneCall className="w-6 h-6" aria-hidden="true" />,
      title: "AI appointment setter — qualifies and books",
      body: "Asks what's wrong, handles every objection ('just getting prices,' 'already have someone coming'), collects the address, and books the appointment. Your tech is going. You didn't say a word.",
      color: "#0EA5E9",
      bg: "#F0F9FF",
    },
    {
      num: "03",
      icon: <Bell className="w-6 h-6" aria-hidden="true" />,
      title: "AI dispatcher — routes the right tech",
      body: "Job booked. AI dispatcher assigns it to the closest available tech with the right specialty. Tech gets an SMS with the address and issue. You get a push notification. You show up. That's your whole job.",
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
               style={{ background: "#FFF3EC", color: C.primary }}>
            Your AI team — on duty 24/7
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Three AI employees handle your leads.
            <br />
            <span style={{ color: C.muted, fontWeight: 400 }}>You just show up to the job.</span>
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
    <section ref={ref} className="relative py-24 px-6" style={{ zIndex: 10 }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            HVAC owners who wake up with jobs on the schedule
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
                       boxShadow: "0 4px 20px rgba(249,115,22,0.06)" }}
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
      <StatStrip />
      <SystemOverviewSection />
      <ProblemSection />
      <HowItWorksSection />
      <DemoSection />
      <FollowUpSection />
      <SmartDispatchSection />
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
