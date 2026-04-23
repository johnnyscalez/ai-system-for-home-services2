import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { scrapeAndExtractBusinessInfo } from "@/lib/claude"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { url, socialFacebook, socialInstagram } = await req.json()
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 })

    const extracted = await scrapeAndExtractBusinessInfo(url, {
      facebook: socialFacebook,
      instagram: socialInstagram,
    })

    return NextResponse.json({ data: extracted })
  } catch (err) {
    console.error("Scrape error:", err)
    return NextResponse.json({ error: "Failed to scan website" }, { status: 500 })
  }
}
