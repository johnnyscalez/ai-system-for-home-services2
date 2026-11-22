import { NextResponse } from "next/server"
import { getOpenSlots } from "@/lib/book-widget"

// Open times on the FieldBuilt sales calendar for the /book widget, as UTC
// instants. The widget calls this the moment the page opens, so the times are
// already loaded by the time the visitor finishes the two questions.

export const runtime = "nodejs"

export async function GET() {
  const slots = await getOpenSlots()
  if (!slots) return NextResponse.json({ error: "Calendar unavailable" }, { status: 503 })
  return NextResponse.json(
    { slots, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  )
}
