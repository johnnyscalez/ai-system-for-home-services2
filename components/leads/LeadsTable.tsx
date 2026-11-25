"use client"

import { useState, useMemo } from "react"
import { Users, Search, Zap, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DeleteLeadButton } from "@/components/leads/DeleteLeadButton"
import { formatDistanceToNow } from "@/lib/utils"
import { LEAD_STATUS, leadStatusLabel, leadStatusBadge, hasRealPhone } from "@/lib/lead-status"
import type { Lead } from "@/types/database"

// Filter options come from the shared status map so the labels cannot drift.
const STATUS_FILTER_LABELS = Array.from(new Set(Object.values(LEAD_STATUS).map((m) => m.label)))

export function LeadsTable({
  leads,
  nowMs,
  initialStatus = null,
  onDeleted,
  onChanged,
}: {
  /** The live lead list, owned by the page */
  leads: Lead[]
  /** The clock as of the last refresh, for the "Replying now" marker */
  nowMs: number
  /** Raw status from the URL (?status=needs_attention); mapped to its shared label. */
  initialStatus?: string | null
  onDeleted?: (leadId: string) => void
  /** Called with the saved fields after a refund is recorded on a signed lead */
  onChanged?: (leadId: string, lead: Record<string, unknown>) => void
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus ? leadStatusLabel(initialStatus) : "all")

  const twoHoursAgo = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString()
  const isActive = (lead: Lead) =>
    lead.is_active_conversation && !!lead.last_inbound_at && lead.last_inbound_at > twoHoursAgo

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byStatus = statusFilter === "all"
      ? leads
      : leads.filter(l => leadStatusLabel(l.status) === statusFilter)
    if (!q) return byStatus
    return byStatus.filter(lead => {
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
  }, [leads, query, statusFilter])

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

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
        >
          <option value="all">All statuses</option>
          {STATUS_FILTER_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {filtered.length}{query || statusFilter !== "all" ? ` of ${leads.length}` : " total"}
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">
            {query ? `No leads match "${query}"` : statusFilter !== "all" ? `No leads marked "${statusFilter}".` : "No leads yet. They will appear here as soon as your first lead comes in."}
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
                      {`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "No name yet"}
                    </p>
                    {isActive(lead) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Zap className="w-2 h-2" /> Replying now
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hasRealPhone(lead.phone) ? lead.phone : (lead.email ?? "No phone on file")}
                  </p>
                  {lead.address && (
                    <p className="text-xs text-muted-foreground/70 truncate max-w-[220px]">{lead.address}</p>
                  )}
                </div>
              </a>

              <div className="flex items-center gap-4 shrink-0">
                {lead.deal_value && (
                  <span className="text-xs font-semibold text-[#16A34A] font-mono hidden md:block">
                    ${lead.deal_value.toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground hidden md:block capitalize">{(lead.source as string) === "whatsapp" ? "text" : lead.source}</span>
                <span className="text-xs text-muted-foreground hidden md:block">
                  {formatDistanceToNow(lead.created_at)}
                </span>
                <Badge variant="outline" className={`text-xs ${leadStatusBadge(lead.status)}`}>
                  {leadStatusLabel(lead.status)}
                </Badge>
                <DeleteLeadButton
                  leadId={lead.id}
                  leadName={`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()}
                  leadStatus={lead.status}
                  dealValue={lead.deal_value as number | null}
                  refundAmount={lead.refund_amount as number | null}
                  onDeleted={onDeleted}
                  onChanged={onChanged ? (saved) => onChanged(lead.id, saved) : undefined}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
