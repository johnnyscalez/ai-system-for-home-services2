"use client"

// ─── OPT-IN QUIZ — /optin ────────────────────────────────────────────────────
// Destination for ad and content traffic that should answer questions rather
// than book straight away. Headline, subheadline, then a one-question-at-a-time
// quiz. Built 2026-11-04 (Jonathan).
//
// Submission contract is the same one LeadFormSection uses, so leads from here
// land exactly like leads from /start: POST /api/lead-intake, then the SMS
// agent texts them. See components/landing/shared.tsx for the original.
//
// Qualification matches the rest of the funnel: at least one install crew.
// docs/flooring-pivot.md — "Not a fit: one-person installers with no crew".
// Meta Pixel Lead fires only on a qualified submission, so delivery trains on
// contractors with crews.
//
// Positioning rules: no price, no guarantee failure terms, no invented
// flooring results.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, Phone } from "lucide-react"
import { Parquet, T } from "@/components/site/live"
import { Logo } from "@/components/site/ui"

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

// ── the quiz ────────────────────────────────────────────────────────────────
type Choice = { value: string; label: string; hint?: string }

const BUSINESS_TYPES: Choice[] = [
  { value: "shop-at-home",      label: "Shop-at-home flooring",   hint: "You bring the samples to the homeowner" },
  { value: "showroom-installs", label: "Showroom that installs",  hint: "They come to you, your crews install" },
  { value: "installer-led",     label: "Installer-led contractor", hint: "You came up installing, now you run the company" },
  { value: "other",             label: "Something else",           hint: "Tell us on the call" },
]

const CREWS: Choice[] = [
  { value: "0",   label: "None yet",  hint: "I subcontract or install solo" },
  { value: "1",   label: "1 crew" },
  { value: "2-3", label: "2 to 3 crews" },
  { value: "4+",  label: "4 or more crews" },
]

const BOTTLENECKS: Choice[] = [
  { value: "not-enough-measures", label: "Not enough measures on the calendar" },
  { value: "quotes-go-quiet",     label: "Quotes go out and go quiet" },
  { value: "slow-to-answer",      label: "Leads wait too long for an answer" },
  { value: "seasonal",            label: "The calendar dies every winter" },
]

type Answers = {
  businessType: string
  crews: string
  bottleneck: string
  serviceArea: string
}

const EMPTY: Answers = { businessType: "", crews: "", bottleneck: "", serviceArea: "" }

// Same rule as the rest of the funnel: a crew is the dividing line.
function isQualified(crews: string): boolean {
  return crews !== "" && crews !== "0"
}

const STEP_COUNT = 5

export default function OptinPage() {
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Answers>(EMPTY)
  const [firstName, setFirstName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [result, setResult] = useState<"none" | "qualified" | "noqual">("none")
  const [sending, setSending] = useState(false)

  // Picking an option advances on its own. The small delay lets the selected
  // state register before the step slides away, so the tap feels answered.
  function pick(key: keyof Answers, value: string) {
    setA((prev) => ({ ...prev, [key]: value }))
    window.setTimeout(() => setStep((s) => Math.min(s + 1, STEP_COUNT - 1)), 180)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.reportValidity() || sending) return
    setSending(true)

    const qualified = isQualified(a.crews)
    const area = a.serviceArea.trim()

    fetch("/api/lead-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        phone,
        email,
        business_type: a.businessType,
        crews: a.crews,
        service_area: area,
        qualified,
        vertical: "flooring",
        angle: `optin-quiz | ${a.businessType} | crews: ${a.crews} | area: ${area} | pain: ${a.bottleneck}`,
      }),
    }).catch(() => {})

    if (qualified && typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Lead", { content_name: "optin-quiz" })
      window.fbq("trackCustom", "QualifiedLead", { business_type: a.businessType, crews: a.crews, source: "optin-quiz" })
    }

    setResult(qualified ? "qualified" : "noqual")
  }

  const showQuiz = result === "none"

  return (
    <main className="min-h-screen overflow-x-clip font-sans" style={{ background: T.cream, color: T.ink }}>
      {/* Logo only. Nothing else to click, because every other link is an exit. */}
      <header className="border-b" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <span className="font-mono text-[11.5px] uppercase tracking-[0.14em]" style={{ color: T.muted }}>
            Flooring contractors
          </span>
        </div>
      </header>

      <section className="relative px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <Parquet opacity={0.05} className="[mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,#000_10%,transparent_70%)]" />

        <div className="relative mx-auto max-w-[720px]">
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                     className="text-center font-heading text-[clamp(30px,5.2vw,52px)] font-extrabold leading-[1.05] tracking-[-0.03em]"
                     style={{ color: T.ink, textWrap: "balance" }}>
            See if we can put <span style={{ color: T.orangeD }}>20+ booked measures</span> on your calendar
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12 }}
                    className="mx-auto mt-5 max-w-[560px] text-center text-[clamp(16px,1.8vw,18.5px)] leading-relaxed"
                    style={{ color: T.body }}>
            Four quick questions about how your business runs today. Takes about thirty seconds,
            and you will know straight away whether your service area is open.
          </motion.p>

          <div className="mt-10 sm:mt-12">
            {showQuiz ? (
              <QuizCard
                step={step} a={a} firstName={firstName} phone={phone} email={email} sending={sending}
                onPick={pick}
                onBack={() => setStep((s) => Math.max(s - 1, 0))}
                onArea={(v) => setA((prev) => ({ ...prev, serviceArea: v }))}
                onAreaNext={() => setStep(4)}
                setFirstName={setFirstName} setPhone={setPhone} setEmail={setEmail}
                onSubmit={submit}
              />
            ) : (
              <ResultCard result={result} firstName={firstName} />
            )}
          </div>

          <p className="mx-auto mt-7 max-w-[460px] text-center text-[13px] leading-relaxed" style={{ color: T.muted }}>
            Your details go to us and nobody else. We never sell or share them.{" "}
            <Link href="/privacy" className="underline underline-offset-2" style={{ color: T.muted }}>Privacy</Link>
          </p>
        </div>
      </section>
    </main>
  )
}

// ── the card ────────────────────────────────────────────────────────────────
function QuizCard(p: {
  step: number
  a: Answers
  firstName: string; phone: string; email: string; sending: boolean
  onPick: (k: keyof Answers, v: string) => void
  onBack: () => void
  onArea: (v: string) => void
  onAreaNext: () => void
  setFirstName: (v: string) => void
  setPhone: (v: string) => void
  setEmail: (v: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}) {
  const pct = Math.round(((p.step + 1) / STEP_COUNT) * 100)

  return (
    <div className="rounded-[26px] border bg-white p-6 sm:p-9"
         style={{ borderColor: T.line, boxShadow: "0 30px 70px -40px rgba(28,25,23,0.35)" }}>

      {/* progress */}
      <div className="flex items-center gap-4">
        <div className="h-[6px] flex-1 overflow-hidden rounded-full" style={{ background: T.sand }}>
          <motion.div className="h-full rounded-full" style={{ background: T.orange }}
                      initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.45, ease: "easeOut" }} />
        </div>
        <span className="shrink-0 font-mono text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.muted }}>
          {p.step + 1} / {STEP_COUNT}
        </span>
      </div>

      <div className="relative mt-7 min-h-[332px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={p.step}
                      initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}>

            {p.step === 0 && (
              <Question title="What best describes your flooring business?">
                <Options choices={BUSINESS_TYPES} selected={p.a.businessType} onPick={(v) => p.onPick("businessType", v)} />
              </Question>
            )}

            {p.step === 1 && (
              <Question title="How many install crews do you run?"
                        note="Crews of your own, not subs you call when something lands.">
                <Options choices={CREWS} selected={p.a.crews} onPick={(v) => p.onPick("crews", v)} />
              </Question>
            )}

            {p.step === 2 && (
              <Question title="What is costing you the most right now?">
                <Options choices={BOTTLENECKS} selected={p.a.bottleneck} onPick={(v) => p.onPick("bottleneck", v)} />
              </Question>
            )}

            {p.step === 3 && (
              <Question title="Where do your crews install?"
                        note="City or metro is enough. We check whether the area is already taken.">
                <form onSubmit={(e) => { e.preventDefault(); if (p.a.serviceArea.trim()) p.onAreaNext() }}>
                  <input autoFocus value={p.a.serviceArea} onChange={(e) => p.onArea(e.target.value)}
                         placeholder="Columbus, OH" required
                         className="w-full rounded-xl border px-4 py-3.5 text-[16px] outline-none transition focus:border-orange-500 focus:ring-[3px] focus:ring-orange-500/20"
                         style={{ borderColor: T.line, color: T.ink }} />
                  <button type="submit" disabled={!p.a.serviceArea.trim()}
                          className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 font-heading text-[15.5px] font-bold text-white transition disabled:opacity-40"
                          style={{ background: T.orange }}>
                    Continue
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </form>
              </Question>
            )}

            {p.step === 4 && (
              <Question title="Where should we send your answer?"
                        note="We text you within a minute with whether your area is open.">
                <form onSubmit={p.onSubmit} className="grid gap-3">
                  <input value={p.firstName} onChange={(e) => p.setFirstName(e.target.value)}
                         placeholder="First name" required autoComplete="given-name"
                         className="w-full rounded-xl border px-4 py-3.5 text-[16px] outline-none transition focus:border-orange-500 focus:ring-[3px] focus:ring-orange-500/20"
                         style={{ borderColor: T.line, color: T.ink }} />
                  <input value={p.phone} onChange={(e) => p.setPhone(e.target.value)} type="tel"
                         placeholder="Mobile number" required autoComplete="tel"
                         className="w-full rounded-xl border px-4 py-3.5 text-[16px] outline-none transition focus:border-orange-500 focus:ring-[3px] focus:ring-orange-500/20"
                         style={{ borderColor: T.line, color: T.ink }} />
                  <input value={p.email} onChange={(e) => p.setEmail(e.target.value)} type="email"
                         placeholder="Email" required autoComplete="email"
                         className="w-full rounded-xl border px-4 py-3.5 text-[16px] outline-none transition focus:border-orange-500 focus:ring-[3px] focus:ring-orange-500/20"
                         style={{ borderColor: T.line, color: T.ink }} />
                  <button type="submit" disabled={p.sending}
                          className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 font-heading text-[16px] font-bold text-white transition disabled:opacity-50"
                          style={{ background: T.orange, boxShadow: "0 14px 32px -12px rgba(249,115,22,0.6)" }}>
                    {p.sending ? "Sending…" : "Show me my answer"}
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
      <h2 className="font-heading text-[clamp(20px,2.7vw,27px)] font-extrabold leading-[1.15] tracking-[-0.02em]"
          style={{ color: T.ink, textWrap: "balance" }}>
        {title}
      </h2>
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
function ResultCard({ result, firstName }: { result: "qualified" | "noqual"; firstName: string }) {
  const name = firstName.trim() ? `, ${firstName.trim()}` : ""

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="rounded-[26px] border bg-white p-7 sm:p-10"
                style={{ borderColor: result === "qualified" ? T.orange : T.line,
                         boxShadow: "0 30px 70px -40px rgba(28,25,23,0.35)" }}>
      {result === "qualified" ? (
        <>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: T.soft }}>
            <Phone className="h-5 w-5" style={{ color: T.orangeD }} aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-heading text-[clamp(23px,3.2vw,32px)] font-extrabold leading-[1.1] tracking-[-0.02em]"
              style={{ color: T.ink }}>
            You run crews{name}. That is who this is built for.
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed" style={{ color: T.body }}>
            <strong style={{ color: T.ink }}>Check your phone.</strong> We are texting you right now about
            your area, and you can reply there to grab a time. No waiting on a callback.
          </p>
          <Link href="/book"
                className="group mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-heading text-[15.5px] font-bold text-white transition hover:-translate-y-0.5"
                style={{ background: T.orange, boxShadow: "0 14px 32px -12px rgba(249,115,22,0.6)" }}>
            Or pick your time now
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </>
      ) : (
        <>
          <h2 className="font-heading text-[clamp(22px,3vw,30px)] font-extrabold leading-[1.1] tracking-[-0.02em]"
              style={{ color: T.ink }}>
            Straight answer{name}: not yet.
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed" style={{ color: T.body }}>
            This is built for flooring companies with their own install crews. Twenty measures in sixty days
            would bury you before it helped you, and we are not going to sell you something that does that.
          </p>
          <p className="mt-4 text-[16.5px] leading-relaxed" style={{ color: T.body }}>
            Get a crew running steady, then come back. The offer will still be here.
          </p>
        </>
      )}
    </motion.div>
  )
}
