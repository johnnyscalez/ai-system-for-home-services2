import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { generateSystemPrompt } from "@/lib/claude"
import type { KnowledgeBaseData, AgentConfigData } from "@/lib/claude"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { kb, config }: { kb: KnowledgeBaseData; config: AgentConfigData } = await req.json()
    if (!kb || !config) return NextResponse.json({ error: "Missing data" }, { status: 400 })

    const prompt = await generateSystemPrompt(kb, config)
    return NextResponse.json({ prompt })
  } catch (err) {
    console.error("Prompt generation error:", err)
    return NextResponse.json({ error: "Failed to generate prompt" }, { status: 500 })
  }
}
