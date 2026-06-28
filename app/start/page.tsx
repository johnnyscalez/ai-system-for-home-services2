"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import {
  ArrowRight, Check, Star, Phone,
  Shield, Clock, TrendingUp, BarChart3,
  Users, ChevronRight, Zap, CheckCircle2,
  Calendar, Award,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:         "#FAFAF8",
  surface:    "#FFFFFF",
  orange:     "#F97316",
  orangeDk:   "#EA580C",
  dark:       "#1A1614",
  darkCard:   "#231E1B",
  darkBorder: "rgba(249,115,22,0.12)",
  text:       "#1C1917",
  muted:      "#78716C",
  border:     "#E7E5E4",
  subtle:     "#F5F4F2",
  success:    "#16A34A",
} as const

// ─────────────────────────────────────────────────────────────────────────────
// CALENDLY WIDGET
// ─────────────────────────────────────────────────────────────────────────────
function CalendlyWidget() {
  useEffect(() => {
    const existing = document.getElementById("calendly-script")
    if (existing) return
    const script = document.createElement("script")
    script.id = "calendly-script"
    script.src = "https://assets.calendly.com/assets/external/widget.js"
    script.async = true
    document.head.appendChild(script)
    return () => {
      const el = document.getElementById("calendly-script")
      if (el) el.remove()
    }
  }, [])

  return (
    <div
      className="calendly-inline-widget w-full rounded-2xl overflow-hidden"
      // Replace with your actual Calendly URL
      data-url="https://calendly.com/fieldbuiltai/setup-call?hide_landing_page_details=1&hide_gdpr_banner=1&primary_color=F97316"
      style={{ height: 720, minWidth: 320, border: `1px solid ${C.border}`, background: C.surface }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGO MARK
// ─────────────────────────────────────────────────────────────────────────────
function FieldFMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#FFFFFF" />
      <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#FFFFFF" />
      <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
      <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL HEADER
// ─────────────────────────────────────────────────────────────────────────────
function MinimalHeader() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{ background: "rgba(26,22,20,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(249,115,22,0.10)" }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
          <FieldFMark size={18} />
        </div>
        <span
          className="font-extrabold text-xl tracking-tight"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
        >
          FIELDBUILT
          <span
            className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
            style={{ fontSize: "0.42em", background: C.orange, padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}
          >
            AI
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Phone className="w-3.5 h-3.5" style={{ color: C.orange }} aria-hidden="true" />
        <span className="text-xs font-semibold" style={{ color: "rgba(250,250,248,0.55)" }}>
          Questions? <a href="tel:+1-800-FIELDAI" className="underline underline-offset-2 hover:text-white transition-colors" style={{ color: C.orange }}>Call us direct</a>
        </span>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO — INTERRUPT + WOUND  (dark)
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  const ref = useRef(null)

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex flex-col justify-center pt-32 pb-24 px-6 overflow-hidden"
      style={{ background: C.dark }}
    >
      {/* Blueprint crosshatch */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          opacity: 0.055,
          WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
          maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
        }}
      />

      {/* Glow orbs */}
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 700, height: 700, background: "rgba(249,115,22,0.08)", top: "-20%", left: "-10%" }}
        aria-hidden="true"
      />
      <motion.div
        animate={{ y: [0, 14, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 400, height: 400, background: "rgba(251,191,36,0.05)", bottom: "5%", right: "5%" }}
        aria-hidden="true"
      />

      <div className="relative max-w-4xl mx-auto w-full text-center">

        {/* Eyebrow — sizes the buyer immediately */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.20)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}
          >
            For HVAC owners running 5+ trucks
          </span>
        </motion.div>

        {/* THE WOUND HEADLINE */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.02] mb-8"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}
        >
          How Many Leads Did You
          <br />
          <span
            className="relative"
            style={{ color: C.orange }}
          >
            Lose Last Month?
            <span
              className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
              style={{
                background: `linear-gradient(90deg, ${C.orange}, ${C.orangeDk})`,
                transformOrigin: "left",
                animation: "underlineDraw 0.8s ease forwards 1.1s",
                transform: "scaleX(0)",
              }}
            />
          </span>
        </motion.h1>

        {/* The pause — let the question land */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="max-w-2xl mx-auto mb-10"
        >
          <p className="text-xl leading-relaxed" style={{ color: "rgba(250,250,248,0.62)" }}>
            Take a second. Try to answer it. Not "probably a few" — the actual number.
          </p>
          <p className="text-lg leading-relaxed mt-4" style={{ color: "rgba(250,250,248,0.44)" }}>
            The leads that came in while your team was slammed on a big install. The 8pm calls nobody picked up.
            The follow-up that went out four days late. You can&rsquo;t say — because a lead that never
            gets logged never shows up on a report.
          </p>
        </motion.div>

        {/* The invisible leak stat */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.75, duration: 0.6 }}
          className="inline-flex items-center gap-4 px-8 py-5 rounded-2xl mb-12"
          style={{ background: C.darkCard, border: "1px solid rgba(249,115,22,0.18)", boxShadow: "0 0 40px rgba(249,115,22,0.06)" }}
        >
          <div className="text-left">
            <div className="text-3xl font-black mb-0.5" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
              12–18
            </div>
            <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>qualified leads lost<br />per month, on average</div>
          </div>
          <div className="w-px h-12 self-center" style={{ background: "rgba(249,115,22,0.15)" }} />
          <div className="text-left">
            <div className="text-3xl font-black mb-0.5" style={{ color: "#FBBF24", fontFamily: "var(--font-jetbrains)" }}>
              $48K–$144K
            </div>
            <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>walking out the door<br />quietly, every month</div>
          </div>
          <div className="w-px h-12 self-center hidden sm:block" style={{ background: "rgba(249,115,22,0.15)" }} />
          <div className="text-left hidden sm:block">
            <div className="text-3xl font-black mb-0.5" style={{ color: "rgba(250,250,248,0.35)", fontFamily: "var(--font-jetbrains)" }}>
              $0
            </div>
            <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>shows up anywhere<br />on your reports</div>
          </div>
        </motion.div>

        {/* CTA — anchor to booking */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#book"
            className="inline-flex items-center gap-2 font-bold text-white px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.35)", fontSize: "1.05rem" }}
          >
            Get My Free Business Map
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <span className="text-sm" style={{ color: "rgba(250,250,248,0.35)" }}>
            Free 30-min call · No credit card · We set everything up
          </span>
        </motion.div>

      </div>

      <style>{`
        @keyframes underlineDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      `}</style>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PACE — BEING SEEN  (still dark, scrolling into mid)
// ─────────────────────────────────────────────────────────────────────────────
function PaceSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const worldItems = [
    { label: "Your dispatcher", detail: "juggling service calls and installs, rerouting techs mid-day" },
    { label: "Your front desk", detail: "slammed with inbound, putting new leads on hold" },
    { label: "Your best techs", detail: "booked 3 weeks out — good problem, terrible bottleneck" },
    { label: "Your follow-up", detail: "manual, inconsistent, dependent on whoever has five minutes" },
    { label: "Your reports", detail: "show revenue, show bookings — silent on what got away" },
  ]

  return (
    <section
      ref={ref}
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: "#201A17" }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.10) 1.2px, transparent 1.2px)",
          backgroundSize: "30px 30px",
          opacity: 0.6,
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000 20%, transparent 75%)",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000 20%, transparent 75%)",
        }}
      />

      <div className="relative max-w-4xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
              Sound familiar?
            </span>
            <span className="w-8 h-px" style={{ background: C.orange }} />
          </div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
          >
            You came off the tools to
            <br />
            <span style={{ color: C.orange }}>build something real.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(250,250,248,0.55)" }}>
            Trucks. Techs. A front office. On paper, you&rsquo;re winning.
            But the bigger the operation, the more the cracks widen — and the harder they are to see.
          </p>
        </motion.div>

        <div className="grid gap-3 mb-14">
          {worldItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
              className="flex items-start gap-4 p-5 rounded-xl"
              style={{ background: C.darkCard, border: `1px solid ${C.darkBorder}` }}
            >
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: C.orange }} />
              <div>
                <span className="font-semibold text-sm" style={{ color: "#F5F3F0" }}>{item.label}</span>
                <span className="text-sm ml-2" style={{ color: "rgba(250,250,248,0.45)" }}>— {item.detail}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="rounded-2xl p-8 text-center"
          style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.16)" }}
        >
          <p className="text-xl font-semibold leading-relaxed" style={{ color: "#F5F3F0" }}>
            "Why am I still the one holding this together at this size?"
          </p>
          <p className="mt-3 text-sm" style={{ color: "rgba(250,250,248,0.45)" }}>
            That&rsquo;s the specific tired. You didn&rsquo;t come off the tools to become the human switchboard.
            You came off to lead. The gap between those two things is what we close.
          </p>
        </motion.div>

      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REFRAME — SERVICETITAN WEDGE  (transitional, dark → mid)
// ─────────────────────────────────────────────────────────────────────────────
function ReframeSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section
      ref={ref}
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: "#2A211C" }}
    >
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 500, height: 500, background: "rgba(249,115,22,0.05)", top: "0%", right: "-10%" }}
        aria-hidden="true"
      />

      <div className="relative max-w-4xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
              You already know the problem
            </span>
            <span className="w-8 h-px" style={{ background: C.orange }} />
          </div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
          >
            You looked at ServiceTitan.
            <br />
            <span style={{ color: C.orange }}>You were right to walk.</span>
          </h2>
        </motion.div>

        {/* The ServiceTitan story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="rounded-2xl p-8 mb-8"
          style={{ background: C.darkCard, border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-lg leading-relaxed mb-6" style={{ color: "rgba(250,250,248,0.65)" }}>
            You sat through the demo. The dispatch routing looked good. The performance dashboard looked good.
            Then you saw the number.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Per year", value: "~$58K" },
              { label: "To get started", value: "$20K+" },
              { label: "To go live", value: "12 months" },
              { label: "To exit", value: "A lawyer" },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="text-2xl font-black mb-1"
                  style={{ color: "rgba(250,250,248,0.25)", fontFamily: "var(--font-jetbrains)" }}
                >
                  {item.value}
                </div>
                <div className="text-xs" style={{ color: "rgba(250,250,248,0.35)" }}>{item.label}</div>
              </div>
            ))}
          </div>

          <p className="text-base leading-relaxed" style={{ color: "rgba(250,250,248,0.55)" }}>
            You&rsquo;re not a 300-tech enterprise. You don&rsquo;t need an enterprise platform built for one.
            You needed the same intelligence — the automatic dispatch routing, the performance data, the lead dashboard —
            without the year of onboarding, the enterprise bill, and the contract your lawyer would charge you to read.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="rounded-2xl p-8 text-center"
          style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.20)" }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Check className="w-5 h-5" style={{ color: C.orange }} aria-hidden="true" />
            <span className="font-bold text-lg" style={{ color: "#F5F3F0" }}>That&rsquo;s what FieldBuilt AI is.</span>
          </div>
          <p className="text-base leading-relaxed" style={{ color: "rgba(250,250,248,0.58)" }}>
            Everything ServiceTitan promised — dispatch intelligence, performance tracking, lead automation —
            without the enterprise bill, the year of setup, or the contract you&rsquo;d need a lawyer to escape.
            Built around what you already run. Running in 48 hours.
          </p>
        </motion.div>

      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT VISION — DISPATCH + DASHBOARD  (warm transition)
// ─────────────────────────────────────────────────────────────────────────────
function ProductSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const features = [
    {
      icon: <Users className="w-5 h-5" aria-hidden="true" />,
      title: "Intelligent Dispatch — Every Lead to the Right Tech",
      body: "Not the closest tech. Not the first available. The tech most likely to close that specific job — by skill, by history, by win rate. Automatic. Every time.",
      accent: C.orange,
      accentBg: "rgba(249,115,22,0.10)",
    },
    {
      icon: <BarChart3 className="w-5 h-5" aria-hidden="true" />,
      title: "The Dashboard You've Never Had",
      body: "Which tech is your best closer — not just busiest. Which job types actually make you money. Where your leads come from and which ones convert. All live. All in one place.",
      accent: "#FBBF24",
      accentBg: "rgba(251,191,36,0.10)",
    },
    {
      icon: <Zap className="w-5 h-5" aria-hidden="true" />,
      title: "Every Lead Reached — In Seconds",
      body: "Every lead that comes in gets an AI response in under 4 seconds. SMS, voice call, 14-day follow-up sequence. 24/7. Whether you're on a roof or asleep.",
      accent: "#0EA5E9",
      accentBg: "rgba(14,165,233,0.10)",
    },
    {
      icon: <Calendar className="w-5 h-5" aria-hidden="true" />,
      title: "Appointments Book Themselves",
      body: "The AI qualifies the lead, handles objections, offers time slots, confirms the appointment, and sends reminders. Your calendar fills. You check it in the morning.",
      accent: C.success,
      accentBg: "rgba(22,163,74,0.10)",
    },
  ]

  return (
    <section
      ref={ref}
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: "#3A2B22" }}
    >
      {/* Gradient transition to cream below */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(250,250,248,0.12))" }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
              What you stop being
            </span>
            <span className="w-8 h-px" style={{ background: C.orange }} />
          </div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
          >
            You stop being the switchboard.
            <br />
            <span style={{ color: C.orange }}>You start being the owner who built one.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "rgba(250,250,248,0.52)" }}>
            Intelligent dispatch routing. Real-time performance data. Automated lead follow-up.
            Every call. Every lead. Every appointment — handled.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5 mb-12">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.6 }}
              whileHover={{ y: -3 }}
              className="rounded-2xl p-7"
              style={{
                background: C.darkCard,
                border: `1px solid ${C.darkBorder}`,
                boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: f.accentBg, color: f.accent }}
              >
                {f.icon}
              </div>
              <h3 className="font-bold text-base mb-3 leading-snug" style={{ color: "#F5F3F0" }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(250,250,248,0.50)" }}>
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Dashboard preview mockup */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(249,115,22,0.15)", boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 60px rgba(249,115,22,0.06)" }}
        >
          {/* Window chrome */}
          <div
            className="flex items-center gap-1.5 px-4 py-3"
            style={{ background: "#141210", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
            <div
              className="flex-1 mx-4 h-5 rounded px-2 flex items-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span className="text-xs" style={{ color: "rgba(250,250,248,0.28)", fontFamily: "var(--font-jetbrains)" }}>
                FieldBuilt AI · Performance Dashboard
              </span>
            </div>
          </div>

          {/* Dashboard content */}
          <div className="p-6" style={{ background: "#1C1712" }}>
            {/* Top KPIs */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "Leads This Month",    value: "147",   sub: "+23 vs last mo",   color: C.orange },
                { label: "Appointments Booked", value: "89",    sub: "91% show rate",    color: C.success },
                { label: "Revenue Recovered",   value: "$284K", sub: "from AI follow-up", color: "#FBBF24" },
                { label: "Avg Response Time",   value: "3.7s",  sub: "24/7 coverage",    color: "#0EA5E9" },
              ].map((m, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="text-xl font-black mb-0.5" style={{ color: m.color, fontFamily: "var(--font-jetbrains)" }}>{m.value}</div>
                  <div className="text-xs font-semibold mb-0.5" style={{ color: "rgba(250,250,248,0.55)" }}>{m.label}</div>
                  <div className="text-xs" style={{ color: "rgba(250,250,248,0.28)" }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Tech performance table */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,250,248,0.35)", fontFamily: "var(--font-jetbrains)" }}>
                  Technician Performance — This Month
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.12)", color: C.orange }}>Live</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: "Marcus T.",   jobs: 34, closes: "81%", revenue: "$118K", bar: 0.81, best: true },
                  { name: "Jake R.",     jobs: 41, closes: "68%", revenue: "$92K",  bar: 0.68, best: false },
                  { name: "Danny P.",    jobs: 29, closes: "73%", revenue: "$87K",  bar: 0.73, best: false },
                  { name: "Chris W.",    jobs: 38, closes: "61%", revenue: "$74K",  bar: 0.61, best: false },
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: t.best ? C.orange : "rgba(255,255,255,0.08)", color: t.best ? "#fff" : "rgba(250,250,248,0.45)" }}
                    >
                      {t.name[0]}
                    </div>
                    <span className="text-xs w-20 shrink-0" style={{ color: "rgba(250,250,248,0.60)" }}>{t.name}</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${t.bar * 100}%`, background: t.best ? C.orange : "rgba(249,115,22,0.35)" }}
                      />
                    </div>
                    <span className="text-xs w-10 text-right shrink-0 font-semibold" style={{ color: t.best ? C.orange : "rgba(250,250,248,0.45)" }}>{t.closes}</span>
                    <span className="text-xs w-14 text-right shrink-0" style={{ color: "rgba(250,250,248,0.35)", fontFamily: "var(--font-jetbrains)" }}>{t.revenue}</span>
                    {t.best && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "rgba(249,115,22,0.12)", color: C.orange }}>
                        Best closer
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs mt-3 pt-3" style={{ color: "rgba(250,250,248,0.22)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                Not who&rsquo;s running the most calls. Who&rsquo;s actually winning them.
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL PROOF — TESTIMONIALS  (cream)
// ─────────────────────────────────────────────────────────────────────────────
function ProofSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const testimonials = [
    {
      quote: "I was the dispatcher, the follow-up guy, and the one my CSR called when things got weird. Now I open my dashboard in the morning, see what booked overnight, and brief the guys. That's it. That's my whole morning.",
      name:  "Dave K.",
      role:  "Owner, ProTemp HVAC — Dallas, TX · 12 trucks",
      stars: 5,
      result: "$284K recovered from ad spend in 60 days",
    },
    {
      quote: "We looked at the big platforms. Walked. FieldBuilt was running inside our stack in two days. Booked an $8,400 replacement job on an AI follow-up call while I was on a roof. That's the whole pitch, right there.",
      name:  "James M.",
      role:  "Owner, Arctic Air Services — Phoenix, AZ · 8 trucks",
      stars: 5,
      result: "First week: 11 appointments booked by AI",
    },
    {
      quote: "I finally know which tech is my best closer. Not who has the most calls — who's actually winning them. That single number changed how I dispatch. Cost per booked job dropped 40%.",
      name:  "Carlos R.",
      role:  "Owner, Premier Comfort — Miami, FL · 17 trucks",
      stars: 5,
      result: "Cost per booked job down 40% in 30 days",
    },
  ]

  return (
    <section
      ref={ref}
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: C.bg }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.20) 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, #000 30%, transparent 80%)",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, #000 30%, transparent 80%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
              Owners like you
            </span>
            <span className="w-8 h-px" style={{ background: C.orange }} />
          </div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
          >
            The owners who made the call.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.6 }}
              whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(249,115,22,0.12)" }}
              className="flex flex-col rounded-2xl p-7"
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                boxShadow: "0 4px 24px rgba(249,115,22,0.06)",
              }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="w-4 h-4" style={{ color: C.orange }} fill={C.orange} aria-hidden="true" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: C.muted }}>
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Result badge */}
              <div
                className="flex items-center gap-2 p-3 rounded-xl mb-4"
                style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.12)" }}
              >
                <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                <span className="text-xs font-semibold" style={{ color: C.success }}>{t.result}</span>
              </div>

              {/* Attribution */}
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>{t.name}</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{t.role}</div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// THE OFFER — IRRESISTIBLE  (cream)
// ─────────────────────────────────────────────────────────────────────────────
function OfferSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const included = [
    "AI back-office built inside your existing tools in 48 hours",
    "Intelligent dispatch routing — right tech to right job, automatically",
    "Performance dashboard — which tech closes best, which jobs pay most",
    "Lead capture + AI SMS response in under 4 seconds",
    "14-day automated follow-up sequence (SMS + voice calls)",
    "Appointment booking, confirmation, and 4-step reminders",
    "Full lead CRM with live pipeline tracking",
    "Your Business Performance Report — yours to keep, regardless",
  ]

  const notIncluded = [
    "Credit card required",
    "Long-term contract",
    "Months of onboarding",
    "Replacing your existing tools",
    "Extra staff to run it",
  ]

  return (
    <section
      ref={ref}
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: "#F5F4F1" }}
    >
      {/* Orange glow behind offer card */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      >
        <div className="w-[600px] h-[400px] rounded-full blur-3xl" style={{ background: "rgba(249,115,22,0.05)" }} />
      </div>

      <div className="relative max-w-3xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
              The offer
            </span>
            <span className="w-8 h-px" style={{ background: C.orange }} />
          </div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
          >
            Free 14-Day AI Back-Office Setup.
            <br />
            <span style={{ color: C.orange }}>We build it. You watch it work.</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: C.muted }}>
            Book a 30-minute call. We set up your entire AI back office inside your existing tools.
            You get 14 days to watch it route real dispatches and book real jobs.
            Then you decide.
          </p>
        </motion.div>

        {/* Offer card */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl overflow-hidden"
          style={{ boxShadow: "0 24px 60px rgba(249,115,22,0.12), 0 4px 20px rgba(0,0,0,0.06)" }}
        >
          {/* Orange header */}
          <div
            className="px-8 py-6 text-center"
            style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDk})` }}
          >
            <div className="text-sm font-semibold text-white/80 mb-1 uppercase tracking-wider">What you get — starting day one</div>
            <div className="text-3xl font-black text-white">Free 14-Day Trial</div>
            <div className="text-white/75 text-sm mt-1">Fully set up for you · Works with your existing stack</div>
          </div>

          {/* Body */}
          <div className="p-8" style={{ background: C.surface }}>
            <div className="grid md:grid-cols-2 gap-8">

              {/* What's in */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>What&rsquo;s included</div>
                <div className="space-y-3">
                  {included.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                      <span className="text-sm" style={{ color: C.text }}>{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* What's NOT in */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>What&rsquo;s not required</div>
                <div className="space-y-3">
                  {notIncluded.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 12 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.35 + i * 0.06 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-4 h-4 mt-0.5 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: "rgba(239,68,68,0.40)" }}>
                        <div className="w-1.5 h-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.50)" }} />
                      </div>
                      <span className="text-sm" style={{ color: C.muted }}>{item}</span>
                    </motion.div>
                  ))}
                </div>

                {/* The gift */}
                <div
                  className="mt-6 p-4 rounded-xl"
                  style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.14)" }}
                >
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 mt-0.5 shrink-0" style={{ color: C.orange }} aria-hidden="true" />
                    <div>
                      <div className="text-sm font-bold mb-1" style={{ color: C.text }}>The Business Performance Report</div>
                      <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
                        After 14 days, we hand you a map of your business — which techs are your best closers,
                        which jobs pay most, where your leads convert. Yours to keep, whether we work together or not.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div
              className="mt-8 pt-6"
              style={{ borderTop: `1px solid ${C.border}` }}
            >
              <a
                href="#book"
                className="flex items-center justify-center gap-2 w-full font-bold text-white py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5 text-lg"
                style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.30)" }}
              >
                Book My Free Setup Call
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </a>
              <p className="text-center text-xs mt-3" style={{ color: C.muted }}>
                30 minutes · Free forever if you decide it&rsquo;s not for you · No pressure, no pitch
              </p>
            </div>
          </div>
        </motion.div>

        {/* Objection dissolvers */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="grid grid-cols-3 gap-4 mt-8"
        >
          {[
            { icon: <Clock className="w-4 h-4" aria-hidden="true" />, label: "Live in 48 hours", sub: "We do the setup, not you" },
            { icon: <Shield className="w-4 h-4" aria-hidden="true" />, label: "No lock-in", sub: "Cancel any time, zero friction" },
            { icon: <Phone className="w-4 h-4" aria-hidden="true" />, label: "Works with your stack", sub: "Jobber, HCP, ServiceTitan, anything" },
          ].map((item, i) => (
            <div
              key={i}
              className="text-center p-4 rounded-xl"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="flex justify-center mb-2" style={{ color: C.orange }}>{item.icon}</div>
              <div className="text-xs font-bold mb-0.5" style={{ color: C.text }}>{item.label}</div>
              <div className="text-xs" style={{ color: C.muted }}>{item.sub}</div>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — CALENDLY + GIFT FRAME  (warm cream, resolution)
// ─────────────────────────────────────────────────────────────────────────────
function BookingSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const whatToExpect = [
    { step: "01", label: "We learn how your shop runs today", detail: "Trucks, techs, tools, and where leads are slipping through" },
    { step: "02", label: "We build your AI back office live", detail: "Dispatch routing, lead AI, CRM — configured for your operation, not a template" },
    { step: "03", label: "You get your Business Performance Map", detail: "Where you're winning, where you're bleeding, and what it's costing you — yours to keep" },
  ]

  return (
    <section
      ref={ref}
      id="book"
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: C.bg }}
    >
      {/* Warm glow */}
      <motion.div
        animate={{ y: [0, -18, 0], x: [0, 12, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 600, height: 600, background: "rgba(249,115,22,0.07)", top: "-10%", right: "-5%" }}
        aria-hidden="true"
      />
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 400, height: 400, background: "rgba(251,191,36,0.05)", bottom: "5%", left: "0%" }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
              One call
            </span>
            <span className="w-8 h-px" style={{ background: C.orange }} />
          </div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
          >
            One call, and you&rsquo;ll finally
            <br />
            <span style={{ color: C.orange }}>know your number.</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: C.muted }}>
            How many leads you&rsquo;re actually losing. Which tech is your best closer.
            What your operation looks like when it runs without you.
            Thirty minutes. You keep the map.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* Left — What to expect + trust signals */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="rounded-2xl p-8 mb-6"
              style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}
            >
              <h3 className="font-bold text-lg mb-6" style={{ color: C.text }}>What happens on the call</h3>
              <div className="space-y-6">
                {whatToExpect.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.25 + i * 0.1 }}
                    className="flex gap-5"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: "rgba(249,115,22,0.10)", color: C.orange, fontFamily: "var(--font-jetbrains)" }}
                    >
                      {item.step}
                    </div>
                    <div>
                      <div className="font-semibold text-sm mb-1" style={{ color: C.text }}>{item.label}</div>
                      <div className="text-sm leading-relaxed" style={{ color: C.muted }}>{item.detail}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "48hrs", label: "From call to live system" },
                { value: "$0", label: "To start — no card needed" },
                { value: "14 days", label: "To see real results" },
                { value: "100%", label: "Setup done for you" },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="rounded-xl p-4 text-center"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <div className="text-2xl font-black mb-0.5" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>{t.value}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{t.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Final reframe */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="mt-6 p-6 rounded-2xl"
              style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.14)" }}
            >
              <p className="text-sm leading-relaxed font-medium" style={{ color: C.text }}>
                You already hustle. That&rsquo;s how you got to this size. But the next level
                isn&rsquo;t more hustle — it&rsquo;s building the system instead of being it.
                One call to find out what that looks like for your shop.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
                <span className="text-xs font-semibold" style={{ color: C.orange }}>
                  You leave with a map of your business — regardless of what you decide.
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right — Calendly calendar */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 12px 48px rgba(249,115,22,0.10), 0 4px 16px rgba(0,0,0,0.06)" }}
            >
              {/* Calendar header */}
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ background: C.dark, borderBottom: "1px solid rgba(249,115,22,0.12)" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
                  <Calendar className="w-4 h-4" style={{ color: C.orange }} aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: "#F5F3F0" }}>Book Your Free Setup Call</div>
                  <div className="text-xs" style={{ color: "rgba(250,250,248,0.45)" }}>30 min · Pick a time that works for you</div>
                </div>
                <div
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.20)" }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.success }} />
                  <span className="text-xs font-medium" style={{ color: C.success }}>Spots available today</span>
                </div>
              </div>

              {/* Calendly embed */}
              <CalendlyWidget />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ — DISSOLVE REMAINING DOUBT
// ─────────────────────────────────────────────────────────────────────────────
function FaqSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  const [open, setOpen] = useState<number | null>(null)

  const faqs = [
    {
      q: "We already use [tool]. Does this replace it?",
      a: "No. We build around what you already run — Jobber, HouseCall Pro, ServiceTitan, Google Calendar, whatever it is. We integrate into your existing stack. Nothing gets ripped out.",
    },
    {
      q: "How long does setup actually take?",
      a: "48 hours from the setup call to a live system. We do the configuration — you don't touch anything technical. By day 3, your AI is responding to real leads.",
    },
    {
      q: "What if my team doesn't like it?",
      a: "Your dispatcher keeps control. The AI routes intelligently — your team can override any dispatch decision instantly. It's a tool that works for your team, not around them.",
    },
    {
      q: "How is this different from a missed-call texter?",
      a: "Missed-call texters send a single auto-reply. This is a full AI back office — intelligent dispatch routing, performance tracking, 14-day follow-up sequences, lead qualification, appointment booking, CRM. The dispatch and data dashboard alone are in a different category.",
    },
    {
      q: "What happens after the 14 days?",
      a: "You decide. If you see the value, we talk about the plan that fits your operation. If you don't, you cancel, keep your Business Performance Report, and owe us nothing. No awkward sales call. No guilt.",
    },
    {
      q: "We already have a dispatcher. Does this replace her?",
      a: "No — it makes her faster. Manual dispatching still happens; the AI handles the routing recommendations and lead triage so she's not juggling 40 inbound inquiries. Most dispatchers love it.",
    },
  ]

  return (
    <section ref={ref} className="relative py-20 px-6" style={{ background: C.bg }}>
      <div className="relative max-w-3xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            Quick answers
          </h2>
        </motion.div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${open === i ? "rgba(249,115,22,0.25)" : C.border}`, background: C.surface }}
            >
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="text-sm font-semibold pr-4" style={{ color: C.text }}>{faq.q}</span>
                <ChevronRight
                  className="w-4 h-4 shrink-0 transition-transform duration-200"
                  style={{ color: C.orange, transform: open === i ? "rotate(90deg)" : "rotate(0deg)" }}
                  aria-hidden="true"
                />
              </button>
              {open === i && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="px-6 pb-5"
                >
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{faq.a}</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STICKY BOTTOM CTA  (mobile)
// ─────────────────────────────────────────────────────────────────────────────
function StickyBottomCta() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{ y: visible ? 0 : 100, opacity: visible ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-4 pb-safe-area-inset-bottom"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <a
        href="#book"
        className="flex items-center justify-center gap-2 w-full font-bold text-white py-4 rounded-xl text-base"
        style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.35)" }}
      >
        Get My Free Business Map
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </a>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function MinimalFooter() {
  return (
    <footer
      className="py-8 px-6 text-center"
      style={{ background: C.dark, borderTop: "1px solid rgba(249,115,22,0.10)" }}
    >
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(249,115,22,0.12)" }}>
          <FieldFMark size={15} />
        </div>
        <span
          className="font-extrabold tracking-tight"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}
        >
          FIELDBUILT
          <span
            className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
            style={{ fontSize: "0.42em", background: C.orange, padding: "0.18em 0.4em", borderRadius: 4, letterSpacing: "0.04em", verticalAlign: "super" }}
          >
            AI
          </span>
        </span>
      </div>
      <p className="text-xs mb-4" style={{ color: "rgba(250,250,248,0.30)" }}>
        AI back-office operations for HVAC companies — installed for you.
      </p>
      <div className="flex items-center justify-center gap-6">
        <a href="/privacy" className="text-xs hover:text-white transition-colors" style={{ color: "rgba(250,250,248,0.25)" }}>Privacy</a>
        <a href="/terms"   className="text-xs hover:text-white transition-colors" style={{ color: "rgba(250,250,248,0.25)" }}>Terms</a>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function StartPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <HeroSection />
      <PaceSection />
      <ReframeSection />
      <ProductSection />
      <ProofSection />
      <OfferSection />
      <BookingSection />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
