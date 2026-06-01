import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Badge } from "@/components/ui/badge"
import { Users, Clock, Zap, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "@/lib/utils"
import type { Lead } from "@/types/database"
import { DeleteLeadButton } from "@/components/leads/DeleteLeadButton"

// Pipeline columns — DB statuses that map to each column
const PIPELINE_COLUMNS = [
  { key: "just_came_in",      statuses: ["just_came_in", "new", "contacted"],                          label: "Just came in",           color: "text-sky-400",     dot: "bg-sky-400" },
  { key: "following_up",      statuses: ["following_up"],                                               label: "No Reply – Following Up", color: "text-orange-400",  dot: "bg-orange-400" },
  { key: "active_conversation", statuses: ["active_conversation", "followed_up", "nurturing"],         label: "Active conversation",     color: "text-[#F97316]",  dot: "bg-[#F97316]" },
  { key: "qualified",         statuses: ["qualified"],                                                  label: "Qualified",               color: "text-amber-400",   dot: "bg-amber-400" },
  { key: "unqualified",       statuses: ["unqualified"],                                                label: "Unqualified",             color: "text-red-400",     dot: "bg-red-400" },
  { key: "appointment_booked", statuses: ["appointment_booked"],                                        label: "Appointment",             color: "text-emerald-400", dot: "bg-emerald-400" },
  { key: "closed",            statuses: ["closed", "closed_won"],                                       label: "Closed",                  color: "text-green-400",   dot: "bg-green-400" },
  { key: "lost",              statuses: ["lost", "cold", "closed_lost"],                                label: "Lost",                    color: "text-slate-400",   dot: "bg-slate-400" },
]

// User-facing label for each DB status (table view)
const STATUS_LABEL: Record<string, string> = {
  just_came_in:       "Just came in",
  new:                "Just came in",
  contacted:          "Just came in",
  following_up:       "No reply",
  active_conversation: "Active",
  followed_up:        "Active",
  nurturing:          "Active",
  qualified:          "Qualified",
  unqualified:        "Unqualified",
  appointment_booked: "Booked",
  closed:             "Closed",
  closed_won:         "Closed",
  lost:               "Lost",
  cold:               "Lost",
  closed_lost:        "Lost",
  needs_attention:    "Needs attention",
}

const statusBadge: Record<string, string> = {
  just_came_in:       "bg-sky-500/15 text-sky-400 border-sky-500/20",
  new:                "bg-sky-500/15 text-sky-400 border-sky-500/20",
  contacted:          "bg-sky-500/15 text-sky-400 border-sky-500/20",
  following_up:       "bg-orange-500/15 text-orange-400 border-orange-500/20",
  active_conversation: "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  followed_up:        "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  nurturing:          "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  qualified:          "bg-amber-500/15 text-amber-400 border-amber-500/20",
  unqualified:        "bg-red-500/15 text-red-400 border-red-500/20",
  appointment_booked: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  closed:             "bg-green-500/15 text-green-400 border-green-500/20",
  closed_won:         "bg-green-500/15 text-green-400 border-green-500/20",
  lost:               "bg-slate-500/15 text-slate-400 border-slate-500/20",
  cold:               "bg-slate-500/15 text-slate-400 border-slate-500/20",
  closed_lost:        "bg-slate-500/15 text-slate-400 border-slate-500/20",
  needs_attention:    "bg-red-500/15 text-red-400 border-red-500/20",
}

export default async function LeadsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })

  const allLeads = (leads ?? []) as Lead[]

  const byStatuses = (statuses: string[]) => allLeads.filter((l) => statuses.includes(l.status))

  // Active conversation = last_inbound_at within 2 hours
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

      {/* Pipeline board */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {PIPELINE_COLUMNS.map(({ key, statuses, label, color, dot }) => {
          const colLeads = byStatuses(statuses)
          return (
            <div key={key} className="min-w-[220px] flex-shrink-0">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${dot}`} />
                <span className={`text-sm font-semibold ${color}`}>{label}</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 ml-auto">
                  {colLeads.length}
                </span>
              </div>

              {/* Column cards */}
              <div className="space-y-2">
                {colLeads.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-4 text-center text-xs text-muted-foreground">
                    No leads
                  </div>
                ) : (
                  colLeads.map((lead) => (
                    <a
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="block bg-white border border-border rounded-xl p-3 hover:border-primary/40 hover:shadow-sm transition-all"
                      style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
                    >
                      {/* Name row */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                          {lead.first_name?.[0] ?? "?"}
                        </div>
                        <p className="text-sm font-medium truncate flex-1">
                          {lead.first_name} {lead.last_name}
                        </p>
                      </div>

                      {/* Active conversation badge */}
                      {isActive(lead) && (
                        <div className="flex items-center gap-1 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                            <Zap className="w-2.5 h-2.5" />
                            Active
                          </span>
                        </div>
                      )}

                      {/* Following up badge */}
                      {lead.status === "following_up" && (
                        <div className="flex items-center gap-1 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20">
                            <MessageSquare className="w-2.5 h-2.5" />
                            Following up
                          </span>
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground capitalize">{lead.source}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDistanceToNow(lead.created_at)}
                        </span>
                      </div>
                      {lead.last_message_at && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Last msg {formatDistanceToNow(lead.last_message_at)}
                        </p>
                      )}
                    </a>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

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
              <div
                key={lead.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <a
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                    {lead.first_name?.[0] ?? "?"}{lead.last_name?.[0] ?? ""}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
                      {isActive(lead) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                          <Zap className="w-2 h-2" />
                          Active
                        </span>
                      )}
                      {lead.status === "following_up" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20">
                          <MessageSquare className="w-2 h-2" />
                          Following up
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{lead.phone}</p>
                  </div>
                </a>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-muted-foreground hidden md:block capitalize">{lead.source}</span>
                  <span className="text-xs text-muted-foreground hidden md:block">{formatDistanceToNow(lead.created_at)}</span>
                  <Badge variant="outline" className={`text-xs ${statusBadge[lead.status] ?? ""}`}>
                    {STATUS_LABEL[lead.status] ?? lead.status.replace(/_/g, " ")}
                  </Badge>
                  <DeleteLeadButton
                    leadId={lead.id}
                    leadName={`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()}
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
