import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Your Call Is Booked | FieldBuilt AI",
  description: "One step left: confirm your call with FieldBuilt AI, in-home measures and quote follow-up for flooring contractors.",
  robots: { index: false },
}

export default function StartBookedLayout({ children }: { children: React.ReactNode }) {
  return children
}
