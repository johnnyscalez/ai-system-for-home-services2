import { NextRequest, NextResponse } from "next/server"
import {
  NOT_A_FIT_REVENUE,
  REVENUE_OPTIONS,
  bookWalkthrough,
  cleanWebsite,
  isValidTimeZone,
  toE164,
  type RevenueOption,
} from "@/lib/book-widget"

// Books a walkthrough from the /book widget: creates or updates the GHL
// contact (revenue, website or company + city, time zone) and the appointment
// on the sales calendar. Public by necessity, so every field is validated
// here, a honeypot field catches simple bots, and one IP can book only a few
// times per hour.

export const runtime = "nodejs"

const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60_000)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > 5
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a bit." }, { status: 429 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 })
  if (str(body.company_fax, 100)) return NextResponse.json({ ok: true }) // honeypot: pretend success

  const revenue = str(body.revenue, 20) as RevenueOption
  if (!REVENUE_OPTIONS.includes(revenue)) return NextResponse.json({ error: "Pick your yearly revenue." }, { status: 400 })
  if (revenue === NOT_A_FIT_REVENUE) return NextResponse.json({ error: "not_a_fit" }, { status: 422 })

  const noWebsite = body.noWebsite === true
  const website = noWebsite ? null : cleanWebsite(str(body.website, 300))
  const company = str(body.company, 120) || null
  const cityState = str(body.cityState, 120)
  const [city, state] = cityState.split(",").map((s) => s.trim())
  if (!noWebsite && !website) return NextResponse.json({ error: "Enter your website, or pick “No website”." }, { status: 400 })
  if (noWebsite && !company) return NextResponse.json({ error: "Enter your company name." }, { status: 400 })

  const firstName = str(body.firstName, 60)
  const phone = toE164(str(body.phone, 40))
  const email = str(body.email, 200)
  if (!firstName) return NextResponse.json({ error: "Enter your first name." }, { status: 400 })
  if (!phone) return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 })

  const timeZone = str(body.timeZone, 64)
  const startIso = str(body.startIso, 40)
  if (!isValidTimeZone(timeZone)) return NextResponse.json({ error: "Bad time zone." }, { status: 400 })
  if (Number.isNaN(Date.parse(startIso))) return NextResponse.json({ error: "Pick a time." }, { status: 400 })

  const result = await bookWalkthrough({
    firstName,
    phone,
    email,
    revenue,
    website,
    company,
    city: city || null,
    state: state || null,
    timeZone,
    startIso,
  })

  if (result.ok) return NextResponse.json({ ok: true, startIso: result.startIso })
  if (result.reason === "slot_taken")
    return NextResponse.json({ error: "slot_taken", slots: result.slots }, { status: 409 })
  return NextResponse.json({ error: "We couldn't book that right now. Please try again." }, { status: 502 })
}
