"use client"

// ─── BOOKING PAGE — /book ────────────────────────────────────────────────────
// Paid-traffic landing page for flooring contractors. Positioning source of
// truth: docs/flooring-pivot.md. Rules that bind this page:
//   - Offer wording is exact: "Guaranteed 20 in-home measures in 60 days, and
//     every quote chased until it signs or says no."
//   - Never state guarantee failure terms. Never show price.
//   - No flooring proof exists yet. Top Air numbers appear ONLY labelled as
//     "a live home-services account", never implied to be flooring.
//   - Light mode throughout. No dark hero, proof band or footer.
// Page order: offer → VSL → calendar → what the call covers → proof →
// mechanism → fit → FAQ → founder → final CTA.
// We sell an installed system, never software/platform/SaaS/tool/app.
// ─────────────────────────────────────────────────────────────────────────────

import { createElement, useRef } from "react"
import Script from "next/script"
import { motion, useInView } from "framer-motion"
import {
  Megaphone, Zap, ListChecks, CalendarCheck, Repeat, Check, X, Star, ChevronDown,
  ArrowDown, MapPin, Settings2, Target,
} from "lucide-react"
import { C, FieldFMark, GhlBookingWidget, MinimalFooter } from "@/components/landing/shared"

// Drop a headshot in /public/brand and set this to e.g. "/brand/jonathan.jpg".
// While empty the founder card falls back to a monogram — never a broken image.
const FOUNDER_PHOTO_URL = ""

// Wistia VSL. WISTIA_CSS is Wistia's own placeholder rule: it paints the
// poster frame (blurred) until the custom element is defined, so the slot
// never flashes empty while the player script loads.
// TODO(flooring): this media is still the old HVAC VSL. It needs re-recording
// for the flooring offer; swap WISTIA_ID (and the aspect below) once it exists.
const WISTIA_ID = "sayad6x3vm"
const WISTIA_CSS = `wistia-player[media-id='${WISTIA_ID}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${WISTIA_ID}/swatch'); display: block; filter: blur(5px); padding-top: 64.79%; }`

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

// ── The one CTA, repeated ─────────────────────────────────────────────────────
// Same words every time so the offer never drifts.
function Cta({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center">
      <a href="#book"
         className="inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition-transform hover:scale-[1.03]"
         style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.32)",
                  padding: compact ? "15px 26px" : "17px 30px",
                  fontSize: "clamp(0.95rem, 2.6vw, 1.05rem)", lineHeight: 1.25, maxWidth: "94vw" }}>
        Book your flooring walkthrough &mdash; 20 minutes
        <ArrowDown className="w-4 h-4 shrink-0 hidden sm:block" aria-hidden="true" />
      </a>
      <p className="text-sm leading-relaxed max-w-md mx-auto mt-4" style={{ color: C.muted }}>
        Screen share with the founder. We look at your service area, how the measures
        get booked, and where your quotes go quiet today.
      </p>
    </div>
  )
}

// ── PROOF ────────────────────────────────────────────────────────────────────
// Marker red — deliberately NOT the brand orange. This is the "circled it by
// hand" colour: it reads as evidence marked up, not as designed marketing.
const PROOF_RED = "#DC2626"

// Screenshots live in /public/proof and are cropped above the jobs list, which
// contains real homeowners' names, addresses and phone numbers.
// These are a live HOME-SERVICES account (not flooring). Every headline and
// caption must say so. See docs/flooring-pivot.md "Proof rules".
const PROOFS = [
  {
    img: "/proof/proof-24h.png",
    h: 486,
    alt: "FieldBuilt dashboard for a live home-services account, Aug 2 to Aug 3: 27 new leads, 14 AI conversations, 3 jobs booked",
    headline: "27 leads → 14 conversations → 3 booked. Under 24 hours.",
    caption: "A live home-services account, day one. Nobody in the office picked up a phone.",
  },
  {
    img: "/proof/proof-9days.png",
    h: 588,
    alt: "FieldBuilt dashboard for a live home-services account, Aug 2 to Aug 11: 130 new leads, 77 AI conversations, 13 jobs booked",
    headline: "130 leads → 77 worked → 13 booked. 9 days.",
    caption: "Same live home-services account, first 9 days. Same engine your homeowners would talk to.",
  },
]

// ── What the walkthrough covers ──────────────────────────────────────────────
const DISCOVER = [
  { icon: MapPin, title: "Your service-area demand",
    body: "How many homeowners in your ZIPs are shopping for floors right now, and which areas are worth the ad money." },
  { icon: Settings2, title: "How the measures get booked",
    body: "The ads, the AI that answers and qualifies, the measure on your calendar, and the quote chasing after. Start to finish." },
  { icon: Target, title: "Where your quotes are leaking",
    body: "Leads answered too late, measures wasted on the wrong homeowner, quotes nobody followed up. We find the holes." },
]

// ── The mechanism, in order (docs/flooring-pivot.md "How it works") ──────────
const CORE = [
  { icon: Megaphone, label: "1. We run the ads",
    body: "Meta ads built and run for homeowners in your service area. Your crews, your ZIPs, your kind of work." },
  { icon: Zap, label: "2. Answered in seconds",
    body: "Every homeowner gets a text back in seconds, 24/7, by text and phone. They book whoever answers first. That's you now." },
  { icon: ListChecks, label: "3. Qualified before your calendar",
    body: "Project type, rough size, timeline, ZIP, and whether every decision maker will be home for the measure. No wasted drives." },
  { icon: CalendarCheck, label: "4. Booked as a measure",
    body: "Real slots on your estimator's calendar, with a confirmation, a day-before reminder and an easy reschedule so measures don't no-show." },
  { icon: Repeat, label: "5. Every quote chased",
    body: "After the measure, text, call and email until the homeowner signs or says no. Nothing dies in the “let me think about it” pile." },
]

const FIT_YES = [
  "You have your own install crews",
  "Your crews can take on more installs than the calendar feeds them",
  "You serve homeowners in the USA",
  "You want more measures without hiring a sales team",
]
const FIT_NO = [
  "You install alone, with no crew",
  "You only sub installs for flooring stores",
  "You want cheap shared leads sold to four other companies",
]

const FAQ = [
  {
    q: "Who pays for the ads?",
    a: "You do, straight to Meta, on your own card. That keeps the ad money yours and in plain view. It is separate from what you pay us. We build and run the ads; we walk through the budget for your area on the call.",
  },
  {
    q: "Does it sound like a robot?",
    a: "Read the real conversations on the call and decide for yourself. It texts like a person from your office, handles “I’m just getting prices” without pushing, and always tells the homeowner it’s an AI. If they want a person, it hands them to you.",
  },
  {
    q: "Will it quote my prices?",
    a: "Never. It books the measure. The quote comes from you, after you’ve seen the floor. All it does on price is tell the homeowner the quote comes after the measure.",
  },
  {
    q: "What CRM or calendar do I need?",
    a: "Whatever you run now. It books into your existing calendar, and you don’t migrate anything. If you don’t have one, we set you up with ours. We check what you use on the call.",
  },
  {
    q: "How fast can it launch?",
    a: "I install it myself. Once you hand over access, the AI and the calendar are usually live within days, and the ads go out as soon as Meta approves them.",
  },
]

// ── TRUST BADGES ─────────────────────────────────────────────────────────────
// Inline SVG, not pasted images: the marks stay sharp, carry no white box, and
// cost no network request. Claim-only by default — set GOOGLE_RATING to a REAL
// Business Profile rating and the badge switches to stars on its own.
const GOOGLE_RATING: string | null = null
const GOOGLE_REVIEW_COUNT: number | null = null

function GoogleGMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

function MetaVerifiedMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path fill="#0866FF" d="M12.00 0.60 Q15.73 0.52 18.70 2.78 Q21.76 4.91 22.84 8.48 Q24.07 12.00 22.84 15.52 Q21.76 19.09 18.70 21.22 Q15.73 23.48 12.00 23.40 Q8.27 23.48 5.30 21.22 Q2.24 19.09 1.16 15.52 Q-0.07 12.00 1.16 8.48 Q2.24 4.91 5.30 2.78 Q8.27 0.52 12.00 0.60 Z" />
      <path d="M7.4 12.3 L10.6 15.4 L16.8 8.9" fill="none" stroke="#FFFFFF" strokeWidth="2.3"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrustBadges() {
  const pill = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    boxShadow: "0 2px 10px rgba(28,25,23,0.05)",
  } as const
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
      <div className="inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2" style={pill}>
        <GoogleGMark />
        {GOOGLE_RATING ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-3.5 h-3.5" style={{ fill: "#FBBC05", color: "#FBBC05" }} />
              ))}
            </span>
            <span className="text-[13px] font-bold" style={{ color: C.text }}>{GOOGLE_RATING}</span>
            {GOOGLE_REVIEW_COUNT ? (
              <span className="text-[12px]" style={{ color: C.muted }}>({GOOGLE_REVIEW_COUNT})</span>
            ) : null}
          </span>
        ) : (
          <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: C.text }}>
            Google Verified Business
          </span>
        )}
      </div>
      <div className="inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2" style={pill}>
        <MetaVerifiedMark />
        <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: C.text }}>Meta Verified</span>
      </div>
    </div>
  )
}

// Subtle orange grid texture for light sections. Low opacity so it reads as
// paper, not decoration; masked so it fades out before the edges.
const GRID_TEXTURE = {
  backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
  backgroundSize: "44px 44px", opacity: 0.05,
  WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 35%, #000 20%, transparent 80%)",
  maskImage: "radial-gradient(ellipse 90% 80% at 50% 35%, #000 20%, transparent 80%)",
} as const

export default function BookPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      <style dangerouslySetInnerHTML={{ __html: WISTIA_CSS }} />
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script src={`https://fast.wistia.com/embed/${WISTIA_ID}.js`} type="module" strategy="afterInteractive" />
      {/* ── Slim header — carries a permanent route to the calendar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 sm:px-6 py-3.5"
              style={{ background: "rgba(250,250,248,0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                       borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2.5">
          {/* The Field F mark is drawn white + orange, so it keeps its dark tile. */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
            <FieldFMark size={18} />
          </div>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            FIELDBUILT
            <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
                  style={{ fontSize: "0.42em", background: C.orange, padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}>
              AI
            </span>
          </span>
        </div>
        <a href="#book"
           className="inline-flex items-center gap-1.5 rounded-lg text-[13px] sm:text-sm font-bold text-white transition-transform hover:scale-[1.04] px-3.5 sm:px-4 py-2 whitespace-nowrap"
           style={{ background: C.orange, boxShadow: "0 4px 14px rgba(249,115,22,0.28)" }}>
          Book a walkthrough
        </a>
      </header>

      {/* ── 1. HERO — the offer, word for word ── */}
      <section className="relative flex flex-col justify-center pt-28 sm:pt-32 pb-4 px-6 overflow-hidden"
               style={{ background: C.bg }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={GRID_TEXTURE} />

        <div className="relative max-w-4xl mx-auto w-full text-center">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full mb-7 text-[10.5px] sm:text-[13px] font-bold uppercase tracking-widest"
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.orangeDk,
                     boxShadow: "0 2px 10px rgba(28,25,23,0.05)", fontFamily: "var(--font-jetbrains)" }}>
            For flooring contractors with their own install crews
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7 }}
            className="font-extrabold tracking-tight mb-6"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                     fontSize: "clamp(1.7rem, 5.6vw, 3.3rem)", lineHeight: 1.08, textWrap: "balance" }}>
            Guaranteed 20 in-home measures in 60 days
            <br /><span style={{ color: C.orangeDk }}>
              and every quote chased until it signs or says no.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.6 }}
            className="text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: C.muted }}>
            We run the Meta ads in your area. Our AI answers every homeowner in seconds,
            qualifies them, and books the measure on your calendar. Then it chases every
            quote. You have the crews. We fill the measures.
          </motion.p>
        </div>
      </section>

      {/* ── 2. STEP 1 — the VSL (Wistia) ── */}
      {/* TODO(flooring): the video is still the old HVAC VSL. Re-record for flooring. */}
      <section className="relative pt-8 sm:pt-9 pb-14 sm:pb-16 px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-5">
            <div className="text-xs font-bold uppercase tracking-widest mb-2"
                 style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>Step 1</div>
            <h2 className="font-bold tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.015em",
                         fontSize: "clamp(1.05rem, 2.9vw, 1.45rem)", lineHeight: 1.3, textWrap: "balance" }}>
              Watch how the ads, the AI, the measure booking and the quote chasing
              work together.
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-2xl overflow-hidden"
                 style={{ background: C.surface, border: `1px solid ${C.border}`,
                          boxShadow: "0 24px 60px rgba(28,25,23,0.10), 0 4px 16px rgba(28,25,23,0.05)" }}>
              {/* Wistia web component. Rendered via createElement so the custom
                  tag needs no JSX intrinsic-element declaration. */}
              {createElement("wistia-player", {
                "media-id": WISTIA_ID,
                seo: "false",
                aspect: "1.5434083601286173",
                style: { display: "block" },
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 3. STEP 2 — the calendar ── */}
      <section id="book" className="relative px-6 overflow-hidden scroll-mt-20" style={{ background: C.subtle }}>
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.14) 1px, transparent 1px)", backgroundSize: "28px 28px",
                      WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 80%)",
                      maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 80%)" }} />

        <div className="relative max-w-3xl mx-auto pt-16 pb-16">
          <Reveal className="text-center mb-8">
            <div className="text-xs font-bold uppercase tracking-widest mb-2"
                 style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>Step 2</div>
            <h2 className="font-extrabold tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.5rem, 4.8vw, 2.1rem)", lineHeight: 1.18, textWrap: "balance" }}>
              Choose a time for your flooring walkthrough.
            </h2>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="rounded-3xl p-2 sm:p-3"
                 style={{ background: C.surface, border: `1px solid ${C.border}`,
                          boxShadow: "0 24px 60px rgba(249,115,22,0.08), 0 4px 20px rgba(0,0,0,0.05)" }}>
              <GhlBookingWidget />
            </div>
          </Reveal>

          {/* founder-voice scarcity, directly under the widget where it counts */}
          <Reveal delay={0.1}>
            <p className="text-center text-sm sm:text-base font-semibold leading-relaxed mt-6 max-w-lg mx-auto"
               style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              I install every account myself, so I only take a few a month.
              When the calendar&rsquo;s full, it&rsquo;s full.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6">
              {["No pitch deck, just the real thing on screen", "Installed by the founder", "20 minutes, on your service area"].map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: C.muted }}>
                  <Check className="w-4 h-4 shrink-0" style={{ color: C.success }} aria-hidden="true" /> {t}
                </span>
              ))}
            </div>
            <TrustBadges />
          </Reveal>
        </div>
      </section>

      {/* ── 4. WHAT THE CALL COVERS — sets expectations right after booking ── */}
      <section className="relative py-14 sm:py-16 px-6" style={{ background: C.bg }}>
        <div className="relative max-w-3xl mx-auto">
          <Reveal className="text-center mb-8">
            <h2 className="font-extrabold tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.5rem, 4.8vw, 2.1rem)", lineHeight: 1.15, textWrap: "balance" }}>
              What you&rsquo;ll discover on the call
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-4">
            {DISCOVER.map((d, i) => (
              <Reveal key={d.title} delay={0.05 + i * 0.07}>
                <div className="h-full rounded-2xl p-5 sm:p-6"
                     style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(28,25,23,0.04)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                       style={{ background: "rgba(249,115,22,0.10)" }}>
                    <d.icon className="w-4.5 h-4.5" style={{ color: C.orangeDk }} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-[15px] mb-1.5 leading-snug"
                      style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>{d.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{d.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. PROOF — live home-services account, labelled as such ── */}
      <section className="relative py-16 sm:py-20 px-6 overflow-hidden" style={{ background: C.subtle }}>
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="w-8 h-px" style={{ background: PROOF_RED }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: PROOF_RED, fontFamily: "var(--font-jetbrains)" }}>
                Proof from a live home-services account
              </span>
              <span className="w-8 h-px" style={{ background: PROOF_RED }} />
            </div>
            <h2 className="font-extrabold tracking-tight mb-4"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                         fontSize: "clamp(1.9rem, 6.4vw, 3rem)", lineHeight: 1.06, textWrap: "balance" }}>
              The same AI, already booking{" "}
              <span style={{ color: C.orangeDk }}>for a live account.</span>
            </h2>
            <p className="text-base leading-relaxed max-w-xl mx-auto" style={{ color: C.muted }}>
              Straight talk: the flooring program is new. These numbers come from a live
              home-services account, not a flooring company. Same engine that answers,
              qualifies and books.
            </p>
          </Reveal>

          {PROOFS.map((p, i) => (
            <Reveal key={p.img} delay={0.05 + i * 0.08} className="mb-10 last:mb-0">
              <div className="flex justify-center mb-4">
                <div className="rounded-2xl px-5 sm:px-6 py-3 text-center"
                     style={{ background: PROOF_RED, border: "3px solid #FFFFFF",
                              boxShadow: "0 10px 30px rgba(220,38,38,0.25)" }}>
                  <span className="block font-extrabold text-white leading-tight"
                        style={{ fontFamily: "var(--font-jakarta)", fontSize: "clamp(1.02rem, 3.4vw, 1.5rem)",
                                 letterSpacing: "-0.01em", textWrap: "balance" }}>
                    {p.headline}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden"
                   style={{ border: `3px solid ${PROOF_RED}`, boxShadow: "0 24px 60px rgba(28,25,23,0.12)" }}>
                <img src={p.img} alt={p.alt} width={1200} height={p.h} className="w-full block" loading="lazy" />
              </div>
              <p className="text-center text-sm leading-relaxed mt-4" style={{ color: C.muted }}>
                {p.caption}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 6. THE MECHANISM — five steps, in order ── */}
      <section className="relative py-16 sm:py-20 px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-10">
            <h2 className="font-extrabold tracking-tight mb-3"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
              You have the crews.
              <br /><span style={{ color: C.orangeDk }}>Here&rsquo;s how we fill the measures.</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4">
            {CORE.map((b, i) => (
              <Reveal key={b.label} delay={0.05 + (i % 2) * 0.07}
                      className={i === CORE.length - 1 ? "sm:col-span-2" : ""}>
                <div className="h-full rounded-2xl p-6 flex items-start gap-4"
                     style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(28,25,23,0.04)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                       style={{ background: "rgba(249,115,22,0.10)" }}>
                    <b.icon className="w-5 h-5" style={{ color: C.orangeDk }} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1.5"
                        style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.01em" }}>
                      {b.label}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{b.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15} className="mt-12">
            <Cta compact />
          </Reveal>
        </div>
      </section>

      {/* ── 7. FIT CHECK — selectivity that also pre-qualifies the booking ── */}
      <section className="relative py-16 sm:py-20 px-6" style={{ background: C.subtle }}>
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-10">
            <h2 className="font-extrabold tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
              This isn&rsquo;t for every flooring company.
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4">
            <Reveal delay={0.05}>
              <div className="h-full rounded-2xl p-6 sm:p-7"
                   style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(22,163,74,0.08)" }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4"
                     style={{ color: C.success, fontFamily: "var(--font-jetbrains)" }}>It fits if</div>
                <ul className="space-y-3">
                  {FIT_YES.map(t => (
                    <li key={t} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: C.text }}>
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.success }} aria-hidden="true" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="h-full rounded-2xl p-6 sm:p-7"
                   style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4"
                     style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>It doesn&rsquo;t if</div>
                <ul className="space-y-3">
                  {FIT_NO.map(t => (
                    <li key={t} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: C.muted }}>
                      <X className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#A8A29E" }} aria-hidden="true" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 8. FAQ — the objections that actually stop the booking ── */}
      {/* Never add guarantee terms or price here. See docs/flooring-pivot.md. */}
      <section className="relative py-16 sm:py-20 px-6" style={{ background: C.bg }}>
        <div className="relative max-w-2xl mx-auto">
          <Reveal className="text-center mb-9">
            <h2 className="font-extrabold tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
              Before you book.
            </h2>
          </Reveal>

          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={0.04 * i}>
                <details className="group rounded-2xl overflow-hidden"
                         style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 sm:px-6 py-4">
                    <span className="font-bold text-[15px] sm:text-base leading-snug"
                          style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>{f.q}</span>
                    <ChevronDown className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180"
                                 style={{ color: C.orangeDk }} aria-hidden="true" />
                  </summary>
                  <p className="px-5 sm:px-6 pb-5 pt-0 text-sm leading-relaxed" style={{ color: C.muted }}>{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. FOUNDER — answers "who are you" faster than a paragraph ── */}
      <section className="relative py-16 px-6" style={{ background: C.subtle }}>
        <div className="relative max-w-2xl mx-auto">
          <Reveal>
            <div className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left"
                 style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(28,25,23,0.04)" }}>
              {FOUNDER_PHOTO_URL ? (
                <img src={FOUNDER_PHOTO_URL} alt="Jonathan, founder of FieldBuilt AI"
                     width={96} height={96}
                     className="w-24 h-24 rounded-2xl object-cover shrink-0"
                     style={{ border: `2px solid ${C.border}` }} />
              ) : (
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center shrink-0"
                     style={{ background: "#FFF3EC", border: `1px solid ${C.border}` }}>
                  <span className="text-4xl font-extrabold" style={{ color: C.orangeDk, fontFamily: "var(--font-jakarta)" }}>J</span>
                </div>
              )}
              <div>
                <div className="font-bold text-lg mb-1" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                  Jonathan &middot; founder, FieldBuilt AI
                </div>
                <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                  You&rsquo;re not meeting a sales rep. I set up the ads, the AI and the
                  quote chasing for every flooring company myself, which is why I only take
                  a few a month. Bring your hardest questions: your slow months, your
                  pickiest homeowners, the &ldquo;my area is different.&rdquo; That&rsquo;s
                  the part of the call I&rsquo;m best at.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 10. FINAL CTA ── */}
      <section className="relative py-16 sm:py-20 px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={GRID_TEXTURE} />
        <div className="relative max-w-2xl mx-auto text-center">
          <Reveal>
            <h2 className="font-extrabold tracking-tight mb-6"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                         fontSize: "clamp(1.6rem, 5.2vw, 2.4rem)", lineHeight: 1.15, textWrap: "balance" }}>
              Your crews are ready.
              <br /><span style={{ color: C.orangeDk }}>
                Let&rsquo;s fill the measures.
              </span>
            </h2>
            <Cta />
          </Reveal>
        </div>
      </section>

      <MinimalFooter />
    </main>
  )
}
