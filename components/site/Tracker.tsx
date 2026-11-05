"use client"

// First-party traffic tracking for the marketing pages, mounted once in the
// root layout. Fires a page_view per path, forwards clicks on anything with a
// data-track attribute, and reports a section_view the first time a
// data-track-view element is scrolled into place.
//
// It exists because neither of the two sources we had tells the truth: Railway
// counts every crawler, the Meta Pixel counts only browsers that run Meta's
// script and keeps the answer inside Events Manager. Read these numbers with
// scripts/traffic-report.mjs.
//
// Storage is per-viewer and can throw or come back empty in a private window,
// so every read and write is wrapped and the page works without it. When
// storage is unavailable the server still has the hashed IP to group on.

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

const VISITOR_KEY = "fb_vid"
const SESSION_KEY = "fb_sid"
const ATTRIBUTION_KEY = "fb_attr"

// Must stay in step with TRACKED_PATH in app/api/track/route.ts. Anything the
// client sends for another path is dropped there anyway.
const TRACKED_PATH = /^\/(?:$|book$|optin$|privacy$|terms$|start(?:\/|$))/

type Attribution = {
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  click_id?: string
}

function uid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function readStore(store: "local" | "session", key: string): string | null {
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key)
  } catch {
    return null
  }
}

function writeStore(store: "local" | "session", key: string, value: string): void {
  try {
    ;(store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value)
  } catch {}
}

function identity(store: "local" | "session", key: string): string | undefined {
  const existing = readStore(store, key)
  if (existing) return existing
  const fresh = uid()
  writeStore(store, key, fresh)
  // Storage blocked: send nothing rather than a new id on every event, which
  // would read as a fresh visitor per pageview.
  return readStore(store, key) ? fresh : undefined
}

// Captured once per session from the landing URL, then replayed on every later
// event so a quiz submission still carries the campaign that paid for it.
function attribution(): Attribution {
  const stored = readStore("session", ATTRIBUTION_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as Attribution
    } catch {}
  }

  const params = new URLSearchParams(window.location.search)
  const attr: Attribution = {}
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const v = params.get(key)
    if (v) attr[key] = v.slice(0, 200)
  }
  const click = params.get("fbclid") ?? params.get("gclid") ?? params.get("ttclid")
  if (click) attr.click_id = click.slice(0, 255)

  // Only an outside referrer is acquisition. Our own pages are navigation.
  const ref = document.referrer
  if (ref) {
    try {
      if (new URL(ref).host !== window.location.host) attr.referrer = ref.slice(0, 500)
    } catch {}
  }

  writeStore("session", ATTRIBUTION_KEY, JSON.stringify(attr))
  return attr
}

export function track(event: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return
  if (!TRACKED_PATH.test(window.location.pathname)) return

  const body = JSON.stringify({
    event,
    path: window.location.pathname,
    visitor_id: identity("local", VISITOR_KEY),
    session_id: identity("session", SESSION_KEY),
    ...attribution(),
    ...payload,
  })

  // sendBeacon survives the page being closed or navigated away from, which is
  // exactly when the last event of a visit fires. The explicit Blob type keeps
  // it from arriving as text/plain, which req.json() would reject.
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))) return
    }
  } catch {}

  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {})
}

export function Tracker() {
  const pathname = usePathname()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || !TRACKED_PATH.test(pathname)) return
    // React remounts effects in development; one pageview per path, not two.
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    track("page_view")
  }, [pathname])

  // Delegated, so a new CTA only needs data-track="name" to be counted.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Element)) return
      const el = target.closest("[data-track]")
      if (!el) return
      const name = el.getAttribute("data-track")
      if (name) track("cta_click", { value: name })
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  // One section_view per name per page. Watches only what is in the DOM when
  // the path settles, which covers the server-rendered marketing sections.
  useEffect(() => {
    if (!pathname || !TRACKED_PATH.test(pathname)) return
    if (typeof IntersectionObserver === "undefined") return

    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-track-view]"))
    if (!nodes.length) return

    const seen = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const name = entry.target.getAttribute("data-track-view")
          io.unobserve(entry.target)
          if (!name || seen.has(name)) continue
          seen.add(name)
          track("section_view", { value: name })
        }
      },
      { threshold: 0.4 }
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [pathname])

  return null
}
