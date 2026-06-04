---
name: sales-inboxreads
description: "InboxReads platform help — newsletter directory and growth platform with 5,600+ newsletters across 40+ topics, 1-click cross-promotion swaps, Opportunities Board for sponsorships, Live Media Kits, ad pricing suggestions, competitor tool analysis, and newsletter acquisition marketplace. Use when comparing InboxReads tiers (Free vs Lite $8/mo vs Basic $33/mo vs Team $58/mo) and trying to figure out which one unlocks the analytics and messaging you actually need, can't decide between InboxReads and Lettergrowth/SparkLoop/Paved for cross-promotion or sponsor discovery, want to set up a Live Media Kit and don't know what metrics to feature, the Opportunities Board isn't surfacing relevant matches in your niche, hit the message or search caps on the Lite plan, looking for newsletters to acquire or planning to list yours for sale, or need to pipe InboxReads data into a CRM despite no API. Do NOT use for general newsletter monetization strategy across all platforms (use /sales-newsletter) or general newsletter audience growth strategy (use /sales-audience-growth)."
argument-hint: "[describe what you need help with in InboxReads]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, cross-promotion, sponsorship, directory, platform]
---

# InboxReads Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Pick the right InboxReads plan (Free / Lite / Basic / Team)
   - B) Discover newsletters to cross-promote with or sponsor
   - C) List your newsletter and set up a Live Media Kit
   - D) Use the Opportunities Board to find sponsors or cross-promo partners
   - E) Compare InboxReads to Lettergrowth, SparkLoop, Paved, or Reletter
   - F) Buy or sell a newsletter via the acquisition marketplace
   - G) Move InboxReads data into a CRM or pipeline despite no API

2. **Are you the publisher or the advertiser/sponsor?** (Most InboxReads features serve publishers, but the directory and sponsor research tools also work for advertisers.)

3. **What's your subscriber count and niche?** (Drives messaging templates, partner-size targets, and ad price suggestions.)

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter monetization strategy across all platforms | `/sales-newsletter [question]` |
| Newsletter audience growth strategy across all platforms | `/sales-audience-growth [question]` |
| Lettergrowth specifically (free cross-promo directory) | `/sales-lettergrowth [question]` |
| Collab Match (Web3/tech niche cross-promo) | `/sales-collabmatch [question]` |
| SparkLoop paid/free recommendations | `/sales-sparkloop [question]` |
| Paved (managed sponsorship marketplace) | `/sales-paved [question]` |
| Hecto (self-serve sponsorship marketplace) | `/sales-hecto [question]` |
| Sponsy (sponsorship CRM and ops) | `/sales-sponsy [question]` |
| Reletter (7M+ newsletter search engine with API) | `/sales-reletter [question]` |
| Sponsor This Newsletter (530-newsletter curated database) | `/sales-sponsorthis [question]` |
| Open Rates (sponsor prospecting database) | `/sales-openrates [question]` |

If the question is InboxReads-specific, continue to Step 3.

## Step 3 — InboxReads platform reference

**Read `references/platform-guide.md`** for the full platform reference — modules, plan-gated limits, cross-promotion workflow, Opportunities Board, Live Media Kits, comparison with alternatives, and CRM-without-API patterns.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **First-time user under 2K subs**: Start on Free to validate the directory has partners in your niche. Upgrade to Lite ($8/mo) only when you hit the 10 messages/100 searches/1 alert ceiling.
- **Active swapper / 2K-10K subs**: Basic ($33/mo) unlocks unlimited messages and searches — usually pays for itself in 1-2 successful swap partnerships per month.
- **Multi-person newsletter team**: Team plan ($58/mo) is the only tier with seats and shared collections. Below 5 people, Basic with shared logins is usually cheaper unless you need exports/alerts at unlimited.
- **Sponsor side (advertiser)**: Use directory + Opportunities Board. Pro analytics (open/click rates) matter more here than messaging — pick the plan that unlocks the metrics you need to vet inventory.
- **No-API workflows**: Use CSV exports (Basic+) → pipe into your CRM or outreach tool manually. Pair InboxReads research with your usual outbound sequence in Mailshake/Lemlist/Smartlead.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **No API, no webhooks, no Zapier/Make/MCP**: Every feature is UI-only. Exports (CSV, Basic+) are the only way to move data out of InboxReads. Don't plan a programmatic pipeline.
2. **Lite plan caps are tight**: 10 messages/month, 100 searches/month, 1 collection, 1 email alert. Power users blow through this in a week. Jump to Basic if you'll do real volume.
3. **Pro analytics aren't always current**: Subscriber counts and open rates come from creator-submitted or scraped data and can lag reality. Verify before committing a swap or sponsorship.
4. **Opportunities Board overlaps with Paved/Hecto/Passionfroot**: If you're already paying for a marketplace, layering InboxReads adds duplicate inbound work without proportional reach. Pick a primary marketplace and use InboxReads as a discovery layer.
5. **Cross-promotion 1-click swap doesn't replace tracking**: The swap setup is fast, but InboxReads doesn't add UTM parameters automatically — append `?utm_source=inboxreads&utm_medium=crosspromo&utm_campaign={partner}` yourself or you lose attribution.
6. **Newsletter for sale marketplace requires due diligence**: Listings are creator-claimed metrics. Always request screenshot proof of subscriber count, open rate, and revenue before transacting.
7. **Tools directory is reviews + comparisons, not affiliate-free**: The Tools section is a major content surface. Treat it as a curated catalog, not unbiased reviews — InboxReads may have business relationships with listed tools.

## Related skills

- `/sales-newsletter` — Newsletter monetization strategy (paid subs, sponsorships, ad networks across all platforms)
- `/sales-audience-growth` — Newsletter audience growth strategy (cross-promotion, referrals, lead magnets across all platforms)
- `/sales-lettergrowth` — Lettergrowth platform help (free cross-promotion directory, 1,300+ newsletters)
- `/sales-collabmatch` — Collab Match platform help (niche cross-promotion directory, 200+ newsletters, Web3/tech)
- `/sales-sparkloop` — SparkLoop platform help (paid and free recommendations, referral programs)
- `/sales-paved` — Paved platform help (managed newsletter sponsorship marketplace, Ad Network, Booker)
- `/sales-hecto` — Hecto platform help (self-serve newsletter advertising marketplace, transparent pricing)
- `/sales-sponsy` — Sponsy platform help (sponsorship CRM, ad inventory, sponsor portals, reporting)
- `/sales-reletter` — Reletter platform help (7M+ newsletter search engine with API and MCP)
- `/sales-sponsorthis` — Sponsor This Newsletter (530 newsletters, ad pricing, cross-promo/affiliate flags, one-time)
- `/sales-openrates` — Open Rates sponsor prospecting database (10,000+ active sponsors)
- `/sales-passionfroot` — Passionfroot creator marketing platform (Zest AI, storefronts, FrootWallet)
- `/sales-refind` — Refind CPA-based newsletter ad network
- `/sales-megahit` — Megahit subscriber enrichment (find decision-makers in your list)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Picking the right InboxReads plan
**User says**: "I have a 3,500-sub finance newsletter. Should I get Lite or Basic on InboxReads?"
**Skill does**: Notes Lite ($8/mo) caps at 10 messages and 100 searches per month — likely too tight for active outreach to finance partners. Recommends Basic ($33/mo) for unlimited messages/searches plus exports, especially since finance is competitive and discovery needs are higher. Suggests starting on Lite for one month to validate partner density before upgrading.
**Result**: User starts on Lite, hits caps within two weeks, upgrades to Basic with confidence the inventory exists.

### Example 2: Comparing InboxReads to Lettergrowth and SparkLoop
**User says**: "I'm already on Lettergrowth and SparkLoop Free Recs. Is InboxReads worth adding?"
**Skill does**: Explains the overlap (all three solve cross-promotion discovery) and the differentiation: InboxReads has a sponsorship marketplace (Opportunities Board) and Media Kits that the other two don't, but charges $8-58/mo where Lettergrowth is free. Recommends keeping the free layer (Lettergrowth + SparkLoop Free Recs) and only paying for InboxReads if the Opportunities Board or Live Media Kit unlocks a specific workflow (sponsor pitches, brand discovery).
**Result**: User holds off, adds InboxReads later when starting active sponsor outreach.

### Example 3: Moving InboxReads data to a CRM without an API
**User says**: "How do I pipe InboxReads contacts into HubSpot for sponsor outreach?"
**Skill does**: Confirms InboxReads has no API/webhooks/Zapier. Walks through the Basic+ CSV export path: filter the directory by niche/size, export 5 contacts/month (Team = unlimited), map columns to HubSpot fields (newsletter name → company, contact email → email, subscriber count → custom property), then run outreach via a regular tool like Mailshake or Smartlead. Notes the manual nature and recommends batching exports.
**Result**: User has a manual but workable InboxReads → HubSpot → outbound pipeline.

## Troubleshooting

### Lite plan caps blocking outreach
**Symptom**: Hit the 10-message or 100-search limit mid-week
**Cause**: Lite is sized for casual exploration, not active campaigns
**Solution**: Upgrade to Basic ($33/mo) for unlimited messages/searches. If usage is bursty (one campaign per quarter), schedule outreach within a single Lite cycle and prep all messages in batch before sending.

### Opportunities Board returning irrelevant matches
**Symptom**: Sponsorship/cross-promo suggestions don't fit your niche or size
**Cause**: Board surfaces broad matches by default; filters need tuning
**Solution**: Tighten filters by category, subscriber range, and ad price band. Also publish a Live Media Kit so creators see your real metrics before pitching — increases match quality. Cross-check niche fit on the partner's recent issues before accepting.

### Cross-promotion drove signups but they don't engage
**Symptom**: 1-click swap delivered subscribers, but 30-day open rate is well below organic
**Cause**: Partner audience mismatch, or your value prop didn't land in their format
**Solution**: Tag swap-sourced subs with `utm_source=inboxreads&utm_campaign={partner}` in your ESP. Sunset non-openers after 30 days. Tighten partner criteria to 0.5x-2x your size in adjacent (not identical) niches, and ask for the partner's open rate before next swap.
