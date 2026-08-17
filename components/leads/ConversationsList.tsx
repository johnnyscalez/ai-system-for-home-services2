"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, Clock, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "@/lib/utils"

export type ConversationRow = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  status: string
  ai_paused: boolean | null
  last_message_at: string | null
  messageCount: number
  channels: string[]
}

// Same tag vocabulary as the pipeline table, so a "Booked" here is a
// "Booked" there — one mental model across the CRM.
const STATUS_LABEL: Record<string, string> = {
  just_came_in: "Just came in", new: "Just came in", contacted: "Just came in",
  following_up: "No reply",
  active_conversation: "Active", followed_up: "Active", nurturing: "Active",
  qualified: "Qualified", unqualified: "Unqualified",
  appointment_booked: "Booked",
  closed: "Closed", closed_won: "Closed",
  lost: "Lost", cold: "Lost", closed_lost: "Lost",
  needs_attention: "Needs attention",
}

const STATUS_BADGE: Record<string, string> = {
  just_came_in: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  new: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  contacted: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  following_up: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  active_conversation: "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  followed_up: "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  nurturing: "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  qualified: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  unqualified: "bg-red-500/15 text-red-400 border-red-500/20",
  appointment_booked: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  closed: "bg-green-500/15 text-green-400 border-green-500/20",
  closed_won: "bg-green-500/15 text-green-400 border-green-500/20",
  lost: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  cold: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  closed_lost: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  needs_attention: "bg-red-500/15 text-red-400 border-red-500/20",
}

// Selected-state palette per tag: solid, on-brand, readable — the chip
// "lights up" in the tag's own colour instead of a generic highlight.
const CHIP_ACTIVE: Record<string, string> = {
  "Just came in": "bg-sky-500 text-white border-sky-500 shadow-[0_2px_10px_rgba(14,165,233,0.35)]",
  "No reply": "bg-orange-500 text-white border-orange-500 shadow-[0_2px_10px_rgba(249,115,22,0.35)]",
  "Active": "bg-[#F97316] text-white border-[#F97316] shadow-[0_2px_10px_rgba(249,115,22,0.35)]",
  "Qualified": "bg-amber-500 text-white border-amber-500 shadow-[0_2px_10px_rgba(245,158,11,0.35)]",
  "Unqualified": "bg-red-500 text-white border-red-500 shadow-[0_2px_10px_rgba(239,68,68,0.35)]",
  "Booked": "bg-emerald-500 text-white border-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.35)]",
  "Closed": "bg-green-600 text-white border-green-600 shadow-[0_2px_10px_rgba(22,163,74,0.35)]",
  "Lost": "bg-slate-500 text-white border-slate-500 shadow-[0_2px_10px_rgba(100,116,139,0.35)]",
  "Needs attention": "bg-red-500 text-white border-red-500 shadow-[0_2px_10px_rgba(239,68,68,0.35)]",
  "Human handling": "bg-amber-500 text-white border-amber-500 shadow-[0_2px_10px_rgba(245,158,11,0.35)]",
}

// Dot colour for the idle chip — a small swatch of the tag's colour so the
// row of chips reads as a legend, not a row of grey pills.
const CHIP_DOT: Record<string, string> = {
  "Just came in": "bg-sky-400", "No reply": "bg-orange-400", "Active": "bg-[#F97316]",
  "Qualified": "bg-amber-400", "Unqualified": "bg-red-400", "Booked": "bg-emerald-400",
  "Closed": "bg-green-500", "Lost": "bg-slate-400", "Needs attention": "bg-red-400",
  "Human handling": "bg-amber-500",
}

// Display order for the chip row — funnel order, attention items last
const TAG_ORDER = ["Just came in", "Active", "No reply", "Qualified", "Booked", "Closed", "Needs attention", "Human handling", "Lost", "Unqualified"]

const CHANNEL_LABEL: Record<string, string> = { sms: "SMS", messenger: "Messenger", whatsapp: "WhatsApp", voice: "Call" }

const HUMAN_TAG = "Human handling"

function tagsOf(row: ConversationRow): string[] {
  const t = [STATUS_LABEL[row.status] ?? row.status.replace(/_/g, " ")]
  if (row.ai_paused) t.push(HUMAN_TAG)
  return t
}

export function ConversationsList({ rows }: { rows: ConversationRow[] }) {
  const [query, setQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // Tag counts over the FULL list — chips always show the real population,
  // so you can see "Booked 12" even while another filter is active.
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) for (const t of tagsOf(r)) m.set(t, (m.get(t) ?? 0) + 1)
    return m
  }, [rows])

  const chips = TAG_ORDER.filter((t) => (tagCounts.get(t) ?? 0) > 0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, "")
    return rows.filter((r) => {
      if (activeTag && !tagsOf(r).includes(activeTag)) return false
      if (!q) return true
      const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim().toLowerCase()
      const phone = (r.phone ?? "").replace(/\D/g, "")
      return (
        name.includes(q) ||
        (digits.length >= 3 && phone.includes(digits)) ||
        r.channels.some((c) => (CHANNEL_LABEL[c] ?? c).toLowerCase().includes(q))
      )
    })
  }, [rows, query, activeTag])

  const clearAll = () => { setQuery(""); setActiveTag(null) }
  const isFiltering = !!query.trim() || !!activeTag

  return (
    <div className="space-y-4">
      {/* ── Search + tag filter bar ── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-[0_2px_12px_rgba(249,115,22,0.05)]">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or channel…"
            aria-label="Search conversations"
            className="w-full h-11 pl-10 pr-10 rounded-lg bg-background border border-border text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]/50 transition-shadow"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Filter</span>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`h-8 px-3 rounded-full border text-xs font-medium transition-all ${
              activeTag === null
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            All <span className={`ml-1 tabular-nums ${activeTag === null ? "opacity-70" : "opacity-60"}`}>{rows.length}</span>
          </button>
          {chips.map((tag) => {
            const active = activeTag === tag
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(active ? null : tag)}
                aria-pressed={active}
                className={`h-8 pl-2.5 pr-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all ${
                  active
                    ? CHIP_ACTIVE[tag] ?? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground/80 border-border hover:border-foreground/30 hover:bg-muted/40"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white/90" : CHIP_DOT[tag] ?? "bg-muted-foreground"}`} />
                {tag}
                <span className={`tabular-nums ${active ? "opacity-80" : "opacity-50"}`}>{tagCounts.get(tag)}</span>
              </button>
            )
          })}
          {isFiltering && (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto h-8 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Result count when filtering ── */}
      <AnimatePresence initial={false}>
        {isFiltering && (
          <motion.p
            key="count"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-xs text-muted-foreground px-1"
          >
            Showing <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span> of {rows.length}
            {activeTag ? <> tagged <span className="font-medium text-foreground">{activeTag}</span></> : null}
            {query.trim() ? <> matching “<span className="font-medium text-foreground">{query.trim()}</span>”</> : null}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── List ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {rows.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Conversations will appear here once your AI starts texting leads.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Search className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations match.</p>
              <button type="button" onClick={clearAll} className="text-xs text-[#F97316] hover:underline mt-2">Clear filters</button>
            </div>
          ) : (
            filtered.map((lead, i) => (
              <motion.a
                key={lead.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.18, ease: "easeOut" }}
                href={`/leads/${lead.id}?from=conversations`}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                    {(lead.first_name?.[0] ?? "").toUpperCase() || (lead.channels.includes("messenger") ? "M" : "?")}{lead.last_name?.[0]?.toUpperCase() ?? ""}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                        || (lead.channels.includes("messenger") ? "Messenger lead" : "Lead")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.phone?.startsWith("msgr:")
                        ? lead.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(" · ")
                        : lead.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {!lead.phone?.startsWith("msgr:") && lead.channels.length > 0 && (
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      {lead.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(" · ")}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {lead.messageCount} messages
                  </span>
                  <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lead.last_message_at ? formatDistanceToNow(lead.last_message_at) : "—"}
                  </span>
                  {lead.ai_paused && (
                    <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-600 border-amber-500/30">
                      human handling
                    </Badge>
                  )}
                  <Badge variant="outline" className={`text-xs ${STATUS_BADGE[lead.status] ?? ""}`}>
                    {STATUS_LABEL[lead.status] ?? lead.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </motion.a>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
