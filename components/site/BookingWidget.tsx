"use client"

// ─── /book calendar widget ───────────────────────────────────────────────────
// Our own booking widget in place of GHL's iframe (Jonathan, 2026-11-22). Only
// the widget changed; the page around it is untouched.
//   1. Two questions: yearly revenue ($0-$200K is not a fit) and website
//      (or "No website" → company name + city).
//   2. Open times from the GHL sales calendar, shown in the visitor's own
//      time zone (detected by the browser, changeable).
//   3. First name, mobile, email → booked in GHL (app/api/book).
// The open times start loading the moment the page opens, so they are ready
// by the time the two questions are answered. Server: lib/book-widget.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, CalendarCheck, Check, ChevronDown, Globe, Loader2 } from "lucide-react"
import { T } from "@/components/site/live"
import { track } from "@/components/site/Tracker"

const REVENUE = [
  { value: "$0-$200K", label: "$0 to $200K" },
  { value: "$201K-$500K", label: "$201K to $500K" },
  { value: "$500K-$1M", label: "$500K to $1M" },
  { value: "$1M+", label: "$1M+" },
] as const
const NOT_A_FIT = "$0-$200K"

const US_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
]

type Step = "qualify" | "website" | "time" | "details" | "done" | "nofit"

// ── time helpers (all rendering happens in the visitor's zone) ──────────────
function detectZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
  } catch {
    return "America/New_York"
  }
}
function dayKey(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))
}
function timeLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso))
}
function dayParts(iso: string, tz: string) {
  const d = new Date(iso)
  return {
    weekday: new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d),
    month: new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short" }).format(d),
    day: new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(d),
  }
}
function longDay(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date(iso))
}
function shortDay(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso))
}
function zoneName(tz: string, at = new Date()) {
  const part = (style: "longGeneric" | "short") => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? ""
    } catch {
      return ""
    }
  }
  const long = part("longGeneric") || tz.replace(/_/g, " ")
  const short = part("short")
  return short && short !== long && !/^GMT[+-]/.test(long) ? `${long} (${short})` : long
}

// ── small UI pieces ──────────────────────────────────────────────────────────
const field =
  "w-full rounded-xl border bg-white px-4 py-3.5 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-[#A8A29E] focus:border-[#F97316] focus:shadow-[0_0_0_4px_rgba(249,115,22,0.12)]"

function StepDots({ step }: { step: Step }) {
  const idx = step === "qualify" || step === "website" || step === "nofit" ? 0 : step === "time" ? 1 : 2
  const labels = ["Your company", "Pick a time", "Your details"]
  return (
    <ol className="flex items-center gap-2 text-[12.5px] font-semibold" aria-label="Booking steps">
      {labels.map((l, i) => {
        const done = i < idx || step === "done"
        const active = i === idx && step !== "done"
        return (
          <li key={l} className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold transition-colors"
              style={{
                background: done ? T.green : active ? T.ink : T.sand,
                color: done || active ? "#fff" : T.muted,
              }}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={active ? "" : "hidden sm:inline"} style={{ color: active ? T.ink : T.muted }}>
              {l}
            </span>
            {i < labels.length - 1 && <span className="mx-1 h-px w-5 sm:w-8" style={{ background: T.line }} aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

/** One question, alone and big: "Question 1 of 2", the question, a short line under it. */
function QuestionHead({ n, title, sub, htmlFor }: { n: number; title: React.ReactNode; sub?: string; htmlFor?: string }) {
  const Title = htmlFor ? "label" : "h3"
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="flex gap-1" aria-hidden="true">
          {[1, 2].map((i) => (
            <span key={i} className="h-[5px] w-7 rounded-full transition-colors duration-300" style={{ background: i <= n ? T.orange : T.line }} />
          ))}
        </span>
        <span className="text-[13px] font-semibold" style={{ color: T.muted }}>
          Question {n} of 2
        </span>
      </div>
      <Title
        {...(htmlFor ? { htmlFor } : {})}
        className="mt-2.5 block font-heading text-[24px] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[28px]"
        style={{ color: T.ink, textWrap: "balance" }}
      >
        {title}
      </Title>
      {sub && (
        <p className="mt-2.5 text-[15.5px] leading-relaxed" style={{ color: T.body }}>
          {sub}
        </p>
      )}
    </div>
  )
}

/**
 * A tappable answer card. The whole card picks the answer; its own field
 * opens underneath and takes the cursor, so one tap = ready to type.
 */
function ChoiceCard({ selected, onSelect, title, inputId, children }: {
  selected: boolean
  onSelect: () => void
  title: string
  inputId: string
  children: React.ReactNode
}) {
  const pick = () => {
    if (!selected) onSelect()
    window.setTimeout(() => document.getElementById(inputId)?.focus(), 60)
  }
  return (
    <div
      className="rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200"
      style={{
        background: selected ? T.soft : T.white,
        borderColor: selected ? T.orange : T.line,
        boxShadow: selected ? "0 0 0 3px rgba(249,115,22,0.12)" : "0 1px 2px rgba(28,25,23,0.04)",
      }}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={pick}
        className="flex w-full items-center gap-3.5 px-4 py-4 text-left sm:px-5"
      >
        <span
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200"
          style={{ borderColor: selected ? T.orange : "#D6D3D1", background: selected ? T.orange : T.white }}
          aria-hidden="true"
        >
          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </span>
        <span className="font-heading text-[16px] font-bold leading-snug sm:text-[17px]" style={{ color: T.ink }}>
          {title}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            key="field"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 sm:px-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PrimaryButton({ children, disabled, onClick, type = "button", loading = false }: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: "button" | "submit"
  loading?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="group inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 font-heading text-[16px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: T.orange, boxShadow: disabled ? "none" : "0 12px 30px -12px rgba(249,115,22,0.65)" }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-[14px] font-semibold transition-colors hover:text-[#1C1917]" style={{ color: T.muted }}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {children}
    </button>
  )
}

// ── the widget ───────────────────────────────────────────────────────────────
export function BookingWidget() {
  const [step, setStep] = useState<Step>("qualify")

  // step 1
  const [revenue, setRevenue] = useState<string>("")
  const [website, setWebsite] = useState("")
  const [noWebsite, setNoWebsite] = useState(false)
  const [company, setCompany] = useState("")

  // step 2
  const [tz, setTz] = useState("America/New_York")
  const [slots, setSlots] = useState<string[] | null>(null)
  const [slotsFailed, setSlotsFailed] = useState(false)
  const fetchedAt = useRef(0)
  const [day, setDay] = useState<string>("")
  const [slot, setSlot] = useState<string>("")
  const [slotNotice, setSlotNotice] = useState("")

  // step 3
  const [firstName, setFirstName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [trap, setTrap] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [bookedIso, setBookedIso] = useState("")

  const rootRef = useRef<HTMLDivElement>(null)

  // Open times load as soon as the page opens, not when the questions are done.
  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch("/api/book/slots", { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as { slots: string[] }
      setSlots(json.slots)
      setSlotsFailed(false)
      fetchedAt.current = Date.now()
    } catch {
      setSlotsFailed(true)
    }
  }, [])

  useEffect(() => {
    setTz(detectZone())
    loadSlots()
  }, [loadSlots])

  const zones = useMemo(() => (US_ZONES.includes(tz) ? US_ZONES : [tz, ...US_ZONES]), [tz])

  const days = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const s of slots ?? []) {
      if (Date.parse(s) < Date.now() + 15 * 60_000) continue
      const k = dayKey(s, tz)
      map.set(k, [...(map.get(k) ?? []), s])
    }
    return [...map.entries()].map(([key, list]) => ({ key, list }))
  }, [slots, tz])

  // Keep a valid day selected as slots or the zone change.
  useEffect(() => {
    if (!days.length) return
    if (!days.some((d) => d.key === day)) setDay(days[0].key)
  }, [days, day])

  const dayList = days.find((d) => d.key === day)?.list ?? []

  const websiteOk = /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(website.trim().replace(/^https?:\/\//i, ""))
  const step1Ok = !!revenue && (noWebsite ? company.trim().length > 1 : websiteOk)

  const scrollTop = () => {
    const el = rootRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top
    if (top < 70) window.scrollTo({ top: window.scrollY + top - 90, behavior: "smooth" })
  }
  const go = (s: Step) => {
    setStep(s)
    setError("")
    requestAnimationFrame(scrollTop)
  }

  // Tapping an answer moves straight on, after a beat so the tick is seen.
  const pickRevenue = (v: string) => {
    setRevenue(v)
    track("quiz_step", { step: 1, step_key: "cal_revenue", value: v, meta: { qualified: v !== NOT_A_FIT } })
    if (v === NOT_A_FIT) track("quiz_step", { step: 1, step_key: "cal_not_a_fit", value: v })
    window.setTimeout(() => go(v === NOT_A_FIT ? "nofit" : "website"), 260)
  }

  const toTimes = () => {
    if (!step1Ok) return
    track("quiz_step", { step: 2, step_key: "cal_website", value: noWebsite ? "company_name" : "website" })
    if (revenue === NOT_A_FIT) return go("nofit")
    if (Date.now() - fetchedAt.current > 3 * 60_000) loadSlots() // refresh quietly if the page sat open
    go("time")
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revenue,
          website: noWebsite ? "" : website,
          noWebsite,
          company: noWebsite ? company : "",
          firstName,
          phone,
          email,
          timeZone: tz,
          startIso: slot,
          company_fax: trap,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; startIso?: string; error?: string; slots?: string[] }
      if (res.ok && json.ok) {
        setBookedIso(json.startIso ?? slot)
        track("quiz_submit", { step: 4, step_key: "cal_booked", value: revenue, meta: { website: !noWebsite, tz } })
        // No browser Schedule event: GHL's booking workflow sends it through the
        // Conversions API, and a pixel copy without a shared event_id would count twice.
        go("done")
        return
      }
      if (res.status === 409 && json.slots) {
        setSlots(json.slots)
        fetchedAt.current = Date.now()
        setSlot("")
        setSlotNotice("Someone just took that time. Pick another one.")
        go("time")
        return
      }
      track("quiz_step", { step: 4, step_key: "cal_book_failed", value: String(res.status) })
      setError(json.error && json.error !== "not_a_fit" ? json.error : "We couldn't book that right now. Please try again.")
    } catch {
      setError("Connection problem. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const fade = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }

  return (
    <div ref={rootRef} className="px-5 py-6 text-left sm:px-9 sm:py-8" style={{ color: T.ink }}>
      {step !== "done" && step !== "nofit" && (
        <div className="mb-7 flex items-center justify-between gap-3">
          <StepDots step={step} />
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {/* ── 1a. revenue, its own screen ── */}
        {step === "qualify" && (
          <motion.div key="qualify" {...fade}>
            <QuestionHead n={1} title="How much does your company bring in a year?" sub="A ballpark is fine." />
            <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Yearly revenue">
              {REVENUE.map((r) => {
                const on = revenue === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickRevenue(r.value)}
                    className="relative rounded-2xl border bg-white px-4 py-5 text-center font-heading text-[17px] font-bold transition-[background-color,border-color,box-shadow] duration-200 hover:bg-[#FFF8F3] sm:text-[18px]"
                    style={{
                      background: on ? T.soft : undefined,
                      borderColor: on ? T.orange : T.line,
                      boxShadow: on ? "0 0 0 3px rgba(249,115,22,0.14)" : "0 1px 2px rgba(28,25,23,0.04)",
                    }}
                  >
                    {r.label}
                    {on && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white" style={{ background: T.orange }}>
                        <Check className="h-3 w-3 text-white" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── 1b. website, its own screen: two choice cards, each with its own field ── */}
        {step === "website" && (
          <motion.div key="website" {...fade}>
            <QuestionHead
              n={2}
              title={<>Drop your website. <span style={{ color: T.orangeD }}>We&rsquo;ll build you a new landing page</span> and text it to you in 2 minutes.</>}
              sub="High-converting, built on your brand."
            />

            <div className="mt-6 space-y-3" role="radiogroup" aria-label="Your website">
              <ChoiceCard
                selected={!noWebsite}
                onSelect={() => setNoWebsite(false)}
                title="Here’s my website"
                inputId="bw-website"
              >
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2" style={{ color: T.muted }} aria-hidden="true" />
                  <input
                    id="bw-website"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="yourcompany.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && toTimes()}
                    className={`${field} pl-11`}
                    style={{ borderColor: T.line }}
                  />
                </div>
              </ChoiceCard>

              <ChoiceCard
                selected={noWebsite}
                onSelect={() => setNoWebsite(true)}
                title="I don’t have a website. Build it off my company name."
                inputId="bw-company"
              >
                <input
                  id="bw-company"
                  type="text"
                  autoComplete="organization"
                  placeholder="Your company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && toTimes()}
                  className={field}
                  style={{ borderColor: T.line }}
                />
              </ChoiceCard>
            </div>

            <div className="mt-7">
              <PrimaryButton disabled={!step1Ok} onClick={toTimes}>
                See open times
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </PrimaryButton>
            </div>
            <div className="mt-4 text-center">
              <BackLink onClick={() => go("qualify")}>Back</BackLink>
            </div>
          </motion.div>
        )}

        {/* ── not a fit ── */}
        {step === "nofit" && (
          <motion.div key="nofit" {...fade} className="py-4 text-center">
            <h3 className="font-heading text-[21px] font-extrabold tracking-[-0.01em]">Thanks for your answers.</h3>
            <p className="mx-auto mt-3 max-w-[460px] text-[15.5px] leading-relaxed" style={{ color: T.body }}>
              FieldBuilt is built for flooring companies that sell jobs to homeowners under their own name. From your answers, a walkthrough wouldn&rsquo;t help you yet. If that changes, come back to this page any time.
            </p>
          </motion.div>
        )}

        {/* ── 2. pick a time ── */}
        {step === "time" && (
          <motion.div key="time" {...fade}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="font-heading text-[19px] font-extrabold tracking-[-0.01em] sm:text-[21px]">Pick a time for your walkthrough</h3>
            </div>

            <label className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[13.5px]" style={{ color: T.body }}>
              <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="shrink-0">Times shown in</span>
              <span className="relative inline-flex min-w-0 items-center">
                <select
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  className="min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-5 font-semibold underline decoration-[#D6D3D1] underline-offset-4 outline-none"
                  style={{ color: T.ink }}
                  aria-label="Time zone"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {zoneName(z)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </label>

            {slotNotice && (
              <p className="mt-4 rounded-xl px-4 py-3 text-[14px] font-semibold" style={{ background: T.amberS, color: T.amber }} role="status">
                {slotNotice}
              </p>
            )}

            {slots === null && !slotsFailed && (
              <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading open times">
                <div className="flex gap-2.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[76px] flex-1 animate-pulse rounded-2xl" style={{ background: T.sand }} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-[52px] animate-pulse rounded-xl" style={{ background: T.sand }} />
                  ))}
                </div>
              </div>
            )}

            {slotsFailed && slots === null && (
              <div className="mt-6 rounded-2xl border px-5 py-6 text-center" style={{ borderColor: T.line }}>
                <p className="text-[15px]" style={{ color: T.body }}>We couldn&rsquo;t load the calendar.</p>
                <button type="button" onClick={loadSlots} className="mt-3 font-heading text-[15px] font-bold" style={{ color: T.orangeD }}>
                  Try again
                </button>
              </div>
            )}

            {slots !== null && days.length === 0 && (
              <div className="mt-6 rounded-2xl border px-5 py-6 text-center" style={{ borderColor: T.line }}>
                <p className="text-[15px]" style={{ color: T.body }}>
                  The calendar is full for the next few days. Check back tomorrow for new times.
                </p>
              </div>
            )}

            {days.length > 0 && (
              <>
                <div className="-mx-1 mt-5 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Day">
                  {days.map((d) => {
                    const p = dayParts(d.list[0], tz)
                    const on = d.key === day
                    return (
                      <button
                        key={d.key}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => {
                          setDay(d.key)
                          setSlot("")
                        }}
                        className="flex min-w-[64px] flex-1 snap-start flex-col items-center rounded-2xl border px-2 py-3 transition-all"
                        style={{
                          background: on ? T.ink : T.white,
                          borderColor: on ? T.ink : T.line,
                          color: on ? "#fff" : T.ink,
                        }}
                      >
                        <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: on ? "rgba(255,255,255,0.7)" : T.muted }}>
                          {p.weekday}
                        </span>
                        <span className="font-heading text-[22px] font-extrabold leading-tight">{p.day}</span>
                        <span className="text-[12px]" style={{ color: on ? "rgba(255,255,255,0.7)" : T.muted }}>
                          {p.month}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Time">
                  {dayList.map((s) => {
                    const on = s === slot
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setSlot(s)
                          setSlotNotice("")
                        }}
                        className="rounded-xl border bg-white px-3 py-3.5 font-heading text-[15.5px] font-bold transition-[background-color,border-color,box-shadow,color] duration-200 hover:bg-[#FFF8F3]"
                        style={{
                          background: on ? T.orange : undefined,
                          borderColor: on ? T.orange : T.line,
                          color: on ? "#fff" : T.ink,
                          boxShadow: on ? "0 10px 24px -12px rgba(249,115,22,0.7)" : "0 1px 2px rgba(28,25,23,0.04)",
                        }}
                      >
                        {timeLabel(s, tz)}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div className="mt-7">
              <PrimaryButton disabled={!slot} onClick={() => { track("quiz_step", { step: 3, step_key: "cal_time_picked", value: slot }); go("details") }}>
                Continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </PrimaryButton>
            </div>
            <div className="mt-4 text-center">
              <BackLink onClick={() => go("website")}>Back</BackLink>
            </div>
          </motion.div>
        )}

        {/* ── 3. contact details ── */}
        {step === "details" && (
          <motion.form key="details" {...fade} onSubmit={submit} noValidate>
            <div className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5" style={{ background: T.soft }}>
              <div className="flex min-w-0 items-center gap-3">
                <CalendarCheck className="h-5 w-5 shrink-0" style={{ color: T.orangeD }} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-heading text-[15.5px] font-bold">{slot && shortDay(slot, tz)}</div>
                  <div className="text-[13.5px]" style={{ color: T.body }}>
                    {slot && timeLabel(slot, tz)} · {zoneName(tz, slot ? new Date(slot) : undefined)}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => go("time")} className="shrink-0 text-[13.5px] font-bold" style={{ color: T.orangeD }}>
                Change
              </button>
            </div>

            <h3 className="mt-7 font-heading text-[19px] font-extrabold tracking-[-0.01em] sm:text-[21px]">Where should we send the details?</h3>

            <div className="mt-4 space-y-2.5">
              <input aria-label="First name" type="text" autoComplete="given-name" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} style={{ borderColor: T.line }} required />
              <input aria-label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} style={{ borderColor: T.line }} required />
              <input aria-label="Email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} style={{ borderColor: T.line }} required />
              {/* honeypot: hidden from people, filled by simple bots */}
              <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute left-[-9999px] h-0 w-0 opacity-0" aria-hidden="true" />
            </div>

            {error && (
              <p className="mt-4 rounded-xl px-4 py-3 text-[14px] font-semibold" style={{ background: T.amberS, color: T.amber }} role="alert">
                {error}
              </p>
            )}

            <div className="mt-6">
              <PrimaryButton type="submit" loading={submitting} disabled={!firstName.trim() || phone.replace(/\D/g, "").length < 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}>
                {submitting ? "Booking…" : "Book my walkthrough"}
              </PrimaryButton>
            </div>
            <p className="mt-3 text-center text-[12px] leading-relaxed" style={{ color: T.muted }}>
              By booking, you agree to get texts about your walkthrough. Msg &amp; data rates may apply. Reply STOP to opt out.
            </p>
            <div className="mt-3 text-center">
              <BackLink onClick={() => go("time")}>Back</BackLink>
            </div>
          </motion.form>
        )}

        {/* ── booked ── */}
        {step === "done" && (
          <motion.div key="done" {...fade} className="py-4 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.05 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: T.greenS }}
            >
              <Check className="h-8 w-8" style={{ color: T.green }} aria-hidden="true" />
            </motion.div>
            <h3 className="mt-5 font-heading text-[24px] font-extrabold tracking-[-0.02em]">You&rsquo;re booked.</h3>
            <p className="mt-2 font-heading text-[17px] font-bold">
              {bookedIso && longDay(bookedIso, tz)} at {bookedIso && timeLabel(bookedIso, tz)}
            </p>
            <p className="text-[14px]" style={{ color: T.muted }}>
              {zoneName(tz, bookedIso ? new Date(bookedIso) : undefined)}
            </p>
            <p className="mx-auto mt-5 max-w-[420px] text-[15.5px] leading-relaxed" style={{ color: T.body }}>
              It&rsquo;s a Google Meet, on your phone, no download. We&rsquo;ll text you in a minute to confirm.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
