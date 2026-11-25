"use client"

import { useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, Clock, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "@/lib/utils"
import {
  LEAD_STATUS, PIPELINE_COLUMNS, leadStatusLabel, leadStatusBadge, pipelineColumnOf, hasRealPhone,
} from "@/lib/lead-status"
import { createClient } from "@/lib/supabase"
import { useVisiblePoll, useCompanyRealtime } from "@/components/leads/live"
import {
  CONVERSATION_LIST_SELECT, toConversationRows, type ConversationRow,
} from "@/components/leads/conversation-rows"

export type { ConversationRow }

const HUMAN_TAG = "You are handling"

// Chip colours and order come from the shared status map, so a new status shows
// up here with the right colour without touching this file.
const TAG_STYLE = new Map<string, { chip: string; dot: string }>()
const TAG_ORDER: string[] = []
for (const column of PIPELINE_COLUMNS) {
  for (const status of column.statuses) {
    const label = LEAD_STATUS[status]?.label
    if (!label || TAG_STYLE.has(label)) continue
    TAG_STYLE.set(label, { chip: pipelineColumnOf(status).chip, dot: pipelineColumnOf(status).dot })
    TAG_ORDER.push(label)
  }
}
TAG_STYLE.set(HUMAN_TAG, { chip: "bg-amber-500 text-white border-amber-500", dot: "bg-amber-500" })
TAG_ORDER.push(HUMAN_TAG)

const CHANNEL_LABEL: Record<string, string> = { sms: "Text", messenger: "Messenger", voice: "Call" }

function tagsOf(row: ConversationRow): string[] {
  const t = [leadStatusLabel(row.status)]
  if (row.ai_paused) t.push(HUMAN_TAG)
  return t
}

export function ConversationsList({
  companyId,
  initialRows,
}: {
  companyId: string
  initialRows: ConversationRow[]
}) {
  const [rows, setRows] = useState<ConversationRow[]>(initialRows)
  const [query, setQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // Live: a new message or a status change refetches the list (realtime where
  // the table is published, the 20 second poll everywhere else).
  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("leads")
      .select(CONVERSATION_LIST_SELECT)
      .eq("company_id", companyId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
    if (error || !data) return
    setRows(toConversationRows(data))
  }, [companyId])

  useVisiblePoll(refresh, 20_000)
  useCompanyRealtime(companyId, ["conversations", "leads"], () => { void refresh() })

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
            placeholder="Search by name, phone or channel"
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
                    ? TAG_STYLE.get(tag)?.chip ?? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground/80 border-border hover:border-foreground/30 hover:bg-muted/40"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white/90" : TAG_STYLE.get(tag)?.dot ?? "bg-muted-foreground"}`} />
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
              <p className="text-xs text-muted-foreground mt-1">Threads show here as soon as the first text goes out to a lead.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Search className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations match.</p>
              <button type="button" onClick={clearAll} className="text-xs text-[#F97316] hover:underline mt-2">Clear filters</button>
            </div>
          ) : (
            filtered.map((lead) => (
              <motion.a
                key={lead.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
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
                      {hasRealPhone(lead.phone)
                        ? lead.phone
                        : lead.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(" · ") || "No phone on file"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {hasRealPhone(lead.phone) && lead.channels.length > 0 && (
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      {lead.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(" · ")}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {lead.messageCount} message{lead.messageCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lead.last_message_at ? formatDistanceToNow(lead.last_message_at) : "—"}
                  </span>
                  {lead.ai_paused && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      You are handling
                    </Badge>
                  )}
                  <Badge variant="outline" className={`text-xs ${leadStatusBadge(lead.status)}`}>
                    {leadStatusLabel(lead.status)}
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
