"use client"

// ─── VARIANT 1: QUOTES GONE QUIET ────────────────────────────────────────────
// Ad angle: the quotes that went out after a measure and never came back.
// Use this URL in the Facebook ad running the "quiet quotes" angle:
//   fieldbuiltai.com/start
// ─────────────────────────────────────────────────────────────────────────────

import {
  MinimalHeader, WoundHero, PainSection, WatchItWorkSection,
  HowItWorksSection, ProofSection, ReframeSection, OfferSection,
  LeadFormSection, FaqSection, MinimalFooter, StickyBottomCta, C,
} from "@/components/landing/shared"

export default function StartPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      <MinimalHeader />
      <WoundHero
        line1="How many quotes went"
        line2="quiet last month?"
        sub={
          <>
            Measured, quoted, and then nothing. Not a no. Just silence.{" "}
            <strong style={{ color: C.text }}>
              Nobody followed up, so somebody else got the install.
            </strong>
          </>
        }
      />
      <PainSection />
      <WatchItWorkSection />
      <HowItWorksSection />
      <ProofSection />
      <ReframeSection />
      <OfferSection />
      <LeadFormSection source="quiet-quotes" />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
