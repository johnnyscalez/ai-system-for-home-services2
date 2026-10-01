"use client"

// ─── BOOKED CONFIRMATION — /start/booked ─────────────────────────────────────
// The GHL calendar's "form submit redirect URL" should point here. A lead
// lands on this page seconds after booking the walkthrough call.
//
// Its one job: make the appointment feel real, valuable, and already paying
// off — before he closes the tab. Every no-show is quiet doubt winning over
// the next 24-48 hours; this page is the counterweight.
//
// Structure (the psychological arc):
//   1. "Not confirmed yet" hero — the booking is real, but one action is still
//      owed. Details + setup line + the thumbs-up micro-commitment, which is
//      this page's single most important job.
//   2. Pre-call briefing video + the line that reframes the call.
//   3. Product tour — SMS thread, lead profile w/ street view + AI notes, tech
//      portal, tech dashboard. JSX mockups in "your" language, so he pre-owns
//      the system before the call.
//
// Optional query params (GHL can append merge fields to the redirect URL):
//   ?time=<appointment time — shown verbatim; if it parses as a date, an
//          add-to-Google-Calendar button appears too>
//   &name=<first name, for the greeting>
// Both are optional — the page reads fine without them.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, createElement, useRef } from "react"
import Script from "next/script"
import { useSearchParams } from "next/navigation"
import { motion, useInView } from "framer-motion"
import {
  Calendar, ArrowUpRight, MapPin, Route, Bell, Repeat, Navigation, StickyNote,
  Video, Clock, MessageSquare, AlertCircle,
} from "lucide-react"
import { C, FieldFMark, MinimalFooter, TechDashboardPreview } from "@/components/landing/shared"

// The pre-call briefing (Wistia). WISTIA_CSS is Wistia's own placeholder rule:
// it paints the poster frame, blurred, until the custom element is defined, so
// the slot never flashes empty while the player script loads.
const WISTIA_ID = "fnwt94a1n6"
const WISTIA_CSS = `wistia-player[media-id='${WISTIA_ID}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${WISTIA_ID}/swatch'); display: block; filter: blur(5px); padding-top: 64.79%; }`

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

// ─────────────────────────────────────────────────────────────────────────────
// MOCKUP: SMS conversation — condensed version of the thread on /start.
// The timestamps are the proof: answered in seconds, booked in 12 minutes.
// ─────────────────────────────────────────────────────────────────────────────
function SmsThreadMockup() {
  const messages: { time: string; from: "system" | "sarah"; text: string }[] = [
    { time: "8:17 PM", from: "system", text: "Hey Sarah, saw your form about the AC not keeping up. Is it running at all, or totally off?" },
    { time: "8:21 PM", from: "sarah",  text: "running but won't get below 78. been like this 2 weeks" },
    { time: "8:24 PM", from: "system", text: "That's miserable in this heat. What's the address so I can see which tech is closest?" },
    { time: "8:25 PM", from: "sarah",  text: "btw I'm just getting a few quotes, not sure what I need yet" },
    { time: "8:25 PM", from: "system", text: "No worries at all — our tech comes out, tells you exactly what's going on, you decide from there. What's Monday look like?" },
    { time: "8:29 PM", from: "system", text: "Done — Monday 11am, locked in. You'll get a reminder Sunday night." },
  ]
  return (
    <div className="max-w-md mx-auto space-y-3">
      {messages.map((m, i) => {
        const isSystem = m.from === "system"
        return (
          <div key={i} className={`flex flex-col ${isSystem ? "items-end" : "items-start"}`}>
            <div className="max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-snug"
                 style={{
                   background: isSystem ? C.orange : "rgba(255,255,255,0.06)",
                   color: isSystem ? "#fff" : "rgba(250,250,248,0.85)",
                   borderTopRightRadius: isSystem ? 4 : 16,
                   borderTopLeftRadius: isSystem ? 16 : 4,
                 }}>
              {m.text}
            </div>
            <span className="text-[11px] mt-1 px-1"
                  style={{ color: "rgba(250,250,248,0.32)", fontFamily: "var(--font-jetbrains)" }}>
              {isSystem ? "AI" : "Sarah"} &middot; {m.time}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKUP: lead profile — street view pulled from the address, AI conversation
// notes saved to the lead, routing decision on the record.
// ─────────────────────────────────────────────────────────────────────────────
function LeadProfileMockup() {
  const notes = [
    "AC runs non-stop, won't cool below 78 — going on 2 weeks",
    "Unit is ~12 yrs old, homeowner unsure of brand",
    "Getting multiple quotes — price-aware, wants honesty not pressure",
  ]
  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ border: "1px solid rgba(249,115,22,0.18)", boxShadow: "0 24px 60px rgba(0,0,0,0.40)" }}>
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3"
           style={{ background: "#141210", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-4 h-5 rounded px-2 flex items-center" style={{ background: "rgba(255,255,255,0.04)" }}>
          <span className="text-xs truncate" style={{ color: "rgba(250,250,248,0.28)", fontFamily: "var(--font-jetbrains)" }}>
            FieldBuilt AI · Lead Profile
          </span>
        </div>
      </div>
      <div className="p-4 sm:p-5" style={{ background: "#1C1712" }}>
        {/* Lead header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
               style={{ background: C.orange, color: "#fff" }}>S</div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate" style={{ color: "#F5F3F0" }}>Sarah Mitchell</div>
            <div className="text-[11px]" style={{ color: "rgba(250,250,248,0.40)", fontFamily: "var(--font-jetbrains)" }}>
              Web form &middot; Tue 8:17 PM
            </div>
          </div>
          <div className="ml-auto flex gap-1.5 shrink-0">
            <span className="text-[10px] px-2 py-1 rounded-full font-semibold"
                  style={{ background: "rgba(249,115,22,0.14)", color: C.orange }}>AC Repair</span>
            <span className="hidden sm:inline text-[10px] px-2 py-1 rounded-full font-semibold"
                  style={{ background: "rgba(22,163,74,0.14)", color: "#4ADE80" }}>Booked</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {/* Street view — stylized, appears the moment the AI captures the address */}
          <div className="rounded-xl overflow-hidden relative" style={{ minHeight: 148 }}>
            <div className="absolute inset-0"
                 style={{ background: "linear-gradient(180deg, #2E3D52 0%, #3A4A60 44%, #4A4238 58%, #2E2A24 100%)" }} />
            {/* house silhouette */}
            <div className="absolute" style={{ left: "50%", top: "38%", transform: "translateX(-50%)" }}>
              <div className="w-0 h-0 mx-auto"
                   style={{ borderLeft: "34px solid transparent", borderRight: "34px solid transparent", borderBottom: "22px solid #5C5348" }} />
              <div className="w-[56px] h-[34px] mx-auto relative" style={{ background: "#6B6154" }}>
                <div className="absolute w-[10px] h-[16px] bottom-0 left-[10px]" style={{ background: "#3A342C" }} />
                <div className="absolute w-[11px] h-[10px] top-[7px] right-[9px]" style={{ background: "#8A7E6E" }} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center gap-1.5"
                 style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))" }}>
              <MapPin className="w-3 h-3 shrink-0" style={{ color: C.orange }} aria-hidden="true" />
              <span className="text-[10px] truncate" style={{ color: "rgba(250,250,248,0.85)", fontFamily: "var(--font-jetbrains)" }}>
                3214 Maple Creek Dr &middot; Street View
              </span>
            </div>
          </div>

          {/* AI notes */}
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <StickyNote className="w-3.5 h-3.5" style={{ color: C.orange }} aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(250,250,248,0.55)" }}>
                AI notes — saved automatically
              </span>
            </div>
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n} className="flex items-start gap-2 text-xs leading-snug" style={{ color: "rgba(250,250,248,0.70)" }}>
                  <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: C.orange }} aria-hidden="true" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Routing decision on the record */}
        <div className="mt-3 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
             style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.16)" }}>
          <Route className="w-4 h-4 shrink-0" style={{ color: C.orange }} aria-hidden="true" />
          <span className="text-xs leading-snug" style={{ color: "rgba(250,250,248,0.75)" }}>
            Routed to <strong style={{ color: "#F5F3F0" }}>Marcus T.</strong> — covers this area, highest close rate on repairs
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKUP: tech portal — a tech's day on his phone. No group-text chaos.
// ─────────────────────────────────────────────────────────────────────────────
function TechPortalMockup() {
  const jobs = [
    { time: "11:00 AM", name: "Sarah M.", job: "AC repair — runs non-stop", addr: "3214 Maple Creek Dr" },
    { time: "2:30 PM",  name: "Dave K.",  job: "No heat — upstairs zone",   addr: "88 Linden Ave" },
  ]
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2rem] p-2.5"
         style={{ background: "#141210", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
      <div className="rounded-[1.6rem] overflow-hidden" style={{ background: "#1C1712" }}>
        {/* status bar + notch */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-20 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.10)" }} />
        </div>
        <div className="px-4 pt-2 pb-1.5 flex items-center justify-between">
          <span className="text-sm font-extrabold" style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)" }}>
            Today &middot; Marcus
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(249,115,22,0.14)", color: C.orange }}>2 jobs</span>
        </div>
        <div className="px-3 pb-4 pt-1.5 space-y-2.5">
          {jobs.map((j, i) => (
            <div key={i} className="rounded-xl p-3"
                 style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>{j.time}</span>
                {i === 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: C.orange, color: "#fff" }}>
                    <Navigation className="w-2.5 h-2.5" aria-hidden="true" /> On my way
                  </span>
                )}
              </div>
              <div className="text-xs font-bold mb-0.5" style={{ color: "#F5F3F0" }}>{j.name} &middot; {j.job}</div>
              <div className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(250,250,248,0.45)" }}>
                <MapPin className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> {j.addr}
              </div>
              <div className="flex gap-1.5 mt-2">
                {["Lead notes", "Directions"].map((chip) => (
                  <span key={chip} className="text-[10px] px-2 py-1 rounded-md font-semibold"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(250,250,248,0.60)" }}>{chip}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TOUR ITEM — heading + caption + mockup, scroll-animated
// ─────────────────────────────────────────────────────────────────────────────
function TourItem({ index, title, caption, children }: {
  index: string; title: string; caption: string; children: React.ReactNode
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }} className="mb-16 last:mb-0">
      <div className="max-w-xl mx-auto text-center mb-7">
        <span className="text-xs font-bold uppercase tracking-widest block mb-3"
              style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>{index}</span>
        <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-3"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
          {title}
        </h3>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "rgba(250,250,248,0.55)" }}>
          {caption}
        </p>
      </div>
      {children}
    </motion.div>
  )
}

function BookedContent() {
  const params = useSearchParams()

  // NOTE: no Schedule pixel event here. GHL's pixel integration fires
  // Schedule natively from inside the booking widget the moment a booking is
  // submitted (verified on the wire 2026-08) — on /book, /start, and anywhere
  // else the calendar is embedded. Firing it here too would double-count, and
  // would also re-fire on every refresh/revisit of this page.
  const name = params.get("name")
  const timeRaw = params.get("time")
  const parsed = timeRaw ? new Date(timeRaw) : null
  const timeValid = parsed !== null && !isNaN(parsed.getTime())


  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: WISTIA_CSS }} />
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script src={`https://fast.wistia.com/embed/${WISTIA_ID}.js`} type="module" strategy="afterInteractive" />
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

      {/* ── 1. NOT CONFIRMED YET — the page's one job is the thumbs-up reply ── */}
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
          className="absolute rounded-full blur-3xl pointer-events-none" aria-hidden="true"
          style={{ width: 600, height: 600, background: "rgba(251,191,36,0.07)", top: "-15%", left: "-10%" }} />

        <div className="relative max-w-2xl mx-auto w-full text-center">
          {/* amber, not green: something is still owed */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-7 text-sm font-bold"
            style={{ background: "rgba(251,191,36,0.14)", color: "#FCD34D", border: "1px solid rgba(251,191,36,0.32)" }}>
            <AlertCircle className="w-4 h-4" aria-hidden="true" /> One step left
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}
            className="font-extrabold tracking-tight mb-5"
            style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                     fontSize: "clamp(2rem, 7vw, 3.4rem)", lineHeight: 1.06, textWrap: "balance" }}>
            {name ? `${name}, your call ` : "Your call "}
            <span style={{ color: "#FBBF24" }}>isn&rsquo;t confirmed yet.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg leading-relaxed max-w-xl mx-auto mb-9" style={{ color: "rgba(250,250,248,0.62)" }}>
            You&rsquo;ve booked your HVAC Booking Walkthrough. Check your email for the
            appointment details, then watch the short briefing below so you know
            what we&rsquo;ll cover.
          </motion.p>

          {/* details */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.55 }}
            className="rounded-2xl overflow-hidden text-left mb-7"
            style={{ background: "rgba(250,250,248,0.04)", border: "1px solid rgba(250,250,248,0.10)" }}>
            {[
              { icon: Video, k: "Where", v: "Google Meet call — the link has been sent to your email" },
              { icon: Clock, k: "Duration", v: "15 to 30 minutes" },
              { icon: Calendar, k: "Date & time", v: timeValid
                  ? parsed!.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
                  : timeRaw || "Check your email for the confirmed time slot" },
            ].map((row, i) => (
              <div key={row.k} className="flex items-start gap-3.5 px-5 sm:px-6 py-4"
                   style={{ borderTop: i === 0 ? "none" : "1px solid rgba(250,250,248,0.07)" }}>
                <row.icon className="w-4.5 h-4.5 mt-0.5 shrink-0" style={{ color: C.orange }} aria-hidden="true" />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
                       style={{ color: "rgba(250,250,248,0.40)", fontFamily: "var(--font-jetbrains)" }}>{row.k}</div>
                  <div className="text-[15px] leading-snug" style={{ color: "#F5F3F0" }}>{row.v}</div>
                </div>
              </div>
            ))}
          </motion.div>

          {timeValid && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mb-7 -mt-2">
              <a href={googleCalendarLink(parsed!)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 text-sm font-bold hover:underline underline-offset-4"
                 style={{ color: C.orange }}>
                Add it to Google Calendar
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </motion.div>
          )}

          {/* setup line */}
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="text-base leading-relaxed max-w-xl mx-auto mb-9" style={{ color: "rgba(250,250,248,0.55)" }}>
            We&rsquo;re preparing a personalized HVAC Appointment Booking System review
            around your business, your replacement-work capacity, and your current
            path from inquiry to booked estimate.
          </motion.p>

          {/* THE micro-commitment — loudest element on the page */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.55 }}
            className="rounded-2xl px-6 py-7 text-left"
            style={{ background: "linear-gradient(160deg, rgba(251,191,36,0.13) 0%, rgba(251,191,36,0.05) 100%)",
                     border: "1px solid rgba(251,191,36,0.38)", boxShadow: "0 18px 50px rgba(251,191,36,0.10)" }}>
            <div className="flex items-start gap-3.5">
              <MessageSquare className="w-5 h-5 mt-1 shrink-0" style={{ color: "#FBBF24" }} aria-hidden="true" />
              <div>
                <p className="text-base sm:text-lg font-bold leading-snug mb-2"
                   style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)" }}>
                  To secure your spot, reply to the confirmation text you just
                  received with a <span style={{ fontSize: "1.15em" }}>👍</span>
                </p>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "rgba(250,250,248,0.65)" }}>
                  If we don&rsquo;t receive your confirmation, your call slot is released
                  to another HVAC business owner automatically.
                </p>
                <p className="text-sm font-semibold" style={{ color: "#FCD34D" }}>
                  We only open a few of these sessions each day, so please confirm right away.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 2. PRE-CALL BRIEFING ── */}
      <section className="relative py-16 sm:py-20 px-6" style={{ background: C.dark }}>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="font-extrabold tracking-tight mb-7"
              style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                       fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
            See the path we&rsquo;ll map together
          </h2>

          <div className="rounded-2xl overflow-hidden"
               style={{ border: "1px solid rgba(249,115,22,0.22)", boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
            {/* Wistia web component, rendered via createElement so the custom
                tag needs no JSX intrinsic-element declaration. */}
            {createElement("wistia-player", {
              "media-id": WISTIA_ID,
              seo: "false",
              aspect: "1.5434083601286173",
              style: { display: "block" },
            })}
          </div>

          <blockquote className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto mt-8"
                      style={{ color: "rgba(250,250,248,0.72)" }}>
            &ldquo;Most HVAC owners say the same thing once they see the numbers:{" "}
            <em style={{ color: "#F5F3F0", fontStyle: "normal", fontWeight: 700 }}>
              I had no idea how many people in my own area were looking for this and
              booking somewhere else.
            </em>&rdquo;
          </blockquote>
        </div>
      </section>

      {/* ── 3. PRODUCT TOUR — what he'll watch running live on the call ── */}
      <section className="relative py-20 px-6 overflow-hidden" style={{ background: "#201A17" }}>
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true"
             style={{
               backgroundImage: "radial-gradient(circle, rgba(249,115,22,0.10) 1.2px, transparent 1.2px)",
               backgroundSize: "30px 30px",
               WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000 20%, transparent 75%)",
               maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000 20%, transparent 75%)",
             }} />
        <div className="relative max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="w-8 h-px" style={{ background: C.orange }} />
              <span className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>And the fix, running live</span>
              <span className="w-8 h-px" style={{ background: C.orange }} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5"
                style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
              This is what you&rsquo;ll see
              <br /><span style={{ color: C.orange }}>on the screen with me.</span>
            </h2>
            <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: "rgba(250,250,248,0.52)" }}>
              Not slides. The actual system — the same one that texted you a minute
              ago — handling a lead from first hello to a tech at the door.
            </p>
          </div>

          <TourItem index="01 · The AI agent"
            title="Every lead answered in seconds. Qualified, objections handled, booked."
            caption="8:17 on a Tuesday night — office closed. The AI asks what your best CSR would ask, handles the &ldquo;just getting quotes&rdquo; wall, and books the job. Nobody on your team touched a thing.">
            <SmsThreadMockup />
            {/* What fired automatically behind that conversation */}
            <div className="max-w-md mx-auto mt-6 rounded-2xl p-5 space-y-3"
                 style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.20)" }}>
              {[
                { icon: Route,  text: "Routed to the right tech — by area and by who actually closes this job type" },
                { icon: Bell,   text: "Confirmation sent, Sunday-night reminder scheduled — automatically" },
                { icon: Repeat, text: "If she'd gone quiet: follow-ups for two weeks, then a phone call" },
              ].map((r) => (
                <div key={r.text} className="flex items-start gap-3">
                  <r.icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.orange }} aria-hidden="true" />
                  <span className="text-sm leading-snug" style={{ color: "rgba(250,250,248,0.80)" }}>{r.text}</span>
                </div>
              ))}
            </div>
          </TourItem>

          <TourItem index="02 · The lead profile"
            title="Every conversation becomes a file your whole shop can see."
            caption="The AI takes notes while it talks and saves them to the lead. The moment it gets an address, the street view is already on the profile — your tech knows the house before he leaves the shop.">
            <LeadProfileMockup />
          </TourItem>

          <TourItem index="03 · The tech portal"
            title="Your techs get their day on their phone. No group-text chaos."
            caption="Every tech sees his own jobs, addresses, and the lead&rsquo;s full story in his own portal. One tap for directions, one tap to tell the homeowner he&rsquo;s on the way.">
            <TechPortalMockup />
          </TourItem>

          <TourItem index="04 · The instruments"
            title="And you finally see the numbers you've been running on gut."
            caption="Who actually closes — not who&rsquo;s busiest. Which jobs make you money. Where every lead came from. Live, on one screen, every morning.">
            <TechDashboardPreview caption="Every tech, every close rate, every dollar — one screen." />
          </TourItem>
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
