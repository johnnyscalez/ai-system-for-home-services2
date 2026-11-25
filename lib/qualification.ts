// The qualification gate.
//
// The owner picks qualifying questions at onboarding and marks some of them
// "must answer before booking". The prompt asks the assistant to cover them, but
// a prompt only lowers the odds. This file is the promise: before the engine
// offers times or books a visit it calls ensureRequiredAnswers, and if a required
// answer is missing the booking does not happen and the missing question is asked
// instead. Answers live on the lead at metadata.qualification[key].
//
// Answers reach the lead three ways, and all three count:
//   1. the assistant saves them as it hears them (update_lead_details.answers)
//   2. a lead form or webhook already carried them (mapped at ingestion)
//   3. the extractor below reads the conversation when the first two missed one
//      (the assistant heard the answer and did not save it)

import { anthropic } from "@/lib/claude"
import { logUsage } from "@/lib/usage-log"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any Supabase client flavour
type Db = { from: (table: string) => any }

export type RuntimeQuestion = { key: string; question: string; required: boolean }

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "question"

/** ai_agent_config.qualifying_questions in any shape it has been stored in. */
export function parseRuntimeQuestions(raw: unknown): RuntimeQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: RuntimeQuestion[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    let question = ""
    let key = ""
    let required = false
    if (typeof item === "string") {
      question = item
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>
      question = typeof o.question === "string" ? o.question : ""
      key = typeof o.key === "string" ? o.key : ""
      // Only an explicit true enforces. Rows written before the gate existed
      // carry no flag and stay advisory, exactly as they behaved before.
      required = o.required === true
    }
    question = question.trim()
    if (!question) continue
    key = slug(key || question)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, question, required })
  }
  return out
}

export function leadAnswers(metadata: unknown): Record<string, string> {
  const meta = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>
  const q = (meta.qualification && typeof meta.qualification === "object" ? meta.qualification : {}) as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) {
    const s = typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? String(v) : ""
    if (s) out[k] = s
  }
  return out
}

/** Answers the lead record already implies without a qualification entry. */
function impliedAnswers(lead: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  const jobType = typeof lead.job_type === "string" ? lead.job_type.trim() : ""
  if (jobType) out.project_type = jobType.replace(/_/g, " ")
  return out
}

export function missingRequired(questions: RuntimeQuestion[], answers: Record<string, string>): RuntimeQuestion[] {
  return questions.filter((q) => q.required && !answers[q.key]?.trim())
}

/** Merge answers into leads.metadata.qualification without touching other metadata. */
export async function saveLeadAnswers(db: Db, leadId: string, answers: Record<string, string>): Promise<void> {
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(answers)) {
    const key = slug(k)
    const val = (v ?? "").toString().trim().slice(0, 300)
    if (key && val) clean[key] = val
  }
  if (Object.keys(clean).length === 0) return
  const { data } = await db.from("leads").select("metadata").eq("id", leadId).maybeSingle()
  const meta = ((data?.metadata ?? {}) as Record<string, unknown>) ?? {}
  const prev = (meta.qualification && typeof meta.qualification === "object" ? meta.qualification : {}) as Record<string, unknown>
  await db.from("leads").update({ metadata: { ...meta, qualification: { ...prev, ...clean } } }).eq("id", leadId)
}

/**
 * Reads the conversation for answers the assistant heard but did not save.
 * Returns only answers the lead actually gave: a question that was asked and
 * dodged stays unanswered.
 */
async function extractAnswers(
  questions: RuntimeQuestion[],
  transcript: string,
  formContext: string,
  ids: { companyId: string; leadId: string }
): Promise<Record<string, string>> {
  if (questions.length === 0 || (!transcript.trim() && !formContext.trim())) return {}
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content:
`A contractor's assistant is texting with a homeowner. For each question below, find the homeowner's answer in the form answers or the conversation.

Rules:
- Use only what the homeowner (or their form) actually said. Never guess, never infer from silence.
- If the question was not answered, or the homeowner dodged it, the value is null.
- Keep each answer short, in the homeowner's own words where possible ("about 800 sq ft, kitchen and living room", "yes, we own it", "next month").

Questions (key: question):
${questions.map((q) => `${q.key}: ${q.question}`).join("\n")}

Form answers:
${formContext.trim() || "(none)"}

Conversation:
${transcript.trim() || "(none)"}

Reply with ONLY a JSON object mapping each key to the answer string or null.`,
      }],
    })
    logUsage({ site: "qualification-extract", companyId: ids.companyId, leadId: ids.leadId, model: "claude-haiku-4-5-20251001", usage: res.usage })
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("")
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return {}
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const q of questions) {
      const v = parsed[q.key]
      if (typeof v === "string" && v.trim() && !/^(null|none|unknown|n\/?a|not (answered|provided|stated))$/i.test(v.trim())) {
        out[q.key] = v.trim()
      }
    }
    return out
  } catch (err) {
    console.error("[qualification] answer extraction failed:", err)
    return {}
  }
}

export type GateResult = {
  questions: RuntimeQuestion[]
  answers: Record<string, string>
  /** Required questions still unanswered after reading the form and the thread */
  missing: RuntimeQuestion[]
}

/**
 * The gate. Loads the company's questions and the lead's answers, runs the
 * extractor once if a required answer is missing, saves what it found, and
 * reports what is still missing. `pendingInbound` is the message being answered
 * right now when it has not been written to the thread yet.
 */
export async function ensureRequiredAnswers(
  db: Db,
  leadId: string,
  companyId: string,
  pendingInbound?: string | null
): Promise<GateResult> {
  const [{ data: cfg }, { data: lead }] = await Promise.all([
    db.from("ai_agent_config").select("qualifying_questions").eq("company_id", companyId).maybeSingle(),
    db.from("leads").select("metadata, job_type, notes").eq("id", leadId).maybeSingle(),
  ])
  const questions = parseRuntimeQuestions(cfg?.qualifying_questions)
  let answers = { ...impliedAnswers((lead ?? {}) as Record<string, unknown>), ...leadAnswers(lead?.metadata) }
  let missing = missingRequired(questions, answers)
  if (missing.length === 0) return { questions, answers, missing }

  const { data: rows } = await db
    .from("conversations").select("direction, body")
    .eq("lead_id", leadId).or("channel.is.null,channel.neq.voice")
    .order("created_at", { ascending: true }).limit(60)
  const lines = ((rows ?? []) as Array<{ direction: string; body: string }>)
    .map((m) => `${m.direction === "inbound" ? "Homeowner" : "Assistant"}: ${m.body}`)
  if (pendingInbound?.trim() && !lines.some((l) => l === `Homeowner: ${pendingInbound}`)) {
    lines.push(`Homeowner: ${pendingInbound}`)
  }
  const meta = ((lead?.metadata ?? {}) as Record<string, unknown>) ?? {}
  const form = (meta.form_answers && typeof meta.form_answers === "object" ? meta.form_answers : {}) as Record<string, unknown>
  const formContext = [
    ...Object.entries(form).map(([k, v]) => `${k}: ${String(v)}`),
    lead?.notes ? `Notes: ${lead.notes}` : "",
  ].filter(Boolean).join("\n")

  const found = await extractAnswers(missing, lines.join("\n"), formContext, { companyId, leadId })
  if (Object.keys(found).length > 0) {
    await saveLeadAnswers(db, leadId, found)
    answers = { ...answers, ...found }
    missing = missingRequired(questions, answers)
  }
  return { questions, answers, missing }
}

/**
 * Does anything this lead said clearly match what the company does not book?
 * UNQUALIFIED only on a plainly stated disqualifying fact. Anything unclear is
 * "unknown", which never blocks a booking.
 */
export async function qualificationVerdict(opts: {
  disqualifiers: string | null
  answers: Record<string, string>
  transcript: string
  trade: string
  companyId?: string
  leadId?: string
}): Promise<{ verdict: "qualified" | "unqualified" | "unknown"; reason: string }> {
  const rules = opts.disqualifiers?.trim()
  if (!rules) return { verdict: "qualified", reason: "no disqualifiers configured" }
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{
        role: "user",
        content:
`A ${opts.trade} company only books in-home visits for leads who fit. Decide whether this homeowner clearly matches something the company does NOT book.

What the company does not book:
${rules}

What the homeowner told us:
${Object.entries(opts.answers).map(([k, v]) => `${k}: ${v}`).join("\n") || "(no structured answers)"}

Conversation:
${opts.transcript || "(none)"}

Answer UNQUALIFIED only when the homeowner plainly stated a fact that matches a rule above (for example "I rent" when renters are excluded). If it is unclear, missing, or merely possible, answer UNKNOWN. If they clearly fit, answer QUALIFIED.

Reply as: VERDICT | one short reason`,
      }],
    })
    logUsage({ site: "qualification-verdict", companyId: opts.companyId, leadId: opts.leadId, model: "claude-haiku-4-5-20251001", usage: res.usage })
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim()
    const [head, ...rest] = text.split("|")
    const v = head.trim().toUpperCase()
    const reason = rest.join("|").trim().slice(0, 200)
    if (v.startsWith("UNQUALIFIED")) return { verdict: "unqualified", reason }
    if (v.startsWith("QUALIFIED")) return { verdict: "qualified", reason }
    return { verdict: "unknown", reason }
  } catch (err) {
    console.error("[qualification] verdict failed:", err)
    return { verdict: "unknown", reason: "verdict check failed" }
  }
}

/** The prompt block. Says what to ask, what is required, and how to save answers. */
export function buildQualificationBlock(
  disqualifiers: string | null,
  questions: RuntimeQuestion[] | string[] = [],
  answers: Record<string, string> = {}
): string {
  const qs: RuntimeQuestion[] = (questions as Array<RuntimeQuestion | string>).map((q) =>
    typeof q === "string" ? { key: slug(q), question: q, required: false } : q
  )
  const anyRequired = qs.some((q) => q.required)
  const questionsBlock = qs.length > 0
    ? `
QUALIFYING QUESTIONS (key | question | status):
${qs.map((q) => `- ${q.key} | ${q.question} | ${answers[q.key] ? `ANSWERED: ${answers[q.key]}` : q.required ? "REQUIRED, not answered yet" : "optional, not answered yet"}`).join("\n")}

How to use them:
- Ask one at a time, in your own words, in the order that fits the conversation. Never ask one that is already ANSWERED, and treat anything the lead or their form already said as answered.
- The moment the lead answers one, save it with update_lead_details, passing answers: [{ key, answer }] with the key exactly as written above. An answer that is not saved does not count.
${anyRequired
  ? "- Every REQUIRED question must be answered before you check availability or book. The system enforces this: if you try to offer times or book while a required answer is missing, the booking is refused and the lead is asked that question instead. So ask them first."
  : "- Cover the ones that matter for this lead before you move to booking."}
- The lead's location (zip code, then the full street address) is always needed before a visit can be booked.
`
    : ""

  if (!disqualifiers?.trim()) {
    return `=== QUALIFICATION RULES ===
Every lead starts unqualified. Your job is to qualify them through natural conversation.
${questionsBlock}
WHO QUALIFIES: Any lead who is interested, reachable, owns the property (or has authority to approve the work), and whose project is inside the service area and the work the company does.

WHEN TO CALL update_lead_status "qualified":
- The qualifying questions above are answered and nothing disqualifies them
- Call it in the same response as you move toward booking, not after booking

WHEN TO CALL update_lead_status "closed_lost":
- They explicitly say they're not interested or already chose someone else
=== END QUALIFICATION RULES ===`
  }

  return `=== QUALIFICATION RULES ===
This company has defined who they do NOT want to book. Read this carefully: it defines what "qualified" means for every lead you talk to.
${questionsBlock}
WHO NOT TO BOOK:
${disqualifiers.trim()}

DURING DISCOVERY:
Use the qualifying questions to find out, in normal conversation, whether any rule above applies. Do not interrogate.

ONCE THEY QUALIFY (the questions are answered and no rule applies):
→ Call update_lead_status "qualified" in that same response, then move to booking.

IF A RULE APPLIES:
→ Call update_lead_status "closed_lost". Be polite and brief: thank them, say this one is outside what the company takes on, and stop. Never book a lead a rule excludes.
=== END QUALIFICATION RULES ===`
}
