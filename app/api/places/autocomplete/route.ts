import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { placesAutocomplete } from "@/lib/service-areas"

export const runtime = "nodejs"

/**
 * City and area suggestions for the service-area field. The Google key stays
 * on the server. `available: false` means Google could not be used; the field
 * then accepts areas typed by hand.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = new URL(req.url).searchParams
  const q = (params.get("q") ?? "").trim()
  const state = (params.get("state") ?? "").trim().toUpperCase() || null
  const session = (params.get("session") ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 36) || null

  const result = await placesAutocomplete(q, state, session)
  return NextResponse.json({ available: result.available, suggestions: result.suggestions })
}
