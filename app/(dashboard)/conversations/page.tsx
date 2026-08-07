import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { MessageSquare, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "@/lib/utils"

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
  const rows = (leads ?? []).map((l) => {
    const convos = ((l.conversations as { id: string; channel: string | null }[]) ?? [])
    const channels = Array.from(new Set(convos.map((c) => c.channel ?? "sms")))
    return { ...l, conversations: convos, channels }
  }) as {
    id: string; first_name: string | null; last_name: string | null;
    phone: string; status: string; ai_paused: boolean | null; last_message_at: string | null;
    conversations: { id: string; channel: string | null }[];
    channels: string[];
  }[]

  const channelLabel: Record<string, string> = {
    sms: "SMS", messenger: "Messenger", whatsapp: "WhatsApp", voice: "Call",
  }

  const statusBadge: Record<string, string> = {
    new: "bg-sky-500/15 text-sky-400 border-sky-500/20",
    contacted: "bg-[#FFF3EC] text-[#F97316] border-[#F97316]/20",
    qualified: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    appointment_booked: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    needs_attention: "bg-red-500/15 text-red-400 border-red-500/20",
    cold: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Every thread your AI is managing — SMS, Messenger, WhatsApp, and calls</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {rows.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Conversations will appear here once your AI starts texting leads.
              </p>
            </div>
          ) : (
            rows.map((lead) => (
              <a
                key={lead.id}
                href={`/leads/${lead.id}?from=conversations`}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                    {(lead.first_name?.[0] ?? "").toUpperCase() || (lead.channels.includes("messenger") ? "M" : "?")}{lead.last_name?.[0]?.toUpperCase() ?? ""}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                        || (lead.channels.includes("messenger") ? "Messenger lead" : "Lead")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.phone?.startsWith("msgr:")
                        ? lead.channels.map((c) => channelLabel[c] ?? c).join(" · ")
                        : lead.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {!lead.phone?.startsWith("msgr:") && lead.channels.length > 0 && (
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      {lead.channels.map((c) => channelLabel[c] ?? c).join(" · ")}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {lead.conversations.length} messages
                  </span>
                  <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lead.last_message_at ? formatDistanceToNow(lead.last_message_at) : "—"}
                  </span>
                  {lead.ai_paused && (
                    <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-600 border-amber-500/30">
                      human handling
                    </Badge>
                  )}
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
