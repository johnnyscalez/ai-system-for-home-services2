"use client"

import { motion, useInView, AnimatePresence } from "framer-motion"
import { useRef, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Zap, ArrowRight, Check, MessageSquare,
  ChevronRight, TrendingUp, Clock, Play, Star, Menu, X,
  CheckCircle2, Phone,
  Users, CalendarCheck, Bell, Mic, Bot, Route
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  primary: "#7C3AED",
  primaryDark: "#6D28D9",
  success: "#4D7C0F",
  text: "#1C1917",
  muted: "#78716C",
  border: "#E7E5E4",
  subtle: "#F5F4F2",
} as const

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND — animated dot grid
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
      `}</style>

      {/* Orbs — fixed, behind everything */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {/* Orb 1 — purple, top-right */}
        <div style={{
          position: "absolute", top: "-5%", right: "-5%",
          width: 500, height: 500, borderRadius: "50%",
          background: "#7C3AED",
          filter: "blur(100px)",
          animation: "orbPulse 5s ease-in-out infinite",
        }} />
        {/* Orb 2 — olive green, bottom-left */}
        <div style={{
          position: "absolute", bottom: "-5%", left: "-5%",
          width: 380, height: 380, borderRadius: "50%",
          background: "#4D7C0F",
          filter: "blur(80px)",
          opacity: 0.13,
          animation: "orbPulse2 5s ease-in-out infinite",
        }} />
        {/* Orb 3 — amber, center-right */}
        <div style={{
          position: "absolute", top: "40%", right: "20%",
          width: 200, height: 200, borderRadius: "50%",
          background: "#D97706",
          filter: "blur(60px)",
          opacity: 0.06,
          animation: "orbDrift 9s ease-in-out infinite",
        }} />
      </div>

      {/* Dot grid — fixed, static (no transform to avoid iOS Safari scroll bug) */}
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
// HVAC ATMOSPHERE — line-art SVGs, airflow streams, thermal wash, blueprint grid
// Sits as a decorative layer behind hero content, all pointer-events-none
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

function HvacDuctElbow({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" fill="none">
      <path d="M10 30 L70 30 Q110 30 110 70 L110 130" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M10 50 L70 50 Q90 50 90 70 L90 130" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <line x1="14" y1="26" x2="14" y2="54" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="20" y1="26" x2="20" y2="54" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="26" y1="26" x2="26" y2="54" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="86" y1="124" x2="114" y2="124" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="86" y1="118" x2="114" y2="118" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="86" y1="112" x2="114" y2="112" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
    </svg>
  )
}

function HvacThermostat({ size = 100 }: { size?: number }) {
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2
    const x1 = 50 + Math.cos(a) * 36
    const y1 = 50 + Math.sin(a) * 36
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

function HvacCoilPipe({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 200 100" fill="none">
      <path d="M5 50 Q 20 10 35 50 T 65 50 T 95 50 T 125 50 T 155 50 T 185 50 L 195 50"
            stroke="currentColor" strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
      <path d="M5 60 Q 20 20 35 60 T 65 60 T 95 60 T 125 60 T 155 60 T 185 60 L 195 60"
            stroke="currentColor" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
    </svg>
  )
}

function AirflowStream({ y, delay = 0, duration = 12, color = "#7C3AED", opacity = 0.18, amplitude = 30, uid }: {
  y: number; delay?: number; duration?: number; color?: string; opacity?: number; amplitude?: number; uid: number
}) {
  const length = 1400
  const path = `M -100 ${y} Q ${length * 0.25} ${y - amplitude} ${length * 0.5} ${y} T ${length * 1.05} ${y}`
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${length} 800`} preserveAspectRatio="xMidYMid slice"
         style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id={`ag-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.4" stopColor={color} stopOpacity={opacity} />
          <stop offset="0.6" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={`url(#ag-${uid})`} strokeWidth="1.4"
            strokeDasharray="6 14" strokeLinecap="round"
            style={{ animation: `airflowDrift ${duration}s linear infinite`, animationDelay: `${delay}s` }} />
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

function BlueprintGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: [
        "linear-gradient(rgba(96,165,250,0.07) 1px, transparent 1px)",
        "linear-gradient(90deg, rgba(96,165,250,0.07) 1px, transparent 1px)",
        "linear-gradient(rgba(96,165,250,0.04) 1px, transparent 1px)",
        "linear-gradient(90deg, rgba(96,165,250,0.04) 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "120px 120px, 120px 120px, 24px 24px, 24px 24px",
      maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)",
      WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)",
    }} />
  )
}

function ThermalWash() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div style={{
        position: "absolute", top: "10%", left: "8%",
        width: 380, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)",
        filter: "blur(40px)", animation: "hvDrift 14s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "30%", right: "12%",
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(249,115,22,0.14), transparent 70%)",
        filter: "blur(40px)",
        animation: "hvDrift 16s ease-in-out infinite reverse",
        animationDelay: "-4s",
      }} />
    </div>
  )
}

function FloatingHvacIcon({ children, top, left, right, bottom, size = 160, drift = 12, opacity = 0.08, rotate = 0, color = "#7C3AED" }: {
  children: React.ReactNode; top?: string; left?: string; right?: string; bottom?: string
  size?: number; drift?: number; opacity?: number; rotate?: number; color?: string
}) {
  return (
    <div className="absolute pointer-events-none" style={{
      top, left, right, bottom, width: size, color, opacity,
      transform: `rotate(${rotate}deg)`,
      animation: `hvFloat ${drift}s ease-in-out infinite`,
    }}>
      {children}
    </div>
  )
}

function HeroAtmosphere() {
  return (
    <>
      <BlueprintGrid />
      <ThermalWash />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AirflowStream uid={1} y={120} delay={0}   duration={18} color="#60A5FA" opacity={0.22} amplitude={40} />
        <AirflowStream uid={2} y={260} delay={-6}  duration={22} color="#7C3AED" opacity={0.16} amplitude={28} />
        <AirflowStream uid={3} y={400} delay={-12} duration={26} color="#F97316" opacity={0.14} amplitude={50} />
        <AirflowStream uid={4} y={540} delay={-3}  duration={20} color="#60A5FA" opacity={0.18} amplitude={35} />
        <AirflowStream uid={5} y={680} delay={-9}  duration={24} color="#7C3AED" opacity={0.14} amplitude={45} />
      </div>
      <AirflowParticles count={20} color="#60A5FA" />
      <FloatingHvacIcon top="14%" left="4%"  size={180} drift={11} opacity={0.07} rotate={-8}  color="#7C3AED">
        <HvacCondenserFan size={180} spin={14} />
      </FloatingHvacIcon>
      <FloatingHvacIcon top="8%"  right="6%" size={120} drift={9}  opacity={0.09} rotate={12}  color="#60A5FA">
        <HvacThermostat size={120} />
      </FloatingHvacIcon>
      <FloatingHvacIcon bottom="32%" left="3%"  size={170} drift={13} opacity={0.06} rotate={6}   color="#0EA5E9">
        <HvacDuctElbow size={170} />
      </FloatingHvacIcon>
      <FloatingHvacIcon bottom="22%" right="4%" size={200} drift={15} opacity={0.07} rotate={-4}  color="#F97316">
        <HvacCoilPipe size={200} />
      </FloatingHvacIcon>
      <FloatingHvacIcon top="48%" left="9%"  size={100} drift={10} opacity={0.10} rotate={0}   color="#7C3AED">
        <HvacVent size={100} />
      </FloatingHvacIcon>
      <FloatingHvacIcon top="58%" right="11%" size={90}  drift={12} opacity={0.10} rotate={20}  color="#60A5FA">
        <HvacVent size={90} />
      </FloatingHvacIcon>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const links = ["Features", "How It Works", "Pricing", "Results"]

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(255,255,255,0.80)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.2 }}
            transition={{ duration: 0.2 }}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: C.primary, boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}
          >
            <Zap className="w-4 h-4 text-white" />
          </motion.div>
          <span
            className="font-bold text-xl tracking-tight"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}
          >
            LeadCloser
          </span>
        </div>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm relative group"
              style={{ color: C.muted }}
            >
              <span className="group-hover:text-purple-600 transition-colors duration-200">{l}</span>
              <span
                className="absolute -bottom-0.5 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-300 rounded-full"
                style={{ background: C.primary }}
              />
            </a>
          ))}
        </div>

        {/* Right */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm transition-colors duration-200 hover:text-gray-900 px-3 py-2"
            style={{ color: C.muted }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-1.5 text-sm font-semibold text-white px-5 py-2.5 rounded-full transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: C.primary,
              boxShadow: "0 4px 14px rgba(124,58,237,0.40)",
            }}
          >
            Start Free Trial <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" style={{ color: C.text }} /> : <Menu className="w-5 h-5" style={{ color: C.text }} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mx-4 mb-4 rounded-2xl border p-5 space-y-3"
            style={{
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(12px)",
              borderColor: C.border,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            }}
          >
            {links.map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase().replace(/\s+/g, "-")}`}
                className="block text-sm py-2 transition-colors hover:text-purple-600"
                style={{ color: C.muted }}
                onClick={() => setMenuOpen(false)}
              >
                {l}
              </a>
            ))}
            <div className="pt-2 border-t space-y-2" style={{ borderColor: C.border }}>
              <Link href="/login" className="block text-sm py-2 text-center rounded-lg border transition-colors" style={{ color: C.muted, borderColor: C.border }}>Log in</Link>
              <Link href="/signup" className="block text-sm py-2 text-center font-semibold text-white rounded-full" style={{ background: C.primary }}>Start Free Trial</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNT-UP HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800, start = 0) {
  const [val, setVal] = useState(start)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })

  useEffect(() => {
    if (!inView) return
    const steps = 60
    const inc = (target - start) / steps
    const interval = duration / steps
    let cur = start
    const timer = setInterval(() => {
      cur = Math.min(cur + inc, target)
      setVal(Math.round(cur * 10) / 10)
      if (cur >= target) clearInterval(timer)
    }, interval)
    return () => clearInterval(timer)
  }, [inView, target, start, duration])

  return { val, ref }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE LEAD PIPELINE (left column of product card)
// ─────────────────────────────────────────────────────────────────────────────
const LEADS = [
  {
    name: "Mike Johnson", service: "AC Repair · Houston TX",
    status: "booked", badge: "Booked ✓", time: "47 sec",
    border: "#16A34A", badgeBg: "#F0FDF4", badgeText: "#15803D",
  },
  {
    name: "Sarah Chen", service: "HVAC Install · Austin TX",
    status: "qualifying", badge: "Qualifying…", time: "AI typing…",
    border: "#D97706", badgeBg: "#FFFBEB", badgeText: "#B45309",
    pulse: true,
  },
  {
    name: "David Torres", service: "Tune-Up · Dallas TX",
    status: "new", badge: "New Lead", time: "Just now",
    border: "#7C3AED", badgeBg: "#F5F3FF", badgeText: "#6D28D9",
    dot: true,
  },
  {
    name: "Lisa Park", service: "Furnace Repair · Denver CO",
    status: "booked", badge: "Booked ✓", time: "1 min 12 sec",
    border: "#16A34A", badgeBg: "#F0FDF4", badgeText: "#15803D",
  },
]

function LeadPipeline() {
  return (
    <div className="p-4" style={{ background: "#F9FAFB", borderRight: `1px solid ${C.border}`, minWidth: 0 }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold" style={{ color: C.text }}>Lead Pipeline</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#EDE9FE", color: C.primary }}>12 active</span>
      </div>

      <div className="space-y-2">
        {LEADS.map((lead, i) => (
          <motion.div
            key={lead.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.12 }}
            className="bg-white rounded-xl p-3 transition-shadow hover:shadow-md cursor-default"
            style={{
              borderLeft: `3px solid ${lead.border}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{lead.name}</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }}>{lead.service}</p>
              </div>
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
                style={{ background: lead.badgeBg, color: lead.badgeText }}
              >
                {lead.pulse ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full inline-block animate-pulse" style={{ background: lead.badgeText }} />
                    {lead.badge}
                  </span>
                ) : lead.badge}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1" style={{ color: C.muted }}>
              <Clock className="w-2.5 h-2.5 shrink-0" />
              <span className="text-[9px]">
                {lead.dot ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse bg-green-500" />
                    {lead.time}
                  </span>
                ) : `Responded in ${lead.time}`}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stat row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
        className="mt-3 pt-3 flex items-center gap-2"
        style={{ borderTop: `1px solid ${C.border}` }}
      >
        <TrendingUp className="w-3 h-3" style={{ color: C.success }} />
        <span className="text-[10px] font-semibold" style={{ color: C.success }}>4 booked today</span>
        <span className="text-[9px]" style={{ color: C.muted }}>↑ 2 from yesterday</span>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED SMS CONVERSATION (right column)
// ─────────────────────────────────────────────────────────────────────────────
const CONVO = [
  { role: "lead", text: "Hi, my AC stopped working. It's 95 degrees in here" },
  { role: "ai",   text: "Hi Mike! This is Alex from CoolAir HVAC 👋 So sorry to hear that — in this heat that's urgent. I can get a technician to you today. Are you available this afternoon between 2–5pm or would tomorrow morning work better?" },
  { role: "lead", text: "Today works! 3pm if possible?" },
  { role: "ai",   text: "Perfect! ✅ I've booked you for 3:00 PM today with our senior tech James. He'll call 30 min before arrival. Anything else I should tell him about the issue?" },
  { role: "lead", text: "The outside unit is making a loud noise" },
  { role: "ai",   text: "Got it — I've added that note for James. You're all set! You'll get a reminder text at 2:30pm. Have a cooler afternoon soon! 🌬️" },
]

function LiveConversation() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [done, setDone] = useState(false)

  const replay = useCallback(() => {
    setVisibleCount(0)
    setDone(false)
  }, [])

  useEffect(() => {
    if (done) {
      const t = setTimeout(replay, 4000)
      return () => clearTimeout(t)
    }
  }, [done, replay])

  useEffect(() => {
    if (done) return
    if (visibleCount >= CONVO.length) {
      const t = setTimeout(() => setDone(true), 1200)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setVisibleCount((n) => n + 1), visibleCount === 0 ? 800 : 700)
    return () => clearTimeout(t)
  }, [visibleCount, done])

  return (
    // Fixed height — NEVER grows. All children must fit within this box.
    <div className="flex flex-col" style={{ background: C.surface, height: 400, overflow: "hidden" }}>

      {/* Header — shrink-0 so it never flexes */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <MessageSquare className="w-4 h-4" style={{ color: C.primary }} />
        <span className="text-xs font-semibold flex-1" style={{ color: C.text }}>AI Agent</span>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] font-medium text-green-600">Active</span>
        <span className="ml-2 text-[10px]" style={{ color: C.muted }}>Mike Johnson</span>
        <Phone className="w-3 h-3" style={{ color: C.muted }} />
      </div>

      {/* Messages — bottom-aligned flex column. New messages appear at bottom,
          older ones clip at top. The container never changes size. */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end gap-2 px-3 py-3">
        <AnimatePresence initial={false}>
          {CONVO.slice(0, visibleCount).map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`shrink-0 flex ${msg.role === "lead" ? "justify-start" : "justify-end"}`}
            >
              <div className="space-y-1" style={{ maxWidth: "82%" }}>
                <div
                  className="rounded-2xl px-3 py-2 text-[11px] leading-relaxed"
                  style={
                    msg.role === "lead"
                      ? { background: "#F3F4F6", color: C.text, borderBottomLeftRadius: 4 }
                      : { background: C.primary, color: "#fff", borderBottomRightRadius: 4 }
                  }
                >
                  {msg.text}
                </div>
                {msg.role === "ai" && (
                  <div className="flex justify-end">
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: "#EDE9FE", color: C.primary }}>AI</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {visibleCount < CONVO.length && visibleCount > 0 && CONVO[visibleCount]?.role === "ai" && (
            <motion.div
              key="typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="shrink-0 flex justify-end"
            >
              <div className="flex items-center gap-1 px-3 py-2 rounded-2xl" style={{ background: "#EDE9FE" }}>
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full block"
                    style={{ background: C.primary }}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, delay: d * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Success bar — ALWAYS in the DOM with fixed height 44px.
          Only opacity animates — zero height change, zero layout shift. */}
      <div
        className="shrink-0 flex items-center gap-2 px-4"
        style={{ height: 44, background: "#F0FDF4", borderTop: "1px solid #BBF7D0", overflow: "hidden" }}
      >
        <motion.div
          initial={false}
          animate={{ opacity: done ? 1 : 0, y: done ? 0 : 6 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 w-full"
        >
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-xs font-semibold text-green-700 flex-1">Appointment booked in 3 min 22 sec</span>
          <span className="text-[10px] text-purple-600 underline cursor-pointer">Added to CRM →</span>
        </motion.div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE HERO CARD — chat-only, clean, no 3D
// ─────────────────────────────────────────────────────────────────────────────
function MobileHeroCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden border"
      style={{
        background: C.surface,
        borderColor: C.border,
        boxShadow: "0 20px 60px rgba(124,58,237,0.18), 0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* Browser chrome */}
      <div className="flex items-center px-3 py-2.5 gap-2" style={{ background: "#111827" }}>
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1.5 rounded px-3 py-0.5" style={{ background: "rgba(255,255,255,0.07)" }}>
            <Zap className="w-2.5 h-2.5" style={{ color: C.primary }} />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>LeadCloser — AI Agent Live</span>
          </div>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      </div>

      {/* Chat conversation */}
      <LiveConversation />

      {/* Stats strip */}
      <div className="grid grid-cols-2 border-t" style={{ borderColor: C.border, background: "#FAFAF8" }}>
        {[
          { val: "47 sec", label: "Avg response time", color: C.primary },
          { val: "3.2×",   label: "More jobs booked",  color: C.success },
        ].map((s, i) => (
          <div key={i} className="text-center py-4" style={{ borderLeft: i > 0 ? `1px solid ${C.border}` : undefined }}>
            <p className="text-xl font-bold" style={{ color: s.color, fontFamily: "var(--font-jetbrains)" }}>{s.val}</p>
            <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{s.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO PRODUCT CARD
// ─────────────────────────────────────────────────────────────────────────────
function HeroProductCard() {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="relative max-w-5xl mx-auto" style={{ perspective: "1200px" }}>
      {/* Floating badge — top right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.5, type: "spring" }}
        className="hidden sm:block"
        style={{
          position: "absolute",
          top: -20, right: -16,
          zIndex: 20,
        }}
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-2xl px-4 py-3 border"
          style={{
            background: C.surface,
            borderColor: C.border,
            boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
          }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-sm font-bold" style={{ color: C.text }}>3.2x more bookings</p>
              <p className="text-[10px]" style={{ color: C.muted }}>vs manual follow-up</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating badge — bottom left */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.7, type: "spring" }}
        className="hidden sm:block"
        style={{
          position: "absolute",
          bottom: -20, left: -16,
          zIndex: 20,
        }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="rounded-2xl px-4 py-3 border"
          style={{
            background: C.surface,
            borderColor: C.border,
            boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
          }}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: C.primary }} />
            <div>
              <p className="text-sm font-bold" style={{ color: C.text }}>47 sec avg response</p>
              <p className="text-[10px]" style={{ color: C.muted }}>Leads contacted automatically</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Glow behind card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 90%, rgba(124,58,237,0.18) 0%, transparent 70%)",
          filter: "blur(32px)",
          transform: "translateY(40px)",
        }}
      />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        style={{
          transform: hovered
            ? "perspective(1200px) rotateX(2deg) scale(1.01)"
            : "perspective(1200px) rotateX(6deg)",
          transition: "transform 0.4s ease",
          boxShadow: hovered
            ? "0 60px 120px -20px rgba(124,58,237,0.28), 0 40px 80px -10px rgba(0,0,0,0.14)"
            : "0 50px 100px -20px rgba(124,58,237,0.18), 0 30px 60px -10px rgba(0,0,0,0.08)",
          borderRadius: 24,
          overflow: "hidden",
          border: `1px solid ${C.border}`,
          background: C.surface,
        }}
      >
        {/* Browser chrome */}
        <div
          className="flex items-center px-4 py-3 gap-2"
          style={{ background: "#111827", height: 44 }}
        >
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 rounded-md px-4 py-1" style={{ background: "rgba(255,255,255,0.06)" }}>
              <Zap className="w-3 h-3" style={{ color: C.primary }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jetbrains)" }}>LeadCloser Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-medium text-green-400">Live</span>
          </div>
        </div>

        {/* Two-column body */}
        <div className="block md:grid" style={{ gridTemplateColumns: "45% 55%" }}>
          <div className="hidden md:block">
            <LeadPipeline />
          </div>
          <LiveConversation />
        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT STRIP
// ─────────────────────────────────────────────────────────────────────────────
function StatStrip() {
  const { val: val1, ref: ref1 } = useCountUp(60, 1800, 300)
  const { val: val2, ref: ref2 } = useCountUp(3.2, 1800, 1.0)
  const ref3 = useRef<HTMLDivElement>(null)

  const stats = [
    { ref: ref1, display: `< ${val1}s`,  label: "Every lead worked after form submit",   color: C.text },
    { ref: ref2, display: `${val2}x`,    label: "Booking rate vs. manual operations",   color: C.primary, bordered: true },
    { ref: ref3, display: "$0",          label: "Revenue lost to slow response",        color: C.success },
  ]

  return (
    <div className="max-w-3xl mx-auto mt-16 sm:mt-20 px-4 sm:px-0">
      <div className="grid grid-cols-1 sm:grid-cols-3 rounded-2xl overflow-hidden border" style={{ borderColor: C.border, background: C.surface, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        {stats.map((stat, i) => (
          <div
            key={i}
            ref={stat.ref}
            className="text-center px-6 sm:px-8 py-6 sm:py-7"
            style={{
              borderLeft: stat.bordered && i > 0 ? `1px solid ${C.border}` : undefined,
              borderRight: stat.bordered ? `1px solid ${C.border}` : undefined,
              borderTop: i > 0 ? `1px solid ${C.border}` : undefined,
            }}
          >
            <p
              className="text-3xl sm:text-4xl font-bold leading-none"
              style={{ color: stat.color, fontFamily: "var(--font-jetbrains)" }}
            >
              {stat.display}
            </p>
            <p className="text-sm mt-2" style={{ color: C.muted }}>{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS — 4-step alternating 2-col layout with micro-preview cards
// ─────────────────────────────────────────────────────────────────────────────
const HIW_STEPS = [
  {
    n: "01",
    title: "Every inbound captured — voice, SMS, web form, or ad",
    body: "Facebook leads, Google ads, inbound calls, website forms — all pipe into one intake queue. The AI voice agent answers calls. The SMS agent responds within 60 seconds of form submit.",
    micro: "intake" as const,
  },
  {
    n: "02",
    title: "AI qualifies the job and handles every objection",
    body: "Service type, urgency, address, equipment age, budget signals — asked like a senior dispatcher. Price shopping, competitor comparisons, and \"just getting quotes\" handled automatically. Zero guesswork.",
    micro: "qualify" as const,
  },
  {
    n: "03",
    title: "Books the right tech, right slot, right appointment type",
    body: "Reads your live calendar, route density, and tech specialty. Distinguishes emergency from tune-up from install. Locks the appointment and fires a confirmation SMS to the homeowner.",
    micro: "book" as const,
  },
  {
    n: "04",
    title: "Every action tracked. Your CRM always current.",
    body: "Transcript, call recording, lead source, job type, and dispatch notes land in your pipeline automatically. You see what came in, what got booked, what went cold — and why.",
    micro: "handoff" as const,
  },
]

function HiwMicro({ kind }: { kind: "intake" | "qualify" | "book" | "handoff" }) {
  if (kind === "intake") {
    return (
      <div className="rounded-xl p-3 border" style={{ background: "#fff", borderColor: C.border }}>
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {[
            { label: "Web Form",     bg: "#EFF6FF", color: "#1D4ED8" },
            { label: "Google Ad",    bg: "#FEF3C7", color: "#A16207" },
            { label: "FB Lead",      bg: "#FCE7F3", color: "#BE185D" },
            { label: "Inbound Call", bg: "#F0FDF4", color: "#15803D" },
          ].map(s => (
            <span key={s.label} className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: s.bg, color: s.color }}>{s.label}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[10px] font-mono" style={{ color: C.muted }}>POST /lead → intake queue</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1" style={{ color: C.primary }}>
            <Mic className="w-2.5 h-2.5" /> AI Voice Agent
          </span>
          <span className="flex items-center gap-1" style={{ color: C.primary }}>
            <MessageSquare className="w-2.5 h-2.5" /> SMS in 60s
          </span>
        </div>
      </div>
    )
  }
  if (kind === "qualify") {
    return (
      <div className="rounded-xl p-3 space-y-1.5 border" style={{ background: "#fff", borderColor: C.border }}>
        {[
          ["Service",  "AC repair — emergency"],
          ["Address",  "Verified ✓"],
          ["Urgency",  "Today"],
          ["Budget",   "$400–$900"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[10px]">
            <span style={{ color: C.muted }}>{k}</span>
            <span className="font-semibold flex items-center gap-1" style={{ color: C.text }}>
              <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />{v}
            </span>
          </div>
        ))}
        <div className="pt-1.5 text-[9px] font-medium" style={{ color: C.muted }}>
          Objection handled: "just getting prices"
        </div>
      </div>
    )
  }
  if (kind === "book") {
    return (
      <div className="rounded-xl p-3 border" style={{ background: "#fff", borderColor: C.border }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold" style={{ color: C.text }}>Today · Emergency AC</span>
          <span className="text-[9px]" style={{ color: C.muted }}>Tech: James M.</span>
        </div>
        <div className="grid grid-cols-4 gap-1 mb-2">
          {["10a", "12p", "2p", "3p"].map((t, i) => (
            <div key={t} className="text-[9px] text-center py-1.5 rounded font-medium"
                 style={i === 3 ? { background: C.primary, color: "#fff" } : { background: "#F3F4F6", color: C.muted }}>
              {t}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-medium" style={{ color: C.success }}>✓ 3:00 PM locked · Confirm SMS sent</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl p-3 border" style={{ background: "#fff", borderColor: C.border }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.primary }}>
          <Zap className="w-3 h-3 text-white" />
        </div>
        <ArrowRight className="w-3 h-3" style={{ color: C.muted }} />
        <div className="flex-1 px-2 py-1 rounded text-[9px] font-mono"
             style={{ background: "#F3F4F6", color: C.muted, border: `1px solid ${C.border}` }}>
          CRM · lead + dispatch notes updated
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 text-[9px]" style={{ color: C.muted }}>
        <span>• Transcript ✓</span>
        <span>• Tags applied ✓</span>
        <span>• Tech assigned ✓</span>
        <span>• Confirm SMS ✓</span>
      </div>
    </div>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: C.primary }}>How it works</p>
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-5"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            From form-fill to{" "}
            <span style={{ color: C.primary }}>booked truck roll</span>
            <br />in under 4 minutes.
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: C.muted }}>
            AI voice + SMS handles your front office. Your CRM gets clean, qualified, booked work — automatically.
          </p>
        </motion.div>

        <div className="relative">
          {/* Vertical connector */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px hidden md:block"
               style={{ background: `linear-gradient(180deg, transparent, ${C.border} 10%, ${C.border} 90%, transparent)` }} />

          {HIW_STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className={`grid md:grid-cols-2 gap-12 items-center mb-24 last:mb-0 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              {/* Text side */}
              <div className={i % 2 ? "md:pl-16" : "md:pr-16 md:text-right"}>
                <div className={`flex items-center gap-3 mb-4 ${i % 2 ? "" : "md:justify-end"}`}>
                  <span className="text-5xl font-extrabold"
                        style={{ fontFamily: "var(--font-jetbrains)", color: "transparent", WebkitTextStroke: `1.5px ${C.primary}` }}>
                    {step.n}
                  </span>
                </div>
                <h3 className="text-3xl font-bold mb-3 tracking-tight"
                    style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>{step.title}</h3>
                <p className="leading-relaxed text-lg" style={{ color: C.muted }}>{step.body}</p>
              </div>

              {/* Micro-preview side */}
              <div className={i % 2 ? "md:pr-16" : "md:pl-16"}>
                <div className="relative">
                  <div className="absolute -inset-4 rounded-3xl"
                       style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(77,124,15,0.04))" }} />
                  <div className="relative p-5 rounded-2xl border"
                       style={{ background: C.subtle, borderColor: C.border, boxShadow: "0 4px 20px rgba(124,58,237,0.06)" }}>
                    <HiwMicro kind={step.micro} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM DASHBOARD PREVIEW SECTION
// ─────────────────────────────────────────────────────────────────────────────
const CRM_PIPELINE = [
  {
    col: "New", badge: "bg-blue-50 text-blue-700 border-blue-100", count: 8,
    leads: [
      { name: "Josh Martinez", service: "AC Repair",   sub: "Houston, TX", est: "$3,200", time: "2m ago",  initials: "JM", ring: "from-blue-400 to-blue-600",    dot: "bg-blue-400" },
      { name: "Amy Liu",       service: "Duct Cleaning",sub:"Dallas, TX",  est: "$890",  time: "5m ago",  initials: "AL", ring: "from-blue-400 to-indigo-500",  dot: "bg-blue-400" },
    ],
  },
  {
    col: "Contacted", badge: "bg-purple-50 text-purple-700 border-purple-100", count: 15,
    leads: [
      { name: "Sarah Chen",   service: "HVAC Install", sub: "Austin, TX",  est: "$8,400", time: "18m ago", initials: "SC", ring: "from-purple-400 to-purple-600", dot: "bg-purple-400" },
      { name: "Carlos V.",    service: "Furnace Fix",  sub: "Phoenix, AZ", est: "$1,100", time: "1h ago",  initials: "CV", ring: "from-purple-400 to-pink-500",   dot: "bg-purple-400" },
    ],
  },
  {
    col: "Qualified", badge: "bg-amber-50 text-amber-700 border-amber-100", count: 9,
    leads: [
      { name: "Mike Thompson", service: "New HVAC",    sub: "Denver, CO",  est: "$12,000", time: "2h ago", initials: "MT", ring: "from-amber-400 to-orange-500",  dot: "bg-amber-400" },
      { name: "Linda Kim",     service: "AC Tune-Up",  sub: "Atlanta, GA", est: "$320",    time: "4h ago", initials: "LK", ring: "from-amber-400 to-yellow-500",  dot: "bg-amber-400" },
    ],
  },
  {
    col: "Booked ✓", badge: "bg-green-50 text-green-700 border-green-100", count: 12,
    leads: [
      { name: "Dave Richards", service: "Full Replace", sub: "Chicago, IL", est: "$14,500", time: "Thu 2pm",  initials: "DR", ring: "from-green-400 to-emerald-600", dot: "bg-green-400" },
      { name: "Rosa Mendez",   service: "AC Repair",   sub: "Miami, FL",   est: "$2,800",  time: "Fri 10am", initials: "RM", ring: "from-emerald-400 to-green-600", dot: "bg-green-400" },
    ],
  },
]

const ACTIVITY = [
  { icon: "🟢", text: "Josh Martinez replied — 2m ago",     sub: "\"What times work today?\"" },
  { icon: "📅", text: "Rosa Mendez booked — Fri 10am",       sub: "AC Repair · Miami, FL" },
  { icon: "🤖", text: "AI followed up with 3 cold leads",    sub: "72hr sequence triggered" },
  { icon: "🟢", text: "Dave Richards confirmed — Thu 2pm",   sub: "Full HVAC replace · $14,500" },
  { icon: "📩", text: "New lead: Tom Harris — just now",     sub: "Emergency AC · Houston TX" },
]

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CRM PREVIEW — stats + activity feed only
// ─────────────────────────────────────────────────────────────────────────────
function MobileCRMPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden border"
      style={{
        borderColor: C.border,
        background: C.surface,
        boxShadow: "0 16px 48px rgba(124,58,237,0.10), 0 4px 16px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: C.border, background: "#111827" }}>
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>LeadCloser — Pipeline</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> AI Active
        </span>
      </div>

      {/* 2×2 stats grid */}
      <div className="grid grid-cols-2" style={{ background: "#FAFAF8" }}>
        {[
          { label: "New Leads",    value: "47",  icon: Users,         color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "Contacted",    value: "39",  icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Booked",       value: "12",  icon: CalendarCheck, color: "text-green-700",  bg: "bg-green-50"  },
          { label: "Booking Rate", value: "31%", icon: TrendingUp,    color: "text-amber-600",  bg: "bg-amber-50"  },
        ].map((stat, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-4 border-b ${i % 2 === 0 ? "border-r" : ""}`}
            style={{ borderColor: C.border }}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stat.bg}`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: C.text, fontFamily: "var(--font-jetbrains)" }}>{stat.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Live activity feed */}
      <div>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: C.border, background: "#FAFAF8" }}>
          <Bell className="w-3.5 h-3.5" style={{ color: C.primary }} />
          <span className="text-xs font-semibold" style={{ color: C.text }}>Live Activity</span>
          <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <div className="divide-y" style={{ borderColor: C.border }}>
          {ACTIVITY.map((a, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="text-base shrink-0 mt-0.5">{a.icon}</span>
              <div>
                <p className="text-[12px] font-medium leading-snug" style={{ color: C.text }}>{a.text}</p>
                <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{a.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: C.border, background: "#FAFAF8" }}>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          AI responding to 3 leads now
        </span>
        <span className="text-xs font-semibold" style={{ color: C.primary }}>View all →</span>
      </div>
    </motion.div>
  )
}

function CRMDashboardSection() {
  const [flashNew, setFlashNew] = useState(false)
  const [liveLeadVisible, setLiveLeadVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => { setFlashNew(true); setLiveLeadVisible(true) }, 3500)
    const t2 = setTimeout(() => { setFlashNew(false) }, 5500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <section id="features" className="max-w-6xl mx-auto px-6 pb-28">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-14"
      >
        <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: C.primary }}>Operational Control Center</p>
        <h2 className="text-4xl font-bold" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
          Your front office, operated by AI.
        </h2>
        <p className="mt-4 text-lg max-w-lg mx-auto" style={{ color: C.muted }}>
          Every lead classified, every job routed correctly, every appointment booked to the right slot. No bottlenecks. No dropped calls. No guessing.
        </p>
      </motion.div>

      {/* Mobile version — stats + activity */}
      <div className="md:hidden mb-8">
        <MobileCRMPreview />
      </div>

      {/* Desktop version — full CRM board */}
      <div className="hidden md:block">
      {/* Glow behind the card */}
      <div className="overflow-x-auto -mx-6 px-4 sm:mx-0 sm:px-0">
      <div className="relative" style={{ minWidth: 760 }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: "translateY(50px)",
        }} />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -4, transition: { type: "spring", stiffness: 160, damping: 22 } }}
          className="relative rounded-3xl overflow-hidden border"
          style={{
            borderColor: C.border,
            background: C.surface,
            boxShadow: "0 32px 80px rgba(124,58,237,0.12), 0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
          }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: C.border, background: "#111827" }}>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 rounded-md px-4 py-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jetbrains)" }}>
                  app.leadcloser.com/pipeline
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-green-400">AI Active</span>
            </div>
          </div>

          {/* Top stats bar */}
          <div className="grid grid-cols-4 border-b" style={{ borderColor: C.border, background: "#FAFAF8" }}>
            {[
              { label: "New Leads",    value: "47", icon: Users,        color: "text-blue-600",   bg: "bg-blue-50"   },
              { label: "Contacted",    value: "39", icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Booked",       value: "12", icon: CalendarCheck, color: "text-green-700",  bg: "bg-green-50"  },
              { label: "Booking Rate", value: "31%",icon: TrendingUp,   color: "text-amber-600",  bg: "bg-amber-50"  },
            ].map((stat, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-5 py-4 ${i < 3 ? "border-r" : ""}`}
                style={{ borderColor: C.border }}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none" style={{ color: C.text, fontFamily: "var(--font-jetbrains)" }}>{stat.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main body: pipeline + activity */}
          <div className="flex" style={{ minHeight: 360 }}>

            {/* Pipeline board */}
            <div className="flex-1 p-5 grid grid-cols-4 gap-4">
              {CRM_PIPELINE.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-2">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${col.badge}`}>
                      {col.col}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: C.muted }}>{col.count}</span>
                  </div>

                  {/* Live new lead slides in at top of "New" column */}
                  {ci === 0 && (
                    <AnimatePresence>
                      {liveLeadVisible && (
                        <motion.div
                          key="live-lead"
                          initial={{ opacity: 0, y: -20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 22 }}
                          className="rounded-xl p-3 border-l-4 relative overflow-hidden"
                          style={{
                            background: flashNew ? "rgba(34,197,94,0.06)" : C.surface,
                            borderLeft: "3px solid #16A34A",
                            boxShadow: flashNew
                              ? "0 0 0 2px rgba(34,197,94,0.25), 0 2px 8px rgba(0,0,0,0.05)"
                              : "0 2px 8px rgba(0,0,0,0.05)",
                            transition: "all 0.4s ease",
                          }}
                        >
                          {flashNew && (
                            <motion.div
                              initial={{ opacity: 0.6 }}
                              animate={{ opacity: 0 }}
                              transition={{ duration: 2 }}
                              className="absolute inset-0 rounded-xl"
                              style={{ background: "rgba(34,197,94,0.08)" }}
                            />
                          )}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wide">New · Just now</span>
                          </div>
                          <p className="text-xs font-semibold" style={{ color: C.text }}>Tom Harris</p>
                          <p className="text-[10px]" style={{ color: C.muted }}>Emergency AC · Houston TX</p>
                          <p className="text-[10px] font-semibold mt-1" style={{ color: C.success }}>est. $1,800</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}

                  {/* Regular lead cards */}
                  {col.leads.map((lead, li) => (
                    <motion.div
                      key={li}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + ci * 0.08 + li * 0.06 }}
                      whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(124,58,237,0.10)", transition: { duration: 0.15 } }}
                      className="bg-white rounded-xl p-3 border cursor-pointer group"
                      style={{
                        borderColor: C.border,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${lead.ring} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                          {lead.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold truncate group-hover:text-purple-600 transition-colors" style={{ color: C.text }}>
                            {lead.name}
                          </p>
                          <p className="text-[10px] truncate" style={{ color: C.muted }}>{lead.service}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold" style={{ color: C.success }}>{lead.est}</span>
                        <span className="text-[10px] flex items-center gap-1" style={{ color: C.muted }}>
                          <Clock className="w-2.5 h-2.5" />{lead.time}
                        </span>
                      </div>
                    </motion.div>
                  ))}

                  {/* Ghost card */}
                  <div
                    className="rounded-xl h-12 flex items-center justify-center border border-dashed"
                    style={{ borderColor: "#E7E5E4" }}
                  >
                    <span className="text-[10px]" style={{ color: "#D1CFC9" }}>+{col.count - 2} more</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Activity feed */}
            <div className="w-56 shrink-0 border-l flex flex-col" style={{ borderColor: C.border, background: "#FAFAF8" }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: C.border }}>
                <Bell className="w-3.5 h-3.5" style={{ color: C.primary }} />
                <span className="text-xs font-semibold" style={{ color: C.text }}>Live Activity</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <div className="flex-1 px-3 py-3 space-y-2 overflow-hidden">
                {ACTIVITY.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="p-2.5 rounded-xl border"
                    style={{
                      borderColor: C.border,
                      background: i === 4 && liveLeadVisible ? "rgba(34,197,94,0.04)" : C.surface,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      transition: "background 0.5s ease",
                    }}
                  >
                    <p className="text-[10px] font-medium leading-snug" style={{ color: C.text }}>{a.text}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>{a.sub}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border, background: "#FAFAF8" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs" style={{ color: C.muted }}>AI responding to 3 leads right now</span>
            </div>
            <span className="text-xs font-semibold" style={{ color: C.primary }}>View all 47 leads →</span>
          </div>
        </motion.div>
      </div>
      </div>
      </div>{/* end hidden md:block desktop wrapper */}

      {/* Feature pills — shown on all screen sizes */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8"
      >
        {[
          { icon: Mic,           label: "AI Voice Agent",            desc: "Answers inbound calls, qualifies on the spot, routes immediately" },
          { icon: MessageSquare, label: "SMS Agent",                 desc: "Texts every lead within 60 seconds — 24/7, no exceptions" },
          { icon: Route,         label: "Dispatch-Aware Booking",    desc: "Right tech, right slot, right appointment type — every time" },
          { icon: Bot,           label: "Full Autopilot Back Office", desc: "Every action tracked. Nothing dropped. Your team focuses on the truck." },
        ].map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-4 rounded-2xl border bg-white"
            style={{ borderColor: C.border, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.08)" }}>
              <f.icon className="w-4 h-4" style={{ color: C.primary }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: C.text }}>{f.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL PROOF / TESTIMONIALS
// ─────────────────────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Brian Kowalski",
    company: "Kowalski HVAC — Chicago, IL",
    text: "I used to find out about missed leads two days later when I checked the CRM. Now every lead is worked before I finish the call I'm on. 3 jobs booked the first week without me touching a single one.",
    metric: "+$18,400 first month",
    initials: "BK", gradient: "from-purple-400 to-indigo-500",
  },
  {
    name: "Maria Santos",
    company: "Santos Cooling & Heating — Phoenix, AZ",
    text: "It doesn't just book appointments — it books the right ones. It understands repair vs. estimate vs. emergency and routes them differently. My dispatcher used to spend half her day fixing bad bookings. Not anymore.",
    metric: "0 bad bookings since",
    initials: "MS", gradient: "from-amber-400 to-orange-500",
  },
  {
    name: "Derek Nolan",
    company: "NorthStar HVAC — Denver, CO",
    text: "I run 2 trucks. I can't be on the phone while I'm under a system. LeadCloser is like having a front office that actually understands HVAC — it knows which jobs to take, which need more qualification, and who should take each one.",
    metric: "47% more booked jobs",
    initials: "DN", gradient: "from-green-400 to-emerald-500",
  },
]

function Testimonials() {
  return (
    <section id="results" className="relative overflow-hidden py-24" style={{ background: "linear-gradient(180deg, #F5F3FF 0%, #FAFAF8 100%)" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #7C3AED, transparent)" }} />
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
            ))}
            <span className="ml-2 text-sm font-semibold" style={{ color: C.text }}>4.9/5 from 200+ HVAC companies</span>
          </div>
          <h2 className="text-4xl font-bold" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            HVAC operators who stopped running blind
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              whileHover={{ y: -4, transition: { type: "spring", stiffness: 280 } }}
              className="bg-white rounded-2xl p-6 border flex flex-col gap-4 cursor-default"
              style={{ borderColor: C.border, boxShadow: "0 4px 24px rgba(124,58,237,0.06)" }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-sm font-bold text-white shrink-0`}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{t.name}</p>
                  <p className="text-xs" style={{ color: C.muted }}>{t.company}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed flex-1" style={{ color: C.muted }}>"{t.text}"</p>
              <div className="pt-3 border-t" style={{ borderColor: C.border }}>
                <span className="text-sm font-semibold" style={{ color: C.success }}>{t.metric}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)" }} />
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Starter", price: 297,
    features: ["100 leads/month", "Lead classification & qualification", "Job type & urgency routing", "Built-in booking pipeline", "1 user", "Automated follow-up sequences"],
    highlight: false,
  },
  {
    name: "Growth", price: 497, highlight: true,
    features: ["300 leads/month", "Everything in Starter", "3 users", "Multi-source lead ingestion", "Custom qualification logic per job type", "Dispatch coordination layer", "Revenue & source visibility dashboard"],
  },
  {
    name: "Scale", price: 997,
    features: ["Unlimited volume", "Everything in Growth", "Unlimited users", "Custom HVAC business logic", "White-label available", "Dedicated ops setup & onboarding"],
    highlight: false,
  },
]

function Pricing() {
  return (
    <section id="pricing" className="max-w-5xl mx-auto px-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: C.primary }}>Pricing</p>
        <h2 className="text-4xl font-bold" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
          Simple, transparent pricing
        </h2>
        <p className="mt-3" style={{ color: C.muted }}>One correctly-booked HVAC replacement pays for a year. Every job booked by guesswork costs more than that.</p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5, transition: { type: "spring", stiffness: 280 } }}
            className="relative rounded-2xl p-7 flex flex-col border"
            style={{
              borderColor: plan.highlight ? "rgba(124,58,237,0.3)" : C.border,
              background: C.surface,
              boxShadow: plan.highlight
                ? "0 8px 40px rgba(124,58,237,0.14)"
                : "0 4px 16px rgba(0,0,0,0.04)",
            }}
          >
            {plan.highlight && (
              <div
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold text-white px-4 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}
              >
                Most popular
              </div>
            )}
            <div className="mb-6">
              <p className="text-sm font-semibold mb-1" style={{ color: C.muted }}>{plan.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>${plan.price}</span>
                <span style={{ color: C.muted }}>/mo</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: C.muted }}>
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: plan.highlight ? "rgba(124,58,237,0.1)" : C.subtle }}
                  >
                    <Check className="w-2.5 h-2.5" style={{ color: plan.highlight ? C.primary : C.muted }} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={plan.highlight ? {
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                color: "#fff",
                boxShadow: "0 4px 14px rgba(124,58,237,0.3)",
              } : {
                color: C.text,
                border: `1px solid ${C.border}`,
              }}
            >
              Get started <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-sm mt-6" style={{ color: C.muted }}>
        + $0.05/SMS beyond plan · 14-day free trial · Cancel anytime
      </p>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA BAND
// ─────────────────────────────────────────────────────────────────────────────
function CTABand() {
  return (
    <section className="relative overflow-hidden mx-6 mb-16 rounded-3xl"
      style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 50%, #5B21B6 100%)`,
        boxShadow: "0 24px 80px rgba(124,58,237,0.35)",
      }}>
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Orbs */}
      <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -left-16 bottom-0 w-48 h-48 rounded-full bg-white/8 blur-2xl" />

      <div className="relative max-w-3xl mx-auto px-8 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          200+ HVAC companies running on LeadCloser today
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-bold text-white mb-5"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          There are leads in your market being lost right now.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg mb-10"
          style={{ color: "rgba(216,180,254,0.9)" }}
        >
          Every lead that goes unworked for more than 5 minutes is probably gone.
          <br />LeadCloser operates your intake, qualification, and booking layer — so none of them are.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-white font-bold px-8 py-4 rounded-full hover:-translate-y-1 active:scale-[0.98] transition-all duration-200"
            style={{ color: C.primary, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
          >
            Run My Front Office with AI <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 font-medium px-8 py-4 rounded-full border transition-all duration-200 hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.3)" }}
          >
            <Play className="w-4 h-4" />
            Watch 2-Min Demo
          </Link>
        </motion.div>
        <p className="mt-5 text-sm" style={{ color: "rgba(216,180,254,0.7)" }}>
          No credit card required · Setup in under 10 minutes
        </p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="max-w-7xl mx-auto px-8 py-10 border-t" style={{ borderColor: C.border }}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.primary }}>
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>LeadCloser</span>
          <span className="text-sm" style={{ color: C.muted }}>— AI Operating System for HVAC</span>
        </div>
        <p className="text-sm" style={{ color: C.muted }}>© {new Date().getFullYear()} LeadCloser. All rights reserved.</p>
        <div className="flex items-center gap-6 text-sm" style={{ color: C.muted }}>
          <Link href="/login" className="hover:text-gray-900 transition-colors">Log in</Link>
          <Link href="/signup" className="hover:text-gray-900 transition-colors">Sign up</Link>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: C.bg }}>
      {/* z-0, z-1 — background system */}
      <Background />

      {/* z-50 — sticky nav */}
      <Nav />

      {/* z-10 — all page content */}
      <div className="relative" style={{ zIndex: 10 }}>

        {/* ── HERO ── */}
        <section className="relative min-h-screen flex flex-col items-center justify-center text-center pt-28 pb-20 px-4 overflow-hidden">

          {/* HVAC atmosphere — sits at z-0 behind all content */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
            <HeroAtmosphere />
          </div>

          <div className="relative w-full flex flex-col items-center" style={{ zIndex: 2 }}>

          {/* Live status badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 border text-xs font-semibold tracking-wide"
            style={{ background: "#F5F3FF", borderColor: "rgba(124,58,237,0.2)", color: C.primary }}
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            200+ HVAC companies running on LeadCloser today
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-none tracking-tighter max-w-4xl"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            <span className="font-normal" style={{ color: "#D1D5DB" }}>Your HVAC Company,</span>
            <br />
            <span className="font-extrabold relative inline-block" style={{ color: C.text }}>
              Finally Runs Right.
              <span
                className="absolute -bottom-2 left-0 right-0 h-1 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${C.primary}, #8B5CF6)`,
                  transformOrigin: "left",
                  animation: "underlineDraw 0.8s ease forwards 1.2s",
                  transform: "scaleX(0)",
                }}
              />
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="text-base sm:text-xl max-w-xl mx-auto mt-6 sm:mt-8 mb-6 sm:mb-8 leading-relaxed px-2 sm:px-0"
            style={{ color: C.muted }}
          >
            AI voice agent answers your calls. SMS agent texts every lead in 60 seconds. Dispatch-aware booking routes to the right tech and slot. Every customer action tracked on autopilot. This is your entire HVAC back office — run by AI.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 font-semibold text-base text-white px-7 py-3.5 rounded-full transition-all duration-200 hover:-translate-y-1"
              style={{
                background: C.primary,
                boxShadow: "0 12px 32px rgba(124,58,237,0.35)",
              }}
            >
              Run My Front Office with AI <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              className="inline-flex items-center justify-center gap-2 text-base font-medium px-7 py-3.5 rounded-full border transition-all duration-200 hover:border-purple-300 hover:text-purple-600"
              style={{ borderColor: C.border, background: C.surface, color: "#374151" }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.primary }}>
                <Play className="w-3 h-3 text-white fill-white" />
              </span>
              See It In Action
            </button>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.05, duration: 0.5 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <div className="flex items-center -space-x-2">
              {[
                "from-purple-400 to-purple-600",
                "from-amber-400 to-orange-500",
                "from-green-400 to-emerald-500",
                "from-blue-400 to-blue-600",
                "from-rose-400 to-rose-600",
              ].map((g, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-white`}
                />
              ))}
            </div>
            <span className="text-sm" style={{ color: C.muted }}>Used by HVAC operators in 38 states</span>
            <div className="flex items-center gap-1 ml-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-sm font-semibold ml-1" style={{ color: C.text }}>4.9/5</span>
            </div>
          </motion.div>

          {/* Hero product card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 sm:mt-20 w-full max-w-5xl mx-auto px-3 sm:px-4"
          >
            {/* Mobile: simple chat card. Desktop: full 3D product card */}
            <div className="md:hidden"><MobileHeroCard /></div>
            <div className="hidden md:block"><HeroProductCard /></div>
          </motion.div>

          {/* Stat strip */}
          <StatStrip />
          </div>{/* end relative content wrapper */}
        </section>

        {/* ── HOW IT WORKS ── */}
        <HowItWorks />

        {/* ── CRM DASHBOARD ── */}
        <CRMDashboardSection />

        {/* ── TESTIMONIALS ── */}
        <Testimonials />

        {/* ── PRICING ── */}
        <Pricing />

        {/* ── CTA ── */}
        <CTABand />

        {/* ── FOOTER ── */}
        <Footer />

      </div>
    </div>
  )
}
