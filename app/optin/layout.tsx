import type { Metadata } from "next"

// Route-scoped metadata for the opt-in page, so ad and content link previews
// match the on-page offer (docs/flooring-pivot.md).
export const metadata: Metadata = {
  title: "Is Your Metro Open? | FieldBuilt AI",
  description:
    "For flooring showrooms and shop-at-home companies with their own install crews. 10 shown in-home measures in your first 30 days, or every measure is free.",
}

export default function OptinLayout({ children }: { children: React.ReactNode }) {
  return children
}
