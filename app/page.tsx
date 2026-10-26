"use client"

// ─────────────────────────────────────────────────────────────────────────────
// FIELDBUILT — homepage for flooring contractors with install crews.
// Positioning rules: docs/flooring-pivot.md (exact offer wording, no price,
// no guarantee failure terms, no invented flooring results, examples labelled).
// Light, warm, white-card design. Signature: a faint parquet texture behind the
// hero and the closing section. Live panels live in components/site/live.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight, ArrowUpRight, BadgeCheck, CalendarCheck, CalendarX, Car, Check, ChevronDown,
  Clock, Megaphone, MessageSquareText, Phone, Repeat, Snowflake, Users, Wrench, X, Zap,
  ListChecks, LineChart, ShieldCheck,
} from "lucide-react"
import { CountUp, HeroBoard, Marquee, Parquet, PhoneChat, Pipeline, T } from "@/components/site/live"
import { Accent, Eyebrow, GhostCta, H2, IcpHeadline, IconTile, Logo, PrimaryCta, Reveal } from "@/components/site/ui"

// ── content ─────────────────────────────────────────────────────────────────
const PROJECTS = [
  "Luxury vinyl plank", "Hardwood install", "Hardwood refinishing", "Tile and stone", "Carpet",
  "Laminate", "Stairs and landings", "Basements", "Whole-home flooring", "Shop-at-home", "Showrooms that install",
]

const PAINS = [
  { icon: Users,     title: "Shared leads",            body: "The same homeowner gets sold to four other flooring companies. Half never pick up." },
  { icon: Clock,     title: "Slow callbacks",          body: "Homeowners ask three companies at once and book whoever answers first." },
  { icon: Car,       title: "Wasted measure drives",   body: "45 minutes out, then: \"my husband needs to be here before we decide.\"" },
  { icon: CalendarX, title: "Quotes that go quiet",    body: "The quote goes out, life gets busy, nobody follows up. The job just disappears." },
  { icon: Snowflake, title: "The winter dip",          body: "Early fall is packed. November to February, the calendar thins out fast." },
  { icon: Wrench,    title: "Crews waiting on work",   body: "You have the installers. What you don't have is a steady line of measures." },
]

const SERVICES = [
  { icon: Megaphone,         title: "Meta ads we run for you",    body: "Ads built for homeowners ready for new floors, aimed only at the ZIP codes your crews cover. You pay the ad spend straight to Meta." },
  { icon: Zap,               title: "Answered in seconds",        body: "Every homeowner gets a reply by text or phone the moment they reach out. Nights, weekends, holidays." },
  { icon: ListChecks,        title: "Qualified before the visit", body: "Project type, size, timeline, ZIP code, and every decision maker home. Tire kickers never reach your calendar." },
  { icon: CalendarCheck,     title: "Measures booked for you",    body: "Real openings on your real calendar, with a confirmation, a day-before reminder and an easy reschedule." },
  { icon: Repeat,            title: "Every quote chased",         body: "After the measure it follows up by text, call and email until the homeowner signs or says no." },
  { icon: LineChart,         title: "You see everything",         body: "Every conversation, every measure and every quote in one place. You always know where each job stands." },
]

const STEPS = [
  { n: "01", title: "Walkthrough call",       body: "20 minutes. We look at your service area, your crews and how your quotes get followed up today." },
  { n: "02", title: "We build it",            body: "Your ads, your service area, your qualification rules and your calendar, set up and tested by us." },
  { n: "03", title: "Ads go live",            body: "Homeowners start coming in. Every one is answered, qualified and booked for a measure." },
  { n: "04", title: "Measures and signed quotes", body: "Your estimator runs the measures. We chase every quote until you get a yes or a no." },
]

const FAQ = [
  { q: "Who pays for the ads?",
    a: "You do, directly to Meta, on your own card. It never passes through us and it's separate from our fee. You see every dollar and every result." },
  { q: "Does the AI pretend to be a person?",
    a: "Never. It tells every homeowner it's the AI assistant for your team. It writes in plain, friendly language and hands anything unusual to you." },
  { q: "Will it quote my prices?",
    a: "No. It never gives a flooring price. It books the in-home measure, and the quote comes from you after the measure, like it does today." },
  { q: "What if I already have a CRM or calendar?",
    a: "Keep it. We plug into the calendar and CRM you already use, so your office keeps working the way it works now." },
  { q: "What kind of flooring companies is this for?",
    a: "US flooring contractors with their own install crews: shop-at-home companies, showrooms that install, and installer-led contractors." },
  { q: "How do the 20 measures get counted?",
    a: "Every in-home measure booked with a qualified homeowner in your service area counts. We'll walk you through exactly how it works on the call." },
]

// ── page ────────────────────────────────────────────────────────────────────
export default function Home() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <main className="overflow-x-clip font-sans" style={{ background: T.cream, color: T.ink }}>

      {/* ── announcement ─────────────────────────────────────────────────── */}
      <div className="border-b px-4 py-2.5 text-center text-[13px]" style={{ background: T.soft, borderColor: "rgba(249,115,22,0.15)" }}>
        <Link href="/book" className="inline-flex items-center gap-2 font-semibold" style={{ color: T.ink }}>
          <span className="rounded-full px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-white" style={{ background: T.orange }}>New</span>
          The flooring program is open. See if your service area is a fit
          <ArrowRight className="h-3.5 w-3.5" style={{ color: T.orangeD }} aria-hidden="true" />
        </Link>
      </div>

      {/* ── nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ background: "rgba(255,255,255,0.86)", borderColor: T.line }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/"><Logo /></Link>
          <nav className="hidden items-center gap-8 text-[14.5px] font-medium md:flex" style={{ color: T.body }}>
            <a href="#how" className="hover:text-[#1C1917]">How it works</a>
            <a href="#offer" className="hover:text-[#1C1917]">The offer</a>
            <a href="#process" className="hover:text-[#1C1917]">Process</a>
            <a href="#faq" className="hover:text-[#1C1917]">FAQ</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden text-[14.5px] font-medium sm:block" style={{ color: T.body }}>Log in</Link>
            <Link href="/book" className="rounded-full px-4 py-2.5 font-heading text-[13.5px] font-bold text-white sm:px-5"
                  style={{ background: T.orange }}>
              Book a walkthrough
            </Link>
          </div>
        </div>
      </header>

      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${T.white} 0%, ${T.cream} 100%)` }}>
        <Parquet opacity={0.055}
                 className="[mask-image:radial-gradient(ellipse_70%_70%_at_75%_30%,#000_20%,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            <IcpHeadline align="left" />

            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08 }}
                       className="mt-6 font-heading text-[clamp(36px,5.8vw,70px)] font-extrabold leading-[1.02] tracking-[-0.035em]"
                       style={{ color: T.ink }}>
              Guaranteed <span className="relative sm:whitespace-nowrap" style={{ color: T.orangeD }}>
                20 in-home measures
                <svg aria-hidden="true" viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute -bottom-1 left-0 hidden h-[0.18em] w-full sm:block">
                  <motion.path d="M2 9 C 80 2, 200 2, 298 7" fill="none" stroke={T.orange} strokeWidth="4" strokeLinecap="round"
                               initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.6 }} />
                </svg>
              </span> in 60 days.
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                      className="mt-6 font-heading text-[clamp(19px,2vw,23px)] font-bold leading-snug" style={{ color: T.ink }}>
              And every quote chased until it signs or says no.
            </motion.p>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.28 }}
                      className="mt-4 max-w-[540px] text-[17px] leading-relaxed" style={{ color: T.body }}>
              We run the Meta ads in your service area, answer every homeowner in seconds, qualify them,
              book the measure on your calendar, and follow up on every quote. You keep your crews busy.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.36 }}
                        className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryCta big>Book a 20-minute walkthrough</PrimaryCta>
              <GhostCta href="#how">See how it works</GhostCta>
            </motion.div>

            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
                       className="mt-9 grid gap-x-6 gap-y-2.5 text-[14.5px] font-medium sm:grid-cols-2" style={{ color: T.body }}>
              {["We run the Meta ads for you", "Answered in seconds, 24/7", "Every decision maker home for the measure", "Installed by the founder"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <BadgeCheck className="h-[18px] w-[18px] shrink-0" style={{ color: T.orange }} aria-hidden="true" />{t}
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.8, delay: 0.25, ease: "easeOut" }} className="lg:pl-4">
            <HeroBoard />
          </motion.div>
        </div>
      </section>

      {/* ── marquee ──────────────────────────────────────────────────────── */}
      <section className="border-y py-10" style={{ background: T.white, borderColor: T.line }}>
        <p className="mb-6 text-center font-mono text-[12px] uppercase tracking-[0.16em]" style={{ color: T.muted }}>
          Built for every project your crews install
        </p>
        <Marquee items={PROJECTS} />
      </section>

      {/* ── pains ────────────────────────────────────────────────────────── */}
      <section className="px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mx-auto max-w-[760px] text-center">
            <Eyebrow>Sound familiar?</Eyebrow>
            <H2 className="mt-4">Your crews are ready. <Accent>Your calendar isn&apos;t.</Accent></H2>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: T.body }}>
              More leads don&apos;t fix this. A system that books the measure and chases the quote does.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PAINS.map((p, i) => (
              <Reveal key={p.title} delay={0.04 * i}>
                <div className="h-full rounded-[20px] border bg-white p-7 transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,0.3)]"
                     style={{ borderColor: T.line }}>
                  <IconTile icon={p.icon} tone="ink" />
                  <h3 className="mt-5 font-heading text-[18px] font-bold" style={{ color: T.ink }}>{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed" style={{ color: T.body }}>{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── services ─────────────────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-24 px-5 pb-24 sm:px-8 lg:pb-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mx-auto max-w-[780px] text-center">
            <Eyebrow>How it works</Eyebrow>
            <H2 className="mt-4">Everything between the ad <Accent>and the signed quote.</Accent></H2>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: T.body }}>
              One system, installed and run for you. No shared leads, no answering service, nobody on your team chasing.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={0.04 * i}>
                <div className="group relative h-full overflow-hidden rounded-[20px] border bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(249,115,22,0.45)]"
                     style={{ borderColor: T.line }}>
                  <span className="absolute right-6 top-6 font-mono text-[12px]" style={{ color: T.muted }}>0{i + 1}</span>
                  <IconTile icon={s.icon} />
                  <h3 className="mt-5 font-heading text-[18px] font-bold" style={{ color: T.ink }}>{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed" style={{ color: T.body }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── the offer, in numbers ────────────────────────────────────────── */}
      <section id="offer" className="scroll-mt-24 px-5 sm:px-8">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] px-6 py-14 sm:px-12"
             style={{ background: `linear-gradient(135deg, ${T.soft} 0%, #FFE6D3 100%)` }}>
          <Parquet opacity={0.06} />
          <div className="relative">
            <p className="text-center font-heading text-[clamp(20px,2.4vw,26px)] font-extrabold" style={{ color: T.ink, textWrap: "balance" }}>
              Guaranteed 20 in-home measures in 60 days, and every quote chased until it signs or says no.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-y-10 lg:grid-cols-4">
              {[
                { v: <CountUp to={20} />,      l: "In-home measures",   s: "with qualified homeowners" },
                { v: <CountUp to={60} />,      l: "Days",               s: "from launch" },
                { v: <><CountUp to={24} />/7</>, l: "Answered",         s: "nights and weekends too" },
                { v: <CountUp to={100} suffix="%" />, l: "Of quotes chased", s: "to a yes or a no" },
              ].map((x) => (
                <div key={x.l} className="text-center">
                  <p className="font-heading text-[clamp(40px,5vw,58px)] font-extrabold leading-none tracking-[-0.03em]" style={{ color: T.orangeD }}>{x.v}</p>
                  <p className="mt-2 font-heading text-[15px] font-bold" style={{ color: T.ink }}>{x.l}</p>
                  <p className="text-[13px]" style={{ color: T.body }}>{x.s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── pipeline feature ─────────────────────────────────────────────── */}
      <section className="px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <Eyebrow>Click to signed</Eyebrow>
            <H2 className="mt-4">Watch every homeowner <Accent>move to a yes or a no.</Accent></H2>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: T.body }}>
              Nothing sits in a &quot;let me think about it&quot; pile. Every homeowner is answered, qualified,
              booked for a measure, quoted and followed up, and you can see exactly where each one stands.
            </p>
            <div className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                [Zap, "Instant first reply"], [ShieldCheck, "Your rules, your service area"],
                [CalendarCheck, "Reminders so measures show"], [Phone, "Text, call and email follow-up"],
                [MessageSquareText, "Every message visible to you"], [X, "Stops the moment they say no"],
              ].map(([Icon, t]) => {
                const I = Icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>
                return (
                  <div key={t as string} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: T.soft }}>
                      <I className="h-4 w-4" style={{ color: T.orangeD }} />
                    </span>
                    <span className="text-[15px] font-semibold" style={{ color: T.ink }}>{t as string}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <PrimaryCta />
            </div>
          </Reveal>
          <Reveal delay={0.1}><Pipeline /></Reveal>
        </div>
      </section>

      {/* ── example conversation ─────────────────────────────────────────── */}
      <section className="border-y px-5 py-24 sm:px-8 lg:py-32" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto grid max-w-[1100px] items-center gap-16 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1"><PhoneChat /></Reveal>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow>An example conversation</Eyebrow>
            <H2 className="mt-4">8:42 PM, office closed. <Accent>Measure booked by 8:48.</Accent></H2>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: T.body }}>
              This is how a conversation runs. The homeowner is answered right away, the project and
              service area are checked, every decision maker is confirmed, and the measure lands on your calendar.
            </p>
            <ul className="mt-8 space-y-3.5">
              {[
                "Always says it's an AI assistant",
                "Never quotes your price, the quote comes from you",
                "Confirms everyone who decides will be home",
                "Sends reminders so the measure actually happens",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15.5px] font-medium" style={{ color: T.ink }}>
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: T.greenS }}>
                    <Check className="h-3 w-3" style={{ color: T.green }} aria-hidden="true" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── process ──────────────────────────────────────────────────────── */}
      <section id="process" className="scroll-mt-24 px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mx-auto max-w-[720px] text-center">
            <Eyebrow>The process</Eyebrow>
            <H2 className="mt-4">From the first call <Accent>to measures on your calendar.</Accent></H2>
          </Reveal>
          <div className="relative mt-16 grid gap-6 md:grid-cols-4">
            <div aria-hidden="true" className="absolute left-0 right-0 top-[27px] hidden h-px md:block"
                 style={{ background: `repeating-linear-gradient(90deg, ${T.line} 0 8px, transparent 8px 14px)` }} />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={0.08 * i} className="relative">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border bg-white font-mono text-[15px] font-bold"
                      style={{ borderColor: i === 3 ? T.orange : T.line, color: i === 3 ? T.orangeD : T.ink,
                               boxShadow: "0 10px 24px -16px rgba(28,25,23,0.35)" }}>
                  {s.n}
                </span>
                <h3 className="mt-6 font-heading text-[18px] font-bold" style={{ color: T.ink }}>{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: T.body }}>{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── proof (honest) ───────────────────────────────────────────────── */}
      {/* Top Air numbers: only ever labelled as a home-services account, never flooring. */}
      <section className="px-5 sm:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 rounded-[28px] border bg-white p-8 sm:p-12 lg:grid-cols-[1fr_1.2fr] lg:items-center"
             style={{ borderColor: T.line }}>
          <Reveal>
            <Eyebrow>Already running live</Eyebrow>
            <H2 className="mt-4 !text-[clamp(26px,3.2vw,38px)]">The same engine, booking appointments today.</H2>
            <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: T.body }}>
              These numbers come from a live home-services account running the same answering, booking and
              follow-up engine. Our flooring program is new, and flooring numbers go here the moment they&apos;re in.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "First 24 hours", rows: [["Leads answered", 27], ["Conversations", 14], ["Booked", 3]] },
                { label: "First 9 days",   rows: [["Leads in", 130], ["Cold leads worked", 77], ["Booked", 13]] },
              ].map((b) => (
                <div key={b.label} className="rounded-2xl p-5" style={{ background: T.cream }}>
                  <p className="font-mono text-[11.5px] uppercase tracking-[0.14em]" style={{ color: T.muted }}>{b.label}</p>
                  {b.rows.map(([k, v], i) => (
                    <div key={k as string} className="flex items-baseline justify-between border-b py-2.5 last:border-0" style={{ borderColor: T.line }}>
                      <span className="text-[14.5px]" style={{ color: i === 2 ? T.ink : T.body, fontWeight: i === 2 ? 700 : 500 }}>{k}</span>
                      <span className="font-heading font-extrabold" style={{ fontSize: i === 2 ? 26 : 18, color: i === 2 ? T.green : T.ink }}>
                        <CountUp to={v as number} />
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px]" style={{ color: T.muted }}>A live home-services account. Not a flooring company.</p>
          </Reveal>
        </div>
      </section>

      {/* ── fit ──────────────────────────────────────────────────────────── */}
      <section className="px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-[1000px]">
          <Reveal className="text-center">
            <Eyebrow>Is this for you?</Eyebrow>
            <H2 className="mt-4">Built for flooring companies <Accent>that install.</Accent></H2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-[20px] border bg-white p-8" style={{ borderColor: T.line, boxShadow: "0 18px 40px -30px rgba(22,163,74,0.5)" }}>
                <p className="font-heading text-[17px] font-bold" style={{ color: T.green }}>A great fit if</p>
                <ul className="mt-5 space-y-3.5">
                  {["You run a flooring company in the USA with your own install crews",
                    "Your crews can take on more installs than the calendar feeds them",
                    "You do in-home measures before you quote",
                    "You're tired of shared leads and quotes that go quiet"].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-[15.5px]" style={{ color: T.ink }}>
                      <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: T.green }} aria-hidden="true" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-[20px] border p-8" style={{ borderColor: T.line, background: T.sand }}>
                <p className="font-heading text-[17px] font-bold" style={{ color: T.body }}>Not a fit if</p>
                <ul className="mt-5 space-y-3.5">
                  {["You don't have an install crew yet",
                    "You only sub for stores, so the homeowner isn't your customer",
                    "You want a list of shared leads to call yourself"].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-[15.5px]" style={{ color: T.body }}>
                      <X className="mt-0.5 h-5 w-5 shrink-0" style={{ color: T.muted }} aria-hidden="true" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-24 border-t px-5 py-24 sm:px-8 lg:py-32" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto max-w-[780px]">
          <Reveal className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <H2 className="mt-4">Questions flooring owners ask.</H2>
          </Reveal>
          <div className="mt-12 space-y-3">
            {FAQ.map((f, i) => {
              const isOpen = open === i
              return (
                <div key={f.q} className="overflow-hidden rounded-2xl border transition-colors"
                     style={{ borderColor: isOpen ? "rgba(249,115,22,0.35)" : T.line, background: isOpen ? T.cream : T.white }}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                    <span className="font-heading text-[16.5px] font-bold" style={{ color: T.ink }}>{f.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                                 style={{ color: T.orangeD }} aria-hidden="true" />
                  </button>
                  <motion.div initial={false} animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                              transition={{ duration: 0.3, ease: "easeOut" }} className="overflow-hidden">
                    <p className="px-6 pb-6 text-[15.5px] leading-relaxed" style={{ color: T.body }}>{f.a}</p>
                  </motion.div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── final CTA ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 py-24 sm:px-8 lg:py-32"
               style={{ background: `linear-gradient(180deg, ${T.cream} 0%, ${T.soft} 100%)` }}>
        <Parquet opacity={0.07} className="[mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,#000_10%,transparent_75%)]" />
        <Reveal className="relative mx-auto max-w-[820px] text-center">
          <H2 className="!text-[clamp(34px,5vw,60px)]">Your crews are ready. <Accent>Let&apos;s fill the calendar.</Accent></H2>
          <p className="mx-auto mt-6 max-w-[620px] text-[18px] leading-relaxed" style={{ color: T.body }}>
            &quot;I install every system myself. On the call we&apos;ll look at your service area and I&apos;ll show you
            exactly how the 20 measures get booked.&quot;
          </p>
          <p className="mt-4 font-heading text-[15px] font-bold" style={{ color: T.ink }}>Jonathan, founder of FieldBuilt AI</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta big>Book a 20-minute walkthrough</PrimaryCta>
            <GhostCta href="#how">How it works</GhostCta>
          </div>
        </Reveal>
      </section>

      {/* ── footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t px-5 pb-10 pt-16 sm:px-8" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto grid max-w-[1200px] gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[300px] text-[14.5px] leading-relaxed" style={{ color: T.body }}>
              In-home measures and chased quotes for flooring contractors with their own install crews.
            </p>
          </div>
          {[
            { h: "How it works", l: [["Meta ads", "#how"], ["Answering and qualifying", "#how"], ["Measure booking", "#how"], ["Quote follow-up", "#how"]] },
            { h: "Company", l: [["The offer", "#offer"], ["Process", "#process"], ["FAQ", "#faq"]] },
            { h: "Get started", l: [["Book a walkthrough", "/book"], ["Log in", "/login"]] },
          ].map((c) => (
            <div key={c.h}>
              <p className="font-heading text-[15px] font-bold" style={{ color: T.ink }}>{c.h}</p>
              <ul className="mt-4 space-y-2.5">
                {c.l.map(([t, href]) => (
                  <li key={t}><a href={href} className="text-[14.5px] hover:text-[#1C1917]" style={{ color: T.body }}>{t}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-14 flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t pt-7 text-[13.5px]"
             style={{ borderColor: T.line, color: T.muted }}>
          <span>© {new Date().getFullYear()} FieldBuilt AI. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#1C1917]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#1C1917]">Terms</Link>
            <Link href="/book" className="inline-flex items-center gap-1 font-semibold" style={{ color: T.orangeD }}>
              Book a walkthrough <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
