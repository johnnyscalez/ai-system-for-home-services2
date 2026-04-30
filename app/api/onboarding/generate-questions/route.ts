import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { anthropic } from "@/lib/claude"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { serviceType, serviceArea, companyName, disqualifiers, kb } = await req.json()

    const prompt = `You are building qualifying questions for an AI SMS sales agent that books home service appointments.

Company: ${companyName || "a home services company"}
Service type: ${serviceType || "home services"}
Service area: ${serviceArea || "local area"}
Business details: ${kb?.servicesOffered || ""} ${kb?.uniqueSellingPoints || ""}

Leads to DISQUALIFY immediately (do NOT book these):
${disqualifiers || "None specified — qualify all leads."}

Your job: Generate 6–10 smart qualifying questions this AI should be equipped to ask leads.
These are NOT a rigid script — the AI will use them intelligently depending on the conversation.
The questions should:
1. Identify the exact type of job/need (repair vs replace, AC vs heat, etc.)
2. Qualify ownership and authority (homeowner? renter? decision maker?)
3. Screen out the disqualified leads above
4. Gather key details needed to prepare an accurate estimate
5. Understand urgency and timeline
6. Be natural and conversational, not robotic

Return ONLY a JSON array of question strings, no explanation:
["Question 1?", "Question 2?", ...]`

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 })
    }

    // Extract JSON array from response
    const match = content.text.match(/\[[\s\S]*\]/)
    if (!match) {
      return NextResponse.json({ error: "Could not parse questions" }, { status: 500 })
    }

    const questions: string[] = JSON.parse(match[0])
    return NextResponse.json({ questions })
  } catch (err) {
    console.error("Generate questions error:", err)
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 })
  }
}
