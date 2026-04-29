"use client"

import { useState } from "react"
import { Phone, PhoneOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CallLeadButton({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "calling" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleCall() {
    setState("calling")
    setErrorMsg("")
    try {
      const res = await fetch("/api/voice/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to initiate call")
        setState("error")
      } else {
        // Stay in "calling" briefly so user sees feedback, then reset
        setTimeout(() => setState("idle"), 4000)
      }
    } catch {
      setErrorMsg("Network error")
      setState("error")
    }
  }

  if (state === "error") {
    return (
      <div className="space-y-1.5">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
          onClick={() => setState("idle")}
        >
          <PhoneOff className="w-3.5 h-3.5" />
          Call failed — retry
        </Button>
        <p className="text-[10px] text-red-400/70 text-center">{errorMsg}</p>
      </div>
    )
  }

  if (state === "calling") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-emerald-400 border-emerald-500/30 bg-emerald-500/8"
        disabled
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Calling…
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
      onClick={handleCall}
      disabled={disabled}
    >
      <Phone className="w-3.5 h-3.5" />
      Call Lead
    </Button>
  )
}
