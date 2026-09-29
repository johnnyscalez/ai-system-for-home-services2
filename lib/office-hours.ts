// ─────────────────────────────────────────────────────────────────────────────
// The office-coverage shift model.
//
// Some companies run the AI agent as the NIGHT SHIFT: the human office owns
// the inbox during working hours, and the agent owns everything else —
// evenings, early mornings, and whole uncovered days (weekends). During
// covered hours the agent stays silent on every channel: no replies, no
// openers, no follow-up sends. Inbounds are still stored, stamped and
// takeover-synced as always, so the office sees everything and the agent
// picks up a complete thread when its shift starts.
//
// `office_coverage` on ai_agent_config:
//   { "enabled": true, "days": ["monday",...,"friday"], "start": "08:00", "end": "18:00" }
// means: the OFFICE covers Mon-Fri 08:00-18:00 company time. The agent works
// 18:00→08:00 on those days and around the clock on days not listed — which
// yields exactly "Friday 18:00 through Monday 08:00" for a Mon-Fri office.
// NULL or enabled=false (the default for every company) = agent always on.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceRoleClient } from "@/lib/supabase-server"

export type OfficeCoverage = {
  enabled?: boolean
  days?: string[]
  start?: string // "HH:MM" company-local
  end?: string   // "HH:MM" company-local
}

const DEFAULT_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]

/** True while the human office covers the inbox → the agent must stay silent. */
export function officeCoversNow(
  cov: OfficeCoverage | null | undefined,
  timezone: string,
  at: Date = new Date()
): boolean {
  if (!cov?.enabled) return false
  const weekday = at.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone }).toLowerCase()
  const days = cov.days?.length ? cov.days.map((d) => d.toLowerCase()) : DEFAULT_DAYS
  if (!days.includes(weekday)) return false
  const hm = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone })
  return hm >= (cov.start ?? "08:00") && hm < (cov.end ?? "18:00")
}

/** Company-level check used by webhooks and crons. Fails OPEN (agent on duty):
 *  a config read hiccup must never silence the agent for a normal company. */
export async function officeCoversNowForCompany(companyId: string): Promise<boolean> {
  try {
    const db = createServiceRoleClient()
    const { data } = await db
      .from("ai_agent_config")
      .select("office_coverage, timezone")
      .eq("company_id", companyId)
      .maybeSingle()
    return officeCoversNow(
      data?.office_coverage as OfficeCoverage | null,
      (data?.timezone as string | null) ?? "America/New_York"
    )
  } catch {
    return false
  }
}
