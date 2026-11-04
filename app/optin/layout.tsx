import type { Metadata } from "next"

// Route-scoped metadata for the opt-in quiz, so ad and content link previews
// match the on-page copy (docs/flooring-pivot.md).
export const metadata: Metadata = {
  title: "Is Your Area Open? | FieldBuilt AI",
  description: "For flooring contractors with their own install crews. Four quick questions to see if we can guarantee 20+ booked measures in 60 days.",
}

export default function OptinLayout({ children }: { children: React.ReactNode }) {
  return children
}
