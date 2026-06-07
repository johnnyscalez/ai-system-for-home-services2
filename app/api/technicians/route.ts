import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient, createAdminClient } from "@/lib/supabase-server"
import { sendSMS } from "@/lib/twilio"
import { Resend } from "resend"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const { data, error } = await supabase
    .from("technicians")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json()
  const { name, phone, email, password, specializations, zip_codes, schedule, status, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!password?.trim()) return NextResponse.json({ error: "Password is required to send login credentials" }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })

  const db = createServiceRoleClient()
  const admin = createAdminClient()

  // Get company name for the invite messages
  const { data: company } = await db
    .from("companies")
    .select("name")
    .eq("id", profile.company_id)
    .single()
  const companyName = company?.name ?? "Your team"

  // Insert technician first to get an ID
  const { data: tech, error: techError } = await db
    .from("technicians")
    .insert({
      company_id:      profile.company_id,
      name:            name.trim(),
      phone:           phone?.trim() || null,
      email:           email?.trim() || null,
      specializations: specializations ?? [],
      zip_codes:       (zip_codes ?? []).map((z: string) => z.trim()).filter(Boolean),
      schedule:        schedule ?? undefined,
      status:          status ?? "active",
      notes:           notes?.trim() || null,
    })
    .select()
    .single()

  if (techError || !tech) {
    return NextResponse.json({ error: techError?.message ?? "Failed to create technician" }, { status: 500 })
  }

  // Determine auth email: real email if provided, else generated from tech ID
  const realEmail = email?.trim() || null
  const systemEmail = realEmail ?? `tech-${tech.id}@fieldbuilt.tech`

  // Create Supabase auth user so the tech can log in
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: systemEmail,
    password: password.trim(),
    email_confirm: true,
    app_metadata: { role: "technician", company_id: profile.company_id },
    user_metadata: { full_name: name.trim() },
  })

  if (authError || !authData.user) {
    // Roll back technician insert on auth failure
    await db.from("technicians").delete().eq("id", tech.id)
    return NextResponse.json({ error: authError?.message ?? "Failed to create login account" }, { status: 500 })
  }

  const authUserId = authData.user.id

  // Link auth user to technician and save system_email
  await db
    .from("technicians")
    .update({ auth_user_id: authUserId, system_email: systemEmail })
    .eq("id", tech.id)

  // Insert a public.users row for the tech (trigger may have already created it)
  await db.from("users").upsert({
    id: authUserId,
    company_id: profile.company_id,
    role: "technician",
    full_name: name.trim(),
    email: systemEmail,
  }, { onConflict: "id" })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const loginUrl = `${appUrl}/tech/login`
  const loginMethod = realEmail ? "Email" : "Phone"
  const loginIdentifier = realEmail ? realEmail : (phone?.trim() || "your phone number")

  // Send SMS invite (only if phone provided)
  if (phone?.trim()) {
    const smsBody =
      `Hi ${name.trim().split(" ")[0]}! 👷 You've been added to the ${companyName} field team on FieldBuilt AI.\n\n` +
      `Login at: ${loginUrl}\n` +
      `${loginMethod}: ${loginIdentifier}\n` +
      `Password: ${password.trim()}`

    try {
      // Try using the company's provisioned number first, fall back to default
      const { data: phoneRecord } = await db
        .from("phone_numbers")
        .select("phone_number")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .single()

      await sendSMS(phone.trim(), smsBody, phoneRecord?.phone_number ?? undefined)
    } catch (err) {
      console.error("[technicians] SMS invite failed:", err)
      // Non-fatal — tech was created, just log the failure
    }
  }

  // Send email invite (only if real email provided)
  if (realEmail) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
      await resend.emails.send({
        from: `${companyName} via FieldBuilt AI <${fromEmail}>`,
        to: realEmail,
        subject: `You've been invited to join ${companyName} on FieldBuilt AI`,
        html: buildInviteEmail({ name: name.trim(), companyName, loginUrl, loginIdentifier, password: password.trim() }),
      })
    } catch (err) {
      console.error("[technicians] Email invite failed:", err)
    }
  }

  // Return the full technician record
  const { data: finalTech } = await db.from("technicians").select("*").eq("id", tech.id).single()
  return NextResponse.json(finalTech ?? tech, { status: 201 })
}

function buildInviteEmail(opts: {
  name: string
  companyName: string
  loginUrl: string
  loginIdentifier: string
  password: string
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #E7E5E4;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#F97316,#ea6d04);padding:32px 36px;">
      <p style="margin:0;font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">FieldBuilt AI</p>
      <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Field technician portal</p>
    </div>
    <div style="padding:36px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1C1917;">Hi ${opts.name}! 👷</p>
      <p style="margin:0 0 28px;font-size:15px;color:#78716C;line-height:1.6;">
        You've been added to the <strong style="color:#1C1917;">${opts.companyName}</strong> field team on FieldBuilt AI.
        Use the credentials below to access your appointments.
      </p>

      <div style="background:#F5F4F2;border-radius:12px;padding:20px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:1px;">Your login details</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <p style="margin:0;font-size:11px;color:#78716C;">Login page</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#F97316;">${opts.loginUrl}</p>
          </div>
          <div>
            <p style="margin:0;font-size:11px;color:#78716C;">Email</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#1C1917;font-family:monospace;">${opts.loginIdentifier}</p>
          </div>
          <div>
            <p style="margin:0;font-size:11px;color:#78716C;">Password</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#1C1917;font-family:monospace;">${opts.password}</p>
          </div>
        </div>
      </div>

      <a href="${opts.loginUrl}" style="display:block;text-align:center;background:#F97316;color:#fff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:10px;text-decoration:none;">
        Log in to see your appointments →
      </a>

      <p style="margin:24px 0 0;font-size:12px;color:#A8A29E;text-align:center;">
        You can change your password after logging in. Questions? Contact your manager.
      </p>
    </div>
  </div>
</body>
</html>
`
}
