---
name: sales-mutualgro
description: "MutualGro platform help — UK-based creator collaboration platform with AI-powered partner matching, scheduled X and LinkedIn posting, partnership proposals, growth scoring, and an analytics dashboard for newsletter creators, indie founders, and builders seeking cross-promotion partners. Use when comparing the Free Explorer vs paid Collaborator (£3.99/mo or £47.90/yr) tier to see which unlocks AI matching and scheduled posting, can't decide between MutualGro and Lettergrowth/InboxReads/Collab Match for partner discovery, want to automate X or LinkedIn swap posts without leaving the platform, the matching algorithm isn't surfacing relevant partners, the partnership intelligence dashboard shows weak growth signals you can't interpret, looking for non-newsletter partners (indie builders, SaaS founders), or tracking swap performance without an API. Do NOT use for general newsletter monetization (use /sales-newsletter) or general newsletter audience growth across multiple directories (use /sales-audience-growth)."
argument-hint: "[describe what you need help with in MutualGro]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, cross-promotion, audience-growth, creator-collaboration, platform]
---

# MutualGro Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Pick between Free Explorer and paid Collaborator
   - B) Find newsletter or creator cross-promo partners via the matching algorithm
   - C) Set up scheduled X / LinkedIn posts for a swap
   - D) Interpret the partnership intelligence dashboard / growth score
   - E) Compare MutualGro to Lettergrowth, InboxReads, Collab Match, or SparkLoop Free Recs
   - F) Move MutualGro data into a CRM despite no API

2. **Are you primarily a newsletter operator, an indie SaaS founder, or a general creator?** (MutualGro spans all three — partner relevance depends on which one you say.)

3. **What's your audience size and stage?** (Drives partner-size targets and which collab format makes sense — swap, shoutout, joint launch.)

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter monetization strategy across all platforms | `/sales-newsletter [question]` |
| Newsletter audience growth strategy across all platforms | `/sales-audience-growth [question]` |
| Lettergrowth (free newsletter cross-promo directory) | `/sales-lettergrowth [question]` |
| Collab Match (Web3/tech niche cross-promo) | `/sales-collabmatch [question]` |
| InboxReads (newsletter directory + Opportunities Board) | `/sales-inboxreads [question]` |
| SparkLoop paid/free recommendations | `/sales-sparkloop [question]` |
| Refind (CPA newsletter ads) | `/sales-refind [question]` |
| Social media scheduling generally (not collab-specific) | `/sales-social-media-management [question]` |

If the question is MutualGro-specific, continue to Step 3.

## Step 3 — MutualGro platform reference

**Read `references/platform-guide.md`** for the full platform reference — Explorer vs Collaborator gating, smart-matching mechanics, X/LinkedIn scheduling, partnership intelligence dashboard, comparison with alternatives, and CRM-without-API patterns.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Validate fit first on Free Explorer.** One project, manual matching, unlimited partnership requests — enough to see whether your niche has partner density before paying £3.99/mo. If you get fewer than 2-3 relevant matches in 2 weeks, MutualGro's pool isn't deep enough for you yet.
- **Newsletter creator with multiple projects (newsletter + course + side product).** Upgrade to Collaborator — the unlimited projects + AI matching + scheduled posting cluster pays for itself if you run more than one swap per month.
- **Indie SaaS founder, not a newsletter-only creator.** MutualGro is unusual in the cross-promo space because it accepts non-newsletter projects. If you want to collab with other indie founders (joint launches, mutual shoutouts on X), this is one of the few platforms designed for it — Lettergrowth and Collab Match are newsletter-only.
- **Already on Lettergrowth / InboxReads.** MutualGro overlaps on partner discovery but adds AI matching + scheduled posting. Keep your free layer; add MutualGro only if you want the posting automation.
- **No-API workflows.** Track swap-sourced subscribers via UTM tags (`?utm_source=mutualgro&utm_medium=crosspromo&utm_campaign={partner}`), sunset non-openers at 30 days, and keep a manual partner CRM in Notion/Airtable.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **AI matching and scheduled posting are paywalled.** Free Explorer gets manual browse + partnership requests only. If the user describes "smart matching not working," confirm they're on Collaborator (£3.99/mo or £47.90/yr).
2. **No API, no webhooks, no Zapier/Make/MCP.** All actions are UI-only. Don't plan automated partner pipelines or CRM sync around it. Use UTM tagging for attribution.
3. **GBP pricing surprises non-UK users.** £3.99/mo converts to ~$5/mo, which is cheaper than most alternatives — but billing currency may matter for accounting/expense reporting.
4. **Scheduled posting is collab-scoped, not general social media.** Don't replace your Buffer/Hypefury setup with MutualGro — the scheduler is designed for partner-coordinated swap posts, not your own content calendar.
5. **"Partnership intelligence dashboard" is creator-reported.** Growth scores combine self-reported audience size with on-platform activity. Verify partner metrics by checking their public profile (X follower count, newsletter signup page) before committing to a major swap.
6. **Project showcase quality matters more than profile age.** A clear "what I offer / what I'm looking for" description outperforms time on platform — most matching is keyword + interest based, not seniority based.
7. **Small platform, indie team.** UK-based, small team — uptime is generally fine but feature velocity is faster than support response time. Expect community-driven support, not enterprise SLAs.

## Related skills

- `/sales-audience-growth` — Newsletter and creator audience growth across all platforms (cross-promotion, referrals, lead magnets)
- `/sales-newsletter` — Newsletter monetization (paid subs, sponsorships, ad networks)
- `/sales-lettergrowth` — Lettergrowth platform help (free cross-promotion directory, 1,300+ newsletters)
- `/sales-collabmatch` — Collab Match platform help (niche Web3/tech cross-promo, 200+ newsletters)
- `/sales-inboxreads` — InboxReads platform help (5,600+ newsletter directory, Opportunities Board, Live Media Kits)
- `/sales-sparkloop` — SparkLoop paid and free recommendations (any ESP, automated)
- `/sales-refind` — Refind CPA-based newsletter ad network
- `/sales-social-media-management` — Social media scheduling and management strategy (Buffer, Hypefury, Typefully, etc.) for non-collab posting
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do -a claude-code`

## Examples

### Example 1: Free vs Collaborator decision
**User says**: "I run a 2K-sub indie SaaS newsletter. Is the £3.99/mo Collaborator plan worth it on MutualGro?"
**Skill does**: Suggests starting on Free Explorer to validate partner density in the SaaS-founder niche (2 weeks, manual matching). If matches show up, upgrade for AI matching + scheduled X/LinkedIn posting — at £3.99/mo, one successful swap per quarter pays for the year. Notes that MutualGro accepts non-newsletter projects, which Lettergrowth and Collab Match don't.
**Result**: User runs a 2-week free trial of Explorer, sees 4-5 relevant SaaS founder matches, upgrades.

### Example 2: Comparing MutualGro to Lettergrowth and InboxReads
**User says**: "I'm already paying for InboxReads Basic. Is MutualGro additive or duplicative?"
**Skill does**: Identifies the overlap (partner discovery) and the differentiation: MutualGro adds AI matching + scheduled X/LinkedIn posting + non-newsletter project types; InboxReads adds the Opportunities Board + Live Media Kits + ad pricing suggestions. Recommends keeping InboxReads for sponsorship pipeline and adding MutualGro Free Explorer only if the user wants to collaborate with non-newsletter founders/creators.
**Result**: User stays on InboxReads, adds Free MutualGro for indie founder collabs.

### Example 3: Tracking MutualGro swaps without an API
**User says**: "How do I pipe new subscribers from a MutualGro swap into my Beehiiv subscriber tags?"
**Skill does**: Confirms MutualGro has no API/webhooks/Zapier. Walks through UTM tagging on the swap link (`?utm_source=mutualgro&utm_medium=crosspromo&utm_campaign={partner-slug}`), enabling Beehiiv's UTM-based subscriber tagging, then comparing 30-day open rate vs organic to measure swap quality. To land swap-sourced subscribers in a CRM, pull the UTM-tagged segment from the ESP (e.g., Beehiiv API or segment export) and push it to HubSpot via the ESP's API or native CRM sync — MutualGro itself can't feed a CRM. Notes the workflow stays manual at the partner-level — there's no programmatic pipeline.
**Result**: User has UTM-driven swap attribution without needing an API.

## Troubleshooting

### Matching is returning irrelevant partners
**Symptom**: AI matching surfaces creators in unrelated niches or wildly different sizes
**Cause**: Profile keywords too broad, or "what I'm looking for" field left vague
**Solution**: Tighten "what I offer" and "what I'm looking for" to specific niches, audience descriptions, and collab formats (swap, shoutout, joint launch). Add 2-3 niche-specific keywords (e.g., "B2B SaaS GTM" not just "marketing"). Re-run matching after 24 hours.

### Scheduled X / LinkedIn post didn't go out
**Symptom**: Set up a partnership post for a future date; the date passed without publishing
**Cause**: Most often a re-auth issue with X or LinkedIn (token expired), or the post was queued but flagged
**Solution**: Re-authorize X / LinkedIn in MutualGro settings. Check the partnership intelligence dashboard for any flagged content. As a workaround during incidents, copy the scheduled post and publish manually — MutualGro is not a hard dependency for the actual posting.

### Free plan caps blocking exploration
**Symptom**: Hit the 1-project limit, or matching feels manual and slow
**Cause**: Free Explorer is intentionally limited to drive Collaborator upgrades
**Solution**: If you have only 1 project and are exploring, that's fine. If you have multiple projects (newsletter + side product), upgrade to Collaborator — at £3.99/mo, it's cheaper than paying for a separate cross-promo tool per project.
