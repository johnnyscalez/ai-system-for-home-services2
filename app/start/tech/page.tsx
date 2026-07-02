"use client"

// ─── VARIANT 3: BEST TECH ────────────────────────────────────────────────────
// Ad angle: blindness — he can't name his best closer, only his busiest
// Use this URL in your Facebook ad when running the "Best Tech" angle:
//   fieldbuiltai.com/start/tech
// ─────────────────────────────────────────────────────────────────────────────

import { MinimalHeader, WoundHero, LandingBody } from "@/components/landing/shared"

export default function StartTechPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <WoundHero
        eyebrow="For HVAC owners running on instinct"
        line1="Who's your best tech?"
        line2="You can't actually say."
        sub={
          <>
            Not your busiest — your <strong style={{ color: "#F5F3F0" }}>best</strong>. Closes the
            most, fewest callbacks, makes you the most per job. You&rsquo;ve got a gut feeling.
            That&rsquo;s the problem.
          </>
        }
      />
      <LandingBody source="best-tech" />
    </main>
  )
}
