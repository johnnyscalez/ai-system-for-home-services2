import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

// FieldBuilt's OWN funnel intake — the landing page qualify-form posts here.
//
// Leads land directly in our system under the "FieldBuilt AI" sales tenant
// (service_type: fieldbuilt_sales) and get worked by our own AI on the sales
// playbook: instant text, qualification already done by the form, walkthrough
// call booked by conversation. We are our own first customer — the AI that
// texts the prospect IS the product being sold.
//
// Qualified leads → forwarded to the production lead webhook (same code path
// every contractor lead takes: AI opener + follow-up sequences + notifications).
// Unqualified leads → stored for the record, AI paused, no outreach.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.phone !== "string" || !body.phone.trim()) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 })
  }

  const db = createServiceRoleClient()
  const { data: salesCo } = await db
    .from("companies")
    .select("id, webhook_secret")
    .eq("service_type", "fieldbuilt_sales")
    .limit(1)
    .maybeSingle()

  if (!salesCo) {
    console.error("lead-intake: no fieldbuilt_sales company configured")
    return NextResponse.json({ error: "Intake not configured" }, { status: 503 })
  }

  const qualified = body.qualified === true
  const notes = [
    `FieldBuilt funnel lead (${body.angle ?? "unknown angle"})`,
    body.techs ? `Techs: ${body.techs}` : null,
    body.revenue ? `Revenue: ${body.revenue}` : null,
    body.tier ? `Tier: ${body.tier}` : null,
    qualified ? "QUALIFIED by form" : "NOT qualified by form",
  ].filter(Boolean).join(" · ")

  if (!qualified) {
    // Keep the record, but the AI never chases someone the form told "not a fit"
    await db.from("leads").insert({
      company_id: salesCo.id,
      first_name: typeof body.first_name === "string" ? body.first_name : null,
      phone: body.phone,
      email: typeof body.email === "string" ? body.email : null,
      source: "website",
      channel: "sms",
      status: "unqualified",
      ai_paused: true,
      notes,
    })
    return NextResponse.json({ ok: true, qualified: false })
  }

  // Qualified → the exact same pipeline every contractor lead rides:
  // lead created → AI opener SMS within seconds → follow-up sequences → CRM
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  try {
    const res = await fetch(`${appUrl}/api/webhooks/lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": salesCo.webhook_secret,
      },
      body: JSON.stringify({
        first_name: body.first_name,
        phone: body.phone,
        email: body.email,
        source: "website",
        notes,
      }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, ...data }, { status: res.ok ? 200 : res.status })
  } catch (err) {
    console.error("lead-intake: internal forward failed:", err)
    return NextResponse.json({ error: "Failed to process lead" }, { status: 502 })
  }
}
