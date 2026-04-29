import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Badge } from "@/components/ui/badge"
import { Users, Clock, Zap } from "lucide-react"
import { formatDistanceToNow } from "@/lib/utils"
import type { Lead } from "@/types/database"

const PIPELINE_COLUMNS: { status: Lead["status"]; label: string; color: string; dot: string }[] = [
  { status: "new",               label: "New",              color: "text-sky-400",     dot: "bg-sky-400" },
  { status: "contacted",         label: "Contacted",        color: "text-violet-400",  dot: "bg-violet-400" },
  { status: "qualified",         label: "Qualified",        color: "text-amber-400",   dot: "bg-amber-400" },
  { status: "followed_up",       label: "Followed Up",      color: "text-orange-400",  dot: "bg-orange-400" },
  { status: "appointment_booked", label: "Appointment",     color: "text-emerald-400", dot: "bg-emerald-400" },
]

const statusBadge: Record<string, string> = {
  new:                "bg-sky-500/15 text-sky-400 border-sky-500/20",
  contacted:          "bg-violet-500/15 text-violet-400 border-violet-500/20",
  qualified:          "bg-amber-500/15 text-amber-400 border-amber-500/20",
  followed_up:        "bg-orange-500/15 text-orange-400 border-orange-500/20",
  appointment_booked: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  closed_won:         "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  closed_lost:        "bg-red-500/15 text-red-400 border-red-500/20",
  cold:               "bg-slate-500/15 text-slate-400 border-slate-500/20",
  nurturing:          "bg-orange-500/15 text-orange-400 border-orange-500/20",
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

  const byStatus = (status: Lead["status"]) => allLeads.filter((l) => l.status === status)

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
        {PIPELINE_COLUMNS.map(({ status, label, color, dot }) => {
          const colLeads = byStatus(status)
          return (
            <div key={status} className="min-w-[220px] flex-shrink-0">
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
              <a
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
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
                    </div>
                    <p className="text-xs text-muted-foreground">{lead.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-muted-foreground hidden md:block capitalize">{lead.source}</span>
                  <span className="text-xs text-muted-foreground hidden md:block">{formatDistanceToNow(lead.created_at)}</span>
                  <Badge variant="outline" className={`text-xs ${statusBadge[lead.status] ?? ""}`}>
                    {lead.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
