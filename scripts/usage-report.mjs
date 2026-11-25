#!/usr/bin/env node
// Dev tool. Usage: node scripts/usage-report.mjs <railway-log-file> [--reply-window=120]
// Parses every "[claude-usage] {...}" line and prints cost breakdowns.
import fs from "node:fs";

const file = process.argv[2];
const winArg = process.argv.find((a) => a.startsWith("--reply-window="));
const WINDOW_MS = (winArg ? Number(winArg.split("=")[1]) : 120) * 1000;
if (!file) { console.error("usage: node scripts/usage-report.mjs <logfile> [--reply-window=seconds]"); process.exit(1); }

const TS = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/;
const rows = [];
let bad = 0, seq = 0;
for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  const i = line.indexOf("[claude-usage] ");
  if (i < 0) continue;
  const rest = line.slice(i + "[claude-usage] ".length).trim();
  if (rest.startsWith("TOTAL")) continue;
  try {
    const r = JSON.parse(rest);
    const m = line.slice(0, i).match(TS);
    r.t = m ? Date.parse(m[1].includes("T") ? m[1] : m[1].replace(" ", "T") + "Z") : NaN;
    r.seq = seq++;
    rows.push(r);
  } catch { bad++; }
}
if (!rows.length) { console.log("No [claude-usage] lines found."); process.exit(0); }

const $ = (n) => "$" + n.toFixed(4);
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const tok = (r) => (r.input_tokens ?? 0) + (r.cache_creation_input_tokens ?? 0) + (r.cache_read_input_tokens ?? 0) + (r.output_tokens ?? 0);
const hit = (a) => {
  const read = sum(a, (r) => r.cache_read_input_tokens ?? 0);
  const den = read + sum(a, (r) => r.cache_creation_input_tokens ?? 0) + sum(a, (r) => r.input_tokens ?? 0);
  return den ? (100 * read) / den : 0;
};
const group = (a, key) => a.reduce((m, r) => { const k = key(r); (m[k] ||= []).push(r); return m; }, {});
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

console.log(`\nTOTAL: ${rows.length} calls, ${$(sum(rows, (r) => r.est_cost_usd ?? 0))}` + (bad ? `  (${bad} unparseable lines skipped)` : ""));

console.log("\nPER SITE");
console.log(pad("site", 26) + rpad("calls", 7) + rpad("avg tok", 9) + rpad("hit%", 7) + rpad("cost", 11));
for (const [site, a] of Object.entries(group(rows, (r) => r.site)).sort((x, y) => sum(y[1], (r) => r.est_cost_usd) - sum(x[1], (r) => r.est_cost_usd)))
  console.log(pad(site, 26) + rpad(a.length, 7) + rpad(Math.round(sum(a, tok) / a.length), 9) + rpad(hit(a).toFixed(1), 7) + rpad($(sum(a, (r) => r.est_cost_usd ?? 0)), 11));

// A "lead reply" = consecutive calls for one lead where each is within the window of the previous one.
const replies = [];
for (const [lead, a] of Object.entries(group(rows.filter((r) => r.leadId), (r) => r.leadId))) {
  a.sort((x, y) => (x.t - y.t) || (x.seq - y.seq));
  let cur = null;
  for (const r of a) {
    if (cur && Number.isFinite(r.t) && r.t - cur.last <= WINDOW_MS) { cur.calls.push(r); cur.last = r.t; }
    else { cur = { lead, calls: [r], last: r.t }; replies.push(cur); }
  }
}
const rc = replies.map((x) => sum(x.calls, (r) => r.est_cost_usd ?? 0));
if (replies.length) {
  const sorted = [...rc].sort((a, b) => a - b);
  console.log(`\nCOST PER LEAD REPLY (leadId + ${WINDOW_MS / 1000}s window): ${replies.length} replies, avg ${$(sum(rc, (x) => x) / rc.length)}, median ${$(sorted[Math.floor(sorted.length / 2)])}, max ${$(sorted[sorted.length - 1])}, avg calls/reply ${(sum(replies, (x) => x.calls.length) / replies.length).toFixed(2)}`);
}
const noLead = rows.filter((r) => !r.leadId);
if (noLead.length) console.log(`(${noLead.length} calls without a leadId, ${$(sum(noLead, (r) => r.est_cost_usd ?? 0))}, excluded from the reply/lead views)`);

console.log("\nPER COMPANY (for billing)");
for (const [c, a] of Object.entries(group(rows, (r) => r.companyId ?? "(none)")).sort((x, y) => sum(y[1], (r) => r.est_cost_usd) - sum(x[1], (r) => r.est_cost_usd)))
  console.log(pad(c, 40) + rpad(a.length, 7) + " calls" + rpad($(sum(a, (r) => r.est_cost_usd ?? 0)), 11));

console.log("\nTOP 10 MOST EXPENSIVE LEADS");
const leads = Object.entries(group(rows.filter((r) => r.leadId), (r) => r.leadId))
  .map(([id, a]) => ({ id, a, cost: sum(a, (r) => r.est_cost_usd ?? 0) })).sort((x, y) => y.cost - x.cost).slice(0, 10);
for (const l of leads) console.log(pad(l.id, 40) + rpad(l.a.length, 5) + " calls" + rpad($(l.cost), 11) + "  " + pad("", 2) + (l.a[0].companyId ?? ""));
console.log();
