"use client"

// ─── VARIANT 2: THE TAB YOU CLOSED ───────────────────────────────────────────
// Ad angle: vindication — he was right to walk away from ServiceTitan
// Use this URL in your Facebook ad when running the "Tab You Closed" angle:
//   fieldbuiltai.com/start/tab
// ─────────────────────────────────────────────────────────────────────────────

import { MinimalHeader, WoundHero, LandingBody } from "@/components/landing/shared"

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
      <LandingBody source="tab-closed" />
    </main>
  )
}
