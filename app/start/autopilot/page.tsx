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
  AutopilotHero, PaidLeadMath, WorkOrderSection, StackStaysSection,
} from "@/components/landing/autopilot"

export default function AutopilotPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <AutopilotHero />
      <PaidLeadMath />
      <WorkOrderSection />
      <StackStaysSection />
      <LeadFormSection
        source="autopilot"
        heading="See it running on your leads. Free for 2 weeks."
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
