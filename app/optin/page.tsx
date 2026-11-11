"use client"

// ─── OPT-IN PAGE — /optin ────────────────────────────────────────────────────
// Destination for ad and content traffic. Structure and copy set by Jonathan
// (2026-11-11): call-out bar → headline → the two-question qualifier itself →
// video → how it works → guarantee → comparison → who it is not for →
// founder → Founding Five → FAQ → final CTA → footer. The qualifier sits in
// the hero rather than behind a button, so the first screen is the form.
//
// Offer terms are the source of truth for every number on this page:
//   10 shown in-home measures in the first 30 days, or every measure that
//   month is free. Founding Five: $497 setup, then $125 per shown measure,
//   locked 12 months, one shop per metro. Standard after that: $997 and $175.
//   Ad spend is the shop's own, $1,800 a month minimum. Month to month.
//
// Copy rules enforced here: no testimonials, review stars, client counts,
// revenue figures, logos or case studies (we have no flooring results yet),
// nothing about HVAC, no "20+", no "Example" labels, no mock calendar, and
// never "risk free", "no risk" or "free trial". Jonathan put "pay nothing"
// back in the headline and subheadline on 2026-11-10, so that one phrase is
// his wording, not a slip. It reads against the guarantee box, which keeps the
// setup fee when we miss.
//
// Submission contract is unchanged: POST /api/lead-intake, then the SMS agent
// texts them. Meta Pixel Lead fires only on a qualified submission, so Meta
// trains delivery on shops that fit.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react"
import { GhlBookingWidget } from "@/components/landing/shared"
import { Parquet, T } from "@/components/site/live"
import { Accent, Eyebrow, H2, Logo, PlankMark, Reveal, VslPlayer } from "@/components/site/ui"
import { track } from "@/components/site/Tracker"

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

// The mp4 in public/videos is 74 seconds. This one label drives the heading and
// the player badge, so swapping in the longer cut means changing it once.
const VIDEO_LENGTH = "5-minute"
const VIDEO_BADGE = "5 min"

// ── the two questions ───────────────────────────────────────────────────────
type Choice = { value: string; label: string; hint?: string }

const BUSINESS_TYPES: Choice[] = [
  { value: "showroom",     label: "Flooring showroom" },
  { value: "shop-at-home", label: "Shop at home" },
  { value: "contractor",   label: "Contractor" },
]

const CREW_SIZE: Choice[] = [
  { value: "0-2", label: "0 to 2" },
  { value: "3-5", label: "3 to 5" },
  { value: "6+",  label: "6+" },
]

type Answers = {
  businessType: string
  crewSize: string
}

const EMPTY: Answers = { businessType: "", crewSize: "" }

const QUESTIONS: { key: keyof Answers; title: string; note?: string; choices: Choice[] }[] = [
  { key: "businessType", title: "What type of flooring business do you run?", choices: BUSINESS_TYPES },
  { key: "crewSize",     title: "What's your install crew size?",
    note: "Crews of your own, not subs you call when something lands.", choices: CREW_SIZE },
]

const STEP_COUNT = QUESTIONS.length
const CONTACT_STEP = STEP_COUNT

// The quiz no longer screens anyone out, it tailors the demo. This stays as a
// completeness guard so a half-filled state can never reach the calendar.
function isQualified(a: Answers): boolean {
  return a.businessType !== "" && a.crewSize !== ""
}

export default function OptinPage() {
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Answers>(EMPTY)
  const [fullName, setFullName] = useState("")
  const [business, setBusiness] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [result, setResult] = useState<"none" | "qualified" | "noqual">("none")
  const [sending, setSending] = useState(false)

  // Picking an option advances on its own. The small delay lets the selected
  // state register before the step slides away, so the tap feels answered.
  function pick(key: keyof Answers, value: string) {
    setA((prev) => ({ ...prev, [key]: value }))
    track("quiz_step", { step, step_key: key, value })
    window.setTimeout(() => setStep((s) => Math.min(s + 1, CONTACT_STEP)), 180)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.reportValidity() || sending) return
    setSending(true)

    const qualified = isQualified(a)
    const name = fullName.trim()

    fetch("/api/lead-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: name.split(/\s+/)[0] ?? name,
        phone,
        email,
        qualified,
        vertical: "flooring",
        angle: [
          "optin-quiz",
          name,
          business.trim(),
          `type: ${a.businessType}`,
          `crew size: ${a.crewSize}`,
        ].join(" | "),
      }),
    }).catch(() => {})

    track("quiz_submit", {
      value: qualified ? "qualified" : "unqualified",
      meta: { business_type: a.businessType, crew_size: a.crewSize },
    })

    if (qualified && typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Lead", { content_name: "optin-quiz" })
      window.fbq("trackCustom", "QualifiedLead", { business_type: a.businessType, source: "optin-quiz" })
    }

    setResult(qualified ? "qualified" : "noqual")
  }

  return (
    <main className="overflow-x-clip font-sans" style={{ background: T.cream, color: T.ink }}>

      <header className="border-b" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <span className="hidden font-mono text-[11.5px] uppercase tracking-[0.14em] sm:inline" style={{ color: T.muted }}>
            Flooring contractors
          </span>
        </div>
      </header>

      {/* ── 1-3. CALL-OUT BAR, HEADLINE, SUBHEADLINE ── */}
      <section className="relative overflow-hidden px-5 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-14">
        <Parquet opacity={0.05} className="[mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_10%,transparent_72%)]" />

        <div className="relative mx-auto max-w-[760px]">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                      className="flex justify-center">
            <span className="inline-flex max-w-[540px] items-center gap-3.5 sm:max-w-none rounded-2xl border bg-white px-4 py-3 sm:rounded-full sm:py-2.5 sm:pl-2.5 sm:pr-6"
                  style={{ borderColor: "rgba(249,115,22,0.3)",
                           boxShadow: "0 18px 40px -22px rgba(249,115,22,0.75), 0 2px 8px -3px rgba(28,25,23,0.08)" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-2 sm:h-10 sm:w-10 sm:rounded-full sm:p-2.5"
                    style={{ background: T.orange }}>
                <PlankMark />
              </span>
              <span className="text-left text-[13.5px] font-semibold leading-snug sm:text-[15px]" style={{ color: T.ink }}>
                For flooring showrooms and shop-at-home companies{" "}
                <span style={{ color: T.orangeD }}>with their own install crews</span>.
              </span>
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }}
                     className="mt-6 text-center font-heading text-[clamp(30px,5.6vw,56px)] sm:mt-7 font-extrabold leading-[1.04] tracking-[-0.03em]"
                     style={{ color: T.ink, textWrap: "balance" }}>
            Get +10 Qualified Shown Booked Flooring Measures In The Next 30 Days.{" "}
            <span style={{ color: T.orangeD }}>Or You Pay Nothing</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16 }}
                    className="mx-auto mt-5 max-w-[620px] text-center text-[clamp(17px,2.1vw,20px)] font-medium leading-relaxed sm:mt-6"
                    style={{ color: T.ink }}>
            Pay per appointment. If we don&rsquo;t get you at least 10 flooring jobs booked, you pay nothing.
          </motion.p>

          {/* ── 4. the qualifier, straight under the promise ── */}
          <motion.div id="quiz" data-track-view="quiz"
                      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26 }}
                      className="mx-auto mt-7 max-w-[640px] scroll-mt-6 sm:mt-9">
            {result === "none" ? (
              <QuizCard
                step={step} a={a}
                fullName={fullName} business={business} phone={phone} email={email}
                sending={sending}
                onPick={pick}
                onBack={() => setStep((s) => Math.max(s - 1, 0))}
                setFullName={setFullName} setBusiness={setBusiness}
                setPhone={setPhone} setEmail={setEmail}
                onSubmit={submit}
              />
            ) : (
              <ResultCard result={result} />
            )}

            <p className="mx-auto mt-6 max-w-[460px] text-center text-[13px] leading-relaxed" style={{ color: T.muted }}>
              Your details go to us and nobody else. We never sell or share them.{" "}
              <Link href="/privacy" className="underline underline-offset-2" style={{ color: T.muted }}>Privacy</Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── 5. the video ── */}
      <section className="border-y px-5 py-14 sm:px-8 sm:py-18" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto max-w-[900px]">
          <Reveal className="mb-7 text-center">
            <H2 className="!text-[clamp(25px,3.4vw,38px)]">Watch this {VIDEO_LENGTH} video <Accent>before you book.</Accent></H2>
          </Reveal>
          <Reveal delay={0.05}><VslPlayer length={VIDEO_BADGE} /></Reveal>
        </div>
      </section>

      <HowItWorks />
      <GuaranteeBox />
      <Comparison />
      <NotForYou />
      <Founder />
      <FoundingFive />
      <Faq />
      <FinalCta />

      <footer className="border-t px-5 py-8 sm:px-8" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-wrap items-center justify-between gap-4 text-[13.5px]" style={{ color: T.muted }}>
            <Logo size="sm" />
            <span>© {new Date().getFullYear()} FieldBuilt AI</span>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-[#1C1917]">Privacy policy</Link>
              <Link href="/terms" className="hover:text-[#1C1917]">Terms</Link>
            </div>
          </div>
          <p className="mt-5 text-[12.5px] leading-relaxed" style={{ color: T.muted }}>
            This site is not part of or endorsed by Meta.
          </p>
        </div>
      </footer>
    </main>
  )
}

// ── the quiz card ───────────────────────────────────────────────────────────
function QuizCard(p: {
  step: number
  a: Answers
  fullName: string; business: string; phone: string; email: string
  sending: boolean
  onPick: (k: keyof Answers, v: string) => void
  onBack: () => void
  setFullName: (v: string) => void
  setBusiness: (v: string) => void
  setPhone: (v: string) => void
  setEmail: (v: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}) {
  const onContact = p.step === CONTACT_STEP
  const shown = Math.min(p.step + 1, STEP_COUNT)
  const pct = Math.round((onContact ? 1 : shown / STEP_COUNT) * 100)
  const q = QUESTIONS[p.step]

  const field = "w-full rounded-xl border px-4 py-3.5 text-[16px] outline-none transition focus:border-orange-500 focus:ring-[3px] focus:ring-orange-500/20"

  return (
    <div className="rounded-[26px] border bg-white p-5 sm:p-9"
         style={{ borderColor: T.line, boxShadow: "0 30px 70px -40px rgba(28,25,23,0.35)" }}>

      <p className="mb-5 text-center font-heading text-[15px] font-bold leading-snug sm:text-[16.5px]"
         style={{ color: T.ink, textWrap: "balance" }}>
        Fill the quiz and get a personalized demo of the system sent to you,{" "}
        <span style={{ color: T.orangeD }}>tailored to your company</span>.
      </p>

      <div className="flex items-center gap-4">
        <div className="h-[6px] flex-1 overflow-hidden rounded-full" style={{ background: T.sand }}>
          <motion.div className="h-full rounded-full" style={{ background: T.orange }}
                      initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.45, ease: "easeOut" }} />
        </div>
        <span className="shrink-0 font-mono text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.muted }}>
          {onContact ? "Last step" : `Question ${shown} of ${STEP_COUNT}`}
        </span>
      </div>

      <div className="relative mt-7 min-h-[300px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={p.step}
                      initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}>

            {!onContact && q && (
              <Question title={q.title} note={q.note}>
                <Options choices={q.choices} selected={p.a[q.key]} onPick={(v) => p.onPick(q.key, v)} />
              </Question>
            )}

            {onContact && (
              <Question title="Where should we send your answer?"
                        note="We text you within a minute with whether your metro is open.">
                <form onSubmit={p.onSubmit} className="grid gap-3">
                  <input value={p.fullName} onChange={(e) => p.setFullName(e.target.value)}
                         placeholder="Full name" required autoComplete="name"
                         className={field} style={{ borderColor: T.line, color: T.ink }} />
                  <input value={p.business} onChange={(e) => p.setBusiness(e.target.value)}
                         placeholder="Business name" required autoComplete="organization"
                         className={field} style={{ borderColor: T.line, color: T.ink }} />
                  <input value={p.phone} onChange={(e) => p.setPhone(e.target.value)} type="tel"
                         placeholder="Mobile phone" required autoComplete="tel"
                         className={field} style={{ borderColor: T.line, color: T.ink }} />
                  <input value={p.email} onChange={(e) => p.setEmail(e.target.value)} type="email"
                         placeholder="Email" required autoComplete="email"
                         className={field} style={{ borderColor: T.line, color: T.ink }} />

                  <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5"
                         style={{ borderColor: T.line, background: T.cream }}>
                    <input type="checkbox" required
                           className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-orange-500" />
                    <span className="text-[12.5px] leading-relaxed" style={{ color: T.body }}>
                      I agree to receive calls and texts from Fieldbuilt about my request, including
                      automated reminders. Message and data rates may apply. Reply STOP to opt out.
                    </span>
                  </label>

                  <button type="submit" disabled={p.sending}
                          className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 font-heading text-[16px] font-bold text-white transition disabled:opacity-50"
                          style={{ background: T.orange, boxShadow: "0 14px 32px -12px rgba(249,115,22,0.6)" }}>
                    {p.sending ? "Checking…" : "Check my metro"}
                    {!p.sending && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
                  </button>
                </form>
              </Question>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {p.step > 0 && (
        <button onClick={p.onBack} type="button"
                className="mt-2 inline-flex items-center gap-1.5 font-heading text-[13.5px] font-semibold transition hover:opacity-70"
                style={{ color: T.muted }}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Back
        </button>
      )}
    </div>
  )
}

function Question({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-heading text-[clamp(20px,2.7vw,27px)] font-extrabold leading-[1.15] tracking-[-0.02em]"
          style={{ color: T.ink, textWrap: "balance" }}>
        {title}
      </h3>
      {note && <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: T.muted }}>{note}</p>}
      <div className="mt-6">{children}</div>
    </div>
  )
}

// Lettered rows rather than radio buttons: bigger tap targets, and the letter
// gives the eye a rhythm to run down.
function Options({ choices, selected, onPick }: { choices: Choice[]; selected: string; onPick: (v: string) => void }) {
  return (
    <div className="grid gap-2.5">
      {choices.map((c, i) => {
        const on = selected === c.value
        return (
          <button key={c.value} type="button" onClick={() => onPick(c.value)}
                  className="group flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all hover:-translate-y-[1px]"
                  style={{
                    borderColor: on ? T.orange : T.line,
                    background: on ? T.soft : T.white,
                    boxShadow: on ? "0 12px 26px -16px rgba(249,115,22,0.7)" : "none",
                  }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[12.5px] font-bold transition"
                  style={{ background: on ? T.orange : T.sand, color: on ? "#FFFFFF" : T.muted }}>
              {on ? <Check className="h-4 w-4" aria-hidden="true" /> : String.fromCharCode(65 + i)}
            </span>
            <span className="min-w-0">
              <span className="block font-heading text-[16px] font-bold leading-snug"
                    style={{ color: on ? T.orangeD : T.ink }}>{c.label}</span>
              {c.hint && <span className="mt-0.5 block text-[13.5px] leading-snug" style={{ color: T.muted }}>{c.hint}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── after submit ────────────────────────────────────────────────────────────
function ResultCard({ result }: { result: "qualified" | "noqual" }) {
  if (result === "noqual") {
    return (
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                  className="rounded-[26px] border bg-white p-6 sm:p-10"
                  style={{ borderColor: T.line, boxShadow: "0 30px 70px -40px rgba(28,25,23,0.35)" }}>
        <h3 className="font-heading text-[clamp(22px,3vw,30px)] font-extrabold leading-[1.1] tracking-[-0.02em]"
            style={{ color: T.ink }}>
          Thanks.
        </h3>
        <p className="mt-4 text-[16.5px] leading-relaxed" style={{ color: T.body }}>
          Right now this is built for flooring showrooms and shop-at-home companies doing $500K+ with
          their own crews and an ad budget of $1,800 a month. We&rsquo;ll keep your details and reach
          out if that changes.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                data-track-view="calendar"
                className="rounded-[26px] border bg-white p-4 sm:p-8"
                style={{ borderColor: T.orange, boxShadow: "0 30px 80px -40px rgba(249,115,22,0.45)" }}>
      <h3 className="text-center font-heading text-[clamp(22px,3vw,31px)] font-extrabold leading-[1.1] tracking-[-0.02em]"
          style={{ color: T.ink, textWrap: "balance" }}>
        Your metro is open. <Accent>Pick a time for your 20-minute call.</Accent>
      </h3>
      <div className="mt-6 overflow-hidden rounded-[20px]">
        <GhlBookingWidget />
      </div>
    </motion.div>
  )
}

// ── 7. HOW IT WORKS ─────────────────────────────────────────────────────────
const STEPS = [
  { h: "We install it",           b: "Ads, homeowner page, back office and confirmations, in your name." },
  { h: "Ads run in your account", b: "$1,800/month minimum, you own the account and every homeowner." },
  { h: "We qualify and book",     b: "Homeowners answer qualifying questions, get booked on your calendar and get reminded the night before and the morning of." },
  { h: "You measure and close",   b: "You only pay $125 for measures where the homeowner was there and your crew measured." },
]

function HowItWorks() {
  return (
    <section className="border-y px-5 py-14 sm:px-8 sm:py-18" style={{ background: T.white, borderColor: T.line }}>
      <div className="mx-auto max-w-[900px]">
        <Reveal className="mb-9 text-center">
          <Eyebrow>How it works</Eyebrow>
          <H2 className="mt-3 !text-[clamp(25px,3.4vw,38px)]">Four parts, <Accent>installed in your business.</Accent></H2>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <Reveal key={s.h} delay={i * 0.05}>
              <div className="h-full rounded-2xl border p-5" style={{ borderColor: T.line, background: T.cream }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl font-mono text-[14px] font-bold"
                      style={{ background: T.soft, color: T.orangeD }}>{i + 1}</span>
                <h3 className="mt-4 font-heading text-[18px] font-extrabold leading-snug" style={{ color: T.ink }}>{s.h}</h3>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: T.body }}>{s.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 8. GUARANTEE ────────────────────────────────────────────────────────────
const NEVER_BILLED = [
  "No-shows",
  "Renters",
  "Out-of-area homeowners",
  "The wrong product",
  "A missing decision maker",
  "A budget under your minimum",
]

function GuaranteeBox() {
  return (
    <section className="px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto max-w-[760px]">
        <Reveal>
          <div className="rounded-[26px] border p-6 sm:p-9"
               style={{ background: T.white, borderColor: "rgba(249,115,22,0.35)", boxShadow: "0 30px 70px -45px rgba(249,115,22,0.5)" }}>
            <h2 className="font-heading text-[clamp(24px,3.3vw,36px)] font-extrabold leading-[1.08] tracking-[-0.025em]"
                style={{ color: T.ink, textWrap: "balance" }}>
              If we miss, <Accent>the measures are free.</Accent>
            </h2>
            <p className="mt-4 text-[16.5px] leading-relaxed" style={{ color: T.body }}>
              Fewer than 10 shown measures in your first 30 days? You owe zero measure fees for that
              month. No-shows are never billed. Setup is kept and ad spend goes straight to Meta from
              your account.
            </p>

            <details className="group mt-6 rounded-2xl border" style={{ borderColor: T.line, background: T.cream }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-heading text-[15px] font-bold"
                       style={{ color: T.ink }}>
                Read the exact terms
                <Plus className="h-4 w-4 shrink-0 transition-transform group-open:rotate-45" style={{ color: T.orangeD }} aria-hidden="true" />
              </summary>
              <div className="border-t px-5 py-5" style={{ borderColor: T.line }}>
                <p className="font-heading text-[14px] font-bold uppercase tracking-[0.08em]" style={{ color: T.muted }}>
                  A shown measure
                </p>
                <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: T.body }}>
                  The homeowner owns the home, every decision maker is there, the project is in your
                  service area, it meets your minimum budget and starts within 90 days, and your crew
                  completes the measure.
                </p>
                <p className="mt-6 font-heading text-[14px] font-bold uppercase tracking-[0.08em]" style={{ color: T.muted }}>
                  Never billed
                </p>
                <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {NEVER_BILLED.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-[15px] leading-snug" style={{ color: T.body }}>
                      <X className="mt-0.5 h-4 w-4 shrink-0" style={{ color: T.orangeD }} aria-hidden="true" />{t}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[15px] leading-relaxed" style={{ color: T.body }}>
                  Fewer than 10 shown measures in the first 30 days: zero measure fees for that period.
                  The setup fee is kept.
                </p>
              </div>
            </details>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── 9. COMPARISON ───────────────────────────────────────────────────────────
const COLUMNS = ["Fieldbuilt", "Shared lead sites", "Agency retainer"]
const ROWS: { label: string; cells: [string, string, string] }[] = [
  { label: "Who else gets the homeowner",
    cells: ["Nobody, one shop per metro", "Sold to several contractors", "Depends"] },
  { label: "Who owns the ads and the homeowner list",
    cells: ["You", "The lead site", "Usually the agency"] },
  { label: "What you pay for",
    cells: ["Shown measures only", "Every lead, good or bad", "A monthly retainer"] },
  { label: "Contract",
    cells: ["Month to month", "Per lead", "Often 6 to 12 months"] },
]

function Comparison() {
  return (
    <section className="border-y px-5 py-14 sm:px-8 sm:py-18" style={{ background: T.white, borderColor: T.line }}>
      <div className="mx-auto max-w-[980px]">
        <Reveal className="mb-9 text-center">
          <Eyebrow>The difference</Eyebrow>
          <H2 className="mt-3 !text-[clamp(25px,3.4vw,38px)]">Where the homeowner <Accent>actually goes.</Accent></H2>
        </Reveal>

        {/* mobile: one card per row */}
        <Reveal className="grid gap-3 sm:hidden">
          {ROWS.map((r) => (
            <div key={r.label} className="rounded-2xl border p-4" style={{ borderColor: T.line, background: T.cream }}>
              <p className="font-heading text-[15px] font-extrabold leading-snug" style={{ color: T.ink }}>{r.label}</p>
              <dl className="mt-3 grid gap-2">
                {r.cells.map((c, i) => (
                  <div key={COLUMNS[i]} className="rounded-xl px-3 py-2.5"
                       style={{ background: i === 0 ? T.soft : T.white, border: `1px solid ${i === 0 ? "rgba(249,115,22,0.3)" : T.line}` }}>
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: i === 0 ? T.orangeD : T.muted }}>
                      {COLUMNS[i]}
                    </dt>
                    <dd className="mt-1 text-[14.5px] font-semibold leading-snug" style={{ color: T.ink }}>{c}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </Reveal>

        {/* sm and up: the real table */}
        <Reveal className="hidden sm:block">
          <div className="overflow-hidden rounded-[22px] border" style={{ borderColor: T.line }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr style={{ background: T.cream }}>
                  <th scope="col" className="w-[30%] px-5 py-4" />
                  {COLUMNS.map((c, i) => (
                    <th key={c} scope="col" className="px-5 py-4 font-heading text-[15px] font-extrabold"
                        style={{ color: i === 0 ? T.orangeD : T.muted, background: i === 0 ? T.soft : "transparent" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label} className="border-t" style={{ borderColor: T.line }}>
                    <th scope="row" className="px-5 py-4 align-top font-heading text-[14.5px] font-bold leading-snug"
                        style={{ color: T.ink }}>{r.label}</th>
                    {r.cells.map((c, i) => (
                      <td key={COLUMNS[i]} className="px-5 py-4 align-top text-[14.5px] leading-snug"
                          style={{ color: i === 0 ? T.ink : T.body, background: i === 0 ? T.soft : "transparent",
                                   fontWeight: i === 0 ? 600 : 400 }}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── 10. NOT FOR YOU ─────────────────────────────────────────────────────────
const NOT_FOR = [
  "You're an installer or subcontractor looking for work",
  "You don't sell direct to homeowners",
  "You can't fund $1,800 a month in ads",
  "You don't have a crew free to run 10+ measures this month",
]

function NotForYou() {
  return (
    <section className="px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto max-w-[760px]">
        <Reveal className="mb-8 text-center">
          <Eyebrow>Be honest with yourself</Eyebrow>
          <H2 className="mt-3 !text-[clamp(25px,3.4vw,38px)]">This is <Accent>not</Accent> for you if</H2>
        </Reveal>
        <Reveal className="grid gap-2.5">
          {NOT_FOR.map((t) => (
            <div key={t} className="flex items-start gap-3 rounded-2xl border bg-white px-4 py-3.5"
                 style={{ borderColor: T.line }}>
              <X className="mt-0.5 h-5 w-5 shrink-0" style={{ color: T.orangeD }} aria-hidden="true" />
              <span className="text-[15.5px] font-semibold leading-snug" style={{ color: T.ink }}>{t}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// ── 11. FOUNDER ─────────────────────────────────────────────────────────────
// Photo lives at public/brand/johnny.jpg. Until that file is dropped in, the
// monogram tile stands in, so the block never renders a broken image.
function FounderPhoto() {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // A 404 fires before React attaches onError, so the first render has to ask
  // the element itself whether the file ever arrived.
  useEffect(() => {
    const el = ref.current
    if (el && el.complete && el.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) {
    return (
      <span className="flex h-[180px] w-[180px] shrink-0 items-center justify-center rounded-[22px] font-heading text-[56px] font-extrabold text-white sm:h-[200px] sm:w-[200px]"
            style={{ background: T.ink }} aria-hidden="true">J</span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src="/brand/johnny.jpg" alt="Johnny, who installs every FieldBuilt account"
         width={200} height={200} onError={() => setFailed(true)}
         className="h-[180px] w-[180px] shrink-0 rounded-[22px] object-cover sm:h-[200px] sm:w-[200px]"
         style={{ background: T.sand }} />
  )
}

const FOUNDER_POINTS = [
  "I build and install each system personally.",
  "I only take one shop per metro.",
  "You keep everything I build.",
]

function Founder() {
  return (
    <section className="border-y px-5 py-14 sm:px-8 sm:py-18" style={{ background: T.white, borderColor: T.line }}>
      <div className="mx-auto max-w-[860px]">
        <Reveal className="flex flex-col items-center gap-7 text-center sm:flex-row sm:items-start sm:gap-10 sm:text-left">
          <FounderPhoto />
          <div>
            <H2 className="!text-[clamp(24px,3.2vw,36px)]">Why I install <Accent>every account myself.</Accent></H2>
            <ul className="mt-5 grid gap-3">
              {FOUNDER_POINTS.map((t) => (
                <li key={t} className="flex items-start justify-center gap-2.5 text-[16.5px] leading-relaxed sm:justify-start"
                    style={{ color: T.body }}>
                  <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: T.green }} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── 12. FOUNDING FIVE ───────────────────────────────────────────────────────
function FoundingFive() {
  return (
    <section className="px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto max-w-[860px]">
        <Reveal>
          <div className="rounded-[26px] border p-6 sm:p-9" style={{ background: T.white, borderColor: T.line }}>
            <H2 className="!text-[clamp(24px,3.2vw,36px)]">Founding Five: <Accent>5 of 5 spots left.</Accent></H2>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl p-5" style={{ background: T.soft, border: "1px solid rgba(249,115,22,0.3)" }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: T.orangeD }}>What you get</p>
                <p className="mt-3 text-[15.5px] leading-relaxed" style={{ color: T.ink }}>
                  $497 setup and $125 per shown measure, locked for 12 months, one shop per metro.
                </p>
              </div>
              <div className="rounded-2xl p-5" style={{ background: T.cream, border: `1px solid ${T.line}` }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: T.muted }}>What you give</p>
                <p className="mt-3 text-[15.5px] leading-relaxed" style={{ color: T.ink }}>
                  A short recorded result at day 30, your shop name and city, and permission to show
                  your real numbers.
                </p>
              </div>
            </div>

            <p className="mt-6 text-[15.5px] leading-relaxed" style={{ color: T.body }}>
              After the five fill: $997 setup and $175 per shown measure.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── 13. FAQ ─────────────────────────────────────────────────────────────────
const FAQ: { q: string; a: string }[] = [
  { q: "Who owns the ad account and the homeowners?",
    a: "You do. Ads run in your account and you keep the system." },
  { q: "What counts as a shown measure?",
    a: "The homeowner owns the home, every decision maker is there, the project is in your service area, it meets your minimum budget and starts within 90 days, and your crew completes the measure." },
  { q: "Why is there a $1,800 minimum?",
    a: "Under that there isn't enough ad volume to book 10 shown measures in 30 days, so the guarantee wouldn't be fair to either side." },
  { q: "What if I get fewer than 10?",
    a: "You owe zero measure fees for that month. Setup is kept." },
  { q: "Is there a contract?",
    a: "No. Month to month. Cancel any time." },
  { q: "What happens on the call?",
    a: "20 minutes on your service area, how the measures get booked, and whether your metro is open." },
]

function Faq() {
  return (
    <section className="border-y px-5 py-14 sm:px-8 sm:py-18" style={{ background: T.white, borderColor: T.line }}>
      <div className="mx-auto max-w-[760px]">
        <Reveal className="mb-8 text-center">
          <Eyebrow>Questions</Eyebrow>
          <H2 className="mt-3 !text-[clamp(25px,3.4vw,38px)]">Before you <Accent>book a time.</Accent></H2>
        </Reveal>
        <Reveal className="grid gap-2.5">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border" style={{ borderColor: T.line, background: T.cream }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-heading text-[15.5px] font-bold leading-snug"
                       style={{ color: T.ink }}>
                {f.q}
                <Plus className="h-4 w-4 shrink-0 transition-transform group-open:rotate-45" style={{ color: T.orangeD }} aria-hidden="true" />
              </summary>
              <p className="border-t px-5 py-4 text-[15px] leading-relaxed" style={{ borderColor: T.line, color: T.body }}>
                {f.a}
              </p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// ── 14. FINAL CTA ───────────────────────────────────────────────────────────
const NEXT = [
  "Answer 2 questions.",
  "Pick a time.",
  "See your system with your company name on it.",
]

function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 py-16 sm:px-8 sm:py-20">
      <Parquet opacity={0.05} className="[mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,#000_10%,transparent_72%)]" />
      <div className="relative mx-auto max-w-[680px] text-center">
        <Reveal>
          <H2 className="!text-[clamp(26px,3.8vw,42px)]">Check if your metro is <Accent>still open.</Accent></H2>

          <ol className="mx-auto mt-8 grid max-w-[520px] gap-2.5 text-left">
            {NEXT.map((t, i) => (
              <li key={t} className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5"
                  style={{ borderColor: T.line }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-bold"
                      style={{ background: T.soft, color: T.orangeD }}>{i + 1}</span>
                <span className="text-[15.5px] font-semibold leading-snug" style={{ color: T.ink }}>{t}</span>
              </li>
            ))}
          </ol>

          <a href="#quiz" data-track="optin-final"
             className="group mt-9 inline-flex w-full items-center justify-center gap-2.5 rounded-full px-8 py-4 font-heading text-[16px] font-bold text-white transition-all hover:-translate-y-0.5 sm:w-auto"
             style={{ background: T.orange, boxShadow: "0 12px 30px -10px rgba(249,115,22,0.6)" }}>
            See if your metro is open
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  )
}
