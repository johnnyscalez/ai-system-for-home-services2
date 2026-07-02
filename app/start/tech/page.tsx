"use client"

// ─── VARIANT 3: BEST TECH ────────────────────────────────────────────────────
// Ad angle: blindness — he can't name his best tech, only his busiest
// Use this URL in your Facebook ad when running the "Best Tech" angle:
//   fieldbuiltai.com/start/tech
//
// No fabricated testimonials on this page. Trust comes from the honest
// founder block (FounderTrustSection) + the free two-week trial, not from
// stock-photo quotes. The dashboard showcase gives this page its own
// product demonstration, since its entire angle is the number owners can't see.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MinimalHeader, WoundHero, TryFailSection, ProofStatsSection, ReframeSection,
  ScopeSection, DashboardShowcaseSection, WedgeSection, FounderTrustSection,
  LeadFormSection, FaqSection, MinimalFooter, StickyBottomCta,
} from "@/components/landing/shared"

export default function StartTechPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <WoundHero
        eyebrow="For HVAC owners running on instinct"
        line1="Who's your best tech?"
        line2="Not your busiest. Your best."
        sub="Closes the most, fewest callbacks, makes you the most per job. You've got a gut feeling. That's the problem."
      />
      <TryFailSection />
      <ProofStatsSection />
      <ReframeSection />
      <ScopeSection />
      <DashboardShowcaseSection />
      <WedgeSection />
      <FounderTrustSection />
      <LeadFormSection source="best-tech" />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
