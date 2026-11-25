import { NextRequest, NextResponse } from "next/server"
import { loadIntake, saveIntake, emptyIntake } from "@/lib/intake"
import { applyIntakeToRuntime, composePricingInfo, stripGeneratedPricing } from "@/lib/intake-apply"
import { placesAvailable } from "@/lib/service-areas"
import { getSession, ensureCompany, sanitizeIntakePatch } from "../_lib"

export const runtime = "nodejs"

const KB_FIELDS = [
  "website_url", "business_description", "services_offered", "unique_selling_points",
  "certifications", "testimonials", "financing_options", "pricing_info", "custom_ai_knowledge",
] as const

const TONES = ["friendly_professional", "casual", "formal"]

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : ""
}

function validTimezone(tz: unknown): string | null {
  if (typeof tz !== "string" || !tz) return null
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return tz
  } catch {
    return null
  }
}

/** Everything the wizard needs to render any step, in one read. */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { db, companyId } = session
  const user = { fullName: session.fullName, email: session.email }

  if (!companyId) {
    return NextResponse.json({
      company: null,
      knowledgeBase: null,
      agent: null,
      intake: emptyIntake(),
      phoneNumber: null,
      facebook: { connected: false, pageName: null, adAccountId: null },
      gmailConnected: false,
      googlePlaces: await placesAvailable(),
      scan: null,
      user,
    })
  }

  const [companyRes, kbRes, agentRes, phoneRes, fbRes, fbConnRes, gmailRes, intake, googlePlaces] = await Promise.all([
    db.from("companies").select("id, name, office_address, notification_phone, onboarding_completed").eq("id", companyId).maybeSingle(),
    db.from("knowledge_base").select(`${KB_FIELDS.join(", ")}, scraped_raw`).eq("company_id", companyId).maybeSingle(),
    db.from("ai_agent_config")
      .select("agent_name, tone, working_hours_start, working_hours_end, timezone, custom_instructions")
      .eq("company_id", companyId).maybeSingle(),
    db.from("phone_numbers").select("phone_number").eq("company_id", companyId).eq("is_active", true).limit(1).maybeSingle(),
    db.from("integrations").select("is_active, fb_page_id, fb_page_name").eq("company_id", companyId).eq("type", "facebook").maybeSingle(),
    db.from("facebook_connections").select("fb_ad_account_id").eq("company_id", companyId).not("fb_ad_account_id", "is", null).limit(1).maybeSingle(),
    db.from("gmail_connections").select("is_connected").eq("company_id", companyId).maybeSingle(),
    loadIntake(db, companyId),
    placesAvailable(),
  ])

  const kbRow = (kbRes.data ?? null) as Record<string, unknown> | null
  const knowledgeBase = kbRow
    ? {
        ...Object.fromEntries(KB_FIELDS.map((f) => [f, (kbRow[f] as string | null) ?? ""])),
        // The offer lines are generated from the offer step; the owner only edits their own notes.
        pricing_info: stripGeneratedPricing(kbRow.pricing_info as string | null),
      }
    : null
  const scan = ((kbRow?.scraped_raw ?? null) as { scan?: unknown } | null)?.scan ?? null

  return NextResponse.json({
    company: companyRes.data ?? null,
    knowledgeBase,
    agent: agentRes.data ?? null,
    intake,
    phoneNumber: (phoneRes.data?.phone_number as string | null) ?? null,
    facebook: {
      connected: !!fbRes.data?.is_active && !!fbRes.data?.fb_page_id,
      pageName: (fbRes.data?.fb_page_name as string | null) ?? null,
      adAccountId: (fbConnRes.data?.fb_ad_account_id as string | null) ?? null,
    },
    gmailConnected: !!gmailRes.data?.is_connected,
    googlePlaces,
    scan,
    user,
  })
}

/**
 * Saves a partial `{ company?, knowledgeBase?, agent?, intake? }`. The first
 * save that carries a company name creates the company. With `apply: true` on
 * an account that is already live, the saved intake is compiled into the
 * running config straight away (Settings > Account setup).
 */
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { db } = session

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  const company = (body.company ?? null) as Record<string, unknown> | null
  const kb = (body.knowledgeBase ?? null) as Record<string, unknown> | null
  const agent = (body.agent ?? null) as Record<string, unknown> | null

  try {
    let companyId = session.companyId
    let created = false
    if (!companyId) {
      const name = text(company?.name, 120).trim()
      // Nothing to attach a save to until the company has a name.
      if (!name) return NextResponse.json({ saved: false, reason: "company_name_needed" })
      companyId = await ensureCompany(session, name, validTimezone(agent?.timezone))
      created = true
    }

    if (company) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      const name = text(company.name, 120).trim()
      if (name) patch.name = name
      if ("office_address" in company) patch.office_address = text(company.office_address, 300).trim() || null
      if ("notification_phone" in company) patch.notification_phone = text(company.notification_phone, 30).trim() || null
      const { error } = await db.from("companies").update(patch).eq("id", companyId)
      if (error) throw new Error(`company: ${error.message}`)
    }

    let intake = await loadIntake(db, companyId)
    if (body.intake) {
      intake = await saveIntake(db, companyId, sanitizeIntakePatch(body.intake, intake))
    }

    // Knowledge base. pricing_info is always recomposed so the offer lines the
    // assistant quotes can never drift from the offer the owner picked.
    {
      const { data: existing } = await db
        .from("knowledge_base").select("id, pricing_info").eq("company_id", companyId).maybeSingle()
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (kb) {
        for (const f of KB_FIELDS) {
          if (f === "pricing_info" || !(f in kb)) continue
          patch[f] = text(kb[f], f === "website_url" ? 300 : 6000).trim() || null
        }
      }
      const ownerNotes = kb && "pricing_info" in kb
        ? text(kb.pricing_info, 6000)
        : stripGeneratedPricing(existing?.pricing_info as string | null)
      patch.pricing_info = composePricingInfo(intake, ownerNotes) || null
      const { error } = existing?.id
        ? await db.from("knowledge_base").update(patch).eq("id", existing.id)
        : await db.from("knowledge_base").insert({ company_id: companyId, ...patch })
      if (error) throw new Error(`knowledge base: ${error.message}`)
    }

    if (agent) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      const name = text(agent.agent_name, 40).trim()
      if (name) patch.agent_name = name
      if (typeof agent.tone === "string" && TONES.includes(agent.tone)) {
        patch.tone = agent.tone
        patch.agent_persona = agent.tone
      }
      const start = Number(agent.working_hours_start)
      const end = Number(agent.working_hours_end)
      if (Number.isInteger(start) && start >= 0 && start <= 23) patch.working_hours_start = start
      if (Number.isInteger(end) && end >= 1 && end <= 24) patch.working_hours_end = end
      const tz = validTimezone(agent.timezone)
      if (tz) patch.timezone = tz
      if ("custom_instructions" in agent) patch.custom_instructions = text(agent.custom_instructions, 4000).trim() || null
      const { data: existing } = await db.from("ai_agent_config").select("id").eq("company_id", companyId).maybeSingle()
      const { error } = existing?.id
        ? await db.from("ai_agent_config").update(patch).eq("id", existing.id)
        : await db.from("ai_agent_config").insert({ company_id: companyId, ...patch })
      if (error) throw new Error(`assistant: ${error.message}`)
    }

    let applied = null
    if (body.apply === true) {
      const { data: row } = await db.from("companies").select("onboarding_completed").eq("id", companyId).maybeSingle()
      if (row?.onboarding_completed) applied = await applyIntakeToRuntime(companyId, { prompt: "never" })
    }

    return NextResponse.json({
      saved: true,
      created,
      companyId,
      // Server-owned parts the browser must not overwrite with its own copy.
      photos: intake.assets?.photos ?? [],
      a2p: intake.a2p ?? null,
      applied,
    })
  } catch (err) {
    console.error("[onboarding/state] save failed:", err)
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 })
  }
}
