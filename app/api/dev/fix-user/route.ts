import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.auth.admin.updateUserById(
    "867e0ca7-50a8-4ac0-9798-7ab6b00709f8",
    { password: "j200330c", email_confirm: true }
  )
  return NextResponse.json({ email: data?.user?.email, error })
}
