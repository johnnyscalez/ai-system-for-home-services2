import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import {
  clientIp,
  countryFromHeaders,
  deviceFromUserAgent,
  hashIp,
  isBotUserAgent,
  isInternalIp,
} from "@/lib/tracking"

// First-party traffic beacon for the marketing pages. Public and
// unauthenticated by necessity: a prospect's browser calls it before anyone
// has identified themselves. That makes it spammable, so nothing here is
// trusted — the event name must be on a fixed list, the path must be a page we
// actually market, every string is truncated, and anything about the request
// itself (device, country, bot, internal) is read from headers rather than the
// body. Worst case someone inflates a pageview count; there is nothing to
// leak and nothing to escalate.
//
// Written 2026-11-05. See supabase/migrations/20261105000000_site_events.sql.

export const runtime = "nodejs"

const EVENTS = new Set(["page_view", "cta_click", "section_view", "quiz_step", "quiz_submit"])

// Marketing pages only. The dashboard is not traffic, and a path we do not
// recognise is someone poking the endpoint.
const TRACKED_PATH = /^\/(?:$|book$|optin$|privacy$|terms$|start(?:\/|$))/

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const s = v.trim()
  return s ? s.slice(0, max) : null
}

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  // Always 204, even on bad input. A beacon that answers with an error teaches
  // the browser to retry it and can surface in the console of a page a
  // prospect is reading.
  const done = () => new NextResponse(null, { status: 204 })

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") return done()

    const event = str(body.event, 40)
    const path = str(body.path, 300)
    if (!event || !EVENTS.has(event)) return done()
    if (!path || !TRACKED_PATH.test(path)) return done()

    // sendBeacon always sends an Origin. If it is present and not ours, drop.
    const h = req.headers
    const origin = hostOf(h.get("origin"))
    const expected = hostOf(process.env.NEXT_PUBLIC_APP_URL ?? null)
    if (origin && expected && origin !== expected) return done()

    const ua = h.get("user-agent")
    const ip = clientIp(h)

    let step: number | null = null
    if (typeof body.step === "number" && Number.isFinite(body.step)) {
      step = Math.min(Math.max(Math.trunc(body.step), 0), 50)
    }

    let meta: unknown = null
    if (body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)) {
      const encoded = JSON.stringify(body.meta)
      if (encoded.length <= 2000) meta = body.meta
    }

    const db = createServiceRoleClient()
    const { error } = await db.from("site_events").insert({
      event,
      path,
      visitor_id: str(body.visitor_id, 64),
      session_id: str(body.session_id, 64),
      referrer: str(body.referrer, 500),
      utm_source: str(body.utm_source, 120),
      utm_medium: str(body.utm_medium, 120),
      utm_campaign: str(body.utm_campaign, 200),
      utm_content: str(body.utm_content, 200),
      utm_term: str(body.utm_term, 200),
      click_id: str(body.click_id, 255),
      step,
      step_key: str(body.step_key, 60),
      value: str(body.value, 120),
      meta,
      user_agent: ua ? ua.slice(0, 500) : null,
      device: deviceFromUserAgent(ua),
      country: countryFromHeaders(h),
      ip_hash: hashIp(ip),
      is_bot: isBotUserAgent(ua),
      is_internal: isInternalIp(ip),
    })

    // Logged, never surfaced. If the table is missing the page must still work.
    if (error) console.error("[track] insert failed:", error.message)
  } catch (err) {
    console.error("[track] unexpected:", err)
  }

  return done()
}
