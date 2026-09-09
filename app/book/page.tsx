"use client"

// ─── BOOKING PAGE — /book ────────────────────────────────────────────────────
// Direct booking page: headline → calendar → why-this-works. Sent to warm
// traffic (email, DMs, retargeting, "book a call" links). The visitor already
// half-wants the call — this page's job is to close the booking and harden
// the decision while they're picking a slot.
//
// Messaging spine (from ICP research, owners running 4+ techs):
//   Surface desire: more booked jobs.
//   Real desire: predictable, profitable capacity — every tech busy with
//   work worth running, without the owner holding it together.
//   Real pain: the feast/famine swing + everything depending on the owner.
// Copy sells CONTROL, and frames inaction as paying for leads competitors win.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import {
  Zap, MessagesSquare, CalendarCheck, Route, ClipboardList, Repeat,
  Check, TrendingUp, Moon, BarChart3, Star,
} from "lucide-react"
import { C, FieldFMark, GhlBookingWidget, MinimalFooter } from "@/components/landing/shared"

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

const BENEFITS = [
  {
    icon: Zap,
    title: "Answered in 2 seconds",
    body: "Every lead gets a personal text back in 2 seconds — 2am, Sunday, Christmas morning. Speed is the whole game: homeowners book with whoever answers first, and now that's always you.",
  },
  {
    icon: MessagesSquare,
    title: "Qualified like your best CSR",
    body: "It asks the right questions for the job — repair, replacement, ductwork — handles “just getting quotes,” and screens out the tire-kickers before they ever cost a truck roll.",
  },
  {
    icon: CalendarCheck,
    title: "Booked, not just “contacted”",
    body: "Real slots on your real calendar. Confirmation texts, day-before reminders, and a reschedule flow that rescues cancellations instead of losing them.",
  },
  {
    icon: Route,
    title: "Dispatched to the right tech",
    body: "Jobs route by area and by who actually closes that job type — not whoever happens to be free. Your best installer stops losing big jobs to the schedule.",
  },
  {
    icon: ClipboardList,
    title: "Logged without lifting a finger",
    body: "Every conversation becomes a lead file: notes, system details, history, address — street view included. Your techs walk in knowing the house. Nobody typed anything.",
  },
  {
    icon: Repeat,
    title: "Follow-up that never forgets",
    body: "The lead who didn’t book today gets chased for two weeks — SMS, Messenger, WhatsApp, and a phone call — until they book or say stop. That’s revenue your office never had time to recover.",
  },
]

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
    caption: "Day one live for a real HVAC company. 27 leads came in, the AI had 14 conversations, and put 3 jobs on the calendar — $756 of work — before anyone in the office picked up a phone.",
  },
  {
    img: "/proof/proof-9days.png",
    h: 588,
    alt: "FieldBuilt dashboard, Aug 2 to Aug 11: 130 new leads, 77 AI conversations, 13 jobs booked, $2,646 of work booked",
    headline: "77 cold leads → 13 booked jobs in 9 days.",
    caption: "Same company, first 9 days. 130 leads in, 77 worked by the AI, 13 jobs booked — at least $2,646 of work on the schedule. No new office staff. No extra ad spend.",
  },
]

const OUTCOMES = [
  {
    icon: TrendingUp,
    title: "You know where next month’s revenue is coming from",
    body: "A calendar that fills itself, evenly — including the duct cleanings and maintenance work that keep techs earning between the big jobs. No more feast-or-famine whiplash.",
  },
  {
    icon: BarChart3,
    title: "Every truck earns its overhead",
    body: "You see close rate and revenue per tech, per job type, per lead source — live. Idle techs and underpriced work stop hiding in your gut feel.",
  },
  {
    icon: Moon,
    title: "It runs when you stop watching",
    body: "Leads captured, booked, dispatched, and logged while you’re at dinner, on a roof, or asleep. The business stops needing you in every loop — that’s the point of owning it.",
  },
]

// ── TRUST BADGES ─────────────────────────────────────────────────────────────
// Drawn as inline SVG rather than pasted image files: the marks stay sharp at
// any size, carry no white box behind them, and cost no network request.
//
// These assert real credentials, so they stay claim-only by default. Set
// GOOGLE_RATING (and optionally GOOGLE_REVIEW_COUNT) to the REAL numbers from
// the Google Business Profile and the badge switches to a star rating on its
// own. Never put an invented rating in front of buyers.
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

// Meta's verification badge: the scalloped blue burst with a white check.
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
    <div className="flex flex-wrap items-center justify-center gap-2.5 mt-7">
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
        <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: C.text }}>
          Meta Verified
        </span>
      </div>
    </div>
  )
}

export default function BookPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      {/* ── Slim header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
              style={{ background: "rgba(26,22,20,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(249,115,22,0.10)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
            <FieldFMark size={18} />
          </div>
          <span className="font-extrabold text-xl tracking-tight"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            FIELDBUILT
            <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
                  style={{ fontSize: "0.42em", background: C.orange, padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}>
              AI
            </span>
          </span>
        </div>
      </header>

      {/* ── 1. HERO ── */}
      <section className="relative flex flex-col justify-center pt-32 pb-12 px-6 overflow-hidden"
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
        <motion.div animate={{ y: [0, 18, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          className="absolute rounded-full blur-3xl pointer-events-none" aria-hidden="true"
          style={{ width: 480, height: 480, background: "rgba(163,230,53,0.05)", bottom: "-12%", right: "-6%" }} />

        <div className="relative max-w-3xl mx-auto w-full text-center">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full mb-7 text-[11px] sm:text-sm font-extrabold uppercase tracking-widest text-white whitespace-nowrap"
            style={{ background: C.orange, boxShadow: "0 4px 20px rgba(249,115,22,0.45)", fontFamily: "var(--font-jetbrains)" }}>
            For HVAC shops running 4+ techs
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7 }}
            className="font-extrabold tracking-tight mb-6"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                     fontSize: "clamp(1.6rem, 5.2vw, 3rem)", lineHeight: 1.1, textWrap: "balance" }}>
            Get 25 Extra HVAC Jobs a Month
            <br className="hidden sm:inline" /> From Leads You Already Have
            <br /><span style={{ color: C.orange }}>&amp; Get Your Life Back</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.6 }}
            className="text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: "rgba(250,250,248,0.62)" }}>
            Get the full map of how HVAC companies get more booked jobs fast — with
            no extra headache or ad spend. Pick a time, see it running, and see how
            it can <strong style={{ color: "#F5F3F0" }}>4x your jobs</strong>.
          </motion.p>
        </div>
      </section>

      {/* ── 2. CALENDAR ── */}
      <section id="book" className="relative px-6 overflow-hidden scroll-mt-20" style={{ background: C.bg }}>
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" aria-hidden="true"
             style={{ background: "linear-gradient(180deg, #1A1614 0%, rgba(250,250,248,0) 100%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px",
                      WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 80%)",
                      maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 80%)" }} />

        <div className="relative max-w-3xl mx-auto pt-16 pb-16">
          <Reveal delay={0.1}>
            <div className="rounded-3xl p-2 sm:p-3"
                 style={{ background: C.surface, border: `1px solid ${C.border}`,
                          boxShadow: "0 24px 60px rgba(249,115,22,0.10), 0 4px 20px rgba(0,0,0,0.05)" }}>
              <GhlBookingWidget />
            </div>
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

      {/* ── 3. PROOF — real dashboards, marked up in red ── */}
      {/* Screenshots are cropped above the jobs list on purpose: that list shows
          real homeowners' names, addresses and phone numbers. Never publish it. */}
      <section className="relative py-20 px-6 overflow-hidden" style={{ background: "#201A17" }}>
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.10) 1.2px, transparent 1.2px)", backgroundSize: "30px 30px",
                      WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)",
                      maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)" }} />
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="w-8 h-px" style={{ background: PROOF_RED }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#FCA5A5", fontFamily: "var(--font-jetbrains)" }}>
                Proof
              </span>
              <span className="w-8 h-px" style={{ background: PROOF_RED }} />
            </div>
            <h2 className="font-extrabold tracking-tight mb-4"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                         fontSize: "clamp(2.2rem, 7.5vw, 3.6rem)", lineHeight: 1.05 }}>
              Turn your cold{" "}
              <br className="sm:hidden" />
              leads{" "}
              <br className="hidden sm:inline" />
              <span style={{ color: C.orange }}>into cash.</span>
            </h2>
            <p className="text-base leading-relaxed max-w-lg mx-auto" style={{ color: "rgba(250,250,248,0.55)" }}>
              Screenshots straight from a real HVAC company&rsquo;s dashboard — leads
              their office had already given up on.
            </p>
          </Reveal>

          {PROOFS.map((p, i) => (
            <Reveal key={p.img} delay={0.05 + i * 0.08} className="mb-14 last:mb-0">
              {/* Red marker headline — the one line they must understand */}
              <div className="flex justify-center mb-5">
                <div className="rounded-2xl px-6 py-3.5 text-center"
                     style={{ background: PROOF_RED, border: "3px solid rgba(255,255,255,0.92)",
                              boxShadow: "0 10px 34px rgba(220,38,38,0.40)" }}>
                  <span className="block font-extrabold text-white leading-tight"
                        style={{ fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.02rem, 3.4vw, 1.6rem)",
                                 letterSpacing: "-0.01em", textWrap: "balance" }}>
                    {p.headline}
                  </span>
                </div>
              </div>

              {/* The screenshot itself */}
              <div className="rounded-2xl overflow-hidden"
                   style={{ border: `3px solid ${PROOF_RED}`, boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
                <img src={p.img} alt={p.alt} width={1200} height={p.h}
                     className="w-full block" loading="lazy" />
              </div>

              {/* Plain-English explanation */}
              <p className="text-center text-sm sm:text-base leading-relaxed max-w-2xl mx-auto mt-5"
                 style={{ color: "rgba(250,250,248,0.62)" }}>
                {p.caption}
              </p>
            </Reveal>
          ))}

          <Reveal delay={0.2}>
            {/* The payoff. Marker red carries over from the annotations above, but
                as a glowing figure rather than a third red pill — the number is
                the point, and it shouldn't compete with the proof headlines. */}
            <div className="relative rounded-2xl overflow-hidden text-center mt-4 px-6 sm:px-9 py-9"
                 style={{ background: "linear-gradient(160deg, rgba(220,38,38,0.10) 0%, rgba(220,38,38,0.04) 100%)",
                          border: `1px solid ${PROOF_RED}55`,
                          boxShadow: "0 18px 50px rgba(220,38,38,0.13)" }}>
              <div className="absolute inset-x-0 top-0 h-px" aria-hidden="true"
                   style={{ background: `linear-gradient(90deg, transparent, ${PROOF_RED}, transparent)` }} />

              <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4"
                   style={{ color: "#FCA5A5", fontFamily: "var(--font-jetbrains)" }}>
                What that adds up to
              </div>

              <div className="font-bold leading-none mb-5"
                   style={{ color: "#FF5F5F", fontFamily: "var(--font-jetbrains)",
                            fontSize: "clamp(2.3rem, 8.6vw, 4.1rem)", letterSpacing: "-0.02em",
                            textShadow: "0 0 44px rgba(220,38,38,0.55)" }}>
                $47K&ndash;$156K
              </div>

              <p className="font-bold leading-snug mb-3 max-w-xl mx-auto"
                 style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)",
                          fontSize: "clamp(1.05rem, 3.6vw, 1.35rem)", textWrap: "balance" }}>
                in recovered revenue per year — from leads you already had.
              </p>
              <p className="text-sm leading-relaxed max-w-lg mx-auto"
                 style={{ color: "rgba(250,250,248,0.58)", textWrap: "balance" }}>
                No new ad spend. No new hires. Just the leads sitting in your
                pipeline, finally getting booked.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 4. WHAT THE SYSTEM DOES ── */}
      <section className="relative py-20 px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.10) 1px, transparent 1px)", backgroundSize: "28px 28px",
                      WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, #000 20%, transparent 80%)",
                      maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, #000 20%, transparent 80%)" }} />
        <div className="relative max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="w-8 h-px" style={{ background: C.orange }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>
                What runs from day one
              </span>
              <span className="w-8 h-px" style={{ background: C.orange }} />
            </div>
            <h2 className="font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em", textWrap: "balance",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15 }}>
              One system does the office work
              <br /><span style={{ color: C.orangeDk }}>of three people.{" "}
                <br className="sm:hidden" />Around the clock.</span>
            </h2>
            <p className="text-base leading-relaxed max-w-xl mx-auto" style={{ color: C.muted }}>
              Every lead captured, worked, and turned into a job on the calendar —
              across SMS, Messenger, WhatsApp, web forms, and missed calls.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={0.05 + (i % 3) * 0.07}>
                <div className="h-full rounded-2xl p-6 transition-transform hover:scale-[1.01]"
                     style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(249,115,22,0.10)" }}>
                    <b.icon className="w-5 h-5" style={{ color: C.orangeDk }} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.01em" }}>
                    {b.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{b.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. WHAT ACTUALLY CHANGES — the real desire: control ── */}
      <section className="relative py-20 px-6 overflow-hidden" style={{ background: "#201A17" }}>
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(circle, rgba(163,230,53,0.08) 1.2px, transparent 1.2px)", backgroundSize: "32px 32px",
                      WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)",
                      maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)" }} />
        <div className="relative max-w-3xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="font-extrabold tracking-tight mb-4"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em", textWrap: "balance",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15 }}>
              You get more booked jobs
              <br /><span style={{ color: "#A3E635" }}>and you get peace of mind.</span>
            </h2>
          </Reveal>

          <div className="space-y-4">
            {OUTCOMES.map((o, i) => (
              <Reveal key={o.title} delay={0.05 + i * 0.08}>
                <div className="flex items-start gap-5 rounded-2xl p-6 sm:p-7"
                     style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(163,230,53,0.10)" }}>
                    <o.icon className="w-5 h-5" style={{ color: "#A3E635" }} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1.5" style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.01em" }}>
                      {o.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(250,250,248,0.60)" }}>{o.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. THE COST OF WAITING + FINAL CTA ── */}
      <section className="relative py-20 px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="relative max-w-2xl mx-auto text-center">
          <Reveal>
            <h2 className="font-extrabold tracking-tight mb-5"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em", textWrap: "balance",
                         fontSize: "clamp(1.5rem, 4.3vw, 2.05rem)", lineHeight: 1.15 }}>
              In 20 minutes we&rsquo;ll show you exactly how
              <br /><span style={{ color: C.orangeDk }}>we book you more HVAC jobs.</span>
            </h2>
            <p className="text-base leading-relaxed max-w-xl mx-auto mb-9" style={{ color: C.muted }}>
              The setup is free for 14 days, on your real leads, built by the founder
              — and if the numbers don&rsquo;t make the case, you walk away with your leak
              map and owe nothing. The only cost you can&rsquo;t get back is another month
              of leads going cold.
            </p>
            <a href="#book" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white transition-transform hover:scale-[1.03]"
               style={{ background: C.orange, boxShadow: "0 8px 32px rgba(249,115,22,0.40)" }}>
              Book Your FREE Strategy Session
            </a>
            <p className="text-xs mt-4" style={{ color: C.muted }}>
              I take a couple of shops a month. When the calendar&rsquo;s full, it&rsquo;s full.
            </p>
          </Reveal>
        </div>
      </section>

      <MinimalFooter />
    </main>
  )
}
