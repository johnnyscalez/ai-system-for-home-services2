"use client"

// ─── BOOKED CONFIRMATION — /start/booked ─────────────────────────────────────
// The GHL calendar's "form submit redirect URL" should point here. A flooring
// contractor lands on this page seconds after booking the call.
//
// Its one job: make the appointment feel real and worth showing up for before
// he closes the tab. Every no-show is quiet doubt winning over the next 24-48
// hours; this page is the counterweight.
//
// Structure:
//   1. "Not confirmed yet" hero — details + the thumbs-up micro-commitment,
//      which is this page's single most important job.
//   2. Pre-call briefing video.
//   3. What he'll see on the call — example conversation, measure file,
//      estimator's day, quote follow-up. All labelled as examples
//      (docs/flooring-pivot.md: no invented flooring proof).
//
// Light mode only. Positioning rules: docs/flooring-pivot.md.
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
  Calendar, ArrowUpRight, MapPin, Bell, Repeat, Navigation, StickyNote,
  Video, Clock, MessageSquare, AlertCircle, Users,
} from "lucide-react"
import { C, FieldFMark, MinimalFooter, QuoteChasePreview } from "@/components/landing/shared"

// The pre-call briefing (Wistia). WISTIA_CSS is Wistia's own placeholder rule:
// it paints the poster frame, blurred, until the custom element is defined, so
// the slot never flashes empty while the player script loads.
// TODO(flooring pivot): this video was recorded for HVAC owners and needs to
// be re-recorded for flooring. Keep the ID until the new one is uploaded.
const WISTIA_ID = "fnwt94a1n6"
const WISTIA_CSS = `wistia-player[media-id='${WISTIA_ID}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${WISTIA_ID}/swatch'); display: block; filter: blur(5px); padding-top: 64.79%; }`

function googleCalendarLink(start: Date): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "")
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "FieldBuilt AI call",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: "Call with Jonathan from FieldBuilt AI. Have a rough count of last month's in-home measures and open quotes handy.",
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  boxShadow: "0 16px 40px rgba(28,25,23,0.07)",
}

function ExampleTag() {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: C.subtle, color: C.muted }}>Example</span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKUP: SMS conversation — condensed version of the example on /start.
// ─────────────────────────────────────────────────────────────────────────────
function SmsThreadMockup() {
  const messages: { time: string; from: "ai" | "lead"; text: string }[] = [
    { time: "8:17 PM", from: "ai",   text: "Hi Sarah, this is the AI assistant for Summit Floors. Saw your request about new flooring. What are you thinking, LVP, hardwood, carpet?" },
    { time: "8:19 PM", from: "lead", text: "LVP probably. living room, hallway and the kitchen" },
    { time: "8:21 PM", from: "lead", text: "how much would that run?" },
    { time: "8:21 PM", from: "ai",   text: "The price comes from the measure, so it's real and not a guess. Will you and anyone else deciding both be home for it?" },
    { time: "8:23 PM", from: "lead", text: "my husband gets home around 5" },
    { time: "8:25 PM", from: "ai",   text: "Booked, Thursday 5:30pm. You'll get a reminder the day before, and you can reschedule right here." },
  ]
  return (
    <div className="max-w-md mx-auto space-y-3">
      {messages.map((m, i) => {
        const ai = m.from === "ai"
        return (
          <div key={i} className={`flex flex-col ${ai ? "items-end" : "items-start"}`}>
            <div className="max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-snug"
                 style={{
                   background: ai ? C.orangeSoft : C.surface,
                   border: `1px solid ${ai ? "rgba(249,115,22,0.22)" : C.border}`,
                   color: C.text,
                   borderTopRightRadius: ai ? 4 : 16,
                   borderTopLeftRadius: ai ? 16 : 4,
                 }}>
              {m.text}
            </div>
            <span className="text-[11px] mt-1 px-1" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
              {ai ? "AI" : "Sarah"} &middot; {m.time}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKUP: the measure file — what the AI saved before anyone drove out.
// ─────────────────────────────────────────────────────────────────────────────
function MeasureFileMockup() {
  const notes = [
    "LVP for living room, hallway and kitchen. About 3 rooms",
    "Wants it done next month",
    "Getting a few quotes. Asked about price, told it comes after the measure",
  ]
  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
        <span className="text-xs truncate" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
          FieldBuilt AI &middot; Measure file
        </span>
        <ExampleTag />
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
               style={{ background: C.orangeSoft, color: C.orangeDk }}>S</div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate" style={{ color: C.text }}>Sarah Mitchell</div>
            <div className="text-[11px]" style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>
              Facebook ad form &middot; Tue 8:17 PM
            </div>
          </div>
          <div className="ml-auto flex gap-1.5 shrink-0">
            <span className="text-[10px] px-2 py-1 rounded-full font-semibold"
                  style={{ background: C.subtle, color: C.text }}>LVP</span>
            <span className="hidden sm:inline text-[10px] px-2 py-1 rounded-full font-semibold"
                  style={{ background: "rgba(22,163,74,0.10)", color: "#15803D" }}>Measure booked</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <StickyNote className="w-3.5 h-3.5" style={{ color: C.orangeDk }} aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                AI notes, saved automatically
              </span>
            </div>
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n} className="flex items-start gap-2 text-xs leading-snug" style={{ color: C.text }}>
                  <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: C.orange }} aria-hidden="true" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-3 space-y-2.5" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            {[
              { icon: MapPin, text: "ZIP 75204, inside your service area" },
              { icon: Users,  text: "Both decision makers home Thursday 5:30pm" },
              { icon: Bell,   text: "Reminder goes out Wednesday" },
            ].map((r) => (
              <div key={r.text} className="flex items-start gap-2">
                <r.icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: C.success }} aria-hidden="true" />
                <span className="text-xs leading-snug" style={{ color: C.text }}>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKUP: the estimator's day — measures on his phone, every one pre-checked.
// ─────────────────────────────────────────────────────────────────────────────
function EstimatorDayMockup() {
  const measures = [
    { time: "3:00 PM", name: "Dave K.",  job: "Hardwood, stairs + upstairs hall", addr: "88 Linden Ave" },
    { time: "5:30 PM", name: "Sarah M.", job: "LVP, 3 rooms",                    addr: "ZIP 75204" },
  ]
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2rem] p-2.5"
         style={{ background: C.subtle, border: `1px solid ${C.border}`, boxShadow: "0 16px 40px rgba(28,25,23,0.10)" }}>
      <div className="rounded-[1.6rem] overflow-hidden" style={{ background: C.surface }}>
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-20 h-1.5 rounded-full" style={{ background: C.border }} />
        </div>
        <div className="px-4 pt-2 pb-1.5 flex items-center justify-between">
          <span className="text-sm font-extrabold" style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
            Thursday &middot; Measures
          </span>
          <ExampleTag />
        </div>
        <div className="px-3 pb-4 pt-1.5 space-y-2.5">
          {measures.map((j, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold" style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>{j.time}</span>
                {i === 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: C.orange, color: "#fff" }}>
                    <Navigation className="w-2.5 h-2.5" aria-hidden="true" /> On my way
                  </span>
                )}
              </div>
              <div className="text-xs font-bold mb-0.5" style={{ color: C.text }}>{j.name} &middot; {j.job}</div>
              <div className="flex items-center gap-1 text-[11px]" style={{ color: C.muted }}>
                <MapPin className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> {j.addr}
              </div>
              <div className="flex gap-1.5 mt-2">
                {["Decision makers home", "Notes"].map((chip) => (
                  <span key={chip} className="text-[10px] px-2 py-1 rounded-md font-semibold"
                        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>{chip}</span>
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
              style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>{index}</span>
        <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-3"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
          {title}
        </h3>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: C.muted }}>
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
  // submitted (verified on the wire 2026-08). Firing it here too would
  // double-count, and would re-fire on every refresh of this page.
  const name = params.get("name")
  const timeRaw = params.get("time")
  const parsed = timeRaw ? new Date(timeRaw) : null
  const timeValid = parsed !== null && !isNaN(parsed.getTime())

  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      <style dangerouslySetInnerHTML={{ __html: WISTIA_CSS }} />
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script src={`https://fast.wistia.com/embed/${WISTIA_ID}.js`} type="module" strategy="afterInteractive" />

      {/* Slim header — no CTA; he already converted */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 sm:px-6 py-3.5"
              style={{ background: "rgba(250,250,248,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
            <FieldFMark size={18} />
          </div>
          <span className="font-extrabold text-xl tracking-tight"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
            FIELDBUILT
            <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
                  style={{ fontSize: "0.42em", background: C.orange, padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}>
              AI
            </span>
          </span>
        </div>
      </header>

      {/* ── 1. NOT CONFIRMED YET — the page's one job is the thumbs-up reply ── */}
      <section className="relative flex flex-col justify-center pt-28 pb-8 px-4 sm:px-6 overflow-hidden" style={{ background: C.bg }}>
        <div className="relative max-w-4xl mx-auto w-full text-center">
          {/* amber, not green: something is still owed */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-7 text-sm font-bold"
            style={{ background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" }}>
            <AlertCircle className="w-4 h-4" aria-hidden="true" /> One step left
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}
            className="font-extrabold tracking-tight mb-5"
            style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em",
                     fontSize: "clamp(1.5rem, 4.5vw, 2.9rem)", lineHeight: 1.1, textWrap: "balance" }}>
            {name ? `${name}, your call ` : "Your call "}
            <span style={{ color: "#B45309" }}>isn&rsquo;t confirmed yet.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg leading-relaxed max-w-xl mx-auto mb-9" style={{ color: C.muted }}>
            You&rsquo;ve booked your call with FieldBuilt. Check your email for the
            appointment details, then watch the short briefing below so you know
            what we&rsquo;ll cover.
          </motion.p>

          {/* details */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.55 }}
            className="rounded-2xl overflow-hidden text-left mb-7 max-w-2xl mx-auto"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            {[
              { icon: Video, k: "Where", v: "Google Meet call. The link has been sent to your email" },
              { icon: Clock, k: "Duration", v: "15 to 30 minutes" },
              { icon: Calendar, k: "Date & time", v: timeValid
                  ? parsed!.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
                  : timeRaw || "Check your email for the confirmed time slot" },
            ].map((row, i) => (
              <div key={row.k} className="flex items-start gap-3.5 px-5 sm:px-6 py-4"
                   style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                <row.icon className="w-4.5 h-4.5 mt-0.5 shrink-0" style={{ color: C.orangeDk }} aria-hidden="true" />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
                       style={{ color: C.muted, fontFamily: "var(--font-jetbrains)" }}>{row.k}</div>
                  <div className="text-[15px] leading-snug" style={{ color: C.text }}>{row.v}</div>
                </div>
              </div>
            ))}
          </motion.div>

          {timeValid && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mb-7 -mt-2">
              <a href={googleCalendarLink(parsed!)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 text-sm font-bold hover:underline underline-offset-4"
                 style={{ color: C.orangeDk }}>
                Add it to Google Calendar
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </motion.div>
          )}

          {/* setup line */}
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="text-base leading-relaxed max-w-xl mx-auto mb-9" style={{ color: C.muted }}>
            We&rsquo;re preparing a look at your service area and your path from a
            homeowner&rsquo;s first message to a booked measure and a signed quote.
          </motion.p>

          {/* THE micro-commitment — loudest element on the page */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.55 }}
            className="rounded-2xl px-6 py-7 text-left max-w-2xl mx-auto"
            style={{ background: "#FFFBEB", border: "1px solid #FCD34D", boxShadow: "0 12px 32px rgba(180,83,9,0.08)" }}>
            <div className="flex items-start gap-3.5">
              <MessageSquare className="w-5 h-5 mt-1 shrink-0" style={{ color: "#B45309" }} aria-hidden="true" />
              <div>
                <p className="text-base sm:text-lg font-bold leading-snug mb-2"
                   style={{ color: C.text, fontFamily: "var(--font-jakarta)" }}>
                  To secure your spot, reply to the confirmation text you just
                  received with a <span style={{ fontSize: "1.15em" }}>👍</span>
                </p>
                <p className="text-sm leading-relaxed mb-3" style={{ color: C.muted }}>
                  If we don&rsquo;t receive your confirmation, your call slot is released
                  to another flooring contractor automatically.
                </p>
                <p className="text-sm font-semibold" style={{ color: "#B45309" }}>
                  We only open a few of these calls each day, so please confirm right away.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 2. PRE-CALL BRIEFING ── */}
      <section className="relative pt-8 sm:pt-10 pb-16 sm:pb-20 px-4 sm:px-6" style={{ background: C.bg }}>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="font-extrabold tracking-tight mb-6"
              style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em",
                       fontSize: "clamp(1.6rem, 5.2vw, 2.25rem)", lineHeight: 1.15, textWrap: "balance" }}>
            Watch this before the call
          </h2>

          {/* TODO(flooring pivot): HVAC-era video, needs re-recording for flooring. */}
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            {/* Wistia web component, rendered via createElement so the custom
                tag needs no JSX intrinsic-element declaration. */}
            {createElement("wistia-player", {
              "media-id": WISTIA_ID,
              seo: "false",
              aspect: "1.5434083601286173",
              style: { display: "block" },
            })}
          </div>

          <p className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto mt-8" style={{ color: C.muted }}>
            On the call we&rsquo;ll look at your service area, your crews, and where
            measures and quotes are slipping today. Then we&rsquo;ll talk through{" "}
            <strong style={{ color: C.text }}>
              guaranteed 20 in-home measures in 60 days, and every quote chased until it signs or says no.
            </strong>
          </p>
        </div>
      </section>

      {/* ── 3. WHAT HE'LL SEE ON THE CALL ── */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-6" style={{ background: C.subtle, borderTop: `1px solid ${C.border}` }}>
        <div className="relative max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="w-8 h-px" style={{ background: C.orange }} />
              <span className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: C.orangeDk, fontFamily: "var(--font-jetbrains)" }}>What you&rsquo;ll see</span>
              <span className="w-8 h-px" style={{ background: C.orange }} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5"
                style={{ color: C.text, fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}>
              From a homeowner&rsquo;s first message
              <br />to a signed quote.
            </h2>
            <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: C.muted }}>
              Not slides. The same kind of AI that texted you a minute ago, walking a
              homeowner from the first hello to a booked measure. Everything below is
              an example.
            </p>
          </div>

          <TourItem index="01 · The AI"
            title="Every homeowner answered in seconds, qualified, and booked."
            caption="8:17 on a Tuesday night with the shop closed. It says it's an AI, asks what your best salesperson would ask, never quotes a price, and checks that everyone who decides will be home.">
            <SmsThreadMockup />
            <div className="max-w-md mx-auto mt-6 rounded-2xl p-5 space-y-3"
                 style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              {[
                { icon: Bell,   text: "Confirmation sent, day-before reminder scheduled" },
                { icon: Repeat, text: "If she'd gone quiet, it would have followed up by text and phone" },
              ].map((r) => (
                <div key={r.text} className="flex items-start gap-3">
                  <r.icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.orangeDk }} aria-hidden="true" />
                  <span className="text-sm leading-snug" style={{ color: C.text }}>{r.text}</span>
                </div>
              ))}
            </div>
          </TourItem>

          <TourItem index="02 · The measure file"
            title="You know the job before you leave the shop."
            caption="The AI takes notes while it talks and saves them with the measure: project, rooms, timeline, ZIP, and who'll be home.">
            <MeasureFileMockup />
          </TourItem>

          <TourItem index="03 · The estimator's day"
            title="Measures worth the drive, on your calendar."
            caption="Every measure on the board was checked first. Confirmed, reminded, and with the decision makers home.">
            <EstimatorDayMockup />
          </TourItem>

          <TourItem index="04 · The quote"
            title="And every quote chased until it signs or says no."
            caption="Text, call and email after the measure. No more quotes going quiet in a pile nobody checks.">
            <QuoteChasePreview caption="Every quote gets followed up until there's an answer." />
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
