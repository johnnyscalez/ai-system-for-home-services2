import { NextRequest, NextResponse } from "next/server"
import { clientIp } from "@/lib/tracking"

// "See your new floor" visualizer on contractor landing pages: a homeowner
// uploads a room photo, picks a floor, and gets the same photo back with only
// the floor replaced (Flux Kontext Pro on Replicate, a few cents per render).
//
// Public and unauthenticated by necessity (the page is a cold-traffic landing
// page on another origin), so it is locked down instead: the prompt is built
// here from a fixed style list (the client never sends prompt text), the image
// must be a JPEG/PNG data URL under 4 MB, and each IP gets a handful of renders
// an hour. Returns 503 until REPLICATE_API_TOKEN is set.
//
// Written 2026-11-18.

export const runtime = "nodejs"
export const maxDuration = 120

const MODEL = "black-forest-labs/flux-kontext-pro"

const STYLES: Record<string, string> = {
  "white-oak": "a newly installed wide-plank natural white oak hardwood floor with a matte finish",
  "honey-oak": "a newly installed classic red oak hardwood floor with a warm honey stain and satin finish",
  walnut: "a newly installed dark walnut stained hardwood floor with a satin finish",
  "gray-lvp": "a newly installed light gray luxury vinyl plank floor",
  herringbone: "a newly installed natural oak herringbone pattern wood floor",
  carpet: "newly installed soft neutral beige plush wall-to-wall carpet",
}

const MAX_IMAGE_CHARS = 4 * 1024 * 1024 * 1.37 // 4 MB as base64
const LIMIT = 6
const WINDOW_MS = 60 * 60 * 1000
const hits = new Map<string, number[]>()

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
}

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= LIMIT) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return reply({ error: "not_configured" }, 503)

  let body: { image?: unknown; style?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply({ error: "bad_request" }, 400)
  }

  const style = typeof body.style === "string" ? STYLES[body.style] : undefined
  const image = body.image
  if (!style) return reply({ error: "unknown_style" }, 400)
  if (typeof image !== "string" || !/^data:image\/(jpeg|png);base64,/.test(image) || image.length > MAX_IMAGE_CHARS) {
    return reply({ error: "bad_image" }, 400)
  }

  if (rateLimited(clientIp(req.headers) ?? "unknown")) return reply({ error: "rate_limited" }, 429)

  const prompt =
    `Replace only the floor with ${style}. ` +
    "Keep the walls, baseboards, doors, windows, furniture, rugs' positions, lighting, shadows and camera angle exactly the same. " +
    "The new floor follows the room's perspective and runs under the furniture. Sharp, photorealistic interior photo."

  try {
    const create = () =>
      fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" },
        body: JSON.stringify({
          input: {
            prompt,
            input_image: image,
            aspect_ratio: "match_input_image",
            output_format: "jpg",
            safety_tolerance: 2,
          },
        }),
      })
    let res = await create()
    // Replicate throttles bursts (429 with a retry_after in seconds); one wait-and-retry covers it.
    if (res.status === 429) {
      const wait = Math.min(Number((await res.json().catch(() => ({})))?.retry_after) || 5, 15)
      await new Promise((r) => setTimeout(r, wait * 1000))
      res = await create()
    }
    let pred = await res.json()
    if (!res.ok) {
      console.error("[floor-render] create failed", res.status, pred?.detail)
      return reply({ error: "render_failed" }, 502)
    }

    // Prefer: wait usually returns the finished prediction; poll if it didn't.
    const deadline = Date.now() + 90_000
    while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500))
      const poll = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } })
      pred = await poll.json()
    }

    const out = Array.isArray(pred.output) ? pred.output[0] : pred.output
    if (pred.status !== "succeeded" || typeof out !== "string") {
      console.error("[floor-render] prediction", pred.status, pred.error)
      return reply({ error: "render_failed" }, 502)
    }
    return reply({ imageUrl: out })
  } catch (err) {
    console.error("[floor-render] error", err)
    return reply({ error: "render_failed" }, 502)
  }
}
