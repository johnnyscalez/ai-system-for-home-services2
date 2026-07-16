"use client"

// ─────────────────────────────────────────────────────────────────────────────
// AUTOPILOT ANGLE — sections for /start/autopilot
//
// Scent-matched to the winning ad: the Sarah chat (lead in at 8:17 PM, booked,
// routed and logged by 8:29, nobody touched a thing, free for 2 weeks).
// The recreated chat IS the signature artifact of the page — a fully populated,
// real product conversation. All content renders visible by default; motion is
// additive only (settle transforms, a drawn check, soft parallax) and gated
// behind prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { C } from "./shared"

// ── The conversation, verbatim from the ad ──────────────────────────────────
type Msg = { from: "ai" | "lead"; text: string; stamp?: string }

const CHAT: Msg[] = [
  { from: "ai",   stamp: "Tue 8:17 PM", text: "Hey Sarah! This is Alex from Comfort Pro. Just saw your form about the AC not keeping up. Is it running at all, or totally off?" },
  { from: "lead", stamp: "8:21 PM",     text: "its running but house wont get below 78. been like this 2 weeks" },
  { from: "ai",                          text: "That's miserable in this heat. Does it run non-stop, or kick on and off?" },
  { from: "lead", stamp: "8:23 PM",     text: "non stop. never shuts off" },
  { from: "ai",                          text: "Got it, that's worth catching early. What's the address? I'll check which tech covers your area." },
  { from: "lead", stamp: "8:24 PM",     text: "3214 maple creek dr" },
  { from: "lead",                        text: "btw im just getting a few quotes, not sure what i need yet" },
  { from: "ai",                          text: "Totally fair \u{1F44D} Our tech comes out, checks everything, and tells you exactly what's going on. You decide from there, zero pressure. Does Monday morning work? I've got 9 or 11." },
  { from: "lead", stamp: "8:28 PM",     text: "11 is better" },
  { from: "ai",                          text: "Done! Monday 11am at 3214 Maple Creek ✓ Mike's your tech, he knows the area. You'll get a reminder Sunday night." },
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
            ? { background: "#0A84FF", color: "#fff", borderRadius: "16px 16px 4px 16px" }
            : { background: "#EDEAE7", color: C.text, borderRadius: "16px 16px 16px 4px" }}
        >
          {msg.text}
        </div>
      </div>
    </>
  )
}

// ── The booked-job receipt that closes the chat ─────────────────────────────
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
            initial={reduced ? false : { pathLength: 0 }}
            animate={inView || reduced ? { pathLength: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </svg>
        <span className="text-[13px] font-extrabold tracking-tight" style={{ color: "#14532D", fontFamily: "var(--font-jakarta)" }}>
          Job booked. Monday 11:00 AM
        </span>
      </div>
      <div className="px-3.5 pb-3 pt-1.5 text-[12px] leading-relaxed" style={{ color: "#3F6212" }}>
        3214 Maple Creek Dr &middot; Tech: Mike R. &middot; Reminder set for Sunday night
      </div>
      <div className="flex items-center justify-between px-3.5 py-2"
           style={{ background: "rgba(22,163,74,0.08)", borderTop: "1px solid rgba(22,163,74,0.18)" }}>
        <span className="text-[11px] font-semibold" style={{ color: "#166534" }}>
          Logged to CRM &middot; routed &amp; dispatched
        </span>
        <span className="text-[11px] font-bold" style={{ color: "#166534", fontFamily: "var(--font-jetbrains)" }}>
          8:29 PM
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
             ? { background: "#0A84FF", borderRadius: "16px 16px 4px 16px" }
             : { background: "#EDEAE7", borderRadius: "16px 16px 16px 4px" }}>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="block w-1.5 h-1.5 rounded-full"
              style={{ background: ai ? "rgba(255,255,255,0.85)" : "#A8A29E" }}
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
  const drift = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [14, -14])

  const finished = count >= CHAT.length

  return (
    <motion.div ref={frameRef} style={{ y: drift }} className="relative mx-auto w-full max-w-[400px]">
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
            Sarah &mdash; New Lead
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: "#9C948E" }}>
            Web form &middot; 3214 Maple Creek Dr
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
export function AutopilotHero() {
  return (
    <section className="relative pt-28 pb-0 px-6" style={{ background: C.dark }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-10 items-start">

          {/* Copy column */}
          <div className="pt-4 lg:pt-14 pb-2 lg:pb-24">
            <p className="text-sm font-semibold mb-5" style={{ color: "rgba(250,250,248,0.45)" }}>
              For HVAC owners running 5+ techs
            </p>

            <h1 className="font-extrabold tracking-tight leading-[1.04] mb-4"
                style={{
                  color: "#F5F3F0",
                  fontFamily: "var(--font-jakarta)",
                  fontSize: "clamp(2.1rem, 5vw, 3.35rem)",
                  letterSpacing: "-0.03em",
                }}>
              Every lead answered in seconds. Booked, routed, and logged.
            </h1>

            <p className="font-extrabold tracking-tight mb-6"
               style={{
                 color: C.orange,
                 fontFamily: "var(--font-jakarta)",
                 fontSize: "clamp(1.25rem, 2.6vw, 1.7rem)",
                 letterSpacing: "-0.02em",
               }}>
              Nobody on your team touches a thing.
            </p>

            <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl" style={{ color: "rgba(250,250,248,0.62)" }}>
              FieldBuilt is the 24/7 employee working the back end of your shop:
              it texts every lead the moment they come in, follows up until they
              answer, qualifies them, books the job, routes the right tech, and
              logs it all in <strong style={{ color: "rgba(250,250,248,0.9)" }}>your</strong> CRM.
              You change nothing about how you work.
            </p>

            <a href="#form"
               className="inline-flex items-center gap-2 font-bold text-white text-base px-7 py-4 rounded-xl transition-colors hover:bg-orange-600"
               style={{ background: C.orange }}>
              Start Free for 2 Weeks
              <ArrowUpRight />
            </a>
            <p className="text-[13px] mt-4" style={{ color: "rgba(250,250,248,0.38)" }}>
              Runs on your real leads &middot; Your CRM stays &middot; Setup in days, not months
            </p>
          </div>

          {/* The artifact — bleeds past the hero floor into the timeline band */}
          <div className="relative lg:-mb-16 pb-2 lg:pb-0" style={{ zIndex: 2 }}>
            <ChatArtifact />
          </div>
        </div>
      </div>

      {/* Timeline rail — the ad's 12-minute claim, receipts attached */}
      <div className="relative mt-10 lg:mt-0" style={{ background: C.darkCard, borderTop: "1px solid rgba(249,115,22,0.10)" }}>
        <div className="max-w-6xl mx-auto px-0 py-8 lg:py-9 lg:pr-[44%]">
          <TimelineRail />
        </div>
      </div>
    </section>
  )
}

// ── The 8:17 → 8:29 rail ─────────────────────────────────────────────────────
const STOPS = [
  { t: "8:17 PM", label: "Lead texts in" },
  { t: "8:17 PM", label: "First reply out" },
  { t: "8:28 PM", label: "Job booked" },
  { t: "8:29 PM", label: "Routed & logged" },
]

function TimelineRail() {
  return (
    <div className="px-6">
      <div className="flex items-start justify-between max-w-2xl">
        {STOPS.map((s, i) => (
          <div key={i} className="relative flex-1 min-w-0">
            {/* connector */}
            {i < STOPS.length - 1 && (
              <div className="absolute top-[5px] left-[14px] right-0 h-[3px] rounded-full"
                   style={{ background: "rgba(249,115,22,0.22)" }} />
            )}
            <div className="relative w-[13px] h-[13px] rounded-full mb-3"
                 style={{ background: i === STOPS.length - 1 ? C.orange : "rgba(249,115,22,0.45)" }} />
            <div className="pr-3">
              <div className="text-[12px] font-bold mb-0.5"
                   style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
                {s.t}
              </div>
              <div className="text-[12.5px] leading-tight font-medium" style={{ color: "rgba(250,250,248,0.68)" }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[13.5px] font-semibold" style={{ color: "rgba(250,250,248,0.72)" }}>
        Twelve minutes, start to booked. Total human involvement: zero.
      </p>
    </div>
  )
}

// ── THE MATH — you already paid for that lead ────────────────────────────────
export function PaidLeadMath() {
  return (
    <section className="relative py-20 px-6" style={{ background: C.bg }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-14 items-center">
          <div>
            <h2 className="font-extrabold tracking-tight mb-5"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)", letterSpacing: "-0.025em" }}>
              You already paid for that lead. Then it hit voicemail.
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: C.muted }}>
              Every lead that reaches you cost real money: the ad spend, the website,
              the years of reviews behind it. The expensive part is over by the time
              they text you. What decides whether it becomes a job is what happens in
              the next few minutes.
            </p>
            <p className="text-base leading-relaxed" style={{ color: C.muted }}>
              And most of them come in when nobody can grab the phone: dinner time,
              Sunday afternoon, the middle of a crawlspace. They don&rsquo;t leave a
              voicemail. They text the next company on the list.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { n: "78%", d: "of customers hire the company that responds first" },
              { n: "21x", d: "more likely to connect when you reply within 5 minutes instead of 30" },
              { n: "$0",  d: "of your ad spend is refunded when the lead goes cold" },
            ].map((s, i) => (
              <div key={i} className="flex items-baseline gap-5 rounded-2xl px-6 py-5"
                   style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <span className="font-black shrink-0 w-[4.2rem] text-right"
                      style={{ color: C.orange, fontFamily: "var(--font-jetbrains)", fontSize: "1.65rem", letterSpacing: "-0.01em" }}>
                  {s.n}
                </span>
                <span className="text-[14px] leading-snug font-medium" style={{ color: C.text }}>
                  {s.d}
                </span>
              </div>
            ))}
            <p className="text-[11.5px] pl-1" style={{ color: C.muted }}>
              Response-time figures: industry speed-to-lead research.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── THE WORK ORDER — it works like an employee ───────────────────────────────
const DUTIES = [
  "Captures every lead from every source, the second it comes in",
  "Texts back in seconds, any hour, any day",
  "Follows up until they answer, so nothing goes quiet",
  "Qualifies the job and handles “just getting quotes”",
  "Books it straight onto your calendar",
  "Routes the right tech to the right zip",
  "Logs every word in your CRM",
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
    <section className="relative py-20 px-6" style={{ background: C.subtle }}>
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
            {/* folded corner */}
            <div aria-hidden="true" className="absolute top-0 right-0"
                 style={{ width: 26, height: 26, background: "#EDEAE7", clipPath: "polygon(0 0, 100% 100%, 0 100%)" }} />

            <div className="flex items-center justify-between px-6 pt-6 pb-4"
                 style={{ borderBottom: `1px dashed ${C.border}` }}>
              <div>
                <div className="text-[11px] font-bold tracking-wide mb-1" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
                  WORK ORDER &middot; BACK OFFICE
                </div>
                <div className="text-lg font-extrabold tracking-tight" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                  Lead response &amp; booking
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
              {[["Shift", "nights, weekends, holidays"], ["Sick days", "0"], ["Added payroll", "$0"]].map(([k, v], i) => (
                <span key={i} className="text-[12px]" style={{ color: C.muted }}>
                  <strong style={{ color: C.text }}>{k}:</strong> {v}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-extrabold tracking-tight mb-5"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)", letterSpacing: "-0.025em" }}>
              It works like an employee. It just never clocks out.
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: C.muted }}>
              Not a chatbot bolted onto your website. A back-office worker that picks
              up every lead, talks like your best CSR, and finishes the job all the
              way through: booked, dispatched, documented.
            </p>
            <p className="text-base leading-relaxed" style={{ color: C.muted }}>
              Your office manager keeps her day. The AI takes the 9 PMs, the Sundays,
              and the overflow when the phones stack up.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── YOUR STACK STAYS ─────────────────────────────────────────────────────────
export function StackStaysSection() {
  return (
    <section className="relative py-16 px-6" style={{ background: C.bg }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-extrabold tracking-tight mb-4"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.5rem, 3vw, 2.1rem)", letterSpacing: "-0.025em" }}>
          Your stack stays your stack.
        </h2>
        <p className="text-base leading-relaxed mb-8 max-w-xl mx-auto" style={{ color: C.muted }}>
          It plugs into what you already run. Jobs land in the CRM you use today,
          from the phone number your customers already know. Nothing migrates,
          nobody re-trains, no six-week onboarding.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
          {["Your CRM", "Your phone number", "Your booking process"].map((t, i) => (
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
