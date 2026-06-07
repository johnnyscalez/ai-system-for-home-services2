import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { formatPhone } from "@/lib/twilio"

export const runtime = "nodejs"

// POST /api/tech/resolve-identifier
// Maps a phone number to the tech's system_email for login.
// Called from the tech login page when the user enters a phone (not an email).
export async function POST(req: NextRequest) {
  const { identifier } = await req.json()
  if (!identifier?.trim()) {
    return NextResponse.json({ error: "Identifier required" }, { status: 400 })
  }

  const raw = identifier.trim()

  // Normalise phone to E.164 so it matches what's stored in the DB
  let phone: string
  try {
    phone = formatPhone(raw)
  } catch {
    phone = raw
  }

  const db = createServiceRoleClient()

  // Look up tech by phone — check both the raw input and the E.164 form
  const { data: tech } = await db
    .from("technicians")
    .select("id, system_email, company_id, name")
    .or(`phone.eq.${phone},phone.eq.${raw}`)
    .not("system_email", "is", null)
    .limit(1)
    .single()

  if (!tech?.system_email) {
    return NextResponse.json({ error: "No technician account found" }, { status: 404 })
  }

  // Get company name for the login page headline
  const { data: company } = await db
    .from("companies")
    .select("name")
    .eq("id", tech.company_id)
    .single()

  return NextResponse.json({
    systemEmail: tech.system_email,
    companyName: company?.name ?? null,
    techName: tech.name,
  })
}
