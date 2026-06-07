import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err) {
    console.error("Signup error:", err)
    return NextResponse.json({ error: "Signup failed" }, { status: 500 })
  }
}
