"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

// The Facebook connect wizard: Page → ad account → lead forms → turn on.
// It only ever handles ids and names. Tokens stay on the server.

export interface SetupPage {
  id: string
  name: string
  fan_count?: number | null
  /** False when Facebook listed the Page but did not grant this app access to it */
  hasToken: boolean
}

export interface SetupAdAccount {
  id: string
  name: string
  status: string
  active: boolean
  currency: string | null
  business: string | null
}

interface LeadForm {
  id: string
  name: string
  status: string
  leads_count?: number
  created_time: string
}

interface Props {
  pages: SetupPage[]
  adAccounts: SetupAdAccount[]
  /** Why the ad account list is empty, in plain words, when Facebook refused it */
  adAccountsError: string | null
  current: { pageId: string | null; adAccountId: string | null; formIds: string[] }
  /** True when a connection is already live and this is a change, not a first setup */
  live: boolean
  doneUrl: string
  skipUrl: string
  reconnectUrl: string
}

const STEPS = ["Page", "Ad account", "Lead forms", "Turn on"] as const

function FacebookMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function Choice({
  selected, onSelect, title, subtitle, badge, disabled, type = "radio",
}: {
  selected: boolean
  onSelect: () => void
  title: string
  subtitle?: string | null
  badge?: { text: string; tone: "ok" | "muted" | "warn" } | null
  disabled?: boolean
  type?: "radio" | "checkbox"
}) {
  return (
    <button
      type="button"
      role={type}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40",
        selected ? "border-[#F97316] bg-[#FFF3EC]" : "border-[#E7E5E4] bg-white hover:border-[#D6D3D1] hover:bg-[#FAFAF8]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors",
          type === "radio" ? "rounded-full" : "rounded-md",
          selected ? "border-[#F97316] bg-[#F97316]" : "border-[#D6D3D1] bg-white"
        )}
      >
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#1A1614] break-words">{title}</span>
          {badge && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                badge.tone === "ok" && "border-green-200 bg-green-50 text-green-700",
                badge.tone === "muted" && "border-[#E7E5E4] bg-[#F5F4F2] text-[#78716C]",
                badge.tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800"
              )}
            >
              {badge.text}
            </span>
          )}
        </span>
        {subtitle && <span className="mt-0.5 block text-xs text-[#78716C] break-words">{subtitle}</span>}
      </span>
    </button>
  )
}

function Notice({ tone, children }: { tone: "error" | "warn" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        tone === "error" && "border-red-200 bg-red-50 text-red-700",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "info" && "border-[#E7E5E4] bg-[#FAFAF8] text-[#57534E]"
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  )
}

export function FacebookSetup({ pages, adAccounts: initialAdAccounts, adAccountsError: initialAdError, current, live, doneUrl, skipUrl, reconnectUrl }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)

  // Page
  const [pageId, setPageId] = useState<string | null>(
    current.pageId && pages.some((p) => p.id === current.pageId) ? current.pageId : pages.length === 1 ? pages[0].id : null
  )
  const page = pages.find((p) => p.id === pageId) ?? null

  // Ad account: auto-select when there is exactly one.
  const [adAccounts, setAdAccounts] = useState(initialAdAccounts)
  const [adError, setAdError] = useState(initialAdError)
  const [adRefreshing, setAdRefreshing] = useState(false)
  const [adAccountId, setAdAccountId] = useState<string | null>(
    current.adAccountId && initialAdAccounts.some((a) => a.id === current.adAccountId)
      ? current.adAccountId
      : initialAdAccounts.length === 1 ? initialAdAccounts[0].id : null
  )
  const adAccount = adAccounts.find((a) => a.id === adAccountId) ?? null

  // Lead forms
  const [forms, setForms] = useState<LeadForm[] | null>(null)
  const [formsFor, setFormsFor] = useState<string | null>(null)
  const [formsLoading, setFormsLoading] = useState(false)
  const [formsError, setFormsError] = useState<string | null>(null)
  const [allForms, setAllForms] = useState(current.formIds.length === 0)
  const [formIds, setFormIds] = useState<string[]>(current.formIds)

  // Save
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [done, setDone] = useState<{ recoveredLeads: number } | null>(null)

  const loadForms = useCallback(async (id: string) => {
    setFormsLoading(true)
    setFormsError(null)
    try {
      const res = await fetch(`/api/integrations/facebook/forms?page_id=${encodeURIComponent(id)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setForms(null)
        setFormsError(data.error ?? "Could not load the lead forms for this Page.")
      } else {
        setForms(data.forms ?? [])
        setFormsFor(id)
        // Forget selections that do not exist on this Page.
        const ids = new Set((data.forms ?? []).map((f: LeadForm) => f.id))
        setFormIds((prev) => prev.filter((f) => ids.has(f)))
      }
    } catch {
      setForms(null)
      setFormsError("Network error. Check your connection and try again.")
    } finally {
      setFormsLoading(false)
    }
  }, [])

  function goTo(next: number) {
    setStep(next)
    // Entering the forms step for a Page whose forms are not loaded yet.
    if (next === 2 && pageId && formsFor !== pageId && !formsLoading) void loadForms(pageId)
  }

  async function refreshAdAccounts() {
    setAdRefreshing(true)
    try {
      const res = await fetch("/api/integrations/facebook/ad-accounts?refresh=1")
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setAdAccounts(data.adAccounts ?? [])
        setAdError(data.error ?? null)
        if ((data.adAccounts ?? []).length === 1) setAdAccountId(data.adAccounts[0].id)
      } else {
        setAdError(data.error ?? "Could not reach Facebook. Try again.")
      }
    } catch {
      setAdError("Network error. Check your connection and try again.")
    } finally {
      setAdRefreshing(false)
    }
  }

  async function save() {
    if (!pageId) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch("/api/integrations/facebook/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, ad_account_id: adAccountId, form_ids: allForms ? [] : formIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setSaveError(data.error ?? "Could not turn the connection on. Try again.")
        setSaving(false)
        return
      }
      setDone({ recoveredLeads: data.recoveredLeads ?? 0 })
      router.push(doneUrl)
      router.refresh()
    } catch {
      setSaveError("Network error. Check your connection and try again.")
      setSaving(false)
    }
  }

  const selectedFormNames = useMemo(
    () => (forms ?? []).filter((f) => formIds.includes(f.id)).map((f) => f.name),
    [forms, formIds]
  )

  const canContinue =
    step === 0 ? !!page && page.hasToken
    : step === 1 ? true
    : step === 2 ? !formsLoading && (allForms || formIds.length > 0 || (forms?.length ?? 0) === 0)
    : true

  const primaryLabel =
    step === 0 ? "Continue"
    : step === 1 ? (adAccountId ? "Continue" : "Skip for now")
    : step === 2 ? "Review"
    : live ? "Save changes" : "Turn on"

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1A1614] text-white">
            <FacebookMark className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1614]" style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              {live ? "Facebook connection" : "Connect Facebook"}
            </h1>
            <p className="mt-0.5 text-sm text-[#78716C]">
              Pick the Page, the ad account and the lead forms. Every new lead lands in your CRM and gets a text right away.
            </p>
          </div>
        </div>

        {/* Steps */}
        <ol className="mb-5 grid grid-cols-4 gap-2" aria-label="Setup steps">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined} className="min-w-0">
              <div className={cn("h-1 rounded-full", i <= step ? "bg-[#F97316]" : "bg-[#E7E5E4]")} />
              <p className={cn("mt-1.5 truncate text-[11px] font-semibold", i === step ? "text-[#1A1614]" : "text-[#A8A29E]")}>
                {i + 1}. {label}
              </p>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-[#E7E5E4] bg-white shadow-sm">
          <div className="space-y-4 p-4 sm:p-6">
            {/* ── Step 1: Page ───────────────────────────────────────────── */}
            {step === 0 && (
              <>
                <div>
                  <h2 className="text-base font-bold text-[#1A1614]">Which Facebook Page runs your ads?</h2>
                  <p className="mt-0.5 text-sm text-[#78716C]">
                    {pages.length} {pages.length === 1 ? "Page" : "Pages"} found on this Facebook login.
                  </p>
                </div>
                <div role="radiogroup" aria-label="Facebook Page" className="max-h-80 space-y-2 overflow-y-auto pr-0.5">
                  {pages.map((p) => (
                    <Choice
                      key={p.id}
                      selected={pageId === p.id}
                      onSelect={() => setPageId(p.id)}
                      title={p.name}
                      subtitle={p.fan_count != null ? `${p.fan_count.toLocaleString()} followers` : null}
                      badge={p.hasToken ? null : { text: "Access not granted", tone: "warn" }}
                    />
                  ))}
                </div>
                {page && !page.hasToken && (
                  <Notice tone="warn">
                    <p>
                      Facebook listed <strong>{page.name}</strong> but did not give us access to it. Sign in again, click{" "}
                      <strong>Edit settings</strong> in the Facebook window (not Reconnect), then tick this Page and the business that owns it.
                    </p>
                    <a href={reconnectUrl} className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2">
                      <RefreshCw className="h-3.5 w-3.5" /> Sign in to Facebook again
                    </a>
                  </Notice>
                )}
                <p className="text-xs text-[#A8A29E]">
                  Page missing from the list?{" "}
                  <a href={reconnectUrl} className="font-medium text-[#57534E] underline underline-offset-2">Sign in again</a>{" "}
                  and choose Edit settings to add it.
                </p>
              </>
            )}

            {/* ── Step 2: Ad account ─────────────────────────────────────── */}
            {step === 1 && (
              <>
                <div>
                  <h2 className="text-base font-bold text-[#1A1614]">Which ad account pays for the ads?</h2>
                  <p className="mt-0.5 text-sm text-[#78716C]">
                    We read spend and results from it so your dashboard shows cost per lead and cost per booked measure. Read only: nothing in your ads is changed from here.
                  </p>
                </div>

                {adAccounts.length > 0 && (
                  <div role="radiogroup" aria-label="Ad account" className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                    {adAccounts.map((a) => (
                      <Choice
                        key={a.id}
                        selected={adAccountId === a.id}
                        onSelect={() => setAdAccountId(adAccountId === a.id ? null : a.id)}
                        title={a.name}
                        subtitle={[a.business, a.id.replace(/^act_/, "ID "), a.currency].filter(Boolean).join(" · ")}
                        badge={{ text: a.status, tone: a.active ? "ok" : "warn" }}
                      />
                    ))}
                  </div>
                )}

                {adAccounts.length === 0 && adError && (
                  <Notice tone="warn">
                    <p>{adError}</p>
                    <p>You can skip this step. Leads still sync; ad spend shows up once the ad account is added.</p>
                  </Notice>
                )}
                {adAccounts.length === 0 && !adError && (
                  <Notice tone="info">
                    <p>No ad accounts were found on this Facebook login. If the ads run from an account you were just added to, check again. Otherwise skip this step and add it later.</p>
                  </Notice>
                )}

                <button
                  type="button"
                  onClick={refreshAdAccounts}
                  disabled={adRefreshing}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57534E] underline underline-offset-2 disabled:opacity-50"
                >
                  {adRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Check for ad accounts again
                </button>
              </>
            )}

            {/* ── Step 3: Lead forms ─────────────────────────────────────── */}
            {step === 2 && (
              <>
                <div>
                  <h2 className="text-base font-bold text-[#1A1614]">Which lead forms should we follow?</h2>
                  <p className="mt-0.5 text-sm text-[#78716C]">On {page?.name}.</p>
                </div>

                {formsLoading && (
                  <div className="flex items-center gap-2 py-6 text-sm text-[#78716C]" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading lead forms from Facebook
                  </div>
                )}

                {formsError && !formsLoading && (
                  <Notice tone="error">
                    <p>{formsError}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <button type="button" onClick={() => pageId && loadForms(pageId)} className="font-semibold underline underline-offset-2">Try again</button>
                      <a href={reconnectUrl} className="font-semibold underline underline-offset-2">Sign in to Facebook again</a>
                    </div>
                  </Notice>
                )}

                {!formsLoading && !formsError && forms && (
                  <>
                    <div role="radiogroup" aria-label="Which forms" className="space-y-2">
                      <Choice
                        selected={allForms}
                        onSelect={() => setAllForms(true)}
                        title="Every form on this Page"
                        subtitle="Recommended. New forms you or we create later are picked up automatically."
                      />
                      {forms.length > 0 && (
                        <Choice
                          selected={!allForms}
                          onSelect={() => setAllForms(false)}
                          title="Only the forms I pick"
                          subtitle="Leads from any other form on this Page are ignored."
                        />
                      )}
                    </div>

                    {forms.length === 0 && (
                      <Notice tone="info">
                        <p>
                          This Page has no lead forms yet. That is fine: turn the connection on now and every form created later is picked up, and Messenger messages start working right away.
                        </p>
                      </Notice>
                    )}

                    {!allForms && forms.length > 0 && (
                      <div role="group" aria-label="Lead forms" className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
                        {forms.map((f) => (
                          <Choice
                            key={f.id}
                            type="checkbox"
                            selected={formIds.includes(f.id)}
                            onSelect={() => setFormIds((prev) => (prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id]))}
                            title={f.name}
                            subtitle={[
                              f.leads_count != null ? `${f.leads_count} leads so far` : null,
                              `created ${new Date(f.created_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
                            ].filter(Boolean).join(" · ")}
                            badge={{ text: f.status === "ACTIVE" ? "Active" : f.status.charAt(0) + f.status.slice(1).toLowerCase(), tone: f.status === "ACTIVE" ? "ok" : "muted" }}
                          />
                        ))}
                      </div>
                    )}
                    {!allForms && forms.length > 0 && formIds.length === 0 && (
                      <p className="text-xs text-[#78716C]">Pick at least one form, or choose every form on this Page.</p>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── Step 4: Review ─────────────────────────────────────────── */}
            {step === 3 && (
              <>
                <h2 className="text-base font-bold text-[#1A1614]">{live ? "Review your changes" : "Ready to turn on"}</h2>
                <dl className="divide-y divide-[#E7E5E4] rounded-xl border border-[#E7E5E4] bg-[#FAFAF8] text-sm">
                  <div className="flex items-start justify-between gap-4 px-3.5 py-3">
                    <dt className="shrink-0 text-[#78716C]">Page</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-[#1A1614]">{page?.name}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 px-3.5 py-3">
                    <dt className="shrink-0 text-[#78716C]">Ad account</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-[#1A1614]">
                      {adAccount ? adAccount.name : <span className="font-normal text-[#78716C]">Not selected. Ad spend will not show yet.</span>}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 px-3.5 py-3">
                    <dt className="shrink-0 text-[#78716C]">Lead forms</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-[#1A1614]">
                      {allForms || formIds.length === 0 ? "Every form on this Page" : selectedFormNames.join(", ")}
                    </dd>
                  </div>
                </dl>
                <ul className="space-y-1.5 text-sm text-[#57534E]">
                  {[
                    "New leads from these forms appear in your CRM with every answer they gave.",
                    "Each new lead gets a text within seconds.",
                    "Messages sent to your Page on Messenger are answered too.",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                      {line}
                    </li>
                  ))}
                </ul>
                {saveError && (
                  <Notice tone="error">
                    <p>{saveError}</p>
                    <a href={reconnectUrl} className="font-semibold underline underline-offset-2">Sign in to Facebook again</a>
                  </Notice>
                )}
                {done && (
                  <p className="text-sm font-medium text-[#16A34A]" role="status">
                    Connected.{done.recoveredLeads > 0 ? ` ${done.recoveredLeads} earlier lead${done.recoveredLeads === 1 ? "" : "s"} recovered.` : ""} Taking you back.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-[#E7E5E4] p-4 sm:px-6">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                disabled={saving}
                className="inline-flex items-center gap-1 text-sm font-medium text-[#57534E] hover:text-[#1A1614] disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <a href={skipUrl} className="text-sm font-medium text-[#78716C] hover:text-[#1A1614]">
                {live ? "Cancel" : "Finish later"}
              </a>
            )}
            <button
              type="button"
              onClick={() => (step < 3 ? goTo(step + 1) : save())}
              disabled={!canContinue || saving || !!done}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Turning on" : primaryLabel}
              {!saving && step < 3 && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {step > 0 && !saving && !done && (
          <a href={skipUrl} className="mt-4 self-center text-xs font-medium text-[#A8A29E] hover:text-[#57534E]">
            {live ? "Cancel and keep the current setup" : "Finish later"}
          </a>
        )}
      </div>
    </div>
  )
}
