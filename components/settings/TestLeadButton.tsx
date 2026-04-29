"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FlaskConical, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react"

export function TestLeadButton() {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function runTest() {
    setState("loading")
    setAiMessage(null)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/test/lead", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong")
        setState("error")
        return
      }

      setAiMessage(data.aiMessage ?? null)
      setState("success")
      setExpanded(true)
    } catch {
      setErrorMsg("Network error — please try again")
      setState("error")
    }
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={runTest}
        disabled={state === "loading"}
        variant="outline"
        className="gap-2"
      >
        {state === "loading" ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Running test…</>
        ) : (
          <><FlaskConical className="w-4 h-4" /> Run test lead</>
        )}
      </Button>

      {state === "success" && aiMessage && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              AI is working — here&apos;s the opening message it would send
            </div>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
              : <ChevronDown className="w-4 h-4 text-emerald-400 shrink-0" />
            }
          </button>
          {expanded && (
            <div className="px-4 pb-4">
              <div className="bg-white border border-emerald-500/20 rounded-lg px-4 py-3 text-sm text-foreground">
                {aiMessage}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                No SMS was sent. This is a preview only. A test lead was created in your CRM.
              </p>
            </div>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
