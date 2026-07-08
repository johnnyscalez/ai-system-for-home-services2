import { createServiceRoleClient } from "@/lib/supabase-server"

// ─────────────────────────────────────────────────────────────────────────────
// Housecall Pro Public API client
//
// Docs: https://docs.housecallpro.com (Stoplight)
// Access: contractor generates an API key in HCP (MAX/XL plan required).
//
// The exact auth header scheme is confirmed empirically on first connect via
// validateHcpKey() — it probes the documented candidates and persists the one
// that works on the company's hcp_connections row. All subsequent calls reuse it.
// ─────────────────────────────────────────────────────────────────────────────

const HCP_BASE_URL = process.env.HCP_API_BASE_URL ?? "https://api.housecallpro.com"

export type HcpAuthScheme = "bearer" | "token" | "api-key"

function authHeaders(scheme: HcpAuthScheme, apiKey: string): Record<string, string> {
  switch (scheme) {
    case "bearer":  return { Authorization: `Bearer ${apiKey}` }
    case "token":   return { Authorization: `Token ${apiKey}` }
    case "api-key": return { "Api-Key": apiKey }
  }
}

export class HcpError extends Error {
  status: number
  body: string
  constructor(status: number, body: string, message?: string) {
    super(message ?? `HCP API error ${status}`)
    this.status = status
    this.body = body
  }
}

async function hcpFetch<T>(
  path: string,
  opts: { apiKey: string; scheme: HcpAuthScheme; method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${HCP_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...authHeaders(opts.scheme, opts.apiKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  const text = await res.text()
  if (!res.ok) throw new HcpError(res.status, text)
  return (text ? JSON.parse(text) : {}) as T
}

// ── Key validation ───────────────────────────────────────────────────────────
// Probes auth schemes against GET /employees (harmless read). Returns the
// working scheme, or a diagnosis of why every scheme failed.

export type HcpValidationResult =
  | { ok: true; scheme: HcpAuthScheme; sample: unknown }
  | { ok: false; attempts: Array<{ scheme: HcpAuthScheme; status: number; body: string }> }

export async function validateHcpKey(apiKey: string): Promise<HcpValidationResult> {
  const attempts: Array<{ scheme: HcpAuthScheme; status: number; body: string }> = []

  for (const scheme of ["bearer", "token", "api-key"] as HcpAuthScheme[]) {
    try {
      const sample = await hcpFetch<unknown>("/employees?page_size=1", { apiKey, scheme })
      return { ok: true, scheme, sample }
    } catch (err) {
      if (err instanceof HcpError) {
        attempts.push({ scheme, status: err.status, body: err.body.slice(0, 300) })
        // 401/403 → wrong scheme or bad key, try next. Anything else → real signal, stop probing.
        if (err.status !== 401 && err.status !== 403) break
      } else {
        attempts.push({ scheme, status: 0, body: String(err).slice(0, 300) })
        break
      }
    }
  }
  return { ok: false, attempts }
}

// ── Company-scoped client ────────────────────────────────────────────────────

export type HcpClient = {
  get:  <T>(path: string) => Promise<T>
  post: <T>(path: string, body: unknown) => Promise<T>
  put:  <T>(path: string, body: unknown) => Promise<T>
}

export async function getHcpClient(companyId: string): Promise<HcpClient | null> {
  const db = createServiceRoleClient()
  const { data: conn } = await db
    .from("hcp_connections")
    .select("api_key, auth_scheme, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle()

  if (!conn?.api_key) return null

  let scheme = (conn.auth_scheme as HcpAuthScheme | null) ?? null
  if (!scheme) {
    const result = await validateHcpKey(conn.api_key)
    if (!result.ok) return null
    scheme = result.scheme
    await db
      .from("hcp_connections")
      .update({ auth_scheme: scheme, last_validated_at: new Date().toISOString() })
      .eq("company_id", companyId)
  }

  const apiKey = conn.api_key
  const s = scheme
  return {
    get:  <T>(path: string) => hcpFetch<T>(path, { apiKey, scheme: s }),
    post: <T>(path: string, body: unknown) => hcpFetch<T>(path, { apiKey, scheme: s, method: "POST", body }),
    put:  <T>(path: string, body: unknown) => hcpFetch<T>(path, { apiKey, scheme: s, method: "PUT", body }),
  }
}

// ── Typed helpers (shapes confirmed against live API during pilot) ───────────

export type HcpEmployee = {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  mobile_number?: string
  role?: string
  [k: string]: unknown
}

export type HcpCustomer = {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  mobile_number?: string
  addresses?: Array<{ id: string; street?: string; city?: string; state?: string; zip?: string }>
  [k: string]: unknown
}

export type HcpJob = {
  id: string
  customer?: { id: string }
  schedule?: { scheduled_start?: string; scheduled_end?: string }
  assigned_employees?: Array<{ id: string }>
  work_status?: string
  total_amount?: number
  invoice_number?: string
  [k: string]: unknown
}

export async function listEmployees(client: HcpClient): Promise<HcpEmployee[]> {
  const res = await client.get<{ employees?: HcpEmployee[]; data?: HcpEmployee[] }>("/employees")
  return res.employees ?? res.data ?? []
}

export async function searchCustomersByPhone(client: HcpClient, phone: string): Promise<HcpCustomer[]> {
  const q = encodeURIComponent(phone.replace(/\D/g, "").slice(-10))
  const res = await client.get<{ customers?: HcpCustomer[]; data?: HcpCustomer[] }>(`/customers?q=${q}`)
  return res.customers ?? res.data ?? []
}

export async function createCustomer(
  client: HcpClient,
  input: {
    first_name: string
    last_name?: string
    mobile_number: string
    email?: string
    address?: { street: string; city?: string; state?: string; zip?: string }
  }
): Promise<HcpCustomer> {
  return client.post<HcpCustomer>("/customers", {
    first_name: input.first_name,
    last_name: input.last_name ?? "",
    mobile_number: input.mobile_number,
    email: input.email,
    addresses: input.address ? [input.address] : undefined,
  })
}

export async function createJob(
  client: HcpClient,
  input: {
    customer_id: string
    address_id?: string
    scheduled_start: string  // ISO
    scheduled_end: string    // ISO
    assigned_employee_ids?: string[]
    description?: string
    notes?: string
  }
): Promise<HcpJob> {
  return client.post<HcpJob>("/jobs", {
    customer_id: input.customer_id,
    address_id: input.address_id,
    schedule: {
      scheduled_start: input.scheduled_start,
      scheduled_end: input.scheduled_end,
      arrival_window: 0,
    },
    assigned_employee_ids: input.assigned_employee_ids,
    description: input.description,
    notes: input.notes,
  })
}

export async function getJob(client: HcpClient, jobId: string): Promise<HcpJob> {
  return client.get<HcpJob>(`/jobs/${jobId}`)
}
