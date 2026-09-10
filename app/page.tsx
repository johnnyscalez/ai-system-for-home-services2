"use client"

// ─────────────────────────────────────────────────────────────────────────────
// FIELDBUILT — the brand experience site.
// The page is the ten minutes between an inquiry and a booked job.
// It opens at 9:04 PM in the owner's office (the trap), hands off to the same
// minute with the system installed (the replay), and ends as a receipt.
// Design law: warm off-white ground, deep ink, ONE orange accent, timestamps
// as typography, no chrome shadows (surface + hairlines carry elevation),
// weight ladder 400/600/800, mono reserved for genuine data only.
// ─────────────────────────────────────────────────────────────────────────────

import { motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion } from "framer-motion"
import { useRef, useState } from "react"
import Link from "next/link"

const C = {
  paper:   "#FAFAF8",
  white:   "#FFFFFF",
  ink:     "#1C1917",
  night:   "#1A1614",
  nightUp: "#241F1B",
  muted:   "#78716C",
  faint:   "#A8A29E",
  line:    "#E7E5E4",
  parch:   "#F5F4F2",
  orange:  "#F97316",
  orangeD: "#EA580C",
} as const

const jakarta = "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif"
const mono = "var(--font-jetbrains), 'JetBrains Mono', monospace"

// Up-right arrow, drawn for this system (rounded caps, matches hairline weight)
function ArrowUpRight({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.2 10.8 10.8 3.2M4.6 3.2h6.2v6.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// The one pill CTA of the system. Fill deepens on hover; nothing moves.
function PillCta({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      href="/book"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: hover ? C.orangeD : C.orange,
        color: "#FFF7F0",
        fontFamily: jakarta, fontWeight: 600, fontSize: 16,
        padding: "16px 30px", borderRadius: 999,
        transition: "background 180ms ease",
        border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(234,88,12,0.25)",
      }}
    >
      {children}
      <ArrowUpRight color="#FFF7F0" />
    </Link>
  )
}

// A ruled ledger row — the receipt grammar used across the whole page.
function LedgerRow({ label, value, strong = false, dark = false, sub }: {
  label: string; value?: string; strong?: boolean; dark?: boolean; sub?: string
}) {
  const inkC = dark ? "#F3EFEA" : C.ink
  const mutedC = dark ? "rgba(243,239,234,0.55)" : C.muted
  return (
    <div style={{ borderTop: `1px solid ${dark ? "rgba(243,239,234,0.14)" : C.line}`, padding: "18px 2px", display: "flex", alignItems: "baseline", gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: jakarta, fontWeight: strong ? 800 : 600, fontSize: strong ? 19 : 16.5, color: inkC, lineHeight: 1.45 }}>{label}</p>
        {sub && <p style={{ fontFamily: "inherit", fontWeight: 400, fontSize: 14.5, color: mutedC, marginTop: 5, lineHeight: 1.55, maxWidth: 560 }}>{sub}</p>}
      </div>
      {value && (
        <span style={{ fontFamily: mono, fontSize: strong ? 26 : 17, fontWeight: strong ? 700 : 400, color: strong ? C.orangeD : inkC, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
          {value}
        </span>
      )}
    </div>
  )
}

// Timestamp stamp — the typographic motif. Mono because it is genuine data.
function Stamp({ t, dark = false, accent = false }: { t: string; dark?: boolean; accent?: boolean }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: 12.5, letterSpacing: "0.06em",
      color: accent ? C.orangeD : dark ? "rgba(243,239,234,0.55)" : C.muted,
      fontVariantNumeric: "tabular-nums",
    }}>{t}</span>
  )
}

// ── The replay thread: the real shape of a real booked conversation ──────────
const THREAD: { t: string; who: "sys" | "lead"; text: string }[] = [
  { t: "7:07:03 PM", who: "lead", text: "Yes, interested. It's a house, one furnace. Honestly can't remember the last time the ducts were done." },
  { t: "7:07:09 PM", who: "sys",  text: "Good to know, most homes we open up are the same. What's your ZIP code so I can check who covers your area?" },
  { t: "7:08:41 PM", who: "lead", text: "60007" },
  { t: "7:08:46 PM", who: "sys",  text: "You're in the service area. Normally if it's been more than 3 years we recommend the full system cleaning, $189 per furnace. That includes supply vents, cold air returns, basic furnace cleaning, deodorizer, and dryer vent cleaning, ground level side wall exit only." },
  { t: "7:10:22 PM", who: "lead", text: "Ok let's do it. When can you come?" },
  { t: "7:10:30 PM", who: "sys",  text: "We have Saturday with an arrival window of 3 to 6pm. Would you like to set it up? I'll need your full street address." },
  { t: "7:12:58 PM", who: "lead", text: "Saturday works. 1418 Berkley Ln, Elk Grove Village" },
  { t: "7:13:05 PM", who: "sys",  text: "Just to double check before I lock it in, Saturday, 3 to 6pm, at 1418 Berkley Ln, for the $189 full system cleaning. Sounds good?" },
  { t: "7:16:44 PM", who: "lead", text: "Yes" },
  { t: "7:17:01 PM", who: "sys",  text: "You're all set. Our technician will text you about 30 minutes before arrival, and you'll get a reminder the day before. Please make sure the vents are accessible." },
]

// ── The trap: the same evening without the system ────────────────────────────
const TRAP: { t: string; text: string; deadEnd?: boolean }[] = [
  { t: "9:04:12 PM", text: "Incoming call. Office closed two hours ago." },
  { t: "9:04:41 PM", text: "Rings out. Voicemail." },
  { t: "9:05:58 PM", text: "No message left. They never leave one." },
  { t: "9:07 PM",    text: "The customer calls the next company on Google." },
  { t: "8:12 AM",    text: "Your office calls back the number." },
  { t: "8:13 AM",    text: "“We went with someone else. They answered.”", deadEnd: true },
]

export default function Home() {
  const reduce = useReducedMotion()

  // Scroll-linked clock over the replay: 7:07 PM → 7:17 PM as you scroll.
  const replayRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: replayRef, offset: ["start 0.7", "end 0.55"] })
  const [clock, setClock] = useState("7:07 PM")
  const minute = useTransform(scrollYProgress, [0, 1], [7 * 60 + 7, 7 * 60 + 17])
  useMotionValueEvent(minute, "change", (v) => {
    const m = Math.min(17, Math.max(7, Math.round(v)))
    setClock(`7:${String(m).padStart(2, "0")} PM`)
  })
  const railDot = useTransform(scrollYProgress, [0, 1], ["2%", "98%"])

  // Gentle parallax on the night headline (transform on visible content only)
  const nightRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: nightP } = useScroll({ target: nightRef, offset: ["start start", "end start"] })
  const nightDrift = useTransform(nightP, [0, 1], [0, reduce ? 0 : -46])

  return (
    <main style={{ background: C.paper, color: C.ink, fontFamily: "var(--font-inter), Inter, sans-serif", overflowX: "clip" }}>
      <style>{`
        @media (max-width: 600px) {
          .fb-nav-login { display: none !important; }
          .fb-nav-cta { padding: 9px 16px !important; font-size: 13px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { scroll-behavior: auto !important; }
        }
      `}</style>

      {/* ── NAV — quiet, floating on the night, one action ─────────────────── */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, pointerEvents: "none" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ pointerEvents: "auto", fontFamily: jakarta, fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: "#F3EFEA", mixBlendMode: "difference" }}>
            FIELDBUILT
          </Link>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 22 }}>
            <Link href="/login" className="fb-nav-login" style={{ fontSize: 14, fontWeight: 600, color: "#F3EFEA", mixBlendMode: "difference", opacity: 0.75 }}>Log in</Link>
            <Link href="/book" className="fb-nav-cta" style={{
              fontFamily: jakarta, fontWeight: 600, fontSize: 14, color: "#FFF7F0",
              background: C.orange, padding: "10px 20px", borderRadius: 999,
            }}>
              Book a discovery call
            </Link>
          </div>
        </div>
      </header>

      {/* ══ 1 · THE NIGHT — 9:04 PM, the owner's desk ═══════════════════════ */}
      <section ref={nightRef} style={{ background: C.night, color: "#F3EFEA", position: "relative", minHeight: "100svh", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
        {/* the desk lamp: one directional warm light, top right, real falloff */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(1100px 700px at 82% -8%, rgba(249,115,22,0.13), rgba(249,115,22,0.045) 42%, transparent 68%)",
        }} />
        {/* film grain, behind content, felt not seen */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, opacity: 0.05, mixBlendMode: "overlay",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
        }} />

        <motion.div style={{ y: nightDrift, position: "relative", maxWidth: 1180, margin: "0 auto", padding: "140px 28px 90px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 34 }}>
            <span style={{ fontFamily: mono, fontSize: 15, color: C.orange, letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}>9:04 PM</span>
            <span style={{ fontFamily: mono, fontSize: 12.5, color: "rgba(243,239,234,0.55)", letterSpacing: "0.06em" }}>TUESDAY · OFFICE CLOSED</span>
          </div>

          <h1 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(38px, 6.2vw, 74px)", lineHeight: 1.04, letterSpacing: "-0.025em", maxWidth: 900, margin: 0 }}>
            You built the company.<br />You're still answering its phone.
          </h1>

          <p style={{ fontSize: "clamp(16px, 1.6vw, 19px)", lineHeight: 1.65, color: "rgba(243,239,234,0.72)", maxWidth: 640, marginTop: 28 }}>
            You run a residential HVAC company. Four trucks or more, a million-plus a year.
            You came off the tools and built the hard part. And it's 9 PM and the phone that's
            lighting up is yours, because if you don't take it, nobody does.
          </p>

          {/* the trap, told as a call log — the enemy has timestamps */}
          <div style={{ marginTop: 64, maxWidth: 640 }}>
            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.1em", color: "rgba(243,239,234,0.45)", marginBottom: 10 }}>
              CALL LOG · THE LEAD YOU ALREADY PAID FOR
            </p>
            {TRAP.map((row) => (
              <div key={row.t + row.text} style={{ display: "flex", gap: 20, alignItems: "baseline", borderTop: "1px solid rgba(243,239,234,0.13)", padding: "13px 2px" }}>
                <span style={{ fontFamily: mono, fontSize: 13, color: row.deadEnd ? C.orange : "rgba(243,239,234,0.5)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", minWidth: 86 }}>{row.t}</span>
                <span style={{ fontSize: 15.5, lineHeight: 1.5, color: row.deadEnd ? "#F3EFEA" : "rgba(243,239,234,0.78)", fontWeight: row.deadEnd ? 600 : 400 }}>{row.text}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(243,239,234,0.13)" }} />
          </div>

          <p style={{ marginTop: 44, fontSize: "clamp(17px, 1.8vw, 21px)", lineHeight: 1.6, color: "#F3EFEA", maxWidth: 620, fontWeight: 600, fontFamily: jakarta }}>
            That call cost you real money to make ring. The leak isn't your marketing.
            It's the minutes after the phone rings when nobody can answer.
          </p>
        </motion.div>

        {/* seam: night dissolves into paper — one continuous surface */}
        <div aria-hidden="true" style={{ position: "relative", height: 220, background: `linear-gradient(to bottom, ${C.night} 0%, #221C18 14%, #2E2620 28%, #46392F 42%, #6B5847 55%, #94806B 66%, #BBAA95 76%, #D9CEBF 85%, #EFE9DE 93%, ${C.paper} 100%)` }} />
      </section>

      {/* ══ 2 · THE REPLAY — same evening, system installed ═════════════════ */}
      <section ref={replayRef} style={{ position: "relative", padding: "40px 0 30px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "10px 26px", marginBottom: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 15, color: C.orangeD, letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}>{clock}</span>
            <span style={{ fontFamily: mono, fontSize: 12.5, color: C.faint, letterSpacing: "0.06em" }}>SAME EVENING · SYSTEM INSTALLED</span>
          </div>

          <h2 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(30px, 4.2vw, 52px)", letterSpacing: "-0.02em", lineHeight: 1.08, maxWidth: 760 }}>
            This lead came in at 7:07 PM.<br />Watch what ten minutes did.
          </h2>
          <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.6, color: C.muted, maxWidth: 560 }}>
            A real conversation shape from a live account, office closed, nobody on the phone.
            Scroll it the way it happened.
          </p>

          {/* thread on the time rail */}
          <div style={{ display: "flex", gap: "clamp(18px, 4vw, 56px)", marginTop: 54 }}>
            {/* the rail: rounded caps, a dot that rides the scroll */}
            <div aria-hidden="true" style={{ position: "relative", width: 4, borderRadius: 999, background: C.line, alignSelf: "stretch", marginTop: 6, marginBottom: 6 }}>
              <motion.div style={{
                position: "absolute", top: reduce ? "2%" : railDot, left: "50%", transform: "translateX(-50%)",
                width: 12, height: 12, borderRadius: 999, background: C.orange, border: `3px solid ${C.paper}`,
              }} />
            </div>

            <div style={{ flex: 1, maxWidth: 760 }}>
              {THREAD.map((m) => (
                <div key={m.t} style={{ marginBottom: 26, display: "flex", flexDirection: "column", alignItems: m.who === "lead" ? "flex-start" : "flex-end" }}>
                  <Stamp t={m.t} accent={m.t.startsWith("7:17")} />
                  <div style={{
                    marginTop: 7, maxWidth: 520, padding: "14px 18px", fontSize: 15.5, lineHeight: 1.55,
                    background: m.who === "lead" ? C.white : C.ink,
                    color: m.who === "lead" ? C.ink : "#F5F2EE",
                    border: m.who === "lead" ? `1px solid ${C.line}` : "1px solid transparent",
                    borderRadius: m.who === "lead" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}

              {/* what the system did underneath, as a job ticket */}
              <div style={{ marginTop: 40, background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 15.5 }}>Booked job · written to the CRM</span>
                  <Stamp t="7:17:01 PM" accent />
                </div>
                <div style={{ padding: "6px 22px 16px" }}>
                  {[
                    ["Qualified by the company's rules", "ZIP in area · job type · urgency"],
                    ["Routed to the right technician", "the one who covers 60007"],
                    ["Booked against real availability", "Saturday · arrival 3 to 6 PM"],
                    ["Confirmation and reminders scheduled", "day before · 30 minutes out"],
                  ].map(([a, b]) => (
                    <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "baseline", padding: "11px 0", borderTop: `1px solid ${C.parch}` }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{a}</span>
                      <span style={{ fontFamily: mono, fontSize: 12.5, color: C.muted, textAlign: "right", letterSpacing: "0.02em" }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p style={{ marginTop: 34, fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(20px, 2.4vw, 26px)", letterSpacing: "-0.015em", lineHeight: 1.3 }}>
                Ten minutes. Zero people. The customer never met the voicemail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 3 · THE RECEIPT — nine days on one account ══════════════════════ */}
      <section style={{ padding: "110px 0 30px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "60px 80px", alignItems: "start" }}>
          <div>
            <h2 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(28px, 3.6vw, 44px)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              This site isn't a promise.<br />It's a receipt.
            </h2>
            <p style={{ marginTop: 18, fontSize: 16.5, lineHeight: 1.65, color: C.muted, maxWidth: 460 }}>
              Nine days on one live HVAC account. Every number below is a row in that
              company's own CRM, with a timestamp on it. We read every message the
              system has ever sent.
            </p>
          </div>

          <div>
            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.1em", color: C.muted, marginBottom: 6 }}>NINE DAYS · ONE ACCOUNT</p>
            <LedgerRow label="Leads in" value="130" />
            <LedgerRow label="Cold leads worked" value="77" />
            <LedgerRow label="Booked jobs on the calendar" value="13" strong />
            <div style={{ borderTop: `1px solid ${C.line}` }} />

            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.1em", color: C.muted, margin: "44px 0 6px" }}>THE FIRST 24 HOURS</p>
            <LedgerRow label="Leads answered" value="27" />
            <LedgerRow label="Conversations held" value="14" />
            <LedgerRow label="Jobs on the calendar" value="3" strong />
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ══ 4 · WHAT WE INSTALL — the packaging, verbatim ═══════════════════ */}
      <section style={{ padding: "120px 0 20px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 28px" }}>
          <h2 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(30px, 4.4vw, 54px)", letterSpacing: "-0.022em", lineHeight: 1.1 }}>
            We install the operating system that runs your HVAC business 24/7 without you.
          </h2>

          <p style={{ marginTop: 40, fontFamily: jakarta, fontWeight: 600, fontSize: 17, color: C.ink }}>Here's what happens:</p>
          <div style={{ marginTop: 10 }}>
            <LedgerRow label="Every call, text, form, and missed call gets an immediate response." />
            <LedgerRow label="Every inquiry gets qualified by your rules." sub="ZIP code, job type, urgency, service area." />
            <LedgerRow label="Every qualified opportunity gets routed to the right technician." />
            <LedgerRow label="Every appointment gets booked with availability checks." />
            <LedgerRow label="Every exception gets escalated to you." />
            <LedgerRow label="Every lead gets logged in your CRM." />
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ══ 5 · WHAT IT WILL NEVER DO — the control block, inset island ═════ */}
      <section style={{ padding: "110px 28px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", background: C.parch, borderRadius: 24, padding: "clamp(34px, 5vw, 64px)", border: `1px solid ${C.line}` }}>
          <h2 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(24px, 3vw, 34px)", letterSpacing: "-0.018em", lineHeight: 1.15 }}>
            Just as important: what it is not allowed to do.
          </h2>
          <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.6, color: C.muted, maxWidth: 560 }}>
            It follows your rules. It does not make decisions for you.
          </p>
          <div style={{ marginTop: 26 }}>
            {[
              ["It never diagnoses.", "What's wrong with the equipment is your technician's call, on site."],
              ["It never invents a price.", "It quotes only the prices you set, exactly as you set them."],
              ["It never books outside your rules.", "Out of area, wrong job type, no availability: it doesn't force it, it flags it."],
              ["It never handles an emergency.", "Gas, smoke, or carbon monoxide: the caller is told to hang up and call 911."],
              ["It never pretends to be a person.", "It identifies itself honestly, every time."],
              ["It never leaves you out of the loop.", "Exceptions escalate to a human, by your rules, with the whole thread attached."],
            ].map(([a, b]) => (
              <LedgerRow key={a as string} label={a as string} sub={b as string} />
            ))}
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ══ 6 · THE ONE-SENTENCE POSITION ═══════════════════════════════════ */}
      <section style={{ padding: "60px 0 120px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 28px" }}>
          <p style={{ fontFamily: jakarta, fontWeight: 600, fontSize: "clamp(17px, 2vw, 22px)", lineHeight: 1.6, color: C.muted, letterSpacing: "-0.01em" }}>
            Not an AI receptionist. Not a lead gen agency. Not another dispatch software.
          </p>
          <p style={{ marginTop: 14, fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(30px, 4.6vw, 54px)", lineHeight: 1.12, letterSpacing: "-0.022em", color: C.ink }}>
            The operating system between an inquiry and <span style={{ color: C.orangeD }}>a booked job.</span>
          </p>
        </div>
      </section>

      {/* ══ 7 · THE RESULT + PRICING — back to the night, lamp off ══════════ */}
      <section style={{ position: "relative", color: "#F3EFEA" }}>
        <div aria-hidden="true" style={{ height: 220, background: `linear-gradient(to bottom, ${C.paper} 0%, #EFE9DE 7%, #D9CEBF 15%, #BBAA95 24%, #94806B 34%, #6B5847 45%, #46392F 58%, #2E2620 72%, #221C18 86%, ${C.night} 100%)` }} />
        <div style={{ position: "relative", background: C.night, overflow: "hidden" }}>
        {/* dusk light: the van outside, engine off — cooler, dimmer than the opening lamp */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(900px 600px at 12% 108%, rgba(249,115,22,0.10), rgba(249,115,22,0.03) 45%, transparent 70%)",
        }} />
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, opacity: 0.05, mixBlendMode: "overlay",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
        }} />

        <div style={{ position: "relative", maxWidth: 860, margin: "0 auto", padding: "130px 28px 120px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 30 }}>
            <span style={{ fontFamily: mono, fontSize: 15, color: C.orange, letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}>5:02 PM</span>
            <span style={{ fontFamily: mono, fontSize: 12.5, color: "rgba(243,239,234,0.55)", letterSpacing: "0.06em" }}>FRIDAY · YOU LEFT AT FIVE</span>
          </div>

          <h2 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(30px, 4.4vw, 52px)", letterSpacing: "-0.022em", lineHeight: 1.08, maxWidth: 720 }}>
            Leave at 5.<br />Every lead answered anyway.
          </h2>

          <p style={{ marginTop: 34, fontFamily: jakarta, fontWeight: 600, fontSize: 17, color: "#F3EFEA" }}>The result:</p>
          <div style={{ marginTop: 8, maxWidth: 680 }}>
            <LedgerRow dark label="You stop losing $66K-$231K per year to missed calls and bad bookings." />
            <LedgerRow dark label="You free up 10-15 hours per week of owner and admin time." />
            <LedgerRow dark label="You can leave the business without it falling apart." />
            <LedgerRow dark label="You can scale safely." />
            <div style={{ borderTop: "1px solid rgba(243,239,234,0.14)" }} />
          </div>

          <div style={{ marginTop: 66, maxWidth: 680 }}>
            <p style={{ fontFamily: jakarta, fontWeight: 600, fontSize: 17, color: "#F3EFEA", marginBottom: 8 }}>What it costs:</p>
            <LedgerRow dark label="One-time installation" sub="Scope-dependent, can be higher or lower based on complexity." value="$5,997" strong />
            <LedgerRow dark label="Optional ongoing optimization" value="$200-500/mo" />
            <div style={{ borderTop: "1px solid rgba(243,239,234,0.14)" }} />
          </div>

          <div style={{ marginTop: 70 }}>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(243,239,234,0.85)", maxWidth: 560, marginBottom: 26 }}>
              Ready to see if it works for your business?
            </p>
            <PillCta dark>Book a 15-minute discovery call</PillCta>
            <p style={{ marginTop: 16, fontSize: 15, color: "rgba(243,239,234,0.6)" }}>
              We'll show you exactly where you're losing money.
            </p>
          </div>
        </div>

        {/* ── FOOTER — the wordmark owns the bottom edge ──────────────────── */}
        <div style={{ position: "relative", borderTop: "1px solid rgba(243,239,234,0.1)" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "34px 28px 0", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <span style={{ fontSize: 13.5, color: "rgba(243,239,234,0.5)" }}>© {new Date().getFullYear()} FieldBuilt</span>
            <div style={{ display: "flex", gap: 26 }}>
              <Link href="/privacy" style={{ fontSize: 13.5, color: "rgba(243,239,234,0.6)" }}>Privacy</Link>
              <Link href="/terms" style={{ fontSize: 13.5, color: "rgba(243,239,234,0.6)" }}>Terms</Link>
              <Link href="/login" style={{ fontSize: 13.5, color: "rgba(243,239,234,0.6)" }}>Log in</Link>
            </div>
          </div>
          <div aria-hidden="true" style={{ overflow: "hidden", marginTop: 20 }}>
            <p style={{
              fontFamily: jakarta, fontWeight: 800, letterSpacing: "0.015em",
              fontSize: "clamp(84px, 15.8vw, 230px)", lineHeight: 1,
              color: "rgba(243,239,234,0.08)",
              textAlign: "center", whiteSpace: "nowrap",
              transform: "translateY(0.22em)",
              margin: 0,
            }}>
              FIELDBUILT
            </p>
          </div>
        </div>
      </div>
      </section>
    </main>
  )
}
