import { createServiceRoleClient } from "@/lib/supabase-server"

export type VoiceMessage = { role: "user" | "assistant"; content: string | object[] }

export type VoiceSession = {
  id: string
  company_id: string
  lead_id: string
  call_sid: string
  direction: string
  stage: string
  collected: Record<string, string>
  messages: VoiceMessage[]
  status: string
}

export async function getOrCreateSession(
  callSid: string,
  leadId: string,
  companyId: string,
  direction: "inbound" | "outbound" = "inbound",
  initialCollected: Record<string, string> = {}
): Promise<VoiceSession> {
  const db = createServiceRoleClient()

  const { data: existing } = await db
    .from("voice_sessions")
    .select("*")
    .eq("call_sid", callSid)
    .maybeSingle()

  if (existing) return existing as VoiceSession

  const { data } = await db
    .from("voice_sessions")
    .insert({
      company_id: companyId,
      lead_id:    leadId,
      call_sid:   callSid,
      direction,
      collected:  initialCollected,
    })
    .select()
    .single()

  return data as VoiceSession
}

export async function getSession(callSid: string): Promise<VoiceSession | null> {
  const db = createServiceRoleClient()
  const { data } = await db
    .from("voice_sessions")
    .select("*")
    .eq("call_sid", callSid)
    .maybeSingle()
  return (data as VoiceSession) ?? null
}

export async function updateSession(
  callSid: string,
  updates: Partial<Pick<VoiceSession, "stage" | "collected" | "messages" | "status">>
): Promise<void> {
  const db = createServiceRoleClient()
  await db
    .from("voice_sessions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("call_sid", callSid)
}

export async function appendMessages(
  session: VoiceSession,
  newMessages: VoiceMessage[]
): Promise<VoiceMessage[]> {
  const updated = [...session.messages, ...newMessages]
  await updateSession(session.call_sid, { messages: updated })
  return updated
}

export async function saveCallTurn(
  session: VoiceSession,
  leadSaid: string,
  agentSaid: string
): Promise<void> {
  const db = createServiceRoleClient()
  const now = new Date().toISOString()
  await db.from("conversations").insert([
    {
      company_id: session.company_id,
      lead_id: session.lead_id,
      direction: "inbound",
      body: leadSaid,
      sent_by: "human",
      channel: "voice",
      created_at: now,
    },
    {
      company_id: session.company_id,
      lead_id: session.lead_id,
      direction: "outbound",
      body: agentSaid,
      sent_by: "ai",
      channel: "voice",
      created_at: now,
    },
  ])
}
