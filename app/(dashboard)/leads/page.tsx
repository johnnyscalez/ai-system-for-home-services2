import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Badge } from "@/components/ui/badge"
import { Users, Clock, Zap, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "@/lib/utils"
import type { Lead } from "@/types/database"
import { DeleteLeadButton } from "@/components/leads/DeleteLeadButton"
import { PipelineBoard } from "@/components/leads/PipelineBoard"

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

const statusBadge: Record<string, string> = {
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

export default async function LeadsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const [{ data: leads }, { data: technicians }] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("technicians")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .order("name"),
  ])

  const allLeads = (leads ?? []) as Lead[]
  const allTechs = (technicians ?? []) as { id: string; name: string }[]

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const isActive = (lead: Lead) =>
    lead.is_active_conversation && !!lead.last_inbound_at && lead.last_inbound_at > twoHoursAgo

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{allLeads.length} total leads</p>
        </div>
      </div>

      {/* Drag-and-drop pipeline board */}
      <PipelineBoard initialLeads={allLeads} technicians={allTechs} />

      {/* All leads table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">All Leads</span>
          <span className="text-xs text-muted-foreground ml-auto">{allLeads.length} total</span>
        </div>
        <div className="divide-y divide-border">
          {allLeads.length === 0 ? (
            <div className="px-5 py-12 text-center text-muted-foreground text-sm">
              No leads yet. They will appear here as soon as your first lead comes in.
            </div>
          ) : (
            allLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <a href={`/leads/${lead.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                    {lead.first_name?.[0] ?? "?"}{lead.last_name?.[0] ?? ""}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
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
                  </div>
                </a>
                <div className="flex items-center gap-4 shrink-0">
                  {lead.deal_value && (
                    <span className="text-xs font-semibold text-green-700 hidden md:block">
                      ${lead.deal_value.toLocaleString()}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground hidden md:block capitalize">{lead.source}</span>
                  <span className="text-xs text-muted-foreground hidden md:block">{formatDistanceToNow(lead.created_at)}</span>
                  <Badge variant="outline" className={`text-xs ${statusBadge[lead.status] ?? ""}`}>
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
    </div>
  )
}
