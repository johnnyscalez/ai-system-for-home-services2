import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Book Your Flooring Walkthrough — FieldBuilt AI",
  description:
    "For flooring contractors with their own install crews. Guaranteed 20 in-home measures in 60 days, and every quote chased until it signs or says no. We run the Meta ads, our AI answers every homeowner in seconds, qualifies them and books the measure on your calendar.",
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children
}
