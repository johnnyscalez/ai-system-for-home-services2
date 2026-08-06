import zipCentroids from "@/lib/data/zip-centroids.json"

// ─────────────────────────────────────────────────────────────────────────────
// Route-aware dispatch — pure code, no external APIs.
//
// Geo resolution: US Census ZCTA centroids (2013, public domain) embedded at
// lib/data/zip-centroids.json. Zip-level precision (~2–4 miles) is exactly the
// resolution routing decisions need: it reliably distinguishes "10 minutes
// away" from "an hour across the metro", which is the whole game.
//
// The scheduling model is the classic VRPTW *insertion heuristic*: when
// considering a new job in a tech's day, the cost is the EXTRA drive time it
// adds between its neighbors:
//
//   cost = drive(prev → new) + drive(new → next) − drive(prev → next)
//
// where prev/next are the tech's adjacent jobs that day, anchored by the
// office at the start and end of the day. Slots whose best assignment exceeds
// MAX_INSERTION_MIN are never offered to the lead.
// ─────────────────────────────────────────────────────────────────────────────

export type GeoPoint = { lat: number; lng: number }

const ZIPS = zipCentroids as unknown as Record<string, [number, number]>

// Straight-line → road-distance conversion. 1.3 is the standard circuity
// factor for US metro road networks; 28 mph blends city/suburban driving.
const ROAD_CIRCUITY = 1.3
const AVG_MPH = 28

/**
 * Relative slack: a slot is suppressed when its insertion cost exceeds the
 * lead's BEST available slot by more than this. Relative — not absolute — so
 * far-away-but-served customers stay bookable (their unavoidable drive exists
 * on every slot and cancels out); only badly-SEQUENCED slots get hidden.
 */
export const ROUTE_SLACK_MIN = 40

// The centroid dataset is US Census ZCTAs (~33k), which omit PO-box-only and
// single-building zips (20500, 60197, 30301, ...). A business whose address
// carries one of those would otherwise resolve to nothing — no service area,
// no routing anchor, silently. So when an exact zip is missing we fall back to
// the centroid of every zip sharing its 3-digit prefix (the sectional center
// facility, ~10-30 mile accuracy) — more than precise enough for a radius
// measured in tens of miles. Built once, lazily.
let prefixCentroids: Record<string, GeoPoint> | null = null
function prefixCentroid(zip5: string): GeoPoint | null {
  if (!prefixCentroids) {
    const acc: Record<string, { lat: number; lng: number; n: number }> = {}
    for (const [z, [lat, lng]] of Object.entries(ZIPS)) {
      const p = z.slice(0, 3)
      const a = acc[p] ?? (acc[p] = { lat: 0, lng: 0, n: 0 })
      a.lat += lat; a.lng += lng; a.n += 1
    }
    prefixCentroids = {}
    for (const [p, a] of Object.entries(acc)) {
      prefixCentroids[p] = { lat: a.lat / a.n, lng: a.lng / a.n }
    }
  }
  return prefixCentroids[zip5.slice(0, 3)] ?? null
}

export function zipToPoint(zip: string | null | undefined): GeoPoint | null {
  if (!zip) return null
  const zip5 = zip.slice(0, 5)
  const hit = ZIPS[zip5]
  if (hit) return { lat: hit[0], lng: hit[1] }
  return prefixCentroid(zip5)
}

/** Extract a 5-digit zip from a freeform address string. */
export function zipFromAddress(address: string | null | undefined): string | null {
  // Take the LAST 5-digit group: US addresses put the zip at the end, and
  // 5-digit STREET numbers are common ("29901 Common Rd ... 48066" — the
  // first-match version returned 29901, a South Carolina zip, which broke
  // tech assignment for a Michigan booking in live testing).
  if (!address) return null
  const matches = [...address.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)]
  if (!matches.length) return null
  const last = matches[matches.length - 1]
  // A LONE 5-digit group that opens the string and is followed by a street
  // name is a house number, not a zip ("13496 Melanie Dr., Sterling Heights,
  // MI" pushed zip 13496 — Utica NY — into Housecall Pro live). No zip beats
  // a wrong zip: callers treat null as unknown, never as a location. A bare
  // "48313" (zip-only address) has nothing after it and stays a zip.
  if (matches.length === 1) {
    const idx = last.index ?? 0
    const before = address.slice(0, idx).trim()
    const after = address.slice(idx + last[0].length).trim()
    if (before === "" && /^[A-Za-z]/.test(after)) return null
  }
  return last[1]
}

export function addressToPoint(address: string | null | undefined): GeoPoint | null {
  return zipToPoint(zipFromAddress(address))
}

/** A dispatchable service address: it has a STREET (house number + name, or a
 *  PO Box line) — a bare zip is NOT an address. Live: a Messenger lead's whole
 *  address was "60706"; the booking, the HCP job, and the confirmation SMS all
 *  carried just the zip while the real street sat unstored in the thread. */
export function isCompleteServiceAddress(address: string | null | undefined): boolean {
  if (!address?.trim()) return false
  if (/\bp\.?\s*o\.?\s*box\s*\d+/i.test(address)) return true
  // Remove the zip (zipFromAddress already refuses to treat a leading house
  // number as a zip), then look for a house-number + street-name pattern.
  let t = address
  const zip = zipFromAddress(address)
  if (zip) {
    const idx = t.lastIndexOf(zip)
    if (idx >= 0) t = t.slice(0, idx) + t.slice(idx + zip.length)
  }
  return /\b\d{1,6}\s+[A-Za-z]/.test(t)
}

/**
 * All US zips whose centroid lies within `radiusMiles` of the given center
 * zip. Straight-line distance on ZCTA centroids — the same resolution the
 * dispatch engine routes with. Full scan of ~33k centroids is <5ms.
 * Returns [] when the center zip is unknown.
 */
export function zipsWithinRadius(centerZip: string | null | undefined, radiusMiles: number): string[] {
  const center = zipToPoint(centerZip)
  if (!center || !(radiusMiles > 0)) return []
  const out: string[] = []
  for (const [zip, [lat, lng]] of Object.entries(ZIPS)) {
    if (haversineMiles(center, { lat, lng }) <= radiusMiles) out.push(zip)
  }
  return out.sort()
}

function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.8
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Estimated drive minutes between two points. */
export function estimateDriveMin(a: GeoPoint, b: GeoPoint): number {
  return (haversineMiles(a, b) * ROAD_CIRCUITY * 60) / AVG_MPH
}

export type LocatedJob = { startMs: number; endMs: number; point: GeoPoint | null }

/**
 * Insertion cost (extra drive minutes) of adding a job at `point` in the
 * window [slotStartMs, slotEndMs] to a tech's day.
 *
 * prev = the job ending latest at/before the slot; next = the job starting
 * earliest at/after it. Missing neighbors anchor to the office; jobs with
 * unknown location are skipped (never punish what we can't measure).
 * Returns 0 when nothing is measurable — routing should never block a booking
 * it has no information about.
 */
export function insertionCostMin(
  dayJobs: LocatedJob[],
  office: GeoPoint | null,
  point: GeoPoint | null,
  slotStartMs: number,
  slotEndMs: number
): number {
  if (!point) return 0

  let prev: LocatedJob | null = null
  let next: LocatedJob | null = null
  for (const j of dayJobs) {
    if (j.endMs <= slotStartMs && (!prev || j.endMs > prev.endMs)) prev = j
    if (j.startMs >= slotEndMs && (!next || j.startMs < next.startMs)) next = j
  }

  const prevPoint = prev?.point ?? office
  const nextPoint = next?.point ?? office

  if (prevPoint && nextPoint) {
    return Math.max(
      0,
      estimateDriveMin(prevPoint, point) +
        estimateDriveMin(point, nextPoint) -
        estimateDriveMin(prevPoint, nextPoint)
    )
  }
  if (prevPoint) return estimateDriveMin(prevPoint, point)
  if (nextPoint) return estimateDriveMin(point, nextPoint)
  return 0
}

/** Same local calendar day in a timezone — insertion only competes within a day. */
export function sameLocalDay(aMs: number, bMs: number, tz: string): boolean {
  const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: tz })
  return fmt(aMs) === fmt(bMs)
}

/**
 * Overtime penalty: if this would be the tech's LAST job of the day, he still
 * has to drive back to the office. Minutes past the scheduled day end count
 * against the slot — this is what kills "last job was near the office at 4 PM,
 * now drive an hour out at 5:30" without punishing far customers booked at
 * sane times of day.
 */
export function returnOvertimeMin(
  point: GeoPoint | null,
  office: GeoPoint | null,
  slotEndMs: number,
  dayEndMs: number,
  isLastJobOfDay: boolean
): number {
  if (!point || !office || !isLastJobOfDay) return 0
  const backAtOffice = slotEndMs + estimateDriveMin(point, office) * 60_000
  return Math.max(0, (backAtOffice - dayEndMs) / 60_000)
}
