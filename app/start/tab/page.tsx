"use client"

// ─── VARIANT 2: THE TAB YOU CLOSED ───────────────────────────────────────────
// Ad angle: vindication — he was right to walk away from ServiceTitan
// Use this URL in your Facebook ad when running the "Tab You Closed" angle:
//   fieldbuiltai.com/start/tab
//
// This page leads with its own angle instead of the generic wound: the
// enterprise cost row lands immediately after the hero ("your gut did the
// math right"), then a short bridge into the still-unsolved problem, then
// straight into Watch It Work + the shared architecture. No generic
// TryFail/ProofStats/Reframe, and no standalone Wedge — that beat is folded
// into the Scope section's intro instead of repeated.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MinimalHeader, WoundHero, EnterpriseCostRow, BridgeSection,
  WatchItWorkSection, ScopeSection, LeadFormSection, FaqSection,
  MinimalFooter, StickyBottomCta,
} from "@/components/landing/shared"

export default function StartTabPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <WoundHero
        eyebrow="For HVAC owners who already shopped the enterprise platforms"
        line1="You were right to walk"
        line2="away from ServiceTitan."
        sub={
          <>
            The price, the year of onboarding, the contract. Your gut was right.{" "}
            <strong style={{ color: "#F5F3F0" }}>
              But the problem you wanted it to fix is still sitting there.
            </strong>
          </>
        }
      />
      <EnterpriseCostRow />
      <BridgeSection />
      <WatchItWorkSection />
      <ScopeSection
        intro={{
          eyebrow: "What you actually wanted",
          heading: "Everything you wanted from that platform.",
          sub: "Without the $50K+ bill, the year of onboarding, or the contract you'd need a lawyer to exit. Built around what you already run, set up for you.",
        }}
      />
      <LeadFormSection source="tab-closed" />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
