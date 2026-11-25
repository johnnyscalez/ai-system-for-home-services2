// Named service areas: the owner types "Plano" and picks "Plano, TX" from a
// dropdown; nobody types zip codes. This file turns those named areas into the
// zip list the slot engine gates on (companies.service_area_zips) and talks to
// Google Places (New) for the dropdown.
//
// SERVER ONLY: it pulls in the zip centroid dataset through lib/routing. Client
// components import the state list from components/onboarding/constants.ts.

import type { ServiceAreaPlace } from "@/lib/intake"
import { zipsInBounds, zipsNearPoint, nearestZip } from "@/lib/routing"

// ── Zip derivation ───────────────────────────────────────────────────────────

/** When an area has a center but no usable bounding box, how far around it we reach. */
export const RADIUS_MILES_BY_KIND: Record<string, number> = {
  postal_code: 3,
  neighborhood: 4,
  locality: 10,
  county: 25,
}

// A city's viewport is its bounding box, and a zip's centroid can sit just
// outside the city limits it serves. Turning a real customer away as "outside
// our area" costs a measure, so the box is padded by roughly a mile and a half.
const VIEWPORT_PAD_DEG = 0.02

function areaCenter(area: ServiceAreaPlace): { lat: number; lng: number } | null {
  if (typeof area.lat === "number" && typeof area.lng === "number") return { lat: area.lat, lng: area.lng }
  const v = area.viewport
  if (v && [v.north, v.south, v.east, v.west].every((n) => typeof n === "number")) {
    return { lat: (v.north + v.south) / 2, lng: (v.east + v.west) / 2 }
  }
  return null
}

/** Zip codes covered by ONE named area. Typed areas (no geo) contribute none. */
export function zipsForArea(area: ServiceAreaPlace): string[] {
  const kind = area.kind ?? "locality"
  if (kind === "typed") return []
  const out = new Set<string>()

  if (kind === "postal_code") {
    const zip = area.name.match(/\b\d{5}\b/)?.[0]
    if (zip) out.add(zip)
  }

  const v = area.viewport
  const hasViewport = !!v && [v.north, v.south, v.east, v.west].every((n) => typeof n === "number")
  if (hasViewport && v) {
    const lngPad = VIEWPORT_PAD_DEG / Math.max(0.2, Math.cos((((v.north + v.south) / 2) * Math.PI) / 180))
    for (const z of zipsInBounds({
      north: v.north + VIEWPORT_PAD_DEG,
      south: v.south - VIEWPORT_PAD_DEG,
      east: v.east + lngPad,
      west: v.west - lngPad,
    })) out.add(z)
  }

  const center = areaCenter(area)
  if (center) {
    // Only a point, or a box so small no centroid fell inside it: reach by kind.
    if (!hasViewport || out.size === 0) {
      for (const z of zipsNearPoint(center, RADIUS_MILES_BY_KIND[kind] ?? RADIUS_MILES_BY_KIND.locality)) out.add(z)
    }
    // A small town must always map to the zip it sits in.
    const near = nearestZip(center)
    if (near) out.add(near)
  }
  return [...out].sort()
}

/**
 * The company's zip list, or null when ANY area has no zips behind it (typed by
 * hand, or a place Google returned without coordinates).
 *
 * Null tells the slot engine not to gate by zip at all; the assistant then
 * judges the service area from the named areas in its knowledge. It has to be
 * all or nothing: a list built from only some of the areas would make the zip
 * gate turn away every lead in the areas that are missing from it (found in the
 * first simulation: Plano and Frisco picked from the dropdown, McKinney typed,
 * and a McKinney homeowner would have been told they are outside the area).
 */
export function deriveServiceAreaZips(areas: ServiceAreaPlace[] | null | undefined): string[] | null {
  const out = new Set<string>()
  for (const area of areas ?? []) {
    const zips = zipsForArea(area)
    if (zips.length === 0) return null
    for (const z of zips) out.add(z)
  }
  return out.size > 0 ? [...out].sort() : null
}

/** "Plano, TX; Frisco, TX" for companies.service_area and the assistant's knowledge. */
export function serviceAreaText(areas: ServiceAreaPlace[] | null | undefined): string {
  return (areas ?? []).map((a) => a.name.trim()).filter(Boolean).join("; ")
}

// ── States ───────────────────────────────────────────────────────────────────

// Approximate bounding boxes [south, west, north, east]. Used only to BIAS the
// dropdown toward the owner's state; nothing is filtered by them, so an area in
// a neighbouring state can still be picked.
const STATE_BBOX: Record<string, [number, number, number, number]> = {
  AL: [30.14, -88.47, 35.01, -84.89], AK: [51.2, -179.15, 71.4, -129.98], AZ: [31.33, -114.82, 37.0, -109.05],
  AR: [33.0, -94.62, 36.5, -89.64], CA: [32.53, -124.41, 42.01, -114.13], CO: [36.99, -109.06, 41.0, -102.04],
  CT: [40.95, -73.73, 42.05, -71.79], DE: [38.45, -75.79, 39.84, -75.05], DC: [38.79, -77.12, 39.0, -76.91],
  FL: [24.4, -87.63, 31.0, -80.03], GA: [30.36, -85.61, 35.0, -80.84], HI: [18.91, -160.25, 22.24, -154.81],
  ID: [41.99, -117.24, 49.0, -111.04], IL: [36.97, -91.51, 42.51, -87.02], IN: [37.77, -88.1, 41.76, -84.78],
  IA: [40.38, -96.64, 43.5, -90.14], KS: [36.99, -102.05, 40.0, -94.59], KY: [36.5, -89.57, 39.15, -81.96],
  LA: [28.93, -94.04, 33.02, -88.82], ME: [43.06, -71.08, 47.46, -66.95], MD: [37.89, -79.49, 39.72, -75.05],
  MA: [41.24, -73.51, 42.89, -69.93], MI: [41.7, -90.42, 48.3, -82.41], MN: [43.5, -97.24, 49.38, -89.49],
  MS: [30.17, -91.66, 35.0, -88.1], MO: [35.99, -95.77, 40.61, -89.1], MT: [44.36, -116.05, 49.0, -104.04],
  NE: [40.0, -104.05, 43.0, -95.31], NV: [35.0, -120.01, 42.0, -114.04], NH: [42.7, -72.56, 45.31, -70.6],
  NJ: [38.93, -75.56, 41.36, -73.89], NM: [31.33, -109.05, 37.0, -103.0], NY: [40.5, -79.76, 45.02, -71.86],
  NC: [33.84, -84.32, 36.59, -75.46], ND: [45.94, -104.05, 49.0, -96.55], OH: [38.4, -84.82, 41.98, -80.52],
  OK: [33.62, -103.0, 37.0, -94.43], OR: [41.99, -124.57, 46.29, -116.46], PA: [39.72, -80.52, 42.27, -74.69],
  RI: [41.15, -71.86, 42.02, -71.12], SC: [32.03, -83.35, 35.22, -78.54], SD: [42.48, -104.06, 45.95, -96.44],
  TN: [34.98, -90.31, 36.68, -81.65], TX: [25.84, -106.65, 36.5, -93.51], UT: [36.99, -114.05, 42.0, -109.04],
  VT: [42.73, -73.44, 45.02, -71.46], VA: [36.54, -83.68, 39.47, -75.24], WA: [45.54, -124.85, 49.0, -116.92],
  WV: [37.2, -82.64, 40.64, -77.72], WI: [42.49, -92.89, 47.08, -86.25], WY: [40.99, -111.06, 45.01, -104.05],
}

export function isUsState(code: string | null | undefined): boolean {
  return !!code && code.toUpperCase() in STATE_BBOX
}

// ── Google Places (New) ──────────────────────────────────────────────────────

export type PlaceSuggestion = {
  placeId: string
  /** "Plano, TX" */
  text: string
  main: string
  secondary: string
  kind: string
}

const PLACES_BASE = "https://places.googleapis.com/v1"
const AREA_TYPES = ["locality", "sublocality", "neighborhood", "administrative_area_level_2", "postal_code"]

// When Google refuses the key (API not enabled, billing off), stop asking for
// ten minutes instead of failing on every keystroke.
let placesDownUntil = 0
let placesDownReason = ""
const DOWN_MS = 10 * 60 * 1000

function apiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY ?? ""
}

/** Google "types" to the kind we store on a ServiceAreaPlace. */
export function areaKindFromTypes(types: string[] | null | undefined): string {
  const t = types ?? []
  if (t.includes("postal_code")) return "postal_code"
  if (t.includes("administrative_area_level_2")) return "county"
  if (t.includes("neighborhood") || t.some((x) => x.startsWith("sublocality"))) return "neighborhood"
  return "locality"
}

function stripCountry(text: string): string {
  return text.replace(/,\s*(USA|United States)\s*$/i, "").trim()
}

type AutocompleteResult = { available: boolean; suggestions: PlaceSuggestion[]; reason?: string }

/**
 * Area suggestions for the service-area dropdown. `available: false` means
 * Google could not be used (no key, API not enabled, network): the UI then
 * falls back to typing areas by hand, it never blocks.
 */
export async function placesAutocomplete(
  query: string,
  stateCode: string | null,
  sessionToken: string | null
): Promise<AutocompleteResult> {
  const key = apiKey()
  if (!key) return { available: false, suggestions: [], reason: "GOOGLE_MAPS_API_KEY is not set" }
  if (Date.now() < placesDownUntil) return { available: false, suggestions: [], reason: placesDownReason }
  const input = query.trim().slice(0, 80)
  if (input.length < 2) return { available: true, suggestions: [] }

  const bbox = stateCode ? STATE_BBOX[stateCode.toUpperCase()] : undefined
  const request = async (primaryTypes: string[]) => {
    const body: Record<string, unknown> = {
      input,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: primaryTypes,
      languageCode: "en",
    }
    if (sessionToken) body.sessionToken = sessionToken
    if (bbox) {
      body.locationBias = {
        rectangle: {
          low: { latitude: bbox[0], longitude: bbox[1] },
          high: { latitude: bbox[2], longitude: bbox[3] },
        },
      }
    }
    return fetch(`${PLACES_BASE}/places:autocomplete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    })
  }

  try {
    let res = await request(AREA_TYPES)
    // Google has changed which type names autocomplete accepts before. If it
    // rejects the specific list, the regions collection covers the same ground.
    if (res.status === 400) res = await request(["(regions)"])
    const json = (await res.json().catch(() => ({}))) as {
      error?: { status?: string; message?: string }
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string
          text?: { text?: string }
          structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
          types?: string[]
        }
      }>
    }
    if (!res.ok || json.error) {
      const status = json.error?.status ?? `HTTP ${res.status}`
      const reason = `${status}: ${(json.error?.message ?? "").slice(0, 160)}`
      // A refusal of the key or the project will not fix itself between keystrokes.
      if (res.status === 403 || res.status === 401 || /PERMISSION_DENIED|UNAUTHENTICATED|REQUEST_DENIED/.test(status)) {
        placesDownUntil = Date.now() + DOWN_MS
        placesDownReason = reason
        console.warn(`[places] Google Places (New) refused the request, falling back to typed areas for 10 minutes: ${reason}`)
      }
      return { available: false, suggestions: [], reason }
    }
    const suggestions: PlaceSuggestion[] = []
    for (const s of json.suggestions ?? []) {
      const p = s.placePrediction
      if (!p?.placeId) continue
      const text = stripCountry(p.text?.text ?? "")
      if (!text) continue
      suggestions.push({
        placeId: p.placeId,
        text,
        main: p.structuredFormat?.mainText?.text ?? text,
        secondary: stripCountry(p.structuredFormat?.secondaryText?.text ?? ""),
        kind: areaKindFromTypes(p.types),
      })
    }
    return { available: true, suggestions: suggestions.slice(0, 6) }
  } catch (err) {
    return { available: false, suggestions: [], reason: `network: ${(err as Error)?.message ?? err}` }
  }
}

/** Center, bounding box and state for a picked suggestion. Null when Google cannot be reached. */
export async function placeDetails(placeId: string, sessionToken: string | null): Promise<ServiceAreaPlace | null> {
  const key = apiKey()
  if (!key || !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null
  try {
    const url = new URL(`${PLACES_BASE}/places/${placeId}`)
    if (sessionToken) url.searchParams.set("sessionToken", sessionToken)
    url.searchParams.set("languageCode", "en")
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location,viewport,types,addressComponents",
      },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const p = (await res.json()) as {
      id?: string
      displayName?: { text?: string }
      formattedAddress?: string
      location?: { latitude?: number; longitude?: number }
      viewport?: { low?: { latitude?: number; longitude?: number }; high?: { latitude?: number; longitude?: number } }
      types?: string[]
      addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>
    }
    const kind = areaKindFromTypes(p.types)
    const state = p.addressComponents?.find((c) => c.types?.includes("administrative_area_level_1"))?.shortText ?? null
    const display = p.displayName?.text?.trim() ?? ""
    const formatted = stripCountry(p.formattedAddress ?? "")
    const name =
      kind === "postal_code"
        ? formatted || display
        : display && state && !display.endsWith(`, ${state}`)
          ? `${display}, ${state}`
          : display || formatted
    if (!name) return null
    const v = p.viewport
    const viewport =
      v?.low && v?.high &&
      typeof v.low.latitude === "number" && typeof v.low.longitude === "number" &&
      typeof v.high.latitude === "number" && typeof v.high.longitude === "number"
        ? { south: v.low.latitude, west: v.low.longitude, north: v.high.latitude, east: v.high.longitude }
        : null
    return {
      name,
      state,
      placeId: p.id ?? placeId,
      lat: typeof p.location?.latitude === "number" ? p.location.latitude : null,
      lng: typeof p.location?.longitude === "number" ? p.location.longitude : null,
      kind,
      viewport,
    }
  } catch {
    return null
  }
}

// One cheap probe, cached, so the onboarding state can say up front whether the
// dropdown will have suggestions.
let probeAt = 0
let probeOk = false
export async function placesAvailable(): Promise<boolean> {
  if (!apiKey()) return false
  if (Date.now() - probeAt < DOWN_MS) return probeOk
  const r = await placesAutocomplete("Dallas", "TX", null)
  probeAt = Date.now()
  probeOk = r.available
  return probeOk
}
