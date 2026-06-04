---
name: sales-referralkit
description: "ReferralKit platform help — newsletter referral program tool by Copyhackers with milestone-based rewards, unique-link insertion into email body, and direct ESP integrations (Mailchimp, ConvertKit/Kit, MailerLite, AWeber) for no-code newsletter operators who want a Morning Brew / The Hustle style referral engine. Use when comparing ReferralKit's free-for-first-10K-leads model against SparkLoop, ReferralHero, Viral Loops, or GrowSurf for newsletter referral programs, can't decide whether ReferralKit's ESP-native link insertion is enough or you need a richer dashboard (GrowSurf) or paid recommendations (SparkLoop), wondering whether the 10K free-lead allowance is per-list or per-account, your ESP isn't listed natively (Drip, Ghost, Campaign Monitor, ActiveCampaign — planned but not live) and need a workaround, milestone rewards aren't triggering or the unique-link merge tags aren't rendering in your email body, trying to track referrals without a public API or webhooks, or unsure if the domain is referralkit.co or referralkit.io (the .io version is dead — use .co). Do NOT use for general newsletter audience growth strategy across all platforms (use /sales-audience-growth) or general newsletter monetization (use /sales-newsletter)."
argument-hint: "[describe what you need help with in ReferralKit]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, referral-program, audience-growth, platform]
---

# ReferralKit Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Decide between the Free 10K-lead tier and Premium tiers
   - B) Set up a milestone-based referral program (rewards at 3 / 10 / 25 referrals)
   - C) Integrate with your ESP (Mailchimp, ConvertKit/Kit, MailerLite, AWeber)
   - D) Workaround for a not-yet-supported ESP (Drip, Ghost, Campaign Monitor, ActiveCampaign)
   - E) Compare ReferralKit to SparkLoop, ReferralHero, Viral Loops, or GrowSurf
   - F) Debug referral counts or unique-link merge tags not rendering in email
   - G) Pipe referral data into a CRM despite no API

2. **What's your current ESP?** (Drives whether ReferralKit's native integration applies or you need a workaround.)

3. **What's your subscriber count and program goal?** (Drives tier choice and reward tier design.)

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter audience growth strategy across all platforms | `/sales-audience-growth [question]` |
| Newsletter monetization strategy | `/sales-newsletter [question]` |
| SparkLoop platform help (paid recs, referral programs, partner network) | `/sales-sparkloop [question]` |
| Lettergrowth cross-promo directory | `/sales-lettergrowth [question]` |
| Collab Match / InboxReads / MutualGro cross-promo directories | `/sales-collabmatch [question]`, `/sales-inboxreads [question]`, `/sales-mutualgro [question]` |
| Refind CPA-based newsletter ad network | `/sales-refind [question]` |
| ESP setup (Kit, Mailchimp, MailerLite, AWeber) | `/sales-kit [question]`, `/sales-mailchimp [question]`, `/sales-mailerlite [question]` |

If the question is ReferralKit-specific, continue to Step 3.

## Step 3 — ReferralKit platform reference

**Read `references/platform-guide.md`** for the full platform reference — feature gating, ESP integration flow, milestone reward design, comparison with alternatives, and CRM-without-API patterns.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Under 10K subscribers**: ReferralKit's free tier covers you completely. No reason to pay for SparkLoop ($99/mo) or GrowSurf until you scale past the free allowance.
- **Native ESP user (Mailchimp, Kit, MailerLite, AWeber)**: ReferralKit's strength is direct merge-tag insertion of the unique referral link into your existing email — no separate landing pages, no JavaScript widget. If your ESP is one of these four, set up takes minutes.
- **Non-native ESP (Drip, Ghost, Campaign Monitor, ActiveCampaign)**: ReferralKit lists these as "planned." Until live, your workaround is to copy a generic referral URL with manual UTM tagging, or switch to a tool with broader ESP support (SparkLoop covers 25+ ESPs).
- **Wrong domain**: If you fetched `referralkit.io` and got connection refused, the live site is `referralkit.co`. The .io domain is dead — don't bookmark it.
- **No API**: ReferralKit has no public API, no webhooks, no Zapier. If you need referral data in your CRM, export from the dashboard manually and import to HubSpot/Salesforce, or pull tagged subscribers from your ESP downstream.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **Wrong domain everywhere.** The platform is `referralkit.co` — `.io` returns `ECONNREFUSED` and may be a stale or squatted variant. Always paste the .co URL.
2. **No public API, no webhooks, no Zapier/Make/MCP.** Confirmed via WebSearch — no developer documentation. Pipe referral data via manual CSV export or via your ESP's subscriber-level integrations.
3. **Pricing model uncertainty.** Homepage shows "100% free for your first 10,000 leads" but `/pricing` returns 404 and older third-party sources mention "$19/mo for 3K subs." The pricing model appears to have changed; verify current tiers with ReferralKit support before quoting numbers to stakeholders.
4. **Only 4 ESP integrations are live.** Mailchimp, ConvertKit/Kit, MailerLite, AWeber. Drip, Ghost, Campaign Monitor, and ActiveCampaign are listed as "planned" — don't assume they work.
5. **Merge-tag-driven, not landing-page-driven.** ReferralKit injects unique referral links via ESP merge tags. If your ESP strips merge tags in certain campaign types (broadcasts vs sequences), the links won't render. Test in a sample audience before launching.
6. **Built by Copyhackers** — strong copywriting credibility but a small product team. Feature velocity is steady but support response time may be slower than enterprise SLAs.
7. **Morning Brew / The Hustle case studies are marketing examples, not feature parity.** Those programs used custom-built referral systems; ReferralKit gives you the same mechanics in no-code form but won't match the bespoke polish.

## Related skills

- `/sales-audience-growth` — Newsletter audience growth strategy (referrals, cross-promotion, lead magnets across all platforms)
- `/sales-newsletter` — Newsletter monetization (paid subs, sponsorships, ad networks)
- `/sales-sparkloop` — SparkLoop (paid recommendations + free recommendations + partner network, 25+ ESPs)
- `/sales-lettergrowth` — Lettergrowth (free newsletter cross-promotion directory)
- `/sales-collabmatch` — Collab Match (niche Web3/tech cross-promo)
- `/sales-inboxreads` — InboxReads (5,600+ newsletter directory + Opportunities Board)
- `/sales-mutualgro` — MutualGro (creator collaboration with AI matching + scheduled posting)
- `/sales-refind` — Refind (CPA newsletter ads + cross-promo)
- `/sales-kit` — Kit (formerly ConvertKit) platform help — primary ESP integration target for ReferralKit
- `/sales-mailchimp` — Mailchimp platform help
- `/sales-mailerlite` — MailerLite platform help
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do -a claude-code`

## Examples

### Example 1: Free tier vs SparkLoop decision
**User says**: "I have a 5,000-subscriber newsletter on Mailchimp. Should I use ReferralKit's free tier or pay for SparkLoop?"
**Skill does**: Recommends starting with ReferralKit Free — first 10,000 leads are covered, Mailchimp is natively supported, and the merge-tag flow gets a referral program live without leaving the ESP. SparkLoop's $99/mo only pays off if you want paid recommendations revenue or the partner network — not pure referrals. Suggests upgrading to SparkLoop only after hitting the 10K free cap or wanting monetization beyond list growth.
**Result**: User launches ReferralKit free, validates the referral mechanic, considers SparkLoop only when they need post-opt-in monetization.

### Example 2: ESP not natively supported
**User says**: "I'm on Ghost. Can I use ReferralKit?"
**Skill does**: Notes Ghost is listed as a "planned" integration but isn't live yet. Suggests two workarounds: (1) use ReferralKit's generic referral URL with manual UTM tags and embed the link in Ghost newsletter sends via Markdown, accepting that ESP-side merge-tag automation won't work; or (2) switch to a tool that natively supports Ghost — SparkLoop does. Recommends checking ReferralKit's roadmap for Ghost timing before committing.
**Result**: User chooses SparkLoop for Ghost-native support, or accepts the manual-link workaround if Free tier is critical.

### Example 3: Pulling referral data into a CRM without an API
**User says**: "How do I get ReferralKit referral counts into HubSpot for sales segmentation?"
**Skill does**: Confirms ReferralKit has no API, no webhooks, no Zapier. Workarounds: (1) export referral data from the ReferralKit dashboard manually (weekly batch CSV → HubSpot import), or (2) tag subscribers in your ESP as "referred" at signup using ESP-side automations, then sync ESP → HubSpot via the ESP's existing CRM integration. Notes ReferralKit's roadmap doesn't mention API plans publicly.
**Result**: User builds a manual weekly CSV export → HubSpot upsert flow.

## Troubleshooting

### Unique referral link not rendering in email
**Symptom**: Merge tag for the referral link shows as plain text or empty in the sent email
**Cause**: ESP merge-tag context mismatch — ReferralKit's merge tags require the subscriber-level context, which some broadcast templates strip
**Solution**: Use ReferralKit's merge tags in subscriber-targeted sends (sequences, automations) — not in unsegmented broadcasts where the subscriber context isn't bound. Test with a small audience first. If still failing, ensure the ReferralKit integration is connected to the correct ESP account and audience.

### Free tier counting feels off
**Symptom**: Approaching the 10K free-lead cap but unsure what counts
**Cause**: Pricing terminology has changed between historical content ("subscribers") and current homepage ("leads") — definitions may differ
**Solution**: Contact ReferralKit support to confirm what counts toward the 10K cap (signups? referrals? both?). Don't trust third-party sources for current pricing — verify directly. Plan tier upgrades with a 20% headroom buffer.

### Domain confusion — referralkit.io vs referralkit.co
**Symptom**: Bookmarks, old guides, or AI search results point to `referralkit.io` which returns connection refused
**Cause**: The live platform is `referralkit.co`. The .io domain appears stale or unrelated.
**Solution**: Always use `referralkit.co`. Update any internal docs/bookmarks. The previous skill backlog entry had `.io` and was wrong — corrected in this skill.
