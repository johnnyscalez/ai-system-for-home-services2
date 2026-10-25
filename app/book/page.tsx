"use client"

// ─── BOOKING PAGE — /book ────────────────────────────────────────────────────
// Paid-traffic landing page for flooring contractors. Same design system as the
// homepage (components/site/*). Positioning rules: docs/flooring-pivot.md.
//   - Headline wording on this page is set by Jonathan (last change 2026-10-25):
//     "Get 20+ Booked Measures in 60 Days, and Own Your Client Flow System.
//      Guaranteed" — "Own" is orange on purpose.
//   - Never state guarantee failure terms. Never show price.
//   - No flooring proof exists yet. Top Air numbers appear ONLY labelled as
//     "a live home-services account", never implied to be flooring.
// Page is booking-only (Jonathan, 2026-10-20): headline → calendar. No VSL,
// no sections below the calendar.
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion"
import { ArrowDown, Check, Star } from "lucide-react"
import { GhlBookingWidget } from "@/components/landing/shared"
import { Parquet, T } from "@/components/site/live"
import { Accent, Eyebrow, H2, IcpHeadline, Logo, Reveal } from "@/components/site/ui"


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
  return (
    <main className="overflow-x-clip font-sans" style={{ background: T.cream, color: T.ink }}>

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
          <IcpHeadline align="center" />

          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.65 }}
                     className="mt-6 font-heading text-[clamp(32px,5.4vw,62px)] font-extrabold leading-[1.05] tracking-[-0.03em]"
                     style={{ color: T.ink, textWrap: "balance" }}>
            Get <span style={{ color: T.orangeD }}>20+ Booked Measures</span> in 60 Days, and <span style={{ color: T.orangeD }}>Own</span> Your Client Flow System.{" "}
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
            We build everything between a homeowner to a qualified measure on your calendar.
            The demand, the answering, the qualifying, the follow up, the tracking, the booking.
            Installed in your business, running every day, and yours.
          </motion.p>

          <motion.a href="#book" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
                    className="group mt-9 inline-flex items-center gap-2.5 rounded-full px-8 py-4 font-heading text-[16px] font-bold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: T.orange, boxShadow: "0 12px 30px -10px rgba(249,115,22,0.6)" }}>
            Pick your time below
            <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
          </motion.a>
        </div>
      </section>

      {/* ── 2. THE CALENDAR ── */}
      <section id="book" className="relative scroll-mt-20 overflow-hidden border-y px-5 py-16 sm:px-8 sm:py-20" style={{ background: T.white, borderColor: T.line }}>
        <div className="relative mx-auto max-w-[820px]">
          <Reveal className="mb-8 text-center">
            <Eyebrow>Book your walkthrough</Eyebrow>
            <H2 className="mt-4 !text-[clamp(26px,3.6vw,40px)]">Pick a time to see your <Accent>20+ measures plan.</Accent></H2>
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
