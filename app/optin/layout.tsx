import type { Metadata } from "next"

// Route-scoped metadata for the opt-in page, so ad and content link previews
// match the on-page offer (docs/flooring-pivot.md).
export const metadata: Metadata = {
  title: "Is Your Metro Open? | FieldBuilt AI",
  description:
    "For flooring showrooms and shop-at-home companies with their own install crews. Get 10 in-home flooring measures in your first 30 days, or you pay nothing.",
}

export default function OptinLayout({ children }: { children: React.ReactNode }) {
  return children
}
