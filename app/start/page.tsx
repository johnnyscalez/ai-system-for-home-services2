"use client"

// ─── VARIANT 1: FLYING BLIND ─────────────────────────────────────────────────
// Ad angle: loss / anxiety — the leads he can't count
// Use this URL in your Facebook ad when running the "Flying Blind" angle:
//   fieldbuiltai.com/start
// ─────────────────────────────────────────────────────────────────────────────

import {
  MinimalHeader, WoundHero, TryFailSection, WatchItWorkSection,
  ProofStatsSection, ReframeSection, ScopeSection, WedgeSection,
  LeadFormSection, FaqSection, MinimalFooter, StickyBottomCta,
} from "@/components/landing/shared"

export default function StartPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <WoundHero
        line1="How many leads did you"
        line2="lose last month?"
        sub={
          <>
            Take a second. Try to put a number on it.{" "}
            <strong style={{ color: "#F5F3F0" }}>You can&rsquo;t</strong>{" "}
            — because a lead nobody logged never shows up on a single report you&rsquo;ve got.
          </>
        }
      />
      <TryFailSection />
      <WatchItWorkSection />
      <ProofStatsSection />
      <ReframeSection />
      <ScopeSection />
      <WedgeSection />
      <LeadFormSection source="flying-blind" />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
