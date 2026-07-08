# Housecall Pro ↔ FieldBuilt — Full Synchronization Map

Verified against the live API (Bearer auth, confirmed 2026-07-08) and the
buildwithbeacon/housecallpro-mcp endpoint reference.

## Entity mapping

| FieldBuilt | Housecall Pro | Link | Exists? |
|---|---|---|---|
| `leads` | Customers (`cus_…`) | `leads.hcp_customer_id` | ✅ |
| `appointments` | Jobs (`job_…`) | `appointments.hcp_job_id`, `hcp_synced_at`, `hcp_manually_edited` | ✅ |
| `technicians` | Employees (`pro_…`) | `technicians.hcp_employee_id` | ❌ **missing** |
| closed revenue | Job invoices / completed jobs | `leads.deal_value` + `hcp_revenue_events` | ✅ |
| conversation summary | Job notes (`nte_…`) + description | written at job creation | code |
| AI fingerprint | Job `tags: ["FieldBuilt AI"]` + `lead_source: "FieldBuilt AI"` | filterable in HCP UI + API | code |

## Matching rules (lead ↔ customer)

Resolution order, first hit wins:
1. `leads.hcp_customer_id` already stored (fast path)
2. Phone — last 10 digits vs customer `mobile_number`/`home_number`/`work_number` (`GET /customers?q=<digits>`)
3. Email — exact, case-insensitive (`GET /customers?q=<email>`)
4. Name — `first_name + last_name` (weakest; only accepted if exactly one result)
5. No match → `POST /customers` (name, mobile_number, email, address) → store `hcp_customer_id`

Same resolver runs in both directions (our lead → their customer; their webhook → our lead).

## Flow A — AI books → job in HCP (outbound)

Trigger: `book_appointment` tool call in the AI engine, company in `housecall_pro` mode.

1. Resolve/create customer (rules above) → `hcp_customer_id` on the lead
2. Ensure service address (`POST /customers/{id}/addresses` if the lead's address isn't on file)
3. **Match technician** (v1 rules; route optimization deferred):
   - zip of job address ∈ `technicians.zip_codes` (or `serves_all_areas`)
   - job type ∈ `technicians.specializations` (when set)
   - availability: `GET /jobs?employee_id=…&scheduled_start_min/max=<that day>` — skip techs with a conflicting job in the window
   - tie-break: fewest jobs that day; fallback: company default tech
4. `POST /jobs`: customer_id, address_id, schedule (start/end/arrival_window),
   `assigned_employee_ids: [pro_…]`, `tags: ["FieldBuilt AI", <job_type>]`,
   `lead_source: "FieldBuilt AI"`, `notes: <conversation summary>`
5. Stamp our appointment: `hcp_job_id`, `hcp_synced_at`, `technician_id/name`
6. Tech + owner notifications (existing flows unchanged)

If HCP is down/errors: appointment still books locally, flagged "Not synced";
reconciliation (Flow C) pushes it on the next pass. Booking never fails because HCP hiccuped.

## Flow B — HCP → FieldBuilt (inbound, webhooks)

Registration is programmatic: `POST /webhooks { url, events }` per connected company →
`…/api/webhooks/housecall?companyId=<uuid>`. Events: `job.created`, `job.updated`,
`job.completed`, `job.canceled`, `customer.created` (exact availability confirmed at registration;
anything unsupported is covered by Flow C).

| Event | Our job (hcp_job_id known) | AI-sourced customer, not our job | No match |
|---|---|---|---|
| `job.updated` | Sync `scheduled_at`/status/tech onto our appointment, set `hcp_manually_edited`, reset reminders on reschedule | mirror-update imported row | log only |
| `job.canceled` / deleted | Cancel our appointment (`cancellation_reason: "Cancelled in Housecall Pro"`), lead → `needs_attention` | mirror-cancel | log only |
| `job.created` (by office) | n/a | **Import** as appointment row (`origin: 'hcp'`) + `sourced_by_ai` revenue event | log only |
| `job.completed` | Pull `GET /jobs/{id}/invoices` → amount → `hcp_revenue_events` (`booked_by_ai`), `leads.deal_value`, `closed_at`, status `closed_won` | same, attribution `sourced_by_ai` | log only |
| `customer.created` | — | try phone/email match to un-linked leads → set `hcp_customer_id` | log only |

## Flow C — Reconciliation cron (the coherence guarantee)

Webhooks get missed, unsubscribed, or throttled. Every 15 minutes per connected company:

1. `GET /jobs?updated_after=<hcp_connections.last_synced_at>` (paginated)
2. Each job runs through the exact same upsert logic as Flow B (shared module — one code path)
3. Our synced appointments whose `hcp_job_id` no longer fetches (404) → treat as deleted in HCP
4. Local appointments in HCP-mode companies missing `hcp_job_id` (failed Flow A push) → retry push
5. Update `hcp_connections.last_synced_at`

Webhooks make sync fast; the cron makes it **true**.

## Flow D — Technician sync

- **Pull (works):** `GET /employees` → upsert `technicians` by `hcp_employee_id`
  (name, email, phone, role). Zip codes, specializations, and schedules remain
  FieldBuilt-side config — HCP has no equivalent fields.
- **Push (NOT supported):** the public API has **no create-employee endpoint** —
  employees are paid seats managed in HCP's UI. Workflow: owner adds the tech in HCP →
  FieldBuilt "Sync from Housecall Pro" imports them → dispatch profile (zips/skills)
  configured on our side.

## Flow E — Find jobs by lead fields

`findJobsForLead(lead)`: resolve customer (phone → email → name) → `GET /jobs?customer_id=…`
→ normalized list (schedule, status, tech, amount). Powers reconciliation, attribution
backfill, and lead-detail views.

## Deferred (explicitly, by founder decision)

- Route-aware dispatch: same-day route distance optimization needs the office address,
  geocoding of job addresses, and drive-time estimates. The v1 tie-break (fewest jobs
  that day) leaves the door open; revisit after pilot.
- Deeper on-call rotations / working-hours-per-tech: `technicians.schedule` jsonb exists, unused in v1.
