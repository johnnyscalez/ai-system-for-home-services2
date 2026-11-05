// Server-side helpers for /api/track. Kept out of the route so the report
// script and any future reader classify traffic exactly the same way.

import { createHash } from "node:crypto"

// Anything reaching /api/track already ran JavaScript, so the crawlers that
// flooded the Railway edge logs never get here. These are the ones that do:
// headless browsers, preview renderers and the crawlers that execute scripts.
const BOT_UA =
  /bot\b|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|curl\/|wget|python-requests|aiohttp|axios|node-fetch|go-http|java\/|okhttp|facebookexternalhit|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitoring|scrapy|semrush|ahrefs|petalbot|dataforseo|seranking|seznambot|qopfinder|preview/i

export function isBotUserAgent(ua: string | null): boolean {
  // A browser always sends a user agent. Nothing that omits it is a prospect.
  if (!ua) return true
  return BOT_UA.test(ua)
}

export function deviceFromUserAgent(ua: string | null): string | null {
  if (!ua) return null
  if (/ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(ua)) return "tablet"
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "mobile"
  return "desktop"
}

export function clientIp(h: Headers): string | null {
  const xff = h.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? null
}

// We store a hash, never the address. Enough to notice one person reloading
// five times, useless for identifying who they are. The salt is a secret that
// never leaves the server, so the hashes cannot be undone by walking the IPv4
// space. Rotating the salt resets visitor matching, which is why it is pinned
// to a value that already outlives deploys.
export function hashIp(ip: string | null): string | null {
  if (!ip) return null
  const salt = process.env.TRACKING_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex").slice(0, 32)
}

// Our own machines. Set TRACKING_EXCLUDE_IPS to a comma-separated list so
// deploy checks and the office do not land in the traffic numbers.
export function isInternalIp(ip: string | null): boolean {
  if (!ip) return false
  const raw = process.env.TRACKING_EXCLUDE_IPS
  if (!raw) return false
  return raw.split(",").map((s) => s.trim()).filter(Boolean).includes(ip)
}

export function countryFromHeaders(h: Headers): string | null {
  const c =
    h.get("cf-ipcountry") ??
    h.get("x-vercel-ip-country") ??
    h.get("x-country-code") ??
    null
  // Cloudflare sends XX when it cannot tell, and T1 for Tor.
  if (!c || c === "XX") return null
  return c.slice(0, 2).toUpperCase()
}
