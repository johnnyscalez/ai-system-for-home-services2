---
name: sales-sponsorthis
description: "Sponsor This Newsletter platform help — curated Airtable database of 530+ newsletters ready for sponsorships, with subscriber stats, ad pricing, and cross-promotion openness indicators for startup founders. Use when you want to find newsletters to sponsor your product, need a curated list of newsletters that accept ads sorted by niche and subscriber count, unsure whether Sponsor This Newsletter is worth buying vs using Reletter or Paved for newsletter discovery, trying to figure out which newsletters are open to cross-promotion or affiliate deals, or want to compare newsletter ad prices before reaching out. Do NOT use for general newsletter monetization strategy (use /sales-newsletter) or finding sponsors for your newsletter (use /sales-sponsorgap or /sales-sponsorleads)."
argument-hint: "[describe what you need help with for finding newsletters to sponsor]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, sponsorship, platform]
---

# Sponsor This Newsletter Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Find newsletters to sponsor/advertise in for my product
   - B) Compare Sponsor This Newsletter to alternatives (Reletter, Paved, LetterHunt)
   - C) Filter the database by niche, price, or audience size
   - D) Decide if the one-time purchase is worth it
   - E) Find newsletters open to cross-promotion or affiliate deals

2. **What's your product niche?** (e.g., SaaS, fintech, health, dev tools)

3. **What's your budget per newsletter placement?** (e.g., $50, $200, $500+)

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter monetization strategy (you're a publisher wanting revenue) | `/sales-newsletter [question]` |
| Finding sponsors for YOUR newsletter | `/sales-sponsorgap [question]` or `/sales-sponsorleads [question]` |
| Newsletter sponsorship marketplace (programmatic ad buying) | `/sales-paved [question]` |
| Searching 7M+ newsletters with API access | `/sales-reletter [question]` |
| Growing your subscriber list | `/sales-audience-growth [question]` |

If the question is Sponsor This Newsletter-specific, continue to Step 3.

## Step 3 — Sponsor This Newsletter platform reference

**Read `references/platform-guide.md`** for the full platform reference — database contents, filtering workflow, pricing, comparison with alternatives, and outreach tips.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Low budget (<$100/placement)**: Filter for newsletters with median ad price under $70. Many smaller newsletters in the database accept affordable placements.
- **Mid budget ($100-$500)**: Sort by open rate and niche relevance. Prioritize newsletters with 44%+ open rates and 6%+ CTR.
- **Cross-promotion focus**: 91% of listed newsletters are open to cross-promotion — use the database to find swap partners rather than paying for ads.
- **Affiliate-first**: 73% are open to affiliate marketing — propose a performance-based deal instead of a flat sponsorship fee.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **One-time purchase, no ongoing updates**: Unlike SponsorLeads (weekly new leads) or SponsorGap (real-time monitoring), this database is static after purchase. Newsletter stats go stale — verify open rates and subscriber counts before outreach.
2. **No API, no automation**: Airtable-only access. You can export to CSV but there's no programmatic interface, no webhooks, no Zapier/Make.
3. **Small database vs alternatives**: 530+ newsletters vs Reletter's 7M+ indexed publications. Best as a curated starting point, not a comprehensive search tool.
4. **No sponsor-side intelligence**: Doesn't track which brands are sponsoring which newsletters (unlike SponsorGap or Who Sponsors Stuff). Purely a directory of newsletters accepting ads.
5. **SSL issues reported**: The website has intermittent SSL certificate errors — the database itself is hosted in Airtable.

## Related skills

- `/sales-newsletter` — Newsletter monetization strategy (paid subscriptions, sponsorships, ad sales, pricing)
- `/sales-reletter` — Reletter newsletter search engine (7M+ publications, subscriber data, creator contacts, API)
- `/sales-paved` — Paved newsletter sponsorship marketplace, Ad Network, Booker, Radar
- `/sales-sponsorgap` — SponsorGap sponsor intelligence (38K+ brands, verified contacts, competitor monitoring, spend trends, API)
- `/sales-sponsorleads` — SponsorLeads sponsor lead lists (4,318+ companies, decision-maker contacts, Airtable database)
- `/sales-whosponsorsstuff` — Who Sponsors Stuff sponsor intelligence (8,000+ sponsors, ad creative screenshots, decision-maker contacts)
- `/sales-hecto` — Hecto newsletter advertising marketplace (self-serve, transparent pricing, direct creator messaging)
- `/sales-lettergrowth` — Lettergrowth cross-promotion directory (1,300+ newsletters, free)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Finding newsletters to sponsor for a SaaS product
**User says**: "I have a project management SaaS and want to find newsletters to advertise in. Budget is $200/placement."
**Skill does**: Explains how to filter the Airtable database by niche (productivity, SaaS, project management), sort by open rate and price, recommends starting with 3-5 test placements, suggests verifying stats before booking
**Result**: User has a shortlist of relevant newsletters to pitch with a testing strategy

### Example 2: Comparing discovery tools
**User says**: "Should I buy Sponsor This Newsletter or just use Reletter?"
**Skill does**: Compares database size (530 vs 7M), pricing (one-time vs $49/mo), features (curated + stats vs API + monitoring), recommends Sponsor This Newsletter for quick curated start and Reletter for comprehensive search with automation
**Result**: User picks the right tool for their workflow

### Example 3: Automating newsletter outreach from the database
**User says**: "How do I get Sponsor This Newsletter data into my outreach tool?"
**Skill does**: Walks through Airtable CSV export, field mapping for outreach tools (newsletter name, contact, subscriber count, price), recommends verifying contact info before importing, suggests personalizing outreach based on the newsletter's content niche
**Result**: User has a pipeline from the database to their cold outreach tool

## Troubleshooting

### Newsletter stats seem outdated
**Symptom**: Open rates or subscriber counts in the database don't match the newsletter's current claims
**Cause**: The database is a one-time snapshot — newsletters grow and metrics change
**Solution**: Before reaching out, check the newsletter's media kit or ask directly. Use the database as a discovery tool, not a source of truth for current metrics.

### Can't find newsletters in my niche
**Symptom**: Filtering returns too few or no results for your specific vertical
**Cause**: 530 newsletters may not cover every niche — the database skews toward startup/creator/marketing topics
**Solution**: Use Sponsor This Newsletter for initial discovery, then supplement with Reletter (7M+ publications) or Paved's marketplace for broader coverage.

### Unsure if the purchase is justified
**Symptom**: Hesitating on the one-time fee for a static database
**Cause**: Hard to estimate ROI before seeing the data
**Solution**: Calculate: if one $200 newsletter placement from this database drives even 50 signups, the database pays for itself. For ongoing, dynamic needs, consider SponsorGap ($39/mo) or Reletter ($49/mo) instead.
