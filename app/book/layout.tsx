import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Book Your Walkthrough — FieldBuilt AI",
  description:
    "20 minutes, on screen. See how HVAC shops keep every tech booked with profitable work — every lead answered in 2 seconds, qualified, booked, dispatched, and logged. No extra office staff.",
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children
}
