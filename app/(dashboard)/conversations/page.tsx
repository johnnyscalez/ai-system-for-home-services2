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

  const { data: leads } = await supabase
    .from("leads")
    .select("id, first_name, last_name, phone, status, last_message_at, conversations(id)")
    .eq("company_id", profile.company_id)
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false })

  const rows = (leads ?? []) as {
    id: string; first_name: string | null; last_name: string | null;
    phone: string; status: string; last_message_at: string | null;
    conversations: { id: string }[];
  }[]

  const statusBadge: Record<string, string> = {
    new: "bg-sky-500/15 text-sky-400 border-sky-500/20",
    contacted: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    qualified: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    appointment_booked: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    needs_attention: "bg-red-500/15 text-red-400 border-red-500/20",
    cold: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All SMS threads managed by your AI</p>
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
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                    {lead.first_name?.[0] ?? "?"}{lead.last_name?.[0] ?? ""}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {lead.conversations.length} messages
                  </span>
                  <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lead.last_message_at ? formatDistanceToNow(lead.last_message_at) : "—"}
                  </span>
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
