import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { ConversationsList } from "@/components/leads/ConversationsList"
import { CONVERSATION_LIST_SELECT, toConversationRows } from "@/components/leads/conversation-rows"

export default async function ConversationsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  // No last_message_at filter: leads created by failure paths (undeliverable
  // phone, needs_attention placeholders) have conversations but a NULL
  // last_message_at, and the old filter made them invisible on every surface.
  // First paint only: ConversationsList refetches the same query as messages arrive.
  const { data: leads } = await supabase
    .from("leads")
    .select(CONVERSATION_LIST_SELECT)
    .eq("company_id", profile.company_id)
    .order("last_message_at", { ascending: false, nullsFirst: false })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Every thread with your leads, by text and Messenger. Updates as messages arrive.</p>
      </div>

      <ConversationsList companyId={profile.company_id} initialRows={toConversationRows(leads)} />
    </div>
  )
}
