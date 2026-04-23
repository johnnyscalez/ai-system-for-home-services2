import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Calendar, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default async function AppointmentsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, leads(first_name, last_name, phone)")
    .eq("company_id", profile.company_id)
    .order("scheduled_at", { ascending: true })

  const rows = (appointments ?? []) as {
    id: string; scheduled_at: string; address: string | null;
    notes: string | null; status: string;
    leads: { first_name: string | null; last_name: string | null; phone: string } | null;
  }[]

  const statusStyles: Record<string, string> = {
    scheduled: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    completed: "bg-sky-500/15 text-sky-400 border-sky-500/20",
    cancelled: "bg-red-500/15 text-red-400 border-red-500/20",
    no_show: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  }

  const upcoming = rows.filter((a) => a.status === "scheduled" && new Date(a.scheduled_at) >= new Date())
  const past = rows.filter((a) => a.status !== "scheduled" || new Date(a.scheduled_at) < new Date())

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {upcoming.length} upcoming · {past.length} past
        </p>
      </div>

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <div key={apt.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs text-emerald-400 font-medium">
                      {new Date(apt.scheduled_at).toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <span className="text-lg font-bold text-emerald-400 leading-none">
                      {new Date(apt.scheduled_at).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{apt.leads?.first_name} {apt.leads?.last_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(apt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                    {apt.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />{apt.address}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                  Scheduled
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past</h2>
          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {past.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{apt.leads?.first_name} {apt.leads?.last_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(apt.scheduled_at).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", year: "numeric"
                      })}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-xs ${statusStyles[apt.status] ?? ""}`}>
                  {apt.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div className="bg-card border border-border rounded-xl px-5 py-16 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No appointments yet.</p>
          <p className="text-xs text-muted-foreground mt-1">They&apos;ll appear here once your AI books the first one.</p>
        </div>
      )}
    </div>
  )
}
