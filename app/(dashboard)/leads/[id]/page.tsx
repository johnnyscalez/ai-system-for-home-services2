import { redirect, notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Badge } from "@/components/ui/badge"
import { ConversationThread } from "@/components/leads/ConversationThread"
import {
  Phone, Mail, MapPin, Calendar, Clock, User,
  ArrowLeft, Zap, Wrench, Thermometer
} from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "@/lib/utils"
import { CallLeadButton } from "@/components/leads/CallLeadButton"
import { DeleteLeadButton } from "@/components/leads/DeleteLeadButton"
import { getJobTypeLabel, getJobTypeColor } from "@/lib/job-types"

const STATUS_STYLES: Record<string, string> = {
  new: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  contacted: "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
  qualified: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  followed_up: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  appointment_booked: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  closed_won: "bg-emerald-600/15 text-emerald-300 border-emerald-600/20",
  closed_lost: "bg-red-500/15 text-red-400 border-red-500/20",
  cold: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  nurturing: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  needs_attention: "bg-red-500/15 text-red-400 border-red-500/20",
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .single()

  if (!lead) notFound()

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("lead_id", id)
    .eq("channel", "sms")
    .order("created_at", { ascending: true })

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("lead_id", id)
    .order("scheduled_at", { ascending: true })

  const { data: phoneRecord } = await supabase
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", profile.company_id)
    .eq("is_active", true)
    .single()

  const { data: agentCfg } = await supabase
    .from("ai_agent_config")
    .select("timezone")
    .eq("company_id", profile.company_id)
    .single()

  const companyTimezone = agentCfg?.timezone ?? "America/New_York"

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Leads
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium">
            {lead.first_name} {lead.last_name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs capitalize ${STATUS_STYLES[lead.status] ?? ""}`}
          >
            {lead.status.replace(/_/g, " ")}
          </Badge>
          {lead.is_active_conversation && lead.last_inbound_at &&
            new Date(lead.last_inbound_at) > new Date(Date.now() - 2 * 60 * 60 * 1000) && (
            <Badge variant="outline" className="text-xs bg-emerald-500/15 text-emerald-500 border-emerald-500/20 gap-1">
              <Zap className="w-2.5 h-2.5" />
              Active conversation
            </Badge>
          )}
          <DeleteLeadButton
            leadId={id}
            leadName={`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()}
            leadStatus={lead.status}
            dealValue={lead.deal_value as number | null}
            refundAmount={lead.refund_amount as number | null}
            redirectAfter={true}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left panel — lead info (full width on mobile, 288px sidebar on desktop) */}
        <div className="md:w-72 md:shrink-0 border-b md:border-b-0 md:border-r border-border overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-6 max-h-[40vh] md:max-h-none">
          {/* Avatar + name */}
          <div className="flex flex-col items-center text-center gap-2 pt-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {lead.first_name?.[0] ?? "?"}{lead.last_name?.[0] ?? ""}
            </div>
            <div>
              <h2 className="font-semibold text-base">
                {lead.first_name} {lead.last_name}
              </h2>
              <p className="text-xs text-muted-foreground capitalize">
                {lead.source} lead · {formatDistanceToNow(lead.created_at)} ago
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="w-full">
            <CallLeadButton
              leadId={id}
              disabled={lead.ai_paused || ["closed_won", "closed_lost"].includes(lead.status)}
            />
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs">{lead.phone}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate">{lead.email}</span>
                </div>
              )}
              {lead.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs">{lead.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Job type — AI-classified, shown prominently when known */}
          {lead.job_type && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job Type</p>
              <Badge
                variant="outline"
                className={`text-xs w-full justify-center py-1 ${getJobTypeColor(lead.job_type as string)}`}
              >
                {getJobTypeLabel(lead.job_type as string)}
              </Badge>
              <div className="space-y-1 text-xs text-muted-foreground">
                {lead.system_type && (
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-3 h-3 shrink-0" />
                    <span>{lead.system_type as string}</span>
                  </div>
                )}
                {lead.system_age && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>Age: {lead.system_age as string}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lead details */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</p>
            <div className="space-y-2 text-xs">
              {lead.service_type && (
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="capitalize">{(lead.service_type as string).replace(/_/g, " ")}</span>
                </div>
              )}
              {!lead.job_type && lead.system_type && (
                <div className="flex items-center gap-2">
                  <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{lead.system_type as string}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="capitalize">{lead.source as string} source</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Created {formatDistanceToNow(lead.created_at as string)} ago</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">
                {lead.notes}
              </p>
            </div>
          )}

          {/* Appointments */}
          {appointments && appointments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appointments</p>
              <div className="space-y-2">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-3 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                      <Calendar className="w-3 h-3" />
                      {new Date(apt.scheduled_at).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                        timeZone: companyTimezone,
                      })}
                    </div>
                    <p className="text-xs text-emerald-400/70">
                      {new Date(apt.scheduled_at).toLocaleTimeString("en-US", {
                        hour: "numeric", minute: "2-digit",
                        timeZone: companyTimezone,
                      })}
                    </p>
                    {apt.address && (
                      <p className="text-xs text-muted-foreground">{apt.address}</p>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    >
                      {apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — conversation */}
        <ConversationThread
          leadId={id}
          companyId={profile.company_id}
          initialMessages={conversations ?? []}
          aiPaused={lead.ai_paused}
          leadStatus={lead.status}
          fromNumber={phoneRecord?.phone_number ?? null}
          leadPhone={lead.phone}
          companyTimezone={companyTimezone}
        />
      </div>
    </div>
  )
}
