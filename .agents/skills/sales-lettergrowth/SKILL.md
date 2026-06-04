---
name: sales-lettergrowth
description: "Lettergrowth platform help — free newsletter cross-promotion directory with 1,300+ newsletters searchable by category, subscriber count, and recency for finding swap partners. Use when you can't find newsletters to cross-promote with, looking for newsletters in your niche that are open to swaps, cross-promotion outreach messages aren't getting replies, unsure how to evaluate a cross-promotion partner's audience fit, or trying to decide between Lettergrowth and alternatives like Collab Match or Beehiiv Boosts for finding swap partners. Do NOT use for general audience growth strategy (use /sales-audience-growth), newsletter monetization (use /sales-newsletter), or paid recommendation networks like SparkLoop (use /sales-sparkloop)."
argument-hint: "[describe your newsletter cross-promotion question]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, cross-promotion, audience-growth, platform]
---

# Lettergrowth Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

Ask the user:

1. **What's your newsletter situation?**
   - A) Looking for my first cross-promotion partners
   - B) Have done some swaps — want to find more partners efficiently
   - C) Evaluating Lettergrowth vs other cross-promotion tools
   - D) Need help with cross-promotion outreach or strategy

2. **Newsletter metrics** (helps match partners):
   - Subscriber count (approximate)
   - Niche / topic
   - Open rate

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| General audience growth strategy | `/sales-audience-growth [question]` |
| Newsletter monetization / sponsorships | `/sales-newsletter [question]` |
| Paid recommendation networks (SparkLoop, Beehiiv Boosts) | `/sales-sparkloop [question]` or `/sales-beehiiv [question]` |
| Referral programs for subscriber growth | `/sales-sparkloop [question]` |
| Email deliverability after list growth | `/sales-deliverability [question]` |

When routing to another skill, provide the exact command.

## Step 3 — Lettergrowth platform reference

**Read `references/platform-guide.md`** for the full platform reference — how the directory works, profile optimization, partner evaluation criteria, outreach templates, and comparison with alternatives.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Cross-promotion success depends on three things: partner fit, outreach quality, and tracking.

1. **Partner fit**: Look for newsletters 0.5x–2x your size in adjacent (not identical) niches. Same-niche swaps cannibalize; adjacent niches expand reach.
2. **Outreach**: Personalize every message — reference a specific recent issue. Generic "let's swap" messages get ignored.
3. **Tracking**: Use UTM parameters on every cross-promotion link. Compare 30-day retention of swap-sourced subscribers vs organic.

If you discover a gotcha or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about platform status and feature availability.*

1. **Lettergrowth was acquired** — The Wisdom Group acquired Lettergrowth and plans to expand to podcasts/media. Feature set may evolve. Verify current state at app.lettergrowth.com.
2. **No automation surface** — No API, no webhooks, no Zapier/Make. All outreach is manual. For automated cross-promotion, use Beehiiv Boosts or SparkLoop.
3. **No built-in tracking** — Lettergrowth connects you with partners but doesn't track swap performance. You must add UTM tags manually.
4. **Free directory = variable quality** — Not all listed newsletters are actively maintained or open to swaps. Check recency of profile updates before reaching out.
5. **Cross-promotions don't scale past ~10K subs** — Users report diminishing returns at scale. Transition to paid recommendations (SparkLoop, Beehiiv Boosts) for 10K+ newsletters.

## Related skills

- `/sales-audience-growth` — Growing your email list (lead magnets, cross-promotion strategy, referral programs, social-to-email conversion)
- `/sales-newsletter` — Newsletter monetization (sponsorships, paid subscriptions, ad sales)
- `/sales-sparkloop` — SparkLoop platform help (referral programs, paid recommendations, partner programs, cross-promotion)
- `/sales-beehiiv` — Beehiiv platform help (Boosts for paid cross-promotion, referral programs, ad network)
- `/sales-kit` — Kit platform help (Creator Recommendations, paid recommendations)
- `/sales-email-marketing` — Email marketing strategy (what to send once you have subscribers)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Finding first cross-promotion partners
**User says**: "I have a 2,000-subscriber newsletter about indie SaaS and want to find cross-promotion partners"
**Skill does**: Walks through Lettergrowth profile setup, recommends searching adjacent niches (solopreneur, no-code, bootstrapping), provides outreach template, suggests starting with 3 newsletters of similar size
**Result**: User has a profile on Lettergrowth, a shortlist of 5 potential partners, and an outreach template

### Example 2: Lettergrowth vs alternatives
**User says**: "Should I use Lettergrowth or something else to find newsletter swap partners?"
**Skill does**: Reads platform-guide.md comparison section, recommends Lettergrowth for manual discovery + Beehiiv Boosts or SparkLoop for automated paid recommendations at scale
**Result**: User picks the right tool based on their list size and goals

### Example 3: Cross-promotion not working
**User says**: "I've done 5 newsletter swaps through Lettergrowth but barely got any subscribers"
**Skill does**: Diagnoses likely causes (audience mismatch, weak CTA, no tracking), recommends evaluating partner open rates, using UTM tags, writing a stronger recommendation blurb
**Result**: User has a checklist for improving swap performance

## Troubleshooting

### Partners not responding to outreach
**Symptom**: Sent 10+ messages on Lettergrowth, got no replies
**Cause**: Generic outreach, size mismatch, or stale profiles
**Solution**: Reference a specific recent issue in your outreach. Target newsletters updated in the last 30 days. Stay within 0.5x–2x your subscriber count. Try different niches — adjacent beats identical.

### Low subscriber gain from swaps
**Symptom**: Partner promoted you but you only got 5-10 new subscribers from 5,000+ reach
**Cause**: Weak recommendation copy, audience mismatch, or low partner engagement
**Solution**: Write the recommendation blurb yourself (don't rely on partner to describe your newsletter). Ask for their open rate before committing. Include a specific value hook, not just "check out this newsletter."

### Unsure if Lettergrowth is still active
**Symptom**: Lettergrowth was acquired and you're not sure the directory is maintained
**Cause**: The Wisdom Group acquired Lettergrowth and is expanding the platform
**Solution**: Check app.lettergrowth.com for current listings. If stale, use alternatives: Collab Match (200+ newsletters), Substack Recommendations (Substack-only), or direct outreach via Reletter's 7M+ newsletter database (`/sales-reletter`).
