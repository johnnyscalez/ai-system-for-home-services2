// Zip → IANA timezone, so every CUSTOMER-FACING time renders in the
// customer's own clock.
//
// Root incident (Tasha Gaskin, Aug 2026): Top Air spans two timezones —
// Chicago office, Detroit-metro service area. Every window label,
// confirmation, and reminder rendered in company time, so a Michigan
// customer was told "10am–1pm" for what is physically an 11am–2pm arrival
// at her house — and Housecall Pro's own notification (correctly rendered
// in her timezone) contradicted us. The agent then confidently "corrected"
// her with the wrong time.
//
// Resolution is 3-digit zip prefix → timezone. Exact where FieldBuilt
// operates today (IL / MI / NW-Indiana corridor); split-timezone states
// elsewhere use the dominant zone with the well-known exceptions coded.
// Unknown prefix → null, caller falls back to the company timezone.

const ET = "America/New_York"
const CT = "America/Chicago"
const MT = "America/Denver"
const AZ = "America/Phoenix" // no DST
const PT = "America/Los_Angeles"

// prefix ranges [from, to] inclusive → tz. First match wins, so exceptions
// (FL panhandle, NW Indiana, El Paso…) are listed BEFORE their state range.
const RANGES: Array<[number, number, string]> = [
  // ── Exceptions first ──
  [463, 464, CT],  // NW Indiana (Gary/Hammond — Chicago metro)
  [324, 325, CT],  // FL panhandle (Panama City, Pensacola)
  [798, 799, MT],  // El Paso TX
  [885, 885, MT],  // El Paso TX
  [420, 424, CT],  // western Kentucky (Paducah–Bowling Green)
  [370, 372, CT],  // middle Tennessee (Nashville)
  [380, 385, CT],  // west Tennessee (Memphis–Jackson)
  [677, 679, MT],  // far-west Kansas
  [690, 693, MT],  // far-west Nebraska
  [577, 577, MT],  // western South Dakota (Rapid City)
  [586, 588, MT],  // western North Dakota
  [838, 838, PT],  // north Idaho (Coeur d'Alene)
  [979, 979, MT],  // eastern Oregon (Ontario)
  [498, 499, CT],  // western Upper Peninsula MI (Ironwood side)

  // ── Eastern ──
  [5, 5, ET],      // NY (Holtsville)
  [10, 27, ET],    // MA
  [28, 29, ET],    // RI
  [30, 38, ET],    // NH
  [39, 49, ET],    // ME
  [50, 59, ET],    // VT
  [60, 69, ET],    // CT
  [70, 89, ET],    // NJ
  [100, 149, ET],  // NY
  [150, 196, ET],  // PA
  [197, 199, ET],  // DE
  [200, 205, ET],  // DC
  [206, 219, ET],  // MD
  [220, 246, ET],  // VA
  [247, 268, ET],  // WV
  [270, 289, ET],  // NC
  [290, 299, ET],  // SC
  [300, 319, ET],  // GA
  [320, 349, ET],  // FL (after panhandle exception)
  [373, 379, ET],  // east Tennessee (Chattanooga, Knoxville)
  [398, 399, ET],  // GA
  [400, 427, ET],  // KY (after western exception)
  [430, 459, ET],  // OH
  [460, 479, ET],  // IN (after NW exception)
  [480, 499, ET],  // MI (after western-UP exception)

  // ── Central ──
  [350, 369, CT],  // AL
  [386, 397, CT],  // MS
  [500, 528, CT],  // IA
  [530, 549, CT],  // WI
  [550, 567, CT],  // MN
  [570, 577, CT],  // SD (east)
  [580, 588, CT],  // ND (east)
  [600, 629, CT],  // IL
  [630, 658, CT],  // MO
  [660, 679, CT],  // KS (east)
  [680, 693, CT],  // NE (east)
  [700, 714, CT],  // LA
  [716, 729, CT],  // AR
  [730, 749, CT],  // OK
  [750, 799, CT],  // TX (after El Paso exception)
  [885, 885, CT],  // (unreachable — kept for clarity)

  // ── Mountain ──
  [590, 599, MT],  // MT
  [800, 816, MT],  // CO
  [820, 831, MT],  // WY
  [832, 838, MT],  // ID (south)
  [840, 847, MT],  // UT
  [850, 865, AZ],  // AZ (no DST)
  [870, 884, MT],  // NM

  // ── Pacific ──
  [889, 898, PT],  // NV
  [900, 961, PT],  // CA
  [967, 968, "Pacific/Honolulu"], // HI
  [970, 979, PT],  // OR (after eastern exception)
  [980, 994, PT],  // WA
  [995, 999, "America/Anchorage"], // AK
]

/** IANA timezone for a US zip, or null when unknown. */
export function zipToTimeZone(zip: string | null | undefined): string | null {
  const z = zip?.match(/\d{5}/)?.[0]
  if (!z) return null
  const prefix = parseInt(z.slice(0, 3), 10)
  for (const [from, to, tz] of RANGES) {
    if (prefix >= from && prefix <= to) return tz
  }
  return null
}

/**
 * Timezone of a service address (LAST 5-digit group = the zip, matching the
 * system-wide extraction rule), falling back to the company timezone.
 * Use for EVERY customer-facing time: slot labels, confirmations, reminders,
 * quiet-hour gates. Owner/office-facing times stay in the company timezone.
 */
export function serviceTimeZone(address: string | null | undefined, fallbackTz: string): string {
  const groups = address?.match(/\b\d{5}\b/g)
  const zip = groups?.[groups.length - 1] ?? null
  return zipToTimeZone(zip) ?? fallbackTz
}
