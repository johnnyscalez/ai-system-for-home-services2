"use client"

// ─── VARIANT 4: THE HIRING REFRAME ───────────────────────────────────────────
// Ad angle: hiring frustration — the next tech is already on the payroll
// Use this URL in your Facebook ad when running the "hiring" angle:
//   fieldbuiltai.com/start/hire
// ─────────────────────────────────────────────────────────────────────────────

import { MinimalHeader, WoundHero, LandingBody } from "@/components/landing/shared"

export default function StartHirePage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <WoundHero
        eyebrow="For HVAC owners trying to hire"
        line1="You don't need another tech."
        line2="You need leads answered in seconds."
        sub={
          <>
            You&rsquo;ve run the ads, raised the pay, chased the no-shows. It&rsquo;s not you.{" "}
            <strong style={{ color: "#F5F3F0" }}>
              The leads dying while your crew is slammed? That&rsquo;s not a staffing problem.
            </strong>
          </>
        }
      />
      <LandingBody source="hiring" />
    </main>
  )
}
