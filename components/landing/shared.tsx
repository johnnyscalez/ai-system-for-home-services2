"use client"

// ─────────────────────────────────────────────────────────────────────────────
// SHARED LANDING PAGE SYSTEM — all /start/* ad-funnel pages (FLOORING)
//
// Positioning source of truth: docs/flooring-pivot.md. Rules that bite here:
//   • Offer wording is exact: "Guaranteed 20 in-home measures in 60 days, and
//     every quote chased until it signs or says no." (OFFER constant below)
//   • No price anywhere. No guarantee failure terms. No free trial claims.
//   • No invented flooring proof. Top Air numbers only as "a live
//     home-services account". Example conversations labelled as examples.
//   • Light mode everywhere: cream / white surfaces, ink for text, orange as
//     accent only (~10% of any view).
//
// Architecture (same skeleton on every variant, only the hero angle changes):
//   1. WoundHero          — eyebrow + ad-matched headline + offer card + CTA
//   2. PainSection        — the six flooring pains from the research
//   3. WatchItWorkSection — example homeowner conversation → measure booked
//   4. HowItWorksSection  — the 5-step mechanism, in the doc's order
//   5. ProofSection       — live home-services numbers, honestly labelled
//   6. ReframeSection     — "you have the crews, not the measures"
//   7. OfferSection       — the offer, what's included, who pays the ad spend
//   8. LeadFormSection    — flooring qualifier → calendar / not-a-fit
//   9. FaqSection
// ─────────────────────────────────────────────────────────────────────────────

import { motion, useInView, useReducedMotion } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import {
  ArrowRight, Phone, MessageSquare, Shield, Check,
} from "lucide-react"

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// dark / darkCard / darkBorder are kept for other importers (and the logo
// tile); the /start pages never paint a section with them.
// ─────────────────────────────────────────────────────────────────────────────
export const C = {
  bg:         "#FAFAF8",
  surface:    "#FFFFFF",
  orange:     "#F97316",
  orangeDk:   "#EA580C",
  orangeSoft: "#FFF3EC",
  dark:       "#1A1614",
  darkCard:   "#231E1B",
  darkBorder: "rgba(249,115,22,0.12)",
  text:       "#1C1917",
  muted:      "#78716C",
  border:     "#E7E5E4",
  subtle:     "#F5F4F2",
  success:    "#16A34A",
} as const

// The offer, verbatim from docs/flooring-pivot.md. Do not paraphrase.
export const OFFER = "Guaranteed 20 in-home measures in 60 days, and every quote chased until it signs or says no."

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

function Wordmark({ size = "text-xl" }: { size?: string }) {
  return (
    <span
      className={`font-extrabold ${size} tracking-tight`}
      style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
    >
      FIELDBUILT
      <span
        className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
        style={{ fontSize: "0.42em", background: C.orange, padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}
      >
        AI
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GHL BOOKING WIDGET  (shown inside the qualified form state, and on /book)
// The walkthrough calendar in the scalez sub-account.
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
        title="Book your call with FieldBuilt"
        scrolling="no"
        style={{ width: "100%", minHeight: 640, border: "none", overflow: "hidden" }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHARED BITS
// ─────────────────────────────────────────────────────────────────────────────
function Eyebrow({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`flex items-center gap-3 mb-4 ${center ? "justify-center" : ""}`}>
      <span className="w-8 h-px" style={{ background: C.orange }} />
      <span className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>{children}</span>
      {center && <span className="w-8 h-px" style={{ background: C.orange }} />}
    </div>
  )
}

const h2Style: React.CSSProperties = {
  color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL HEADER
// ─────────────────────────────────────────────────────────────────────────────
export function MinimalHeader() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3.5"
      style={{
        background: "rgba(250,250,248,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
          <FieldFMark size={18} />
        </div>
        <Wordmark />
      </div>
      <a
        href="#form"
        className="text-xs font-bold px-4 py-2 rounded-lg transition-colors hover:bg-orange-600"
        style={{ background: C.orange, color: "#fff" }}
      >
        See If We&rsquo;re a Fit
      </a>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CREW WEEK — hero signature element. An EXAMPLE week, labelled as such:
// crews ready to install, hardly any measures feeding them.
// ─────────────────────────────────────────────────────────────────────────────
function CrewWeek() {
  const days: { d: string; measures: string[] }[] = [
    { d: "Mon", measures: ["LVP · 3 rooms"] },
    { d: "Tue", measures: [] },
    { d: "Wed", measures: [] },
    { d: "Thu", measures: ["Hardwood · stairs"] },
    { d: "Fri", measures: [] },
    { d: "Sat", measures: [] },
  ]
  return (
    <div className="rounded-2xl px-5 py-5 text-left"
         style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 10px 30px rgba(28,25,23,0.06)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
          In-home measures this week
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: C.subtle, color: C.muted }}>Example</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {days.map((day) => (
          <div key={day.d} className="rounded-lg p-1.5 min-h-[72px] flex flex-col"
               style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <span className="text-[10px] font-bold mb-1" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>{day.d}</span>
            {day.measures.length === 0 ? (
              <span className="text-[10px] mt-auto" style={{ color: "#A8A29E" }}>open</span>
            ) : day.measures.map((m) => (
              <span key={m} className="text-[9.5px] leading-tight rounded px-1 py-1 font-semibold"
                    style={{ background: C.orangeSoft, color: C.orangeDk }}>{m}</span>
            ))}
          </div>
        ))}
      </div>
      <p className="text-sm mt-3" style={{ color: C.muted }}>
        Two install crews ready to go. Two measures on the board. That gap is the whole problem.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WOUND HERO — shared shell; each page passes its ad-matched headline
// ─────────────────────────────────────────────────────────────────────────────
export function WoundHero({
  eyebrow = "For flooring contractors with their own install crews",
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
      className="relative flex flex-col justify-center pt-24 pb-16 px-4 sm:px-6 overflow-hidden"
      style={{ background: C.bg }}
    >
      {/* Faint plank grid, ink not orange, so the hero stays calm */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
           style={{
             backgroundImage: "linear-gradient(rgba(28,25,23,1) 1px, transparent 1px), linear-gradient(90deg, rgba(28,25,23,1) 1px, transparent 1px)",
             backgroundSize: "88px 22px", opacity: 0.035,
             WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 30%, #000 20%, transparent 80%)",
             maskImage: "radial-gradient(ellipse 90% 80% at 50% 30%, #000 20%, transparent 80%)",
           }} />

      <div className="relative max-w-2xl mx-auto w-full text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
          <span className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: C.text, fontFamily: "var(--font-jetbrains)" }}>
            {eyebrow}
          </span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
          className="font-extrabold tracking-tight mb-6"
          style={{
            color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
            fontSize: "clamp(2.2rem, 8vw, 3.8rem)", lineHeight: 1.06, textWrap: "balance",
          }}>
          {line1}
          <br />
          <span className="relative">
            {line2}
            <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
                  style={{ background: `linear-gradient(90deg, ${C.orange}, ${C.orangeDk})`,
                           transformOrigin: "left", animation: "underlineDraw 0.8s ease forwards 1s", transform: "scaleX(0)" }} />
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
          className="text-lg sm:text-xl leading-relaxed max-w-xl mx-auto mb-7"
          style={{ color: C.muted }}>
          {sub}
        </motion.p>

        {/* The offer card — the exact offer, on screen 1. Most visitors never scroll. */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.55 }}
          className="rounded-2xl px-6 py-5 mb-5 text-left"
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.orange}`, boxShadow: "0 10px 30px rgba(28,25,23,0.06)" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-2.5"
               style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>
            The offer
          </div>
          <p className="text-base sm:text-lg font-bold leading-snug mb-3.5"
             style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            {OFFER}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {["We run the ads", "Every homeowner answered in seconds", "Measures booked on your calendar"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-sm" style={{ color: C.text }}>
                <Check className="w-3.5 h-3.5" style={{ color: C.success }} aria-hidden="true" />
                {t}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}
          className="mb-8">
          <a href="#form"
             className="flex sm:inline-flex items-center justify-center gap-2 font-bold text-white px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-orange-600 w-full sm:w-auto"
             style={{ background: C.orange, boxShadow: "0 8px 24px rgba(249,115,22,0.25)", fontSize: "1.05rem" }}>
            See If We&rsquo;re a Fit
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <span className="block mt-3 text-sm" style={{ color: C.muted }}>
            Four quick questions, then pick a time to talk with Jonathan. He installs every account himself.
          </span>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.85, duration: 0.6 }}>
          <CrewWeek />
        </motion.div>
      </div>

      <style>{`@keyframes underlineDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PAIN — the six flooring pains, in the owner's words
// ─────────────────────────────────────────────────────────────────────────────
export function PainSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const pains = [
    { t: "Crews ready, calendar thin.", b: "Your installers can handle more square footage than the calendar feeds them. You have the crews, not the measures." },
    { t: "Shared leads.", b: "Angi and HomeAdvisor sold the same homeowner to four other companies. Half of them never pick up." },
    { t: "Whoever answers first wins.", b: "Homeowners message three or four flooring companies at once and book the one that gets back to them first." },
    { t: "The wasted drive.", b: "45 minutes out, tape measure in hand. Then: “my husband needs to be here before we decide.”" },
    { t: "Quotes that go quiet.", b: "The measure happens, the quote goes out, and nobody follows up. It never becomes a no. It just dies." },
    { t: "The winter dip.", b: "Early fall is busy. Then November to February slows down and the crews sit." },
  ]

  return (
    <section ref={ref} className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <Eyebrow>Sound familiar?</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-8" style={h2Style}>
            The installs are not the problem. Everything before and after the measure is.
          </h2>
        </motion.div>
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {pains.map((p, i) => (
            <motion.div key={p.t}
              initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.08 + i * 0.06, duration: 0.45 }}
              className="py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h3 className="font-bold text-base mb-1" style={{ color: C.text }}>{p.t}</h3>
              <p className="text-base leading-relaxed" style={{ color: C.muted }}>{p.b}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Back-compat alias for any page still importing the old name.
export const TryFailSection = PainSection

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE CHASE PREVIEW — compact visual of step 5. Always labelled as an
// example cadence, never presented as a real customer's numbers.
// ─────────────────────────────────────────────────────────────────────────────
export function QuoteChasePreview({ caption }: { caption: string }) {
  const steps = [
    { day: "Day 0", ch: "Quote sent", note: "Hardwood, 640 sq ft" },
    { day: "Day 2", ch: "Text", note: "“Any questions on the quote?”" },
    { day: "Day 4", ch: "Call", note: "No answer, voicemail left" },
    { day: "Day 7", ch: "Email", note: "Samples + install dates" },
    { day: "Day 9", ch: "Text", note: "“We can start the 14th. Want it?”" },
  ]
  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-2xl overflow-hidden"
           style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 16px 40px rgba(28,25,23,0.07)" }}>
        <div className="flex items-center justify-between px-5 py-3"
             style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
          <span className="text-xs font-semibold" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
            Quote follow-up &middot; the Millers
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: C.subtle, color: C.muted }}>Example</span>
        </div>
        <ol className="px-5 py-4 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-[11px] font-bold w-12 shrink-0 pt-0.5" style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>{s.day}</span>
              <span className="text-xs font-bold w-[4.5rem] shrink-0 pt-0.5" style={{ color: C.text }}>{s.ch}</span>
              <span className="text-xs leading-snug" style={{ color: C.muted }}>{s.note}</span>
            </li>
          ))}
          <li className="flex items-start gap-3 pt-2" style={{ borderTop: `1px dashed ${C.border}` }}>
            <span className="text-[11px] font-bold w-12 shrink-0 pt-0.5" style={{ color: C.success, fontFamily: "var(--font-jetbrains)" }}>Day 9</span>
            <span className="text-xs font-bold leading-snug" style={{ color: C.success }}>
              Signed. Install booked. Or a clear no, logged, so nobody wonders.
            </span>
          </li>
        </ol>
      </div>
      <p className="text-xs text-center mt-3 leading-relaxed" style={{ color: C.muted }}>
        {caption} An example, not a customer&rsquo;s actual results.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCH IT WORK — example homeowner conversation. Labelled as an example.
// The AI discloses it is an AI, never quotes a price, and confirms every
// decision maker will be home before it books the measure.
// ─────────────────────────────────────────────────────────────────────────────
export function WatchItWorkSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const messages: { time: string; from: "ai" | "lead"; text: string }[] = [
    { time: "8:17 PM", from: "ai",   text: "Hi Sarah, this is the AI assistant for Summit Floors. Saw your request about new flooring. What are you thinking, LVP, hardwood, carpet?" },
    { time: "8:19 PM", from: "lead", text: "LVP probably. living room, hallway and the kitchen" },
    { time: "8:19 PM", from: "ai",   text: "Nice, that's a popular combo. Roughly when do you want it done? And what's your ZIP?" },
    { time: "8:21 PM", from: "lead", text: "next month ideally. 75204. how much would that run?" },
    { time: "8:21 PM", from: "ai",   text: "Honest answer: the price comes from the measure, so it's real and not a guess. Will you and anyone else deciding on this both be home for it?" },
    { time: "8:23 PM", from: "lead", text: "my husband gets home around 5" },
    { time: "8:24 PM", from: "ai",   text: "Perfect. I have Thursday at 5:30 or Saturday at 10. Which works for both of you?" },
    { time: "8:25 PM", from: "lead", text: "thursday 5:30" },
    { time: "8:25 PM", from: "ai",   text: "Booked, Thursday 5:30pm. You'll get a reminder the day before, and you can reschedule right here if anything changes." },
  ]

  return (
    <section ref={ref} className="relative py-16 sm:py-20 px-4 sm:px-6 overflow-hidden" style={{ background: C.subtle }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          className="text-center mb-10">
          <Eyebrow center>Example conversation</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5" style={h2Style}>
            8:17 on a Tuesday night.
            <br />A measure on Thursday, with both of them home.
          </h2>
          <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: C.muted }}>
            A homeowner fills out a form from one of your ads. Here&rsquo;s the kind of
            conversation that happens next, while your shop is closed.
          </p>
        </motion.div>

        <div className="max-w-md mx-auto mb-4 space-y-3">
          {messages.map((m, i) => {
            const ai = m.from === "ai"
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.08 * i, duration: 0.4 }}
                className={`flex flex-col ${ai ? "items-end" : "items-start"}`}>
                <div className="max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-snug"
                     style={{
                       background: ai ? C.orangeSoft : C.surface,
                       border: `1px solid ${ai ? "rgba(249,115,22,0.22)" : C.border}`,
                       color: C.text,
                       borderTopRightRadius: ai ? 4 : 16,
                       borderTopLeftRadius: ai ? 16 : 4,
                     }}>
                  {m.text}
                </div>
                <span className="text-[11px] mt-1 px-1" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
                  {ai ? "AI" : "Sarah"} &middot; {m.time}
                </span>
              </motion.div>
            )
          })}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="rounded-2xl p-6 text-center mb-3"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-lg font-bold leading-snug mb-2" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Eight minutes. Project, rooms, timeline, ZIP, and both decision makers confirmed. Measure booked.
          </p>
          <p className="text-sm" style={{ color: C.muted }}>
            Nobody from the shop picked up a phone. If she had gone quiet, it would have followed up.
          </p>
        </motion.div>

        <div className="text-center mb-14">
          <a href="#form" className="inline-flex items-center gap-1.5 text-sm font-bold hover:underline underline-offset-4" style={{ color: C.orangeDk }}>
            See if this fits my area
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.9, duration: 0.6 }}>
          <QuoteChasePreview caption="And after the measure, the quote gets chased by text, call and email until it signs or says no." />
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HOW IT WORKS — the 5-step mechanism, in the doc's order.
// Optional intro override so a variant can open it on its own angle.
// ─────────────────────────────────────────────────────────────────────────────
export function HowItWorksSection({
  intro,
}: {
  intro?: { eyebrow?: string; heading: string; sub: string }
} = {}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const eyebrow = intro?.eyebrow ?? "How it works"
  const heading = intro?.heading ?? "Five steps from a homeowner scrolling Facebook to a signed install."
  const sub = intro?.sub ?? "We install it for you and run it with you. Your crews just show up to measure and install."

  const steps = [
    {
      title: "We run the ads.",
      body: "We build and run Meta ads for homeowners in your service area. You pay the ad spend straight to Meta. That's separate from our fee.",
    },
    {
      title: "Every lead answered in seconds.",
      body: "24/7, by text and phone. Nights, weekends, while you're on a job site. It tells homeowners it's an AI, and it never quotes a price.",
    },
    {
      title: "Qualified before it reaches your calendar.",
      body: "Project type (LVP, hardwood, carpet, tile, laminate), rough size and rooms, timeline, ZIP inside your area, and whether every decision maker will be home for the measure.",
    },
    {
      title: "Booked as an in-home measure.",
      body: "On your real estimator and crew availability, with a confirmation, a reminder the day before, and an easy way to reschedule, so measures don't no-show.",
    },
    {
      title: "Every quote chased.",
      body: "After the measure, by text, call and email, until the homeowner signs or says no. Nothing dies in a “let me think about it” pile.",
    },
  ]

  return (
    <section ref={ref} className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.bg }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3" style={h2Style}>{heading}</h2>
          <p className="text-lg leading-relaxed mb-10" style={{ color: C.muted }}>{sub}</p>
        </motion.div>

        <ol style={{ borderTop: `1px solid ${C.border}` }}>
          {steps.map((s, i) => (
            <motion.li key={i}
              initial={{ opacity: 0, x: -16 }} animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.5 }}
              className="flex items-start gap-4 py-5"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: C.surface, border: `1.5px solid ${C.orange}`, color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: C.text }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// Back-compat alias for any page still importing the old name.
export const ScopeSection = HowItWorksSection

// ─────────────────────────────────────────────────────────────────────────────
// 5. PROOF — Top Air numbers, ONLY labelled as "a live home-services account".
// There is no flooring result yet; this section says so out loud.
// ─────────────────────────────────────────────────────────────────────────────
export function ProofSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const rows = [
    { window: "In 24 hours", stats: [["27", "leads in"], ["14", "conversations"], ["3", "booked"]] },
    { window: "In 9 days", stats: [["130", "leads in"], ["77", "worked"], ["13", "booked"]] },
  ]

  return (
    <section ref={ref} className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <Eyebrow>The same engine, on a live account</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3" style={h2Style}>
            What it did for a live home-services account.
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: C.muted }}>
            This is not a flooring company. We don&rsquo;t have a flooring result to show
            you yet, and we won&rsquo;t make one up. This is the same answer, qualify
            and book engine running for a live home-services account.
          </p>
        </motion.div>

        <div className="space-y-4">
          {rows.map((r, i) => (
            <motion.div key={r.window}
              initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.5 }}
              className="rounded-2xl p-5" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3"
                   style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>{r.window}</div>
              <div className="grid grid-cols-3 gap-3">
                {r.stats.map(([n, l], j) => (
                  <div key={l}>
                    <div className="font-black leading-none mb-1"
                         style={{ color: j === 2 ? C.success : C.text, fontFamily: "var(--font-jetbrains)", fontSize: "clamp(1.6rem, 6vw, 2.2rem)" }}>
                      {n}
                    </div>
                    <div className="text-xs" style={{ color: C.muted }}>{l}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-xs mt-4" style={{ color: C.muted }}>
          Source: a live home-services account running FieldBuilt AI. Not a flooring account.
        </p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. REFRAME — you have the crews, not the measures
// ─────────────────────────────────────────────────────────────────────────────
export function ReframeSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.subtle }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6" style={h2Style}>
            You don&rsquo;t have a crew problem.
            <br />You have a measure problem.
          </h2>
          <p className="text-lg leading-relaxed mb-5" style={{ color: C.muted }}>
            Your installers are good. The shop can take on more square footage. What&rsquo;s
            missing is homeowners on the calendar, the right ones, with everyone who
            decides sitting at the kitchen table when you show up.
          </p>
          <p className="text-lg leading-relaxed" style={{ color: C.muted }}>
            And the slow months are coming. November to February is when a thin calendar
            hurts most. The measures booked now are the installs that keep your crews
            working through it.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED LEADS ROW — /start/tab only. The pain of buying shared leads, said
// plainly. No invented stats: these are the research pains, not numbers.
// ─────────────────────────────────────────────────────────────────────────────
export function SharedLeadsRow() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const items = [
    { value: "4 others",  label: "Got the same homeowner you paid for" },
    { value: "Half",      label: "Never pick up the phone" },
    { value: "First",     label: "To answer is who gets the measure" },
    { value: "Nobody",    label: "Chases the quote after" },
  ]

  return (
    <section ref={ref} className="relative py-14 px-4 sm:px-6" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55 }}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-8 text-center" style={h2Style}>
          What a shared lead actually gets you.
        </motion.h2>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, scale: 0.95 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
              className="text-center p-5 rounded-xl"
              style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              <div className="text-xl sm:text-2xl font-black mb-1" style={{ color: C.text, fontFamily: "var(--font-jetbrains)" }}>
                {it.value}
              </div>
              <div className="text-xs" style={{ color: C.muted }}>{it.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Back-compat alias.
export const EnterpriseCostRow = SharedLeadsRow

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE — /start/tab only. The fix isn't a better list.
// ─────────────────────────────────────────────────────────────────────────────
export function BridgeSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <section ref={ref} className="relative py-14 px-4 sm:px-6" style={{ background: C.bg }}>
      <div className="relative max-w-2xl mx-auto text-center">
        <motion.p initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55 }}
          className="text-xl sm:text-2xl font-bold leading-snug mb-5"
          style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
          The fix isn&rsquo;t a better lead list. It&rsquo;s homeowners who only asked you.
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1, duration: 0.55 }}
          className="text-base leading-relaxed max-w-xl mx-auto" style={{ color: C.muted }}>
          Ads that run for homeowners in your area, a reply in seconds so you&rsquo;re
          always first, and a measure booked with everyone who decides at home. Then
          the quote gets chased until it&rsquo;s a yes or a no.
        </motion.p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DECISION MAKER CHECK — /start/tech only (the wasted-drive angle). Shows
// what the AI confirms before a measure ever lands on the calendar.
// ─────────────────────────────────────────────────────────────────────────────
export function DecisionMakerSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const checks = [
    ["Project", "LVP, kitchen + hallway + living room"],
    ["Size", "About 3 rooms"],
    ["Timeline", "Next month"],
    ["ZIP", "Inside your service area"],
    ["Decision makers", "Both home Thursday 5:30pm"],
  ]

  return (
    <section ref={ref} className="relative py-16 px-4 sm:px-6" style={{ background: C.bg }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          className="mb-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3" style={h2Style}>
            Every measure is checked before you get in the truck.
          </h2>
          <p className="text-base leading-relaxed" style={{ color: C.muted }}>
            The AI asks the questions your best salesperson would, and it asks if
            everyone who decides will be home. Before it books, not after you drove out.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.15, duration: 0.6 }}
          className="max-w-md mx-auto rounded-2xl overflow-hidden"
          style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 16px 40px rgba(28,25,23,0.07)" }}>
          <div className="flex items-center justify-between px-5 py-3" style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            <span className="text-xs font-semibold" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>Measure booked &middot; Sarah M.</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.subtle, color: C.muted }}>Example</span>
          </div>
          <ul className="px-5 py-4 space-y-2.5">
            {checks.map(([k, v]) => (
              <li key={k} className="flex items-start gap-3 text-sm">
                <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                <span className="font-bold w-32 shrink-0" style={{ color: C.text }}>{k}</span>
                <span style={{ color: C.muted }}>{v}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FOUNDER TRUST — honest version. No fake logos, no flooring testimonials.
// ─────────────────────────────────────────────────────────────────────────────
export function FounderTrustSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <section ref={ref} className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.subtle }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          className="rounded-2xl p-7 sm:p-8"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2.5 mb-5">
            <Shield className="w-4 h-4" style={{ color: C.orangeDk }} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>The honest version</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4" style={h2Style}>
            No fake logos. No made-up flooring reviews.
          </h2>
          <p className="text-base leading-relaxed mb-4" style={{ color: C.muted }}>
            FieldBuilt is new to flooring, and I&rsquo;m not going to rent credibility with
            stock photos. What I can show you is the same engine running for a live
            home-services account, and the offer itself: {OFFER}
          </p>
          <p className="text-base leading-relaxed" style={{ color: C.muted }}>
            I&rsquo;m Jonathan. I install every account myself, which is why I only take
            on a few at a time.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. OFFER — the offer, what's included, and the one thing paid separately.
// No price. No failure terms.
// ─────────────────────────────────────────────────────────────────────────────
export function OfferSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const items = [
    "Meta ads built and run for homeowners in your service area",
    "Every lead answered in seconds, 24/7, by text and phone",
    "Qualified on project, size, timeline, ZIP and decision makers",
    "Booked as an in-home measure, with confirmation and a reminder",
    "Every quote chased by text, call and email until it signs or says no",
    "Installed by Jonathan, set up around how you already run measures",
  ]

  return (
    <section ref={ref} className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.bg }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <Eyebrow>The offer</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-8" style={h2Style}>
            {OFFER}
          </h2>
        </motion.div>

        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {items.map((txt, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.45 }}
              className="flex items-start gap-4 py-4"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: C.success }} aria-hidden="true" />
              <span className="text-base" style={{ color: C.text }}>{txt}</span>
            </motion.div>
          ))}
        </div>
        <p className="text-sm leading-relaxed mt-5" style={{ color: C.muted }}>
          <strong style={{ color: C.text }}>Paid separately:</strong> the ad spend, which
          you pay directly to Meta. We go over everything else on the call.
        </p>
      </div>
    </section>
  )
}

// Back-compat alias.
export const WedgeSection = OfferSection

// ─────────────────────────────────────────────────────────────────────────────
// 8. LEAD FORM — flooring qualifier, client-side qualification, 3 states
//
// Fields: business type, install crews, service area, first name, phone, email.
// Qualified = has at least one install crew (pivot doc: "Not a fit: one-person
// installers with no crew"). No revenue question: no threshold is set yet.
//
// Submission contract: POSTs to /api/lead-intake, which today only reads
// first_name, phone, email, qualified, angle (and optional techs/revenue/tier
// for its notes line). The new flooring answers are sent as explicit fields
// AND folded into `angle` so they land in the lead's notes with the current
// server code. Once lead-intake reads business_type / crews / service_area
// directly, drop them from `angle`.
// ─────────────────────────────────────────────────────────────────────────────
type FormPhase = "form" | "qualified" | "noqual"

const BUSINESS_TYPES = [
  { value: "shop-at-home",        label: "Shop-at-home flooring" },
  { value: "showroom-installs",   label: "Showroom that installs" },
  { value: "installer-led",       label: "Installer-led contractor" },
] as const

const CREW_OPTIONS = [
  { value: "0",   label: "None yet" },
  { value: "1",   label: "1" },
  { value: "2-3", label: "2–3" },
  { value: "4+",  label: "4+" },
] as const

function isQualified(crews: string): boolean {
  return crews !== "" && crews !== "0"
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

const fieldClass = "focus:outline-none focus:ring-[3px] focus:ring-orange-500/20 focus:border-orange-500"

export function LeadFormSection({
  source,
  heading = "See if your area is a fit. Takes 30 seconds.",
  sub,
}: {
  source: string
  heading?: React.ReactNode
  sub?: React.ReactNode
}) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<FormPhase>("form")
  const [businessType, setBusinessType] = useState("")
  const [crews, setCrews] = useState("")
  const [serviceArea, setServiceArea] = useState("")
  const [firstName, setFirstName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.reportValidity()) return

    const qualified = isQualified(crews)
    const area = serviceArea.trim()

    // Same-origin proxy — see app/api/lead-intake/route.ts for why this
    // doesn't call the agent directly (the shared secret must never ship to
    // the browser). `angle` carries the flooring answers into the notes line
    // until the route reads the explicit fields.
    fetch("/api/lead-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        phone,
        email,
        business_type: businessType,
        crews,
        service_area: area,
        qualified,
        vertical: "flooring",
        angle: `${source} | ${businessType} | crews: ${crews} | area: ${area}`,
      }),
    }).catch(() => {})

    // Meta Pixel: Lead fires ONLY for qualified submissions, so "optimize for
    // Leads" trains delivery on qualified contractors only.
    if (qualified && typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Lead", { content_name: source })
      window.fbq("trackCustom", "QualifiedLead", { business_type: businessType, crews, source })
    }

    setPhase(qualified ? "qualified" : "noqual")
    document.getElementById("form")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
  }

  return (
    <section id="form" className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.subtle }}>
      <div className="relative max-w-2xl mx-auto">
        <div className="rounded-3xl p-6 sm:p-9"
             style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(28,25,23,0.08)" }}>

          {/* ── STATE 1: the form ── */}
          {phase === "form" && (
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"
                  style={{ ...h2Style, letterSpacing: "-0.02em" }}>
                {heading}
              </h2>
              <p className="text-base leading-relaxed mb-7" style={{ color: C.muted }}>
                {sub ?? (
                  <>
                    Four quick questions, then pick a time for a 20-minute call with
                    Jonathan. We&rsquo;ll look at your area, your crews, and{" "}
                    <strong style={{ color: C.text }}>how 20 in-home measures in 60 days would land on your calendar.</strong>
                  </>
                )}
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="lf-business" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                      What kind of flooring business?
                    </label>
                    <select id="lf-business" required value={businessType} onChange={(e) => setBusinessType(e.target.value)}
                            className={fieldClass} style={inputStyle}>
                      <option value="" disabled>Select</option>
                      {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lf-crews" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                      How many install crews?
                    </label>
                    <select id="lf-crews" required value={crews} onChange={(e) => setCrews(e.target.value)}
                            className={fieldClass} style={inputStyle}>
                      <option value="" disabled>Select</option>
                      {CREW_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="lf-area" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                    Service area (city, state)
                  </label>
                  <input id="lf-area" type="text" autoComplete="address-level2" required placeholder="e.g. Dallas, TX"
                         value={serviceArea} onChange={(e) => setServiceArea(e.target.value)}
                         className={fieldClass} style={inputStyle} />
                </div>

                <div className="mb-4">
                  <label htmlFor="lf-name" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                    First name
                  </label>
                  <input id="lf-name" type="text" autoComplete="given-name" required
                         value={firstName} onChange={(e) => setFirstName(e.target.value)}
                         className={fieldClass} style={inputStyle} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label htmlFor="lf-phone" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                      Mobile phone
                    </label>
                    <input id="lf-phone" type="tel" autoComplete="tel" inputMode="tel" required
                           value={phone} onChange={(e) => setPhone(e.target.value)}
                           className={fieldClass} style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="lf-email" className="block text-sm font-bold mb-1.5" style={{ color: C.text }}>
                      Email
                    </label>
                    <input id="lf-email" type="email" autoComplete="email" required
                           value={email} onChange={(e) => setEmail(e.target.value)}
                           className={fieldClass} style={inputStyle} />
                  </div>
                </div>

                <div className="flex items-start gap-2.5 mb-5">
                  <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                  <p className="text-sm" style={{ color: C.muted }}>
                    No spam, no list. You&rsquo;ll get{" "}
                    <strong style={{ color: C.text }}>one text from us</strong> within a minute to lock in your time.
                  </p>
                </div>

                <button type="submit"
                        className="flex items-center justify-center gap-2 w-full font-bold text-white py-4 rounded-xl transition-colors duration-200 hover:bg-orange-600 text-lg focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-orange-600 focus-visible:outline-offset-2"
                        style={{ background: C.orange, boxShadow: "0 8px 24px rgba(249,115,22,0.25)" }}>
                  Check My Area
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </button>
                <p className="text-center text-xs mt-3" style={{ color: C.muted }}>
                  For US flooring contractors with their own install crews.
                </p>
              </form>
            </div>
          )}

          {/* ── STATE 2: qualified — booking ── */}
          {phase === "qualified" && (
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4"
                    style={{ background: "rgba(22,163,74,0.10)", color: "#15803D", border: "1px solid rgba(22,163,74,0.20)" }}>
                &#10003; Looks like a fit. Pick your time.
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"
                  style={{ ...h2Style, letterSpacing: "-0.02em" }}>
                {firstName ? `${firstName}, grab 20 minutes below.` : "Grab 20 minutes below."}
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: C.muted }}>
                Lock in the call now while you&rsquo;re here. It takes 10 seconds. We&rsquo;ll
                come ready to talk about {serviceArea.trim() ? serviceArea.trim() : "your area"}, your crews, and
                where measures and quotes slip through today.
              </p>

              <GhlBookingWidget />

              <div className="flex items-start gap-3 mt-5 p-4 rounded-xl"
                   style={{ background: C.orangeSoft, border: "1px solid rgba(249,115,22,0.20)" }}>
                <Phone className="w-5 h-5 mt-0.5 shrink-0" style={{ color: C.orangeDk }} aria-hidden="true" />
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>
                  <strong>Check your phone.</strong>{" "}
                  You&rsquo;ll get a text in about 60 seconds. That&rsquo;s the same kind of
                  AI that would be answering <em>your</em> homeowners. Consider it the first demo.
                </p>
              </div>
            </div>
          )}

          {/* ── STATE 3: not a fit — gracious exit ── */}
          {phase === "noqual" && (
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4"
                  style={{ ...h2Style, letterSpacing: "-0.02em" }}>
                Straight answer: we&rsquo;re not the right fit yet.
              </h2>
              <p className="text-base leading-relaxed mb-4" style={{ color: C.muted }}>
                FieldBuilt is built for flooring contractors with their own install crews.
                The whole point is filling crews&rsquo; calendars with measures and installs,
                so without a crew there&rsquo;s nothing for it to fill yet. I&rsquo;d rather
                tell you that now than waste your time on a call.
              </p>
              <p className="text-base leading-relaxed mb-7" style={{ color: C.muted }}>
                <strong style={{ color: C.text }}>What I&rsquo;d do in your seat:</strong>{" "}
                answer every homeowner inside 5 minutes, even with a simple auto-text, and
                follow up on every quote you send at least three times. When you&rsquo;ve got
                a crew of your own, come back.
              </p>
              <a href="https://fieldbuiltai.com"
                 className="flex items-center justify-center gap-2 w-full font-bold py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5 text-lg"
                 style={{ background: C.surface, color: C.text, border: `1.5px solid ${C.text}` }}>
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
// 9. FAQ — the real objections
// ─────────────────────────────────────────────────────────────────────────────
export function FaqSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const faqs = [
    {
      q: "Who pays for the ads?",
      a: "We build and run the Meta ads for homeowners in your service area. You pay the ad spend directly to Meta. That's separate from our fee, and we go over both on the call.",
    },
    {
      q: "Is a real person texting my homeowners?",
      a: "No. It's an AI and it says so. It answers in seconds, asks about the project, rooms, timeline and ZIP, checks that everyone who decides will be home, and books the measure. It never quotes a price. Your quote comes from you, after the measure.",
    },
    {
      q: "What happens after the measure?",
      a: "Every quote gets chased by text, call and email until the homeowner signs or says no. No more quotes sitting in a “let me think about it” pile that nobody checks.",
    },
    {
      q: "Do I have to change how my office runs?",
      a: "No. Jonathan installs it around how you already run measures and installs. Your team keeps working the way it works. The AI takes the nights, the weekends, and the follow-up nobody has time for.",
    },
    {
      q: "What does it cost?",
      a: "That depends on your area and your crews, so it's the first thing we cover on the call.",
    },
  ]

  return (
    <section ref={ref} className="relative py-16 px-4 sm:px-6" style={{ background: C.bg }}>
      <div className="relative max-w-2xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55 }}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-8"
          style={{ ...h2Style, letterSpacing: "-0.02em" }}>
          What flooring owners ask first
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
    // the form section itself is on screen (it would cover the booking widget).
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
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-4 pt-3"
      style={{
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        background: "linear-gradient(180deg, rgba(250,250,248,0) 0%, rgba(250,250,248,0.95) 35%)",
      }}
    >
      <a href="#form"
         className="flex items-center justify-center gap-2 w-full font-bold text-white py-4 rounded-xl text-base"
         style={{ background: C.orange, boxShadow: "0 8px 24px rgba(249,115,22,0.25)" }}>
        See If We&rsquo;re a Fit
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </a>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL FOOTER  (also used by /book — keep the no-props signature)
// ─────────────────────────────────────────────────────────────────────────────
export function MinimalFooter() {
  return (
    <footer className="py-8 px-4 sm:px-6 text-center"
            style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
          <FieldFMark size={15} />
        </div>
        <Wordmark size="text-base" />
      </div>
      <p className="text-xs mb-4" style={{ color: C.muted }}>
        In-home measures and quote follow-up for flooring contractors. Installed for you.
      </p>
      <div className="flex items-center justify-center gap-6">
        <a href="/privacy" className="text-xs hover:underline underline-offset-4" style={{ color: C.muted }}>Privacy</a>
        <a href="/terms"   className="text-xs hover:underline underline-offset-4" style={{ color: C.muted }}>Terms</a>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL PAGE BODY — everything below the hero, identical on every variant that
// uses it
// ─────────────────────────────────────────────────────────────────────────────
export function LandingBody({ source }: { source: string }) {
  return (
    <>
      <PainSection />
      <HowItWorksSection />
      <ProofSection />
      <ReframeSection />
      <OfferSection />
      <LeadFormSection source={source} />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </>
  )
}

// Kept for back-compat with any page still importing it.
export { GhlBookingWidget as BookingCalendar }
