import { redirect, notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { voiceEnabled } from "@/lib/voice-enabled"
import {
  LeadDetailClient, type LeadRecord, type LeadAppointment,
} from "@/components/leads/LeadDetailClient"
import type { ThreadMessage } from "@/components/leads/ConversationThread"

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  // Where the visitor came FROM decides where "back" goes. Opening a thread
  // from the Conversations section and landing on /leads afterwards read as
  // being thrown out of the section entirely.
  const { from } = await searchParams
  const backHref = from === "conversations" ? "/conversations" : from === "dashboard" ? "/dashboard" : "/leads"
  const backLabel = from === "conversations" ? "Conversations" : from === "dashboard" ? "Dashboard" : "Leads"
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

  // First paint only. LeadDetailClient keeps all of this current afterwards.
  const [{ data: conversations }, { data: appointments }, { data: agentCfg }, voiceOn] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, direction, sent_by, body, created_at, twilio_sid, channel, delivery_status, delivery_error_code")
      .eq("lead_id", id)
      // Text thread = sms + messenger. Voice transcripts are not shown here.
      .or("channel.is.null,channel.neq.voice")
      .order("created_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, scheduled_at, address, status, confirmation_status")
      .eq("lead_id", id)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("ai_agent_config")
      .select("timezone, agent_name")
      .eq("company_id", profile.company_id)
      .maybeSingle(),
    voiceEnabled(profile.company_id),
  ])

  return (
    <LeadDetailClient
      initialLead={lead as LeadRecord}
      initialAppointments={(appointments ?? []) as LeadAppointment[]}
      initialMessages={(conversations ?? []) as ThreadMessage[]}
      companyTimezone={(agentCfg?.timezone as string | null) ?? "America/New_York"}
      agentName={(agentCfg?.agent_name as string | null)?.trim() || "Assistant"}
      voiceEnabled={voiceOn}
      backHref={backHref}
      backLabel={backLabel}
    />
  )
}
