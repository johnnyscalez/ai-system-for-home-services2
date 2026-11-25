"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Check, Copy, ExternalLink, AlertCircle, Zap, Globe,
  ChevronRight, CheckCircle2, XCircle, RefreshCw, Info, Loader2, X, Wrench,
} from "lucide-react"

interface Integration {
  type: string
  is_active: boolean
  setup_complete?: boolean | null
  fb_page_name?: string | null
  fb_page_id?: string | null
  fb_selected_form_ids?: string[] | null
  lead_count: number
  last_lead_at?: string | null
  created_at: string
}

/** What the Facebook card shows about the live connection. Names and counts only. */
export interface FacebookSummary {
  adAccountName: string | null
  /** "Active", "Disabled", ... or null when no ad account is selected */
  adAccountStatus: string | null
  /** Empty = every lead form on the Page */
  forms: Array<{ id: string; name: string }>
  /** Facebook leads in the CRM (lead forms and Messenger) */
  leadCount: number
  lastLeadAt: string | null
  /** Leads waiting on a reconnect because Facebook would not release their details */
  pendingLeads: number
}

interface Props {
  integrations: Integration[]
  facebook: FacebookSummary | null
  webhookSecret: string
  appUrl: string
  toast: string | null
  toastType: "success" | "error" | null
  hcpConnected: boolean
  integrationMode: string
}

function DotGrid() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 opacity-40"
      style={{
        backgroundImage: "radial-gradient(rgba(249,115,22,0.15) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  )
}

function GlowOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full"
        style={{
          width: 600, height: 600,
          background: "rgba(249,115,22,0.06)",
          filter: "blur(80px)",
          top: "-10%", left: "-5%",
        }}
      />
      <motion.div
        animate={{ y: [0, 18, 0], x: [0, -14, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute rounded-full"
        style={{
          width: 500, height: 500,
          background: "rgba(77,124,15,0.05)",
          filter: "blur(70px)",
          bottom: "-5%", right: "-5%",
        }}
      />
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E7E5E4] bg-white hover:bg-[#F5F4F2] transition-colors text-[#78716C] hover:text-[#1C1917] shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : (label ?? "Copy")}
    </button>
  )
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
      connected
        ? "bg-green-50 text-green-700 border border-green-100"
        : "bg-[#F5F4F2] text-[#78716C] border border-[#E7E5E4]"
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-[#D1D5DB]"}`} />
      {connected ? "Connected" : "Not connected"}
    </div>
  )
}

// ─── Facebook card ────────────────────────────────────────────────────────────

function DisconnectButton({ label = "Cancel", requireConfirm = false }: { label?: string; requireConfirm?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [arming, setArming] = useState(false)

  async function handleDisconnect() {
    // Destructive: first click arms, second click (within 4s) executes
    if (requireConfirm && !arming) {
      setArming(true)
      setTimeout(() => setArming(false), 4000)
      return
    }
    setLoading(true)
    await fetch("/api/integrations/facebook/disconnect", { method: "POST" })
    router.refresh()
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-all disabled:opacity-50 ${
        arming
          ? "text-white bg-red-500 border-red-500 hover:bg-red-600"
          : "text-red-500 hover:text-red-700 border-red-100 hover:border-red-200 hover:bg-red-50"
      }`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      {arming ? "Click again to confirm" : label}
    </button>
  )
}

function FacebookCard({
  integration, summary, errorCode,
}: {
  integration: Integration | undefined
  summary: FacebookSummary | null
  errorCode: string | null
}) {
  const connected = !!integration?.is_active && !!integration?.setup_complete
  const needsSetup = !!integration && !connected
  const noPages = errorCode === "no_pages"
  const forms = summary?.forms ?? []
  const wizardUrl = "/connect/facebook?return_to=integrations"

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden"
      style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Header */}
      <div className="p-6 pb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#1A1614]">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3
              className="font-bold text-[#1C1917] text-lg"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Facebook Lead Ads
            </h3>
            <p className="text-sm text-[#78716C] mt-0.5">
              {connected
                ? "Leads, Messenger and ad results from your Facebook Page and ad account"
                : needsSetup
                ? "Signed in. Choose your Page, ad account and lead forms to turn it on"
                : "Sign in with Facebook, then pick your Page, ad account and lead forms"}
            </p>
          </div>
        </div>
        {needsSetup ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
            <AlertCircle className="w-3 h-3" />
            Setup required
          </div>
        ) : (
          <StatusBadge connected={connected} />
        )}
      </div>

      {/* Setup required banner */}
      {needsSetup && (
        <div className="mx-6 mb-4 bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p className="text-sm font-semibold text-amber-800 mb-1">One more step</p>
          <p className="text-sm text-amber-700">
            Facebook is signed in, but no leads are coming through yet. Choose the Page, ad account and lead forms to turn it on.
          </p>
        </div>
      )}

      {/* What is connected */}
      {connected && (
        <div className="mx-6 mb-4 rounded-xl border border-[#E7E5E4] bg-[#FAFAF8] divide-y divide-[#E7E5E4] text-sm">
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-[#78716C] shrink-0">Page</span>
            <span className="font-semibold text-[#1C1917] text-right break-words min-w-0">{integration?.fb_page_name ?? "Unknown Page"}</span>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-[#78716C] shrink-0">Ad account</span>
            {summary?.adAccountName ? (
              <span className="text-right min-w-0">
                <span className="font-semibold text-[#1C1917] break-words">{summary.adAccountName}</span>
                {summary.adAccountStatus && summary.adAccountStatus !== "Active" && (
                  <span className="block text-xs text-amber-700">{summary.adAccountStatus}</span>
                )}
              </span>
            ) : (
              <a href={wizardUrl} className="font-medium text-[#EA580C] hover:underline text-right">
                Not selected. Add it to see ad spend
              </a>
            )}
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-[#78716C] shrink-0">Lead forms</span>
            <span className="font-semibold text-[#1C1917] text-right break-words min-w-0">
              {forms.length === 0 ? "Every form on this Page" : forms.map((f) => f.name).join(", ")}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-[#78716C] shrink-0">Leads received</span>
            <span className="font-semibold text-[#1C1917] text-right" style={{ fontFamily: "var(--font-mono), 'JetBrains Mono', monospace" }}>
              {(summary?.leadCount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-[#78716C] shrink-0">Last lead</span>
            <span className="font-semibold text-[#1C1917] text-right">
              {summary?.lastLeadAt
                ? new Date(summary.lastLeadAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : "No leads yet"}
            </span>
          </div>
        </div>
      )}

      {/* Leads Facebook would not release */}
      {connected && (summary?.pendingLeads ?? 0) > 0 && (
        <div className="mx-6 mb-4 bg-red-50 rounded-xl p-4 border border-red-100">
          <p className="text-sm font-semibold text-red-700 mb-1">
            {summary!.pendingLeads} lead{summary!.pendingLeads === 1 ? "" : "s"} waiting on Facebook
          </p>
          <p className="text-sm text-red-600">
            Facebook would not release the details for {summary!.pendingLeads === 1 ? "this lead" : "these leads"}, which usually means the Facebook login expired. Sign in again and they fill in automatically.
          </p>
          <a href="/api/auth/facebook?return_to=integrations" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 underline underline-offset-2">
            <RefreshCw className="w-3.5 h-3.5" /> Sign in to Facebook again
          </a>
        </div>
      )}

      {/* No pages found — persistent troubleshooter */}
      {!connected && !needsSetup && noPages && (
        <div className="mx-6 mb-4 bg-red-50 rounded-xl p-4 border border-red-100">
          <p className="text-sm font-semibold text-red-700 mb-1">No Facebook Pages came back from that login</p>
          <p className="text-sm text-red-600 mb-3">
            Facebook only shares the Pages you tick in its window. Try this:
          </p>
          <ol className="space-y-2">
            {[
              "Click Connect Facebook below and sign in with the profile that manages your business Page",
              "In the Facebook window choose Edit settings, then tick your Page and the business that owns it",
              "Keep every permission switched on and finish",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* How it works (when not connected, not in setup, no error) */}
      {!connected && !needsSetup && !noPages && (
        <div className="mx-6 mb-4 bg-[#FAFAF8] rounded-xl p-4 border border-[#E7E5E4]">
          <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-2">How it works</p>
          <ol className="space-y-1.5">
            {[
              "Click Connect Facebook and sign in",
              "Pick the Page, the ad account and the lead forms",
              "Every new lead lands in your CRM with all its answers and gets a text within seconds",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#78716C]">
                <span className="w-4 h-4 rounded-full bg-[#F97316]/10 text-[#F97316] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Action */}
      <div className="px-6 pb-6 flex flex-wrap items-center gap-3">
        {connected ? (
          <>
            <a
              href={wizardUrl}
              className="flex items-center gap-2 text-sm font-medium text-[#57534E] px-4 py-2 rounded-xl border border-[#E7E5E4] hover:bg-[#F5F4F2] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change Page, ad account or forms
            </a>
            <DisconnectButton label="Disconnect" requireConfirm />
            <p className="text-xs text-[#78716C] ml-auto">
              Since {new Date(integration!.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </>
        ) : needsSetup ? (
          <>
            <a
              href={wizardUrl}
              className="flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] transition-colors"
            >
              Finish setup
              <ChevronRight className="w-4 h-4" />
            </a>
            <DisconnectButton />
          </>
        ) : (
          <a
            href="/api/auth/facebook?return_to=integrations"
            className="flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] transition-colors"
          >
            Connect Facebook
            <ChevronRight className="w-4 h-4" />
          </a>
        )}
      </div>
    </motion.div>
  )
}

// ─── Google Ads card ──────────────────────────────────────────────────────────

function GoogleAdsCard({ webhookUrl }: { webhookUrl: string }) {
  const [showInstructions, setShowInstructions] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 300 } }}
      className="bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden"
      style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="p-6 pb-4 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335)", backgroundSize: "200%" }}
          >
            {/* Google G */}
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </div>
          <div>
            <h3
              className="font-bold text-[#1C1917] text-lg"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Google Ads Lead Forms
            </h3>
            <p className="text-sm text-[#78716C] mt-0.5">
              Paste this webhook URL into your Google Ads lead form extension
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
          <Info className="w-3 h-3" />
          Manual setup
        </div>
      </div>

      {/* Webhook URL */}
      <div className="mx-6 mb-4">
        <div className="flex items-center gap-2 bg-[#FAFAF8] rounded-xl p-3 border border-[#E7E5E4]">
          <code className="text-xs text-[#F97316] flex-1 break-all font-mono">
            {webhookUrl}
          </code>
          <CopyButton text={webhookUrl} />
        </div>
      </div>

      {/* Setup instructions toggle */}
      <div className="px-6 pb-6">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center gap-2 text-sm font-medium text-[#F97316] hover:text-[#EA580C] transition-colors"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${showInstructions ? "rotate-90" : ""}`} />
          {showInstructions ? "Hide" : "Show"} setup instructions
        </button>

        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ol className="mt-4 space-y-2">
                {[
                  "In Google Ads, go to your campaign → Ad extensions → Lead form extensions",
                  "Open your lead form and scroll to 'Lead delivery options'",
                  'Set Delivery method to "Webhook" and paste the URL above',
                  "Add these fields to your form: Full name, Phone number, Email",
                  "Click Send test data to verify — a test lead will appear in your CRM",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#78716C]">
                    <span className="w-5 h-5 rounded-full bg-[#F5F4F2] text-[#78716C] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <a
                href="https://support.google.com/google-ads/answer/9423255"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1.5 text-xs text-[#F97316] hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Google Ads lead form docs
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Website form card ────────────────────────────────────────────────────────

function HousecallProCard({ connected, integrationMode }: { connected: boolean; integrationMode: string }) {
  const router = useRouter()
  const [apiKey, setApiKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isV2 = integrationMode === "housecall_pro"

  async function connect() {
    setBusy(true); setError(null)
    const res = await fetch("/api/integrations/housecall/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error ?? "Connection failed"); return }
    setApiKey("")
    router.refresh()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 300 } }}
      className="bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden"
      style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="p-6 pb-4 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #1C1917, #44403C)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
          >
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-[#1C1917] text-lg flex items-center gap-2">
              Housecall Pro
              {connected && isV2 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="w-3 h-3" /> AI employee mode
                </span>
              )}
            </h3>
            <p className="text-sm text-[#78716C] mt-0.5">
              The AI books into your real calendar and reads your schedule from Housecall Pro.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        {connected && isV2 ? (
          <p className="text-sm text-[#57534E] bg-[#FAFAF8] border border-[#E7E5E4] rounded-xl px-4 py-3">
            Connected. Every booking the AI makes is pushed into Housecall Pro with the
            conversation summary in the job notes, and schedules sync automatically.
          </p>
        ) : (
          <>
            {connected && !isV2 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                A connection exists but this account is still in standalone mode — re-submit the key to finish the switch.
              </p>
            )}
            <p className="text-xs text-[#78716C] mb-3">
              Connecting switches this account to <strong>AI employee mode</strong>: bookings go
              straight into Housecall Pro, schedules come from HCP, and the dashboard becomes
              the AI performance view. Find the key in Housecall Pro → Settings → API (MAX or XL plans only).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                placeholder="Paste the Housecall Pro API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={busy}
                className="flex-1 rounded-xl border border-[#E7E5E4] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
              <button
                onClick={connect}
                disabled={busy || apiKey.trim().length < 20}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </>
        )}
      </div>
    </motion.div>
  )
}

function WebsiteFormCard({ webhookUrl, secret }: { webhookUrl: string; secret: string }) {
  const [tab, setTab] = useState<"url" | "html" | "js">("url")

  const htmlSnippet = `<!-- Add this hidden field to your form -->
<input type="hidden" name="webhook_url" value="${webhookUrl}" />

<!-- On form submit, POST to the webhook URL: -->
<script>
  document.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await fetch('${webhookUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': '${secret}' },
      body: JSON.stringify(data),
    });
  });
</script>`

  const curlSnippet = `curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-webhook-secret: ${secret}' \\
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "phone": "5551234567",
    "email": "john@example.com",
    "service_type": "flooring"
  }'`

  const tabs = [
    { key: "url" as const, label: "Webhook URL" },
    { key: "html" as const, label: "HTML / JS" },
    { key: "js" as const, label: "cURL test" },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 300 } }}
      className="bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden"
      style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="p-6 pb-4 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #1C1917, #44403C)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3
              className="font-bold text-[#1C1917] text-lg"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Website Form / Any Source
            </h3>
            <p className="text-sm text-[#78716C] mt-0.5">
              Works with Webflow, WordPress, Gravity Forms, Typeform, or any custom form
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Ready
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-6 mb-3 flex gap-1 bg-[#F5F4F2] rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${
              tab === t.key
                ? "bg-white text-[#1C1917] shadow-sm"
                : "text-[#78716C] hover:text-[#1C1917]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mx-6 mb-6">
        {tab === "url" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-[#FAFAF8] rounded-xl p-3 border border-[#E7E5E4]">
              <code className="text-xs text-[#F97316] flex-1 break-all font-mono">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} />
            </div>
            <div className="flex items-start gap-2 text-xs text-[#78716C]">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#F97316]" />
              <p>
                POST JSON to this URL with <code className="bg-[#F5F4F2] px-1 rounded">phone</code>,{" "}
                <code className="bg-[#F5F4F2] px-1 rounded">first_name</code>, and optionally{" "}
                <code className="bg-[#F5F4F2] px-1 rounded">last_name</code>,{" "}
                <code className="bg-[#F5F4F2] px-1 rounded">email</code>,{" "}
                <code className="bg-[#F5F4F2] px-1 rounded">service_type</code>. Include header{" "}
                <code className="bg-[#F5F4F2] px-1 rounded">x-webhook-secret: {secret}</code>.
              </p>
            </div>
          </div>
        )}

        {tab === "html" && (
          <div className="relative">
            <pre className="text-[10px] text-[#78716C] bg-[#FAFAF8] rounded-xl p-3 border border-[#E7E5E4] overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
              {htmlSnippet}
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={htmlSnippet} />
            </div>
          </div>
        )}

        {tab === "js" && (
          <div className="relative">
            <pre className="text-[10px] text-[#78716C] bg-[#FAFAF8] rounded-xl p-3 border border-[#E7E5E4] overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
              {curlSnippet}
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={curlSnippet} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

const TOAST_MESSAGES: Record<string, string> = {
  facebook: "Facebook Lead Ads connected successfully",
  facebook_denied: "Facebook authorization was cancelled",
  auth_failed: "Authentication failed — please try again",
  session_lost: "Your login session couldn't be verified when Facebook redirected back — you're still logged in, just click Connect again",
  state_mismatch: "This connection was started from a different login — click Connect again from this account",
  token_failed: "Could not get Facebook access token — check your app credentials",
  no_pages: "No Facebook Pages found. Make sure this Facebook login manages your business Page, then connect again",
  save_failed: "Failed to save integration — please try again",
  no_company: "Finish setting up your account first, then connect Facebook",
}


// ─── Main ─────────────────────────────────────────────────────────────────────

export function IntegrationsClient({ integrations, facebook, webhookSecret, appUrl, toast, toastType, hcpConnected, integrationMode }: Props) {
  const [showToast, setShowToast] = useState(!!toast)
  // Housecall Pro is an HVAC-era system: tucked away unless this account uses it.
  const [showOther, setShowOther] = useState(hcpConnected || integrationMode === "housecall_pro")

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setShowToast(false), 5000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const byType = (type: string) => integrations.find((i) => i.type === type)

  const genericWebhookUrl = `${appUrl}/api/webhooks/lead`
  const googleWebhookUrl = `${appUrl}/api/webhooks/google?secret=${webhookSecret}`

  const connectedCount = integrations.filter((i) => i.is_active && i.setup_complete).length

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      <DotGrid />
      <GlowOrbs />

      {/* Toast */}
      <AnimatePresence>
        {showToast && toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg"
            style={{
              background: "white",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              borderColor: toastType === "success" ? "#BBF7D0" : "#FEE2E2",
            }}
          >
            {toastType === "success"
              ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            }
            <p className="text-sm font-medium text-[#1C1917]">
              {TOAST_MESSAGES[toast] ?? toast}
            </p>
            <button onClick={() => setShowToast(false)} className="text-[#78716C] hover:text-[#1C1917] ml-1 text-lg leading-none">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 p-8 max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-[#F97316]" />
            </div>
            <h1
              className="text-3xl font-bold text-[#1C1917]"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Integrations
            </h1>
          </div>
          <p className="text-[#78716C] mt-2 ml-12">
            Connect where your leads come from. Every new lead lands in your CRM and gets a text within seconds.
          </p>

          {connectedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 ml-12 flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 w-fit"
            >
              <Check className="w-4 h-4" />
              {connectedCount} source{connectedCount > 1 ? "s" : ""} active — leads are flowing in
            </motion.div>
          )}
        </motion.div>

        {/* Cards */}
        <div className="space-y-5">
          <FacebookCard integration={byType("facebook")} summary={facebook} errorCode={toast === "no_pages" ? "no_pages" : null} />
          <WebsiteFormCard
            webhookUrl={genericWebhookUrl}
            secret={webhookSecret}
          />
          <GoogleAdsCard webhookUrl={googleWebhookUrl} />
        </div>

        {/* Other systems: collapsed unless this account uses one */}
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowOther((v) => !v)}
            aria-expanded={showOther}
            aria-controls="other-systems"
            className="flex w-full items-center gap-2 text-sm font-semibold text-[#57534E] hover:text-[#1C1917] transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${showOther ? "rotate-90" : ""}`} />
            Other systems
            <span className="font-normal text-[#A8A29E]">Housecall Pro</span>
          </button>
          {showOther && (
            <div id="other-systems" className="mt-4">
              <HousecallProCard connected={hcpConnected} integrationMode={integrationMode} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
