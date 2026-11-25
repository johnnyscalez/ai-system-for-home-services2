"use client"

// The Leads page body. Owns the live lead list (realtime + 20s poll, see
// components/leads/live.ts) and hands it to the board and the table, so a new
// lead, a status the assistant just changed, an added or a deleted lead all
// show without a reload.

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { PipelineBoard } from "@/components/leads/PipelineBoard"
import { LeadsTable } from "@/components/leads/LeadsTable"
import { AddLeadButton } from "@/components/leads/AddLeadButton"
import { useCompanyLeads } from "@/components/leads/live"
import type { Lead } from "@/types/database"

export function LeadsWorkspace({
  companyId,
  initialLeads,
  initialStatus,
}: {
  companyId: string
  initialLeads: Lead[]
  /** ?status= from the URL, applied to the table filter */
  initialStatus: string | null
}) {
  const { leads, setLeads, nowMs } = useCompanyLeads(companyId, initialLeads)
  const needsAttention = leads.filter((l) => (l.status as string) === "needs_attention").length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
          </p>
        </div>
        <AddLeadButton onAdded={(lead) => setLeads((prev) => [lead as unknown as Lead, ...prev])} />
      </div>

      {needsAttention > 0 && (
        <Link
          href="/leads?status=needs_attention"
          className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {needsAttention} need{needsAttention === 1 ? "s" : ""} a person
        </Link>
      )}

      {/* Pipeline board: columns cap at 300px height and scroll internally */}
      <PipelineBoard leads={leads} onLeadsChange={setLeads} nowMs={nowMs} />

      {/* All leads: searchable, filterable list. Keyed so ?status= changes re-apply the filter. */}
      <LeadsTable
        key={initialStatus ?? "all"}
        leads={leads}
        nowMs={nowMs}
        initialStatus={initialStatus}
        onDeleted={(id) => setLeads((prev) => prev.filter((l) => l.id !== id))}
        onChanged={(id, saved) => setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...(saved as Partial<Lead>) } : l)))}
      />
    </div>
  )
}
