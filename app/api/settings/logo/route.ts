import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const ext = file.name.split(".").pop() ?? "png"
  const path = `logos/${profile.company_id}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path)

  await supabase
    .from("email_templates")
    .upsert({ company_id: profile.company_id, logo_url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: "company_id" })

  return NextResponse.json({ url: publicUrl })
}
