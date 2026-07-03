import type { Metadata } from "next"

// Route-scoped metadata override — does not touch the shared root layout,
// which the main site relies on. Keeps the ad-funnel pages' claims
// (response time, trial length) consistent with what Facebook link previews
// show, matching the on-page copy.
export const metadata: Metadata = {
  title: "How Many Leads Did You Lose Last Month? — FieldBuilt AI",
  description: "Most HVAC shops can't answer that — a lead nobody logs never shows up on a report. Try the fix free for 14 days. No card. I set it up.",
}

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children
}
