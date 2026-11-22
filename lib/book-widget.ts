import { parsePhoneNumberFromString } from "libphonenumber-js"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { createGhlAppointment, getGhlCalendar, type GhlCalendarConn } from "@/lib/ghl-calendar"

// ─────────────────────────────────────────────────────────────────────────────
// The /book calendar widget (components/site/BookingWidget.tsx) — server side.
//
// Replaces GHL's iframe booking widget with our own, reading and booking the
// SAME GHL calendar (FieldBuilt sales tenant's ghl_connections row). A booking
// made here is a normal GHL appointment, so GHL's "appointment status"
// workflow fires and the FieldBuilt SMS agent (separate project) picks the
// lead up exactly as it did for widget bookings.
//
// Written 2026-11-22. Qualification (Jonathan, 2026-11-22): annual revenue
// $0-$200K is not a fit; website is optional (no website → company + city).
// ─────────────────────────────────────────────────────────────────────────────

const GHL_BASE = "https://services.leadconnectorhq.com"

/** GHL custom field "FieldBuilt - Annual Revenue" (created 2026-11-22). */
const REVENUE_FIELD_ID = "w8lgrsSAaowtVW75xQoK"
/** GHL custom field "Lead Timezone (FieldBuilt agent)", read by the SMS agent. */
const LEAD_TZ_FIELD_ID = "KDrIe29JRF4Avpk684QG"

export const REVENUE_OPTIONS = ["$0-$200K", "$201K-$500K", "$500K-$1M", "$1M+"] as const
export type RevenueOption = (typeof REVENUE_OPTIONS)[number]
export const NOT_A_FIT_REVENUE: RevenueOption = "$0-$200K"

// ── connection (cached per server instance) ──────────────────────────────────
let connCache: { conn: GhlCalendarConn; at: number } | null = null

export async function getSalesCalendar(): Promise<GhlCalendarConn | null> {
  if (connCache && Date.now() - connCache.at < 10 * 60_000) return connCache.conn
  const db = createServiceRoleClient()
  const { data: co } = await db
    .from("companies")
    .select("id")
    .eq("service_type", "fieldbuilt_sales")
    .limit(1)
    .maybeSingle()
  if (!co) return null
  const conn = await getGhlCalendar(co.id)
  if (conn) connCache = { conn, at: Date.now() }
  return conn
}

// ── free slots ───────────────────────────────────────────────────────────────
// Every open start time as a UTC ISO instant. The browser groups and renders
// them in the visitor's own time zone. Cached briefly so a burst of visitors
// doesn't hit GHL once each; the booking call always re-checks fresh.
const SLOT_TTL_MS = 60_000
let slotCache: { slots: string[]; at: number } | null = null

export async function getOpenSlots(opts: { fresh?: boolean } = {}): Promise<string[] | null> {
  if (!opts.fresh && slotCache && Date.now() - slotCache.at < SLOT_TTL_MS) return slotCache.slots
  const conn = await getSalesCalendar()
  if (!conn) return null
  const start = Date.now()
  const end = start + 14 * 24 * 60 * 60_000 // GHL caps this at the calendar's own booking window
  const res = await fetch(
    `${GHL_BASE}/calendars/${conn.calendar_id}/free-slots?startDate=${start}&endDate=${end}&timezone=UTC`,
    { headers: { Authorization: `Bearer ${conn.api_key}`, Version: "2021-04-15" }, cache: "no-store" }
  )
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    console.error("[book-widget] free-slots failed", res.status, JSON.stringify(json).slice(0, 300))
    return null
  }
  const minStart = Date.now() + 30 * 60_000 // never a slot starting in the next half hour
  const slots = Object.keys(json)
    .filter((k) => k !== "traceId")
    .flatMap((k) => ((json[k] as { slots?: string[] } | undefined)?.slots ?? []))
    .map((s) => Date.parse(s))
    .filter((ms) => !Number.isNaN(ms) && ms >= minStart)
    .sort((a, b) => a - b)
    .map((ms) => new Date(ms).toISOString())
  const unique = [...new Set(slots)]
  slotCache = { slots: unique, at: Date.now() }
  return unique
}

export function invalidateSlots() {
  slotCache = null
}

// ── input validation ─────────────────────────────────────────────────────────
export function toE164(raw: string): string | null {
  const p = parsePhoneNumberFromString(raw.trim(), "US")
  return p?.isValid() ? p.format("E.164") : null
}

export function cleanWebsite(raw: string): string | null {
  let s = raw.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    if (!u.hostname.includes(".")) return null
    return u.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// ── contact + appointment ────────────────────────────────────────────────────
export type BookingInput = {
  firstName: string
  phone: string // E.164
  email: string
  revenue: RevenueOption
  website: string | null
  company: string | null
  city: string | null
  state: string | null
  timeZone: string
  startIso: string
}

async function upsertContact(conn: GhlCalendarConn, b: BookingInput): Promise<string | null> {
  const body: Record<string, unknown> = {
    locationId: conn.location_id,
    firstName: b.firstName,
    phone: b.phone,
    email: b.email,
    timezone: b.timeZone,
    // No tags or source here: GHL's upsert REPLACES them, which wiped an existing
    // lead's tags (fb-demo-sent etc.) and his ad source in the 2026-11-22 test.
    // Both are added below without touching what's there.
    customFields: [
      { id: REVENUE_FIELD_ID, field_value: b.revenue },
      { id: LEAD_TZ_FIELD_ID, field_value: b.timeZone },
    ],
  }
  if (b.website) body.website = b.website
  if (b.company) body.companyName = b.company
  if (b.city) body.city = b.city
  if (b.state) body.state = b.state

  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.api_key}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { contact?: { id?: string }; new?: boolean }
  if (!res.ok || !json.contact?.id) {
    console.error("[book-widget] contact upsert failed", res.status, JSON.stringify(json).slice(0, 300))
    return null
  }
  const id = json.contact.id
  const h = { Authorization: `Bearer ${conn.api_key}`, Version: "2021-07-28", "Content-Type": "application/json" }
  // Adds the tag to his existing ones (this endpoint never removes any).
  await fetch(`${GHL_BASE}/contacts/${id}/tags`, { method: "POST", headers: h, body: JSON.stringify({ tags: ["book-widget"] }) })
    .catch((err) => console.error("[book-widget] tag failed", err))
  // Source only for a brand-new contact: a lead from an ad keeps his ad as the source.
  if (json.new) {
    await fetch(`${GHL_BASE}/contacts/${id}`, { method: "PUT", headers: h, body: JSON.stringify({ source: "fieldbuiltai.com/book" }) })
      .catch((err) => console.error("[book-widget] source failed", err))
  }
  return id
}

export type BookResult =
  | { ok: true; startIso: string; contactId: string; appointmentId: string }
  | { ok: false; reason: "slot_taken"; slots: string[] }
  | { ok: false; reason: "unavailable" }

export async function bookWalkthrough(b: BookingInput): Promise<BookResult> {
  const conn = await getSalesCalendar()
  if (!conn) return { ok: false, reason: "unavailable" }

  // The slot list on screen can be a few minutes old. Re-check against GHL
  // right now so two visitors can't both take the same time.
  const fresh = await getOpenSlots({ fresh: true })
  if (!fresh) return { ok: false, reason: "unavailable" }
  const wanted = Date.parse(b.startIso)
  if (!fresh.some((s) => Date.parse(s) === wanted)) return { ok: false, reason: "slot_taken", slots: fresh }

  const contactId = await upsertContact(conn, b)
  if (!contactId) return { ok: false, reason: "unavailable" }

  const appt = await createGhlAppointment(conn, {
    contactId,
    startTimeIso: new Date(wanted).toISOString(),
    title: `FieldBuilt walkthrough: ${b.company ?? b.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") ?? b.firstName}`,
    leadTimezone: b.timeZone,
  })
  if (!appt?.id) return { ok: false, reason: "unavailable" }

  invalidateSlots()
  return { ok: true, startIso: new Date(wanted).toISOString(), contactId, appointmentId: appt.id }
}
