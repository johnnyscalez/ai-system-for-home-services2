/**
 * Live end-to-end test of the HCP sync engine (dev tool — safe on test accounts only).
 * Usage: npx tsx --env-file=.env.local scripts/test-hcp-sync.ts
 */
import { createServiceRoleClient } from "../lib/supabase-server"
import { pushBookingToHcp, findJobsForLead, reconcileCompany } from "../lib/housecall-sync"

const COMPANY = "436e5f50-ad1b-42b5-a050-a702cc374618"

async function main() {
  const db = createServiceRoleClient()

  const { data: lead, error: le } = await db.from("leads").insert({
    company_id: COMPANY,
    first_name: "SyncTest",
    last_name: "Homeowner",
    phone: "+13125550188",
    email: "synctest@example.com",
    address: "701 S Harrison Ave, Kankakee, IL 60901",
    source: "facebook",
    channel: "sms",
    status: "appointment_booked",
    job_type: "ac_repair",
  }).select("id").single()
  if (le) throw le
  console.log("lead created:", lead!.id)

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  tomorrow.setHours(14, 0, 0, 0)
  const { data: apt, error: ae } = await db.from("appointments").insert({
    company_id: COMPANY,
    lead_id: lead!.id,
    scheduled_at: tomorrow.toISOString(),
    address: "701 S Harrison Ave, Kankakee, IL 60901",
    notes: "AC not cooling, unit running but warm air. Homeowner confirmed.",
    status: "scheduled",
    origin: "ai",
  }).select("id").single()
  if (ae) throw ae
  console.log("appointment created:", apt!.id)

  const push = await pushBookingToHcp(apt!.id)
  console.log("PUSH RESULT:", JSON.stringify(push))

  const { data: aptAfter } = await db.from("appointments").select("hcp_job_id, hcp_synced_at").eq("id", apt!.id).single()
  console.log("appointment after push:", JSON.stringify(aptAfter))

  const { data: leadAfter } = await db.from("leads").select("hcp_customer_id").eq("id", lead!.id).single()
  console.log("lead after push:", JSON.stringify(leadAfter))

  const jobs = await findJobsForLead(COMPANY, lead!.id)
  console.log(`FIND JOBS: ${jobs.length} job(s):`, jobs.map(j => `${j.id} ${j.work_status} ${j.schedule?.scheduled_start}`).join(" | "))

  const rec = await reconcileCompany(COMPANY)
  console.log("RECONCILE:", JSON.stringify(rec))

  const { data: techs } = await db.from("technicians").select("name, hcp_employee_id").eq("company_id", COMPANY).not("hcp_employee_id", "is", null)
  console.log("techs with HCP mapping:", JSON.stringify(techs))
}

main().catch(e => { console.error("FAILED:", e); process.exit(1) })
