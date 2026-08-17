import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { ConversationsList, type ConversationRow } from "@/components/leads/ConversationsList"

export default async function ConversationsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  // No last_message_at filter: leads created by failure paths (undeliverable
  // phone, needs_attention placeholders) have conversations but a NULL
  // last_message_at — the old filter made them invisible on every surface in
  // HCP mode (adversarial finding 9: a real paid lead had no page showing him)
  const { data: leads } = await supabase
    .from("leads")
    .select("id, first_name, last_name, phone, status, ai_paused, last_message_at, created_at, conversations!inner(id, channel)")
    .eq("company_id", profile.company_id)
    .order("last_message_at", { ascending: false, nullsFirst: false })

  // Show EVERY channel the AI works — SMS, Facebook Messenger, WhatsApp, voice —
  // not just SMS. (The old filter dropped everything but SMS, so a
  // Messenger-only account looked empty.)
  const rows: ConversationRow[] = (leads ?? []).map((l) => {
    const convos = ((l.conversations as { id: string; channel: string | null }[]) ?? [])
    const channels = Array.from(new Set(convos.map((c) => c.channel ?? "sms")))
    return {
      id: l.id as string,
      first_name: l.first_name as string | null,
      last_name: l.last_name as string | null,
      phone: l.phone as string,
      status: l.status as string,
      ai_paused: l.ai_paused as boolean | null,
      last_message_at: l.last_message_at as string | null,
      messageCount: convos.length,
      channels,
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Every thread your AI is managing — SMS, Messenger, WhatsApp, and calls</p>
      </div>

      <ConversationsList rows={rows} />
    </div>
  )
}
