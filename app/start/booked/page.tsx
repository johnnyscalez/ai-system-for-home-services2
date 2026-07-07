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
//   1. Confirmation hero — relief, lock-in, "check your phone" live demo
//   2. The leak map, made concrete — five leaks as questions about HIS shop
//      he can't currently answer (curiosity + loss-awareness)
//   3. Product tour — SMS thread, dispatch, lead profile w/ street view + AI
//      notes, tech portal, tech dashboard. All JSX mockups, captioned in
//      "your" language so he pre-owns the system before the call.
//   4. Founder note + homework — personal accountability + micro-commitment
//
// Optional query params (GHL can append merge fields to the redirect URL):
//   ?time=<appointment time — shown verbatim; if it parses as a date, an
//          add-to-Google-Calendar button appears too>
//   &name=<first name, for the greeting>
// Both are optional — the page reads fine without them.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { motion, useInView } from "framer-motion"
import {
  Phone, Calendar, PencilLine, ArrowUpRight, MapPin, Zap, Moon,
  Repeat, Route, BarChart3, Bell, Navigation, StickyNote,
} from "lucide-react"
import { C, FieldFMark, MinimalFooter, TechDashboardPreview } from "@/components/landing/shared"

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

// ─────────────────────────────────────────────────────────────────────────────
// THE FIVE LEAKS — the leak map, made concrete. Each row is a question the
// owner can't currently answer about his own shop. That gap IS the pitch.
// ─────────────────────────────────────────────────────────────────────────────
const LEAKS = [
  {
    icon: Zap,
    label: "The speed leak",
    question: "When a lead comes in, how many minutes until someone answers?",
    detail: "Past five minutes, most homeowners have already texted the next company on the list. You paid for that lead either way.",
  },
  {
    icon: Moon,
    label: "The after-hours leak",
    question: "Who answers the form that comes in at 8:17 on a Tuesday night?",
    detail: "Evenings and weekends are when homeowners sit down and ask for help. For most shops, that's exactly when nobody's answering.",
  },
  {
    icon: Repeat,
    label: "The follow-up leak",
    question: "The lead who didn't book on the first text — who chases him tomorrow?",
    detail: "And the day after, and next week? In most shops the honest answer is nobody. That's paid-for revenue going quiet.",
  },
  {
    icon: Route,
    label: "The dispatch leak",
    question: "Do jobs go to whoever's free, or whoever actually closes?",
    detail: "One shop we pulled numbers for: busiest tech closed 61%, the quiet one closed 79%. Every big job had gone to the wrong guy for years.",
  },
  {
    icon: BarChart3,
    label: "The visibility leak",
    question: "Close rate per tech. Revenue per lead source. Where do those numbers live?",
    detail: "If the answer is “in my gut,” that's the leak feeding all the others — you can't fix what you can't see.",
  },
] as const

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

  // Meta pixel Schedule event — this page is the GHL calendar's post-booking
  // redirect target, so landing here = a booked call. Tracked for measurement
  // and future optimization switching; the ad set optimizes on Lead for now
  // (booking volume is nowhere near Meta's ~50/week learning threshold).
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Schedule")
    }
  }, [])
  const name = params.get("name")
  const timeRaw = params.get("time")
  const parsed = timeRaw ? new Date(timeRaw) : null
  const timeValid = parsed !== null && !isNaN(parsed.getTime())

  const leakRef = useRef(null)
  const leakInView = useInView(leakRef, { once: true, margin: "-60px" })

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

      {/* ── 1. CONFIRMATION HERO ── */}
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
            Twenty minutes. You&rsquo;ll leave with a map of exactly where your shop
            leaks money — and you&rsquo;ll watch the system that plugs every leak
            running live.
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

      {/* ── 2. THE LEAK MAP, MADE CONCRETE ── */}
      <section ref={leakRef} className="relative px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" aria-hidden="true"
             style={{ background: "linear-gradient(180deg, #1A1614 0%, rgba(250,250,248,0) 100%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-50" aria-hidden="true"
             style={{
               backgroundImage: "radial-gradient(rgba(249,115,22,0.10) 1px, transparent 1px)",
               backgroundSize: "28px 28px",
               WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 20%, transparent 80%)",
               maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 20%, transparent 80%)",
             }} />
        <div className="relative max-w-2xl mx-auto pt-24 pb-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={leakInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-px" style={{ background: C.orange }} />
              <span className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>What you&rsquo;re actually getting</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-5"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
              Your leak map: the five places
              <br /><span style={{ color: C.orangeDk }}>money quietly walks out of your shop.</span>
            </h2>
            <p className="text-base leading-relaxed mb-10 max-w-xl" style={{ color: C.muted }}>
              Between the moment a homeowner asks for help and the moment your tech
              rings the doorbell, every shop leaks in the same five places. On the
              call we mark all five for <em>your</em> shop — your numbers, not
              industry averages. Here&rsquo;s what we&rsquo;re looking for:
            </p>
          </motion.div>

          {/* The five leaks */}
          <div className="space-y-4 mb-8">
            {LEAKS.map((leak, i) => (
              <motion.div key={leak.label}
                initial={{ opacity: 0, y: 16 }} animate={leakInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }}
                className="flex items-start gap-4 rounded-2xl p-5 sm:p-6"
                style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.06)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                     style={{ background: "rgba(249,115,22,0.10)" }}>
                  <leak.icon className="w-5 h-5" style={{ color: C.orangeDk }} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-widest mb-1.5"
                       style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>{leak.label}</div>
                  <div className="font-bold text-base sm:text-lg leading-snug mb-1.5"
                       style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>{leak.question}</div>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{leak.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={leakInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="rounded-2xl p-6 sm:p-7 text-center"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.18)" }}>
            <p className="text-base sm:text-lg font-bold leading-snug mb-2"
               style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              Almost every owner finds one number on this map he didn&rsquo;t know.
              Usually it&rsquo;s the expensive one.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
              You keep the map whether we ever work together or not.
              No pitch until you ask for one.
            </p>
          </motion.div>
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

      {/* ── 4. FOUNDER NOTE + HOMEWORK ── */}
      <section className="relative px-6" style={{ background: C.bg }}>
        <div className="relative max-w-2xl mx-auto pt-20 pb-14 space-y-6">
          {/* Founder note — he's meeting the builder, not a rep */}
          <div className="rounded-2xl p-7"
               style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.07)" }}>
            <div className="font-bold text-base mb-2" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
              One more thing — you&rsquo;re not meeting a sales rep.
            </div>
            <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
              You&rsquo;re meeting the person who builds every install. I take a couple
              of shops a month, I set the system up myself, and it runs free in your
              shop for 14 days before you pay anything. So come with your hardest
              questions — the weird edge cases, the &ldquo;yeah but my market is
              different.&rdquo; That&rsquo;s the part of the call I&rsquo;m best at.
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
