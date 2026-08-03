import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { parseLeadPhone, isPlaceholderPhone } from "@/lib/twilio"

/**
 * PATCH /api/leads/<id>/details — edit a lead's identity fields from the CRM.
 *
 * Exists because the AI could not always capture a name (Messenger profile
 * lookups need Advanced Access, and a lead may simply never say it), which
 * left customers reaching Housecall Pro as "Unknown". The owner needs a way
 * to fix that by hand — in BOTH product modes.
 *
 * Saving a name also repairs the downstream record: if the lead is already
 * linked to an HCP customer, the name is pushed there too.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const auth = await createServerSupabaseClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await auth
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 403 })

  const db = createServiceRoleClient()
  const { data: lead } = await db
    .from("leads").select("id, company_id, phone, hcp_customer_id").eq("id", id).maybeSingle()
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (lead.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const patch: Record<string, string | null> = {}

  if ("first_name" in body) patch.first_name = str(body.first_name).slice(0, 60) || null
  if ("last_name" in body)  patch.last_name  = str(body.last_name).slice(0, 60) || null
  if ("address" in body)    patch.address    = str(body.address).slice(0, 300) || null

  if ("email" in body) {
    const e = str(body.email).toLowerCase()
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
      return NextResponse.json({ error: "That email address doesn't look valid." }, { status: 400 })
    }
    patch.email = e || null
  }

  // Phone: only accept a real, parseable number. Never let a hand-edit
  // introduce a placeholder or garbage value — every sender guards on this.
  if ("phone" in body) {
    const raw = str(body.phone)
    if (raw) {
      const parsed = parseLeadPhone(raw)
      if (!parsed || isPlaceholderPhone(parsed)) {
        return NextResponse.json({ error: `"${raw}" isn't a valid phone number.` }, { status: 400 })
      }
      const { data: clash } = await db
        .from("leads").select("id").eq("company_id", lead.company_id).eq("phone", parsed)
        .neq("id", id).is("deleted_at", null).maybeSingle()
      if (clash) {
        return NextResponse.json({ error: "Another lead already uses that phone number." }, { status: 409 })
      }
      patch.phone = parsed
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const { error } = await db.from("leads").update(patch).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep Housecall Pro in step — otherwise the office keeps seeing "Unknown"
  // even after the name is fixed here. Best-effort: never fail the save.
  let hcpUpdated = false
  if (lead.hcp_customer_id && (patch.first_name || patch.last_name || patch.email)) {
    try {
      const { getHcpClient } = await import("@/lib/housecall")
      const client = await getHcpClient(lead.company_id)
      if (client) {
        const { data: fresh } = await db
          .from("leads").select("first_name, last_name, email").eq("id", id).single()
        await client.put(`/customers/${lead.hcp_customer_id}`, {
          first_name: fresh?.first_name ?? "Unknown",
          last_name: fresh?.last_name ?? "",
          ...(fresh?.email ? { email: fresh.email } : {}),
        })
        hcpUpdated = true
      }
    } catch (err) {
      console.error(`[leads/${id}/details] HCP customer update failed:`, err)
    }
  }

  return NextResponse.json({ ok: true, updated: Object.keys(patch), hcpUpdated })
}
