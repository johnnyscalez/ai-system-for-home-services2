#!/usr/bin/env node
// Dev tool (not in the production bundle). Prints chars and estimated tokens (chars/4) per
// system-prompt block, ranked by size. Read-only: one SELECT per table, no Claude calls.
// Run: npx tsx --env-file=.env.local scripts/measure-prompt.mjs [companyId] [jobType]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { kbValue } from "../lib/kb-utils.ts";
import { getConversationFlow } from "../lib/conversation-flows.ts";
import { buildQualificationBlock } from "../lib/ai-engine.ts";
import { buildTechnicianContextBlock } from "../lib/technician-booking.ts";

const companyId = process.argv[2] ?? "bc9fb131-2af2-4c31-8d79-f46bb9663e60";
const jobType = process.argv[3] ?? null;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Text blocks with no interpolation live inline in the engines; pull them from source so nothing is duplicated.
const grab = (file, re) => (fs.readFileSync(file, "utf8").match(re) ?? [])[1] ?? "";
const reasoning = grab("lib/ai-engine.ts", /const reasoningBlock = `([\s\S]*?)`\n\n  const smsHardRules/);
const smsRules = grab("lib/ai-engine.ts", /const smsHardRules = `([\s\S]*?)`\n\n  \/\/ Channel-specific/);
const voiceRules = grab("lib/voice-engine.ts", /const VOICE_RULES = `([\s\S]*?)`\n/);
const toolsSrc = grab("lib/ai-engine.ts", /(const TOOLS[\s\S]*?\n\]\n)/);
const voiceToolsSrc = grab("lib/voice-engine.ts", /(const TOOLS[\s\S]*?\n\]\n)/);

const [{ data: agent }, { data: kb }, { data: company }, { data: techs }] = await Promise.all([
  db.from("ai_agent_config").select("generated_system_prompt, disqualifiers, qualifying_questions, messenger_instructions").eq("company_id", companyId).single(),
  db.from("knowledge_base").select("custom_ai_knowledge, financing_options, pricing_info").eq("company_id", companyId).single(),
  db.from("companies").select("service_type").eq("id", companyId).single(),
  db.from("technicians").select("*").eq("company_id", companyId).order("name"),
]);

const qs = Array.isArray(agent?.qualifying_questions) ? agent.qualifying_questions.map((q) => q.question) : [];
const rows = [
  ["base system prompt (generated_system_prompt)", "STATIC", agent?.generated_system_prompt ?? ""],
  ["financing block", "STATIC", kbValue(kb?.financing_options) ?? ""],
  ["pricing policy (raw pricing_info + fixed rules ~1.9k chars)", "STATIC", (kb?.pricing_info ?? "") + "x".repeat(1900)],
  ["custom knowledge", "STATIC", kbValue(kb?.custom_ai_knowledge) ?? ""],
  [`conversation flow (${company?.service_type}/${jobType ?? "job type unknown"})`, "STATIC per job type", getConversationFlow(company?.service_type, jobType)],
  ["qualification block", "STATIC", buildQualificationBlock(agent?.disqualifiers ?? null, qs)],
  ["technician context", "STATIC (roster edits)", buildTechnicianContextBlock(techs ?? [])],
  ["messenger instructions (messenger only)", "STATIC", kbValue(agent?.messenger_instructions) ?? ""],
  ["reasoningBlock", "FIXED text, sits in dynamicTail today", reasoning],
  ["smsHardRules", "FIXED text, sits in dynamicTail today", smsRules],
  ["tools array (sent every call; source text, upper bound)", "STATIC", toolsSrc],
  ["slotsBlock", "PER MESSAGE", "(not measurable offline)"],
  ["leadContext", "PER MESSAGE", "(not measurable offline)"],
];
const voiceRows = [
  ["VOICE_RULES", "STATIC", voiceRules],
  ["voice tools array (source text)", "STATIC", voiceToolsSrc],
];
const show = (title, r) => {
  const m = r.filter((x) => x[2] && !x[2].startsWith("(")).map(([n, k, t]) => ({ n, k, c: t.length, t: Math.round(t.length / 4) })).sort((a, b) => b.c - a.c);
  const tot = m.reduce((s, x) => s + x.t, 0);
  console.log(`\n${title}  (total ~${tot} tokens)`);
  for (const x of m) console.log(`${String(x.c).padStart(7)} chars ${String(x.t).padStart(6)} tok ${String(Math.round((100 * x.t) / tot)).padStart(3)}%  ${x.n}  [${x.k}]`);
  for (const x of r.filter((y) => y[2].startsWith("("))) console.log(`      -  ${x[0]} ${x[2]}  [${x[1]}]`);
};
console.log(`company ${companyId}`);
show("SMS / MESSENGER", rows);
show("VOICE (fixed parts; voice also adds jobKnowledge, agentPrompt, history, per call)", voiceRows);
