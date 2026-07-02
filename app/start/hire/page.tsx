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
        eyebrow="For HVAC owners convinced they need to hire"
        line1="You don't need another tech."
        line2="You need every lead answered in seconds."
        sub={
          <>
            You&rsquo;ve run the hiring ads, raised the pay, interviewed guys who never showed.
            It&rsquo;s not you — there&rsquo;s a 100,000-tech shortage.{" "}
            <strong style={{ color: "#F5F3F0" }}>
              But the leads dying while your crew is slammed? That&rsquo;s not a staffing problem.
            </strong>
          </>
        }
      />
      <LandingBody source="hiring" />
    </main>
  )
}
