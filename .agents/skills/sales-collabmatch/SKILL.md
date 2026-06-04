---
name: sales-collabmatch
description: "Collab Match platform help — niche newsletter cross-promotion matching directory with 200+ newsletters across Business, Tech, Health, and Web3, with public per-newsletter directory pages. Use when deciding whether Collab Match's 200-newsletter directory is worth using vs Lettergrowth's 1,300+ or SparkLoop Free Recommendations, can't get matched because your newsletter is too small or in a niche outside the supported categories, want to find cross-promo partners in Web3/crypto specifically (Collab Match's strongest niche), looking for a low-effort manual swap workflow without paying for SparkLoop or a Beehiiv plan, or unsure if the site is still active given intermittent availability. Do NOT use for general newsletter cross-promotion strategy across multiple directories (use /sales-audience-growth) or newsletter monetization (use /sales-newsletter)."
argument-hint: "[describe what you need help with for Collab Match]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, cross-promotion, audience-growth, platform]
---

# Collab Match Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Get matched with another newsletter for a cross-promotion swap
   - B) Decide if Collab Match is worth using vs Lettergrowth, SparkLoop, or Beehiiv Boosts
   - C) List your newsletter on Collab Match and structure the profile
   - D) Find newsletters in a specific niche (Business, Tech, Health, Web3)
   - E) Reach a Collab Match newsletter owner you found via their public directory page

2. **What's your subscriber count and niche?** (Collab Match works best under 10K subs and skews Web3/tech)

3. **Do you have a partner ESP that supports tracked swap links?** (Beehiiv, Kit, MailerLite all do — Substack does not)

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter cross-promotion strategy across all directories | `/sales-audience-growth [question]` |
| Newsletter monetization (sponsorships, paid subs) | `/sales-newsletter [question]` |
| Lettergrowth specifically (larger directory) | `/sales-lettergrowth [question]` |
| SparkLoop paid/free recommendations | `/sales-sparkloop [question]` |
| Refind CPA-based growth | `/sales-refind [question]` |
| Finding newsletters to sponsor (paid placements) | `/sales-sponsorthis [question]` or `/sales-reletter [question]` |
| ESP-specific cross-promo features (Beehiiv Boosts, Kit Creator Recs, Ghost Recommendations) | `/sales-beehiiv [question]`, `/sales-kit [question]`, `/sales-ghost [question]` |

If the question is Collab Match-specific, continue to Step 3.

## Step 3 — Collab Match platform reference

**Read `references/platform-guide.md`** for the full platform reference — how matching works, profile setup, public directory page structure, comparison with alternatives, niche fit, and outreach tactics.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Web3/crypto/tech newsletter under 5K subs**: Collab Match is well-suited — it skews to these niches and small operators. Sign up, fill out the profile, accept the first 2-3 matches to learn the platform's workflow.
- **Larger newsletter (10K+)**: Skip Collab Match — switch to SparkLoop Free Recommendations or Beehiiv Boosts for higher-volume automated swaps. Use Collab Match only if you want a specific Web3 partner.
- **Non-tech niches (lifestyle, parenting, food)**: Collab Match has limited inventory — Lettergrowth (1,300+ across more niches) is a better starting point.
- **Site appears down or matches aren't coming**: Collab Match is a small indie project — availability is intermittent. Verify the founder is still actively running it (last update on Indie Hackers, recent X/social activity) before investing time in the profile.
- **Browsing public directory pages**: `collabmatch.io/newsletter/{slug}` is publicly indexed — use it for direct outreach even without signing up, but verify the newsletter is still active first.

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **Small directory and unclear activity**: Only ~200 newsletters as of last visible data, vs Lettergrowth's 1,300+. The platform is a small indie project (built by Michael, beta 2022); the site has shown intermittent availability and the company may have pivoted (a separate `collab.match.app` and the related `collabmatch.app` exist for creator/brand matching, which is a different product).
2. **Niche skew**: Heavy on Business, Tech, Health, and Web3. If your newsletter is in another niche, matches will be slow or unavailable.
3. **No API, webhooks, Zapier, or Make**: All matching and outreach is manual through the web UI. Don't plan automated swap pipelines around it.
4. **Tracking is on you**: No built-in UTM generation or click attribution — append `?utm_source=collabmatch&utm_medium=crosspromo&utm_campaign={partner}` to your swap links and tag those subscribers in your ESP.
5. **Match scale limit**: Manual weekly matching doesn't scale past ~10K subs — switch to SparkLoop paid recommendations or Beehiiv Boosts when swaps stop driving meaningful growth.
6. **Public profile pages are scrapeable**: `collabmatch.io/newsletter/{slug}` pages are public, so you can find newsletter owners and pitch outside the platform — but this also means competitors can scrape your profile.

## Related skills

- `/sales-audience-growth` — Newsletter audience growth strategy (cross-promotion across platforms, referrals, lead magnets)
- `/sales-newsletter` — Newsletter monetization (sponsorships, paid subs, ad networks)
- `/sales-lettergrowth` — Lettergrowth cross-promotion directory (1,300+ newsletters, larger alternative)
- `/sales-sparkloop` — SparkLoop paid and free recommendations (any ESP, automated)
- `/sales-refind` — Refind CPA-based newsletter ad network (tech audience)
- `/sales-beehiiv` — Beehiiv Boosts (automated cross-promo for Beehiiv newsletters)
- `/sales-kit` — Kit Creator Recommendations (Kit-only cross-promo)
- `/sales-ghost` — Ghost Recommendations (Ghost-to-Ghost cross-promo)
- `/sales-sponsorthis` — Sponsor This Newsletter (530+ newsletters database, includes cross-promo openness flags)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Picking between Collab Match and Lettergrowth
**User says**: "I have a 1,200-subscriber Web3 newsletter. Should I use Collab Match or Lettergrowth?"
**Skill does**: Notes Collab Match's heavy Web3 skew makes it a strong fit at this size, but the smaller directory (~200) means fewer total matches. Suggests listing on both — Collab Match for niche-relevant partners, Lettergrowth for breadth — and tracking which source drives better-fit subscribers.
**Result**: User lists on both directories and tags swap-sourced subs by source in their ESP.

### Example 2: Outreach to a newsletter found via the public directory
**User says**: "I found a newsletter on collabmatch.io/newsletter/{slug} I want to swap with. How do I reach them?"
**Skill does**: Explains the public page may not expose a direct email — recommends signing up for Collab Match to use the in-platform matching, or finding the owner via their newsletter signup confirmation, X/LinkedIn, or website footer. Provides a short outreach template that references the Collab Match profile to establish swap intent.
**Result**: User has a credible first-touch message that signals serious intent rather than spam.

### Example 3: Automating swap tracking when no API exists
**User says**: "How do I track which subscribers came from my Collab Match swaps in Beehiiv?"
**Skill does**: Walks through manual UTM tagging (`?utm_source=collabmatch&utm_medium=crosspromo&utm_campaign={partner}`), shows how to use Beehiiv's UTM-based subscriber tagging to segment swap-sourced subs, and recommends comparing 30-day open rates vs organic to measure swap quality. Notes that without an API, automation stops at the link level.
**Result**: User has a tag-based attribution flow despite Collab Match having no programmatic surface.

## Troubleshooting

### Not getting matches after signing up
**Symptom**: Profile is live but no swap suggestions arriving
**Cause**: Small directory (~200) and niche dependence — if your category is outside Business/Tech/Health/Web3, partner pool is thin. Matching also runs in weekly batches, not real-time.
**Solution**: Wait at least 2-3 weekly cycles. If still empty, browse public profile pages at `collabmatch.io/newsletter/` directly and do outreach manually. Also list on Lettergrowth for broader coverage.

### Site is unreachable or shows errors
**Symptom**: collabmatch.io won't load, times out, or returns connection refused
**Cause**: Small indie project with intermittent uptime. Multiple related-but-distinct products (`collab.match.app`, `collabmatch.app`) suggest the team may have shifted focus.
**Solution**: Check the founder's last public activity (Indie Hackers, X) to see if the project is still actively maintained. If it's been dormant for months, treat Collab Match as a dead lead and use Lettergrowth or SparkLoop instead.

### Swap drove subscribers but they don't engage
**Symptom**: New subscribers from a Collab Match swap have low open rates and high unsubscribes
**Cause**: Niche or audience-stage mismatch — partner's audience cares about adjacent but distinct topics, or your value proposition didn't land in their format.
**Solution**: Tag swap-sourced subs separately in your ESP, sunset non-openers after 30 days, and tighten partner criteria (0.5x-2x your size, adjacent niche, ask for their open rate before swapping). Also test different swap formats — dedicated recommendation outperforms a brief mention.
