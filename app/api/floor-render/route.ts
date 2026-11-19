import { NextRequest, NextResponse } from "next/server"
import { clientIp } from "@/lib/tracking"

// "See your new floor" visualizer on contractor landing pages: a homeowner
// uploads a room photo, picks a floor, and gets the same photo back with only
// the floor replaced. Providers are tried in order, each only when its key is
// set: Gemini, then OpenAI's image edit (gpt-image-1.5 at high input fidelity,
// about 12 s), then Flux Kontext Pro on Replicate.
//
// Public and unauthenticated by necessity (the page is a cold-traffic landing
// page on another origin), so it is locked down instead: the prompt is built
// here from a fixed style list (the client never sends prompt text), the image
// must be a JPEG/PNG data URL under 4 MB, and each IP gets a handful of renders
// an hour. Returns 503 until one of GEMINI_API_KEY, REPLICATE_API_TOKEN or
// OPENAI_API_KEY is set.
//
// Written 2026-11-18.

export const runtime = "nodejs"
export const maxDuration = 120

const REPLICATE_MODEL = "black-forest-labs/flux-kontext-pro"
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image"
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5"

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

async function renderGemini(key: string, image: string, prompt: string): Promise<string | null> {
  const [, mime, data] = image.match(/^data:(image\/(?:jpeg|png));base64,([^]*)$/) ?? []
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data } }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error("[floor-render] gemini", res.status, out?.error?.message)
    return null
  }
  const parts: { inlineData?: { mimeType: string; data: string } }[] = out?.candidates?.[0]?.content?.parts ?? []
  const img = parts.find((p) => p.inlineData?.data)?.inlineData
  if (!img) {
    console.error("[floor-render] gemini returned no image", out?.candidates?.[0]?.finishReason)
    return null
  }
  return `data:${img.mimeType};base64,${img.data}`
}

async function renderReplicate(token: string, image: string, prompt: string): Promise<string | null> {
  const create = () =>
    fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
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
    console.error("[floor-render] replicate create failed", res.status, pred?.detail)
    return null
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
    console.error("[floor-render] replicate prediction", pred.status, pred.error)
    return null
  }
  return out
}

async function renderOpenAI(key: string, image: string, prompt: string): Promise<string | null> {
  const [, mime, data] = image.match(/^data:(image\/(?:jpeg|png));base64,([^]*)$/) ?? []
  const form = new FormData()
  form.append("model", OPENAI_MODEL)
  form.append("image", new Blob([Buffer.from(data, "base64")], { type: mime }), mime === "image/png" ? "room.png" : "room.jpg")
  form.append("prompt", prompt)
  form.append("input_fidelity", "high") // keep walls, furniture and framing as close to the photo as it can
  form.append("quality", "medium")
  form.append("size", "auto")
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  const out = await res.json().catch(() => ({}))
  const b64 = out?.data?.[0]?.b64_json
  if (!res.ok || typeof b64 !== "string") {
    console.error("[floor-render] openai", res.status, out?.error?.message)
    return null
  }
  return `data:image/png;base64,${b64}`
}

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY
  const replicateToken = process.env.REPLICATE_API_TOKEN
  const openaiKey = process.env.OPENAI_API_KEY
  if (!geminiKey && !replicateToken && !openaiKey) return reply({ error: "not_configured" }, 503)

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
    const url =
      (geminiKey ? await renderGemini(geminiKey, image, prompt) : null) ??
      (openaiKey ? await renderOpenAI(openaiKey, image, prompt) : null) ??
      (replicateToken ? await renderReplicate(replicateToken, image, prompt) : null)
    return url ? reply({ imageUrl: url }) : reply({ error: "render_failed" }, 502)
  } catch (err) {
    console.error("[floor-render] error", err)
    return reply({ error: "render_failed" }, 502)
  }
}
