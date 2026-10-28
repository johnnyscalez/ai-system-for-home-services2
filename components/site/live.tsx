"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Live elements for the marketing homepage. Every moving panel here is an
// EXAMPLE (labelled on screen) — no invented flooring results. Motion stops
// for visitors with reduced-motion turned on.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "framer-motion"
import {
  BellRing, CalendarCheck, Check, LineChart, ListChecks, Megaphone, MessageSquareText, PenLine, Repeat, Send, Zap,
} from "lucide-react"

export const T = {
  cream:   "#FAFAF8",
  white:   "#FFFFFF",
  ink:     "#1C1917",
  body:    "#57534E",
  muted:   "#8A817A",
  line:    "#ECE8E3",
  sand:    "#F4F1EC",
  soft:    "#FFF3EC",
  orange:  "#F97316",
  orangeD: "#EA580C",
  green:   "#16A34A",
  greenS:  "#ECF8F0",
  amber:   "#B45309",
  amberS:  "#FEF6E7",
} as const

// ── Parquet (chevron) texture — the page's signature background ─────────────
export function Parquet({ opacity = 0.07, className = "" }: { opacity?: number; className?: string }) {
  return (
    <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <pattern id="fb-parquet" width="56" height="28" patternUnits="userSpaceOnUse">
          <path d="M0 28 L28 0 L56 28" fill="none" stroke={T.ink} strokeWidth="1" />
          <path d="M0 14 L14 0 M42 0 L56 14" fill="none" stroke={T.ink} strokeWidth="1" />
          <path d="M14 28 L28 14 L42 28" fill="none" stroke={T.ink} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#fb-parquet)" opacity={opacity} />
    </svg>
  )
}

// ── Example badge ───────────────────────────────────────────────────────────
export function ExampleTag({ children = "Example" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{ background: T.sand, color: T.muted }}>
      {children}
    </span>
  )
}

function LiveDot() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: T.green }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: T.green }} />
    </span>
  )
}

// ── Count-up number, starts when scrolled into view ─────────────────────────
export function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  const reduce = useReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView || reduce) return
    let raf = 0
    const start = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduce, to, duration])
  return <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>{reduce ? to : n}{suffix}</span>
}

// ── Marquee band ────────────────────────────────────────────────────────────
export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items]
  return (
    <div className="relative overflow-hidden"
         style={{ WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
                  maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
      <style>{`
        @keyframes fb-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .fb-marquee { animation: fb-marquee 38s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .fb-marquee { animation: none; } }
      `}</style>
      <div className="fb-marquee flex w-max gap-3">
        {row.map((t, i) => (
          <span key={t + i}
                className="flex items-center gap-2.5 whitespace-nowrap rounded-full border px-5 py-2.5 text-[14px] font-semibold"
                style={{ borderColor: T.line, background: T.white, color: T.ink }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.orange }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── HERO: the live measure calendar ─────────────────────────────────────────
type Stage = "new" | "qualified" | "booked" | "chased" | "signed"
const STAGE: Record<Stage, { label: string; fg: string; bg: string }> = {
  new:       { label: "New lead",        fg: T.ink,     bg: T.sand },
  qualified: { label: "Qualified",       fg: T.amber,   bg: T.amberS },
  booked:    { label: "Measure booked",  fg: T.green,   bg: T.greenS },
  chased:    { label: "Quote chased",    fg: T.orangeD, bg: T.soft },
  signed:    { label: "Signed",          fg: "#FFFFFF", bg: T.green },
}

const FEED: { name: string; job: string; where: string; stage: Stage; note: string }[] = [
  { name: "Dana M.",    job: "LVP · 3 bedrooms",        where: "Carmel, IN",     stage: "booked",    note: "Thu 5 to 6pm" },
  { name: "Rob & Lisa", job: "Hardwood · living room",  where: "Fishers, IN",    stage: "qualified", note: "both home Sat" },
  { name: "Keisha T.",  job: "Tile · 2 bathrooms",      where: "Westfield, IN",  stage: "chased",    note: "day 5 follow-up" },
  { name: "Mark P.",    job: "Carpet to LVP · basement", where: "Noblesville, IN", stage: "signed",   note: "quote accepted" },
  { name: "Angela R.",  job: "Laminate · whole floor",  where: "Zionsville, IN", stage: "new",       note: "answered 8:41 PM" },
  { name: "Tom B.",     job: "Stairs + hallway · LVP",  where: "Carmel, IN",     stage: "booked",    note: "Mon 9 to 10am" },
]

export function HeroBoard() {
  const reduce = useReducedMotion()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setTick((t) => t + 1), 2600)
    return () => clearInterval(id)
  }, [reduce])

  // newest on top: each row keeps its sequence number as key, so rows slide down
  const visible = [0, 1, 2].map((k) => {
    const seq = tick + 2 - k
    return { seq, ...FEED[seq % FEED.length] }
  })
  const measures = 6 + (tick % 15)           // climbs toward 20, then the example resets
  const day = Math.min(60, 9 + (tick % 15) * 3)

  return (
    <div className="relative">
      {/* main card */}
      <div className="relative overflow-hidden rounded-[22px] border bg-white"
           style={{ borderColor: T.line, boxShadow: "0 30px 80px -30px rgba(28,25,23,0.28), 0 2px 6px rgba(28,25,23,0.04)" }}>
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: T.line }}>
          <div className="flex items-center gap-2.5">
            <span className="flex gap-1.5">
              {["#F5B5A6", "#F7D58C", "#A9DDB5"].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}
            </span>
            <span className="ml-1 font-heading text-[13.5px] font-bold" style={{ color: T.ink }}>Measure calendar</span>
          </div>
          <div className="flex items-center gap-2">
            <ExampleTag />
            <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: T.green }}><LiveDot /> Live</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <div className="rounded-2xl p-4" style={{ background: T.soft }}>
            <p className="text-[12px] font-semibold" style={{ color: T.orangeD }}>In-home measures booked</p>
            <p className="mt-1 font-heading text-[34px] font-extrabold leading-none" style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>
              {measures}<span className="text-[18px] font-bold" style={{ color: T.muted }}> / 20</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(249,115,22,0.15)" }}>
              <motion.div className="h-full rounded-full" style={{ background: T.orange }}
                          animate={{ width: `${(measures / 20) * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: T.sand }}>
            <p className="text-[12px] font-semibold" style={{ color: T.body }}>Program day</p>
            <p className="mt-1 font-heading text-[34px] font-extrabold leading-none" style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>
              {day}<span className="text-[18px] font-bold" style={{ color: T.muted }}> / 60</span>
            </p>
            <p className="mt-3 text-[12px]" style={{ color: T.muted }}>Every quote chased to a yes or no</p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[12.5px] font-bold" style={{ color: T.ink }}>Homeowners right now</p>
            <p className="font-mono text-[11px]" style={{ color: T.muted }}>from your Meta ads</p>
          </div>
          <div className="relative h-[198px] overflow-hidden">
            <AnimatePresence initial={false}>
              {visible.map((f, i) => (
                <motion.div key={f.seq}
                            initial={{ opacity: 0, y: -18 }}
                            animate={{ opacity: 1, y: i * 66 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                            className="absolute inset-x-0 top-0 flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
                            style={{ borderColor: T.line, background: T.cream }}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-[12.5px] font-bold"
                        style={{ background: T.white, color: T.ink, border: `1px solid ${T.line}` }}>
                    {f.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold" style={{ color: T.ink }}>{f.name}</p>
                    <p className="truncate text-[12px]" style={{ color: T.body }}>{f.job} · {f.where}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ color: STAGE[f.stage].fg, background: STAGE[f.stage].bg }}>
                    {STAGE[f.stage].label}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* floating chips */}
      <motion.div animate={reduce ? undefined : { y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -right-4 -top-16 hidden items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-2.5 sm:flex"
                  style={{ borderColor: T.line, boxShadow: "0 14px 34px -14px rgba(28,25,23,0.25)" }}>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: T.soft }}>
          <Zap className="h-4 w-4" style={{ color: T.orangeD }} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px]" style={{ color: T.muted }}>New homeowner</p>
          <p className="text-[13px] font-bold" style={{ color: T.ink }}>Answered in seconds</p>
        </div>
      </motion.div>

      <motion.div animate={reduce ? undefined : { y: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute -bottom-6 -left-6 hidden items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-2.5 sm:flex"
                  style={{ borderColor: T.line, boxShadow: "0 14px 34px -14px rgba(28,25,23,0.25)" }}>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: T.greenS }}>
          <PenLine className="h-4 w-4" style={{ color: T.green }} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px]" style={{ color: T.muted }}>Quote chased · day 9</p>
          <p className="text-[13px] font-bold" style={{ color: T.ink }}>Hardwood quote signed</p>
        </div>
      </motion.div>
    </div>
  )
}

// ── Pipeline: homeowners move from click to signed ──────────────────────────
const COLS = ["New", "Qualified", "Measure booked", "Quoted", "Signed"] as const
const CARDS = [
  { id: "a", name: "Dana M.",    job: "LVP · 3 rooms" },
  { id: "b", name: "Rob & Lisa", job: "Hardwood" },
  { id: "c", name: "Keisha T.",  job: "Tile · 2 baths" },
  { id: "d", name: "Mark P.",    job: "Carpet to LVP" },
  { id: "e", name: "Angela R.",  job: "Laminate" },
]
const START = [0, 0, 1, 2, 3]

export function Pipeline() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-80px" })
  const [stages, setStages] = useState<number[]>(START)
  const [ptr, setPtr] = useState(0)

  useEffect(() => {
    if (reduce || !inView) return
    const id = setInterval(() => {
      setStages((s) => {
        if (s.every((v) => v === 4)) return START
        const order = [...s.keys()].filter((k) => s[k] < 4)
        const k = order[ptr % order.length]
        const next = [...s]; next[k] = s[k] + 1
        return next
      })
      setPtr((p) => p + 1)
    }, 1500)
    return () => clearInterval(id)
  }, [reduce, inView, ptr])

  return (
    <div ref={ref} className="overflow-hidden rounded-[22px] border bg-white"
         style={{ borderColor: T.line, boxShadow: "0 30px 80px -34px rgba(28,25,23,0.25)" }}>
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: T.line }}>
        <p className="font-heading text-[13.5px] font-bold" style={{ color: T.ink }}>Homeowner pipeline</p>
        <ExampleTag />
      </div>
      <div className="overflow-x-auto">
        <LayoutGroup>
          <div className="grid min-w-[620px] grid-cols-5 gap-2.5 p-4">
            {COLS.map((col, ci) => (
              <div key={col} className="min-h-[300px] rounded-2xl p-2.5" style={{ background: ci === 4 ? T.greenS : T.cream }}>
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <p className="text-[11.5px] font-bold" style={{ color: ci === 4 ? T.green : T.body }}>{col}</p>
                  <span className="font-mono text-[11px]" style={{ color: T.muted }}>{stages.filter((s) => s === ci).length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {CARDS.map((c, k) => stages[k] === ci && (
                    <motion.div key={c.id} layoutId={`pipe-${c.id}`} layout
                                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                                className="rounded-xl border bg-white px-2.5 py-2"
                                style={{ borderColor: T.line, boxShadow: "0 2px 8px rgba(28,25,23,0.04)" }}>
                      <p className="text-[12.5px] font-semibold" style={{ color: T.ink }}>{c.name}</p>
                      <p className="text-[11px]" style={{ color: T.muted }}>{c.job}</p>
                      {ci === 3 && <p className="mt-1 text-[10.5px] font-semibold" style={{ color: T.orangeD }}>chasing…</p>}
                      {ci === 4 && <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: T.green }}><Check className="h-3 w-3" aria-hidden="true" /> signed</p>}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </LayoutGroup>
      </div>
    </div>
  )
}

// ── Example conversation on a phone, typed out live ─────────────────────────
// Agent style rules: no dashes, ranges written "5 to 6pm", always says it's an AI.
const CHAT: { who: "home" | "ai"; text: string }[] = [
  { who: "home", text: "Hi, saw your ad. Looking at LVP for the living room and hallway." },
  { who: "ai",   text: "Thanks for reaching out! Quick heads up, I'm the AI assistant for the team. Roughly how big is the area, and what's on the floor now?" },
  { who: "home", text: "Maybe 600 sq ft. Old carpet. Want it done before the holidays." },
  { who: "ai",   text: "Very doable. What's your ZIP so I can check we cover your area?" },
  { who: "home", text: "46032" },
  { who: "ai",   text: "You're in our area. Next step is a free measure at your home so the team can give you an exact quote. Will everyone who decides on the floor be home for it?" },
  { who: "home", text: "Yes, both of us after 5" },
  { who: "ai",   text: "We have Thursday 5 to 6pm or Saturday 9 to 10am. Which works better?" },
  { who: "home", text: "Thursday" },
  { who: "ai",   text: "You're booked for Thursday, 5 to 6pm. You'll get a reminder the day before." },
]

export function PhoneChat() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-80px" })
  const [step, setStep] = useState(3)
  const shown = reduce ? CHAT.length : step
  // the AI's "typing…" bubble shows while its next message is pending
  const typing = !reduce && inView && shown < CHAT.length && CHAT[shown].who === "ai"
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduce || !inView) return
    if (step >= CHAT.length) {
      const id = setTimeout(() => setStep(3), 4200)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setStep((s) => s + 1), CHAT[step].who === "ai" ? 1500 : 1100)
    return () => clearTimeout(id)
  }, [step, inView, reduce])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" })
  }, [shown, typing, reduce])

  return (
    <div ref={ref} className="mx-auto w-full max-w-[340px]">
      <div className="rounded-[42px] border-[10px] bg-white p-0"
           style={{ borderColor: T.ink, boxShadow: "0 40px 90px -36px rgba(28,25,23,0.45)" }}>
        <div className="flex items-center gap-2.5 border-b px-4 pb-3 pt-4" style={{ borderColor: T.line }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: T.soft }}>
            <MessageSquareText className="h-4 w-4" style={{ color: T.orangeD }} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-bold" style={{ color: T.ink }}>Your flooring company</p>
            <p className="text-[11px]" style={{ color: T.green }}>AI assistant · replies in seconds</p>
          </div>
          <ExampleTag />
        </div>
        <div ref={scroller} className="h-[430px] space-y-2.5 overflow-y-auto px-3.5 py-4" style={{ scrollbarWidth: "none" }}>
          <p className="text-center font-mono text-[10.5px]" style={{ color: T.muted }}>Today 8:42 PM</p>
          {CHAT.slice(0, shown).map((m, i) => (
            <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex ${m.who === "home" ? "justify-start" : "justify-end"}`}>
              <div className="max-w-[82%] px-3.5 py-2 text-[13px] leading-[1.45]"
                   style={m.who === "home"
                     ? { background: T.sand, color: T.ink, borderRadius: "16px 16px 16px 5px" }
                     : { background: T.orange, color: "#FFFFFF", borderRadius: "16px 16px 5px 16px" }}>
                {m.text}
              </div>
            </motion.div>
          ))}
          {typing && (
            <div className="flex justify-end">
              <div className="flex gap-1 rounded-2xl px-3.5 py-3" style={{ background: T.soft }}>
                {[0, 1, 2].map((d) => (
                  <motion.span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: T.orangeD }}
                               animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }} />
                ))}
              </div>
            </div>
          )}
          {shown >= CHAT.length && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                        className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold"
                        style={{ background: T.greenS, color: T.green }}>
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> Measure booked · 6 minutes
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── The system map: demand pipe → back office → your calendar ───────────────
// The one picture of what FieldBuilt installs. Every name and slot is an EXAMPLE.
const DEPARTMENTS = [
  { icon: Zap,               label: "Answers in 1 second" },
  { icon: ListChecks,        label: "Qualifies the project" },
  { icon: MessageSquareText, label: "Works every lead" },
  { icon: CalendarCheck,     label: "Books the measure" },
  { icon: BellRing,          label: "Reminds and reschedules" },
  { icon: Repeat,            label: "Chases every quote" },
  { icon: LineChart,         label: "Tracks every number" },
  { icon: Send,              label: "Hands you the job" },
]
const INCOMING = [
  { name: "Angela R.", job: "LVP · 3 rooms" },
  { name: "Rob & Lisa", job: "Hardwood · living room" },
  { name: "Keisha T.", job: "Tile · 2 bathrooms" },
]
const OUTCOMES = [
  { when: "Thu 5 to 6pm", what: "Measure · Angela R.", signed: false },
  { when: "Sat 9 to 10am", what: "Measure · Rob & Lisa", signed: false },
  { when: "Today", what: "Quote signed · Mark P.", signed: true },
]

function Flow({ vertical = false }: { vertical?: boolean }) {
  return (
    <div aria-hidden="true" className={vertical ? "relative mx-auto h-10 w-px lg:hidden" : "relative hidden h-px w-full self-center lg:block"}
         style={{ background: vertical
           ? `repeating-linear-gradient(180deg, ${T.line} 0 6px, transparent 6px 11px)`
           : `repeating-linear-gradient(90deg, ${T.line} 0 6px, transparent 6px 11px)` }}>
      <span className={vertical ? "fb-flow-v absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full" : "fb-flow-h absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"}
            style={{ background: T.orange, boxShadow: "0 0 0 4px rgba(249,115,22,0.15)" }} />
    </div>
  )
}

export function SystemMap() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-80px" })
  const seen = useInView(ref, { once: true, margin: "-80px" })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (reduce || !inView) return
    const id = setInterval(() => setTick((t) => t + 1), 1100)
    return () => clearInterval(id)
  }, [reduce, inView])
  const active = reduce ? -1 : tick % DEPARTMENTS.length

  const head = (n: string, title: string, sub: string) => (
    <div>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: T.orangeD }}>{n}</p>
      <p className="mt-1.5 font-heading text-[18px] font-extrabold leading-tight" style={{ color: T.ink }}>{title}</p>
      <p className="mt-1 text-[13.5px] leading-snug" style={{ color: T.body }}>{sub}</p>
    </div>
  )

  return (
    <div ref={ref} className="rounded-[26px] border bg-white p-4 sm:p-6"
         style={{ borderColor: T.line, boxShadow: "0 30px 80px -40px rgba(28,25,23,0.3)" }}>
      <style>{`
        @keyframes fb-flow-h { from { left: 0 } to { left: calc(100% - 8px) } }
        @keyframes fb-flow-v { from { top: 0 } to { top: calc(100% - 8px) } }
        .fb-flow-h { animation: fb-flow-h 1.6s ease-in-out infinite; }
        .fb-flow-v { animation: fb-flow-v 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .fb-flow-h, .fb-flow-v { animation: none; } }
      `}</style>
      <div className="mb-4 flex items-center justify-between px-1">
        <p className="font-heading text-[13.5px] font-bold" style={{ color: T.ink }}>What we install in your business</p>
        <ExampleTag />
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_44px_1.55fr_44px_1fr] lg:gap-0">
        {/* 01 the demand pipe */}
        <div className="rounded-2xl p-5" style={{ background: T.cream }}>
          {head("01 · The demand pipe", "Exclusive homeowners", "Ads we build and run in your service area. Never shared.")}
          <div className="mt-4 space-y-2">
            {INCOMING.map((l, i) => (
              <motion.div key={l.name} initial={{ opacity: 0, x: -10 }} animate={seen || reduce ? { opacity: 1, x: 0 } : {}}
                          transition={{ delay: 0.15 * i, duration: 0.45 }}
                          className="flex items-center justify-between rounded-xl border bg-white px-3 py-2" style={{ borderColor: T.line }}>
                <span>
                  <span className="block text-[12.5px] font-semibold" style={{ color: T.ink }}>{l.name}</span>
                  <span className="block text-[11px]" style={{ color: T.muted }}>{l.job}</span>
                </span>
                <Megaphone className="h-3.5 w-3.5 shrink-0" style={{ color: T.muted }} aria-hidden="true" />
              </motion.div>
            ))}
          </div>
        </div>

        <Flow /><Flow vertical />

        {/* 02 the back office */}
        <div className="rounded-2xl border-2 p-5" style={{ borderColor: "rgba(249,115,22,0.35)", background: T.white }}>
          {head("02 · The back office", "Runs every lead, 24/7", "Everything an office should do after a homeowner reaches out.")}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEPARTMENTS.map((d, i) => {
              const on = i === active
              return (
                <div key={d.label} className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors duration-300"
                     style={{ borderColor: on ? "rgba(249,115,22,0.45)" : T.line, background: on ? T.soft : T.white }}>
                  <d.icon className="h-4 w-4 shrink-0" style={{ color: on ? T.orangeD : T.body }} aria-hidden="true" />
                  <span className="text-[13px] font-semibold" style={{ color: T.ink }}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <Flow /><Flow vertical />

        {/* 03 your calendar */}
        <div className="rounded-2xl p-5" style={{ background: T.greenS }}>
          {head("03 · Your calendar", "Measures, booked", "Qualified, confirmed, every decision maker home.")}
          <div className="mt-4 space-y-2">
            {OUTCOMES.map((o, i) => (
              <motion.div key={o.what} initial={{ opacity: 0, x: 10 }} animate={seen || reduce ? { opacity: 1, x: 0 } : {}}
                          transition={{ delay: 0.4 + 0.15 * i, duration: 0.45 }}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                          style={{ background: o.signed ? T.green : T.white }}>
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: o.signed ? "#FFFFFF" : T.green }} aria-hidden="true" />
                <span>
                  <span className="block text-[12.5px] font-semibold" style={{ color: o.signed ? "#FFFFFF" : T.ink }}>{o.what}</span>
                  <span className="block text-[11px]" style={{ color: o.signed ? "rgba(255,255,255,0.8)" : T.muted }}>{o.when}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
