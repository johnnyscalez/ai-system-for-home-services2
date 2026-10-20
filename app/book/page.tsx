"use client"

// ─── BOOKING PAGE — /book ────────────────────────────────────────────────────
// Paid-traffic landing page for flooring contractors. Same design system as the
// homepage (components/site/*). Positioning rules: docs/flooring-pivot.md.
//   - Headline wording on this page was set by Jonathan on 2026-10-20:
//     "Get 20+ Shown In-Home Measures in 60 Days, and Every Quote Chased
//      Until It Books. Guaranteed"
//   - Never state guarantee failure terms. Never show price.
//   - No flooring proof exists yet. Top Air numbers appear ONLY labelled as
//     "a live home-services account", never implied to be flooring.
// Page order (keep it): offer → Step 1 VSL → Step 2 calendar → what the call
// covers → proof → how it works → fit → FAQ → founder → final CTA.
// ─────────────────────────────────────────────────────────────────────────────

import { createElement, useState } from "react"
import Script from "next/script"
import { motion } from "framer-motion"
import {
  ArrowDown, CalendarCheck, Check, ChevronDown, ListChecks, MapPin, Megaphone, Repeat,
  Settings2, ShieldCheck, Star, Target, X, Zap,
} from "lucide-react"
import { GhlBookingWidget } from "@/components/landing/shared"
import { CountUp, ExampleTag, Parquet, T } from "@/components/site/live"
import { Accent, Eyebrow, H2, IcpCallout, IconTile, Logo, Reveal, type IconType } from "@/components/site/ui"

// Drop a headshot in /public/brand and set this to e.g. "/brand/jonathan.jpg".
// While empty the founder card falls back to a monogram — never a broken image.
const FOUNDER_PHOTO_URL = ""

// Wistia VSL. WISTIA_CSS is Wistia's own placeholder rule: it paints the
// poster frame (blurred) until the custom element is defined.
// TODO(flooring): this media is still the old HVAC VSL. Re-record for the
// flooring offer, then swap WISTIA_ID and the aspect below.
const WISTIA_ID = "sayad6x3vm"
const WISTIA_CSS = `wistia-player[media-id='${WISTIA_ID}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${WISTIA_ID}/swatch'); display: block; filter: blur(5px); padding-top: 64.79%; }`

// ── The one CTA, repeated — same words every time ────────────────────────────
function Cta({ note = true }: { note?: boolean }) {
  return (
    <div className="text-center">
      <a href="#book"
         className="group inline-flex max-w-[94vw] items-center justify-center gap-2.5 rounded-full px-8 py-4 text-center font-heading text-[16px] font-bold text-white transition-all hover:-translate-y-0.5"
         style={{ background: T.orange, boxShadow: "0 12px 30px -10px rgba(249,115,22,0.6)" }}>
        Book your flooring walkthrough
        <ArrowDown className="h-4 w-4 shrink-0 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
      </a>
      {note && (
        <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed" style={{ color: T.body }}>
          20 minutes, screen share with the founder. Your service area, how the measures
          get booked, and where your quotes go quiet today.
        </p>
      )}
    </div>
  )
}

function StepChip({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border bg-white py-1.5 pl-1.5 pr-4 text-[13px] font-bold"
          style={{ borderColor: T.line, color: T.ink }}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px] text-white" style={{ background: T.orange }}>{n}</span>
      {children}
    </span>
  )
}

// ── Proof — a live HOME-SERVICES account (not flooring). Every label says so.
// Screenshots in /public/proof are cropped above the jobs list (real homeowners).
const PROOFS = [
  {
    img: "/proof/proof-24h.png", h: 486,
    alt: "FieldBuilt dashboard for a live home-services account, Aug 2 to Aug 3: 27 new leads, 14 AI conversations, 3 jobs booked",
    label: "First 24 hours", stats: [["Leads", 27], ["Conversations", 14], ["Booked", 3]] as const,
    caption: "Day one live. Nobody in the office picked up a phone.",
  },
  {
    img: "/proof/proof-9days.png", h: 588,
    alt: "FieldBuilt dashboard for a live home-services account, Aug 2 to Aug 11: 130 new leads, 77 AI conversations, 13 jobs booked",
    label: "First 9 days", stats: [["Leads", 130], ["Worked", 77], ["Booked", 13]] as const,
    caption: "Same account, first 9 days. The same engine your homeowners would talk to.",
  },
]

const DISCOVER: { icon: IconType; title: string; body: string }[] = [
  { icon: MapPin, title: "Your service-area demand",
    body: "How many homeowners in your ZIPs are shopping for floors right now, and which areas are worth the ad money." },
  { icon: Settings2, title: "How your 20+ measures get booked",
    body: "The ads, the AI that answers in seconds, the qualifying, the measure on your calendar and the quote chasing after." },
  { icon: Target, title: "Where your quotes are leaking",
    body: "Leads answered too late, measures wasted on the wrong homeowner, quotes nobody followed up. We find the holes." },
]

const CORE: { icon: IconType; title: string; body: string }[] = [
  { icon: Megaphone, title: "We run the ads",
    body: "Meta ads built and run for homeowners in your service area. Your crews, your ZIPs, your kind of work." },
  { icon: Zap, title: "Answered in 2 seconds",
    body: "Every homeowner gets contacted and answered within seconds, 24/7, by text and phone. They book whoever answers first. That's you now." },
  { icon: ListChecks, title: "Qualified before your calendar",
    body: "Project type, rough size, timeline, ZIP, and every decision maker home for the measure. No wasted drives." },
  { icon: CalendarCheck, title: "Booked and shown",
    body: "Real slots on your estimator's calendar, with a confirmation, a day-before reminder and an easy reschedule so measures actually happen." },
  { icon: Repeat, title: "Every quote chased until it books",
    body: "After the measure, text, call and email follow-up. Nothing dies in the \"let me think about it\" pile." },
]

const FIT_YES = [
  "You run a flooring company with your own install crews",
  "Your crews can take on more installs than the calendar feeds them",
  "You serve homeowners in the USA",
  "You want more measures without hiring a sales team",
]
const FIT_NO = [
  "You install alone, with no crew",
  "You only sub installs for flooring stores",
  "You want cheap shared leads sold to four other companies",
]

// Never add guarantee terms or price here. See docs/flooring-pivot.md.
const FAQ = [
  { q: "Who pays for the ads?",
    a: "You do, straight to Meta, on your own card. That keeps the ad money yours and in plain view, and it's separate from what you pay us. We build and run the ads, and we walk through the budget for your area on the call." },
  { q: "Does it sound like a robot?",
    a: "See the real conversations on the call and decide for yourself. It texts like a person from your office, handles \"I'm just getting prices\" without pushing, and always tells the homeowner it's an AI. If they want a person, it hands them to you." },
  { q: "Will it quote my prices?",
    a: "Never. It books the measure. The quote comes from you, after you've seen the floor." },
  { q: "What CRM or calendar do I need?",
    a: "Whatever you run now. It books into your existing calendar and you don't migrate anything. We check what you use on the call." },
  { q: "How fast can it launch?",
    a: "I install it myself. Once you hand over access, the AI and the calendar are usually live within days, and the ads go out as soon as Meta approves them." },
]

// ── Trust badges (claim-only until a real Google rating is set) ─────────────
const GOOGLE_RATING: string | null = null
const GOOGLE_REVIEW_COUNT: number | null = null

function GoogleGMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

function MetaVerifiedMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path fill="#0866FF" d="M12.00 0.60 Q15.73 0.52 18.70 2.78 Q21.76 4.91 22.84 8.48 Q24.07 12.00 22.84 15.52 Q21.76 19.09 18.70 21.22 Q15.73 23.48 12.00 23.40 Q8.27 23.48 5.30 21.22 Q2.24 19.09 1.16 15.52 Q-0.07 12.00 1.16 8.48 Q2.24 4.91 5.30 2.78 Q8.27 0.52 12.00 0.60 Z" />
      <path d="M7.4 12.3 L10.6 15.4 L16.8 8.9" fill="none" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrustBadges() {
  const pill = "inline-flex items-center gap-2 rounded-full border bg-white py-2 pl-3 pr-4"
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
      <div className={pill} style={{ borderColor: T.line }}>
        <GoogleGMark />
        {GOOGLE_RATING ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-3.5 w-3.5" style={{ fill: "#FBBC05", color: "#FBBC05" }} />)}
            </span>
            <span className="text-[13px] font-bold" style={{ color: T.ink }}>{GOOGLE_RATING}</span>
            {GOOGLE_REVIEW_COUNT ? <span className="text-[12px]" style={{ color: T.muted }}>({GOOGLE_REVIEW_COUNT})</span> : null}
          </span>
        ) : (
          <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: T.ink }}>Google Verified Business</span>
        )}
      </div>
      <div className={pill} style={{ borderColor: T.line }}>
        <MetaVerifiedMark />
        <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: T.ink }}>Meta Verified</span>
      </div>
    </div>
  )
}

export default function BookPage() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <main className="overflow-x-clip font-sans" style={{ background: T.cream, color: T.ink }}>
      <style dangerouslySetInnerHTML={{ __html: WISTIA_CSS }} />
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script src={`https://fast.wistia.com/embed/${WISTIA_ID}.js`} type="module" strategy="afterInteractive" />

      {/* ── slim header — a permanent route to the calendar ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md" style={{ background: "rgba(255,255,255,0.86)", borderColor: T.line }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3 sm:px-8">
          <Logo />
          <a href="#book" className="rounded-full px-4 py-2.5 font-heading text-[13.5px] font-bold text-white sm:px-5" style={{ background: T.orange }}>
            Book a walkthrough
          </a>
        </div>
      </header>

      {/* ── 1. HERO — who it's for, then the offer ── */}
      <section className="relative overflow-hidden px-5 pb-8 pt-28 sm:px-8 sm:pt-36" style={{ background: `linear-gradient(180deg, ${T.white} 0%, ${T.cream} 100%)` }}>
        <Parquet opacity={0.055} className="[mask-image:radial-gradient(ellipse_70%_75%_at_50%_30%,#000_15%,transparent_75%)]" />
        <div className="relative mx-auto max-w-[980px] text-center">
          <IcpCallout align="center" />

          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.65 }}
                     className="mt-8 font-heading text-[clamp(32px,5.4vw,62px)] font-extrabold leading-[1.05] tracking-[-0.03em]"
                     style={{ color: T.ink, textWrap: "balance" }}>
            Get <span style={{ color: T.orangeD }}>20+ Shown In-Home Measures</span> in 60 Days, and Every Quote Chased Until It Books.{" "}
            <span className="relative inline-block" style={{ color: T.orangeD }}>
              Guaranteed
              <svg aria-hidden="true" viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-[0.16em] w-full">
                <motion.path d="M2 9 C 80 2, 200 2, 298 7" fill="none" stroke={T.orange} strokeWidth="4" strokeLinecap="round"
                             initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.7 }} />
              </svg>
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
                    className="mx-auto mt-7 max-w-[720px] text-[clamp(16.5px,1.7vw,19px)] leading-relaxed" style={{ color: T.body }}>
            See how you get a consistent flow of qualified flooring leads, contacted, answered and booked
            within 2 seconds, to guarantee you 20+ shown in-home measures on autopilot.
          </motion.p>

          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
                     className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2.5 text-[14.5px] font-medium" style={{ color: T.body }}>
            {["We run the Meta ads for you", "Answered within 2 seconds, 24/7", "Every quote chased until it books"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck className="h-[18px] w-[18px] shrink-0" style={{ color: T.orange }} aria-hidden="true" />{t}
              </li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* ── 2. STEP 1 — the VSL ── */}
      {/* TODO(flooring): the video is still the old HVAC VSL. Re-record for flooring. */}
      <section className="px-5 pb-16 pt-8 sm:px-8 sm:pb-20">
        <div className="mx-auto max-w-[900px]">
          <Reveal className="mb-6 text-center">
            <StepChip n={1}>Watch this first</StepChip>
            <h2 className="mt-4 font-heading text-[clamp(19px,2.6vw,26px)] font-bold leading-snug tracking-[-0.015em]" style={{ color: T.ink, textWrap: "balance" }}>
              How the ads, the 2-second answering, the measure booking and the quote chasing work together.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-[22px] border bg-white p-1.5"
                 style={{ borderColor: T.line, boxShadow: "0 30px 80px -34px rgba(28,25,23,0.35)" }}>
              <div className="overflow-hidden rounded-[17px]">
                {createElement("wistia-player", {
                  "media-id": WISTIA_ID,
                  seo: "false",
                  aspect: "1.5434083601286173",
                  style: { display: "block" },
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 3. STEP 2 — the calendar ── */}
      <section id="book" className="relative scroll-mt-20 overflow-hidden border-y px-5 py-16 sm:px-8 sm:py-20" style={{ background: T.white, borderColor: T.line }}>
        <div className="relative mx-auto max-w-[820px]">
          <Reveal className="mb-8 text-center">
            <StepChip n={2}>Pick your time</StepChip>
            <H2 className="mt-4 !text-[clamp(26px,3.6vw,40px)]">Book your <Accent>flooring walkthrough.</Accent></H2>
            <p className="mx-auto mt-3 max-w-[560px] text-[15.5px] leading-relaxed" style={{ color: T.body }}>
              20 minutes on your service area and exactly how your 20+ shown measures get booked.
            </p>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="rounded-[26px] border p-2 sm:p-3"
                 style={{ background: T.cream, borderColor: T.line, boxShadow: "0 30px 80px -40px rgba(249,115,22,0.45)" }}>
              <div className="overflow-hidden rounded-[20px] bg-white">
                <GhlBookingWidget />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-7 max-w-lg text-center font-heading text-[15.5px] font-bold leading-relaxed" style={{ color: T.ink }}>
              I install every account myself, so I only take a few a month.
              When the calendar&rsquo;s full, it&rsquo;s full.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {["No pitch deck, the real thing on screen", "Installed by the founder", "20 minutes, on your service area"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-[14px] font-medium" style={{ color: T.body }}>
                  <Check className="h-4 w-4 shrink-0" style={{ color: T.green }} aria-hidden="true" /> {t}
                </span>
              ))}
            </div>
            <TrustBadges />
          </Reveal>
        </div>
      </section>

      {/* ── 4. WHAT THE CALL COVERS ── */}
      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1100px]">
          <Reveal className="mx-auto max-w-[700px] text-center">
            <Eyebrow>On the call</Eyebrow>
            <H2 className="mt-4">What you&rsquo;ll <Accent>discover.</Accent></H2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {DISCOVER.map((d, i) => (
              <Reveal key={d.title} delay={0.05 * i}>
                <div className="h-full rounded-[20px] border bg-white p-7 transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,0.3)]" style={{ borderColor: T.line }}>
                  <IconTile icon={d.icon} />
                  <h3 className="mt-5 font-heading text-[18px] font-bold" style={{ color: T.ink }}>{d.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed" style={{ color: T.body }}>{d.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. PROOF — live home-services account, labelled as such ── */}
      <section className="border-y px-5 py-20 sm:px-8 sm:py-24" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto max-w-[1100px]">
          <Reveal className="mx-auto max-w-[760px] text-center">
            <Eyebrow>Proof from a live home-services account</Eyebrow>
            <H2 className="mt-4">The same engine, <Accent>already booking appointments.</Accent></H2>
            <p className="mt-5 text-[16.5px] leading-relaxed" style={{ color: T.body }}>
              Straight talk: the flooring program is new. These numbers come from a live home-services
              account, not a flooring company. Same engine that answers, qualifies and books.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {PROOFS.map((p, i) => (
              <Reveal key={p.img} delay={0.08 * i}>
                <div className="h-full overflow-hidden rounded-[22px] border" style={{ borderColor: T.line, background: T.cream }}>
                  <div className="flex items-center justify-between gap-3 px-6 pt-5">
                    <p className="font-mono text-[12px] uppercase tracking-[0.14em]" style={{ color: T.muted }}>{p.label}</p>
                    <ExampleTag>Home-services account</ExampleTag>
                  </div>
                  <div className="grid grid-cols-3 gap-3 px-6 pt-4">
                    {p.stats.map(([k, v], j) => (
                      <div key={k} className="rounded-2xl bg-white px-3 py-3 text-center" style={{ border: `1px solid ${T.line}` }}>
                        <p className="font-heading text-[26px] font-extrabold leading-none" style={{ color: j === 2 ? T.green : T.ink }}><CountUp to={v} /></p>
                        <p className="mt-1.5 text-[12px] font-semibold" style={{ color: T.body }}>{k}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 pb-6 pt-5">
                    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: T.line }}>
                      <img src={p.img} alt={p.alt} width={1200} height={p.h} className="block w-full" loading="lazy" />
                    </div>
                    <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: T.body }}>{p.caption}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. HOW IT WORKS — five steps, in order ── */}
      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1100px]">
          <Reveal className="mx-auto max-w-[760px] text-center">
            <Eyebrow>How it works</Eyebrow>
            <H2 className="mt-4">You have the crews. <Accent>Here&rsquo;s how we fill the measures.</Accent></H2>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CORE.map((b, i) => (
              <Reveal key={b.title} delay={0.04 * i} className={i === 4 ? "sm:col-span-2 lg:col-span-1" : ""}>
                <div className="relative h-full rounded-[20px] border bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(249,115,22,0.45)]"
                     style={{ borderColor: T.line }}>
                  <span className="absolute right-6 top-6 font-mono text-[12px]" style={{ color: T.muted }}>0{i + 1}</span>
                  <IconTile icon={b.icon} />
                  <h3 className="mt-5 font-heading text-[18px] font-bold" style={{ color: T.ink }}>{b.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed" style={{ color: T.body }}>{b.body}</p>
                </div>
              </Reveal>
            ))}
            <Reveal delay={0.2}>
              <div className="flex h-full flex-col justify-center rounded-[20px] p-7" style={{ background: `linear-gradient(135deg, ${T.soft} 0%, #FFE6D3 100%)` }}>
                <p className="font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em]" style={{ color: T.orangeD }}>20+</p>
                <p className="mt-2 font-heading text-[18px] font-bold" style={{ color: T.ink }}>Shown in-home measures in 60 days.</p>
                <p className="mt-1 text-[14.5px]" style={{ color: T.body }}>Guaranteed.</p>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.15} className="mt-14"><Cta /></Reveal>
        </div>
      </section>

      {/* ── 7. FIT CHECK ── */}
      <section className="border-t px-5 py-20 sm:px-8 sm:py-24" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto max-w-[1000px]">
          <Reveal className="text-center">
            <Eyebrow>Is this for you?</Eyebrow>
            <H2 className="mt-4">This isn&rsquo;t for every <Accent>flooring company.</Accent></H2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-[20px] border bg-white p-8" style={{ borderColor: T.line, boxShadow: "0 18px 40px -30px rgba(22,163,74,0.5)" }}>
                <p className="font-heading text-[17px] font-bold" style={{ color: T.green }}>It fits if</p>
                <ul className="mt-5 space-y-3.5">
                  {FIT_YES.map((t) => (
                    <li key={t} className="flex items-start gap-3 text-[15.5px]" style={{ color: T.ink }}>
                      <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: T.green }} aria-hidden="true" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-[20px] border p-8" style={{ borderColor: T.line, background: T.sand }}>
                <p className="font-heading text-[17px] font-bold" style={{ color: T.body }}>It doesn&rsquo;t if</p>
                <ul className="mt-5 space-y-3.5">
                  {FIT_NO.map((t) => (
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

      {/* ── 8. FAQ ── */}
      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[780px]">
          <Reveal className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <H2 className="mt-4">Before you book.</H2>
          </Reveal>
          <div className="mt-12 space-y-3">
            {FAQ.map((f, i) => {
              const isOpen = open === i
              return (
                <div key={f.q} className="overflow-hidden rounded-2xl border transition-colors"
                     style={{ borderColor: isOpen ? "rgba(249,115,22,0.35)" : T.line, background: T.white }}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                    <span className="font-heading text-[16.5px] font-bold" style={{ color: T.ink }}>{f.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} style={{ color: T.orangeD }} aria-hidden="true" />
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

      {/* ── 9. FOUNDER ── */}
      <section className="px-5 pb-20 sm:px-8 sm:pb-24">
        <Reveal className="mx-auto max-w-[780px]">
          <div className="flex flex-col items-center gap-6 rounded-[22px] border bg-white p-7 text-center sm:flex-row sm:items-start sm:p-9 sm:text-left"
               style={{ borderColor: T.line, boxShadow: "0 24px 60px -40px rgba(28,25,23,0.4)" }}>
            {FOUNDER_PHOTO_URL ? (
              <img src={FOUNDER_PHOTO_URL} alt="Jonathan, founder of FieldBuilt AI" width={96} height={96}
                   className="h-24 w-24 shrink-0 rounded-2xl object-cover" style={{ border: `2px solid ${T.line}` }} />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl" style={{ background: T.soft }}>
                <span className="font-heading text-4xl font-extrabold" style={{ color: T.orangeD }}>J</span>
              </div>
            )}
            <div>
              <p className="font-heading text-[18px] font-bold" style={{ color: T.ink }}>Jonathan · founder, FieldBuilt AI</p>
              <p className="mt-2 text-[15.5px] leading-relaxed" style={{ color: T.body }}>
                You&rsquo;re not meeting a sales rep. I set up the ads, the AI and the quote chasing for
                every flooring company myself, which is why I only take a few a month. Bring your hardest
                questions: your slow months, your pickiest homeowners, the &ldquo;my area is different.&rdquo;
                That&rsquo;s the part of the call I&rsquo;m best at.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── 10. FINAL CTA ── */}
      <section className="relative overflow-hidden px-5 py-24 sm:px-8 sm:py-28" style={{ background: `linear-gradient(180deg, ${T.cream} 0%, ${T.soft} 100%)` }}>
        <Parquet opacity={0.07} className="[mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,#000_10%,transparent_75%)]" />
        <Reveal className="relative mx-auto max-w-[820px] text-center">
          <H2 className="!text-[clamp(32px,4.8vw,56px)]">Your crews are ready. <Accent>Let&rsquo;s fill the measures.</Accent></H2>
          <div className="mt-10"><Cta /></div>
        </Reveal>
      </section>

      {/* ── footer ── */}
      <footer className="border-t px-5 py-8 sm:px-8" style={{ background: T.white, borderColor: T.line }}>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 text-[13.5px]" style={{ color: T.muted }}>
          <Logo size="sm" />
          <span>© {new Date().getFullYear()} FieldBuilt AI</span>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-[#1C1917]">Privacy</a>
            <a href="/terms" className="hover:text-[#1C1917]">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
