import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendSMS, formatPhone } from "@/lib/twilio"
import crypto from "crypto"

// GET — Facebook webhook verification challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// POST — Receive leadgen events
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify Facebook signature
  const sig = req.headers.get("x-hub-signature-256")
  if (sig && process.env.FACEBOOK_APP_SECRET) {
    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", process.env.FACEBOOK_APP_SECRET)
        .update(rawBody)
        .digest("hex")
    if (sig !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let body: {
    object: string
    entry: Array<{
      id: string
      changes: Array<{
        field: string
        value: { leadgen_id: string; page_id: string; form_id: string }
      }>
    }>
  }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.object !== "page") {
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceRoleClient()

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field !== "leadgen") continue

      const { leadgen_id, page_id, form_id } = change.value

      // Look up company by Facebook page ID
      const { data: integration } = await supabase
        .from("integrations")
        .select("company_id, fb_access_token")
        .eq("fb_page_id", page_id)
        .eq("is_active", true)
        .single()

      if (!integration) continue

      // Fetch lead field data from Facebook Graph API
      const leadRes = await fetch(
        `https://graph.facebook.com/${leadgen_id}?fields=field_data&access_token=${integration.fb_access_token}`
      )
      const leadData = await leadRes.json()
      if (!leadData.field_data) continue

      // Normalize field_data array into a flat object
      const fields: Record<string, string> = {}
      for (const f of leadData.field_data as Array<{ name: string; values: string[] }>) {
        fields[f.name.toLowerCase().replace(/\s+/g, "_")] = f.values?.[0] ?? ""
      }

      const rawPhone =
        fields["phone_number"] ||
        fields["phone"] ||
        fields["mobile_phone"] ||
        fields["mobile"] ||
        ""
      if (!rawPhone) continue

      const phone = formatPhone(rawPhone)
      const fullName = fields["full_name"] || ""
      const firstName = fields["first_name"] || fullName.split(" ")[0] || null
      const lastName =
        fields["last_name"] ||
        (fullName.includes(" ") ? fullName.split(" ").slice(1).join(" ") : null)

      // Upsert lead
      const { data: existing } = await supabase
        .from("leads")
        .select("id, status")
        .eq("company_id", integration.company_id)
        .eq("phone", phone)
        .maybeSingle()

      let leadId: string

      if (existing) {
        if (existing.status === "cold" || existing.status === "closed_lost") {
          await supabase
            .from("leads")
            .update({ status: "new", updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        }
        leadId = existing.id
      } else {
        const { data: newLead } = await supabase
          .from("leads")
          .insert({
            company_id: integration.company_id,
            phone,
            first_name: firstName,
            last_name: lastName,
            email: fields["email"] || null,
            source: "facebook",
            source_form_id: form_id,
            status: "new",
            metadata: { leadgen_id, page_id, form_id },
          })
          .select("id")
          .single()

        if (!newLead) continue
        leadId = newLead.id
      }

      // Update integration stats
      await supabase
        .from("integrations")
        .update({
          last_lead_at: new Date().toISOString(),
          lead_count: supabase.rpc("increment", { row_id: integration.company_id }),
        })
        .eq("company_id", integration.company_id)
        .eq("type", "facebook")

      // Get company's Twilio number and send AI opening message
      const { data: phoneNumber } = await supabase
        .from("phone_numbers")
        .select("phone_number")
        .eq("company_id", integration.company_id)
        .eq("is_active", true)
        .single()

      if (!phoneNumber?.phone_number) continue

      try {
        const result = await processAndSave(leadId, integration.company_id, null)
        if (result.response) {
          const msg = await sendSMS(phone, result.response, phoneNumber.phone_number)
          await supabase
            .from("conversations")
            .update({ twilio_sid: msg.sid })
            .eq("lead_id", leadId)
            .eq("direction", "outbound")
            .is("twilio_sid", null)
            .order("created_at", { ascending: false })
            .limit(1)

          await supabase
            .from("leads")
            .update({ status: "contacted", last_message_at: new Date().toISOString() })
            .eq("id", leadId)

          await supabase.from("sequences").insert({
            lead_id: leadId,
            company_id: integration.company_id,
            sequence_type: "no_reply",
            step: 1,
            scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            status: "pending",
          })
        }
      } catch (e) {
        console.error("AI/SMS error for Facebook lead:", leadId, e)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
