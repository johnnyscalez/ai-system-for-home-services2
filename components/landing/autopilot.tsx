"use client"

// ─────────────────────────────────────────────────────────────────────────────
// AUTOPILOT ANGLE — sections for /start/autopilot (FLOORING, speed-to-lead)
//
// Angle: homeowners message several flooring companies at once and book
// whoever answers first. The chat is an EXAMPLE conversation (labelled as
// such, per docs/flooring-pivot.md): a homeowner answered in seconds,
// qualified (project, rooms, timeline, ZIP, decision makers home) and booked
// for an in-home measure. The AI discloses it's an AI and never quotes price.
// Light mode only. All content renders visible by default; motion is additive
// only and gated behind prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { C } from "./shared"

// ── The example conversation ────────────────────────────────────────────────
type Msg = { from: "ai" | "lead"; text: string; stamp?: string }

const CHAT: Msg[] = [
  { from: "ai",   stamp: "Tue 8:17 PM", text: "Hi Sarah! This is the AI assistant for Summit Floors. Just saw your request about new floors. What are you thinking, LVP, hardwood, carpet?" },
  { from: "lead", stamp: "8:19 PM",     text: "lvp probably. living room hallway and kitchen" },
  { from: "ai",                          text: "Nice, that's a popular combo. When are you hoping to have it done? And what's your ZIP?" },
  { from: "lead", stamp: "8:21 PM",     text: "next month. 75204" },
  { from: "lead",                        text: "btw im getting a few quotes. how much would it be?" },
  { from: "ai",                          text: "Totally fair. The price comes from the measure so it's real, not a guess. Will you and anyone else deciding both be home for it?" },
  { from: "lead", stamp: "8:23 PM",     text: "my husband is home after 5" },
  { from: "ai",                          text: "Perfect. I have Thursday at 5:30 or Saturday at 10. Which works for both of you?" },
  { from: "lead", stamp: "8:24 PM",     text: "thursday 5:30" },
  { from: "ai",                          text: "Booked! Thursday 5:30pm at your place. You'll get a reminder the day before, and you can reschedule right here anytime." },
]

// ── Chat bubble ──────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: Msg }) {
  const ai = msg.from === "ai"
  return (
    <>
      {msg.stamp && (
        <div className="text-center py-1.5">
          <span className="text-[11px] font-medium"
                style={{ color: "#7A736D", fontFamily: "var(--font-jetbrains)" }}>
            {msg.stamp}
          </span>
        </div>
      )}
      <div className={`flex ${ai ? "justify-end" : "justify-start"}`}>
        <div
          className="max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-snug"
          style={ai
            ? { background: C.orangeSoft, color: C.text, border: "1px solid rgba(249,115,22,0.22)", borderRadius: "16px 16px 4px 16px" }
            : { background: "#EDEAE7", color: C.text, borderRadius: "16px 16px 16px 4px" }}
        >
          {msg.text}
        </div>
      </div>
    </>
  )
}

// ── The booked-measure receipt that closes the chat ─────────────────────────
function BookedReceipt() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const reduced = useReducedMotion()

  return (
    <div ref={ref} className="mt-3 rounded-xl overflow-hidden"
         style={{ border: "1px solid rgba(22,163,74,0.35)", background: "#F2FBF5" }}>
      <div className="flex items-center gap-2.5 px-3.5 pt-3">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="9" stroke={C.success} strokeWidth="1.6" />
          <motion.path
            d="M6 10.2 L8.8 13 L14 7.6"
            stroke={C.success} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none"
            initial={{ pathLength: 0 }}
            animate={inView || reduced ? { pathLength: 1 } : {}}
            transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
          />
        </svg>
        <span className="text-[13px] font-extrabold tracking-tight" style={{ color: "#14532D", fontFamily: "var(--font-jakarta)" }}>
          Measure booked. Thursday 5:30 PM
        </span>
      </div>
      <div className="px-3.5 pb-3 pt-1.5 text-[12px] leading-relaxed" style={{ color: "#3F6212" }}>
        LVP &middot; 3 rooms &middot; ZIP 75204 &middot; Both decision makers home &middot; Reminder set for Wednesday
      </div>
      <div className="flex items-center justify-between px-3.5 py-2"
           style={{ background: "rgba(22,163,74,0.08)", borderTop: "1px solid rgba(22,163,74,0.18)" }}>
        <span className="text-[11px] font-semibold" style={{ color: "#166534" }}>
          On the calendar &middot; quote follow-up armed
        </span>
        <span className="text-[11px] font-bold" style={{ color: "#166534", fontFamily: "var(--font-jetbrains)" }}>
          8:24 PM
        </span>
      </div>
    </div>
  )
}

// ── Typing indicator, matching whichever side is "typing" ───────────────────
function TypingDots({ from }: { from: "ai" | "lead" }) {
  const ai = from === "ai"
  return (
    <div className={`flex ${ai ? "justify-end" : "justify-start"}`}>
      <div className="px-4 py-3"
           style={ai
             ? { background: C.orangeSoft, border: "1px solid rgba(249,115,22,0.22)", borderRadius: "16px 16px 4px 16px" }
             : { background: "#EDEAE7", borderRadius: "16px 16px 16px 4px" }}>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="block w-1.5 h-1.5 rounded-full"
              style={{ background: ai ? C.orange : "#A8A29E" }}
              animate={{ y: [0, -3.5, 0] }}
              transition={{ duration: 0.75, repeat: Infinity, delay: i * 0.14, ease: "easeInOut" }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── The phone artifact — a LIVE replay of the conversation ──────────────────
// SSR and no-JS render the complete conversation (content is never hidden by
// default). After hydration, when the phone scrolls into view and motion is
// allowed, the replay takes over: typing dots, messages arriving one by one,
// the thread auto-scrolling, the booked receipt landing last.
export function ChatArtifact() {
  const frameRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const inView = useInView(frameRef, { once: true, margin: "-120px" })

  const [count, setCount] = useState(CHAT.length) // full conversation by default
  const [typing, setTyping] = useState<null | "ai" | "lead">(null)
  const [playing, setPlaying] = useState(false)
  const runId = useRef(0)

  const play = useCallback(() => {
    const id = ++runId.current
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    ;(async () => {
      setPlaying(true); setCount(0); setTyping(null)
      await wait(650)
      for (let i = 0; i < CHAT.length; i++) {
        if (runId.current !== id) return
        const m = CHAT[i]
        setTyping(m.from)
        await wait(Math.min(420 + m.text.length * 14, 1500))
        if (runId.current !== id) return
        setTyping(null)
        setCount(i + 1)
        await wait(m.stamp ? 620 : 380)
      }
      if (runId.current !== id) return
      setPlaying(false)
    })()
  }, [])

  // Auto-play once, when it enters the viewport (skipped for reduced motion)
  useEffect(() => {
    if (!inView || reduced) return
    play()
    return () => { runId.current++ }
  }, [inView, reduced, play])

  // Keep the thread pinned to the newest message while it plays
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" })
  }, [count, typing, reduced])

  const { scrollYProgress } = useScroll({ target: frameRef, offset: ["start end", "end start"] })
  // Range starts at 0 so the SSR transform is "none" for everyone — branching
  // the range on `reduced` caused a hydration mismatch for reduced-motion users.
  const drift = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -28])

  const finished = count >= CHAT.length

  return (
    <div ref={frameRef} className="relative mx-auto w-full max-w-[400px]">
      <motion.div style={{ y: drift }}>
      <div className="rounded-[26px] overflow-hidden"
           style={{
             background: "#FFFFFF",
             border: "1px solid rgba(26,22,20,0.10)",
             boxShadow: "0 2px 4px rgba(26,22,20,0.10), 0 22px 44px -18px rgba(26,22,20,0.28)",
           }}>
        {/* Thread header, exactly like the ad */}
        <div className="text-center pt-5 pb-3.5 px-4" style={{ borderBottom: "1px solid #F0EDEA", background: "#FBFAF9" }}>
          <div className="mx-auto mb-2 w-10 h-10 rounded-full flex items-center justify-center"
               style={{ background: "#6B7280" }}>
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div className="text-[14px] font-extrabold" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Sarah &mdash; New Homeowner Lead
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: "#9C948E" }}>
            Facebook ad form &middot; Example conversation
          </div>
        </div>

        {/* The thread — full conversation in the HTML; replay animates it */}
        <div ref={scrollRef} className="px-3.5 py-3 space-y-1.5 overflow-y-auto"
             style={{ height: 464, overscrollBehavior: "contain" }}>
          {CHAT.slice(0, count).map((m, i) => <Bubble key={i} msg={m} />)}
          {typing && <TypingDots from={typing} />}
          {finished && <BookedReceipt />}
        </div>

        {/* Replay — a real control, disabled while playing */}
        <div className="flex items-center justify-center py-2.5"
             style={{ borderTop: "1px solid #F0EDEA", background: "#FBFAF9" }}>
          <button type="button" onClick={play} disabled={playing}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors disabled:opacity-40 hover:text-orange-600"
                  style={{ color: C.muted }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M12 6.2 A5.2 5.2 0 1 0 12.6 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
              <path d="M12.3 2.6 V6.4 H8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            {playing ? "Watching it happen live" : "Watch it again"}
          </button>
        </div>
      </div>
      </motion.div>
    </div>
  )
}

// ── Custom up-right arrow (not the stock horizontal one) ────────────────────
function ArrowUpRight({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 11.5 L11.5 4.5 M6 4.5 H11.5 V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── HERO ─────────────────────────────────────────────────────────────────────
// Mobile-first composition: on phones (where the ad traffic lives) the first
// screen is eyebrow → compact headline → CTA → the TOP OF THE LIVE CHAT.
// The explainer paragraph moves BELOW the chat on mobile so the artifact is
// never pushed off the fold by copy. Desktop keeps the two-column layout.
function HeroCta() {
  return (
    <>
      <a href="#form"
         className="inline-flex w-full sm:w-auto items-center justify-center gap-2 font-bold text-white text-[15px] sm:text-base px-5 sm:px-7 py-4 rounded-xl transition-colors hover:bg-orange-600"
         style={{ background: C.orange }}>
        See If We&rsquo;re a Fit
        <ArrowUpRight />
      </a>
      <p className="text-[12.5px] mt-3" style={{ color: C.muted }}>
        We run the ads &middot; It answers in seconds &middot; Jonathan installs it
      </p>
    </>
  )
}

function HeroSub() {
  return (
    <p className="text-base sm:text-lg leading-relaxed max-w-xl" style={{ color: C.muted }}>
      We run Meta ads for homeowners in your area. Every lead gets an answer in
      seconds, by text and phone, 24/7. It qualifies the project, checks that
      every decision maker will be home, books the in-home measure, and then
      chases the quote until it signs or says no.{" "}
      <strong style={{ color: C.text }}>
        Guaranteed 20 in-home measures in 60 days, and every quote chased until it signs or says no.
      </strong>
    </p>
  )
}

export function AutopilotHero() {
  return (
    <section className="relative pt-[5.25rem] lg:pt-28 pb-0 px-4 sm:px-6" style={{ background: C.bg }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-7 lg:gap-10 items-start">

          {/* Copy column — compact and centered on mobile, full on desktop */}
          <div className="pt-2 lg:pt-14 lg:pb-24 text-center lg:text-left">
            <p className="text-[13px] lg:text-sm font-semibold mb-3 lg:mb-5" style={{ color: C.muted }}>
              For flooring contractors with their own install crews
            </p>

            <h1 className="font-extrabold tracking-tight leading-[1.06] mb-2.5 lg:mb-4"
                style={{
                  color: C.text,
                  fontFamily: "var(--font-jakarta)",
                  fontSize: "clamp(1.7rem, 4.8vw, 3.35rem)",
                  letterSpacing: "-0.03em",
                }}>
              Homeowners call three flooring companies. They book whoever answers first.
            </h1>

            <p className="font-extrabold tracking-tight mb-5 lg:mb-6"
               style={{
                 color: C.orangeDk,
                 fontFamily: "var(--font-jakarta)",
                 fontSize: "clamp(1.1rem, 2.6vw, 1.7rem)",
                 letterSpacing: "-0.02em",
               }}>
              Make sure that&rsquo;s you, every time.
            </p>

            {/* Mobile: CTA immediately, so button + top of the chat share the fold */}
            <div className="lg:hidden mb-2">
              <HeroCta />
            </div>

            {/* Desktop: full paragraph + CTA in the classic position */}
            <div className="hidden lg:block">
              <div className="mb-8"><HeroSub /></div>
              <HeroCta />
            </div>
          </div>

          {/* The artifact — bleeds past the hero floor into the timeline band */}
          <div className="relative lg:-mb-16" style={{ zIndex: 2 }}>
            <ChatArtifact />
            {/* Mobile: the explainer lands AFTER they've watched it work */}
            <div className="lg:hidden mt-7 pb-2">
              <HeroSub />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline rail — the example's 7-minute story, start to booked */}
      <div className="relative mt-8 lg:mt-0" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-6xl mx-auto px-0 py-7 lg:py-9 lg:pr-[44%]">
          <TimelineRail />
        </div>
      </div>
    </section>
  )
}

// ── The 8:17 → 8:24 rail (example conversation) ─────────────────────────────
const STOPS = [
  { t: "8:17 PM", label: "Ad form comes in" },
  { t: "8:17 PM", label: "First reply out" },
  { t: "8:23 PM", label: "Decision makers confirmed" },
  { t: "8:24 PM", label: "Measure booked" },
]

function TimelineRail() {
  return (
    <div className="px-5 sm:px-6">
      {/* Phones: a clean 2x2 grid. sm and up: the connected horizontal rail. */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:flex sm:items-start sm:justify-between sm:gap-0 max-w-2xl">
        {STOPS.map((s, i) => (
          <div key={i} className="relative sm:flex-1 min-w-0">
            {/* connector — rail form only */}
            {i < STOPS.length - 1 && (
              <div className="hidden sm:block absolute top-[5px] left-[14px] right-0 h-[3px] rounded-full"
                   style={{ background: "rgba(249,115,22,0.22)" }} />
            )}
            <div className="relative w-[13px] h-[13px] rounded-full mb-2.5 sm:mb-3"
                 style={{ background: i === STOPS.length - 1 ? C.orange : "rgba(249,115,22,0.45)" }} />
            <div className="sm:pr-3">
              <div className="text-[12px] font-bold mb-0.5"
                   style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>
                {s.t}
              </div>
              <div className="text-[12.5px] leading-tight font-medium" style={{ color: C.text }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[13.5px] font-semibold" style={{ color: C.muted }}>
        Seven minutes, form to booked measure. An example conversation, not a customer&rsquo;s record.
      </p>
    </div>
  )
}

// ── THE RACE — whoever answers first books the measure ──────────────────────
// No speed-to-lead statistics here on purpose: the pivot doc forbids numbers
// we can't source. The point is made in plain contractor language instead.
export function PaidLeadMath() {
  const moments = [
    { k: "8:17 PM", d: "Sarah fills out forms for three flooring companies from her couch." },
    { k: "8:17 PM", d: "Company one is closed. Company two's office checks messages in the morning." },
    { k: "8:24 PM", d: "Company three already answered, asked the right questions, and booked the measure." },
  ]
  return (
    <section className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.bg }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-14 items-center">
          <div>
            <h2 className="font-extrabold tracking-tight mb-5"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)", letterSpacing: "-0.025em" }}>
              Homeowners don&rsquo;t wait for the morning. They book the first one back.
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: C.muted }}>
              Most people shopping for new floors reach out to several companies at
              once, usually at night or on a weekend, when your office is closed and
              your crews are on a job.
            </p>
            <p className="text-base leading-relaxed" style={{ color: C.muted }}>
              By the time someone calls back the next day, the measure is already on
              somebody else&rsquo;s calendar. Not because they were better. Because they
              answered first.
            </p>
          </div>

          <div className="space-y-3">
            {moments.map((m, i) => (
              <div key={i} className="flex items-baseline gap-5 rounded-2xl px-6 py-5"
                   style={{ background: C.surface, border: `1px solid ${i === 2 ? "rgba(249,115,22,0.35)" : C.border}` }}>
                <span className="font-bold shrink-0 text-[13px]"
                      style={{ color: i === 2 ? C.orangeDk : C.muted, fontFamily: "var(--font-jetbrains)" }}>
                  {m.k}
                </span>
                <span className="text-[14px] leading-snug font-medium" style={{ color: C.text }}>
                  {m.d}
                </span>
              </div>
            ))}
            <p className="text-[11.5px] pl-1" style={{ color: C.muted }}>
              An example evening, not a real customer.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── THE CHAIN — answered first → measure → quote chased → install ──────────
function ChainArrow() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"
         className="shrink-0 rotate-90 md:rotate-0">
      <path d="M6 17 H26 M20 10.5 L27 17 L20 23.5"
            stroke={C.orange} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RevenueChainSection() {
  const nodes = [
    "Answered first, in seconds",
    "Measure booked, decision makers home",
    "Quote chased until yes or no",
  ]
  return (
    <section className="relative py-16 px-4 sm:px-6" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-5xl mx-auto text-center">
        <div className="flex flex-col md:flex-row items-center justify-center gap-5 md:gap-7">
          {nodes.map((n, i) => (
            <div key={n} className="contents">
              <div className="max-w-[220px] text-lg font-extrabold leading-snug tracking-tight"
                   style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                {n}
              </div>
              <ChainArrow />
              {i === nodes.length - 1 && (
                <div className="text-xl font-black leading-tight tracking-tight"
                     style={{ color: C.success, fontFamily: "var(--font-jakarta)" }}>
                  Signed installs for your crews.
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-9 text-[14px] max-w-2xl mx-auto leading-relaxed" style={{ color: C.muted }}>
          Speed gets you the measure. The right questions make the drive worth it.
          The follow-up turns the quote into an install. Most shops lose at least one
          of those three every week.
        </p>
      </div>
    </section>
  )
}

// ── THE WORK ORDER — it works like an employee ───────────────────────────────
const DUTIES = [
  "Runs Meta ads for homeowners in your service area",
  "Answers every lead in seconds, by text and phone, any hour",
  "Asks project type, rooms, timeline and ZIP",
  "Checks every decision maker will be home for the measure",
  "Books the measure, sends the confirmation and the reminder",
  "Handles reschedules so measures don’t no-show",
  "Chases every quote by text, call and email until yes or no",
]

function CheckMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true" className="shrink-0 mt-[3px]">
      <path d="M3.2 9 L6.6 12.4 L13.8 4.6" stroke={C.success} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function WorkOrderSection() {
  return (
    <section className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.subtle }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-[0.95fr_1.05fr] gap-10 md:gap-14 items-center">

          {/* The work-order card — job-ticket silhouette with a clipped corner */}
          <div className="relative"
               style={{
                 background: C.surface,
                 border: `1px solid ${C.border}`,
                 borderRadius: 18,
                 clipPath: "polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%)",
                 boxShadow: "0 1px 2px rgba(26,22,20,0.05), 0 16px 36px -20px rgba(26,22,20,0.18)",
               }}>
            <div aria-hidden="true" className="absolute top-0 right-0"
                 style={{ width: 26, height: 26, background: "#EDEAE7", clipPath: "polygon(0 0, 100% 100%, 0 100%)" }} />

            <div className="flex items-center justify-between px-6 pt-6 pb-4"
                 style={{ borderBottom: `1px dashed ${C.border}` }}>
              <div>
                <div className="text-[11px] font-bold tracking-wide mb-1" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
                  WORK ORDER &middot; FRONT OFFICE
                </div>
                <div className="text-lg font-extrabold tracking-tight" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                  Measures &amp; quote follow-up
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-md"
                    style={{ background: "rgba(22,163,74,0.10)", color: "#166534", border: "1px solid rgba(22,163,74,0.25)" }}>
                ON DUTY &middot; 24/7
              </span>
            </div>

            <ul className="px-6 py-5 space-y-3">
              {DUTIES.map((d, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] leading-snug font-medium" style={{ color: C.text }}>
                  <CheckMark />
                  {d}
                </li>
              ))}
            </ul>

            <div className="px-6 py-4 flex flex-wrap gap-x-6 gap-y-1.5"
                 style={{ borderTop: `1px dashed ${C.border}`, background: "#FBFAF9", borderRadius: "0 0 18px 18px" }}>
              {[["Shift", "nights, weekends, holidays"], ["Quotes it forgets", "0"], ["Price it quotes", "never, that's yours"]].map(([k, v], i) => (
                <span key={i} className="text-[12px]" style={{ color: C.muted }}>
                  <strong style={{ color: C.text }}>{k}:</strong> {v}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-extrabold tracking-tight mb-5"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)", letterSpacing: "-0.025em" }}>
              It works like your best salesperson. It just never clocks out.
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: C.muted }}>
              Not a chatbot on your website. An AI that tells homeowners it&rsquo;s an AI,
              asks what your best salesperson would ask, and only books measures worth
              the drive.
            </p>
            <p className="text-base leading-relaxed" style={{ color: C.muted }}>
              Your team keeps its day. The AI takes the 9 PMs, the Sundays, and the
              follow-up calls nobody has time to make.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── HOW YOU RUN STAYS ────────────────────────────────────────────────────────
export function StackStaysSection() {
  return (
    <section className="relative py-16 px-4 sm:px-6" style={{ background: C.bg }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-extrabold tracking-tight mb-4"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.5rem, 3vw, 2.1rem)", letterSpacing: "-0.025em" }}>
          You keep running your shop your way.
        </h2>
        <p className="text-base leading-relaxed mb-8 max-w-xl mx-auto" style={{ color: C.muted }}>
          Jonathan installs it around how you already run measures, quotes and
          installs. Your crews show up to measure and install. Your quote still
          comes from you. Nobody on your team has to learn anything new.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
          {["Your crews", "Your quotes", "Your calendar"].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-[15px] font-bold" style={{ color: C.text }}>
              <CheckMark />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
