"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Date-range picker built for this dashboard specifically.
//
// The selected span renders as ONE continuous track rather than a row of
// separately-highlighted squares: a warm wash runs edge-to-edge between the
// endpoints and the endpoints themselves are solid discs, so a range reads as
// a single object you could pick up. That silhouette is the whole idea —
// everything else stays quiet around it.
//
// All dates are plain "YYYY-MM-DD" calendar keys. No Date-object timezone
// ambiguity lives in here; the caller resolves keys to instants in the
// company's timezone.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  ink: "#1C1917",
  muted: "#78716C",
  faint: "#A8A29E",
  hair: "#E7E5E4",
  surface: "#FFFFFF",
  wash: "#FAFAF8",
  accent: "#F97316",
  accentDeep: "#EA580C",
} as const

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const

// ── Calendar-key math (string in, string out — no timezone involved) ─────────

/** Noon UTC keeps every conversion clear of DST edges. */
const at = (key: string) => new Date(`${key}T12:00:00Z`)

function shiftDay(key: string, n: number): string {
  const d = at(key)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function shiftMonth(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

function monthLabel(monthKey: string): string {
  return at(`${monthKey}-01`).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  })
}

/** Sunday-first cells for a month; nulls pad the leading week. */
function monthCells(monthKey: string): Array<string | null> {
  const first = `${monthKey}-01`
  const lead = at(first).getUTCDay()
  const [y, m] = monthKey.split("-").map(Number)
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: Array<string | null> = Array(lead).fill(null)
  for (let d = 1; d <= count; d++) cells.push(`${monthKey}-${String(d).padStart(2, "0")}`)
  return cells
}

function prettyRange(from: string, to: string): string {
  const opts = { month: "short", day: "numeric", timeZone: "UTC" } as const
  const a = at(from).toLocaleDateString("en-US", opts)
  const b = at(to).toLocaleDateString("en-US", opts)
  return from === to ? a : `${a} – ${b}`
}

function dayCount(from: string, to: string): number {
  return Math.round((at(to).getTime() - at(from).getTime()) / 86_400_000) + 1
}

// ── One month grid ───────────────────────────────────────────────────────────

function MonthGrid({
  monthKey, fromKey, toKey, todayKey, pendingStart, hoverKey, onPick, onHover,
}: {
  monthKey: string
  fromKey: string
  toKey: string
  todayKey: string
  pendingStart: string | null
  hoverKey: string | null
  onPick: (key: string) => void
  onHover: (key: string | null) => void
}) {
  const cells = useMemo(() => monthCells(monthKey), [monthKey])

  // Mid-selection, the range previews against whatever the cursor is over.
  const [lo, hi] = pendingStart
    ? [pendingStart, hoverKey ?? pendingStart].sort()
    : [fromKey, toKey]

  return (
    <div className="w-[15.5rem]">
      <div className="grid grid-cols-7 mb-1.5">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="h-6 grid place-items-center text-[10px] font-bold" style={{ color: C.muted }}>
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((key, i) => {
          if (!key) return <span key={`pad-${i}`} className="h-9" />
          const rowStart = i % 7 === 0
          const rowEnd = i % 7 === 6

          const isFuture = key > todayKey
          const isStart = key === lo
          const isEnd = key === hi
          const inside = key > lo && key < hi
          const isToday = key === todayKey
          const selected = isStart || isEnd

          return (
            <button
              key={key}
              type="button"
              disabled={isFuture}
              onClick={() => onPick(key)}
              onMouseEnter={() => onHover(key)}
              aria-label={at(key).toLocaleDateString("en-US", { dateStyle: "full", timeZone: "UTC" })}
              aria-pressed={selected}
              className={cn(
                "relative h-9 grid place-items-center group",
                isFuture ? "cursor-default" : "cursor-pointer"
              )}
            >
              {/* Continuous track between the endpoints — inset vertically,
                  flush horizontally, so neighbouring days join with no seam. */}
              {(inside || (selected && lo !== hi)) && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-1 pointer-events-none",
                    isStart ? "left-1/2 right-0" : isEnd ? "left-0 right-1/2" : "left-0 right-0",
                    // Cap the ribbon where the week wraps or the span ends
                    (rowStart || isStart) && "rounded-l-full",
                    (rowEnd || isEnd) && "rounded-r-full"
                  )}
                  style={{ background: "rgba(249,115,22,0.11)" }}
                />
              )}

              {/* Endpoint disc */}
              {selected && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                  style={{
                    background: C.accent,
                    boxShadow: "0 2px 6px -1px rgba(234,88,12,0.45)",
                  }}
                />
              )}

              {/* Quiet hover for unselected, enabled days */}
              {!selected && !isFuture && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                  style={{ background: "rgba(28,25,23,0.06)" }}
                />
              )}

              <span
                className="relative text-[13px] tabular-nums leading-none"
                style={{
                  fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                  fontWeight: selected || isToday ? 700 : 500,
                  color: selected
                    ? "#FFFFFF"
                    : isFuture
                    ? "#D6D3D1"
                    : isToday
                    ? C.accentDeep
                    : C.ink,
                }}
              >
                {Number(key.slice(-2))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Popover ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Last 7 days",  days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
] as const

export function DateRangePopover({
  fromKey, toKey, todayKey, onChange,
}: {
  fromKey: string
  toKey: string
  todayKey: string
  onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => fromKey.slice(0, 7))
  const [pendingStart, setPendingStart] = useState<string | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Dismissal: outside pointer or Escape. Both must actually work.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false); setPendingStart(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setPendingStart(null) }
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Open showing the pair that contains the selection: if the range fits
  // inside one month, still show that month on the left with the next beside it.
  useEffect(() => {
    if (!open) return
    const startMonth = fromKey.slice(0, 7)
    const endMonth = toKey.slice(0, 7)
    setViewMonth(endMonth > startMonth ? startMonth : shiftMonth(startMonth, 0))
  }, [open, fromKey, toKey])

  const thisMonth = todayKey.slice(0, 7)
  const canGoForward = shiftMonth(viewMonth, 1) < thisMonth

  function pick(key: string) {
    if (!pendingStart) { setPendingStart(key); setHoverKey(key); return }
    const [a, b] = [pendingStart, key].sort()
    onChange(a, b)
    setPendingStart(null)
    setHoverKey(null)
    setOpen(false)
  }

  function applyPreset(days: number) {
    onChange(shiftDay(todayKey, -(days - 1)), todayKey)
    setPendingStart(null)
    setOpen(false)
  }

  const span = dayCount(fromKey, toKey)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2.5 rounded-xl bg-white pl-3.5 pr-3 py-2 transition-colors"
        style={{
          border: `1px solid ${open ? "rgba(249,115,22,0.55)" : C.hair}`,
          boxShadow: open
            ? "0 1px 2px rgba(28,25,23,0.04), 0 0 0 3px rgba(249,115,22,0.10)"
            : "0 1px 2px rgba(28,25,23,0.04)",
        }}
      >
        <span
          className="text-[13px] font-bold tabular-nums"
          style={{ color: C.ink, fontFamily: "var(--font-mono), 'JetBrains Mono', monospace" }}
        >
          {prettyRange(fromKey, toKey)}
        </span>
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(249,115,22,0.10)", color: C.accentDeep }}>
          {span}d
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: "top left",
              background: C.surface,
              border: `1px solid ${C.hair}`,
              // Directional, tinted to the warm surface — cast, not bloomed.
              boxShadow: "0 16px 34px -12px rgba(28,25,23,0.20), 0 3px 8px -3px rgba(28,25,23,0.10)",
            }}
            className="absolute z-50 mt-2 left-0 rounded-2xl p-3.5 flex gap-3.5"
          >
            {/* Preset rail */}
            <div className="hidden sm:flex flex-col gap-0.5 w-[7.5rem] pr-3.5"
              style={{ borderRight: `1px solid ${C.hair}` }}>
              {PRESETS.map((p) => {
                const active = span === p.days && toKey === todayKey
                return (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => applyPreset(p.days)}
                    className="text-left text-[12.5px] font-semibold rounded-lg px-2.5 py-2 transition-colors"
                    style={{
                      color: active ? C.accentDeep : C.muted,
                      background: active ? "rgba(249,115,22,0.10)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.wash }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent" }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            <div onMouseLeave={() => setHoverKey(null)}>
              {/* Month header spans both grids — bare chevrons, no tiles */}
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <button
                  type="button"
                  onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}
                  aria-label="Previous month"
                  className="p-1 -ml-1 rounded-md transition-colors"
                  style={{ color: C.muted }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = C.ink)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="flex-1 flex items-center justify-around text-[13px] font-bold"
                  style={{ color: C.ink, fontFamily: "var(--font-jakarta), sans-serif" }}>
                  <span>{monthLabel(viewMonth)}</span>
                  <span className="hidden sm:inline">{monthLabel(shiftMonth(viewMonth, 1))}</span>
                </span>

                <button
                  type="button"
                  onClick={() => canGoForward && setViewMonth(shiftMonth(viewMonth, 1))}
                  disabled={!canGoForward}
                  aria-label="Next month"
                  className="p-1 -mr-1 rounded-md transition-colors"
                  style={{ color: canGoForward ? C.muted : "#E7E5E4" }}
                  onMouseEnter={(e) => { if (canGoForward) e.currentTarget.style.color = C.ink }}
                  onMouseLeave={(e) => { if (canGoForward) e.currentTarget.style.color = C.muted }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-5">
                <MonthGrid
                  monthKey={viewMonth}
                  fromKey={fromKey} toKey={toKey} todayKey={todayKey}
                  pendingStart={pendingStart} hoverKey={hoverKey}
                  onPick={pick} onHover={setHoverKey}
                />
                <div className="hidden sm:block">
                  <MonthGrid
                    monthKey={shiftMonth(viewMonth, 1)}
                    fromKey={fromKey} toKey={toKey} todayKey={todayKey}
                    pendingStart={pendingStart} hoverKey={hoverKey}
                    onPick={pick} onHover={setHoverKey}
                  />
                </div>
              </div>

              <p className="mt-2.5 text-[11.5px] leading-none" style={{ color: C.faint }}>
                {pendingStart ? "Pick the end date" : "Click a day to start a new range"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
