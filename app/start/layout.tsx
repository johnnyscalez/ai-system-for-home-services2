import type { Metadata } from "next"

// Route-scoped metadata override for the ad-funnel pages. Keeps what Facebook
// link previews show consistent with the on-page copy (docs/flooring-pivot.md).
export const metadata: Metadata = {
  title: "How Many Quotes Went Quiet Last Month? | FieldBuilt AI",
  description: "For flooring contractors with install crews. Guaranteed 20 in-home measures in 60 days, and every quote chased until it signs or says no.",
}

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children
}
