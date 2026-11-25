import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { formatPhone, isPlaceholderPhone, sendSMS, validateTwilioSignature } from "@/lib/twilio"
import { buildNoReplySchedule } from "@/lib/sequences"
import { serviceCopy } from "@/lib/service-copy"

export const runtime = "nodejs"

// Voice agent off: what happens to an inbound call the owner did not pick up.
//
// /api/voice/inbound forwards the call to the owner's phone with this route as
// the <Dial> action (or redirects here straight away when there is no phone to
// forward to). If the owner answered, we just hang up. Otherwise the caller
// hears one sentence and gets a text from the company number within seconds,
// which puts them into the same SMS conversation every other lead gets.

function twiml(xml: string) {
  return new NextResponse(xml, { status: 200, headers: { "Content-Type": "text/xml" } })
}

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string))

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`)
  const params: Record<string, string> = {}
  form.forEach((v, k) => { params[k] = v.toString() })

  const url = new URL(req.url)
  if (process.env.TWILIO_AUTH_TOKEN) {
    const publicUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") + url.pathname + url.search
    if (!validateTwilioSignature(req.headers.get("x-twilio-signature") ?? "", publicUrl, params)) {
      return new NextResponse("Forbidden", { status: 403 })
    }
  }

  // The owner picked up and the call ran its course.
  const dialStatus = params["DialCallStatus"]
  if (dialStatus === "completed" || dialStatus === "answered") {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`)
  }

  const companyId = url.searchParams.get("companyId")
  const fromRaw = params["From"] ?? ""
  const toRaw = params["To"] ?? ""
  const db = createServiceRoleClient()

  const [{ data: company }, { data: agent }] = await Promise.all([
    companyId ? db.from("companies").select("id, name, service_type").eq("id", companyId).maybeSingle() : Promise.resolve({ data: null }),
    companyId ? db.from("ai_agent_config").select("agent_name, timezone").eq("company_id", companyId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const companyName = (company?.name as string | undefined) ?? "us"
  const caller = (() => { try { return formatPhone(fromRaw) } catch { return "" } })()
  const canText = !!company && !isPlaceholderPhone(caller)

  let texted = false
  if (canText && company) {
    try {
      const { data: existing } = await db
        .from("leads").select("id, ai_paused, status")
        .eq("company_id", company.id).eq("phone", caller).is("deleted_at", null).maybeSingle()
      let leadId = existing?.id as string | undefined
      const optedOut = !!existing?.ai_paused && ["closed_lost", "lost"].includes((existing?.status as string) ?? "")
      if (!leadId) {
        const { data: created } = await db.from("leads").insert({
          company_id: company.id, phone: caller, source: "voice_inbound", channel: "sms",
          status: "just_came_in", service_type: company.service_type ?? null,
          metadata: { missed_call_at: new Date().toISOString() },
        }).select("id").single()
        leadId = created?.id as string | undefined
      }
      if (leadId && !optedOut) {
        const copy = serviceCopy(company.service_type as string | null)
        const agentName = (agent?.agent_name as string | null)?.trim()
        const body = `Hi, this is ${agentName ? `${agentName}, the AI assistant` : "the assistant"} with ${companyName}. Sorry we missed your call. What can we help you with${copy.trade === "flooring" ? " on your floors" : ""}?`
        const msg = await sendSMS(caller, body, toRaw)
        await db.from("conversations").insert({
          lead_id: leadId, company_id: company.id, direction: "outbound",
          sent_by: "ai", body, twilio_sid: msg.sid, channel: "sms",
        })
        await db.from("leads").update({ status: "contacted", last_message_at: new Date().toISOString() })
          .eq("id", leadId).in("status", ["just_came_in", "new"])
        // Same no-reply cadence a form lead gets, unless one is already running.
        const { count } = await db.from("sequences").select("*", { count: "exact", head: true })
          .eq("lead_id", leadId).eq("status", "pending")
        if ((count ?? 0) === 0 && !existing) {
          const steps = buildNoReplySchedule(new Date(), (agent?.timezone as string | null) ?? "America/New_York")
          await db.from("sequences").insert(steps.map((s) => ({
            lead_id: leadId, company_id: company.id, sequence_type: "no_reply",
            step: s.step, scheduled_at: s.scheduledAt.toISOString(), status: "pending",
          })))
        }
        texted = true
        if (!existing) {
          const { notifyNewLead } = await import("@/lib/notifications")
          notifyNewLead(company.id, "", caller, "missed_call", leadId).catch(() => {})
        }
      }
    } catch (err) {
      console.error("[voice/missed] text-back failed:", err)
    }
  }

  const line = texted
    ? `Thanks for calling ${companyName}. Sorry we missed you. We just sent you a text, reply there and we will take care of you.`
    : `Thanks for calling ${companyName}. Sorry we missed you. Please send us a text at this number and we will get right back to you.`
  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${esc(line)}</Say>
  <Hangup/>
</Response>`)
}
