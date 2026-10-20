"use client"

// ─── VARIANT: SPEED TO LEAD ──────────────────────────────────────────────────
// Ad angle: homeowners contact several flooring companies at once and book
// whoever answers first. The example chat shows a homeowner answered in
// seconds, qualified, and booked for an in-home measure.
// Use this URL in the Facebook ad running the chat-screenshot creative:
//   fieldbuiltai.com/start/autopilot
// ─────────────────────────────────────────────────────────────────────────────

import {
  MinimalHeader, LeadFormSection, OfferSection, FaqSection, MinimalFooter, StickyBottomCta, C,
} from "@/components/landing/shared"
import {
  AutopilotHero, PaidLeadMath, RevenueChainSection, WorkOrderSection, StackStaysSection,
} from "@/components/landing/autopilot"

export default function AutopilotPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      <MinimalHeader />
      <AutopilotHero />
      <PaidLeadMath />
      <RevenueChainSection />
      <WorkOrderSection />
      <StackStaysSection />
      <OfferSection />
      <LeadFormSection
        source="speed-to-lead"
        heading={
          <>
            Be the first one back to{" "}
            <span
              style={{
                // Highlighter swipe across the lower half of the phrase —
                // clones cleanly when the phrase wraps on small screens
                background:
                  "linear-gradient(to bottom, transparent 46%, rgba(249,115,22,0.22) 46%, rgba(249,115,22,0.22) 94%, transparent 94%)",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
                padding: "0 0.12em",
                marginLeft: "-0.12em",
              }}
            >
              every homeowner
            </span>
          </>
        }
        sub={
          <>
            Four quick questions, then pick a time for a 20-minute call with Jonathan.{" "}
            <strong style={{ color: C.text }}>
              Guaranteed 20 in-home measures in 60 days, and every quote chased until it signs or says no.
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
