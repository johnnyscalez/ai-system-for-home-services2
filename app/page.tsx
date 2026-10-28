"use client"

// ─────────────────────────────────────────────────────────────────────────────
// FIELDBUILT — homepage for flooring contractors with install crews.
// Positioning rules: docs/flooring-pivot.md (exact offer wording, no price,
// no guarantee failure terms, no invented flooring results, examples labelled).
// Positioning since 2026-10-28 (Jonathan): FieldBuilt sells client acquisition
// INFRASTRUCTURE, not an agency or a lead vendor. Two parts: a back office that
// runs every lead, connected to a demand pipe of exclusive homeowners.
// Light, warm, white-card design. Signature: a faint parquet texture behind the
// hero and the closing section. Live panels live in components/site/live.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BellRing, CalendarCheck, CalendarX, Car, Check, ChevronDown,
  Clock, HelpCircle, MessageSquareText, Repeat, Snowflake, Users, X, Zap,
  ListChecks, LineChart, EyeOff,
} from "lucide-react"
import { CountUp, HeroBoard, Marquee, Parquet, PhoneChat, SystemMap, T } from "@/components/site/live"
import { Accent, Eyebrow, GhostCta, H2, IcpHeadline, IconTile, Logo, PrimaryCta, Reveal, VslPlayer } from "@/components/site/ui"

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
  { icon: EyeOff,    title: "No numbers",              body: "Where did that lead go? How many quotes are open? Nobody knows, because nothing is tracked." },
]

const BACK_OFFICE = [
  { icon: Zap,               title: "Answers in 1 second",     body: "Text or phone, the moment a homeowner reaches out. Nights, weekends, holidays." },
  { icon: ListChecks,        title: "Qualifies the project",   body: "Project type, size, timeline, ZIP code, and every decision maker home. Tire kickers never reach your calendar." },
  { icon: MessageSquareText, title: "Works every lead",        body: "Homeowners who go quiet get followed up by text, call and email until they book or say no." },
  { icon: CalendarCheck,     title: "Books the measure",       body: "Real openings on your real calendar, with a confirmation the moment it's booked." },
  { icon: BellRing,          title: "Reminds and reschedules", body: "A reminder the day before. If plans change, the measure gets moved, not lost." },
  { icon: Repeat,            title: "Chases every quote",      body: "After the measure it follows up until the homeowner signs or says no. Nothing dies in a maybe pile." },
  { icon: LineChart,         title: "Tracks every number",     body: "Leads, conversations, measures, quotes out, quotes signed. You always know what's working." },
  { icon: HelpCircle,        title: "Handles the questions",   body: "Service area, timing, what happens at the measure. Anything unusual goes straight to you." },
]

const STEPS = [
  { n: "01", title: "Walkthrough call",       body: "20 minutes. We look at your service area, your crews and how your quotes get followed up today." },
  { n: "02", title: "We build your back office", body: "Your service area, your qualification rules, your calendar and your follow-up, built and tested inside your business." },
  { n: "03", title: "We connect the demand pipe", body: "Ads go live in your ZIP codes. Every homeowner flows straight into your back office." },
  { n: "04", title: "Measures on your calendar", body: "Your estimator runs the measures. The system chases every quote until you get a yes or a no." },
]

const FAQ = [
  { q: "Is this a marketing agency or a lead service?",
    a: "Neither. An agency sells you its time. A lead vendor sells you the same homeowner it sells to four other companies. We build client acquisition infrastructure inside your business: a back office that runs every lead, connected to a demand pipe that brings in homeowners only you get. It's installed in your business and it's yours." },
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
          <span className="rounded-full px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-white" style={{ background: T.orange }}>Flooring</span>
          Client acquisition infrastructure, installed. See if your area is a fit
          <ArrowRight className="h-3.5 w-3.5" style={{ color: T.orangeD }} aria-hidden="true" />
        </Link>
      </div>

      {/* ── nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ background: "rgba(255,255,255,0.86)", borderColor: T.line }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/"><Logo /></Link>
          <nav className="hidden items-center gap-8 text-[14.5px] font-medium md:flex" style={{ color: T.body }}>
            <a href="#system" className="hover:text-[#1C1917]">What we install</a>
            <a href="#how" className="hover:text-[#1C1917]">The back office</a>
            <a href="#watch" className="hover:text-[#1C1917]">Watch</a>
            <a href="#offer" className="hover:text-[#1C1917]">The offer</a>
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
                       className="mt-6 font-heading text-[clamp(34px,5.2vw,62px)] font-extrabold leading-[1.04] tracking-[-0.035em]"
                       style={{ color: T.ink, textWrap: "balance" }}>
              We install a <span className="relative" style={{ color: T.orangeD }}>
                client acquisition system
                <svg aria-hidden="true" viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute -bottom-1 left-0 hidden h-[0.16em] w-full sm:block">
                  <motion.path d="M2 9 C 80 2, 200 2, 298 7" fill="none" stroke={T.orange} strokeWidth="4" strokeLinecap="round"
                               initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.6 }} />
                </svg>
              </span> in your flooring business.
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                      className="mt-6 font-heading text-[clamp(19px,2vw,23px)] font-bold leading-snug" style={{ color: T.ink }}>
              A back office that runs every lead, connected to a pipe of exclusive homeowners.
              Guaranteed 20 in-home measures in 60 days.
            </motion.p>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.28 }}
                      className="mt-4 max-w-[560px] text-[17px] leading-relaxed" style={{ color: T.body }}>
              Not an agency. Not a lead vendor. Infrastructure we build into your business: it brings in homeowners
              in your service area, answers them in 1 second, qualifies them, books the measure, handles reschedules,
              chases every quote and tracks every number. And it&apos;s yours.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.36 }}
                        className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryCta big>Book a 20-minute walkthrough</PrimaryCta>
              <GhostCta href="#system">See what we install</GhostCta>
            </motion.div>

            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
                       className="mt-9 grid gap-x-6 gap-y-2.5 text-[14.5px] font-medium sm:grid-cols-2" style={{ color: T.body }}>
              {["A demand pipe in your service area", "A back office that runs every lead, 24/7", "Exclusive homeowners, never shared", "Built and installed in your business"].map((t) => (
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

      {/* ── the video: what we sell and who it's for, in 74 seconds ───────── */}
      <section id="watch" className="scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-28">
        <div className="mx-auto max-w-[1040px]">
          <Reveal className="mx-auto max-w-[720px] text-center">
            <Eyebrow>Watch · 74 seconds</Eyebrow>
            <H2 className="mt-4">What we install, <Accent>and who it&apos;s for.</Accent></H2>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: T.body }}>
              The back office, the demand pipe, and how they put measures on your calendar.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="mt-10"><VslPlayer /></Reveal>
        </div>
      </section>

      {/* ── pains ────────────────────────────────────────────────────────── */}
      <section className="px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mx-auto max-w-[760px] text-center">
            <Eyebrow>Sound familiar?</Eyebrow>
            <H2 className="mt-4">You don&apos;t have a lead problem. <Accent>You have no system.</Accent></H2>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: T.body }}>
              Most flooring companies run on referrals, bought leads and whoever&apos;s free to call back.
              No steady demand, no back office. So the calendar swings from packed to dead, and more leads only make the leak bigger.
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

      {/* ── what we install: the system map ────────────────────────────── */}
      <section id="system" className="scroll-mt-24 px-5 pb-24 sm:px-8 lg:pb-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mx-auto max-w-[820px] text-center">
            <Eyebrow>What we install</Eyebrow>
            <H2 className="mt-4">Two parts. <Accent>One system you own.</Accent></H2>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: T.body }}>
              We build a back office that runs every lead, then connect it to a demand pipe that keeps
              exclusive homeowners coming in. Demand goes in one end. Measures land on your calendar at the other.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="mt-12"><SystemMap /></Reveal>
          <Reveal delay={0.12}>
            <div className="mx-auto mt-8 flex max-w-[900px] flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {["Not a marketing agency", "Not a lead vendor", "Not a CRM", "Not an answering service"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold" style={{ color: T.body }}>
                  <X className="h-4 w-4 shrink-0" style={{ color: T.muted }} aria-hidden="true" />{t}
                </span>
              ))}
            </div>
            <p className="mt-4 text-center font-heading text-[16px] font-bold" style={{ color: T.ink }}>
              Infrastructure, built and installed in your business.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── the back office ──────────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-24 px-5 pb-24 sm:px-8 lg:pb-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="mx-auto max-w-[800px] text-center">
            <Eyebrow>Part one · The back office</Eyebrow>
            <H2 className="mt-4">Every job your office should do, <Accent>done for every lead.</Accent></H2>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: T.body }}>
              This is the part most flooring companies never build. It runs 24/7, so nobody on your team
              answers, chases or keeps score by hand.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BACK_OFFICE.map((s, i) => (
              <Reveal key={s.title} delay={0.04 * i}>
                <div className="group relative h-full overflow-hidden rounded-[20px] border bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(249,115,22,0.45)]"
                     style={{ borderColor: T.line }}>
                  <span className="absolute right-5 top-5 font-mono text-[12px]" style={{ color: T.muted }}>0{i + 1}</span>
                  <IconTile icon={s.icon} />
                  <h3 className="mt-5 font-heading text-[17px] font-bold" style={{ color: T.ink }}>{s.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: T.body }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── the demand pipe ──────────────────────────────────────────────── */}
      <section className="px-5 pb-24 sm:px-8 lg:pb-32">
        <div className="mx-auto grid max-w-[1200px] gap-10 rounded-[28px] border bg-white p-8 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:items-center"
             style={{ borderColor: T.line }}>
          <Reveal>
            <Eyebrow>Part two · The demand pipe</Eyebrow>
            <H2 className="mt-4 !text-[clamp(28px,3.4vw,42px)]">Then we connect a pipe <Accent>that never runs dry.</Accent></H2>
            <p className="mt-4 text-[16.5px] leading-relaxed" style={{ color: T.body }}>
              A back office is only as busy as what flows into it. So we build and run Meta ads for homeowners
              ready for new floors, aimed only at the ZIP codes your crews cover, and pipe every one of them
              straight into your back office.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <ul className="space-y-4">
              {[
                ["Exclusive to you", "Every homeowner came from your ads. Nobody else gets the same lead."],
                ["Steady, not seasonal luck", "Demand you can turn up before the winter dip instead of waiting on referrals."],
                ["Your ad account, your data", "You pay the ad spend straight to Meta. You see every dollar and every result."],
              ].map(([t, b]) => (
                <li key={t} className="flex items-start gap-3.5 rounded-2xl p-4" style={{ background: T.cream }}>
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: T.soft }}>
                    <Check className="h-3.5 w-3.5" style={{ color: T.orangeD }} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-heading text-[16px] font-bold" style={{ color: T.ink }}>{t}</span>
                    <span className="mt-0.5 block text-[14.5px] leading-relaxed" style={{ color: T.body }}>{b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
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
                { v: <><CountUp to={1} />s</>, l: "First reply",       s: "24/7, nights and weekends" },
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

      {/* ── example conversation ─────────────────────────────────────────── */}
      <section className="border-y px-5 py-24 sm:px-8 lg:py-32" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto grid max-w-[1100px] items-center gap-16 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1"><PhoneChat /></Reveal>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow>Inside the back office · an example</Eyebrow>
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
            <H2 className="mt-4">From the first call <Accent>to a system running in your business.</Accent></H2>
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
            <Eyebrow>The back office at work</Eyebrow>
            <H2 className="mt-4 !text-[clamp(26px,3.2vw,38px)]">What happens when every lead gets worked.</H2>
            <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: T.body }}>
              These numbers come from a home services company running the same back office: answering,
              qualifying, booking and follow-up, on every lead, from the first day.
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
            <p className="mt-3 text-[12.5px]" style={{ color: T.muted }}>A home services account.</p>
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
                    "You want a system you own, not another list of shared leads"].map((t) => (
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
          <H2 className="!text-[clamp(34px,5vw,60px)]">Stop renting leads. <Accent>Own the system.</Accent></H2>
          <p className="mx-auto mt-6 max-w-[620px] text-[18px] leading-relaxed" style={{ color: T.body }}>
            &quot;I install every system myself. On the call we&apos;ll look at your service area and I&apos;ll show you
            exactly how the 20 measures get booked.&quot;
          </p>
          <p className="mt-4 font-heading text-[15px] font-bold" style={{ color: T.ink }}>Jonathan, founder of FieldBuilt AI</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta big>Book a 20-minute walkthrough</PrimaryCta>
            <GhostCta href="#system">What we install</GhostCta>
          </div>
        </Reveal>
      </section>

      {/* ── footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t px-5 pb-10 pt-16 sm:px-8" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto grid max-w-[1200px] gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[300px] text-[14.5px] leading-relaxed" style={{ color: T.body }}>
              Client acquisition infrastructure for flooring contractors with their own install crews.
            </p>
          </div>
          {[
            { h: "What we install", l: [["The system", "#system"], ["The back office", "#how"], ["The demand pipe", "#system"], ["Quote follow-up", "#how"]] },
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
