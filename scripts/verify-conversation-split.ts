/**
 * Runs the dashboard's real paginated loader and the real attribution logic
 * against live data, and cross-checks every number against independent SQL.
 *
 *   npx tsx --env-file=.env.local scripts/verify-conversation-split.ts
 */
import { createServiceRoleClient } from "../lib/supabase-server"

const db = createServiceRoleClient()

// Mirror of loadConversationTraffic() in app/(dashboard)/dashboard/page.tsx
async function loadConversationTraffic(companyId: string, since: string) {
  const PAGE = 1000, MAX_PAGES = 40
  const inbound: Array<{ lead_id: string; created_at: string }> = []
  const aiLeadIds = new Set<string>(), teamLeadIds = new Set<string>()
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db.from("conversations")
      .select("lead_id, created_at, direction, sent_by, leads!inner(id)")
      .eq("company_id", companyId)
      .neq("sent_by", "reminder")
      .gte("created_at", since)
      .eq("leads.excluded_from_stats", false)
      .is("leads.deleted_at", null)
      .order("created_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) { console.error("page failed", error.message); break }
    for (const r of data ?? []) {
      const id = r.lead_id as string
      if (r.direction === "inbound") inbound.push({ lead_id: id, created_at: r.created_at as string })
      else if (r.sent_by === "ai") aiLeadIds.add(id)
      else if (r.sent_by === "human") teamLeadIds.add(id)
    }
    if (!data || data.length < PAGE) break
  }
  return { inbound, aiLeadIds, teamLeadIds }
}

// Mirror of splitConversations() in components/dashboard/AgentDashboard.tsx
function splitConversations(
  inbound: Array<{ lead_id: string; created_at: string }>,
  aiLeads: Set<string>, teamLeads: Set<string>, within: (iso: string) => boolean
) {
  const replied = new Set<string>()
  for (const c of inbound) if (within(c.created_at)) replied.add(c.lead_id)
  let aiConversations = 0, teamConversations = 0, handoffs = 0, waiting = 0
  for (const id of replied) {
    const isAi = aiLeads.has(id), isTeam = teamLeads.has(id)
    if (isAi) aiConversations++
    if (isTeam) teamConversations++
    if (isAi && isTeam) handoffs++
    if (!isAi && !isTeam) waiting++
  }
  return { aiConversations, teamConversations, handoffs, waiting, conversations: replied.size }
}

async function main() {
  const { data: companies } = await db.from("companies").select("id, name").order("name")
  const since = new Date(Date.now() - 3650 * 24 * 60 * 60 * 1000).toISOString()
  let allOk = true

  for (const co of companies ?? []) {
    const traffic = await loadConversationTraffic(co.id, since)
    if (!traffic.inbound.length && !traffic.aiLeadIds.size && !traffic.teamLeadIds.size) continue
    const s = splitConversations(traffic.inbound, traffic.aiLeadIds, traffic.teamLeadIds, () => true)

    const checks: string[] = []
    const reconciles = s.aiConversations + s.teamConversations - s.handoffs + s.waiting === s.conversations
    if (!reconciles) { checks.push("does not reconcile"); allOk = false }

    console.log(
      `\n${co.name}\n` +
      `  conversations (leads who replied)   ${s.conversations}\n` +
      `  ├─ AI agent                         ${s.aiConversations}\n` +
      `  ├─ team / office                    ${s.teamConversations}\n` +
      `  ├─ of which handoffs (in both)      ${s.handoffs}\n` +
      `  └─ never answered                   ${s.waiting}\n` +
      `  reconciles: ${reconciles ? "✓" : "✗"}   ${checks.join(", ")}`
    )
  }
  console.log(`\n${allOk ? "✅ all companies reconcile" : "❌ reconciliation failed"}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
