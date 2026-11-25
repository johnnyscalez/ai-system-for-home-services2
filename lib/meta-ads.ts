// Meta (Facebook) connection helpers and ad reporting.
//
// Two rows describe a company's Facebook connection:
//   integrations (type = "facebook")  the Page: page token, selected lead forms,
//                                     lead counters, plus `fb_pages_cache`, a jsonb
//                                     holding everything the OAuth round trip found
//                                     (pages with their tokens, ad accounts, selected
//                                     form names). It never leaves the server.
//   facebook_connections              the ad account: `fb_ad_account_id` and the
//                                     long-lived USER token in `access_token`.
//                                     Ad insights need the user token; a page token
//                                     cannot read an ad account.
//
// Lead counting rule (never double count): Meta reports the same lead under several
// overlapping action types. We use `lead` when present: it is the "Leads" column in
// Ads Manager and already aggregates on-Facebook forms, Messenger leads and pixel
// leads. Only when it is absent do we fall back to `onsite_conversion.lead_grouped`
// (on-Facebook leads only), then the legacy `leadgen_grouped`. Never a sum.

import { createServiceRoleClient } from "@/lib/supabase-server"

export const GRAPH = "https://graph.facebook.com/v21.0"

// Where the connect wizard sends the owner when it is done. A fixed list, never a
// URL: the value travels through Facebook in `state` and comes back to us untrusted.
export const FB_RETURN_TARGETS = ["integrations", "onboarding"] as const
export type FbReturnTarget = (typeof FB_RETURN_TARGETS)[number]

export function parseFbReturnTarget(raw: string | null | undefined): FbReturnTarget {
  return (FB_RETURN_TARGETS as readonly string[]).includes(raw ?? "") ? (raw as FbReturnTarget) : "integrations"
}

/** Where to land after the wizard, with what happened. */
export function fbReturnUrl(target: FbReturnTarget, outcome: "connected" | "skipped" | "error", reason?: string): string {
  if (target === "onboarding") {
    return `/onboarding?fb=${outcome}${reason ? `&fb_reason=${encodeURIComponent(reason)}` : ""}`
  }
  if (outcome === "connected") return "/integrations?success=facebook"
  if (outcome === "error") return `/integrations?error=${encodeURIComponent(reason ?? "facebook_denied")}`
  return "/integrations"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any }

// ── Is `ads_read` safe to ask for? ───────────────────────────────────────────
// Asking Facebook for a permission the Meta app does not have breaks the login
// window for the very people who can connect today ("Invalid Scopes: ads_read"),
// which would take lead sync down with it. So the scope is requested only once the
// Meta app actually carries the permission. Checked against the app itself
// (GET /{app-id}/permissions, app token) and cached; FACEBOOK_ADS_READ=on|off
// forces it either way. Any doubt means "do not ask": leads matter more than ad data.
let adsReadCheck: { at: number; ok: boolean } | null = null
const ADS_READ_CHECK_MS = 10 * 60 * 1000

export async function adsReadRequestable(): Promise<boolean> {
  const forced = (process.env.FACEBOOK_ADS_READ ?? "").toLowerCase()
  if (forced === "on" || forced === "true") return true
  if (forced === "off" || forced === "false") return false
  if (adsReadCheck && Date.now() - adsReadCheck.at < ADS_READ_CHECK_MS) return adsReadCheck.ok

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  let ok = false
  if (appId && appSecret) {
    const res = await graphGet<{ data?: Array<{ permission?: string; status?: string }> }>(
      `${appId}/permissions`, { limit: "200" }, `${appId}|${appSecret}`
    )
    ok = !!res.data?.data?.some((p) => p.permission === "ads_read" && p.status !== "declined")
    if (res.error) console.warn("[meta] could not read the app's permission list, not requesting ads_read:", res.error.message)
  }
  adsReadCheck = { at: Date.now(), ok }
  return ok
}

// ── What the OAuth round trip caches ─────────────────────────────────────────

export type FbCachedPage = { id: string; name: string; access_token?: string | null; fan_count?: number }

export type FbAdAccount = {
  /** "act_123..." — the id Graph wants in the path */
  id: string
  /** "123..." without the act_ prefix */
  account_id?: string
  name: string
  /** 1 active, 2 disabled, 3 unsettled, 7 pending risk review, 9 in grace period, 101 closed ... */
  account_status?: number
  currency?: string
  business_name?: string | null
}

export type FbCache = {
  pages: FbCachedPage[]
  adAccounts: FbAdAccount[]
  /** Why the ad account list is empty, when Graph refused it (ads_read not granted yet) */
  adAccountsError?: string | null
  selectedForms?: Array<{ id: string; name: string }>
  fetchedAt?: string
}

/** `fb_pages_cache` was a bare array of pages before ad accounts existed. Accept both. */
export function readFbCache(raw: unknown): FbCache {
  if (Array.isArray(raw)) return { pages: raw as FbCachedPage[], adAccounts: [] }
  if (raw && typeof raw === "object") {
    const o = raw as Partial<FbCache>
    return {
      pages: Array.isArray(o.pages) ? o.pages : [],
      adAccounts: Array.isArray(o.adAccounts) ? o.adAccounts : [],
      adAccountsError: o.adAccountsError ?? null,
      selectedForms: Array.isArray(o.selectedForms) ? o.selectedForms : [],
      fetchedAt: o.fetchedAt,
    }
  }
  return { pages: [], adAccounts: [] }
}

export function adAccountStatusLabel(status: number | undefined): string {
  switch (status) {
    case 1: return "Active"
    case 2: return "Disabled"
    case 3: return "Payment issue"
    case 7: return "Under review"
    case 8: return "Pending settlement"
    case 9: return "Grace period"
    case 100: return "Pending closure"
    case 101: return "Closed"
    default: return status == null ? "Unknown" : `Status ${status}`
  }
}

export type GraphError = { message: string; code?: number; subcode?: number; type?: string }

/** GET a Graph path. Never throws: returns `{ error }` on any failure. */
export async function graphGet<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<{ data?: T; error?: GraphError }> {
  try {
    const url = new URL(path.startsWith("http") ? path : `${GRAPH}/${path.replace(/^\//, "")}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    url.searchParams.set("access_token", accessToken)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number; type?: string } } & T
    if (!res.ok || body?.error) {
      return {
        error: {
          message: body?.error?.message ?? `HTTP ${res.status}`,
          code: body?.error?.code,
          subcode: body?.error?.error_subcode,
          type: body?.error?.type,
        },
      }
    }
    return { data: body as T }
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : "Network error reaching Facebook" } }
  }
}

/** The ad accounts this Facebook login can see. Requires the `ads_read` permission. */
export async function fetchAdAccounts(userToken: string): Promise<{ accounts: FbAdAccount[]; error?: string }> {
  const accounts: FbAdAccount[] = []
  let next: string | null = `${GRAPH}/me/adaccounts`
  let first = true
  for (let page = 0; next && page < 5; page++) {
    const res: { data?: { data?: Array<Record<string, unknown>>; paging?: { next?: string } }; error?: GraphError } = await graphGet(
      next,
      first ? { fields: "id,account_id,name,account_status,currency,business{name}", limit: "100" } : {},
      userToken
    )
    first = false
    if (res.error) return { accounts, error: friendlyGraphError(res.error) }
    for (const a of res.data?.data ?? []) {
      accounts.push({
        id: String(a.id),
        account_id: a.account_id ? String(a.account_id) : undefined,
        name: String(a.name ?? a.account_id ?? a.id),
        account_status: typeof a.account_status === "number" ? a.account_status : undefined,
        currency: typeof a.currency === "string" ? a.currency : undefined,
        business_name: (a.business as { name?: string } | undefined)?.name ?? null,
      })
    }
    next = res.data?.paging?.next ?? null
  }
  return { accounts }
}

/** Plain words for the Graph errors a contractor can actually act on. */
export function friendlyGraphError(err: GraphError): string {
  const msg = err.message ?? ""
  if (err.code === 190) return "The Facebook login has expired or was revoked. Reconnect Facebook to continue."
  if (err.code === 200 || err.code === 10 || err.code === 294 || /ads_read|ads_management|permission/i.test(msg)) {
    return "Facebook has not given this connection permission to read ad data yet (ads_read). Leads still sync. Sign in to Facebook again and keep the ads permission switched on; if it is still refused, the permission is waiting on Meta's review of the FieldBuilt app."
  }
  if (err.code === 100 && /nonexisting field|does not exist|cannot be loaded/i.test(msg)) {
    return "This Facebook login cannot see that ad account any more. Reconnect Facebook and pick the ad account again."
  }
  if (err.code === 4 || err.code === 17 || err.code === 613 || err.code === 80000 || err.code === 80004) {
    return "Facebook is rate limiting requests for this ad account. Try again in a few minutes."
  }
  return msg || "Facebook returned an error."
}

// ── The company's connection ─────────────────────────────────────────────────

export type FacebookConnection = {
  pageId: string | null
  pageName: string | null
  pageActive: boolean
  adAccountId: string | null
  adAccountName: string | null
  adAccountCurrency: string | null
  userToken: string | null
}

export async function getFacebookConnection(db: Db, companyId: string): Promise<FacebookConnection | null> {
  const [{ data: integ }, { data: conns }] = await Promise.all([
    db.from("integrations")
      .select("fb_page_id, fb_page_name, fb_user_access_token, fb_pages_cache, is_active, setup_complete")
      .eq("company_id", companyId).eq("type", "facebook").maybeSingle(),
    db.from("facebook_connections")
      .select("id, fb_ad_account_id, access_token, is_active, updated_at")
      .eq("company_id", companyId).order("updated_at", { ascending: false }).limit(5),
  ])
  if (!integ) return null
  const conn = ((conns ?? []) as Array<{ fb_ad_account_id: string | null; access_token: string | null }>)
    .find((c) => c.fb_ad_account_id) ?? null
  const cache = readFbCache(integ.fb_pages_cache)
  const adAccountId = conn?.fb_ad_account_id ?? null
  const cached = adAccountId ? cache.adAccounts.find((a) => a.id === adAccountId) : undefined
  return {
    pageId: integ.fb_page_id ?? null,
    pageName: integ.fb_page_name ?? null,
    pageActive: !!integ.is_active && !!integ.setup_complete,
    adAccountId,
    adAccountName: cached?.name ?? null,
    adAccountCurrency: cached?.currency ?? null,
    userToken: conn?.access_token ?? integ.fb_user_access_token ?? null,
  }
}

/**
 * Keep exactly ONE facebook_connections row per company (the table has no unique
 * index on company_id, and onboarding used to insert empty stubs).
 */
export async function saveFacebookConnection(
  db: Db,
  companyId: string,
  patch: { fb_ad_account_id?: string | null; fb_page_id?: string | null; fb_page_name?: string | null; access_token?: string | null; is_active?: boolean }
): Promise<void> {
  const { data: rows } = await db
    .from("facebook_connections").select("id").eq("company_id", companyId).order("created_at", { ascending: true })
  const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id)
  const values = { ...patch, updated_at: new Date().toISOString() }
  if (ids.length === 0) {
    await db.from("facebook_connections").insert({ company_id: companyId, ...values })
    return
  }
  await db.from("facebook_connections").update(values).eq("id", ids[0])
  if (ids.length > 1) await db.from("facebook_connections").delete().in("id", ids.slice(1))
}

// ── Insights ─────────────────────────────────────────────────────────────────

export type AdRangeInput =
  | { preset: "last_7d" | "last_30d" | "this_month" }
  | { since: string; until: string }

export type AdTotals = {
  spend: number
  impressions: number
  reach: number
  clicks: number
  /** Percent, e.g. 1.42 */
  ctr: number
  cpc: number
  leads: number
  costPerLead: number | null
}

export type AdCampaignRow = {
  id: string
  name: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  costPerLead: number | null
}

export type AdInsights = {
  connected: true
  adAccount: { id: string; name: string | null; currency: string }
  range: { since: string; until: string; label: string }
  /** What Meta reports for the ad account */
  totals: AdTotals
  campaigns: AdCampaignRow[]
  /** What actually landed in the CRM in the same window */
  crm: {
    leads: number
    measuresBooked: number
    signed: number
    revenue: number
    costPerLead: number | null
    costPerBookedMeasure: number | null
    costPerSigned: number | null
  }
  fetchedAt: string
}

export type AdInsightsResult =
  | { connected: false }
  | { connected: true; needsAdAccount: true }
  | { connected: true; error: string }
  | AdInsights

const DAY_MS = 24 * 60 * 60 * 1000

function ymdInTz(d: Date, tz: string): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz })
}

/** Resolve a preset to explicit dates in the company timezone, so Meta and the CRM count the same days. */
export function resolveAdRange(input: AdRangeInput, tz: string, now: Date = new Date()): { since: string; until: string; label: string } {
  if ("since" in input) {
    const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
    if (ok(input.since) && ok(input.until) && input.since <= input.until) {
      return { since: input.since, until: input.until, label: `${input.since} to ${input.until}` }
    }
    return resolveAdRange({ preset: "last_30d" }, tz, now)
  }
  const today = ymdInTz(now, tz)
  if (input.preset === "this_month") return { since: `${today.slice(0, 8)}01`, until: today, label: "This month" }
  const days = input.preset === "last_7d" ? 7 : 30
  // Like Ads Manager: the N complete days before today.
  return {
    since: ymdInTz(new Date(now.getTime() - days * DAY_MS), tz),
    until: ymdInTz(new Date(now.getTime() - DAY_MS), tz),
    label: days === 7 ? "Last 7 days" : "Last 30 days",
  }
}

type GraphAction = { action_type: string; value: string }
type GraphInsightRow = {
  campaign_id?: string
  campaign_name?: string
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  ctr?: string
  cpc?: string
  actions?: GraphAction[]
}

const LEAD_ACTION_PRIORITY = ["lead", "onsite_conversion.lead_grouped", "leadgen_grouped"]

/** Leads for one insights row, using exactly one action type (see the rule at the top). */
export function leadsFromActions(actions: GraphAction[] | undefined): number {
  if (!actions?.length) return 0
  for (const type of LEAD_ACTION_PRIORITY) {
    const hit = actions.find((a) => a.action_type === type)
    if (hit) return Math.round(Number(hit.value) || 0)
  }
  return 0
}

const num = (v: string | undefined) => Number(v ?? 0) || 0
const per = (cost: number, n: number) => (n > 0 ? Math.round((cost / n) * 100) / 100 : null)

const insightsCache = new Map<string, { expires: number; value: AdInsightsResult }>()
const CACHE_MS = 5 * 60 * 1000
// A refused permission or an expired login should not hammer Graph on every dashboard load,
// but it should clear quickly once the owner reconnects.
const ERROR_CACHE_MS = 60 * 1000

export async function getAdInsights(companyId: string, rangeInput: AdRangeInput): Promise<AdInsightsResult> {
  const db = createServiceRoleClient()
  const { data: cfg } = await db.from("ai_agent_config").select("timezone").eq("company_id", companyId).maybeSingle()
  const tz = (cfg?.timezone as string | null) ?? "America/New_York"
  const range = resolveAdRange(rangeInput, tz)

  const cacheKey = `${companyId}:${range.since}:${range.until}`
  const hit = insightsCache.get(cacheKey)
  if (hit && Date.now() < hit.expires) return hit.value

  const result = await computeAdInsights(db, companyId, range, tz)
  const ttl = "totals" in result ? CACHE_MS : ERROR_CACHE_MS
  insightsCache.set(cacheKey, { expires: Date.now() + ttl, value: result })
  if (insightsCache.size > 500) insightsCache.delete(insightsCache.keys().next().value as string)
  return result
}

export function clearAdInsightsCache(companyId: string): void {
  for (const key of insightsCache.keys()) if (key.startsWith(`${companyId}:`)) insightsCache.delete(key)
}

async function computeAdInsights(
  db: Db,
  companyId: string,
  range: { since: string; until: string; label: string },
  tz: string
): Promise<AdInsightsResult> {
  const conn = await getFacebookConnection(db, companyId)
  if (!conn || (!conn.pageActive && !conn.adAccountId)) return { connected: false }
  if (!conn.adAccountId) return { connected: true, needsAdAccount: true }
  if (!conn.userToken) return { connected: true, error: "The Facebook login is missing. Reconnect Facebook to load ad results." }

  const fields = "spend,impressions,reach,clicks,ctr,cpc,actions,cost_per_action_type"
  const time_range = JSON.stringify({ since: range.since, until: range.until })

  const [account, campaigns, crm] = await Promise.all([
    graphGet<{ data?: GraphInsightRow[] }>(`${conn.adAccountId}/insights`, { fields, time_range, level: "account" }, conn.userToken),
    graphGet<{ data?: GraphInsightRow[] }>(
      `${conn.adAccountId}/insights`,
      { fields: `campaign_id,campaign_name,${fields}`, time_range, level: "campaign", limit: "100" },
      conn.userToken
    ),
    crmNumbers(db, companyId, range, tz),
  ])

  if (account.error) return { connected: true, error: friendlyGraphError(account.error) }

  const row = account.data?.data?.[0]
  const spend = num(row?.spend)
  const leads = leadsFromActions(row?.actions)
  const totals: AdTotals = {
    spend,
    impressions: num(row?.impressions),
    reach: num(row?.reach),
    clicks: num(row?.clicks),
    ctr: num(row?.ctr),
    cpc: num(row?.cpc),
    leads,
    costPerLead: per(spend, leads),
  }

  const campaignRows: AdCampaignRow[] = (campaigns.data?.data ?? [])
    .map((c) => {
      const cSpend = num(c.spend)
      const cLeads = leadsFromActions(c.actions)
      return {
        id: c.campaign_id ?? "",
        name: c.campaign_name ?? "Campaign",
        spend: cSpend,
        impressions: num(c.impressions),
        clicks: num(c.clicks),
        leads: cLeads,
        costPerLead: per(cSpend, cLeads),
      }
    })
    .sort((a, b) => b.spend - a.spend)

  return {
    connected: true,
    adAccount: { id: conn.adAccountId, name: conn.adAccountName, currency: conn.adAccountCurrency ?? "USD" },
    range,
    totals,
    campaigns: campaignRows,
    crm: {
      ...crm,
      costPerLead: per(spend, crm.leads),
      costPerBookedMeasure: per(spend, crm.measuresBooked),
      costPerSigned: per(spend, crm.signed),
    },
    fetchedAt: new Date().toISOString(),
  }
}

/** CRM truth for the window: Facebook leads created, measures booked for them, deals signed and revenue. */
async function crmNumbers(
  db: Db,
  companyId: string,
  range: { since: string; until: string },
  tz: string
): Promise<{ leads: number; measuresBooked: number; signed: number; revenue: number }> {
  const { localSlotToUtcIso } = await import("@/lib/technician-booking")
  const fromIso = localSlotToUtcIso(range.since, "00:00", tz)
  // Exclusive upper bound: midnight after the last day.
  const dayAfter = new Date(new Date(`${range.until}T12:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10)
  const toIso = localSlotToUtcIso(dayAfter, "00:00", tz)

  const [leadsRes, aptsRes, signedRes] = await Promise.all([
    db.from("leads").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("source", "facebook").is("deleted_at", null)
      .gte("created_at", fromIso).lt("created_at", toIso),
    db.from("appointments").select("id, status, leads!inner(source, deleted_at)")
      .eq("company_id", companyId).eq("leads.source", "facebook")
      .gte("created_at", fromIso).lt("created_at", toIso).limit(1000),
    db.from("leads").select("deal_value, refund_amount")
      .eq("company_id", companyId).eq("source", "facebook").is("deleted_at", null)
      .in("status", ["closed_won", "closed"])
      .gte("closed_at", fromIso).lt("closed_at", toIso).limit(1000),
  ])

  const apts = ((aptsRes.data ?? []) as Array<{ status: string | null; leads: { deleted_at: string | null } | Array<{ deleted_at: string | null }> | null }>)
    .filter((a) => {
      const lead = Array.isArray(a.leads) ? a.leads[0] : a.leads
      return a.status !== "cancelled" && !lead?.deleted_at
    })
  const signedRows = (signedRes.data ?? []) as Array<{ deal_value: number | string | null; refund_amount: number | string | null }>
  const revenue = signedRows.reduce((sum, r) => sum + (Number(r.deal_value) || 0) - (Number(r.refund_amount) || 0), 0)

  return {
    leads: leadsRes.count ?? 0,
    measuresBooked: apts.length,
    signed: signedRows.length,
    revenue: Math.round(revenue * 100) / 100,
  }
}
