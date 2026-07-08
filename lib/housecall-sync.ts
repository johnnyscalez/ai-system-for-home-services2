import { createServiceRoleClient } from "@/lib/supabase-server"
import { getHcpClient, HcpClient, HcpCustomer, HcpJob } from "@/lib/housecall"

// ─────────────────────────────────────────────────────────────────────────────
// Housecall Pro synchronization engine — the single code path for all flows.
// See docs/hcp-sync-map.md for the full design.
//
//   Flow A (outbound): pushBookingToHcp()   — AI books → job appears in HCP
//   Flow B (inbound):  upsertJobFromHcp()   — HCP webhooks → our system
//   Flow C (cron):     reconcileCompany()   — periodic truth pass, shares B's logic
//   Flow D:            importTechnicians()  — HCP employees → our technicians
//   Flow E:            findJobsForLead()    — jobs lookup by lead identity
// ─────────────────────────────────────────────────────────────────────────────

const AI_TAG = "FieldBuilt AI"
const DEFAULT_JOB_HOURS = 2
const ARRIVAL_WINDOW_MIN = 60

type Db = ReturnType<typeof createServiceRoleClient>

// ── Identity resolution: our lead → their customer ───────────────────────────

function last10(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10)
}

// "FieldBuilt AI" as a lead source must exist in the HCP account before it can
// be referenced on customers/jobs. Ensured once per process per company.
const leadSourceReady = new Map<string, boolean>()

async function ensureLeadSource(client: HcpClient, companyId: string): Promise<string | undefined> {
  if (leadSourceReady.get(companyId)) return AI_TAG
  try {
    const res = await client.get<{ lead_sources?: Array<{ id?: string; name?: string }> }>("/lead_sources?page_size=100")
    const exists = (res.lead_sources ?? []).some((s) => (s.name ?? "").toLowerCase() === AI_TAG.toLowerCase())
    if (!exists) await client.post("/lead_sources", { name: AI_TAG })
    leadSourceReady.set(companyId, true)
    return AI_TAG
  } catch {
    // Account may not allow lead-source management — omit rather than fail bookings
    return undefined
  }
}

function customerPhoneMatches(c: HcpCustomer, digits: string): boolean {
  if (!digits) return false
  const fields = [c.mobile_number, (c as Record<string, unknown>).home_number, (c as Record<string, unknown>).work_number]
  return fields.some((f) => typeof f === "string" && f.replace(/\D/g, "").slice(-10) === digits)
}

async function searchCustomers(client: HcpClient, q: string): Promise<HcpCustomer[]> {
  if (!q.trim()) return []
  const res = await client.get<{ customers?: HcpCustomer[] }>(`/customers?q=${encodeURIComponent(q)}&page_size=25`)
  return res.customers ?? []
}

/**
 * Matching rules from the sync map, first hit wins:
 * stored id → phone → email → unambiguous name → create.
 */
export async function resolveOrCreateCustomer(
  db: Db,
  client: HcpClient,
  lead: { id: string; first_name: string | null; last_name: string | null; phone: string; email: string | null; address: string | null; hcp_customer_id: string | null }
): Promise<string> {
  if (lead.hcp_customer_id) return lead.hcp_customer_id

  const digits = last10(lead.phone)
  let found: HcpCustomer | undefined

  // 2. Phone
  if (digits) {
    const byPhone = await searchCustomers(client, digits)
    found = byPhone.find((c) => customerPhoneMatches(c, digits))
  }

  // 3. Email
  if (!found && lead.email) {
    const byEmail = await searchCustomers(client, lead.email)
    found = byEmail.find((c) => (c.email ?? "").toLowerCase() === lead.email!.toLowerCase())
  }

  // 4. Name — only trust an exact single hit
  if (!found && lead.first_name) {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ")
    const byName = await searchCustomers(client, name)
    const exact = byName.filter((c) =>
      (c.first_name ?? "").toLowerCase() === (lead.first_name ?? "").toLowerCase() &&
      (c.last_name ?? "").toLowerCase() === (lead.last_name ?? "").toLowerCase()
    )
    if (exact.length === 1) found = exact[0]
  }

  // 5. Create
  if (!found) {
    const addr = parseAddress(lead.address)
    const leadSource = await ensureLeadSource(client, lead.id)
    found = await client.post<HcpCustomer>("/customers", {
      first_name: lead.first_name ?? "Unknown",
      last_name: lead.last_name ?? "",
      mobile_number: lead.phone,
      email: lead.email || undefined,
      lead_source: leadSource,
      addresses: addr ? [addr] : undefined,
    })
  }

  await db.from("leads").update({ hcp_customer_id: found.id }).eq("id", lead.id)
  return found.id
}

// Best-effort parse of a freeform US address string
function parseAddress(address: string | null): { street: string; city?: string; state?: string; zip?: string } | null {
  if (!address?.trim()) return null
  const zip = address.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1]
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean)
  const street = parts[0] ?? address.trim()
  const city = parts.length > 1 ? parts[1].replace(/\b\d{5}(-\d{4})?\b/, "").trim() || undefined : undefined
  const state = address.match(/\b([A-Z]{2})\b(?=[^a-z]*(\d{5})?\s*$)/)?.[1]
  return { street, city, state, zip }
}

export async function ensureServiceAddress(
  client: HcpClient,
  customerId: string,
  address: string | null
): Promise<string | null> {
  const { addresses } = await client.get<{ addresses?: Array<{ id: string; street?: string }> }>(
    `/customers/${customerId}/addresses`
  )
  const parsed = parseAddress(address)
  if (!parsed) return addresses?.[0]?.id ?? null

  const streetLower = parsed.street.toLowerCase()
  const existing = addresses?.find((a) => (a.street ?? "").toLowerCase() === streetLower)
  if (existing) return existing.id

  const created = await client.post<{ id: string }>(`/customers/${customerId}/addresses`, {
    ...parsed,
    type: "service",
  })
  return created.id
}

// ── Flow A: push an AI booking into HCP ───────────────────────────────────────

export async function pushBookingToHcp(appointmentId: string): Promise<{ pushed: boolean; reason?: string }> {
  const db = createServiceRoleClient()

  const { data: apt } = await db
    .from("appointments")
    .select("id, company_id, lead_id, scheduled_at, address, notes, status, technician_id, technician_name, hcp_job_id, origin")
    .eq("id", appointmentId)
    .maybeSingle()
  if (!apt) return { pushed: false, reason: "appointment not found" }
  if (apt.hcp_job_id) return { pushed: false, reason: "already synced" }
  if (apt.origin === "hcp") return { pushed: false, reason: "originated in HCP" }
  if (apt.status !== "scheduled") return { pushed: false, reason: `status ${apt.status}` }

  const { data: company } = await db
    .from("companies").select("integration_mode").eq("id", apt.company_id).single()
  if (company?.integration_mode !== "housecall_pro") return { pushed: false, reason: "standalone mode" }

  const client = await getHcpClient(apt.company_id)
  if (!client) return { pushed: false, reason: "no HCP connection" }

  const { data: lead } = await db
    .from("leads")
    .select("id, first_name, last_name, phone, email, address, job_type, source, hcp_customer_id")
    .eq("id", apt.lead_id)
    .single()
  if (!lead) return { pushed: false, reason: "lead not found" }

  const customerId = await resolveOrCreateCustomer(db, client, lead)
  const addressId = await ensureServiceAddress(client, customerId, apt.address ?? lead.address)

  // Map our assigned tech → HCP employee
  let hcpEmployeeIds: string[] | undefined
  if (apt.technician_id) {
    const { data: tech } = await db
      .from("technicians").select("hcp_employee_id").eq("id", apt.technician_id).maybeSingle()
    if (tech?.hcp_employee_id) hcpEmployeeIds = [tech.hcp_employee_id]
  }

  const start = new Date(apt.scheduled_at)
  const end = new Date(start.getTime() + DEFAULT_JOB_HOURS * 60 * 60 * 1000)

  const noteLines = [
    `BOOKED BY ${AI_TAG}`,
    lead.job_type ? `Job type: ${lead.job_type}` : null,
    lead.source ? `Lead source: ${lead.source}` : null,
    apt.notes ? `Summary: ${apt.notes}` : null,
    `Full conversation transcript in the FieldBuilt dashboard.`,
  ].filter(Boolean)

  const leadSource = await ensureLeadSource(client, apt.company_id)
  const job = await client.post<HcpJob>("/jobs", {
    customer_id: customerId,
    address_id: addressId ?? undefined,
    schedule: {
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      arrival_window: ARRIVAL_WINDOW_MIN,
    },
    assigned_employee_ids: hcpEmployeeIds,
    tags: [AI_TAG, ...(lead.job_type ? [lead.job_type] : [])],
    lead_source: leadSource,
    description: lead.job_type ?? "Service call",
    notes: noteLines.join("\n"),
  })

  await db.from("appointments").update({
    hcp_job_id: job.id,
    hcp_synced_at: new Date().toISOString(),
  }).eq("id", apt.id)

  return { pushed: true }
}

// ── Flow B/C shared: bring one HCP job into coherence with our system ─────────

function mapWorkStatus(workStatus: string | undefined): "scheduled" | "completed" | "cancelled" | null {
  const s = (workStatus ?? "").toLowerCase()
  if (/cancel/.test(s)) return "cancelled"
  if (/complet|finish/.test(s)) return "completed"
  if (/schedul|progress|way|started|needs/.test(s)) return "scheduled"
  return null
}

async function jobAmountCents(client: HcpClient, job: HcpJob): Promise<number | null> {
  // Prefer invoice totals; fall back to the job's total_amount (cents)
  try {
    const res = await client.get<{ invoices?: Array<{ amount?: number; status?: string }> }>(
      `/jobs/${job.id}/invoices`
    )
    const sum = (res.invoices ?? []).reduce((s, inv) => s + (Number(inv.amount) || 0), 0)
    if (sum > 0) return Math.round(sum)
  } catch { /* invoices endpoint unavailable → fall through */ }
  return typeof job.total_amount === "number" && job.total_amount > 0 ? Math.round(job.total_amount) : null
}

export async function upsertJobFromHcp(
  companyId: string,
  client: HcpClient,
  job: HcpJob,
  eventType: string
): Promise<"updated" | "imported" | "unmatched"> {
  const db = createServiceRoleClient()
  const jobStatus = mapWorkStatus(job.work_status)
  const customerId = job.customer?.id ?? null
  const scheduledStart = job.schedule?.scheduled_start ?? null

  // Resolve the lead this job belongs to (if any)
  let leadId: string | null = null
  if (customerId) {
    const { data: lead } = await db
      .from("leads").select("id").eq("company_id", companyId).eq("hcp_customer_id", customerId).maybeSingle()
    leadId = lead?.id ?? null
  }

  // 1. Our appointment for this job?
  const { data: ourApt } = await db
    .from("appointments")
    .select("id, lead_id, scheduled_at, status, origin")
    .eq("company_id", companyId)
    .eq("hcp_job_id", job.id)
    .maybeSingle()

  let outcome: "updated" | "imported" | "unmatched" = "unmatched"
  let attribution: string = "unattributed"

  if (ourApt) {
    outcome = "updated"
    attribution = ourApt.origin === "ai" ? "booked_by_ai" : "sourced_by_ai"
    leadId = ourApt.lead_id

    const updates: Record<string, unknown> = { hcp_synced_at: new Date().toISOString() }

    if (scheduledStart && new Date(scheduledStart).getTime() !== new Date(ourApt.scheduled_at).getTime()) {
      updates.scheduled_at = scheduledStart
      updates.rescheduled_from = ourApt.scheduled_at
      updates.hcp_manually_edited = true
      // Rescheduled in HCP → reminder clocks restart
      Object.assign(updates, {
        reminder_2d_email_sent: false, reminder_2d_sms_sent: false,
        reminder_1d_email_sent: false, reminder_1d_sms_sent: false,
        reminder_2h_email_sent: false, reminder_2h_sms_sent: false,
      })
    }

    if (jobStatus === "cancelled" && ourApt.status !== "cancelled") {
      updates.status = "cancelled"
      updates.cancelled_at = new Date().toISOString()
      updates.cancellation_reason = "Cancelled in Housecall Pro"
      updates.hcp_manually_edited = true
      await db.from("leads").update({ status: "needs_attention" }).eq("id", ourApt.lead_id)
    }

    // Sync tech reassignment done by the office
    const hcpTechId = job.assigned_employees?.[0]?.id ?? (job as { schedule?: { appointments?: Array<{ dispatched_employees_ids?: string[] }> } }).schedule?.appointments?.[0]?.dispatched_employees_ids?.[0]
    if (hcpTechId) {
      const { data: tech } = await db
        .from("technicians").select("id, name").eq("company_id", companyId).eq("hcp_employee_id", hcpTechId).maybeSingle()
      if (tech) { updates.technician_id = tech.id; updates.technician_name = tech.name }
    }

    if (/updated|rescheduled/.test(eventType) && !updates.scheduled_at && !updates.status) {
      updates.hcp_manually_edited = true
    }

    await db.from("appointments").update(updates).eq("id", ourApt.id)
  } else if (leadId) {
    // 2. Office-created job for an AI-sourced lead → import it (origin 'hcp').
    // Reminder/confirmation flags pre-set: the office owns this job's comms.
    outcome = "imported"
    attribution = "sourced_by_ai"
    if (scheduledStart && jobStatus !== "cancelled") {
      await db.from("appointments").insert({
        company_id: companyId,
        lead_id: leadId,
        scheduled_at: scheduledStart,
        status: jobStatus ?? "scheduled",
        origin: "hcp",
        hcp_job_id: job.id,
        hcp_synced_at: new Date().toISOString(),
        notes: "Created in Housecall Pro by the office",
        confirmation_status: "confirmed",
        confirmation_sms_sent: true, confirmation_email_sent: true,
        reminder_2d_email_sent: true, reminder_2d_sms_sent: true,
        reminder_1d_email_sent: true, reminder_1d_sms_sent: true,
        reminder_2h_email_sent: true, reminder_2h_sms_sent: true,
      })
    }
  }

  // 3. Money: completed job → real closed revenue on the lead
  let amountCents: number | null = null
  if (jobStatus === "completed" && leadId) {
    amountCents = await jobAmountCents(client, job)
    if (amountCents && amountCents > 0) {
      await db.from("leads").update({
        status: "closed_won",
        deal_value: Math.round(amountCents / 100),
        closed_at: new Date().toISOString(),
      }).eq("id", leadId).neq("status", "closed_won")
    }
  }

  // 4. Audit trail (idempotent-ish: skip exact duplicates of same job+event)
  const { count } = await db
    .from("hcp_revenue_events")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("hcp_job_id", job.id)
    .eq("event_type", eventType)
  if ((count ?? 0) === 0) {
    await db.from("hcp_revenue_events").insert({
      company_id: companyId,
      lead_id: leadId,
      hcp_customer_id: customerId,
      hcp_job_id: job.id,
      event_type: eventType,
      amount_cents: amountCents,
      attribution: leadId ? attribution : "unattributed",
      raw_payload: { work_status: job.work_status, scheduled_start: scheduledStart },
    })
  }

  return outcome
}

// ── Flow D: technicians — pull HCP employees into our system ─────────────────

export async function importTechnicians(companyId: string, client: HcpClient): Promise<number> {
  const db = createServiceRoleClient()
  const res = await client.get<{ employees?: Array<{ id: string; first_name?: string; last_name?: string; email?: string; mobile_number?: string; role?: string }> }>(
    "/employees?page_size=100"
  )
  let upserted = 0
  for (const emp of res.employees ?? []) {
    const name = [emp.first_name, emp.last_name].filter(Boolean).join(" ") || "Unnamed tech"
    const { data: existing } = await db
      .from("technicians").select("id").eq("company_id", companyId).eq("hcp_employee_id", emp.id).maybeSingle()
    if (existing) {
      await db.from("technicians").update({ name, email: emp.email ?? null, phone: emp.mobile_number ?? null }).eq("id", existing.id)
    } else {
      // New import: zip codes / specializations stay empty — dispatch config is FieldBuilt-side
      await db.from("technicians").insert({
        company_id: companyId,
        hcp_employee_id: emp.id,
        name,
        email: emp.email ?? null,
        phone: emp.mobile_number ?? null,
        status: "active",
        serves_all_areas: true,
        notes: `Imported from Housecall Pro (${emp.role ?? "employee"})`,
      })
    }
    upserted++
  }
  return upserted
}

// ── Flow E: find HCP jobs by lead identity ────────────────────────────────────

export async function findJobsForLead(companyId: string, leadId: string): Promise<HcpJob[]> {
  const db = createServiceRoleClient()
  const client = await getHcpClient(companyId)
  if (!client) return []

  const { data: lead } = await db
    .from("leads")
    .select("id, first_name, last_name, phone, email, address, hcp_customer_id")
    .eq("id", leadId)
    .single()
  if (!lead) return []

  let customerId = lead.hcp_customer_id
  if (!customerId) {
    // Resolve without creating — read-only lookup
    const digits = last10(lead.phone)
    const candidates = digits ? await searchCustomers(client, digits) : []
    let found = candidates.find((c) => customerPhoneMatches(c, digits))
    if (!found && lead.email) {
      found = (await searchCustomers(client, lead.email)).find(
        (c) => (c.email ?? "").toLowerCase() === lead.email!.toLowerCase()
      )
    }
    if (!found) return []
    customerId = found.id
    await db.from("leads").update({ hcp_customer_id: customerId }).eq("id", leadId)
  }

  const res = await client.get<{ jobs?: HcpJob[] }>(`/jobs?customer_id=${customerId}&page_size=50`)
  return res.jobs ?? []
}

// ── Webhook registration ──────────────────────────────────────────────────────

const WEBHOOK_EVENTS = ["job.created", "job.updated", "job.completed", "job.canceled", "customer.created"]

export async function registerWebhooks(companyId: string, client: HcpClient): Promise<void> {
  const db = createServiceRoleClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return

  try {
    const res = await client.post<{ id?: string }>("/webhooks", {
      url: `${appUrl}/api/webhooks/housecall?companyId=${companyId}`,
      events: WEBHOOK_EVENTS,
    })
    await db.from("hcp_connections")
      .update({ hcp_webhook_id: res.id ?? "registered" })
      .eq("company_id", companyId)
  } catch (err) {
    // Not fatal — reconciliation cron keeps sync true without webhooks
    console.warn(`[hcp-sync] webhook registration failed for ${companyId}:`, err)
  }
}

// ── Flow C: reconciliation — the periodic truth pass ──────────────────────────

export async function reconcileCompany(companyId: string): Promise<{
  jobsProcessed: number; techsImported: number; pushRetries: number
}> {
  const db = createServiceRoleClient()
  const client = await getHcpClient(companyId)
  if (!client) return { jobsProcessed: 0, techsImported: 0, pushRetries: 0 }

  const { data: conn } = await db
    .from("hcp_connections")
    .select("last_synced_at, hcp_webhook_id")
    .eq("company_id", companyId)
    .single()

  // Ensure webhooks are registered (idempotent from our side)
  if (!conn?.hcp_webhook_id) await registerWebhooks(companyId, client)

  // Keep the tech roster fresh
  const techsImported = await importTechnicians(companyId, client)

  // Walk everything HCP changed since the last pass
  const since = conn?.last_synced_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let jobsProcessed = 0
  for (let page = 1; page <= 5; page++) {
    const res = await client.get<{ jobs?: HcpJob[]; total_pages?: number }>(
      `/jobs?updated_after=${encodeURIComponent(since)}&page=${page}&page_size=50`
    )
    const jobs = res.jobs ?? []
    for (const job of jobs) {
      await upsertJobFromHcp(companyId, client, job, "reconcile")
      jobsProcessed++
    }
    if (jobs.length < 50 || (res.total_pages && page >= res.total_pages)) break
  }

  // Retry AI bookings that never made it into HCP (Flow A failures)
  const { data: unpushed } = await db
    .from("appointments")
    .select("id")
    .eq("company_id", companyId)
    .eq("origin", "ai")
    .eq("status", "scheduled")
    .is("hcp_job_id", null)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(20)

  let pushRetries = 0
  for (const apt of unpushed ?? []) {
    const result = await pushBookingToHcp(apt.id).catch(() => ({ pushed: false }))
    if (result.pushed) pushRetries++
  }

  await db.from("hcp_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("company_id", companyId)

  return { jobsProcessed, techsImported, pushRetries }
}
