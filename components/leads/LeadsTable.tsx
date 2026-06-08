"use client"

import { useState, useMemo } from "react"
import { Users, Search, Zap, MessageSquare, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DeleteLeadButton } from "@/components/leads/DeleteLeadButton"
import { formatDistanceToNow } from "@/lib/utils"
import type { Lead } from "@/types/database"

const STATUS_LABEL: Record<string, string> = {
  just_came_in:        "Just came in",
  new:                 "Just came in",
  contacted:           "Just came in",
  following_up:        "No reply",
  active_conversation: "Active",
  followed_up:         "Active",
  nurturing:           "Active",
  qualified:           "Qualified",
  unqualified:         "Unqualified",
  appointment_booked:  "Booked",
  closed:              "Closed",
  closed_won:          "Closed",
  lost:                "Lost",
  cold:                "Lost",
  closed_lost:         "Lost",
  needs_attention:     "Needs attention",
}

const STATUS_BADGE: Record<string, string> = {
  just_came_in:        "bg-sky-500/15 text-sky-400 border-sky-500/20",
  new:                 "bg-sky-500/15 text-sky-400 border-sky-500/20",
  contacted:           "bg-sky-500/15 text-sky-400 border-sky-500/20",
  following_up:        "bg-orange-500/15 text-orange-400 border-orange-500/20",
  active_conversation: "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  followed_up:         "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  nurturing:           "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  qualified:           "bg-amber-500/15 text-amber-400 border-amber-500/20",
  unqualified:         "bg-red-500/15 text-red-400 border-red-500/20",
  appointment_booked:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  closed:              "bg-green-500/15 text-green-400 border-green-500/20",
  closed_won:          "bg-green-500/15 text-green-400 border-green-500/20",
  lost:                "bg-slate-500/15 text-slate-400 border-slate-500/20",
  cold:                "bg-slate-500/15 text-slate-400 border-slate-500/20",
  closed_lost:         "bg-slate-500/15 text-slate-400 border-slate-500/20",
  needs_attention:     "bg-red-500/15 text-red-400 border-red-500/20",
}

export function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [query, setQuery] = useState("")

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const isActive = (lead: Lead) =>
    lead.is_active_conversation && !!lead.last_inbound_at && lead.last_inbound_at > twoHoursAgo

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return initialLeads
    return initialLeads.filter(lead => {
      const name    = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.toLowerCase()
      const phone   = (lead.phone ?? "").toLowerCase().replace(/\D/g, "")
      const email   = (lead.email ?? "").toLowerCase()
      const address = (lead.address ?? "").toLowerCase()
      const qDigits = q.replace(/\D/g, "")
      return (
        name.includes(q) ||
        email.includes(q) ||
        address.includes(q) ||
        (qDigits && phone.includes(qDigits)) ||
        phone.includes(q)
      )
    })
  }, [initialLeads, query])

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header with search */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="font-semibold text-sm shrink-0">All Leads</span>

        {/* Search input */}
        <div className="relative flex-1 max-w-xs ml-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, phone, email, address…"
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]/60 placeholder:text-muted-foreground/60 transition"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {filtered.length}{query ? ` of ${initialLeads.length}` : " total"}
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">
            {query ? `No leads match "${query}"` : "No leads yet. They will appear here as soon as your first lead comes in."}
          </div>
        ) : (
          filtered.map(lead => (
            <div
              key={lead.id}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
            >
              <a href={`/leads/${lead.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                  {lead.first_name?.[0] ?? "?"}{lead.last_name?.[0] ?? ""}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">
                      {lead.first_name} {lead.last_name}
                    </p>
                    {isActive(lead) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                        <Zap className="w-2 h-2" /> Active
                      </span>
                    )}
                    {lead.status === "following_up" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20">
                        <MessageSquare className="w-2 h-2" /> Following up
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{lead.phone}</p>
                  {lead.address && (
                    <p className="text-xs text-muted-foreground/70 truncate max-w-[220px]">{lead.address}</p>
                  )}
                </div>
              </a>

              <div className="flex items-center gap-4 shrink-0">
                {lead.deal_value && (
                  <span className="text-xs font-semibold text-green-700 hidden md:block">
                    ${lead.deal_value.toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground hidden md:block capitalize">{lead.source}</span>
                <span className="text-xs text-muted-foreground hidden md:block">
                  {formatDistanceToNow(lead.created_at)}
                </span>
                <Badge variant="outline" className={`text-xs ${STATUS_BADGE[lead.status] ?? ""}`}>
                  {STATUS_LABEL[lead.status] ?? lead.status.replace(/_/g, " ")}
                </Badge>
                <DeleteLeadButton
                  leadId={lead.id}
                  leadName={`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()}
                  leadStatus={lead.status}
                  dealValue={lead.deal_value as number | null}
                  refundAmount={lead.refund_amount as number | null}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
