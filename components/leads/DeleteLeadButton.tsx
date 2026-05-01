"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2, AlertTriangle } from "lucide-react"

interface Props {
  leadId: string
  leadName: string
  redirectAfter?: boolean // redirect to /leads after delete (true on detail page)
}

export function DeleteLeadButton({ leadId, leadName, redirectAfter = false }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await fetch(`/api/leads/${leadId}/delete`, { method: "DELETE" })
      if (redirectAfter) {
        router.push("/leads")
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Delete <span className="font-semibold">{leadName}</span>? This can&apos;t be undone.</span>
        </div>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Yes, delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 border border-border hover:border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Delete
    </button>
  )
}
