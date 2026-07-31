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
  ArrowDown, CloudRain, Flame, Check, TrendingUp, Moon, BarChart3,
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
        <a href="#book" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition-transform hover:scale-[1.03]"
           style={{ background: C.orange, boxShadow: "0 4px 16px rgba(249,115,22,0.35)" }}>
          Pick my time <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </header>

      {/* ── 1. HERO ── */}
      <section className="relative flex flex-col justify-center pt-32 pb-16 px-6 overflow-hidden"
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-7 text-xs font-bold uppercase tracking-widest"
            style={{ background: "rgba(249,115,22,0.10)", color: C.orange, border: "1px solid rgba(249,115,22,0.25)", fontFamily: "var(--font-jetbrains)" }}>
            For HVAC shops running 4+ techs
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7 }}
            className="font-extrabold tracking-tight mb-6"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                     fontSize: "clamp(2.3rem, 6.5vw, 3.9rem)", lineHeight: 1.05 }}>
            Every tech booked with
            <br />profitable work.
            <br /><span style={{ color: C.orange }}>Without hiring anyone.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.6 }}
            className="text-lg leading-relaxed max-w-2xl mx-auto mb-9" style={{ color: "rgba(250,250,248,0.62)" }}>
            FieldBuilt answers every lead in <strong style={{ color: "#F5F3F0" }}>2 seconds</strong> — qualifies
            it, books the job, dispatches the right tech, and logs it to your CRM.
            24/7, on every channel, with zero added admin work. Pick a time below
            and watch it run on your own leads.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.55 }}>
            <a href="#book" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white transition-transform hover:scale-[1.03]"
               style={{ background: C.orange, boxShadow: "0 8px 32px rgba(249,115,22,0.40)" }}>
              Pick my time — 20 minutes
              <ArrowDown className="w-4 h-4" aria-hidden="true" />
            </a>
            <p className="text-xs mt-4" style={{ color: "rgba(250,250,248,0.40)" }}>
              Free 14-day setup after the call &middot; no contract &middot; you keep the results either way
            </p>
          </motion.div>
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

        <div className="relative max-w-3xl mx-auto pt-20 pb-16">
          <Reveal className="text-center mb-8">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
              Pick a time. Twenty minutes, on screen.
            </h2>
            <p className="text-base leading-relaxed max-w-xl mx-auto" style={{ color: C.muted }}>
              You&rsquo;ll watch the system handle a lead start to finish, and leave with a
              map of exactly where your shop leaks jobs today — yours to keep either way.
            </p>
          </Reveal>

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
          </Reveal>
        </div>
      </section>

      {/* ── 3. THE SWING — the pain, named precisely ── */}
      <section className="relative py-20 px-6 overflow-hidden" style={{ background: "#201A17" }}>
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.10) 1.2px, transparent 1.2px)", backgroundSize: "30px 30px",
                      WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)",
                      maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)" }} />
        <div className="relative max-w-3xl mx-auto">
          <Reveal className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="w-8 h-px" style={{ background: C.orange }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
                Why your schedule swings
              </span>
              <span className="w-8 h-px" style={{ background: C.orange }} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
              You&rsquo;ve lived both versions
              <br /><span style={{ color: C.orange }}>of the same bad week.</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <Reveal delay={0.05}>
              <div className="rounded-2xl p-6 h-full" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(148,163,184,0.12)" }}>
                    <CloudRain className="w-4.5 h-4.5 text-slate-400" aria-hidden="true" />
                  </div>
                  <span className="font-bold text-base" style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)" }}>The quiet week</span>
                </div>
                <ul className="space-y-2.5">
                  {["Techs sitting at home — payroll due anyway", "Gaps in the schedule you can't fill fast enough", "Ad spend still running, leads going quiet", "You lie awake doing revenue math"].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: "rgba(250,250,248,0.65)" }}>
                      <span className="w-1 h-1 rounded-full mt-2 shrink-0 bg-slate-400" aria-hidden="true" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="rounded-2xl p-6 h-full" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.20)" }}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(249,115,22,0.14)" }}>
                    <Flame className="w-4.5 h-4.5" style={{ color: C.orange }} aria-hidden="true" />
                  </div>
                  <span className="font-bold text-base" style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)" }}>The slammed week</span>
                </div>
                <ul className="space-y-2.5">
                  {["Phones overloaded — calls ringing out", "Follow-up dies the moment it gets busy", "Dispatch by whoever's-free, not whoever closes", "Leads you paid $80 for book with competitors"].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: "rgba(250,250,248,0.65)" }}>
                      <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: C.orange }} aria-hidden="true" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="rounded-2xl p-7 text-center" style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.22)" }}>
              <p className="text-lg sm:text-xl font-bold leading-snug mb-2" style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)" }}>
                Neither week is a leads problem. It&rsquo;s a capture problem —
                nothing answers, qualifies, and fills the calendar evenly.
              </p>
              <p className="text-sm" style={{ color: "rgba(250,250,248,0.55)" }}>
                That&rsquo;s a machine&rsquo;s job. It was never supposed to be yours.
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
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
              One system does the office work
              <br /><span style={{ color: C.orangeDk }}>of three people. Around the clock.</span>
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
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
              More booked jobs is the surface.
              <br /><span style={{ color: "#A3E635" }}>This is what you actually get.</span>
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
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-5"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
              Every day this isn&rsquo;t running, leads you already
              paid for are booking with <span style={{ color: C.orangeDk }}>whoever answered first.</span>
            </h2>
            <p className="text-base leading-relaxed max-w-xl mx-auto mb-9" style={{ color: C.muted }}>
              The call is 20 minutes. The setup is free for 14 days, on your real leads,
              built by the founder — and if the numbers don&rsquo;t make the case, you walk
              away with your leak map and owe nothing. The only unrecoverable cost is
              another month of the swing.
            </p>
            <a href="#book" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white transition-transform hover:scale-[1.03]"
               style={{ background: C.orange, boxShadow: "0 8px 32px rgba(249,115,22,0.40)" }}>
              Pick my time — 20 minutes
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
