"use client"

// The lead page, live. The server page loads the first paint; from then on this
// component keeps the lead, its measures and the thread current:
//   - realtime on this lead and its appointments (active once those tables are
//     in the realtime publication),
//   - a refetch 1.5s after any message arrives or changes (the assistant writes
//     status, address, job type and notes in the same turn as its reply),
//   - a 10 second poll while the tab is visible.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Phone, Mail, MapPin, Home, Calendar, Clock, User,
  ArrowLeft, Zap, Layers, DollarSign, Megaphone, FileText,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ConversationThread, type ThreadMessage } from "@/components/leads/ConversationThread"
import { CallLeadButton } from "@/components/leads/CallLeadButton"
import { DeleteLeadButton } from "@/components/leads/DeleteLeadButton"
import { EditLeadDetails } from "@/components/leads/EditLeadDetails"
import { LeadPropertyImage } from "@/components/leads/LeadPropertyImage"
import { LeadProjectDetails, leadAdSource } from "@/components/leads/LeadProjectDetails"
import { LeadStatusControl, LeadNextSteps } from "@/components/leads/LeadStatusControl"
import { useVisiblePoll } from "@/components/leads/live"
import { createClient } from "@/lib/supabase"
import { formatDistanceToNow, cn } from "@/lib/utils"
import { getJobTypeLabel, getJobTypeColor } from "@/lib/job-types"
import { hasRealPhone, isSignedStatus } from "@/lib/lead-status"

export type LeadRecord = {
  id: string
  company_id: string
  first_name: string | null
  last_name: string | null
  phone: string
  email: string | null
  address: string | null
  zip: string | null
  source: string | null
  status: string
  notes: string | null
  job_type: string | null
  metadata: Record<string, unknown> | null
  channel: string | null
  messenger_psid: string | null
  ai_paused: boolean
  ai_voice_paused: boolean
  is_active_conversation: boolean
  last_inbound_at: string | null
  deal_value: number | null
  refund_amount: number | null
  refund_note: string | null
  closed_job_type: string | null
  closed_at: string | null
  hcp_customer_id: string | null
  created_at: string
}

export type LeadAppointment = {
  id: string
  scheduled_at: string
  address: string | null
  status: string
  confirmation_status: string | null
}

type Props = {
  initialLead: LeadRecord
  initialAppointments: LeadAppointment[]
  initialMessages: ThreadMessage[]
  companyTimezone: string
  agentName: string
  voiceEnabled: boolean
  backHref: string
  backLabel: string
}

function measureState(apt: LeadAppointment): { label: string; tone: "done" | "off" | "on" } {
  if (apt.status === "cancelled") return { label: "Cancelled", tone: "off" }
  if (apt.status === "no_show") return { label: "No show", tone: "off" }
  if (apt.status === "completed" || apt.confirmation_status === "completed") return { label: "Done", tone: "done" }
  if (apt.confirmation_status === "confirmed") return { label: "Confirmed", tone: "on" }
  if (apt.confirmation_status === "reschedule_requested") return { label: "Wants to reschedule", tone: "on" }
  return { label: "Scheduled", tone: "on" }
}

const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook ad",
  messenger: "Messenger",
  website: "Website form",
  webhook: "Landing page",
  google: "Google",
  sms_inbound: "Texted in",
  voice_inbound: "Called in",
  manual: "Added by hand",
  // Leads that arrived over the retired WhatsApp channel are plain text leads now.
  whatsapp: "Text message",
}

export function LeadDetailClient({
  initialLead, initialAppointments, initialMessages,
  companyTimezone, agentName, voiceEnabled, backHref, backLabel,
}: Props) {
  const [lead, setLead] = useState<LeadRecord>(initialLead)
  const [appointments, setAppointments] = useState<LeadAppointment[]>(initialAppointments)
  // "Now" as of the last refresh: the "Replying now" badge reads this, not the clock.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const supabase = useMemo(() => createClient(), [])
  const leadId = initialLead.id
  // Bumped by every local write so a fetch that started earlier cannot put older data back.
  const writeVersion = useRef(0)
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const patchLead = useCallback((patch: Record<string, unknown>) => {
    writeVersion.current += 1
    setLead((prev) => ({ ...prev, ...(patch as Partial<LeadRecord>) }))
  }, [])

  const refresh = useCallback(async () => {
    const startedAt = writeVersion.current
    const [leadRes, aptRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
      supabase.from("appointments")
        .select("id, scheduled_at, address, status, confirmation_status")
        .eq("lead_id", leadId)
        .order("scheduled_at", { ascending: true }),
    ])
    setNowMs(Date.now())
    if (writeVersion.current !== startedAt) return
    if (leadRes.data) setLead(leadRes.data as LeadRecord)
    if (aptRes.data) setAppointments(aptRes.data as LeadAppointment[])
  }, [leadId, supabase])

  useVisiblePoll(refresh, 10_000)

  // The assistant saves status and details right after its reply: look again shortly after any message event.
  const onThreadActivity = useCallback(() => {
    if (activityTimer.current) clearTimeout(activityTimer.current)
    activityTimer.current = setTimeout(() => { void refresh() }, 1500)
  }, [refresh])

  useEffect(() => () => { if (activityTimer.current) clearTimeout(activityTimer.current) }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`lead-detail:${leadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `id=eq.${leadId}` }, () => { void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `lead_id=eq.${leadId}` }, () => { void refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [leadId, supabase, refresh])

  const fullName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
  const phoneOnFile = hasRealPhone(lead.phone)
  const meta = lead.metadata ?? {}
  const adSource = leadAdSource(meta)
  const signed = isSignedStatus(lead.status)
  const quoteAmount = Number(meta.quote_amount)
  const quoteSentAt = typeof meta.quote_sent_at === "string" ? meta.quote_sent_at : null
  const measureDoneAt = typeof meta.measure_done_at === "string" ? meta.measure_done_at : null
  const activeNow =
    lead.is_active_conversation && !!lead.last_inbound_at &&
    new Date(lead.last_inbound_at).getTime() > nowMs - 2 * 60 * 60 * 1000
  const sourceLabel = SOURCE_LABELS[lead.source ?? ""] ?? (lead.source ? lead.source.replace(/_/g, " ") : "Unknown source")
  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: companyTimezone })

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border flex items-start justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3 min-h-7">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium">{fullName || "Lead"}</span>
        </div>
        <div className="flex items-start gap-2 flex-wrap justify-end">
          {activeNow && (
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 h-7">
              <Zap className="w-2.5 h-2.5" />
              Replying now
            </Badge>
          )}
          <LeadStatusControl lead={lead} onLeadChange={patchLead} />
          <DeleteLeadButton
            leadId={leadId}
            leadName={fullName}
            leadStatus={lead.status}
            dealValue={lead.deal_value}
            refundAmount={lead.refund_amount}
            redirectAfter={true}
            onChanged={patchLead}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left panel: lead info (full width on mobile, sidebar on desktop) */}
        <div className="md:w-72 md:shrink-0 border-b md:border-b-0 md:border-r border-border overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-6 max-h-[40vh] md:max-h-none">
          {/* Avatar + name */}
          <div className="flex flex-col items-center text-center gap-2 pt-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {lead.first_name?.[0] ?? "?"}{lead.last_name?.[0] ?? ""}
            </div>
            <div>
              <h2 className="font-semibold text-base">
                {fullName || <span className="text-muted-foreground italic font-normal">No name yet</span>}
              </h2>
              <p className="text-xs text-muted-foreground">
                {sourceLabel} · {formatDistanceToNow(lead.created_at)}
              </p>
              {adSource && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-start justify-center gap-1 text-left">
                  <Megaphone className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{[adSource.campaign, adSource.ad, adSource.form].filter(Boolean).join(" · ")}</span>
                </p>
              )}
              <div className="mt-1.5">
                <EditLeadDetails
                  leadId={leadId}
                  firstName={lead.first_name}
                  lastName={lead.last_name}
                  email={lead.email}
                  phone={lead.phone}
                  address={lead.address}
                  zip={lead.zip}
                  jobType={lead.job_type}
                  notes={lead.notes}
                  syncedToHcp={!!lead.hcp_customer_id}
                  onSaved={patchLead}
                />
              </div>
              {lead.messenger_psid && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: "#0084FF", background: "rgba(0,132,255,0.10)", border: "1px solid rgba(0,132,255,0.25)" }}>
                  Messenger lead
                </span>
              )}
            </div>
          </div>

          {/* Move the lead along */}
          <LeadNextSteps lead={lead} onLeadChange={patchLead} />

          {/* Quote on file */}
          {(lead.status === "quote_sent" || lead.status === "measure_done") && (quoteSentAt || measureDoneAt) && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-teal-700 text-xs font-medium">
                <FileText className="w-3.5 h-3.5" />
                {lead.status === "quote_sent" ? "Quote sent" : "Measure done, quote owed"}
              </div>
              {lead.status === "quote_sent" && Number.isFinite(quoteAmount) && quoteAmount > 0 && (
                <p className="text-sm font-bold font-mono text-teal-800">${quoteAmount.toLocaleString()}</p>
              )}
              <p className="text-[11px] text-teal-700/80">
                {lead.status === "quote_sent" && quoteSentAt
                  ? `Sent ${shortDate(quoteSentAt)}`
                  : measureDoneAt ? `Measured ${shortDate(measureDoneAt)}` : ""}
              </p>
            </div>
          )}

          {/* Call button: only for companies with the voice agent on */}
          {voiceEnabled && (
            <div className="w-full">
              <CallLeadButton
                leadId={leadId}
                disabled={lead.ai_voice_paused || !phoneOnFile || ["closed_won", "closed_lost", "lost"].includes(lead.status)}
              />
            </div>
          )}

          {/* Contact info */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {phoneOnFile ? (
                  <span className="font-mono text-xs">{lead.phone}</span>
                ) : (
                  <span className="text-xs italic text-muted-foreground">
                    {lead.messenger_psid ? "No phone on file. The assistant asks for it on Messenger." : "No phone on file"}
                  </span>
                )}
              </div>
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate">{lead.email}</span>
                </div>
              )}
              {lead.zip && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs">ZIP {lead.zip}</span>
                </div>
              )}
              {lead.address && (
                <div className="flex items-start gap-2 text-sm">
                  <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs">{lead.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Property image: fetched when an address is known. Keyed so a corrected address reloads it. */}
          <LeadPropertyImage key={lead.address ?? lead.zip ?? "none"} address={lead.address ?? lead.zip ?? null} />

          {/* Job type, as classified by the assistant or set by the team */}
          {lead.job_type && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job type</p>
              <Badge
                variant="outline"
                className={`text-xs w-full justify-center py-1 ${getJobTypeColor(lead.job_type)}`}
              >
                <Layers className="w-3 h-3" />
                {getJobTypeLabel(lead.job_type)}
              </Badge>
            </div>
          )}

          {/* What the lead told us: qualification answers and form answers */}
          <LeadProjectDetails metadata={meta} />

          {/* Lead details */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{sourceLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Created {formatDistanceToNow(lead.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Signed deal summary */}
          {signed && lead.deal_value ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signed deal</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                  <span className="text-base font-bold text-[#16A34A] font-mono">
                    ${Number(lead.deal_value).toLocaleString()}
                  </span>
                </div>
                {lead.closed_job_type && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Layers className="w-3 h-3 shrink-0" />
                    {lead.closed_job_type}
                  </p>
                )}
                {lead.closed_at && (
                  <p className="text-xs text-muted-foreground">Signed {formatDistanceToNow(lead.closed_at)}</p>
                )}
                {lead.refund_amount ? (
                  <p className="text-xs text-amber-700">
                    Refund: ${Number(lead.refund_amount).toLocaleString()}
                    {lead.refund_note ? ` · ${lead.refund_note}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Notes: line breaks kept as written */}
          {lead.notes && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed whitespace-pre-wrap break-words">
                {lead.notes}
              </p>
            </div>
          )}

          {/* Measures */}
          {appointments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Measures</p>
              <div className="space-y-2">
                {appointments.map((apt) => {
                  const state = measureState(apt)
                  return (
                    <Link
                      key={apt.id}
                      href="/appointments"
                      className={cn(
                        "block transition-colors rounded-lg p-3 space-y-1 border",
                        state.tone === "off"
                          ? "bg-muted/40 border-border hover:border-foreground/20"
                          : "bg-emerald-50 border-emerald-200 hover:border-emerald-400"
                      )}
                    >
                      <div className={cn(
                        "flex items-center gap-1.5 text-xs font-medium",
                        state.tone === "off" ? "text-muted-foreground line-through" : "text-emerald-700"
                      )}>
                        <Calendar className="w-3 h-3" />
                        {new Date(apt.scheduled_at).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric",
                          timeZone: companyTimezone,
                        })}
                        {" · "}
                        {new Date(apt.scheduled_at).toLocaleTimeString("en-US", {
                          hour: "numeric", minute: "2-digit",
                          timeZone: companyTimezone,
                        })}
                      </div>
                      {apt.address && <p className="text-xs text-muted-foreground">{apt.address}</p>}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          state.tone === "off"
                            ? "bg-slate-50 text-slate-500 border-slate-200"
                            : state.tone === "done"
                              ? "bg-teal-50 text-teal-700 border-teal-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}
                      >
                        {state.label}
                      </Badge>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: conversation */}
        <ConversationThread
          leadId={leadId}
          initialMessages={initialMessages}
          aiPaused={lead.ai_paused}
          aiVoicePaused={lead.ai_voice_paused}
          onPauseChange={patchLead}
          onActivity={onThreadActivity}
          leadPhone={lead.phone}
          leadChannel={lead.channel}
          companyTimezone={companyTimezone}
          agentName={agentName}
          voiceEnabled={voiceEnabled}
        />
      </div>
    </div>
  )
}
