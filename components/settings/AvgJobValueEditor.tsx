"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, Pencil } from "lucide-react"

interface Props {
  companyId: string
  initialValue: number
}

export function AvgJobValueEditor({ companyId, initialValue }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(initialValue || ""))
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setSaving(true)
    try {
      await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avg_job_value: num }),
      })
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="w-28 h-7 text-sm text-right"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
          autoFocus
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save} disabled={saving}>
          <Check className="w-3.5 h-3.5 text-green-600" />
        </Button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors group"
    >
      {saved ? (
        <span className="text-green-600">Saved ✓</span>
      ) : (
        <>
          <span>${value ? parseFloat(value).toLocaleString() : "—"}</span>
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </>
      )}
    </button>
  )
}
