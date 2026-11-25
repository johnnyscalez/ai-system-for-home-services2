import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { placeDetails } from "@/lib/service-areas"

export const runtime = "nodejs"

/** Center, bounding box and state of a picked suggestion, as a ServiceAreaPlace. */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = new URL(req.url).searchParams
  const placeId = (params.get("placeId") ?? "").trim()
  const session = (params.get("session") ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 36) || null
  if (!placeId) return NextResponse.json({ error: "placeId is required" }, { status: 400 })

  const place = await placeDetails(placeId, session)
  if (!place) return NextResponse.json({ error: "That area could not be loaded." }, { status: 404 })
  return NextResponse.json({ place })
}
