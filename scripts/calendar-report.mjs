#!/usr/bin/env node
// The /book calendar funnel: how many people saw the calendar, how they
// answered the revenue question, how many were NOT a fit, how many picked a
// time and how many booked, plus which ad each group came from.
//
// Run: node --env-file=.env.local scripts/calendar-report.mjs [--days=N | --since=YYYY-MM-DD]
//
// Data: public.site_events, written by components/site/BookingWidget.tsx via
// the Tracker (step_key cal_revenue / cal_not_a_fit / cal_website /
// cal_time_picked / cal_booked / cal_book_failed). One person = one visitor_id
// (falls back to session_id, then ip_hash). Bots and our own IPs are excluded.
// Not-a-fit visitors never give contact details, so they are counted, not named.
// Written 2026-11-22.

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) {
  console.error("Run with: node --env-file=.env.local scripts/calendar-report.mjs")
  process.exit(1)
}

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const days = Number(arg("days", 30))
const sinceArg = arg("since", null)
const since = sinceArg ? new Date(`${sinceArg}T00:00:00Z`) : new Date(Date.now() - days * 86400_000)

async function fetchAll() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const qs = new URLSearchParams({
      select: "created_at,event,value,step_key,visitor_id,session_id,ip_hash,utm_content,utm_campaign,is_bot,is_internal",
      path: "eq./book",
      created_at: `gte.${since.toISOString()}`,
      order: "created_at.asc",
    })
    const res = await fetch(`${URL_BASE}/rest/v1/site_events?${qs}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` },
    })
    if (!res.ok) throw new Error(`site_events read failed: HTTP ${res.status} ${await res.text()}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows.filter((r) => !r.is_bot && !r.is_internal)
}

const who = (r) => r.visitor_id || r.session_id || r.ip_hash || "unknown"
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "-")

const rows = await fetchAll()
const people = (pred) => new Set(rows.filter(pred).map(who))

const sawCalendar = people((r) => r.event === "section_view" && r.value === "calendar")
const answered = people((r) => r.step_key === "cal_revenue")
const notFit = people((r) => r.step_key === "cal_not_a_fit")
const website = people((r) => r.step_key === "cal_website")
const picked = people((r) => r.step_key === "cal_time_picked")
const booked = people((r) => r.step_key === "cal_booked")
const failed = people((r) => r.step_key === "cal_book_failed")

// Each person's LAST revenue answer (they can go back and change it).
const lastRevenue = new Map()
for (const r of rows) if (r.step_key === "cal_revenue") lastRevenue.set(who(r), r.value)
const byBucket = {}
for (const v of lastRevenue.values()) byBucket[v] = (byBucket[v] ?? 0) + 1

const noSite = people((r) => r.step_key === "cal_website" && r.value === "company_name")

console.log(`\n/book calendar, since ${since.toISOString().slice(0, 10)} (people, bots and our own IPs excluded)\n`)
console.log(`  Saw the calendar           ${sawCalendar.size}`)
console.log(`  Answered revenue           ${answered.size}   (${pct(answered.size, sawCalendar.size)} of those who saw it)`)
for (const b of ["$0-$200K", "$201K-$500K", "$500K-$1M", "$1M+"]) console.log(`     ${b.padEnd(14)}         ${byBucket[b] ?? 0}`)
console.log(`  NOT A FIT (under $200K)    ${notFit.size}   (${pct(notFit.size, answered.size)} of those who answered)`)
console.log(`  Answered website           ${website.size}   (no website: ${noSite.size})`)
console.log(`  Picked a time              ${picked.size}`)
console.log(`  BOOKED                     ${booked.size}   (${pct(booked.size, answered.size - notFit.size)} of qualified answers)`)
if (failed.size) console.log(`  Booking errors             ${failed.size}`)

// Which ad sent the qualified vs the not-a-fit people.
const adOf = new Map()
for (const r of rows) if (r.utm_content && !adOf.has(who(r))) adOf.set(who(r), r.utm_content)
const byAd = {}
for (const p of answered) {
  const ad = adOf.get(p) ?? "(no ad / direct)"
  byAd[ad] ??= { answered: 0, notFit: 0, booked: 0 }
  byAd[ad].answered++
  if (notFit.has(p)) byAd[ad].notFit++
  if (booked.has(p)) byAd[ad].booked++
}
const ads = Object.entries(byAd).sort((a, b) => b[1].answered - a[1].answered)
if (ads.length) {
  console.log(`\n  By ad (answered / not a fit / booked)`)
  for (const [ad, c] of ads) console.log(`     ${String(c.answered).padStart(3)} / ${String(c.notFit).padStart(3)} / ${String(c.booked).padStart(3)}   ${ad}`)
}
console.log("")
