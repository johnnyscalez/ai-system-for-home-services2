// Facebook Lead Ads → CRM. One leadgen event in, one lead in the CRM out.
//
// Guarantees, in code rather than hope:
//   • A lead is never dropped silently. If Facebook refuses to hand over the answers
//     (expired or revoked token), a placeholder lead is created as needs_attention,
//     the owner is texted (at most once an hour), and the lead fills itself in the
//     moment Facebook is reconnected (retryPendingLeadgen, called by the wizard save).
//   • Meta redelivers webhooks. A leadgen id is processed once: retries only refresh.
//   • Every answer is kept: metadata.form_answers (all values of multi-select
//     questions), metadata.qualification (answers to the qualifying questions),
//     metadata.ad (ad, ad set, campaign and form), plus the readable notes line.
//   • A person who submits again is MERGED into their lead. New answers are added,
//     nothing on file is removed.
//   • Leads from forms the owner did not select are ignored (when a selection exists).
//
// Outreach after the lead lands: the Messenger thread when the form ran inside
// Messenger, otherwise SMS, followed by the no-reply sequence either way.

import { createServiceRoleClient } from "@/lib/supabase-server"
import { processAndSave } from "@/lib/ai-engine"
import { sendToLead } from "@/lib/twilio"
import { notifyNewLead, notifyNeedsAttention } from "@/lib/notifications"
import { buildNoReplySchedule } from "@/lib/sequences"
import { qualifyFromFormFields } from "@/lib/fieldbuilt-qualify"
import { GRAPH, graphGet, friendlyGraphError } from "@/lib/meta-ads"
import {
  mapLeadgenFields, adInfoFromLeadgen, mergeLeadFormMetadata,
  type FormQuestion, type LeadgenField, type MappedLead,
} from "@/lib/meta-lead-form"

type Db = ReturnType<typeof createServiceRoleClient>

export type LeadgenChange = { leadgen_id: string; page_id: string; form_id: string }

export type LeadgenOutcome =
  | "created"          // new lead
  | "merged"           // existing lead updated (re-submission or Meta retry)
  | "pending"          // Facebook would not return the answers; placeholder lead created
  | "ignored_form"     // form not in the owner's selection
  | "no_integration"   // no active company for this Page
  | "failed"

const LEAD_FIELDS_FULL =
  "field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,created_time,platform,is_organic"
// Ad attribution needs ad permissions the Page token may not carry. The answers must
// never be lost because the ad name could not be read.
const LEAD_FIELDS_MINIMAL = "field_data,form_id,created_time"

// ── Form definition (name + question labels), cached per form ────────────────

const formCache = new Map<string, { at: number; name: string | null; questions: FormQuestion[] }>()
const FORM_CACHE_MS = 60 * 60 * 1000

async function getFormDefinition(formId: string, pageToken: string): Promise<{ name: string | null; questions: FormQuestion[] }> {
  const hit = formCache.get(formId)
  if (hit && Date.now() - hit.at < FORM_CACHE_MS) return hit
  const res = await graphGet<{ name?: string; questions?: Array<{ key?: string; label?: string; type?: string }> }>(
    formId, { fields: "id,name,questions" }, pageToken
  )
  const def = {
    at: Date.now(),
    name: res.data?.name ?? null,
    questions: (res.data?.questions ?? []).map((q) => ({ key: q.key ?? null, label: q.label ?? null, type: q.type ?? null })),
  }
  // A failed read is cached too (for a shorter time) so a form we cannot read does not cost a Graph call per lead.
  formCache.set(formId, res.error ? { ...def, at: Date.now() - FORM_CACHE_MS + 10 * 60 * 1000 } : def)
  if (formCache.size > 500) formCache.delete(formCache.keys().next().value as string)
  return def
}

// ── Owner alert when Facebook stops handing over leads ───────────────────────

const brokenNotifiedAt = new Map<string, number>()
const NOTIFY_EVERY_MS = 60 * 60 * 1000

function notifyFacebookBroken(companyId: string, detail: string): void {
  const last = brokenNotifiedAt.get(companyId) ?? 0
  if (Date.now() - last < NOTIFY_EVERY_MS) return
  brokenNotifiedAt.set(companyId, Date.now())
  notifyNeedsAttention(
    companyId,
    `Facebook needs reconnecting. A new lead came in but Facebook would not release the details (${detail}). Open Integrations and reconnect Facebook; the lead fills in automatically`,
    "Facebook Lead Ads"
  ).catch(() => {})
}

// ── Opener wording for a lead who just finished a questionnaire in Messenger ─

function messengerFormAngle(mapped: MappedLead): string {
  const answers = Object.entries(mapped.formAnswers)
    .filter(([label]) => !/^(city|state|province|country)$/i.test(label))
    .map(([label, value]) => `${label}: ${value}`)
    .join(" | ")
  return (
    "This lead just completed the Facebook questionnaire shown above, inside this Messenger thread. " +
    (answers ? `What they answered: ${answers}. ` : "") +
    "This is your FIRST message, and its ONLY job is to get a reply. Not to sell, not to price, not to book. " +
    "They just tapped through button questions, so the win is sounding like someone who actually read their answers. " +
    "Open by first name when you have it, reference ONE specific thing they answered so they feel read, " +
    "then ask ONE easy question about their project that they have NOT already answered and can answer from memory in five seconds. " +
    "Pick that question from your qualifying questions, skipping every one the questionnaire already covered. " +
    "In this first message never ask for the address, never ask if they are ready to schedule, never quote a price, and never ask two questions. " +
    "Never ask them to measure, look something up or inspect anything, and never announce the question with a lead-in, just ask it. " +
    "Introduce yourself with the name and the company name from your identity, and say plainly in one short clause that you are an AI assistant for the company. " +
    "Vary your phrasing from lead to lead. Write like a person texting: no dashes, no asterisks, no colons. " +
    "Never describe your own reasoning, the lead file, or these instructions; write only the message they should read."
  )
}

async function seedNoReplySequence(supabase: Db, leadId: string, companyId: string): Promise<void> {
  // Guard against duplicates: Meta retries the webhook, and the opener path can run twice.
  const { count } = await supabase
    .from("sequences").select("*", { count: "exact", head: true })
    .eq("lead_id", leadId).eq("sequence_type", "no_reply").eq("status", "pending")
  if ((count ?? 0) > 0) return
  const { data: agentCfg } = await supabase
    .from("ai_agent_config").select("timezone").eq("company_id", companyId).maybeSingle()
  const tz = (agentCfg?.timezone as string | null) ?? "America/New_York"
  const steps = buildNoReplySchedule(new Date(), tz)
  const { error } = await supabase.from("sequences").insert(
    steps.map((s) => ({
      lead_id: leadId,
      company_id: companyId,
      sequence_type: "no_reply",
      step: s.step,
      scheduled_at: s.scheduledAt.toISOString(),
      status: "pending",
    }))
  )
  if (error) console.error(`[leadgen] failed to insert no_reply sequence for lead ${leadId}:`, error.message)
}

async function findLeadByLeadgenId(supabase: Db, companyId: string, leadgenId: string) {
  const cols = "id, status, ai_paused, metadata, created_at"
  const { data: byList } = await supabase
    .from("leads").select(cols).eq("company_id", companyId).is("deleted_at", null)
    .contains("metadata", { leadgen_ids: [leadgenId] }).limit(1)
  if (byList?.[0]) return byList[0]
  const { data: byId } = await supabase
    .from("leads").select(cols).eq("company_id", companyId).is("deleted_at", null)
    .eq("metadata->>leadgen_id", leadgenId).limit(1)
  return byId?.[0] ?? null
}

// ── The handler ──────────────────────────────────────────────────────────────

export async function handleLeadgenChange(
  supabase: Db,
  change: LeadgenChange,
  opts: {
    /** Set by retryPendingLeadgen: no automated first message for a lead this old */
    skipOutreach?: boolean
  } = {}
): Promise<LeadgenOutcome> {
  const { leadgen_id, page_id, form_id } = change

  // Company by Page. Two active rows for one Page should not exist; if they do, the most
  // recently saved one wins instead of both silently losing every lead.
  const { data: integrations } = await supabase
    .from("integrations")
    .select("company_id, fb_access_token, fb_selected_form_ids, lead_count, companies(service_type)")
    .eq("fb_page_id", page_id)
    .eq("type", "facebook")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(2)
  const integration = integrations?.[0]
  if (!integration) {
    console.warn(`[leadgen] ${leadgen_id}: no active integration for page ${page_id}, lead not ingested`)
    return "no_integration"
  }
  if ((integrations?.length ?? 0) > 1) {
    console.error(`[leadgen] page ${page_id} is active under more than one company, using ${integration.company_id}`)
  }
  const companyId = integration.company_id as string
  const pageToken = (integration.fb_access_token as string | null) ?? ""

  // Was this exact submission already seen (Meta retry, or a placeholder waiting on a reconnect)?
  const seen = await findLeadByLeadgenId(supabase, companyId, leadgen_id)
  const seenMeta = (seen?.metadata as Record<string, unknown> | null) ?? {}
  const isPendingStub = seenMeta.pending_fetch === true

  // Form selection: an empty selection means "every form on this Page".
  const selected = (integration.fb_selected_form_ids as string[] | null) ?? []
  if (selected.length > 0 && !selected.includes(String(form_id)) && !seen) {
    console.log(`[leadgen] ${leadgen_id}: form ${form_id} is not one of the ${selected.length} selected forms for company ${companyId}, ignored`)
    return "ignored_form"
  }

  // ── Read the submission ────────────────────────────────────────────────────
  let leadRes = await graphGet<Record<string, unknown>>(leadgen_id, { fields: LEAD_FIELDS_FULL }, pageToken)
  if (leadRes.error && leadRes.error.code !== 190) {
    leadRes = await graphGet<Record<string, unknown>>(leadgen_id, { fields: LEAD_FIELDS_MINIMAL }, pageToken)
  }
  const fieldData = leadRes.data?.field_data as LeadgenField[] | undefined

  if (!fieldData) {
    const detail = leadRes.error ? friendlyGraphError(leadRes.error) : "no answers returned"
    console.error(`[leadgen] ${leadgen_id}: COULD NOT READ LEAD from Facebook for company ${companyId} (form ${form_id}): ${leadRes.error?.message ?? "empty field_data"}`)
    if (!seen) {
      await supabase.from("leads").insert({
        company_id: companyId,
        phone: `fbform:${leadgen_id}`,
        source: "facebook",
        channel: "sms",
        source_form_id: form_id,
        status: "needs_attention",
        notes: "A Facebook lead came in, but Facebook would not release the details. Reconnect Facebook under Integrations and this lead fills in automatically.",
        metadata: {
          leadgen_id, leadgen_ids: [leadgen_id], page_id, form_id,
          pending_fetch: true, fetch_error: (leadRes.error?.message ?? "empty").slice(0, 300),
        },
      })
    }
    notifyFacebookBroken(companyId, detail)
    return "pending"
  }

  const formDef = await getFormDefinition(String(form_id), pageToken)
  const mapped = mapLeadgenFields(fieldData, formDef.questions)
  const ad = adInfoFromLeadgen(leadRes.data ?? {}, String(form_id), formDef.name)
  const { phone, psid: formPsid, firstName, lastName } = mapped
  const effectivePhone = phone ?? `fbform:${leadgen_id}`

  if (!phone) {
    console.error(`[leadgen] ${leadgen_id} (form ${form_id}): no phone recognized, lead goes to needs_attention. Keys: ${Object.keys(mapped.fields).join(",")}`)
  }

  // ── Find the person: this submission → their Messenger thread → their phone ─
  type LeadRef = { id: string; status: string }
  let existing: LeadRef | null = seen ? { id: seen.id as string, status: seen.status as string } : null
  if (!existing && formPsid) {
    const { data } = await supabase
      .from("leads").select("id, status")
      .eq("company_id", companyId).eq("messenger_psid", formPsid).is("deleted_at", null).maybeSingle()
    existing = (data as LeadRef | null) ?? null
  }
  if (!existing && phone) {
    const { data } = await supabase
      .from("leads").select("id, status")
      .eq("company_id", companyId).eq("phone", phone).is("deleted_at", null).maybeSingle()
    existing = (data as LeadRef | null) ?? null
  }

  const svc = (Array.isArray(integration.companies) ? integration.companies[0] : integration.companies) as
    { service_type?: string | null } | null
  // FieldBuilt's own sales funnel qualifies on headcount and revenue. Isolated to that one tenant.
  const funnelQual = svc?.service_type === "fieldbuilt_sales" ? qualifyFromFormFields(mapped.fields) : null

  let leadId: string
  let isNewLead = false
  let funnelRejected = false
  const isFirstSightOfSubmission = !seen || isPendingStub

  if (existing) {
    leadId = existing.id
    const { data: cur } = await supabase
      .from("leads")
      .select("phone, email, first_name, last_name, address, zip, job_type, notes, metadata, ai_paused, status")
      .eq("id", leadId).maybeSingle()

    // Opted-out or human-owned leads stay that way: a re-delivered payload or a genuine
    // re-submission must not put them back into automated texting. The answers still merge.
    const paused = !!cur?.ai_paused && !isPendingStub

    const patch: Record<string, unknown> = {}
    const curPhone = String(cur?.phone ?? "")
    if (phone && (!curPhone || curPhone.startsWith("msgr:") || curPhone.startsWith("fbform:"))) patch.phone = phone
    if (mapped.email && !cur?.email) patch.email = mapped.email
    if (firstName && !cur?.first_name) patch.first_name = firstName
    if (lastName && !cur?.last_name) patch.last_name = lastName
    if (mapped.address && !cur?.address) patch.address = mapped.address
    if (mapped.zip && !cur?.zip) patch.zip = mapped.zip
    if (mapped.jobType && !cur?.job_type) patch.job_type = mapped.jobType
    if (formPsid) { patch.messenger_psid = formPsid; patch.channel = "messenger" }
    if (mapped.notes && !(cur?.notes ?? "").includes(mapped.notes)) {
      patch.notes = isPendingStub || !cur?.notes ? mapped.notes : `${cur.notes}\n${mapped.notes}`
    }

    const curMeta = { ...((cur?.metadata as Record<string, unknown> | null) ?? {}) }
    delete curMeta.pending_fetch
    delete curMeta.fetch_error
    const nextMeta = mergeLeadFormMetadata(curMeta, {
      leadgenId: leadgen_id, pageId: page_id, formId: String(form_id),
      formAnswers: mapped.formAnswers, qualification: mapped.qualification, ad, zip: mapped.zip,
    })
    // A name that came from the form is Facebook profile autofill: unverified for booking
    // until the customer states it themselves.
    if ((patch.first_name || cur?.first_name) && !nextMeta.name_source) nextMeta.name_source = "facebook_profile"
    if (!phone && !patch.phone && curPhone.startsWith("fbform:")) nextMeta.phone_missing = true
    patch.metadata = nextMeta

    if (isPendingStub) {
      patch.status = phone || formPsid ? "just_came_in" : "needs_attention"
    } else if (!paused && ["cold", "closed_lost", "lost"].includes(String(cur?.status ?? ""))) {
      patch.status = "just_came_in"
    }
    patch.updated_at = new Date().toISOString()
    await supabase.from("leads").update(patch).eq("id", leadId)

    if (isPendingStub) {
      const leadName = `${firstName ?? ""} ${lastName ?? ""}`.trim()
      notifyNewLead(companyId, leadName, phone ?? "no phone on form, call back needed", "facebook", leadId).catch(() => {})
    }
    if (paused) {
      console.log(`[leadgen] ${leadgen_id}: lead ${leadId} is paused or opted out, answers merged, no outreach`)
      if (isFirstSightOfSubmission) {
        notifyNewLead(companyId, "A paused lead submitted a form again", phone ?? "", "facebook", leadId).catch(() => {})
      }
      await bumpLeadStats(supabase, companyId, integration.lead_count as number | null, isFirstSightOfSubmission)
      return "merged"
    }
  } else {
    isNewLead = true
    funnelRejected = !!funnelQual && !funnelQual.qualified

    const baseMeta = mergeLeadFormMetadata({}, {
      leadgenId: leadgen_id, pageId: page_id, formId: String(form_id),
      formAnswers: mapped.formAnswers, qualification: mapped.qualification, ad, zip: mapped.zip,
    })
    const metadata: Record<string, unknown> = {
      ...baseMeta,
      ...(firstName ? { name_source: "facebook_profile" } : {}),
      ...(phone ? {} : { phone_missing: true, form_keys: Object.keys(mapped.fields) }),
      ...(funnelQual
        ? {
            techs: funnelQual.techs, revenue: funnelQual.revenue, tier: funnelQual.tier, qualified: funnelQual.qualified,
            funnel_qualification_source: funnelQual.undetermined ? "not_asked_on_form" : "from_form",
          }
        : {}),
    }

    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        company_id: companyId,
        phone: effectivePhone,
        first_name: firstName,
        last_name: lastName,
        email: mapped.email,
        // Street and ZIP are separate fields: a bare zip is never an address.
        address: mapped.address,
        zip: mapped.zip,
        source: "facebook",
        channel: formPsid ? "messenger" : "sms",
        ...(formPsid ? { messenger_psid: formPsid } : {}),
        source_form_id: form_id,
        status: funnelRejected ? "unqualified" : phone || formPsid ? "just_came_in" : "needs_attention",
        ...(funnelRejected ? { ai_paused: true } : {}),
        notes: mapped.notes,
        metadata,
        job_type: mapped.jobType,
      })
      .select("id")
      .single()

    if (insertError || !newLead) {
      console.error(`[leadgen] ${leadgen_id}: lead insert FAILED for company ${companyId}:`, insertError?.message)
      notifyNeedsAttention(companyId, "A Facebook lead could not be saved. Check the lead in Meta Leads Center", phone ?? "").catch(() => {})
      return "failed"
    }
    leadId = newLead.id as string

    const leadName = `${firstName ?? ""} ${lastName ?? ""}`.trim()
    notifyNewLead(companyId, leadName, phone ?? "no phone on form, call back needed", "facebook", leadId).catch(() => {})
  }

  await bumpLeadStats(supabase, companyId, integration.lead_count as number | null, isFirstSightOfSubmission)
  const outcome: LeadgenOutcome = isNewLead ? "created" : "merged"

  // Not a fit per the form's own answers (FieldBuilt's funnel): the record stands, the AI stays out.
  if (funnelRejected) {
    console.log(`[leadgen] lead ${leadId} unqualified by form answers, AI not engaged`)
    return outcome
  }

  // A recovered lead that is already old gets a person, not a robot opener days late.
  if (opts.skipOutreach) {
    await supabase.from("leads").update({ status: "needs_attention" }).eq("id", leadId)
    return outcome
  }

  // No real phone and no Messenger thread: nothing to send on. The lead exists and the owner was told.
  if (!phone && !formPsid) return outcome

  // Once a lead has ANY outbound message, a re-delivered event only refreshes the record.
  if (!isNewLead) {
    const { count: outboundCount } = await supabase
      .from("conversations").select("*", { count: "exact", head: true })
      .eq("lead_id", leadId).eq("direction", "outbound")
    if ((outboundCount ?? 0) > 0) return outcome
  }

  // ── Messenger first: answer in the thread they are already in ───────────────
  if (formPsid && pageToken) {
    try {
      // "Never leave the mouth on with the ears off": without the `messages` subscription
      // the agent cannot hear a reply, so it must not open either.
      try {
        const subRes = await fetch(`${GRAPH}/${page_id}/subscribed_apps?access_token=${pageToken}`).then((r) => r.json())
        const subFields: string[] = subRes?.data?.[0]?.subscribed_fields ?? []
        if (!subFields.includes("messages")) {
          await supabase.from("leads").update({ ai_paused: true }).eq("id", leadId)
          notifyNeedsAttention(companyId,
            `${firstName ?? "Messenger lead"} completed the questionnaire but the Messenger agent is OFF. Reply from the Page inbox within 24h`,
            phone ?? "", leadId).catch(() => {})
          console.log(`[leadgen] ${leadgen_id}: messenger agent OFF (no messages subscription), lead paused for the office`)
          return outcome
        }
      } catch { /* subscription check unavailable: treat the agent as ON rather than silently dropping openers */ }

      const { importMessengerHistory, sendMessengerMessage } = await import("@/lib/messenger")
      // Import once only: a redelivered webhook must not duplicate the thread.
      const { count: haveRows } = await supabase
        .from("conversations").select("*", { count: "exact", head: true }).eq("lead_id", leadId)
      const { humanOwned } = (haveRows ?? 0) > 0
        ? { humanOwned: false }
        : await importMessengerHistory(supabase, leadId, companyId, pageToken, page_id, formPsid, "__leadgen_no_trigger_msg__")
      if (humanOwned) {
        const { data: upcoming } = await supabase.from("appointments")
          .select("id").eq("lead_id", leadId).eq("status", "scheduled")
          .gt("scheduled_at", new Date().toISOString()).limit(1)
        await supabase.from("leads")
          .update({ ai_paused: true, ...((upcoming ?? []).length > 0 ? {} : { status: "needs_attention" }) })
          .eq("id", leadId)
        notifyNeedsAttention(companyId,
          `${firstName ?? "Messenger lead"} completed the form but a team member is already in that thread. AI holding back`,
          phone ?? "", leadId).catch(() => {})
        console.log(`[leadgen] ${leadgen_id}: thread human-owned, AI not engaging`)
        return outcome
      }

      // Never talk over ourselves: if the AI already replied in this thread, stay quiet.
      const { count: aiSaid } = await supabase
        .from("conversations").select("*", { count: "exact", head: true })
        .eq("lead_id", leadId).eq("direction", "outbound").eq("sent_by", "ai")
      if ((aiSaid ?? 0) > 0) {
        console.log(`[leadgen] ${leadgen_id}: AI already active in thread, no duplicate opener`)
        return outcome
      }

      const { officeCoversNowForCompany } = await import("@/lib/office-hours")
      if (await officeCoversNowForCompany(companyId)) {
        console.log(`[leadgen] ${leadgen_id}: office hours, opener left to the office (night sweep covers it if unanswered)`)
        return outcome
      }

      const result = await processAndSave(leadId, companyId, null, undefined, messengerFormAngle(mapped), "messenger")
      if (result.response && !result.silent) {
        const sent = await sendMessengerMessage(pageToken, formPsid, result.response)
        if (!sent.ok) {
          // Remove the row that never went out so the thread does not show an unsent message.
          if (result.outboundConversationId) await supabase.from("conversations").delete().eq("id", result.outboundConversationId)
          throw new Error(sent.error ?? "messenger send failed")
        }
        if (result.outboundConversationId && sent.messageId) {
          await supabase.from("conversations").update({ twilio_sid: sent.messageId }).eq("id", result.outboundConversationId)
        }
        await supabase.from("leads")
          .update({ status: "contacted", last_message_at: new Date().toISOString() })
          .eq("id", leadId)
        // The same nurture the SMS path gets: without it a Messenger lead who never
        // replied to the opener was never followed up.
        await seedNoReplySequence(supabase, leadId, companyId)
        console.log(`[leadgen] ${leadgen_id}: AI opener sent on Messenger to psid ${formPsid}`)
      }
      return outcome
    } catch (err) {
      console.error(`[leadgen] ${leadgen_id}: Messenger opener failed, falling back to SMS:`, err)
    }
  }

  // ── SMS opener ─────────────────────────────────────────────────────────────
  if (!phone) return outcome
  const { data: phoneRows } = await supabase
    .from("phone_numbers").select("phone_number")
    .eq("company_id", companyId).eq("is_active", true).limit(1)
  const fromNumber = (phoneRows?.[0]?.phone_number as string | undefined) ?? null

  if (!fromNumber) {
    // The lead is in the CRM, but nothing can text them. Flag it for a person, once:
    // a redelivered event must not undo what someone did with the lead since, or ping again.
    console.error(`[leadgen] ${leadgen_id}: company ${companyId} has NO active phone number, lead ${leadId} cannot be texted`)
    if (isFirstSightOfSubmission) {
      const { data: cur } = await supabase.from("leads").select("metadata").eq("id", leadId).maybeSingle()
      await supabase.from("leads").update({
        status: "needs_attention",
        metadata: { ...((cur?.metadata as Record<string, unknown> | null) ?? {}), outreach_blocked: "no_phone_number" },
      }).eq("id", leadId)
      notifyNeedsAttention(companyId, `${firstName ?? "A Facebook lead"} came in but this account has no texting number yet. Call them`, phone, leadId).catch(() => {})
    }
    return outcome
  }

  try {
    const { officeCoversNowForCompany } = await import("@/lib/office-hours")
    if (await officeCoversNowForCompany(companyId)) {
      console.log(`[leadgen] ${leadgen_id}: office hours, SMS opener left to the office`)
      return outcome
    }
    const result = await processAndSave(leadId, companyId, null)
    if (result.response) {
      // The company's own transport (GoHighLevel when connected, then Twilio) so the
      // opener and every later message come from ONE number.
      const { sid } = await sendToLead({ id: leadId, phone, channel: "sms" }, result.response, fromNumber, companyId)
      if (result.outboundConversationId) {
        await supabase.from("conversations").update({ twilio_sid: sid }).eq("id", result.outboundConversationId)
      }
      await supabase.from("leads")
        .update({ status: "contacted", last_message_at: new Date().toISOString() })
        .eq("id", leadId)
    }
  } catch (e) {
    console.error(`[leadgen] ${leadgen_id}: AI/SMS opener failed for lead ${leadId}:`, e)
  }
  // Always seed the follow-ups, even when the opener failed: the next step retries the reach.
  await seedNoReplySequence(supabase, leadId, companyId)
  return outcome
}

async function bumpLeadStats(supabase: Db, companyId: string, currentCount: number | null, countIt: boolean): Promise<void> {
  const patch: Record<string, unknown> = { last_lead_at: new Date().toISOString() }
  if (countIt) patch.lead_count = (currentCount ?? 0) + 1
  await supabase.from("integrations").update(patch).eq("company_id", companyId).eq("type", "facebook")
}

/**
 * After Facebook is reconnected: fill in every placeholder lead whose details
 * Facebook refused earlier. Leads under 48 hours old get the normal first message;
 * older ones are completed and left for a person.
 */
export async function retryPendingLeadgen(
  companyId: string,
  supabase: Db = createServiceRoleClient()
): Promise<{ recovered: number; stillPending: number }> {
  const { data: stubs } = await supabase
    .from("leads")
    .select("id, created_at, metadata")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .contains("metadata", { pending_fetch: true })
    .order("created_at", { ascending: true })
    .limit(50)

  let recovered = 0
  let stillPending = 0
  for (const stub of (stubs ?? []) as Array<{ id: string; created_at: string; metadata: Record<string, unknown> | null }>) {
    const meta = stub.metadata ?? {}
    const leadgen_id = typeof meta.leadgen_id === "string" ? meta.leadgen_id : null
    const page_id = typeof meta.page_id === "string" ? meta.page_id : null
    const form_id = typeof meta.form_id === "string" ? meta.form_id : null
    if (!leadgen_id || !page_id || !form_id) continue
    const ageMs = Date.now() - new Date(stub.created_at).getTime()
    try {
      const outcome = await handleLeadgenChange(supabase, { leadgen_id, page_id, form_id }, { skipOutreach: ageMs > 48 * 60 * 60 * 1000 })
      if (outcome === "merged" || outcome === "created") recovered++
      else stillPending++
    } catch (err) {
      console.error(`[leadgen] retry failed for placeholder lead ${stub.id}:`, err)
      stillPending++
    }
  }
  if (recovered > 0 || stillPending > 0) {
    console.log(`[leadgen] reconnect retry for company ${companyId}: ${recovered} recovered, ${stillPending} still pending`)
  }
  return { recovered, stillPending }
}
