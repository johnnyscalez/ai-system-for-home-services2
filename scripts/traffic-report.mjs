#!/usr/bin/env node
// Reads the first-party traffic we collect in public.site_events and prints a
// report: who landed, where they came from, and how far they got.
//
// Run: node --env-file=.env.local scripts/traffic-report.mjs [options]
//   --days=N            window length, default 7
//   --since=YYYY-MM-DD  explicit start instead of --days
//   --path=/book        restrict every section to one page
//   --include-bots      count rows flagged as crawlers
//   --include-internal  count rows from TRACKING_EXCLUDE_IPS
//
// Bots and our own machines are excluded by default. That is the whole point:
// Railway's edge logs count every scraper, and on 2026-11-04 they outnumbered
// the humans on /book roughly five to one.

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with: node --env-file=.env.local scripts/traffic-report.mjs");
  process.exit(1);
}

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const days = Number(arg("days", 7));
const sinceArg = arg("since", null);
const since = sinceArg
  ? new Date(`${sinceArg}T00:00:00Z`)
  : new Date(Date.now() - days * 86400_000);
const onlyPath = arg("path", null);
const includeBots = flag("include-bots");
const includeInternal = flag("include-internal");

// ── fetch ───────────────────────────────────────────────────────────────────
async function fetchAll() {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const qs = new URLSearchParams({
      select: "*",
      created_at: `gte.${since.toISOString()}`,
      order: "created_at.asc",
    });
    if (onlyPath) qs.set("path", `eq.${onlyPath}`);
    const res = await fetch(`${URL_BASE}/rest/v1/site_events?${qs}`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404 || body.includes("site_events")) {
        console.error(`\nCould not read public.site_events (HTTP ${res.status}).`);
        console.error(body.slice(0, 300));
        console.error("\nIf the table does not exist yet, run this in the Supabase SQL editor:");
        console.error("  supabase/migrations/20261105000000_site_events.sql\n");
        process.exit(1);
      }
      console.error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      process.exit(1);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(0)}%` : "—");

// visitor_id when storage worked, the hashed IP when it did not, so a blocked
// localStorage degrades to coarser grouping instead of inflating the count.
const who = (r) => r.visitor_id || (r.ip_hash ? `ip:${r.ip_hash}` : null);
const sess = (r) => r.session_id || (r.ip_hash ? `ip:${r.ip_hash}:${r.created_at.slice(0, 13)}` : null);

const uniq = (rows, fn) => new Set(rows.map(fn).filter(Boolean)).size;

function table(title, counts, { total = null, limit = 15 } = {}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  console.log(`\n${title}`);
  console.log("─".repeat(62));
  if (!entries.length) {
    console.log("  (nothing)");
    return;
  }
  const w = Math.max(...entries.map(([k]) => String(k).length), 10);
  for (const [k, v] of entries) {
    const share = total ? `  ${rpad(pct(v, total), 4)}` : "";
    console.log(`  ${pad(k, w)}  ${rpad(v, 5)}${share}`);
  }
}

function tally(rows, fn) {
  const out = {};
  for (const r of rows) {
    const k = fn(r);
    if (k == null || k === "") continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// Sessions that reached each named stage, in order, so each line is a subset
// of the one above it rather than an independent count.
function funnel(title, rows, stages) {
  console.log(`\n${title}`);
  console.log("─".repeat(62));
  let first = null;
  for (const [label, test] of stages) {
    const n = uniq(rows.filter(test), sess);
    if (first === null) first = n;
    const bar = "█".repeat(first ? Math.round((28 * n) / first) : 0);
    console.log(`  ${pad(label, 26)} ${rpad(n, 5)}  ${rpad(pct(n, first), 4)}  ${bar}`);
  }
  if (!first) console.log("  (no sessions yet)");
}

// ── report ──────────────────────────────────────────────────────────────────
const all = await fetchAll();
const bots = all.filter((r) => r.is_bot).length;
const internal = all.filter((r) => r.is_internal).length;

let rows = all;
if (!includeBots) rows = rows.filter((r) => !r.is_bot);
if (!includeInternal) rows = rows.filter((r) => !r.is_internal);

const views = rows.filter((r) => r.event === "page_view");

console.log("\n" + "═".repeat(62));
console.log("  FIELDBUILT TRAFFIC");
console.log(`  ${since.toISOString().slice(0, 16).replace("T", " ")} UTC → now${onlyPath ? `   path: ${onlyPath}` : ""}`);
console.log("═".repeat(62));

if (!all.length) {
  console.log("\nNo events in this window yet.\n");
  process.exit(0);
}

console.log(`\n  Page views          ${views.length}`);
console.log(`  Unique visitors     ${uniq(views, who)}`);
console.log(`  Sessions            ${uniq(views, sess)}`);
console.log(`  Events of all kinds ${rows.length}`);
console.log(
  `  Excluded            ${bots} bot, ${internal} internal` +
    (includeBots || includeInternal ? "  (included by flag)" : "")
);

table("PAGES  (views)", tally(views, (r) => r.path), { total: views.length });

const visitorsByPath = {};
for (const path of new Set(views.map((r) => r.path))) {
  visitorsByPath[path] = uniq(views.filter((r) => r.path === path), who);
}
table("PAGES  (unique visitors)", visitorsByPath);

table(
  "SOURCE",
  tally(views, (r) => {
    if (r.utm_source) return `utm: ${r.utm_source}${r.utm_medium ? ` / ${r.utm_medium}` : ""}`;
    if (r.click_id) return "paid click (fbclid/gclid)";
    if (r.referrer) {
      try {
        return `ref: ${new URL(r.referrer).host}`;
      } catch {
        return "ref: (unparseable)";
      }
    }
    return "direct / unknown";
  }),
  { total: views.length }
);

table("CAMPAIGN", tally(views, (r) => r.utm_campaign));
table("DEVICE", tally(views, (r) => r.device), { total: views.length });
table("COUNTRY", tally(views, (r) => r.country), { total: views.length, limit: 10 });
table("BY DAY  (views)", tally(views, (r) => r.created_at.slice(0, 10)), { limit: 31 });

funnel("/book FUNNEL", rows, [
  ["Landed on /book", (r) => r.event === "page_view" && r.path === "/book"],
  ["Clicked a book CTA", (r) => r.event === "cta_click" && r.path === "/book"],
  ["Saw the calendar", (r) => r.event === "section_view" && r.value === "calendar"],
]);

funnel("/optin QUIZ FUNNEL", rows, [
  ["Landed on /optin", (r) => r.event === "page_view" && r.path === "/optin"],
  ["1. Business type", (r) => r.event === "quiz_step" && r.step_key === "businessType"],
  ["2. Crews", (r) => r.event === "quiz_step" && r.step_key === "crews"],
  ["3. Bottleneck", (r) => r.event === "quiz_step" && r.step_key === "bottleneck"],
  ["4. Service area", (r) => r.event === "quiz_step" && r.step_key === "serviceArea"],
  ["Submitted", (r) => r.event === "quiz_submit"],
  ["Qualified (has crews)", (r) => r.event === "quiz_submit" && r.value === "qualified"],
]);

const ctas = tally(rows.filter((r) => r.event === "cta_click"), (r) => r.value);
table("CTA CLICKS", ctas);

const answers = rows.filter((r) => r.event === "quiz_step");
if (answers.length) {
  for (const key of ["businessType", "crews", "bottleneck"]) {
    table(`QUIZ ANSWERS  ${key}`, tally(answers.filter((r) => r.step_key === key), (r) => r.value));
  }
}

console.log();
