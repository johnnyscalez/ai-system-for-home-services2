"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, Megaphone, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AdInsights, AdInsightsResult } from "@/lib/meta-ads"

// Ad spend from the connected Facebook ad account next to what the CRM recorded in
// the same days: leads, booked measures, signed jobs. Self-contained: it fetches
// its own data and explains itself when something is not connected.

type RangeKey = "last_7d" | "last_30d" | "this_month"
const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "last_7d", label: "7 days" },
  { key: "last_30d", label: "30 days" },
  { key: "this_month", label: "This month" },
]

const MONO = { fontFamily: "var(--font-jetbrains), 'JetBrains Mono', ui-monospace, monospace" } as const
const HEADING = { fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" } as const

function money(value: number | null | undefined, currency: string, digits = 0): string {
  if (value == null) return "—"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
  } catch {
    return `$${value.toFixed(digits)}`
  }
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "revenue" }) {
  return (
    <div className="rounded-xl border border-[#E7E5E4] bg-[#FAFAF8] p-3.5">
      <p className="text-xs font-medium text-[#78716C]">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tracking-tight", tone === "revenue" ? "text-[#16A34A]" : "text-[#1A1614]")} style={MONO}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] leading-tight text-[#A8A29E]">{hint}</p>}
    </div>
  )
}

function Message({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E7E5E4] bg-[#FAFAF8] p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#78716C]" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1A1614]">{title}</p>
        <p className="mt-0.5 text-sm text-[#78716C]">{body}</p>
        {href && cta && (
          <Link href={href} className="mt-2 inline-block text-sm font-semibold text-[#EA580C] hover:underline">
            {cta}
          </Link>
        )}
      </div>
    </div>
  )
}

/** null = the request itself failed (network, or the route returned an HTTP error). */
async function fetchInsights(key: RangeKey): Promise<AdInsightsResult | null> {
  try {
    const res = await fetch(`/api/ads/insights?range=${key}`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as AdInsightsResult
  } catch {
    return null
  }
}

export function AdPerformanceCard() {
  const [range, setRange] = useState<RangeKey>("last_30d")
  const [data, setData] = useState<AdInsightsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)

  // Resolve one request and apply it, unless a newer one has started since.
  const apply = useCallback((id: number, result: AdInsightsResult | null) => {
    if (id !== requestId.current) return
    setData(result)
    setFailed(result === null)
    setLoading(false)
  }, [])

  // First load. The initial state is already "loading", so nothing is set
  // synchronously here; state changes only when the request resolves.
  useEffect(() => {
    const id = ++requestId.current
    void fetchInsights("last_30d").then((result) => apply(id, result))
  }, [apply])

  function load(key: RangeKey) {
    const id = ++requestId.current
    setLoading(true)
    setFailed(false)
    void fetchInsights(key).then((result) => apply(id, result))
  }

  function pick(key: RangeKey) {
    if (key === range && !failed) return
    setRange(key)
    load(key)
  }

  const insights: AdInsights | null = data && "totals" in data ? data : null
  const currency = insights?.adAccount.currency ?? "USD"

  return (
    <section
      aria-label="Ad performance"
      className="rounded-2xl border border-[#E7E5E4]/60 bg-white p-4 md:p-6"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3EC]">
            <Megaphone className="h-5 w-5 text-[#EA580C]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1A1614]" style={HEADING}>Ad performance</h2>
            <p className="truncate text-xs text-[#78716C]">
              {insights
                ? `${insights.adAccount.name ?? "Facebook ad account"} · ${insights.range.since} to ${insights.range.until}`
                : "Facebook ad spend next to your booked measures"}
            </p>
          </div>
        </div>
        <div role="group" aria-label="Date range" className="flex shrink-0 gap-1 self-start rounded-xl bg-[#F5F4F2] p-1 sm:self-auto">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => pick(r.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                range === r.key ? "bg-white text-[#1A1614] shadow-sm" : "text-[#78716C] hover:text-[#1A1614]"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4" aria-live="polite" aria-busy={loading}>
        {loading && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" role="status" aria-label="Loading ad results">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-xl bg-[#F5F4F2]" />
            ))}
          </div>
        )}

        {!loading && failed && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-700">Ad results did not load</p>
              <button type="button" onClick={() => load(range)} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 underline underline-offset-2">
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !failed && data && !data.connected && (
          <Message
            title="Facebook is not connected"
            body="Connect your Facebook Page and ad account to see spend, cost per lead and cost per booked measure here."
            href="/integrations"
            cta="Connect Facebook"
          />
        )}

        {!loading && !failed && data && data.connected && "needsAdAccount" in data && (
          <Message
            title="No ad account selected"
            body="Facebook is connected and leads are syncing. Pick the ad account the ads run from to see spend and cost per lead."
            href="/connect/facebook?return_to=integrations"
            cta="Choose the ad account"
          />
        )}

        {!loading && !failed && data && data.connected && "error" in data && (
          <Message title="Facebook would not share the ad results" body={data.error} href="/integrations" cta="Open Integrations" />
        )}

        {!loading && !failed && insights && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Ad spend" value={money(insights.totals.spend, currency, insights.totals.spend < 100 ? 2 : 0)} hint={`${insights.totals.impressions.toLocaleString()} impressions`} />
              <Stat
                label="Leads"
                value={insights.crm.leads.toLocaleString()}
                hint={insights.totals.leads !== insights.crm.leads ? `Meta reports ${insights.totals.leads.toLocaleString()}` : "In your CRM"}
              />
              <Stat label="Cost per lead" value={money(insights.crm.costPerLead, currency, 2)} />
              <Stat label="Measures booked" value={insights.crm.measuresBooked.toLocaleString()} />
              <Stat label="Cost per booked measure" value={money(insights.crm.costPerBookedMeasure, currency, 2)} />
              <Stat
                label="Signed"
                value={insights.crm.signed.toLocaleString()}
                hint={insights.crm.revenue > 0 ? `${money(insights.crm.revenue, currency)} signed` : undefined}
                tone={insights.crm.signed > 0 ? "revenue" : undefined}
              />
            </div>

            {insights.totals.spend === 0 && insights.campaigns.length === 0 ? (
              <p className="mt-4 text-sm text-[#78716C]">No ad spend in this period.</p>
            ) : (
              insights.campaigns.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-[#E7E5E4]">
                  <table className="w-full min-w-[440px] text-sm">
                    <caption className="sr-only">Results by campaign, as reported by Meta</caption>
                    <thead>
                      <tr className="bg-[#FAFAF8] text-left text-xs font-semibold text-[#78716C]">
                        <th scope="col" className="px-3.5 py-2.5">Campaign</th>
                        <th scope="col" className="px-3.5 py-2.5 text-right">Spend</th>
                        <th scope="col" className="px-3.5 py-2.5 text-right">Leads</th>
                        <th scope="col" className="px-3.5 py-2.5 text-right">Cost per lead</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E4]">
                      {insights.campaigns.map((c) => (
                        <tr key={c.id || c.name}>
                          <th scope="row" className="max-w-[240px] truncate px-3.5 py-2.5 text-left font-medium text-[#1A1614]" title={c.name}>{c.name}</th>
                          <td className="px-3.5 py-2.5 text-right text-[#1A1614]" style={MONO}>{money(c.spend, currency, 2)}</td>
                          <td className="px-3.5 py-2.5 text-right text-[#1A1614]" style={MONO}>{c.leads.toLocaleString()}</td>
                          <td className="px-3.5 py-2.5 text-right text-[#1A1614]" style={MONO}>{money(c.costPerLead, currency, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-[#A8A29E]">
              Spend and campaign rows come from Meta. Leads, booked measures and signed jobs are counted from your CRM for Facebook leads in the same days, so the cost figures reflect what actually reached you.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
