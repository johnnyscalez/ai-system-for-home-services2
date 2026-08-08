import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { paused, agent = "sms" } = body as { paused: boolean; agent?: "sms" | "voice" }
  if (typeof paused !== "boolean") {
    return NextResponse.json({ error: "paused must be boolean" }, { status: 400 })
  }
  if (agent !== "sms" && agent !== "voice") {
    return NextResponse.json({ error: "agent must be 'sms' or 'voice'" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const column = agent === "voice" ? "ai_voice_paused" : "ai_paused"
  const service = createServiceRoleClient()
  const { error } = await service
    .from("leads")
    .update({ [column]: paused })
    .eq("id", id)
    .eq("company_id", profile.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // RESUMING the SMS/Messenger agent on a thread a human has been working:
  // pull in everything that happened while the AI was out. The import at lead
  // creation is a one-time snapshot, so without this the agent resumes with a
  // stale picture and can contradict what the rep already told the customer.
  // Additive only — never edits or deletes existing messages.
  let resynced = 0
  const backfilled: string[] = []
  if (!paused && agent === "sms") {
    try {
      const { data: lead } = await service
        .from("leads").select("id, company_id, messenger_psid").eq("id", id).maybeSingle()
      if (lead?.messenger_psid) {
        const { data: integ } = await service
          .from("integrations")
          .select("fb_page_id, fb_access_token")
          .eq("company_id", lead.company_id).eq("is_active", true).maybeSingle()
        if (integ?.fb_access_token && integ.fb_page_id) {
          const { syncMessengerHistory, backfillLeadFromThread } = await import("@/lib/messenger")
          const r = await syncMessengerHistory(
            service, lead.id, lead.company_id,
            integ.fb_access_token, integ.fb_page_id, lead.messenger_psid
          , { autoPauseOnRep: false })
          resynced = r.added
          backfilled.push(...(await backfillLeadFromThread(service, lead.id, r.facts)))
        }
      }
    } catch (err) {
      // Never block the resume itself over a sync failure
      console.error("[ai-pause] resume re-sync failed:", err)
    }
  }

  return NextResponse.json({ success: true, agent, paused, resynced, backfilled })
}
