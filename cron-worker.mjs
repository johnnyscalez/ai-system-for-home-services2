// Standalone cron worker — runs alongside the Next.js server on Railway.
// Calls /api/cron/follow-up every 5 minutes to fire pending follow-up sequences.
import cron from "node-cron"

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const SECRET   = process.env.CRON_SECRET ?? ""

async function runFollowUp() {
  try {
    const res = await fetch(`${APP_URL}/api/cron/follow-up`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    })
    const data = await res.json().catch(() => ({}))
    console.log(`[cron] follow-up: ${res.status}`, data)
  } catch (err) {
    console.error("[cron] follow-up error:", err.message)
  }
}

// Wait for Next.js to be ready before first run
const STARTUP_DELAY_MS = 20_000
setTimeout(() => {
  console.log("[cron] worker ready — running every 5 minutes")
  runFollowUp() // immediate first run after startup
  cron.schedule("*/5 * * * *", runFollowUp)
}, STARTUP_DELAY_MS)

console.log(`[cron] worker started, first run in ${STARTUP_DELAY_MS / 1000}s`)
