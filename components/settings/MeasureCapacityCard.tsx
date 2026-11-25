"use client"

import { useEffect, useState } from "react"
import { Ruler, Minus, Plus, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function MeasureCapacityCard() {
  const [saved, setSaved]     = useState<number | null>(null)
  const [count, setCount]     = useState(1)
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/settings/measure-capacity")
      .then(r => r.json())
      .then(d => {
        if (typeof d.count === "number") {
          const c = Math.min(10, Math.max(1, d.count))
          setSaved(c)
          setCount(c)
        }
      })
      .catch(() => setError("Could not load measure capacity."))
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    setDone(false)
    try {
      const res = await fetch("/api/settings/measure-capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? "Failed to save."); return }
      setSaved(data.count ?? count)
      setDone(true)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Ruler className="w-3.5 h-3.5" />
          Measure capacity
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          How many in-home measures can you run at the same time? The AI books one measure per slot at a time, so this is how many it can fit in the same window.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" size="icon" aria-label="Fewer" disabled={saving || count <= 1}
          onClick={() => { setCount(c => Math.max(1, c - 1)); setDone(false) }}>
          <Minus className="w-4 h-4" />
        </Button>
        <span className="text-2xl font-bold w-10 text-center tabular-nums">{count}</span>
        <Button type="button" variant="outline" size="icon" aria-label="More" disabled={saving || count >= 10}
          onClick={() => { setCount(c => Math.min(10, c + 1)); setDone(false) }}>
          <Plus className="w-4 h-4" />
        </Button>
        <Button size="sm" onClick={save} disabled={saving || count === saved} className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
          {done ? "Saved" : "Save"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
