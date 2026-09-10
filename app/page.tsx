"use client"

// ─────────────────────────────────────────────────────────────────────────────
// FIELDBUILT — offer-first site for HVAC owners.
// Structure: the claim → the leak → what happens → proof (thread + receipts) →
// what you get installed → what it never does → who it's for → pricing → ask.
// Warm off-white, deep ink, one orange accent, mono for real data only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import Link from "next/link"

const C = {
  paper:   "#FAFAF8",
  white:   "#FFFFFF",
  ink:     "#1C1917",
  night:   "#1A1614",
  muted:   "#78716C",
  line:    "#E7E5E4",
  parch:   "#F5F4F2",
  orange:  "#F97316",
  orangeD: "#EA580C",
} as const

const jakarta = "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif"
const mono = "var(--font-jetbrains), 'JetBrains Mono', monospace"

function ArrowUpRight({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.2 10.8 10.8 3.2M4.6 3.2h6.2v6.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PillCta({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      href="/book"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: hover ? C.orangeD : C.orange, color: "#FFF7F0",
        fontFamily: jakarta, fontWeight: 600, fontSize: 16.5,
        padding: "16px 30px", borderRadius: 999,
        transition: "background 180ms ease",
      }}
    >
      {children}
      <ArrowUpRight color="#FFF7F0" />
    </Link>
  )
}

function SectionTitle({ children, max = 780 }: { children: React.ReactNode; max?: number }) {
  return (
    <h2 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(28px, 3.8vw, 44px)", letterSpacing: "-0.02em", lineHeight: 1.12, maxWidth: max }}>
      {children}
    </h2>
  )
}

function LedgerRow({ label, value, sub, strong = false, dark = false }: {
  label: string; value?: string; sub?: string; strong?: boolean; dark?: boolean
}) {
  const inkC = dark ? "#F3EFEA" : C.ink
  const mutedC = dark ? "rgba(243,239,234,0.6)" : C.muted
  return (
    <div style={{ borderTop: `1px solid ${dark ? "rgba(243,239,234,0.14)" : C.line}`, padding: "17px 2px", display: "flex", alignItems: "baseline", gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: jakarta, fontWeight: strong ? 800 : 600, fontSize: strong ? 19 : 16.5, color: inkC, lineHeight: 1.45 }}>{label}</p>
        {sub && <p style={{ fontWeight: 400, fontSize: 14.5, color: mutedC, marginTop: 5, lineHeight: 1.6, maxWidth: 600 }}>{sub}</p>}
      </div>
      {value && (
        <span style={{ fontFamily: mono, fontSize: strong ? 26 : 17, fontWeight: strong ? 700 : 400, color: strong ? C.orangeD : inkC, whiteSpace: "nowrap", letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
      )}
    </div>
  )
}

// The replay thread — the real shape of a real booked conversation, office closed.
const THREAD: { t: string; who: "sys" | "lead"; text: string }[] = [
  { t: "7:07 PM", who: "lead", text: "Yes, interested. It's a house, one furnace. Can't remember the last time the ducts were done." },
  { t: "7:07 PM", who: "sys",  text: "Good to know, most homes we open up are the same. What's your ZIP code so I can check who covers your area?" },
  { t: "7:08 PM", who: "lead", text: "60007" },
  { t: "7:08 PM", who: "sys",  text: "You're in the service area. Normally if it's been more than 3 years we recommend the full system cleaning, $189 per furnace. That includes supply vents, cold air returns, basic furnace cleaning, deodorizer, and dryer vent cleaning, ground level side wall exit only." },
  { t: "7:10 PM", who: "lead", text: "Ok let's do it. When can you come?" },
  { t: "7:10 PM", who: "sys",  text: "We have Saturday with an arrival window of 3 to 6pm. Would you like to set it up? I'll need your full street address." },
  { t: "7:12 PM", who: "lead", text: "Saturday works. 1418 Berkley Ln, Elk Grove Village" },
  { t: "7:13 PM", who: "sys",  text: "Just to double check before I lock it in, Saturday, 3 to 6pm, at 1418 Berkley Ln, for the $189 full system cleaning. Sounds good?" },
  { t: "7:16 PM", who: "lead", text: "Yes" },
  { t: "7:17 PM", who: "sys",  text: "You're all set. Our technician will text you about 30 minutes before arrival, and you'll get a reminder the day before. Please make sure the vents are accessible." },
]

const WHAT_HAPPENS: { line: string; outcome: string }[] = [
  { line: "Every call, text, form, and missed call gets an immediate response.",
    outcome: "The 9 PM lead gets answered at 9 PM. No voicemail, no callback queue, no \"we went with someone else.\"" },
  { line: "Every inquiry gets qualified by your rules.",
    outcome: "ZIP code, job type, urgency, service area. Out-of-area tire kickers never reach your dispatcher's desk." },
  { line: "Every qualified opportunity gets routed to the right technician.",
    outcome: "The tech who covers that ZIP and does that job type. Not whoever happens to be free." },
  { line: "Every appointment gets booked with availability checks.",
    outcome: "Real openings on real calendars. No double-bookings, no jobs promised on a day your crew is full." },
  { line: "Every exception gets escalated to you.",
    outcome: "Anything outside your rules lands on your phone with the whole thread attached. You decide, once." },
  { line: "Every lead gets logged in your CRM.",
    outcome: "Housecall Pro, ServiceTitan, whatever you run. Your data, your system, the full journey visible." },
]

const INSTALL_SCOPE: string[] = [
  "Response workflows built around how your company actually runs",
  "Voice and SMS handling",
  "Missed-call and web-lead recovery",
  "Qualification and exclusion rules",
  "ZIP and service-area logic",
  "Job-type and urgency classification",
  "Technician routing",
  "Availability and booking flow",
  "Confirmation, reminder, reschedule and cancellation paths",
  "CRM logging and lead-status structure",
  "Human escalation rules",
  "Test scenarios and QA before it touches a real customer",
  "Documentation and staff handoff",
  "A released system your company owns",
]

export default function Home() {
  return (
    <main style={{ background: C.paper, color: C.ink, fontFamily: "var(--font-inter), Inter, sans-serif", overflowX: "clip" }}>
      <style>{`
        @media (max-width: 600px) {
          .fb-nav-login { display: none !important; }
          .fb-nav-cta { padding: 9px 16px !important; font-size: 13px !important; }
        }
      `}</style>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(250,250,248,0.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: C.ink }}>FIELDBUILT</Link>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Link href="/login" className="fb-nav-login" style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>Log in</Link>
            <Link href="/book" className="fb-nav-cta" style={{ fontFamily: jakarta, fontWeight: 600, fontSize: 14, color: "#FFF7F0", background: C.orange, padding: "10px 20px", borderRadius: 999 }}>
              Book a discovery call
            </Link>
          </div>
        </div>
      </header>

      {/* ── 1 · THE CLAIM ────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(60px, 9vw, 110px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px" }}>
          <h1 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(38px, 5.6vw, 68px)", lineHeight: 1.05, letterSpacing: "-0.025em", maxWidth: 880, margin: 0 }}>
            Stop losing money on calls you already paid for.
          </h1>
          <p style={{ fontSize: "clamp(17px, 1.8vw, 20px)", lineHeight: 1.6, color: C.muted, maxWidth: 660, marginTop: 24 }}>
            You run a residential HVAC company. Four or more technicians, a million-plus a year.
            Your ads and your reputation already make the phone ring. The problem is what happens
            when it rings at 9 PM, or while your dispatcher is on the other line.
          </p>
          <p style={{ fontFamily: jakarta, fontWeight: 700, fontSize: "clamp(18px, 2vw, 22px)", lineHeight: 1.5, maxWidth: 660, marginTop: 20 }}>
            We install the operating system that runs your HVAC business 24/7 without you.
          </p>
          <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <PillCta>Book a 15-minute discovery call</PillCta>
            <span style={{ fontSize: 14.5, color: C.muted }}>We&apos;ll show you exactly where you&apos;re losing money.</span>
          </div>
        </div>
      </section>

      {/* ── 2 · THE LEAK ─────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(80px, 10vw, 130px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "48px 72px", alignItems: "start" }}>
          <div>
            <SectionTitle>The voicemail-and-callback trap is quietly your most expensive employee.</SectionTitle>
            <p style={{ marginTop: 18, fontSize: 16.5, lineHeight: 1.65, color: C.muted, maxWidth: 520 }}>
              The call rings out after hours. The callback happens the next morning. By then the
              customer booked whoever answered first. You paid to make that phone ring, and the
              job went to a competitor who just picked up.
            </p>
            <p style={{ marginTop: 16, fontSize: 16.5, lineHeight: 1.65, color: C.ink, fontWeight: 600, maxWidth: 520 }}>
              Most HVAC companies your size are losing $66K-$231K per year to missed calls and bad
              bookings. Before you spend another dollar on lead generation, fix the operation
              that&apos;s losing the leads you already paid for. More leads won&apos;t fix a broken
              booking process.
            </p>
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 26px" }}>
            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.08em", color: C.muted, marginBottom: 4 }}>LAST NIGHT, AT EVERY SHOP WITHOUT COVERAGE</p>
            {[
              ["9:04 PM", "Incoming call. Office closed two hours ago."],
              ["9:04 PM", "Rings out. Voicemail. No message left."],
              ["9:07 PM", "The customer calls the next company on Google."],
              ["8:12 AM", "Your office calls back the number."],
              ["8:13 AM", "“We went with someone else. They answered.”"],
            ].map(([t, txt], i, arr) => (
              <div key={t + txt} style={{ display: "flex", gap: 18, alignItems: "baseline", borderTop: `1px solid ${C.parch}`, padding: "12px 0" }}>
                <span style={{ fontFamily: mono, fontSize: 13, color: i === arr.length - 1 ? C.orangeD : C.muted, minWidth: 66, fontVariantNumeric: "tabular-nums" }}>{t}</span>
                <span style={{ fontSize: 15, lineHeight: 1.5, fontWeight: i === arr.length - 1 ? 600 : 400 }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 · WHAT HAPPENS (the six lines, each with its outcome) ─────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 0 0" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 28px" }}>
          <SectionTitle>Here&apos;s what happens once it&apos;s installed.</SectionTitle>
          <div style={{ marginTop: 30 }}>
            {WHAT_HAPPENS.map((w) => (
              <LedgerRow key={w.line} label={w.line} sub={w.outcome} />
            ))}
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ── 4 · PROOF: the thread ────────────────────────────────────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "48px 72px", alignItems: "start" }}>
          <div>
            <SectionTitle>A lead came in at 7:07 PM. Booked, routed, and confirmed by 7:17.</SectionTitle>
            <p style={{ marginTop: 18, fontSize: 16.5, lineHeight: 1.65, color: C.muted, maxWidth: 500 }}>
              This is the real shape of a real conversation from a live HVAC account. Office closed,
              nobody on the phone. Ten minutes from first message to a job on the calendar.
            </p>
            <div style={{ marginTop: 30, background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 15 }}>Booked job · written to the CRM</span>
                <span style={{ fontFamily: mono, fontSize: 12.5, color: C.orangeD, fontVariantNumeric: "tabular-nums" }}>7:17 PM</span>
              </div>
              <div style={{ padding: "4px 20px 14px" }}>
                {[
                  ["Qualified by the company's rules", "ZIP in area · job type · urgency"],
                  ["Routed to the right technician", "the one who covers 60007"],
                  ["Booked against real availability", "Saturday · arrival 3 to 6 PM"],
                  ["Confirmation and reminders scheduled", "day before · 30 minutes out"],
                ].map(([a, b]) => (
                  <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", padding: "10px 0", borderTop: `1px solid ${C.parch}` }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{a}</span>
                    <span style={{ fontFamily: mono, fontSize: 12, color: C.muted, textAlign: "right" }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            {THREAD.map((m) => (
              <div key={m.t + m.text.slice(0, 12)} style={{ marginBottom: 18, display: "flex", flexDirection: "column", alignItems: m.who === "lead" ? "flex-start" : "flex-end" }}>
                <span style={{ fontFamily: mono, fontSize: 11.5, color: m.t === "7:17 PM" ? C.orangeD : C.muted, letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>{m.t}</span>
                <div style={{
                  marginTop: 5, maxWidth: 440, padding: "12px 16px", fontSize: 14.5, lineHeight: 1.5,
                  background: m.who === "lead" ? C.white : C.ink,
                  color: m.who === "lead" ? C.ink : "#F5F2EE",
                  border: m.who === "lead" ? `1px solid ${C.line}` : "1px solid transparent",
                  borderRadius: m.who === "lead" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5 · PROOF: the receipts ──────────────────────────────────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 28px 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", background: C.parch, border: `1px solid ${C.line}`, borderRadius: 24, padding: "clamp(30px, 4.5vw, 56px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "44px 72px", alignItems: "start" }}>
          <div>
            <SectionTitle max={440}>Numbers from a live account, not a brochure.</SectionTitle>
            <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.65, color: C.muted, maxWidth: 440 }}>
              Every number below is a row in that company&apos;s own CRM with a timestamp on it.
              This is what &quot;capturing the demand you already have&quot; looks like in practice.
            </p>
          </div>
          <div>
            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.08em", color: C.muted, marginBottom: 4 }}>NINE DAYS · ONE ACCOUNT</p>
            <LedgerRow label="Leads in" value="130" />
            <LedgerRow label="Cold leads worked" value="77" />
            <LedgerRow label="Booked jobs on the calendar" value="13" strong />
            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.08em", color: C.muted, margin: "36px 0 4px" }}>THE FIRST 24 HOURS</p>
            <LedgerRow label="Leads answered" value="27" />
            <LedgerRow label="Conversations held" value="14" />
            <LedgerRow label="Jobs on the calendar" value="3" strong />
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ── 6 · WHAT YOU GET (the install scope) ─────────────────────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px" }}>
          <SectionTitle>One installation. Everything configured to how your company runs.</SectionTitle>
          <p style={{ marginTop: 18, fontSize: 16.5, lineHeight: 1.65, color: C.muted, maxWidth: 640 }}>
            This is not software you log into and figure out. We build your rules into a tested
            system, prove it against real scenarios, hand it to your team, and release it.
            You own it.
          </p>
          <div style={{ marginTop: 34, columnWidth: 330, columnGap: 56 }}>
            {INSTALL_SCOPE.map((s) => (
              <div key={s} style={{ breakInside: "avoid", display: "flex", gap: 12, alignItems: "baseline", borderTop: `1px solid ${C.line}`, padding: "13px 2px" }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: C.orange, flexShrink: 0, position: "relative", top: -1 }} />
                <span style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.45 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7 · WHAT IT NEVER DOES ───────────────────────────────────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 0 0" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 28px" }}>
          <SectionTitle>It follows your rules. It doesn&apos;t make decisions for you.</SectionTitle>
          <div style={{ marginTop: 28 }}>
            {[
              ["It never diagnoses.", "What's wrong with the equipment is your technician's call, on site."],
              ["It never invents a price.", "It quotes only the prices you set, exactly as you set them."],
              ["It never books outside your rules.", "Out of area, wrong job type, no availability: it doesn't force it, it flags it."],
              ["It never handles an emergency.", "Gas, smoke, or carbon monoxide: the caller is told to hang up and call 911."],
              ["It never pretends to be a person.", "It identifies itself honestly, every time."],
              ["It never leaves you out of the loop.", "Exceptions escalate to a human, by your rules, with the whole thread attached."],
            ].map(([a, b]) => <LedgerRow key={a} label={a} sub={b} />)}
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ── 8 · POSITION + WHO IT'S FOR ──────────────────────────────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "48px 72px", alignItems: "start" }}>
          <div>
            <p style={{ fontFamily: jakarta, fontWeight: 600, fontSize: 17, lineHeight: 1.6, color: C.muted }}>
              Not an AI receptionist. Not a lead gen agency. Not another dispatch software.
            </p>
            <p style={{ marginTop: 12, fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(26px, 3.4vw, 40px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              The operating system between an inquiry and <span style={{ color: C.orangeD }}>a booked job.</span>
            </p>
            <p style={{ marginTop: 18, fontSize: 16, lineHeight: 1.65, color: C.muted, maxWidth: 480 }}>
              A receptionist answers the phone. A lead gen agency makes it ring more. Dispatch
              software manages the job after it&apos;s booked. None of them control what happens
              between the first call and the scheduled job. That gap is where the money leaks,
              and that gap is the only thing we do.
            </p>
          </div>
          <div>
            <p style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Built for you if:</p>
            <LedgerRow label="You run a residential HVAC company with 4+ technicians" />
            <LedgerRow label="You're doing roughly $1M+ a year" />
            <LedgerRow label="The phone already rings, and you know calls are slipping" />
            <LedgerRow label="You run Housecall Pro, ServiceTitan, or a CRM you actually use" />
            <div style={{ borderTop: `1px solid ${C.line}` }} />
            <p style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 17, margin: "34px 0 4px", color: C.muted }}>Not for you if:</p>
            <LedgerRow label="You're only looking for more leads" sub="Fix capture first. Then buying leads starts paying." />
            <LedgerRow label="The phone doesn't ring yet" sub="There's no demand to capture. We'd be selling you a bucket for a dry well." />
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ── 9 · RESULT + PRICING + ASK ───────────────────────────────────── */}
      <section style={{ marginTop: "clamp(90px, 11vw, 140px)", background: C.night, color: "#F3EFEA" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(70px, 8vw, 110px) 28px 90px" }}>
          <h2 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(30px, 4.2vw, 50px)", letterSpacing: "-0.022em", lineHeight: 1.1 }}>
            The result:
          </h2>
          <div style={{ marginTop: 24, maxWidth: 680 }}>
            <LedgerRow dark label="You stop losing $66K-$231K per year to missed calls and bad bookings." />
            <LedgerRow dark label="You free up 10-15 hours per week of owner and admin time." />
            <LedgerRow dark label="You can leave the business without it falling apart." />
            <LedgerRow dark label="You can scale safely." sub="When capture is fixed, every ad dollar you add converts instead of leaking." />
            <div style={{ borderTop: "1px solid rgba(243,239,234,0.14)" }} />
          </div>

          <p style={{ fontFamily: jakarta, fontWeight: 600, fontSize: 17, color: "#F3EFEA", margin: "56px 0 6px" }}>What it costs:</p>
          <div style={{ maxWidth: 680 }}>
            <LedgerRow dark label="One-time installation" sub="Scope-dependent, can be higher or lower based on complexity." value="$5,997" strong />
            <LedgerRow dark label="Optional ongoing optimization" value="$200-500/mo" />
            <div style={{ borderTop: "1px solid rgba(243,239,234,0.14)" }} />
          </div>
          <p style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.6, color: "rgba(243,239,234,0.6)", maxWidth: 620 }}>
            Compare that to what it replaces: an answering service that books nothing, a night
            dispatcher's salary, or another month of ad spend leaking through the same holes.
          </p>

          <div style={{ marginTop: 60 }}>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(243,239,234,0.85)", marginBottom: 24 }}>
              Ready to see if it works for your business?
            </p>
            <PillCta>Book a 15-minute discovery call</PillCta>
            <p style={{ marginTop: 16, fontSize: 15, color: "rgba(243,239,234,0.65)" }}>
              We&apos;ll show you exactly where you&apos;re losing money.
            </p>
          </div>
        </div>

        {/* footer */}
        <div style={{ borderTop: "1px solid rgba(243,239,234,0.1)" }}>
          <div style={{ maxWidth: 1140, margin: "0 auto", padding: "26px 28px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <span style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 15, color: "rgba(243,239,234,0.85)" }}>FIELDBUILT</span>
            <div style={{ display: "flex", gap: 26 }}>
              <Link href="/privacy" style={{ fontSize: 13.5, color: "rgba(243,239,234,0.6)" }}>Privacy</Link>
              <Link href="/terms" style={{ fontSize: 13.5, color: "rgba(243,239,234,0.6)" }}>Terms</Link>
              <Link href="/login" style={{ fontSize: 13.5, color: "rgba(243,239,234,0.6)" }}>Log in</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
