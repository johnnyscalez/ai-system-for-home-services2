"use client"

// ─── VARIANT 2: SHARED LEADS ─────────────────────────────────────────────────
// Ad angle: frustration with Angi / HomeAdvisor shared leads, sold to four
// other companies, half never pick up.
// Use this URL in the Facebook ad running the "shared leads" angle:
//   fieldbuiltai.com/start/tab   (URL kept from the old "tab you closed" angle)
//
// Leads with its own angle: the shared-leads row lands right after the hero,
// then a short bridge into the fix, then the example conversation and the
// mechanism with an intro written for this angle.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MinimalHeader, WoundHero, SharedLeadsRow, BridgeSection,
  WatchItWorkSection, HowItWorksSection, OfferSection, LeadFormSection, FaqSection,
  MinimalFooter, StickyBottomCta, C,
} from "@/components/landing/shared"

export default function StartTabPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      <MinimalHeader />
      <WoundHero
        eyebrow="For flooring contractors tired of shared leads"
        line1="Still paying for leads"
        line2="sold to four other companies?"
        sub={
          <>
            Half of them never pick up. The rest already heard from three other flooring
            companies.{" "}
            <strong style={{ color: C.text }}>
              You&rsquo;re paying to be the fourth call.
            </strong>
          </>
        }
      />
      <SharedLeadsRow />
      <BridgeSection />
      <WatchItWorkSection />
      <HowItWorksSection
        intro={{
          eyebrow: "Your own homeowners",
          heading: "Homeowners who asked you, not a list.",
          sub: "We run the ads in your area, so the homeowner on the other end only reached out to you. Then it answers first, books the measure, and chases the quote.",
        }}
      />
      <OfferSection />
      <LeadFormSection source="shared-leads" />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
