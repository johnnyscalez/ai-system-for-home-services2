"use client"

// ─────────────────────────────────────────────────────────────────────────────
// SHARED LANDING PAGE SYSTEM — all /start/* ad-funnel pages
//
// Architecture (same on every variant, only the hero headline changes):
//   1. WoundHero        — eyebrow + ad-matched headline + leak counter + CTA
//   2. TryFailSection   — the unlogged leads he can't see
//   3. ProofStatsSection— 61% vs 79% · ~$500K/yr gap · 7-month season
//   4. ReframeSection   — owner who IS the system vs owner who BUILT one
//   5. ScopeSection     — "An entire back office, run by AI" (6 items)
//   6. WedgeSection     — the big platform, without naming it
//   7. LeadFormSection  — 5-field qualify form → qualified / not-a-fit states
//   8. FaqSection       — the 3 real objections
//
// Visual temperature: wound sections dark (#1A1614 family), solution sections
// warm cream (#FAFAF8 family). The ScopeSection carries the dark→warm bridge.
// ─────────────────────────────────────────────────────────────────────────────

import { motion, useInView, useReducedMotion } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import {
  ArrowRight, Phone, Calendar, MessageSquare, Shield,
} from "lucide-react"

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
export const C = {
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
// LOGO MARK
// ─────────────────────────────────────────────────────────────────────────────
export function FieldFMark({ size = 18 }: { size?: number }) {
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
// GHL BOOKING WIDGET  (shown inside the qualified form state)
// The "Book Your AI System Walkthrough!" calendar in the scalez sub-account.
// form_embed.js auto-resizes the iframe to fit the widget's content.
// ─────────────────────────────────────────────────────────────────────────────
export function GhlBookingWidget() {
  useEffect(() => {
    const existing = document.getElementById("ghl-form-embed-script")
    if (existing) return
    const script = document.createElement("script")
    script.id = "ghl-form-embed-script"
    script.src = "https://link.scalezz.com/js/form_embed.js"
    script.async = true
    document.body.appendChild(script)
  }, [])

  return (
    <div className="w-full rounded-2xl overflow-hidden"
         style={{ border: `1px solid ${C.border}`, background: C.surface }}>
      <iframe
        src="https://link.scalezz.com/widget/booking/YS45wLm4sIyR9lFZfBe3"
        id="YS45wLm4sIyR9lFZfBe3_landing"
        title="Book your walkthrough call"
        scrolling="no"
        style={{ width: "100%", minHeight: 640, border: "none", overflow: "hidden" }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL HEADER
// ─────────────────────────────────────────────────────────────────────────────
export function MinimalHeader() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background: "rgba(26,22,20,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(249,115,22,0.10)",
      }}
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
      <a
        href="#form"
        className="text-xs font-bold px-4 py-2 rounded-lg transition-colors hover:bg-orange-600"
        style={{ background: C.orange, color: "#fff" }}
      >
        Claim Free Trial
      </a>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAK COUNTER — the signature hero element
// Ticks +$0.10 every 900ms. Reduced motion → static $8–15K/mo note.
// ─────────────────────────────────────────────────────────────────────────────
function LeakCounter() {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setValue((v) => v + 0.1), 900)
    return () => clearInterval(id)
  }, [reduced])

  return (
    <div
      className="rounded-2xl px-6 py-5 text-left"
      style={{ background: "rgba(250,250,248,0.03)", border: "1px solid rgba(249,115,22,0.18)", boxShadow: "0 0 40px rgba(249,115,22,0.05)" }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: "rgba(250,250,248,0.40)", fontFamily: "var(--font-jetbrains)" }}
      >
        What the average shop your size leaks while reading this page
      </div>
      <div
        aria-hidden="true"
        className="font-black leading-none mb-2"
        style={{
          color: C.orange,
          fontFamily: "var(--font-jetbrains)",
          fontSize: "clamp(2.1rem, 8vw, 3rem)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {reduced
          ? "$8–15K/mo"
          : "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <span className="sr-only">The average shop this size leaks eight to fifteen thousand dollars per month.</span>
      <div className="text-sm" style={{ color: "rgba(250,250,248,0.38)" }}>
        Based on $8–15K/mo in unlogged, unanswered, un-followed-up leads during season.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WOUND HERO — shared shell; each page passes its ad-matched headline
// ─────────────────────────────────────────────────────────────────────────────
export function WoundHero({
  eyebrow = "For HVAC shops running 4+ techs",
  line1,
  line2,
  sub,
}: {
  eyebrow?: string
  line1: string
  line2: string
  sub: React.ReactNode
}) {
  return (
    <section
      className="relative flex flex-col justify-center pt-24 pb-16 px-6 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #141110 0%, #1A1614 100%)" }}
    >
      {/* Blueprint crosshatch */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
           style={{
             backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
             backgroundSize: "44px 44px", opacity: 0.055,
             WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
             maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
           }} />
      <motion.div animate={{ y: [0, -20, 0], x: [0, 10, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 700, height: 700, background: "rgba(249,115,22,0.08)", top: "-20%", left: "-10%" }} aria-hidden="true" />
      <motion.div animate={{ y: [0, 14, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 400, height: 400, background: "rgba(251,191,36,0.05)", bottom: "5%", right: "5%" }} aria-hidden="true" />

      <div className="relative max-w-2xl mx-auto w-full text-center">
        {/* Eyebrow — sizes the buyer immediately */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.20)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
          <span className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
            {eyebrow}
          </span>
        </motion.div>

        {/* Ad-matched wound headline */}
        <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
          className="font-extrabold tracking-tight mb-6"
          style={{
            color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
            fontSize: "clamp(2.3rem, 8vw, 4rem)", lineHeight: 1.05,
          }}>
          {line1}
          <br />
          <span className="relative" style={{ color: C.orange }}>
            {line2}
            <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
                  style={{ background: `linear-gradient(90deg, ${C.orange}, ${C.orangeDk})`,
                           transformOrigin: "left", animation: "underlineDraw 0.8s ease forwards 1s", transform: "scaleX(0)" }} />
          </span>
        </motion.h1>

        {/* Try-and-fail subhead */}
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
          className="text-lg sm:text-xl leading-relaxed max-w-xl mx-auto mb-7"
          style={{ color: "rgba(250,250,248,0.62)" }}>
          {sub}
        </motion.p>

        {/* The offer card — product promise + trial terms, right on screen 1.
            Most visitors never scroll; the hero has to close on its own. */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.55 }}
          className="rounded-2xl px-6 py-5 mb-5 text-left"
          style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.28)", boxShadow: "0 0 40px rgba(249,115,22,0.08)" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-2.5"
               style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
            What you get — free for 14 days
          </div>
          <p className="text-base sm:text-lg font-semibold leading-snug mb-3.5" style={{ color: "#F5F3F0" }}>
            An AI office that answers every lead in under 60 seconds, books the job,
            and shows you which tech makes you money. Nights, weekends, mid-rush.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {["No credit card", "No contract", "I set it up, not you"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-sm" style={{ color: "rgba(250,250,248,0.72)" }}>
                <span className="font-black text-xs" style={{ color: C.success }} aria-hidden="true">✓</span>
                {t}
              </span>
            ))}
          </div>
        </motion.div>

        {/* CTA — above the counter so the button lands on screen 1 at 390px */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}
          className="mb-8">
          <a href="#form"
             className="flex sm:inline-flex items-center justify-center gap-2 font-bold text-white px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5 w-full sm:w-auto"
             style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.35)", fontSize: "1.05rem" }}>
            Claim My Free 14 Days
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <span className="block mt-3 text-sm" style={{ color: "rgba(250,250,248,0.38)" }}>
            One 20-minute call, then I build it in your shop. You watch it book real jobs before you pay a dime.
          </span>
        </motion.div>

        {/* Live leak counter — bridges scrollers into the pain sections below */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.85, duration: 0.6 }}>
          <LeakCounter />
        </motion.div>
      </div>

      <style>{`@keyframes underlineDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRY AND FAIL — the unlogged leads he can't see
// ─────────────────────────────────────────────────────────────────────────────
export function TryFailSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-16 px-6" style={{ background: C.dark }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <p className="text-lg leading-relaxed mb-5" style={{ color: "rgba(250,250,248,0.60)" }}>
            Not the leads you talked to. The call that rang out while both CSRs were slammed.
            The 9pm form nobody saw till the next afternoon. The caller who hung up and dialed
            the next company on the list.
          </p>
          <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(250,250,248,0.60)" }}>
            They&rsquo;re not on a report. They&rsquo;re not in your CRM. They just quietly became
            somebody else&rsquo;s install.
          </p>
          <p className="text-xl sm:text-2xl font-bold leading-snug"
             style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)" }}>
            That&rsquo;s not a slow month you can see and fix.{" "}
            <span style={{ color: C.orange }}>That&rsquo;s money walking out of a building you thought you had locked.</span>
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TECH DASHBOARD PREVIEW — compact, reusable product visual.
// Always shown with an honest "product view" caption — never presented as
// a real customer's numbers.
// ─────────────────────────────────────────────────────────────────────────────
export function TechDashboardPreview({ caption }: { caption: string }) {
  const techRows = [
    { name: "Marcus T.", closes: "81%", bar: 0.81, revenue: "$118K", best: true },
    { name: "Jake R.",   closes: "68%", bar: 0.68, revenue: "$92K",  best: false },
    { name: "Danny P.",  closes: "73%", bar: 0.73, revenue: "$87K",  best: false },
    { name: "Chris W.",  closes: "61%", bar: 0.61, revenue: "$74K",  best: false },
  ]

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-2xl overflow-hidden"
           style={{ border: "1px solid rgba(249,115,22,0.18)", boxShadow: "0 24px 60px rgba(0,0,0,0.40)" }}>
        <div className="flex items-center gap-1.5 px-4 py-3"
             style={{ background: "#141210", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          <div className="flex-1 mx-4 h-5 rounded px-2 flex items-center" style={{ background: "rgba(255,255,255,0.04)" }}>
            <span className="text-xs truncate" style={{ color: "rgba(250,250,248,0.28)", fontFamily: "var(--font-jetbrains)" }}>
              FieldBuilt AI · Technician Performance
            </span>
          </div>
        </div>
        <div className="p-4 sm:p-5" style={{ background: "#1C1712" }}>
          <div className="space-y-3">
            {techRows.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                     style={{ background: t.best ? C.orange : "rgba(255,255,255,0.08)", color: t.best ? "#fff" : "rgba(250,250,248,0.45)" }}>
                  {t.name[0]}
                </div>
                <span className="text-xs w-[3.7rem] shrink-0 truncate" style={{ color: "rgba(250,250,248,0.60)" }}>{t.name}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${t.bar * 100}%`, background: t.best ? C.orange : "rgba(249,115,22,0.35)" }} />
                </div>
                <span className="text-xs w-8 text-right shrink-0 font-semibold"
                      style={{ color: t.best ? C.orange : "rgba(250,250,248,0.45)" }}>{t.closes}</span>
                {t.best && (
                  <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: "rgba(249,115,22,0.12)", color: C.orange }}>Best</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-center mt-3 leading-relaxed" style={{ color: "rgba(250,250,248,0.35)" }}>
        {caption}{" "}
        <span style={{ color: "rgba(250,250,248,0.22)" }}>— a product view, not one customer&rsquo;s actual results.</span>
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCH IT WORK — SMS chat-thread demonstration. Used on /start and /start/tab.
// The timestamps ARE the proof: shows a lead answered, qualified, and booked
// in minutes, with nobody on the team touching it.
// ─────────────────────────────────────────────────────────────────────────────
export function WatchItWorkSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const messages: { time: string; from: "system" | "sarah"; text: string }[] = [
    { time: "8:17 PM", from: "system", text: "Hey Sarah, saw your form about the AC not keeping up. Is it running at all, or totally off?" },
    { time: "8:21 PM", from: "sarah",  text: "running but won't get below 78. been like this 2 weeks" },
    { time: "8:23 PM", from: "sarah",  text: "non stop, never shuts off" },
    { time: "8:24 PM", from: "system", text: "Got it — what's the address so I can see which tech is closest?" },
    { time: "8:25 PM", from: "sarah",  text: "btw I'm just getting a few quotes, not sure what I need yet" },
    { time: "8:25 PM", from: "system", text: "No worries at all — our tech comes out, tells you exactly what's going on, you decide from there. What's Monday look like?" },
    { time: "8:28 PM", from: "sarah",  text: "11 is better" },
    { time: "8:29 PM", from: "system", text: "Done — Monday 11am, locked in. You'll get a reminder Sunday night." },
  ]

  return (
    <section ref={ref} className="relative py-20 px-6 overflow-hidden" style={{ background: "#201A17" }}>
      <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
           style={{
             backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.10) 1.2px, transparent 1.2px)",
             backgroundSize: "30px 30px",
             WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000 20%, transparent 75%)",
             maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000 20%, transparent 75%)",
           }} />
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>Watch it work</span>
            <span className="w-8 h-px" style={{ background: C.orange }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5"
              style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            8:17 on a Tuesday night.
            <br /><span style={{ color: C.orange }}>Nobody on the team touched a thing.</span>
          </h2>
          <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: "rgba(250,250,248,0.52)" }}>
            A homeowner fills out a form — &ldquo;AC&rsquo;s running but the house won&rsquo;t get
            below 78.&rdquo; Here&rsquo;s what happened next:
          </p>
        </motion.div>

        {/* Chat thread */}
        <div className="max-w-md mx-auto mb-4 space-y-3">
          {messages.map((m, i) => {
            const isSystem = m.from === "system"
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 * i, duration: 0.4 }}
                className={`flex flex-col ${isSystem ? "items-end" : "items-start"}`}>
                <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-snug"
                     style={{
                       background: isSystem ? C.orange : "rgba(255,255,255,0.06)",
                       color: isSystem ? "#fff" : "rgba(250,250,248,0.85)",
                       borderTopRightRadius: isSystem ? 4 : 16,
                       borderTopLeftRadius: isSystem ? 16 : 4,
                     }}>
                  {m.text}
                </div>
                <span className="text-[11px] mt-1 px-1"
                      style={{ color: "rgba(250,250,248,0.32)", fontFamily: "var(--font-jetbrains)" }}>
                  {isSystem ? "AI" : "Sarah"} &middot; {m.time}
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* Payoff */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="rounded-2xl p-6 text-center mb-3"
          style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.20)" }}>
          <p className="text-lg font-bold leading-snug mb-2" style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)" }}>
            Twelve minutes. Booked. Routed to the right tech. Logged in the CRM. The owner was at dinner.
          </p>
          <p className="text-sm" style={{ color: "rgba(250,250,248,0.50)" }}>
            If she&rsquo;d gone quiet, it would have called her to follow up. That&rsquo;s the office running itself.
          </p>
        </motion.div>

        <div className="text-center mb-14">
          <a href="#form" className="inline-flex items-center gap-1.5 text-sm font-bold hover:underline underline-offset-4" style={{ color: C.orange }}>
            Run this in my shop free for 14 days
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>

        {/* Dashboard tie-in */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1, duration: 0.6 }}>
          <TechDashboardPreview caption="And every job, tech, and dollar lands on one dashboard — so you finally see which tech closes and which jobs make you money." />
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PROOF STATS — 61% vs 79% · ~$500K/yr · 7 months
// ─────────────────────────────────────────────────────────────────────────────
export function ProofStatsSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const stats = [
    {
      num: <>61% <span style={{ color: C.orange }}>vs</span> 79%</>,
      txt: "In shops that finally pull close rates by tech, the “busiest guy” routinely isn’t the best at closing — and every big replacement sent to the wrong one is money gone. Most owners have never seen this number for their own crew.",
    },
    {
      num: <><span style={{ color: C.orange }}>~$500K</span> a year</>,
      txt: "The gap between the average shop (2.5–5% net margin) and a systematized one (15%+) on a $3M operation. Same trucks. Same techs. Different visibility.",
    },
    {
      num: <><span style={{ color: C.orange }}>7</span> months</>,
      txt: "Roughly how long peak season lasts. Your whole year gets made in that window — and every leaked lead comes straight out of it.",
    },
  ]

  return (
    <section ref={ref} className="relative py-20 px-6 overflow-hidden"
             style={{ background: "linear-gradient(180deg, #1A1614 0%, #231E1B 25%, #231E1B 100%)" }}>
      <div className="absolute inset-0 pointer-events-none opacity-50" aria-hidden="true"
           style={{
             backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.10) 1.2px, transparent 1.2px)",
             backgroundSize: "30px 30px",
             WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000 20%, transparent 75%)",
             maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000 20%, transparent 75%)",
           }} />
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>The part you can&rsquo;t see</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10"
              style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            The numbers are brutal — and none of them show up on gut feel.
          </h2>
        </motion.div>

        <div>
          {stats.map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.55 }}
              className="py-6"
              style={{ borderTop: "1px solid rgba(249,115,22,0.14)", borderBottom: i === stats.length - 1 ? "1px solid rgba(249,115,22,0.14)" : "none" }}>
              <div className="font-black mb-2"
                   style={{ color: "#F5F3F0", fontFamily: "var(--font-jetbrains)", fontSize: "clamp(1.8rem, 6vw, 2.5rem)", lineHeight: 1.1 }}>
                {s.num}
              </div>
              <p className="text-base leading-relaxed" style={{ color: "rgba(250,250,248,0.52)" }}>{s.txt}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. REFRAME — owner who IS the system vs owner who BUILT one
// ─────────────────────────────────────────────────────────────────────────────
export function ReframeSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-20 px-6 overflow-hidden"
             style={{ background: "linear-gradient(180deg, #231E1B 0%, #2A211C 50%, #3A2B22 100%)" }}>
      <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 500, height: 500, background: "rgba(249,115,22,0.06)", top: "10%", right: "-10%" }} aria-hidden="true" />
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6"
              style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            This isn&rsquo;t an effort problem.
            <br /><span style={{ color: C.orange }}>You already out-hustle everyone.</span>
          </h2>
          <p className="text-lg leading-relaxed mb-5" style={{ color: "rgba(250,250,248,0.65)" }}>
            There&rsquo;s a line between an owner who{" "}
            <strong style={{ color: "#F5F3F0" }}>is</strong> the system — the one every lead, every
            schedule change, every fire runs through — and an owner who finally{" "}
            <strong style={{ color: "#F5F3F0" }}>built</strong> one.
          </p>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(250,250,248,0.65)" }}>
            What&rsquo;s keeping you on the wrong side of it isn&rsquo;t work ethic. It&rsquo;s that
            everything still depends on a human being free at the exact second it matters.
            And in July, nobody&rsquo;s free.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SCOPE — "An entire back office, run by AI" + dark→warm bridge
// Accepts an optional intro override so /start/tab can fold the ServiceTitan
// wedge beat into this section's opener instead of repeating it in a
// standalone wedge section.
// ─────────────────────────────────────────────────────────────────────────────
export function ScopeSection({
  intro,
}: {
  intro?: { eyebrow?: string; heading: string; sub: string }
} = {}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const eyebrow = intro?.eyebrow ?? "What actually gets installed"
  const heading = intro?.heading ?? "An entire back office, run by AI."
  const sub = intro?.sub ?? "Not a texting widget. The whole front-of-house — built around what you already run, set up for you."

  const cells = [
    {
      title: "Every lead answered in under 60 seconds",
      body: "Calls, texts, forms — nights, weekends, mid-rush. Qualified in a real conversation and booked on the spot.",
    },
    {
      title: "AI voice agent on the phones",
      body: "When nobody can grab the line, it answers, handles the caller like a sharp CSR, and books the visit.",
    },
    {
      title: "Dispatch to the right tech — automatically",
      body: "By skill and by area. The $14K change-out doesn’t go to whoever happens to be free.",
    },
    {
      title: "One calendar for the whole crew",
      body: "Every appointment, every tech, live. Scheduling, rescheduling, reminders — handled without a human touching it.",
    },
    {
      title: "CRM + tech portal",
      body: "Every lead profiled and logged. Your techs get their jobs, addresses, and details in their own portal — no group-text chaos.",
    },
    {
      title: "The dashboard you’ve never had",
      body: "Which tech actually makes you money. Which jobs are worth your trucks. Where every lead came from. Pipeline and revenue, live — numbers instead of gut.",
    },
  ]

  return (
    <section ref={ref} className="relative px-6 overflow-hidden" style={{ background: C.bg }}>
      {/* Dark → warm bridge */}
      <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none" aria-hidden="true"
           style={{ background: "linear-gradient(180deg, #3A2B22 0%, rgba(250,250,248,0) 100%)" }} />
      <div className="relative max-w-2xl mx-auto pt-32 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>{eyebrow}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            {heading}
          </h2>
          <p className="text-lg leading-relaxed mb-10" style={{ color: C.muted }}>
            {sub}
          </p>
        </motion.div>

        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {cells.map((cell, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -16 }} animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.5 }}
              className="flex items-start gap-4 py-5"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="w-2.5 h-2.5 rounded-full mt-2 shrink-0" style={{ background: C.orange }} />
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: C.text }}>{cell.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{cell.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTERPRISE COST ROW — /start/tab only. His gut did the math right;
// this makes it explicit right after the hero, before anything else.
// ─────────────────────────────────────────────────────────────────────────────
export function EnterpriseCostRow() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const items = [
    { value: "~$58K",       label: "Per year" },
    { value: "$20K+",       label: "To get started" },
    { value: "6–12 mo", label: "To go live" },
    { value: "A lawyer",    label: "To exit the contract" },
  ]

  return (
    <section ref={ref} className="relative py-14 px-6" style={{ background: "#1A1614" }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55 }}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-8 text-center"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
          Your gut did the math right.
        </motion.h2>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, scale: 0.95 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
              className="text-center p-5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-xl sm:text-2xl font-black mb-1"
                   style={{ color: "rgba(250,250,248,0.32)", fontFamily: "var(--font-jetbrains)", textDecoration: "line-through", textDecorationColor: "rgba(239,68,68,0.40)" }}>
                {it.value}
              </div>
              <div className="text-xs" style={{ color: "rgba(250,250,248,0.42)" }}>{it.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE — /start/tab only. Two lines: the wound didn't leave with ServiceTitan.
// ─────────────────────────────────────────────────────────────────────────────
export function BridgeSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <section ref={ref} className="relative py-14 px-6" style={{ background: "#1A1614" }}>
      <div className="relative max-w-2xl mx-auto text-center">
        <motion.p initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55 }}
          className="text-xl sm:text-2xl font-bold leading-snug mb-5"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)" }}>
          But the problem you wanted it to fix is still sitting there.
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1, duration: 0.55 }}
          className="text-base leading-relaxed max-w-xl mx-auto" style={{ color: "rgba(250,250,248,0.55)" }}>
          Leads still slip through when the desk is slammed. You still can&rsquo;t say which
          tech makes you money and which one costs you jobs. You&rsquo;re still running a
          multi-million-dollar company on gut feel and whatever you remember from last week.
        </motion.p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SHOWCASE — /start/tech only. The whole page is about not being
// able to name your best tech; this shows the screen that answers it.
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardShowcaseSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <section ref={ref} className="relative py-16 px-6" style={{ background: C.bg }}>
      <div className="relative max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            This is the number you&rsquo;re missing.
          </h2>
          <p className="text-base leading-relaxed" style={{ color: C.muted }}>
            Not who&rsquo;s running the most calls. Who&rsquo;s actually winning them.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.15, duration: 0.6 }}>
          <TechDashboardPreview caption="Every tech, every close rate, every dollar — one screen." />
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FOUNDER TRUST — /start/tech only. Replaces fabricated testimonials with an
// honest, verifiable trust mechanism: watch it work on your own leads.
// ─────────────────────────────────────────────────────────────────────────────
export function FounderTrustSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <section ref={ref} className="relative py-20 px-6" style={{ background: C.subtle }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          className="rounded-2xl p-7 sm:p-8"
          style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.06)" }}>
          <div className="flex items-center gap-2.5 mb-5">
            <Shield className="w-4 h-4" style={{ color: C.orangeDk }} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>The honest version</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            No fake logos. Here&rsquo;s the honest version.
          </h2>
          <p className="text-base leading-relaxed" style={{ color: C.muted }}>
            FieldBuilt is new — and I&rsquo;m not going to rent credibility with stock-photo
            testimonials. Instead: the system runs free in your shop for 14 days, on your
            real leads, and the numbers make the case or they don&rsquo;t. I build every
            install myself, which is why I only take a couple of shops a month. You watch it
            work before you pay a dime, and if it doesn&rsquo;t, you walk — no contract, your
            data stays yours.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. WEDGE — the big platform, without naming it
// ─────────────────────────────────────────────────────────────────────────────
export function WedgeSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const items = [
    { yes: false, txt: "No $50–60K/year enterprise bill" },
    { yes: false, txt: "No 6–12 month implementation" },
    { yes: false, txt: "No contract you’d need a lawyer to escape" },
    { yes: true,  txt: "Built around what you already run — I do the setup, not you" },
    { yes: true,  txt: "Free for 14 days — watch it book real jobs before you pay a dime" },
    { yes: true,  txt: "Walk anytime. Your data stays yours." },
  ]

  return (
    <section ref={ref} className="relative py-20 px-6" style={{ background: C.bg }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            Everything the big platform promised.
            <br /><span style={{ color: C.orange }}>None of what made you close the tab.</span>
          </h2>
          <p className="text-lg leading-relaxed mb-8" style={{ color: C.muted }}>
            You&rsquo;ve seen the enterprise demo. You saw the quote, the year of onboarding,
            the contract — and you walked. You were right. This is the other way:
          </p>
        </motion.div>

        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {items.map((item, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.45 }}
              className="flex items-baseline gap-4 py-4"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="font-black text-sm shrink-0"
                    style={{ color: item.yes ? C.success : "#DC2626", fontFamily: "var(--font-jetbrains)" }}>
                {item.yes ? "✓" : "✕"}
              </span>
              <span className="text-base" style={{ color: C.text }}>{item.txt}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. LEAD FORM — 5 fields, client-side qualification, 3 states
// ─────────────────────────────────────────────────────────────────────────────
type FormPhase = "form" | "qualified" | "noqual"

// Qualification is a function of BOTH fields, not techs alone — revenue is
// doing double duty as "can he afford it" and, divided by techs, "is this a
// well-run shop or a drowning one." See REVENUE_ORDER below for the exact
// per-tier floors.
const REVENUE_ORDER = ["<1M", "1-2M", "2-5M", "5-10M", "10M+"] as const
function revenueAtLeast(revenue: string, floor: (typeof REVENUE_ORDER)[number]): boolean {
  return REVENUE_ORDER.indexOf(revenue as (typeof REVENUE_ORDER)[number]) >= REVENUE_ORDER.indexOf(floor)
}

// Threshold: 4+ techs. With the 1-2 / 3-4 / 5-9 / 10+ buckets, the 3-4
// bucket is the one that contains "4", so it qualifies on the same terms
// as 5-9.
// 1-2 techs: never — no team to dispatch between, no per-tech performance
//   to compare, the differentiator half of the product is dead weight.
// 3-4 techs: needs $1M+ revenue — same floor as 5-9; below $1M the
//   per-tech economics don't pencil for a high-ticket product.
// 5-9 techs: needs $1-2M+ revenue (i.e. anything but "Under $1M").
// 10+ techs: needs $2M+ revenue — more techs need proportionally MORE
//   revenue to clear the ~$200K/tech viability floor, not less; 10+ techs
//   on only $1-2M is a worse ratio than a 5-tech shop at the same revenue.
function isQualified(techs: string, revenue: string): boolean {
  if (techs === "3-4" || techs === "5-9") return revenueAtLeast(revenue, "1-2M")
  if (techs === "10+") return revenueAtLeast(revenue, "2-5M")
  return false // 1-2 techs
}

// Priority signal only — never gates qualification, just tells the CRM and
// the SMS agent who to fight hardest for. Revenue-per-tech, estimated from
// bucket midpoints (open-ended top buckets use a representative value, not
// a true midpoint): $300K+/tech = A, $200-300K/tech = B, else C.
const TECH_ESTIMATE: Record<string, number> = { "1-2": 1.5, "3-4": 3.5, "5-9": 7, "10+": 12 }
const REVENUE_ESTIMATE: Record<string, number> = { "<1M": 0.75, "1-2M": 1.5, "2-5M": 3.5, "5-10M": 7.5, "10M+": 12 }
function leadTier(techs: string, revenue: string): "A" | "B" | "C" {
  const perTech = (REVENUE_ESTIMATE[revenue] * 1_000_000) / TECH_ESTIMATE[techs]
  if (perTech >= 300_000) return "A"
  if (perTech >= 200_000) return "B"
  return "C"
}

const inputStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: `1.5px solid ${C.border}`,
  borderRadius: 10,
  color: C.text,
  fontSize: 16, // 16px prevents iOS zoom-on-focus
  padding: "13px 14px",
  width: "100%",
}

export function LeadFormSection({
  source,
  heading = "Get your leak map — free, on a 20-minute call.",
  sub,
}: {
  source: string
  heading?: React.ReactNode
  sub?: React.ReactNode
}) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<FormPhase>("form")
  const [firstName, setFirstName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [techs, setTechs] = useState("")
  const [revenue, setRevenue] = useState("")
  // Only 1-2 techs disqualifies on headcount alone; every other unqualified
  // combination fails on revenue-for-that-headcount instead — a single
  // "come back at 5 techs" message would be factually wrong for e.g. a
  // 6-tech shop under $1M, so the not-a-fit copy branches on which one
  // actually applied.
  const [noqualReason, setNoqualReason] = useState<"headcount" | "revenue">("headcount")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.reportValidity()) return

    const qualified = isQualified(techs, revenue)
    const tier = qualified ? leadTier(techs, revenue) : undefined
    if (!qualified) setNoqualReason(techs === "1-2" ? "headcount" : "revenue")

    // Same-origin proxy — see app/api/lead-intake/route.ts for why this
    // doesn't call the agent directly (the agent's shared secret must never
    // ship to the browser).
    fetch("/api/lead-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: firstName, phone, email, techs, revenue, qualified, tier, angle: source }),
    }).catch(() => {})

    // Meta Pixel: fire QualifiedLead ONLY for qualified submissions.
    if (qualified && typeof window !== "undefined" && typeof window.fbq === "function") {
      // Standard Lead event = what the ad set optimizes on. Because this only
      // fires for QUALIFIED submissions, "optimize for Leads" in Ads Manager
      // trains Meta's delivery on qualified leads only — unqualified opt-ins
      // never enter the training signal. The custom event stays alongside for
      // granular reporting (techs/revenue/angle breakdowns).
      window.fbq("track", "Lead", { content_name: source })
      window.fbq("trackCustom", "QualifiedLead", { techs, revenue, source })
    }

    setPhase(qualified ? "qualified" : "noqual")
    document.getElementById("form")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
  }

  return (
    <section id="form" className="relative py-20 px-6" style={{ background: C.subtle }}>
      <div className="relative max-w-2xl mx-auto">
        <div className="rounded-3xl p-6 sm:p-9"
             style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(249,115,22,0.10), 0 4px 20px rgba(0,0,0,0.05)" }}>

          {/* ── STATE 1: the form ── */}
          {phase === "form" && (
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"
                  style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
                {heading}
              </h2>
              <p className="text-base leading-relaxed mb-7" style={{ color: C.muted }}>
                {sub ?? (
                  <>
                    I&rsquo;ll map exactly where leads slip through your shop, then set the
                    same AI system up live in your shop — answering every lead, booking
                    the job, showing you which tech makes you money — free for 14 days.{" "}
                    <strong style={{ color: C.text }}>You keep the map either way.</strong>
                  </>
                )}
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="lf-techs" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                      How many techs do you run?
                    </label>
                    <select id="lf-techs" required value={techs} onChange={(e) => setTechs(e.target.value)}
                            className="focus:outline-none focus:ring-[3px] focus:ring-orange-500/20 focus:border-orange-500"
                            style={inputStyle}>
                      <option value="" disabled>Select</option>
                      <option value="1-2">1&ndash;2</option>
                      <option value="3-4">3&ndash;4</option>
                      <option value="5-9">5&ndash;9</option>
                      <option value="10+">10+</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lf-revenue" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                      Annual revenue
                    </label>
                    <select id="lf-revenue" required value={revenue} onChange={(e) => setRevenue(e.target.value)}
                            className="focus:outline-none focus:ring-[3px] focus:ring-orange-500/20 focus:border-orange-500"
                            style={inputStyle}>
                      <option value="" disabled>Select</option>
                      <option value="<1M">Under $1M</option>
                      <option value="1-2M">$1M &ndash; $2M</option>
                      <option value="2-5M">$2M &ndash; $5M</option>
                      <option value="5-10M">$5M &ndash; $10M</option>
                      <option value="10M+">$10M+</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="lf-name" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                    First name
                  </label>
                  <input id="lf-name" type="text" autoComplete="given-name" required
                         value={firstName} onChange={(e) => setFirstName(e.target.value)}
                         className="focus:outline-none focus:ring-[3px] focus:ring-orange-500/20 focus:border-orange-500"
                         style={inputStyle} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label htmlFor="lf-phone" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                      Mobile phone
                    </label>
                    <input id="lf-phone" type="tel" autoComplete="tel" inputMode="tel" required
                           value={phone} onChange={(e) => setPhone(e.target.value)}
                           className="focus:outline-none focus:ring-[3px] focus:ring-orange-500/20 focus:border-orange-500"
                           style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="lf-email" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                      Email
                    </label>
                    <input id="lf-email" type="email" autoComplete="email" required
                           value={email} onChange={(e) => setEmail(e.target.value)}
                           className="focus:outline-none focus:ring-[3px] focus:ring-orange-500/20 focus:border-orange-500"
                           style={inputStyle} />
                  </div>
                </div>

                <div className="flex items-start gap-2.5 mb-5">
                  <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                  <p className="text-sm" style={{ color: C.muted }}>
                    No spam, no list. You&rsquo;ll get{" "}
                    <strong style={{ color: C.text }}>one text from me</strong> within a minute to lock in your time.
                  </p>
                </div>

                <button type="submit"
                        className="flex items-center justify-center gap-2 w-full font-bold text-white py-4 rounded-xl transition-colors duration-200 hover:bg-orange-600 text-lg focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-orange-600 focus-visible:outline-offset-2"
                        style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.30)" }}>
                  Show Me How It Books More Leads
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </button>
                <p className="text-center text-xs mt-3" style={{ color: C.muted }}>
                  14 days free · I set it up · No contract · No card
                </p>
              </form>
            </div>
          )}

          {/* ── STATE 2: qualified — booking ── */}
          {phase === "qualified" && (
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4"
                    style={{ background: "rgba(22,163,74,0.10)", color: "#15803D", border: "1px solid rgba(22,163,74,0.20)" }}>
                &#10003; You&rsquo;re in — pick your time
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"
                  style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
                {firstName ? `${firstName} — grab 20 minutes below.` : "Grab 20 minutes below."}
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>
                Lock in the call now while you&rsquo;re here — takes 10 seconds. I&rsquo;ll come
                prepared with where shops your size usually leak first.
              </p>

              <GhlBookingWidget />

              <div className="flex items-start gap-3 mt-5 p-4 rounded-xl"
                   style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.20)" }}>
                <Phone className="w-5 h-5 mt-0.5 shrink-0" style={{ color: C.orangeDk }} aria-hidden="true" />
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>
                  <strong>Check your phone.</strong>{" "}
                  You&rsquo;ll get a text from me in about 60
                  seconds — that&rsquo;s the same system that&rsquo;ll be answering{" "}
                  <em>your</em> leads. Consider it the first demo.
                </p>
              </div>
            </div>
          )}

          {/* ── STATE 3: not a fit — gracious exit ── */}
          {phase === "noqual" && (
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4"
                  style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
                Straight answer: we&rsquo;re not the right fit yet.
              </h2>
              {noqualReason === "headcount" ? (
                <>
                  <p className="text-base leading-relaxed mb-4" style={{ color: C.muted }}>
                    FieldBuilt is built for shops with a team big enough to dispatch and track
                    between — at your size there&rsquo;s no schedule to optimize and no per-tech
                    performance to compare, so the differentiator half of the system would sit
                    unused. I&rsquo;d rather tell you that now than waste your time on a call.
                  </p>
                  <p className="text-base leading-relaxed mb-7" style={{ color: C.muted }}>
                    <strong style={{ color: C.text }}>What I&rsquo;d do in your seat:</strong>{" "}
                    nail response speed first. Answer every lead inside 5 minutes — even with a
                    simple auto-text — and you&rsquo;ll out-book most shops your size. When
                    you&rsquo;re running a real team and the front desk starts drowning, come
                    back. I&rsquo;ll remember you.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base leading-relaxed mb-4" style={{ color: C.muted }}>
                    FieldBuilt is built for shops where the revenue already backs up the team
                    size — at your numbers, the math is tight enough that a new system cost would
                    eat into margin instead of protecting it. I&rsquo;d rather tell you that now
                    than waste your time on a call.
                  </p>
                  <p className="text-base leading-relaxed mb-7" style={{ color: C.muted }}>
                    <strong style={{ color: C.text }}>What I&rsquo;d do in your seat:</strong>{" "}
                    nail response speed first — answer every lead inside 5 minutes, even with a
                    simple auto-text — and tighten up pricing before adding a new system cost on
                    top. When the revenue catches up to the team, come back. I&rsquo;ll remember
                    you.
                  </p>
                </>
              )}
              <a href="https://fieldbuiltai.com"
                 className="flex items-center justify-center gap-2 w-full font-bold text-white py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5 text-lg"
                 style={{ background: C.text }}>
                Take me to the main site
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
          )}

        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. FAQ — the 3 real objections
// ─────────────────────────────────────────────────────────────────────────────
export function FaqSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const faqs = [
    {
      q: "Does this replace what I’m already running?",
      a: "No rip-and-replace. It’s built around your existing stack — your number, your calendar, your workflow. I do the wiring myself during setup, which takes days, not months. You keep working exactly how you work; the system just stops things from slipping.",
    },
    {
      q: "How long until it’s actually running?",
      a: "Days. I set it up personally — that’s why I only take a couple of shops a month. You don’t configure anything, you don’t train anyone. You’ll see it answering and booking real leads inside the first week of the free trial.",
    },
    {
      q: "What’s the catch on “free for 14 days”?",
      a: "There isn’t one — it’s how I earn trust with owners who’ve been burned by software before. The system runs on your real leads for 14 days. You watch what it catches and books. If the numbers don’t make it obvious, you walk, and you keep everything we mapped. No card up front, no contract either way.",
    },
  ]

  return (
    <section ref={ref} className="relative py-16 px-6" style={{ background: C.bg }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55 }}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-8"
          style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
          The three things everyone asks
        </motion.h2>
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {faqs.map((faq, i) => (
            <details key={i} className="group py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-base font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600 focus-visible:outline-offset-4 rounded"
                       style={{ color: C.text }}>
                {faq.q}
                <span aria-hidden="true"
                      className="shrink-0 font-black text-xl transition-transform duration-200 group-open:rotate-45"
                      style={{ color: C.orange }}>+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: C.muted }}>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STICKY BOTTOM CTA  (mobile)
// ─────────────────────────────────────────────────────────────────────────────
export function StickyBottomCta() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    // Hidden until the visitor scrolls past the hero, and hidden again while
    // the form section itself is on screen — no point pushing someone to the
    // form they're already looking at (and it would cover the booking widget).
    const onScroll = () => {
      const form = document.getElementById("form")
      const formOnScreen = form
        ? form.getBoundingClientRect().top < window.innerHeight && form.getBoundingClientRect().bottom > 0
        : false
      setVisible(window.scrollY > 600 && !formOnScreen)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{ y: visible ? 0 : 100, opacity: visible ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-4"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <a href="#form"
         className="flex items-center justify-center gap-2 w-full font-bold text-white py-4 rounded-xl text-base"
         style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.35)" }}>
        Show Me How It Books More Leads
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </a>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL FOOTER
// ─────────────────────────────────────────────────────────────────────────────
export function MinimalFooter() {
  return (
    <footer className="py-8 px-6 text-center"
            style={{ background: C.dark, borderTop: "1px solid rgba(249,115,22,0.10)" }}>
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
             style={{ background: "rgba(249,115,22,0.12)" }}>
          <FieldFMark size={15} />
        </div>
        <span className="font-extrabold tracking-tight"
              style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
          FIELDBUILT
          <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
                style={{ fontSize: "0.42em", background: C.orange, padding: "0.18em 0.4em", borderRadius: 4, letterSpacing: "0.04em", verticalAlign: "super" }}>
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
// FULL PAGE BODY — everything below the hero, identical on every variant
// ─────────────────────────────────────────────────────────────────────────────
export function LandingBody({ source }: { source: string }) {
  return (
    <>
      <TryFailSection />
      <ProofStatsSection />
      <ReframeSection />
      <ScopeSection />
      <WedgeSection />
      <LeadFormSection source={source} />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </>
  )
}

// Kept for back-compat with any page still importing it.
export { GhlBookingWidget as BookingCalendar }
