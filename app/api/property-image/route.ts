import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  // Auth guard — API key must never reach the browser
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

  // Validate request body
  let body: { address?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const address = typeof body.address === "string" ? body.address.trim() : ""
  if (!address || address.length < 5) {
    return NextResponse.json(
      { success: false, error: "Address is required and must be at least 5 characters." },
      { status: 400 }
    )
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error("[property-image] GOOGLE_MAPS_API_KEY is not set")
    return NextResponse.json(
      { success: false, error: "Google Maps API is not configured on this server." },
      { status: 500 }
    )
  }

  const encodedAddress = encodeURIComponent(address)

  try {
    // ── Step 1: Check Street View metadata ──────────────────────────────────────
    const metadataUrl =
      `https://maps.googleapis.com/maps/api/streetview/metadata` +
      `?location=${encodedAddress}&radius=75&key=${apiKey}`

    const metaRes = await fetch(metadataUrl, { cache: "no-store" })
    if (!metaRes.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to reach Google Street View API. Try again shortly." },
        { status: 502 }
      )
    }

    const meta: StreetViewMetadata = await metaRes.json()

    // ── Step 2: Handle Google error statuses ────────────────────────────────────
    if (meta.status === "REQUEST_DENIED") {
      console.error("[property-image] Google API REQUEST_DENIED:", meta.error_message)
      return NextResponse.json(
        { success: false, error: "Google Maps API key is invalid or Street View is not enabled for this key." },
        { status: 400 }
      )
    }
    if (meta.status === "OVER_QUERY_LIMIT") {
      return NextResponse.json(
        { success: false, error: "Google Maps API quota exceeded. Please try again later." },
        { status: 429 }
      )
    }
    if (meta.status === "INVALID_REQUEST") {
      return NextResponse.json(
        { success: false, error: "The address could not be understood by Google Maps. Please check it and try again." },
        { status: 400 }
      )
    }

    // ── Step 3: Street View available ───────────────────────────────────────────
    if (meta.status === "OK") {
      return NextResponse.json({
        success: true,
        source: "street_view",
        // Proxy URL — Google API key never reaches the browser
        imageUrl: `/api/property-image/image?address=${encodedAddress}&type=street_view`,
        metadata: {
          status: "OK",
          lat: meta.location?.lat ?? null,
          lng: meta.location?.lng ?? null,
          date: meta.date ?? null,
          pano_id: meta.pano_id ?? null,
        },
      })
    }

    // ── Step 4: ZERO_RESULTS / NOT_FOUND → satellite fallback ──────────────────
    // (status is ZERO_RESULTS, NOT_FOUND, or anything unexpected)
    return NextResponse.json({
      success: true,
      source: "maps_static_fallback",
      imageUrl: `/api/property-image/image?address=${encodedAddress}&type=satellite`,
      metadata: {
        status: meta.status ?? "ZERO_RESULTS",
      },
    })
  } catch (err) {
    console.error("[property-image] Network error:", err)
    return NextResponse.json(
      { success: false, error: "Network error while contacting Google Maps. Please try again." },
      { status: 502 }
    )
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface StreetViewMetadata {
  status: "OK" | "ZERO_RESULTS" | "NOT_FOUND" | "REQUEST_DENIED" | "OVER_QUERY_LIMIT" | "INVALID_REQUEST" | string
  error_message?: string
  location?: { lat: number; lng: number }
  date?: string
  pano_id?: string
}
