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

interface WhatsAppConnection {
  status: string
  status_detail: string | null
  phone_number: string
  display_name: string
  sender_type?: string | null
}

interface Props {
  integrations: Integration[]
  webhookSecret: string
  appUrl: string
  toast: string | null
  toastType: "success" | "error" | null
  whatsapp: WhatsAppConnection | null
  companyName: string
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

function FacebookCard({ integration, errorCode }: { integration: Integration | undefined; errorCode: string | null }) {
  const connected = !!integration?.is_active && !!integration?.setup_complete
  const needsSetup = !!integration && !integration.setup_complete
  const noPages = errorCode === "no_pages"

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 300 } }}
      className="bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden"
      style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Header */}
      <div className="p-6 pb-4 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #1877F2, #0C5AC4)" }}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <div>
            <h3
              className="font-bold text-[#1C1917] text-lg"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Facebook Lead Ads
            </h3>
            <p className="text-sm text-[#78716C] mt-0.5">
              {connected
                ? `Connected to: ${integration?.fb_page_name}`
                : needsSetup
                ? "Account connected — choose your page and lead form to activate"
                : "Connect your Facebook Business page to receive leads automatically"}
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
            Your Facebook account is connected. Now choose which page and lead form to track so we can start texting your leads.
          </p>
        </div>
      )}

      {/* Stats row (when connected) */}
      {connected && (
        <div className="mx-6 mb-4 grid grid-cols-2 gap-3">
          <div className="bg-[#FAFAF8] rounded-xl p-3 border border-[#E7E5E4]">
            <p className="text-2xl font-bold text-[#1C1917]"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              {integration?.lead_count ?? 0}
            </p>
            <p className="text-xs text-[#78716C] mt-0.5">Leads received</p>
          </div>
          <div className="bg-[#FAFAF8] rounded-xl p-3 border border-[#E7E5E4]">
            <p className="text-sm font-semibold text-[#1C1917] mt-1">
              {integration?.last_lead_at
                ? new Date(integration.last_lead_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "No leads yet"}
            </p>
            <p className="text-xs text-[#78716C] mt-0.5">Last lead</p>
          </div>
        </div>
      )}

      {/* Selected forms (when connected) */}
      {connected && integration?.fb_selected_form_ids && integration.fb_selected_form_ids.length > 0 && (
        <div className="mx-6 mb-4 bg-[#FAFAF8] rounded-xl p-3 border border-[#E7E5E4]">
          <p className="text-xs text-[#78716C]">
            Tracking {integration.fb_selected_form_ids.length} lead form{integration.fb_selected_form_ids.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* No pages found — persistent troubleshooter */}
      {!connected && !needsSetup && noPages && (
        <div className="mx-6 mb-4 bg-red-50 rounded-xl p-4 border border-red-100">
          <p className="text-sm font-semibold text-red-700 mb-1">No Facebook Pages found on your account</p>
          <p className="text-sm text-red-600 mb-3">
            Facebook only shows pages where you&apos;re a <strong>direct admin</strong> of the page (not just a Business Manager user). Try one of these:
          </p>
          <ol className="space-y-2">
            {[
              "Go to your Facebook Page → Settings → Page roles → confirm you're listed as Admin",
              "If managed via Business Manager: go to Business Settings → Pages → add yourself as a direct admin",
              "Then click Connect Facebook below to try again",
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
              "Click Connect below and authorize with your Facebook account",
              "Choose which page and lead form to track",
              "Every new Facebook Lead Ad lead gets an AI SMS within 3.7 seconds",
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
      <div className="px-6 pb-6 flex items-center gap-3">
        {connected ? (
          <>
            <a
              href="/integrations/facebook-setup"
              className="flex items-center gap-2 text-sm font-medium text-[#78716C] px-4 py-2 rounded-xl border border-[#E7E5E4] hover:bg-[#F5F4F2] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change page / forms
            </a>
            <DisconnectButton label="Disconnect" requireConfirm />
            <p className="text-xs text-[#78716C] ml-auto">
              Since {new Date(integration!.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </>
        ) : needsSetup ? (
          <>
            <a
              href="/integrations/facebook-setup"
              className="flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #D97706, #B45309)",
                boxShadow: "0 4px 14px rgba(217,119,6,0.3)",
              }}
            >
              Complete setup
              <ChevronRight className="w-4 h-4" />
            </a>
            <DisconnectButton />
          </>
        ) : (
          <a
            href="/api/auth/facebook"
            className="flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #1877F2, #0C5AC4)",
              boxShadow: "0 4px 14px rgba(24,119,242,0.3)",
            }}
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
              The AI books into your real calendar and reads your techs from Housecall Pro.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        {connected && isV2 ? (
          <p className="text-sm text-[#57534E] bg-[#FAFAF8] border border-[#E7E5E4] rounded-xl px-4 py-3">
            Connected. Every booking the AI makes is pushed into Housecall Pro with the
            conversation summary in the job notes, and technicians and schedules sync automatically.
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
              straight into Housecall Pro, tech schedules come from HCP, and the dashboard becomes
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
    "service_type": "roofing"
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
  no_pages: "No Facebook Pages found — make sure you manage at least one Business Page",
  save_failed: "Failed to save integration — please try again",
}


// ─── WhatsApp card ────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function WhatsAppCard({ connection, companyName }: { connection: WhatsAppConnection | null; companyName: string }) {
  const router = useRouter()
  // The display name customers see on WhatsApp — their company name, not ours
  const [displayName, setDisplayName] = useState(connection?.display_name ?? companyName ?? "")
  const [mode, setMode] = useState<"fieldbuilt" | "byon" | "own_waba">(
    (connection?.sender_type as "fieldbuilt" | "byon" | "own_waba") ?? "fieldbuilt"
  )
  const [ownNumber, setOwnNumber] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    connection?.status === "action_required" ? connection.status_detail : null
  )

  const status = connection?.status ?? "none"
  const connected = status === "online"
  const pending = status === "pending"
  const verifyOtp = status === "verify_otp"

  async function connect() {
    setBusy(true); setError(null)
    const res = await fetch("/api/integrations/whatsapp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        sender_type: mode,
        own_number: mode === "byon" ? ownNumber : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error ?? "Connection failed"); return }
    router.refresh()
  }

  // Level 3: Meta embedded signup — connect their existing WABA (coexistence).
  // Requires NEXT_PUBLIC_FACEBOOK_APP_ID + NEXT_PUBLIC_META_ES_CONFIG_ID.
  const fbAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
  const esConfigId = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID

  async function connectOwnWaba() {
    if (!fbAppId || !esConfigId) {
      setError("Embedded signup isn't configured yet (missing Meta app config). Use one of the other two options, or contact support.")
      return
    }
    setBusy(true); setError(null)

    // Load the Facebook JS SDK once
    if (!(window as unknown as { FB?: unknown }).FB) {
      await new Promise<void>((resolve, reject) => {
        const js = document.createElement("script")
        js.src = "https://connect.facebook.net/en_US/sdk.js"
        js.onload = () => resolve()
        js.onerror = () => reject(new Error("Failed to load Facebook SDK"))
        document.body.appendChild(js)
      }).catch(() => null)
      const FB = (window as unknown as { FB?: { init: (o: object) => void } }).FB
      FB?.init({ appId: fbAppId, autoLogAppEvents: true, xfbml: false, version: "v21.0" })
    }

    // Session info (waba_id + phone_number_id) arrives via postMessage
    const sessionInfo: { waba_id?: string; phone_number_id?: string } = {}
    const listener = (event: MessageEvent) => {
      if (!String(event.origin).endsWith("facebook.com")) return
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          sessionInfo.waba_id = data.data.waba_id ?? sessionInfo.waba_id
          sessionInfo.phone_number_id = data.data.phone_number_id ?? sessionInfo.phone_number_id
        }
      } catch { /* not our message */ }
    }
    window.addEventListener("message", listener)

    const FB = (window as unknown as {
      FB?: { login: (cb: (r: { authResponse?: { code?: string } }) => void, opts: object) => void }
    }).FB

    FB?.login(
      async (response) => {
        window.removeEventListener("message", listener)
        const code = response?.authResponse?.code
        if (!code || !sessionInfo.waba_id || !sessionInfo.phone_number_id) {
          setBusy(false)
          setError("The Meta popup didn't complete — make sure you finish all steps including selecting your WhatsApp number.")
          return
        }
        const res = await fetch("/api/integrations/whatsapp/cloud-connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, waba_id: sessionInfo.waba_id, phone_number_id: sessionInfo.phone_number_id }),
        })
        const data = await res.json().catch(() => ({}))
        setBusy(false)
        if (!res.ok) { setError(data.error ?? "Connection failed"); return }
        router.refresh()
      },
      {
        config_id: esConfigId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      }
    )
  }

  async function submitOtp() {
    setBusy(true); setError(null)
    const res = await fetch("/api/integrations/whatsapp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: otpCode }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error ?? "Verification failed"); return }
    router.refresh()
  }

  async function refreshStatus() {
    setBusy(true)
    await fetch("/api/integrations/whatsapp/status").catch(() => null)
    setBusy(false)
    router.refresh()
  }

  async function disconnect() {
    if (!confirm("Disconnect WhatsApp? Leads will no longer be able to reach you there.")) return
    setBusy(true)
    await fetch("/api/integrations/whatsapp/disconnect", { method: "POST" }).catch(() => null)
    setBusy(false)
    router.refresh()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="bg-white rounded-2xl border border-[#E7E5E4] p-6"
      style={{ boxShadow: "0 4px 24px rgba(37,211,102,0.08)" }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#DCFCE7" }}>
            <WhatsAppIcon className="w-6 h-6 text-[#16A34A]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1C1917]" style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              WhatsApp Business
            </h2>
            <p className="text-sm text-[#78716C]">
              {connected
                ? `Live on ${connection!.phone_number} as "${connection!.display_name}"`
                : pending
                ? "Registration submitted — Meta is reviewing your display name"
                : verifyOtp
                ? `Verification code sent to ${connection!.phone_number}`
                : "Let leads message you on WhatsApp — the AI answers there too"}
            </p>
          </div>
        </div>
        <StatusBadge connected={connected} />
      </div>

      {/* Pending state */}
      {pending && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>In review at Meta.</strong> Display name approval usually takes minutes to a day.
            Your number ({connection!.phone_number}) will start receiving WhatsApp messages the moment it clears.
          </p>
          <button onClick={refreshStatus} disabled={busy}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-900">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Check status
          </button>
        </div>
      )}


      {/* OTP verification state (own-number connections) */}
      {verifyOtp && (
        <div className="mt-5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF8] p-4">
          <p className="text-sm text-[#1C1917] mb-3">
            <strong>Enter the code</strong> Meta just sent by SMS to {connection!.phone_number} to prove you own the number.
          </p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="6-digit code"
              inputMode="numeric"
              className="w-40 rounded-xl border border-[#E7E5E4] bg-white px-4 py-2.5 text-sm tracking-widest text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
            />
            <button onClick={submitOtp} disabled={busy || otpCode.replace(/\D/g, "").length < 4}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#16A34A" }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Verify
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </div>
      )}
      {/* Connected state */}
      {connected && (
        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
            <Check className="w-4 h-4" />
            WhatsApp messages flow into the same AI conversations as SMS
          </div>
          <button onClick={disconnect} disabled={busy}
            className="text-sm font-semibold text-red-600 hover:text-red-700">
            Disconnect
          </button>
        </div>
      )}

      {/* Setup state */}
      {!connected && !pending && !verifyOtp && (
        <div className="mt-5">
          {/* Which number becomes the WhatsApp line */}
          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            <button onClick={() => setMode("fieldbuilt")}
              className="text-left rounded-xl border p-3.5 transition-colors"
              style={{
                borderColor: mode === "fieldbuilt" ? "#16A34A" : "#E7E5E4",
                background: mode === "fieldbuilt" ? "#F0FDF4" : "white",
              }}>
              <p className="text-sm font-bold text-[#1C1917]">Use your FieldBuilt number <span className="text-[10px] font-bold text-[#16A34A] uppercase ml-1">Recommended</span></p>
              <p className="text-xs text-[#78716C] mt-1">Instant. Your existing WhatsApp app keeps working untouched — this adds WhatsApp to the number that already texts your leads.</p>
            </button>
            <button onClick={() => setMode("own_waba")}
              className="text-left rounded-xl border p-3.5 transition-colors"
              style={{
                borderColor: mode === "own_waba" ? "#16A34A" : "#E7E5E4",
                background: mode === "own_waba" ? "#F0FDF4" : "white",
              }}>
              <p className="text-sm font-bold text-[#1C1917]">Connect your existing WhatsApp Business</p>
              <p className="text-xs text-[#78716C] mt-1">Keep your number AND keep using WhatsApp on your phones — the AI joins the same account.</p>
            </button>
            <button onClick={() => setMode("byon")}
              className="text-left rounded-xl border p-3.5 transition-colors"
              style={{
                borderColor: mode === "byon" ? "#16A34A" : "#E7E5E4",
                background: mode === "byon" ? "#F0FDF4" : "white",
              }}>
              <p className="text-sm font-bold text-[#1C1917]">Move your number to FieldBuilt</p>
              <p className="text-xs text-[#78716C] mt-1">Your number, fully AI-operated. The phone app stops working for it. Verified by SMS code.</p>
            </button>
          </div>

          {mode === "own_waba" && (
            <div className="mb-3">
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
                <Info className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <p className="text-xs text-green-800">
                  You&apos;ll sign in with the Facebook account that manages your WhatsApp Business.
                  Your team keeps using WhatsApp on their phones exactly as today — the AI answers
                  new leads, and the moment a human replies from the app, the AI steps back on that conversation.
                </p>
              </div>
              <button onClick={connectOwnWaba} disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: "#1877F2", boxShadow: "0 4px 16px rgba(24,119,242,0.3)" }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Continue with Facebook
              </button>
              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {mode === "byon" && (
            <>
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <strong>Important:</strong> if this number currently runs the WhatsApp Business app on a phone,
                  it will STOP working in that app once connected here — all WhatsApp messages will flow to your
                  AI and the FieldBuilt inbox instead. Your regular calls and SMS on the number are not affected.
                </p>
              </div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                Your WhatsApp Business number
              </label>
              <input
                value={ownNumber}
                onChange={(e) => setOwnNumber(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full mb-3 rounded-xl border border-[#E7E5E4] bg-white px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
              />
            </>
          )}

          {mode !== "own_waba" && (<>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
            Business display name (what customers see on WhatsApp)
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={companyName || "Your company name"}
              className="flex-1 min-w-[220px] rounded-xl border border-[#E7E5E4] bg-white px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
            />
            <button
              onClick={connect}
              disabled={busy || displayName.trim().length < 3 || (mode === "byon" && ownNumber.replace(/\D/g, "").length < 8)}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              style={{ background: "#16A34A", boxShadow: "0 4px 16px rgba(22,163,74,0.3)" }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
              Connect WhatsApp
            </button>
          </div>
          <p className="mt-2 text-xs text-[#78716C]">
            {mode === "fieldbuilt"
              ? "Uses your existing FieldBuilt number — no new number needed. Approval by Meta usually takes minutes to a day."
              : "Meta texts a verification code to your number, then reviews the display name — usually minutes to a day."}
          </p>
          </>)}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function IntegrationsClient({ integrations, webhookSecret, appUrl, toast, toastType, whatsapp, companyName, hcpConnected, integrationMode }: Props) {
  const [showToast, setShowToast] = useState(!!toast)

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
            Connect your lead sources. Every lead gets an AI SMS within 3.7 seconds.
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
          <HousecallProCard connected={hcpConnected} integrationMode={integrationMode} />
          <FacebookCard integration={byType("facebook")} errorCode={toast === "no_pages" ? "no_pages" : null} />
          <WhatsAppCard connection={whatsapp} companyName={companyName} />
          <GoogleAdsCard webhookUrl={googleWebhookUrl} />
          <WebsiteFormCard
            webhookUrl={genericWebhookUrl}
            secret={webhookSecret}
          />
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-xs text-[#78716C] text-center"
        >
          More integrations coming soon — Angi, HomeAdvisor, Thumbtack, and more
        </motion.p>
      </div>
    </div>
  )
}
