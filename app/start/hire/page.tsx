"use client"

// ─── VARIANT 4: CREWS READY, CALENDAR THIN ───────────────────────────────────
// Ad angle: the owner has the crews, not the measures.
// Use this URL in the Facebook ad running the "crews ready" angle:
//   fieldbuiltai.com/start/hire   (URL kept from the old "hiring" angle)
// ─────────────────────────────────────────────────────────────────────────────

import { MinimalHeader, WoundHero, LandingBody, C } from "@/components/landing/shared"

export default function StartHirePage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif", background: C.bg }}>
      <MinimalHeader />
      <WoundHero
        eyebrow="For flooring owners with crews ready to install"
        line1="You have the crews."
        line2="You don't have the measures."
        sub={
          <>
            Good installers, ready to go, and a calendar that doesn&rsquo;t feed them.{" "}
            <strong style={{ color: C.text }}>
              That&rsquo;s not a crew problem. It&rsquo;s a measure problem, and it&rsquo;s fixable.
            </strong>
          </>
        }
      />
      <LandingBody source="crews-ready" />
    </main>
  )
}
