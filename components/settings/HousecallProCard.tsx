"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2 } from "lucide-react"

// The V2 switch, as a card. Paste the client's Housecall Pro API key →
// validates against HCP, stores the connection, flips the company to
// housecall_pro mode, and starts the first sync (techs + webhooks).

export function HousecallProCard({
  connected,
  integrationMode,
}: {
  connected: boolean
  integrationMode: string
}) {
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

  if (connected && isV2) {
    return (
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-[#16A34A] mt-0.5 shrink-0" />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Housecall Pro connected</p>
            <Badge className="bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/10">AI employee mode</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Every booking the AI makes is pushed into Housecall Pro with the conversation
            summary in the job notes. Techs and schedules sync from HCP automatically.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {connected && !isV2 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          An HCP connection exists but this company is still in standalone (CRM) mode —
          re-submit the API key below to finish switching it to AI-employee mode.
        </p>
      )}
      <p className="text-xs text-muted-foreground mb-3">
        Connecting Housecall Pro switches this company to <strong>AI employee mode</strong>:
        the AI books directly into their HCP calendar, reads tech schedules from HCP, and
        the dashboard becomes the AI performance view instead of the CRM pipeline.
        The API key is in Housecall Pro → Settings → API (MAX and XL plans only).
      </p>
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="Paste their Housecall Pro API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={busy}
        />
        <Button onClick={connect} disabled={busy || apiKey.trim().length < 20}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
