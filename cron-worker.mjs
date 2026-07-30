// Standalone cron worker — runs alongside the Next.js server on Railway.
import cron from "node-cron"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const SECRET  = process.env.CRON_SECRET ?? ""

async function runFollowUp() {
  try {
    const res  = await fetch(`${APP_URL}/api/cron/follow-up`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    })
    const data = await res.json().catch(() => ({}))
    console.log(`[cron] follow-up: ${res.status}`, data)
  } catch (err) {
    console.error("[cron] follow-up error:", err.message)
  }
}

async function runAppointmentReminders() {
  try {
    const res  = await fetch(`${APP_URL}/api/cron/appointment-reminders`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    })
    const data = await res.json().catch(() => ({}))
    console.log(`[cron] appointment-reminders: ${res.status}`, data)
  } catch (err) {
    console.error("[cron] appointment-reminders error:", err.message)
  }
}

async function runHcpSync() {
  try {
    const res  = await fetch(`${APP_URL}/api/cron/hcp-sync`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    })
    const data = await res.json().catch(() => ({}))
    console.log(`[cron] hcp-sync: ${res.status}`, data)
  } catch (err) {
    console.error("[cron] hcp-sync error:", err.message)
  }
}

// Wait for Next.js to be ready before first run
const STARTUP_DELAY_MS = 20_000
setTimeout(() => {
  console.log("[cron] worker ready")

  // Follow-up sequences — every 5 minutes
  runFollowUp()
  cron.schedule("*/5 * * * *", runFollowUp)

  // Appointment reminders + confirmation requests — every 10 minutes
  runAppointmentReminders()
  cron.schedule("*/10 * * * *", runAppointmentReminders)

  // Housecall Pro reconcile — every 15 minutes. This is the ONLY sync path
  // (HCP's public API has no webhook registration), so if this doesn't run,
  // office-side cancels/completions never reach us and failed booking pushes
  // are never retried (audit C4: it was never scheduled — sync was dead).
  runHcpSync()
  cron.schedule("*/15 * * * *", runHcpSync)
}, STARTUP_DELAY_MS)

console.log(`[cron] worker started, first run in ${STARTUP_DELAY_MS / 1000}s`)
