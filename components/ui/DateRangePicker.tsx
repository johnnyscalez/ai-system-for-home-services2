"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type DateRange = {
  from: string   // YYYY-MM-DD
  until: string  // YYYY-MM-DD
  label: string
}

const today = () => new Date().toISOString().slice(0, 10)

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function startOfMonth(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 10)
}

function endOfMonth(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset + 1)
  d.setDate(0)
  return d.toISOString().slice(0, 10)
}

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`
}

export const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Today",        range: () => ({ from: today(),         until: today(),         label: "Today" }) },
  { label: "Last 7 days",  range: () => ({ from: daysAgo(6),     until: today(),         label: "Last 7 days" }) },
  { label: "Last 30 days", range: () => ({ from: daysAgo(29),    until: today(),         label: "Last 30 days" }) },
  { label: "This month",   range: () => ({ from: startOfMonth(),  until: today(),         label: "This month" }) },
  { label: "Last month",   range: () => ({ from: startOfMonth(-1), until: endOfMonth(-1), label: "Last month" }) },
  { label: "Last 90 days", range: () => ({ from: daysAgo(89),    until: today(),         label: "Last 90 days" }) },
  { label: "This year",    range: () => ({ from: startOfYear(),   until: today(),         label: "This year" }) },
  { label: "All time",     range: () => ({ from: "2020-01-01",    until: today(),         label: "All time" }) },
]

function fmt(iso: string) {
  const [y, m, d] = iso.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

type Props = {
  value: DateRange
  onChange: (r: DateRange) => void
  className?: string
}

export function DateRangePicker({ value, onChange, className }: Props) {
  const [open, setOpen]       = useState(false)
  const [from, setFrom]       = useState(value.from)
  const [until, setUntil]     = useState(value.until)
  const [active, setActive]   = useState<string | null>(value.label)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Sync when value changes externally
  useEffect(() => {
    setFrom(value.from)
    setUntil(value.until)
    setActive(value.label)
  }, [value])

  function applyPreset(preset: typeof PRESETS[number]) {
    const r = preset.range()
    setFrom(r.from)
    setUntil(r.until)
    setActive(preset.label)
    onChange(r)
    setOpen(false)
  }

  function applyCustom() {
    if (!from || !until || from > until) return
    const r: DateRange = { from, until, label: `${fmt(from)} – ${fmt(until)}` }
    setActive(null)
    onChange(r)
    setOpen(false)
  }

  const displayLabel = value.label.startsWith("20") || value.label.includes("–")
    ? value.label  // custom range with dates
    : value.label

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-150",
          open
            ? "border-[#7C3AED] bg-[#7C3AED]/5 text-[#7C3AED]"
            : "border-[#E7E5E4] bg-white text-[#1C1917] hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/4"
        )}
      >
        <Calendar className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[200px] truncate">{displayLabel}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-[#78716C] transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl border border-[#E7E5E4] shadow-xl overflow-hidden"
            style={{ minWidth: 280, boxShadow: "0 16px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)" }}
          >
            {/* Presets */}
            <div className="p-2 border-b border-[#F5F4F2]">
              <p className="text-[10px] font-semibold text-[#78716C] uppercase tracking-widest px-2 py-1.5">Quick select</p>
              <div className="space-y-0.5">
                {PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      active === preset.label
                        ? "bg-[#7C3AED]/10 text-[#7C3AED] font-semibold"
                        : "text-[#1C1917] hover:bg-[#F5F4F2]"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom range */}
            <div className="p-3">
              <p className="text-[10px] font-semibold text-[#78716C] uppercase tracking-widest mb-2.5">Custom range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#78716C] font-medium block mb-1">From</label>
                  <input
                    type="date"
                    value={from}
                    max={until || today()}
                    onChange={e => { setFrom(e.target.value); setActive(null) }}
                    className="w-full text-xs border border-[#E7E5E4] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 text-[#1C1917]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#78716C] font-medium block mb-1">Until</label>
                  <input
                    type="date"
                    value={until}
                    min={from}
                    max={today()}
                    onChange={e => { setUntil(e.target.value); setActive(null) }}
                    className="w-full text-xs border border-[#E7E5E4] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 text-[#1C1917]"
                  />
                </div>
              </div>
              <button
                onClick={applyCustom}
                disabled={!from || !until || from > until}
                className="mt-2.5 w-full py-2 rounded-lg bg-[#7C3AED] text-white text-sm font-semibold hover:bg-[#6D28D9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply range
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
