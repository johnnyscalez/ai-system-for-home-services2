"use client"

// ─── BOOKED CONFIRMATION — /start/booked ─────────────────────────────────────
// The GHL calendar's "form submit redirect URL" should point here. A lead
// lands on this page seconds after booking the walkthrough call.
//
// Its one job: make the appointment feel real, valuable, and already paying
// off — before he closes the tab. Every no-show is quiet doubt winning over
// the next 24-48 hours; this page is the counterweight.
//
// Optional query params (GHL can append merge fields to the redirect URL):
//   ?time=<appointment time — shown verbatim; if it parses as a date, an
//          add-to-Google-Calendar button appears too>
//   &name=<first name, for the greeting>
// Both are optional — the page reads fine without them.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Phone, Calendar, Map, PencilLine, ArrowUpRight } from "lucide-react"
import { C, FieldFMark, MinimalFooter } from "@/components/landing/shared"

// Paste the founder video URL here when it's filmed (mp4 or an embed URL).
// While empty, the video section stays hidden — no visible placeholder ships
// to real leads.
const FOUNDER_VIDEO_URL = ""

function googleCalendarLink(start: Date): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "")
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "FieldBuilt AI — System Walkthrough",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: "20-minute walkthrough call with FieldBuilt AI. Have last month's rough lead count handy.",
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function BookedContent() {
  const params = useSearchParams()
  const name = params.get("name")
  const timeRaw = params.get("time")
  const parsed = timeRaw ? new Date(timeRaw) : null
  const timeValid = parsed !== null && !isNaN(parsed.getTime())

  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      {/* Slim header — no CTA; he already converted */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 py-4"
              style={{ background: "rgba(26,22,20,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(249,115,22,0.10)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
            <FieldFMark size={18} />
          </div>
          <span className="font-extrabold text-xl tracking-tight"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            FIELDBUILT
            <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
                  style={{ fontSize: "0.42em", background: C.orange, padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}>
              AI
            </span>
          </span>
        </div>
      </header>

      {/* ── CONFIRMATION HERO ── */}
      <section className="relative flex flex-col justify-center pt-28 pb-14 px-6 overflow-hidden"
               style={{ background: "linear-gradient(180deg, #141110 0%, #1A1614 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
             style={{
               backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
               backgroundSize: "44px 44px", opacity: 0.055,
               WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
               maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
             }} />
        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full blur-3xl pointer-events-none"
          style={{ width: 600, height: 600, background: "rgba(22,163,74,0.06)", top: "-15%", left: "-10%" }} aria-hidden="true" />

        <div className="relative max-w-2xl mx-auto w-full text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-7 text-sm font-bold"
            style={{ background: "rgba(22,163,74,0.14)", color: "#4ADE80", border: "1px solid rgba(22,163,74,0.30)" }}>
            &#10003; You&rsquo;re locked in
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}
            className="font-extrabold tracking-tight mb-5"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                     fontSize: "clamp(2.2rem, 7.5vw, 3.6rem)", lineHeight: 1.06 }}>
            {name ? `${name}, your` : "Your"} walkthrough
            <br /><span style={{ color: C.orange }}>is on the calendar.</span>
          </motion.h1>

          {timeRaw && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl mb-6"
              style={{ background: "rgba(250,250,248,0.05)", border: "1px solid rgba(249,115,22,0.22)" }}>
              <Calendar className="w-4 h-4" style={{ color: C.orange }} aria-hidden="true" />
              <span className="text-base font-bold" style={{ color: "#F5F3F0", fontFamily: "var(--font-jetbrains)" }}>
                {timeValid
                  ? parsed!.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
                  : timeRaw}
              </span>
            </motion.div>
          )}

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
            className="text-lg leading-relaxed max-w-xl mx-auto mb-8" style={{ color: "rgba(250,250,248,0.62)" }}>
            Twenty minutes. By the end of it you&rsquo;ll know exactly where your shop
            leaks leads — and what it looks like fixed.
          </motion.p>

          {/* Check your phone — the product demos itself */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.55 }}
            className="flex items-start gap-3 text-left rounded-2xl px-6 py-5 mb-6"
            style={{ background: "rgba(249,115,22,0.09)", border: "1px solid rgba(249,115,22,0.28)" }}>
            <Phone className="w-5 h-5 mt-0.5 shrink-0" style={{ color: C.orange }} aria-hidden="true" />
            <p className="text-base leading-relaxed" style={{ color: "#F5F3F0" }}>
              <strong>Check your phone right now.</strong>{" "}
              A text just went out to confirm your spot. That&rsquo;s the same system
              that&rsquo;ll be answering <em>your</em> leads — consider it the first demo.
            </p>
          </motion.div>

          {timeValid && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}>
              <a href={googleCalendarLink(parsed!)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 text-sm font-bold hover:underline underline-offset-4"
                 style={{ color: C.orange }}>
                Add it to Google Calendar
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── FOUNDER VIDEO (hidden until FOUNDER_VIDEO_URL is set) ── */}
      {FOUNDER_VIDEO_URL && (
        <section className="relative py-16 px-6" style={{ background: C.dark }}>
          <div className="relative max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-6"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
              A quick hello before we talk.
            </h2>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(249,115,22,0.20)" }}>
              <video src={FOUNDER_VIDEO_URL} controls playsInline className="w-full" preload="metadata" />
            </div>
          </div>
        </section>
      )}

      {/* ── WHAT YOU'LL WALK AWAY WITH ── */}
      <section className="relative px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" aria-hidden="true"
             style={{ background: "linear-gradient(180deg, #1A1614 0%, rgba(250,250,248,0) 100%)" }} />
        <div className="relative max-w-2xl mx-auto pt-24 pb-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px" style={{ background: C.orange }} />
            <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>What you&rsquo;ll leave the call with</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-8"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
            Your leak map — yours to keep, either way.
          </h2>

          <div className="rounded-2xl p-7 mb-6"
               style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                   style={{ background: "rgba(249,115,22,0.10)" }}>
                <Map className="w-5 h-5" style={{ color: C.orange }} aria-hidden="true" />
              </div>
              <span className="font-bold text-base" style={{ color: C.text }}>A map of how leads move through your shop today</span>
            </div>
            <ul className="space-y-3">
              {[
                "Where your leads come in, where they stall, and where the money's going",
                "Which parts of your operation are running on gut feel instead of numbers",
                "What the fix looks like for your shop specifically — not a template",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: C.muted }}>
                  <span className="font-black text-xs mt-1" style={{ color: C.success }} aria-hidden="true">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm mt-5 pt-5 font-medium" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>
              You keep the map whether we ever work together or not. No pitch until you ask for one.
            </p>
          </div>

          {/* Homework — small investment, big show-rate effect */}
          <div className="flex items-start gap-4 rounded-2xl p-6"
               style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.16)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: "rgba(249,115,22,0.12)" }}>
              <PencilLine className="w-5 h-5" style={{ color: C.orangeDk }} aria-hidden="true" />
            </div>
            <div>
              <div className="font-bold text-base mb-1" style={{ color: C.text }}>One thing to do before the call</div>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                Jot down roughly how many leads came in last month. Even a guess.
                On the call we&rsquo;ll find the real number together — the gap between
                the two is usually the whole conversation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <MinimalFooter />
    </main>
  )
}

export default function BookedPage() {
  return (
    <Suspense fallback={null}>
      <BookedContent />
    </Suspense>
  )
}
