"use client"

// ─── VARIANT 3: THE WASTED DRIVE ─────────────────────────────────────────────
// Ad angle: 45 minutes out to a measure, then "my husband needs to be here".
// Use this URL in the Facebook ad running the "wasted drive" angle:
//   fieldbuiltai.com/start/tech   (URL kept from the old "best tech" angle)
//
// No fabricated testimonials on this page. Trust comes from the honest
// founder block and the labelled live home-services numbers. The decision
// maker check gives this page its own demonstration, since its whole angle is
// the measure that should never have been booked.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MinimalHeader, WoundHero, PainSection, ReframeSection, HowItWorksSection,
  DecisionMakerSection, ProofSection, OfferSection, FounderTrustSection,
  LeadFormSection, FaqSection, MinimalFooter, StickyBottomCta, C,
} from "@/components/landing/shared"

export default function StartTechPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      <MinimalHeader />
      <WoundHero
        eyebrow="For flooring owners who run their own measures"
        line1="45 minutes to the measure."
        line2={"Then: “my husband needs to be here.”"}
        sub="Gas, a whole evening, and a quote you can't close because the person who decides wasn't home. That measure should never have been booked."
      />
      <DecisionMakerSection />
      <PainSection />
      <ReframeSection />
      <HowItWorksSection />
      <ProofSection />
      <OfferSection />
      <FounderTrustSection />
      <LeadFormSection source="wasted-drive" />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
