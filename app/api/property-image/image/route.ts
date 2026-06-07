import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

// GET /api/property-image/image?address=<encoded>&type=street_view|satellite
//
// Proxy that fetches the Google image server-side and streams bytes back.
// The Google API key is NEVER sent to the browser — only this endpoint knows it.
export async function GET(req: NextRequest) {
  // Auth guard
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { searchParams } = req.nextUrl
  const address = searchParams.get("address")
  const type    = searchParams.get("type") // "street_view" | "satellite"

  if (!address) return new NextResponse("Missing address parameter", { status: 400 })
  if (type !== "street_view" && type !== "satellite") {
    return new NextResponse("Invalid type — must be street_view or satellite", { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return new NextResponse("Google Maps API not configured", { status: 500 })

  // Build the upstream Google URL (never leaves the server)
  const googleUrl =
    type === "street_view"
      ? `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${address}&fov=80&heading=0&pitch=0&radius=75&key=${apiKey}`
      : `https://maps.googleapis.com/maps/api/staticmap?center=${address}&zoom=19&size=640x640&maptype=satellite&key=${apiKey}`

  try {
    const imgRes = await fetch(googleUrl, { cache: "no-store" })

    if (!imgRes.ok) {
      console.error(`[property-image/image] Google returned ${imgRes.status} for ${type}`)
      return new NextResponse("Failed to fetch image from Google", { status: 502 })
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg"
    const buffer      = await imgRes.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":  contentType,
        // Cache for 24 h client-side and at CDN edge to reduce API spend
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch (err) {
    console.error("[property-image/image] Fetch error:", err)
    return new NextResponse("Network error fetching image", { status: 502 })
  }
}
