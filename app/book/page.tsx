"use client"

// ─── BOOKING PAGE — /book ────────────────────────────────────────────────────
// Warm-traffic booking page. Page order follows the buyer's question stack:
//   what is this → why believe you → what's it worth to ME → book it
// so the calendar sits AFTER the proof and the revenue math, not before it.
// A hero CTA anchor-scrolls straight to #book for anyone already sold.
//
// Messaging spine (ICP: HVAC owners, 4–15 techs, ~$1M+):
//   Surface desire: more booked jobs.
//   Real desire: predictable capacity without the owner holding it together.
// We sell "an AI front office that gets installed", never software/platform.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react"
import { motion, useInView } from "framer-motion"
import {
  Zap, MessagesSquare, CalendarCheck, Repeat, Check, X, Star, ChevronDown,
  Route, ClipboardList, BarChart3, Moon, TrendingUp, Bell, ArrowDown, Phone,
} from "lucide-react"
import { C, FieldFMark, GhlBookingWidget, MinimalFooter } from "@/components/landing/shared"

// Drop a headshot in /public/brand and set this to e.g. "/brand/jonathan.jpg".
// While empty the founder card falls back to a monogram — never a broken image.
const FOUNDER_PHOTO_URL = ""

// ── Section reveal helper ─────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-70px" })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 22 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }} className={className}>
      {children}
    </motion.div>
  )
}

// ── The one CTA, repeated ─────────────────────────────────────────────────────
// Same words every time so the offer never drifts: it names what happens on the
// call, not what the call is called. "Strategy session" is the language this
// buyer has been burned by.
function Cta({ tone = "light", compact = false }: { tone?: "light" | "dark"; compact?: boolean }) {
  return (
    <div className="text-center">
      <a href="#book"
         className="inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition-transform hover:scale-[1.03]"
         style={{ background: C.orange, boxShadow: "0 8px 32px rgba(249,115,22,0.40)",
                  padding: compact ? "15px 26px" : "17px 30px",
                  fontSize: "clamp(0.95rem, 2.6vw, 1.05rem)", lineHeight: 1.25, maxWidth: "94vw" }}>
        Watch It Run On Your Own Leads &mdash; 20 Minutes
        <ArrowDown className="w-4 h-4 shrink-0 hidden sm:block" aria-hidden="true" />
      </a>
      <p className="text-sm leading-relaxed max-w-md mx-auto mt-4"
         style={{ color: tone === "dark" ? "rgba(250,250,248,0.52)" : C.muted }}>
        Screen share, no pitch deck. You&rsquo;ll see the live dashboard and your own
        leak map. If the numbers don&rsquo;t make the case, you owe nothing.
      </p>
    </div>
  )
}

// ── PROOF ────────────────────────────────────────────────────────────────────
// Marker red — deliberately NOT the brand orange. This is the "circled it by
// hand" colour: it reads as evidence marked up, not as designed marketing.
const PROOF_RED = "#DC2626"

// Screenshots live in /public/proof and are cropped above the jobs list, which
// contains real homeowners' names, addresses and phone numbers.
const PROOFS = [
  {
    img: "/proof/proof-24h.png",
    h: 486,
    alt: "FieldBuilt dashboard, Aug 2 to Aug 3: 27 new leads, 14 AI conversations, 3 jobs booked, $756 of work booked",
    headline: "14 cold leads → 3 booked jobs. In under 24 hours.",
    caption: "Day one live. Nobody in the office picked up a phone.",
  },
  {
    img: "/proof/proof-9days.png",
    h: 588,
    alt: "FieldBuilt dashboard, Aug 2 to Aug 11: 130 new leads, 77 AI conversations, 13 jobs booked, $2,646 of work booked",
    headline: "77 cold leads → 13 booked jobs in 9 days.",
    caption: "Same shop, first 9 days. No new ad spend. No new hires.",
  },
]

// ── The four that separate this from an AI receptionist ──────────────────────
const CORE = [
  { icon: Zap, label: "Answered instantly",
    body: "Every lead gets a real text back in 2 seconds. 2am, Sunday, Christmas morning." },
  { icon: MessagesSquare, label: "Qualified properly",
    body: "Asks what your best CSR would ask, and screens out tire-kickers before they cost a truck roll." },
  { icon: CalendarCheck, label: "Booked, not contacted",
    body: "Real slots on your real calendar, with the right tech assigned. Not a message taken." },
  { icon: Repeat, label: "Chased for two weeks",
    body: "Didn't book today? SMS, Messenger, WhatsApp, then a phone call, until they book or say stop." },
]

const EXTRAS = [
  { icon: Route, text: "Smart dispatch — routes by service area, job type and who actually closes it" },
  { icon: ClipboardList, text: "Every conversation saved to the lead file, street view included" },
  { icon: Bell, text: "Confirmations, day-before reminders and a reschedule flow that rescues cancellations" },
  { icon: Phone, text: "Inbound and outbound calls, plus Messenger and WhatsApp on the same brain" },
  { icon: BarChart3, text: "Close rate and revenue per tech, per job type, per lead source — live" },
  { icon: TrendingUp, text: "Writes the booked job into Housecall Pro with the technician assigned" },
  { icon: Moon, text: "Runs nights, weekends and holidays without anyone watching it" },
]

const FIT_YES = [
  "You run 4 to 15 technicians",
  "You already pay for leads (Facebook, Google, Angi)",
  "Leads go quiet after hours and on weekends",
  "You want the calendar full without another office hire",
]
const FIT_NO = [
  "You run 1 to 3 techs — there isn't enough to dispatch yet",
  "You want software you configure yourself",
  "All your work is word of mouth, with no inbound lead flow",
]

const FAQ = [
  {
    q: "Does it sound like a robot?",
    a: "Read the transcripts on the call and decide for yourself. It texts in plain language, handles “I’m just getting quotes” without pushing, and never diagnoses or quotes a job price. If a homeowner asks whether they’re talking to a person, it tells them the truth straight away.",
  },
  {
    q: "What happens to my CRM?",
    a: "Nothing. It plugs into what you already run. On Housecall Pro your CRM stays the system of record — every booking is written in with the right technician assigned, so your office keeps working exactly the way it works now. You are not migrating anything.",
  },
  {
    q: "How does it know which tech to send?",
    a: "It pulls your technician roster, their service areas, skills and availability, then books into a real open slot with the right person on it. A duct job in one metro doesn't get handed to the tech two hours away.",
  },
  {
    q: "What happens after the 14 days?",
    a: "If it worked, installation is $5,997 and it runs for $799 a month. No contract — cancel any time and your data leaves with you. If it didn't work, you walk away owing nothing and you keep the leak map.",
  },
  {
    q: "How long does setup take?",
    a: "I install it myself. Most shops are live within a day — you hand over access, I do the rest, and you watch the first conversations come in.",
  },
]

// ── TRUST BADGES ─────────────────────────────────────────────────────────────
// Inline SVG, not pasted images: the marks stay sharp, carry no white box, and
// cost no network request. Claim-only by default — set GOOGLE_RATING to a REAL
// Business Profile rating and the badge switches to stars on its own.
const GOOGLE_RATING: string | null = null
const GOOGLE_REVIEW_COUNT: number | null = null

function GoogleGMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

function MetaVerifiedMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path fill="#0866FF" d="M12.00 0.60 Q15.73 0.52 18.70 2.78 Q21.76 4.91 22.84 8.48 Q24.07 12.00 22.84 15.52 Q21.76 19.09 18.70 21.22 Q15.73 23.48 12.00 23.40 Q8.27 23.48 5.30 21.22 Q2.24 19.09 1.16 15.52 Q-0.07 12.00 1.16 8.48 Q2.24 4.91 5.30 2.78 Q8.27 0.52 12.00 0.60 Z" />
      <path d="M7.4 12.3 L10.6 15.4 L16.8 8.9" fill="none" stroke="#FFFFFF" strokeWidth="2.3"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrustBadges() {
  const pill = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    boxShadow: "0 2px 10px rgba(28,25,23,0.05)",
  } as const
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
      <div className="inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2" style={pill}>
        <GoogleGMark />
        {GOOGLE_RATING ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-3.5 h-3.5" style={{ fill: "#FBBC05", color: "#FBBC05" }} />
              ))}
            </span>
            <span className="text-[13px] font-bold" style={{ color: C.text }}>{GOOGLE_RATING}</span>
            {GOOGLE_REVIEW_COUNT ? (
              <span className="text-[12px]" style={{ color: C.muted }}>({GOOGLE_REVIEW_COUNT})</span>
            ) : null}
          </span>
        ) : (
          <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: C.text }}>
            Google Verified Business
          </span>
        )}
      </div>
      <div className="inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2" style={pill}>
        <MetaVerifiedMark />
        <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: C.text }}>Meta Verified</span>
      </div>
    </div>
  )
}

// ── Revenue math you can drive ────────────────────────────────────────────────
// Replaces the old unexplained "$47K–$156K" range. A visible calculation the
// visitor drives with their own ticket size turns a claim into a demonstration.
function RevenueMath() {
  const [jobs, setJobs] = useState(25)
  const [ticket, setTicket] = useState(350)
  const monthly = jobs * ticket
  const yearly = monthly * 12
  const money = (n: number) => "$" + n.toLocaleString("en-US")

  const tile = {
    color: "#F5F3F0", fontFamily: "var(--font-jetbrains)", fontWeight: 700,
    background: "rgba(250,250,248,0.06)", border: "1px solid rgba(250,250,248,0.10)",
    borderRadius: 10, padding: "8px 12px", fontVariantNumeric: "tabular-nums" as const,
    fontSize: "clamp(0.95rem, 3.4vw, 1.125rem)",
  }
  const op = {
    color: "rgba(250,250,248,0.40)", fontFamily: "var(--font-jetbrains)",
    fontWeight: 700, fontSize: "1.05rem",
  }
  const slider = {
    width: "100%", height: 6, borderRadius: 999, appearance: "none" as const,
    accentColor: C.orange, background: "rgba(250,250,248,0.14)", cursor: "pointer",
  }

  return (
    <div className="rounded-3xl px-5 sm:px-9 py-8 sm:py-10"
         style={{ background: "linear-gradient(160deg, rgba(249,115,22,0.09) 0%, rgba(249,115,22,0.03) 100%)",
                  border: "1px solid rgba(249,115,22,0.26)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>

      {/* the two dials */}
      <div className="grid sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <label htmlFor="rm-jobs" className="text-sm font-semibold" style={{ color: "rgba(250,250,248,0.72)" }}>
              Extra jobs a month
            </label>
            <span className="text-xl font-bold tabular-nums"
                  style={{ color: "#F5F3F0", fontFamily: "var(--font-jetbrains)" }}>{jobs}</span>
          </div>
          <input id="rm-jobs" type="range" min={5} max={50} step={1} value={jobs}
                 onChange={(e) => setJobs(Number(e.target.value))} style={slider} />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <label htmlFor="rm-ticket" className="text-sm font-semibold" style={{ color: "rgba(250,250,248,0.72)" }}>
              Your average ticket
            </label>
            <span className="text-xl font-bold tabular-nums"
                  style={{ color: "#F5F3F0", fontFamily: "var(--font-jetbrains)" }}>{money(ticket)}</span>
          </div>
          <input id="rm-ticket" type="range" min={150} max={1500} step={25} value={ticket}
                 onChange={(e) => setTicket(Number(e.target.value))} style={slider} />
        </div>
      </div>

      {/* the arithmetic, shown on purpose */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mb-7 text-center">
        <span style={tile}>{jobs} jobs</span>
        <span style={op}>×</span>
        <span style={tile}>{money(ticket)}</span>
        {/* the equals travels with its result so it never strands at a line end */}
        <span className="inline-flex items-center gap-3 whitespace-nowrap">
          <span style={op}>=</span>
          <span style={tile}>{money(monthly)} a month</span>
        </span>
      </div>

      {/* the payoff */}
      <div className="text-center">
        <div className="font-bold leading-none tabular-nums"
             style={{ color: "#A3E635", fontFamily: "var(--font-jetbrains)",
                      fontSize: "clamp(2.4rem, 9vw, 4rem)", letterSpacing: "-0.02em",
                      textShadow: "0 0 44px rgba(163,230,53,0.40)" }}>
          {money(yearly)}
        </div>
        <div className="text-sm font-semibold uppercase tracking-[0.18em] mt-3"
             style={{ color: "rgba(163,230,53,0.80)", fontFamily: "var(--font-jetbrains)" }}>
          recovered in a year
        </div>
      </div>

      <p className="text-xs leading-relaxed text-center mt-7 pt-6 max-w-md mx-auto"
         style={{ color: "rgba(250,250,248,0.42)", borderTop: "1px solid rgba(250,250,248,0.08)" }}>
        Starting point comes from the shop above: 13 jobs in 9 days is about 43 a
        month. We set the dial lower on purpose. Drag both to your own numbers.
      </p>
    </div>
  )
}

export default function BookPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      {/* ── Slim header — carries a permanent route to the calendar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 sm:px-6 py-3.5"
              style={{ background: "rgba(26,22,20,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(249,115,22,0.10)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
            <FieldFMark size={18} />
          </div>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            FIELDBUILT
            <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
                  style={{ fontSize: "0.42em", background: C.orange, padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}>
              AI
            </span>
          </span>
        </div>
        <a href="#book"
           className="inline-flex items-center gap-1.5 rounded-lg text-[13px] sm:text-sm font-bold text-white transition-transform hover:scale-[1.04] px-3.5 sm:px-4 py-2 whitespace-nowrap"
           style={{ background: C.orange, boxShadow: "0 4px 16px rgba(249,115,22,0.35)" }}>
          Book a walkthrough
        </a>
      </header>

      {/* ── 1. HERO ── */}
      <section className="relative flex flex-col justify-center pt-28 sm:pt-32 pb-14 px-6 overflow-hidden"
               style={{ background: "linear-gradient(180deg, #141110 0%, #1A1614 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
             style={{
               backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
               backgroundSize: "44px 44px", opacity: 0.055,
               WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
               maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
             }} />
        <motion.div animate={{ y: [0, -22, 0], x: [0, 10, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full blur-3xl pointer-events-none" aria-hidden="true"
          style={{ width: 620, height: 620, background: "rgba(249,115,22,0.08)", top: "-16%", left: "-8%" }} />

        <div className="relative max-w-4xl mx-auto w-full text-center">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full mb-7 text-[11px] sm:text-sm font-extrabold uppercase tracking-widest text-white whitespace-nowrap"
            style={{ background: C.orange, boxShadow: "0 4px 20px rgba(249,115,22,0.45)", fontFamily: "var(--font-jetbrains)" }}>
            For HVAC shops running 4+ techs
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7 }}
            className="font-extrabold tracking-tight mb-6"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                     fontSize: "clamp(1.55rem, 5.4vw, 3.2rem)", lineHeight: 1.08, textWrap: "balance" }}>
            Get 25 Extra HVAC Jobs a Month On Autopilot
            <br /><span style={{ color: C.orange }}>
              With a New HVAC{" "}
              <br className="sm:hidden" />
              Operations Office
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.6 }}
            className="text-lg leading-relaxed max-w-2xl mx-auto mb-9" style={{ color: "rgba(250,250,248,0.62)" }}>
            One HVAC company booked <strong style={{ color: "#F5F3F0" }}>13 jobs in 9 days</strong> from
            leads their office had given up on. No new ad spend, no new hires. Book a
            20-minute walkthrough and watch it run on your own leads.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.55 }}>
            <Cta tone="dark" />
          </motion.div>
        </div>
      </section>

      {/* ── 2. PROOF — kept short: two screenshots, one line each ── */}
      <section className="relative py-16 sm:py-20 px-6 overflow-hidden" style={{ background: "#201A17" }}>
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.10) 1.2px, transparent 1.2px)", backgroundSize: "30px 30px",
                      WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)",
                      maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)" }} />
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="w-8 h-px" style={{ background: PROOF_RED }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#FCA5A5", fontFamily: "var(--font-jetbrains)" }}>
                Proof
              </span>
              <span className="w-8 h-px" style={{ background: PROOF_RED }} />
            </div>
            <h2 className="font-extrabold tracking-tight"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                         fontSize: "clamp(2.1rem, 7.2vw, 3.4rem)", lineHeight: 1.05, textWrap: "balance" }}>
              Turn your cold{" "}
              <br className="sm:hidden" />
              leads{" "}
              <br className="hidden sm:inline" />
              <span style={{ color: C.orange }}>into cash.</span>
            </h2>
          </Reveal>

          {PROOFS.map((p, i) => (
            <Reveal key={p.img} delay={0.05 + i * 0.08} className="mb-10 last:mb-0">
              <div className="flex justify-center mb-4">
                <div className="rounded-2xl px-5 sm:px-6 py-3 text-center"
                     style={{ background: PROOF_RED, border: "3px solid rgba(255,255,255,0.92)",
                              boxShadow: "0 10px 34px rgba(220,38,38,0.40)" }}>
                  <span className="block font-extrabold text-white leading-tight"
                        style={{ fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.02rem, 3.4vw, 1.5rem)",
                                 letterSpacing: "-0.01em", textWrap: "balance" }}>
                    {p.headline}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden"
                   style={{ border: `3px solid ${PROOF_RED}`, boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
                <img src={p.img} alt={p.alt} width={1200} height={p.h} className="w-full block" loading="lazy" />
              </div>
              <p className="text-center text-sm leading-relaxed mt-4" style={{ color: "rgba(250,250,248,0.58)" }}>
                {p.caption}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 3. THE MATH, DRIVEN BY THE VISITOR ── */}
      <section className="relative py-16 sm:py-20 px-6 overflow-hidden" style={{ background: "#1A1614" }}>
        <div className="relative max-w-2xl mx-auto">
          <Reveal className="text-center mb-9">
            <h2 className="font-extrabold tracking-tight mb-3"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
              What is that worth
              <br /><span style={{ color: "#A3E635" }}>in your shop?</span>
            </h2>
            <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: "rgba(250,250,248,0.55)" }}>
              Put your own ticket size in. The number moves with it.
            </p>
          </Reveal>

          <Reveal delay={0.1}><RevenueMath /></Reveal>

          <Reveal delay={0.15} className="mt-10">
            <Cta tone="dark" compact />
          </Reveal>
        </div>
      </section>

      {/* ── 4. CALENDAR — met at the moment of belief, not before ── */}
      <section id="book" className="relative px-6 overflow-hidden scroll-mt-20" style={{ background: C.bg }}>
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" aria-hidden="true"
             style={{ background: "linear-gradient(180deg, #1A1614 0%, rgba(250,250,248,0) 100%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px",
                      WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 80%)",
                      maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 80%)" }} />

        <div className="relative max-w-3xl mx-auto pt-16 pb-16">
          <Reveal delay={0.05}>
            <div className="rounded-3xl p-2 sm:p-3"
                 style={{ background: C.surface, border: `1px solid ${C.border}`,
                          boxShadow: "0 24px 60px rgba(249,115,22,0.10), 0 4px 20px rgba(0,0,0,0.05)" }}>
              <GhlBookingWidget />
            </div>
          </Reveal>

          {/* founder-voice scarcity, directly under the widget where it counts */}
          <Reveal delay={0.1}>
            <p className="text-center text-sm sm:text-base font-semibold leading-relaxed mt-6 max-w-lg mx-auto"
               style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              I take a couple of shops a month. When the calendar&rsquo;s full, it&rsquo;s full.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6">
              {["No pitch deck — the product on screen", "Built and installed by the founder", "Free for 14 days on your real leads"].map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: C.muted }}>
                  <Check className="w-4 h-4 shrink-0" style={{ color: C.success }} aria-hidden="true" /> {t}
                </span>
              ))}
            </div>
            <TrustBadges />
          </Reveal>
        </div>
      </section>

      {/* ── 5. THE FOUR THINGS THAT MATTER (+ the rest, folded away) ── */}
      <section className="relative py-16 sm:py-20 px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-10">
            <h2 className="font-extrabold tracking-tight mb-3"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
              An answering service takes a message.
              <br /><span style={{ color: C.orangeDk }}>This one books the job.</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {CORE.map((b, i) => (
              <Reveal key={b.label} delay={0.05 + (i % 2) * 0.07}>
                <div className="h-full rounded-2xl p-6 flex items-start gap-4"
                     style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                       style={{ background: "rgba(249,115,22,0.10)" }}>
                    <b.icon className="w-5 h-5" style={{ color: C.orangeDk }} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1.5"
                        style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.01em" }}>
                      {b.label}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{b.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <details className="group rounded-2xl overflow-hidden"
                     style={{ background: C.subtle, border: `1px solid ${C.border}` }}>
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-6 py-4">
                <span className="font-bold text-sm sm:text-base" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                  Everything else it does
                </span>
                <ChevronDown className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180"
                             style={{ color: C.orangeDk }} aria-hidden="true" />
              </summary>
              <ul className="px-6 pb-6 pt-1 space-y-3">
                {EXTRAS.map((e) => (
                  <li key={e.text} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: C.muted }}>
                    <e.icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.orangeDk }} aria-hidden="true" />
                    {e.text}
                  </li>
                ))}
              </ul>
            </details>
          </Reveal>

          <Reveal delay={0.15} className="mt-12">
            <Cta compact />
          </Reveal>
        </div>
      </section>

      {/* ── 6. FIT CHECK — selectivity that also pre-qualifies the booking ── */}
      <section className="relative py-16 sm:py-20 px-6" style={{ background: C.subtle }}>
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-10">
            <h2 className="font-extrabold tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
              This isn&rsquo;t for every shop.
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4">
            <Reveal delay={0.05}>
              <div className="h-full rounded-2xl p-6 sm:p-7"
                   style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(22,163,74,0.08)" }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4"
                     style={{ color: C.success, fontFamily: "var(--font-jetbrains)" }}>It fits if</div>
                <ul className="space-y-3">
                  {FIT_YES.map(t => (
                    <li key={t} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: C.text }}>
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.success }} aria-hidden="true" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="h-full rounded-2xl p-6 sm:p-7"
                   style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4"
                     style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>It doesn&rsquo;t if</div>
                <ul className="space-y-3">
                  {FIT_NO.map(t => (
                    <li key={t} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: C.muted }}>
                      <X className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#A8A29E" }} aria-hidden="true" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 7. FAQ — the objections that actually stop the booking ── */}
      <section className="relative py-16 sm:py-20 px-6" style={{ background: C.bg }}>
        <div className="relative max-w-2xl mx-auto">
          <Reveal className="text-center mb-9">
            <h2 className="font-extrabold tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
              Before you book.
            </h2>
          </Reveal>

          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={0.04 * i}>
                <details className="group rounded-2xl overflow-hidden"
                         style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 sm:px-6 py-4">
                    <span className="font-bold text-[15px] sm:text-base leading-snug"
                          style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>{f.q}</span>
                    <ChevronDown className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180"
                                 style={{ color: C.orangeDk }} aria-hidden="true" />
                  </summary>
                  <p className="px-5 sm:px-6 pb-5 pt-0 text-sm leading-relaxed" style={{ color: C.muted }}>{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. FOUNDER — answers "who are you" faster than a paragraph ── */}
      <section className="relative py-16 px-6" style={{ background: C.subtle }}>
        <div className="relative max-w-2xl mx-auto">
          <Reveal>
            <div className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left"
                 style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}>
              {FOUNDER_PHOTO_URL ? (
                <img src={FOUNDER_PHOTO_URL} alt="Jonathan, founder of FieldBuilt AI"
                     width={96} height={96}
                     className="w-24 h-24 rounded-2xl object-cover shrink-0"
                     style={{ border: `2px solid ${C.border}` }} />
              ) : (
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center shrink-0"
                     style={{ background: C.dark }}>
                  <span className="text-4xl font-extrabold" style={{ color: C.orange, fontFamily: "var(--font-jakarta)" }}>J</span>
                </div>
              )}
              <div>
                <div className="font-bold text-lg mb-1" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                  Jonathan &middot; founder, FieldBuilt AI
                </div>
                <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                  You&rsquo;re not meeting a sales rep. I build and install every system myself,
                  which is why I only take a couple of shops a month. Come with your hardest
                  questions &mdash; the weird edge cases, the &ldquo;my market is different.&rdquo;
                  That&rsquo;s the part of the call I&rsquo;m best at.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 9. FINAL CTA ── */}
      <section className="relative py-16 sm:py-20 px-6 overflow-hidden" style={{ background: "#1A1614" }}>
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.10) 1.2px, transparent 1.2px)", backgroundSize: "30px 30px",
                      WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000 20%, transparent 75%)",
                      maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000 20%, transparent 75%)" }} />
        <div className="relative max-w-2xl mx-auto text-center">
          <Reveal>
            <h2 className="font-extrabold tracking-tight mb-6"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.4rem)", lineHeight: 1.15, textWrap: "balance" }}>
              In 20 minutes we&rsquo;ll show you exactly how
              <br /><span style={{ color: C.orange }}>
                we book you more{" "}
                <br className="sm:hidden" />
                HVAC jobs.
              </span>
            </h2>
            <Cta tone="dark" />
          </Reveal>
        </div>
      </section>

      <MinimalFooter />
    </main>
  )
}
