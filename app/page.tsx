"use client"

// ─────────────────────────────────────────────────────────────────────────────
// FIELDBUILT — offer-first site for flooring contractors with install crews.
// Positioning source of truth: docs/flooring-pivot.md (offer wording, no price,
// no guarantee failure terms, no invented flooring proof).
// Structure: the offer → the leak → how it works → example thread → receipts →
// what gets installed → what it never does → who it's for → ask.
// Light mode throughout: warm off-white, white cards, deep ink, one orange accent,
// mono for real data only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import Link from "next/link"

const C = {
  paper:   "#FAFAF8",
  white:   "#FFFFFF",
  ink:     "#1C1917",
  muted:   "#78716C",
  line:    "#E7E5E4",
  parch:   "#F5F4F2",
  soft:    "#FFF3EC",
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

function LedgerRow({ label, value, sub, strong = false, index }: {
  label: string; value?: string; sub?: string; strong?: boolean; index?: number
}) {
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "17px 2px", display: "flex", alignItems: "baseline", gap: 16 }}>
      {index !== undefined && (
        <span style={{ fontFamily: mono, fontSize: 13, color: C.orangeD, minWidth: 26, fontVariantNumeric: "tabular-nums" }}>
          {String(index).padStart(2, "0")}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: jakarta, fontWeight: strong ? 800 : 600, fontSize: strong ? 19 : 16.5, color: C.ink, lineHeight: 1.45 }}>{label}</p>
        {sub && <p style={{ fontWeight: 400, fontSize: 14.5, color: C.muted, marginTop: 5, lineHeight: 1.6, maxWidth: 600 }}>{sub}</p>}
      </div>
      {value && (
        <span style={{ fontFamily: mono, fontSize: strong ? 26 : 17, fontWeight: strong ? 700 : 400, color: strong ? C.orangeD : C.ink, whiteSpace: "nowrap", letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
      )}
    </div>
  )
}

// An example of how a conversation runs, labelled as an example on the page.
// Agent style rules apply: no dashes, ranges written "9 to 11am".
const THREAD: { t: string; who: "sys" | "lead"; text: string }[] = [
  { t: "8:42 PM", who: "lead", text: "Hi, saw your ad. Looking at LVP for the living room and hallway." },
  { t: "8:42 PM", who: "sys",  text: "Thanks for reaching out! Quick heads up, I'm the AI assistant for the team. Roughly how big is the area, and what's on the floor now?" },
  { t: "8:44 PM", who: "lead", text: "Maybe 600 sq ft. Old carpet. We want it done before the holidays." },
  { t: "8:44 PM", who: "sys",  text: "That's very doable. What's your ZIP so I can check we cover your area?" },
  { t: "8:45 PM", who: "lead", text: "46032" },
  { t: "8:45 PM", who: "sys",  text: "You're in our area. Next step is a free in-home measure so the team can give you an exact quote. Will everyone who decides on the floor be home for it?" },
  { t: "8:46 PM", who: "lead", text: "Yes, my husband and I are both home after 5" },
  { t: "8:46 PM", who: "sys",  text: "We have Thursday 5 to 6pm or Saturday 9 to 10am. Which works better?" },
  { t: "8:47 PM", who: "lead", text: "Thursday" },
  { t: "8:48 PM", who: "sys",  text: "You're booked for Thursday, 5 to 6pm. You'll get a reminder the day before, and the estimator will text when they're on the way." },
]

const HOW_IT_WORKS: { line: string; outcome: string }[] = [
  { line: "We run the ads in your service area.",
    outcome: "Meta ads built for homeowners who are ready for new floors, aimed only at the ZIP codes your crews cover. You pay the ad spend straight to Meta, so you can see every dollar." },
  { line: "Every homeowner gets answered in seconds.",
    outcome: "Text and phone, nights and weekends included. Homeowners ask three flooring companies at once and book whoever answers first. That's you now." },
  { line: "Every lead gets qualified before it reaches your calendar.",
    outcome: "Project type, rough size, timeline, ZIP code, and whether every decision maker will be home. No more 45-minute drives to hear \"my husband needs to see it first.\"" },
  { line: "Every qualified homeowner gets booked as an in-home measure.",
    outcome: "Real openings on your real calendar, with a confirmation, a day-before reminder, and an easy reschedule so measures don't no-show." },
  { line: "Every quote gets chased until it signs or says no.",
    outcome: "After the measure, it follows up by text, call and email. Nothing dies in a \"let me think about it\" pile, and nobody on your team has to remember." },
]

const INSTALL_SCOPE: string[] = [
  "Meta ad campaigns for homeowners in your service area",
  "Ad creative and copy written for your market",
  "Instant text and phone response, 24/7",
  "Qualification rules: project type, size, timeline, ZIP",
  "Decision-maker check before every measure",
  "In-home measure booking on your real availability",
  "Confirmations, reminders and reschedule paths",
  "Quote follow-up by text, call and email",
  "Stop rules the moment a homeowner says no",
  "Every conversation logged where your team can see it",
  "Human escalation rules for anything unusual",
  "Testing before it touches a real homeowner",
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
              Book a walkthrough
            </Link>
          </div>
        </div>
      </header>

      {/* ── 1 · THE OFFER ────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(60px, 9vw, 110px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px" }}>
          <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.1em", color: C.orangeD, marginBottom: 18 }}>
            FOR FLOORING CONTRACTORS WITH THEIR OWN INSTALL CREWS
          </p>
          <h1 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(38px, 5.6vw, 68px)", lineHeight: 1.05, letterSpacing: "-0.025em", maxWidth: 900, margin: 0 }}>
            Guaranteed 20 in-home measures in 60 days.
          </h1>
          <p style={{ fontFamily: jakarta, fontWeight: 700, fontSize: "clamp(20px, 2.4vw, 28px)", lineHeight: 1.3, letterSpacing: "-0.01em", maxWidth: 760, marginTop: 16, color: C.orangeD }}>
            And every quote chased until it signs or says no.
          </p>
          <p style={{ fontSize: "clamp(17px, 1.8vw, 20px)", lineHeight: 1.6, color: C.muted, maxWidth: 660, marginTop: 24 }}>
            You have the crews. What you need is a steady calendar of measures. We run the ads in
            your service area, answer every homeowner in seconds, qualify them, book the measure,
            and follow up on every quote until you get an answer.
          </p>
          <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <PillCta>Book a 20-minute walkthrough</PillCta>
            <span style={{ fontSize: 14.5, color: C.muted }}>We&apos;ll map the demand in your service area on the call.</span>
          </div>
        </div>
      </section>

      {/* ── 2 · THE LEAK ─────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(80px, 10vw, 130px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "48px 72px", alignItems: "start" }}>
          <div>
            <SectionTitle>Your crews are ready. Your calendar isn&apos;t.</SectionTitle>
            <p style={{ marginTop: 18, fontSize: 16.5, lineHeight: 1.65, color: C.muted, maxWidth: 520 }}>
              Shared leads get sold to four other flooring companies, and half of them never pick
              up. The ones who do are booking whoever calls back first. Then the measure happens,
              the quote goes out, and nobody follows up.
            </p>
            <p style={{ marginTop: 16, fontSize: 16.5, lineHeight: 1.65, color: C.ink, fontWeight: 600, maxWidth: 520 }}>
              More leads don&apos;t fix that. A system that books the measure and chases the
              quote does. That&apos;s the only thing we build.
            </p>
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 26px" }}>
            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.08em", color: C.muted, marginBottom: 4 }}>A TYPICAL WEEK, WITHOUT A SYSTEM</p>
            {[
              ["MON 8:40 PM", "Homeowner asks three flooring companies for a quote."],
              ["TUE 9:15 AM", "You call back. They booked a measure with whoever answered."],
              ["THU 5:00 PM", "45-minute drive to a measure. The husband isn't home."],
              ["FRI", "Quote sent on the one measure that went ahead."],
              ["3 WEEKS LATER", "No reply. Nobody followed up. The job is gone."],
            ].map(([t, txt], i, arr) => (
              <div key={t} style={{ display: "flex", gap: 18, alignItems: "baseline", borderTop: `1px solid ${C.parch}`, padding: "12px 0" }}>
                <span style={{ fontFamily: mono, fontSize: 12.5, color: i === arr.length - 1 ? C.orangeD : C.muted, minWidth: 104, fontVariantNumeric: "tabular-nums" }}>{t}</span>
                <span style={{ fontSize: 15, lineHeight: 1.5, fontWeight: i === arr.length - 1 ? 600 : 400 }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 · HOW IT WORKS (five steps, each with its outcome) ─────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 0 0" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 28px" }}>
          <SectionTitle>From the first ad click to a signed quote.</SectionTitle>
          <div style={{ marginTop: 30 }}>
            {HOW_IT_WORKS.map((w, i) => (
              <LedgerRow key={w.line} index={i + 1} label={w.line} sub={w.outcome} />
            ))}
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ── 4 · EXAMPLE THREAD ───────────────────────────────────────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "48px 72px", alignItems: "start" }}>
          <div>
            <SectionTitle>A homeowner messages at 8:42 PM. The measure is booked by 8:48.</SectionTitle>
            <p style={{ marginTop: 18, fontSize: 16.5, lineHeight: 1.65, color: C.muted, maxWidth: 500 }}>
              Here&apos;s an example of how a conversation runs. Office closed, nobody on the phone.
              The homeowner is qualified, every decision maker is confirmed, and the measure is on
              your calendar six minutes after the first message.
            </p>
            <div style={{ marginTop: 30, background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 15 }}>Measure booked · on your calendar</span>
                <span style={{ fontFamily: mono, fontSize: 12.5, color: C.orangeD, fontVariantNumeric: "tabular-nums" }}>8:48 PM</span>
              </div>
              <div style={{ padding: "4px 20px 14px" }}>
                {[
                  ["Qualified by your rules", "LVP · ~600 sq ft · before holidays"],
                  ["Service area checked", "ZIP 46032 · covered"],
                  ["Decision makers confirmed", "both home for the measure"],
                  ["Reminders scheduled", "day before · on the way"],
                  ["Quote follow-up armed", "starts after the measure"],
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
            <p style={{ fontFamily: mono, fontSize: 11.5, letterSpacing: "0.08em", color: C.muted, marginBottom: 14 }}>EXAMPLE CONVERSATION</p>
            {THREAD.map((m) => (
              <div key={m.t + m.text.slice(0, 12)} style={{ marginBottom: 18, display: "flex", flexDirection: "column", alignItems: m.who === "lead" ? "flex-start" : "flex-end" }}>
                <span style={{ fontFamily: mono, fontSize: 11.5, color: m.t === "8:48 PM" ? C.orangeD : C.muted, letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>{m.t}</span>
                <div style={{
                  marginTop: 5, maxWidth: 440, padding: "12px 16px", fontSize: 14.5, lineHeight: 1.5,
                  background: m.who === "lead" ? C.white : C.soft,
                  color: C.ink,
                  border: m.who === "lead" ? `1px solid ${C.line}` : "1px solid rgba(249,115,22,0.22)",
                  borderRadius: m.who === "lead" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5 · RECEIPTS ─────────────────────────────────────────────────── */}
      {/* Top Air numbers: label as a home-services account, never as flooring. */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 28px 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", background: C.parch, border: `1px solid ${C.line}`, borderRadius: 24, padding: "clamp(30px, 4.5vw, 56px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "44px 72px", alignItems: "start" }}>
          <div>
            <SectionTitle max={440}>The same booking engine, live today.</SectionTitle>
            <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.65, color: C.muted, maxWidth: 440 }}>
              These numbers come from a live home-services account running the same booking and
              follow-up engine. Every one is a timestamped row in that company&apos;s CRM. Our
              flooring program is new, and we&apos;ll show flooring numbers here as soon as
              they&apos;re in.
            </p>
          </div>
          <div>
            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.08em", color: C.muted, marginBottom: 4 }}>NINE DAYS · ONE HOME-SERVICES ACCOUNT</p>
            <LedgerRow label="Leads in" value="130" />
            <LedgerRow label="Cold leads worked" value="77" />
            <LedgerRow label="Appointments booked" value="13" strong />
            <p style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: "0.08em", color: C.muted, margin: "36px 0 4px" }}>THE FIRST 24 HOURS</p>
            <LedgerRow label="Leads answered" value="27" />
            <LedgerRow label="Conversations held" value="14" />
            <LedgerRow label="Appointments booked" value="3" strong />
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ── 6 · WHAT GETS INSTALLED ──────────────────────────────────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 0 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px" }}>
          <SectionTitle>Ads, booking and follow-up, installed as one system.</SectionTitle>
          <p style={{ marginTop: 18, fontSize: 16.5, lineHeight: 1.65, color: C.muted, maxWidth: 640 }}>
            You don&apos;t log into anything or figure anything out. We build your service area,
            your rules and your calendar into it, test it, and run it. You get measures on the
            calendar and an answer on every quote.
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
              ["It never quotes your price.", "The quote comes from you, after the measure. It only books the visit."],
              ["It never books outside your rules.", "Out of area, wrong project, decision maker missing: it doesn't force it, it flags it."],
              ["It never pretends to be a person.", "It tells every homeowner it's an AI assistant, every time."],
              ["It never keeps chasing after a no.", "The moment a homeowner says no or stop, the follow-up ends."],
              ["It never sells your leads to anyone else.", "Every homeowner from your ads is yours alone."],
              ["It never leaves you out of the loop.", "You see every message, and anything unusual comes to you with the whole thread."],
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
              Not shared leads. Not an answering service. Not an agency that hands you a list.
            </p>
            <p style={{ marginTop: 12, fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(26px, 3.4vw, 40px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              The system between an ad click and <span style={{ color: C.orangeD }}>a signed quote.</span>
            </p>
            <p style={{ marginTop: 18, fontSize: 16, lineHeight: 1.65, color: C.muted, maxWidth: 480 }}>
              Lead sellers hand you names. Answering services take messages. Agencies send you a
              report. None of them book the measure and chase the quote. That&apos;s where the
              jobs get lost, and that&apos;s the whole job here.
            </p>
          </div>
          <div>
            <p style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Built for you if:</p>
            <LedgerRow label="You run a flooring company in the USA with your own install crews" />
            <LedgerRow label="Your crews can take on more installs than the calendar feeds them" />
            <LedgerRow label="You do in-home measures before you quote" />
            <LedgerRow label="You're tired of shared leads and quotes that go quiet" />
            <div style={{ borderTop: `1px solid ${C.line}` }} />
            <p style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 17, margin: "34px 0 4px", color: C.muted }}>Not for you if:</p>
            <LedgerRow label="You don't have an install crew yet" sub="We fill calendars. Without a crew there's nothing to fill." />
            <LedgerRow label="You only sub for stores" sub="The homeowner has to be your customer, not someone else's." />
            <div style={{ borderTop: `1px solid ${C.line}` }} />
          </div>
        </div>
      </section>

      {/* ── 9 · RESULT + ASK ─────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(90px, 11vw, 140px) 28px 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", background: C.white, border: `1px solid ${C.line}`, borderRadius: 24, padding: "clamp(40px, 6vw, 80px) clamp(24px, 5vw, 72px)" }}>
          <div style={{ maxWidth: 760 }}>
            <h2 style={{ fontFamily: jakarta, fontWeight: 800, fontSize: "clamp(30px, 4.2vw, 50px)", letterSpacing: "-0.022em", lineHeight: 1.1 }}>
              What you get:
            </h2>
            <div style={{ marginTop: 24 }}>
              <LedgerRow label="20 in-home measures on your calendar in 60 days, guaranteed." strong />
              <LedgerRow label="Every quote followed up until it signs or says no." />
              <LedgerRow label="Qualified homeowners only, with the decision makers home." />
              <LedgerRow label="No sales hire, no shared leads, nobody on your team chasing." />
              <div style={{ borderTop: `1px solid ${C.line}` }} />
            </div>

            <div style={{ marginTop: 52 }}>
              <p style={{ fontSize: 18, lineHeight: 1.6, color: C.muted, marginBottom: 24 }}>
                Want to see if your service area is a fit?
              </p>
              <PillCta>Book a 20-minute walkthrough</PillCta>
              <p style={{ marginTop: 16, fontSize: 15, color: C.muted }}>
                We&apos;ll show you the demand in your area and exactly how the 20 measures get booked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ marginTop: "clamp(70px, 8vw, 100px)", borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "26px 28px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <span style={{ fontFamily: jakarta, fontWeight: 800, fontSize: 15, color: C.ink }}>FIELDBUILT</span>
          <div style={{ display: "flex", gap: 26 }}>
            <Link href="/privacy" style={{ fontSize: 13.5, color: C.muted }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize: 13.5, color: C.muted }}>Terms</Link>
            <Link href="/login" style={{ fontSize: 13.5, color: C.muted }}>Log in</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
