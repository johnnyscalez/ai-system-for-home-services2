import { redirect, notFound } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { TechAppointmentDetail } from "@/components/tech/TechAppointmentDetail"

export const dynamic = "force-dynamic"

export default async function TechAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/tech/login")
  if (user.app_metadata?.role !== "technician") redirect("/dashboard")

  const db = createServiceRoleClient()

  const { data: tech } = await db
    .from("technicians")
    .select("id, name, company_id")
    .eq("auth_user_id", user.id)
    .single()

  if (!tech) redirect("/tech/login")

  const { data: apt } = await db
    .from("appointments")
    .select("*")
    .eq("id", id)
    .eq("technician_id", tech.id)
    .single()

  if (!apt) notFound()

  const { data: lead } = await db
    .from("leads")
    .select("*")
    .eq("id", apt.lead_id)
    .single()

  if (!lead) notFound()

  const { data: conversations } = await db
    .from("conversations")
    .select("*")
    .eq("lead_id", lead.id)
    .eq("channel", "sms")
    .order("created_at", { ascending: true })

  const { data: agentCfg } = await db
    .from("ai_agent_config")
    .select("timezone")
    .eq("company_id", tech.company_id)
    .single()

  const timezone = agentCfg?.timezone ?? "America/New_York"

  return (
    <TechAppointmentDetail
      appointment={apt}
      lead={lead}
      conversations={conversations ?? []}
      techName={tech.name}
      timezone={timezone}
    />
  )
}
