"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Copy, Loader2, PhoneForwarded, PhoneCall } from "lucide-react"
import { toast } from "sonner"
import { getForwardingInstructions, type ForwardingProvider } from "@/lib/call-forwarding"

type Status = {
  officeNumber: string | null
  verified: boolean
  verifiedAt: string | null
  aiNumber: string | null
}

export function CallForwardingCard() {
  const [status, setStatus]           = useState<Status | null>(null)
  const [officeNumber, setOfficeNumber] = useState("")
  const [providerId, setProviderId]   = useState<string>("")
  const [testing, setTesting]         = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadStatus = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await fetch("/api/voice/verify-forwarding")
      if (!res.ok) return null
      const data = (await res.json()) as Status
      setStatus(data)
      if (data.officeNumber) setOfficeNumber((prev) => prev || data.officeNumber!)
      return data
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    loadStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadStatus])

  const providers: ForwardingProvider[] = status?.aiNumber
    ? getForwardingInstructions(status.aiNumber)
    : []
  const provider = providers.find((p) => p.id === providerId) ?? null

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied")
  }

  const startTest = async () => {
    if (!officeNumber.trim()) { toast.error("Enter your business phone number first"); return }
    setTesting(true)
    try {
      const res = await fetch("/api/voice/verify-forwarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officeNumber: officeNumber.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to start test call"); setTesting(false); return }

      toast.info("Calling your business number now — do NOT answer. Let it ring.")

      // Poll for the loop-back verification for up to 2 minutes
      let elapsed = 0
      pollRef.current = setInterval(async () => {
        elapsed += 5
        const s = await loadStatus()
        if (s?.verified) {
          if (pollRef.current) clearInterval(pollRef.current)
          setTesting(false)
          toast.success("Forwarding verified! Your AI agent now answers this line.")
        } else if (elapsed >= 120) {
          if (pollRef.current) clearInterval(pollRef.current)
          setTesting(false)
          toast.error("Couldn't verify yet — check the forwarding setup and try again. (If someone answered the test call, just re-run and let it ring.)")
        }
      }, 5000)
    } catch {
      toast.error("Something went wrong starting the test call")
      setTesting(false)
    }
  }

  if (!status) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
  }

  if (!status.aiNumber) {
    return <p className="text-sm text-muted-foreground">Your AI phone number isn&apos;t provisioned yet — forwarding setup will unlock once it is.</p>
  }

  return (
    <div className="space-y-5">
      {/* Status banner */}
      {status.verified ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            <span className="font-semibold">Forwarding verified.</span> Calls to{" "}
            <span className="font-mono">{status.officeNumber}</span> that go unanswered are picked up by your AI agent.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your customers keep calling the number they already know. When nobody at the office picks up —
          after hours, weekends, or a busy rush — the call forwards to your AI number and gets answered
          instead of hitting voicemail. Anyone who answers the office phone always wins; the AI only takes
          the calls you miss.
        </p>
      )}

      {/* Step 1 — business number */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">1. Your business phone number</p>
        <Input
          type="tel"
          placeholder="(561) 555-0123"
          value={officeNumber}
          onChange={(e) => setOfficeNumber(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Step 2 — provider instructions */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">2. Turn on no-answer forwarding to <span className="font-mono text-primary">{status.aiNumber}</span></p>
        <Select value={providerId} onValueChange={(v) => setProviderId(v ?? "")}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Who provides your phone service?" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {provider && provider.method === "dial_code" && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">Dial this once from the business phone:</p>
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`tel:${encodeURIComponent(provider.enableCode!)}`}
                className="font-mono text-base font-semibold text-primary underline underline-offset-4">
                {provider.enableCode}
              </a>
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => copy(provider.enableCode!)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            {provider.note && <p className="text-xs text-muted-foreground">{provider.note}</p>}
            <p className="text-xs text-muted-foreground">To turn it off later, dial <span className="font-mono">{provider.disableCode}</span>.</p>
          </div>
        )}

        {provider && provider.method === "settings_menu" && (
          <div className="rounded-lg border bg-muted/40 p-3 mt-2">
            <ol className="list-decimal list-inside space-y-1 text-sm">
              {provider.steps!.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}
      </div>

      {/* Step 3 — test call */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">3. Test it</p>
        <p className="text-xs text-muted-foreground">
          We&apos;ll call your business number from the AI line. <span className="font-semibold">Don&apos;t answer</span> —
          when forwarding kicks in, the call loops back to us and verifies itself automatically.
        </p>
        <Button onClick={startTest} disabled={testing} className="mt-1">
          {testing
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Waiting for the loop-back…</>
            : <><PhoneCall className="w-4 h-4 mr-2" /> {status.verified ? "Re-test forwarding" : "Place test call"}</>}
        </Button>
      </div>

      {status.verified && status.verifiedAt && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <PhoneForwarded className="w-3.5 h-3.5" />
          Verified {new Date(status.verifiedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}
