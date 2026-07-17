"use client"

// ─── VARIANT: AUTOPILOT / NEVER-MISS ─────────────────────────────────────────
// Ad angle: the Sarah chat — lead in at 8:17 PM, booked & routed & logged by
// 8:29, nobody touched a thing, free for 2 weeks.
// Use this URL in the Facebook ad running the chat-screenshot creative:
//   fieldbuiltai.com/start/autopilot
// ─────────────────────────────────────────────────────────────────────────────

import {
  MinimalHeader, LeadFormSection, FaqSection, MinimalFooter, StickyBottomCta,
} from "@/components/landing/shared"
import {
  AutopilotHero, PaidLeadMath, RevenueChainSection, WorkOrderSection, StackStaysSection,
} from "@/components/landing/autopilot"

export default function AutopilotPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <AutopilotHero />
      <PaidLeadMath />
      <RevenueChainSection />
      <WorkOrderSection />
      <StackStaysSection />
      <LeadFormSection
        source="autopilot"
        heading={
          <>
            See It Booking Your Leads In Seconds{" "}
            <span
              style={{
                // Highlighter swipe across the lower half of the phrase —
                // clones cleanly when the phrase wraps on small screens
                background:
                  "linear-gradient(to bottom, transparent 46%, rgba(249,115,22,0.30) 46%, rgba(249,115,22,0.30) 94%, transparent 94%)",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
                padding: "0 0.12em",
                marginLeft: "-0.12em",
              }}
            >
              Without Paying a Dime
            </span>
          </>
        }
        sub={
          <>
            Book a 20-minute walkthrough. We connect your lead sources, and the AI
            answers, follows up, and books your real leads free for 14 days: you
            watch the jobs land on your calendar.{" "}
            <strong style={{ color: "#1C1917" }}>
              If the booked jobs don&rsquo;t make it obvious, you walk. No card, no contract.
            </strong>
          </>
        }
      />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
