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
  return NextResponse.json({ success: true, agent, paused })
}
