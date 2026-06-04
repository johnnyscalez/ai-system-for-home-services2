# Collab Match Platform Reference

<!-- Source: https://collabmatch.io (intermittent availability — site returned ECONNREFUSED during last research; details below combine the platform's public directory pages, founder posts on Indie Hackers, and third-party comparisons. Verify with current site if possible.) -->

## Overview

Collab Match (collabmatch.io) is a niche newsletter cross-promotion matching directory. Newsletter operators list a profile, the platform proposes weekly swap matches based on size and niche, and partners coordinate the swap manually. Built by Michael (background in Web3 tools and a 3,000-sub Web3 newsletter), beta launched December 2022. ~200 newsletters in directory at last visible count.

## Capabilities & automation surface

- **Profile listing** (UI-only): Newsletter title, niche, subscriber count, audience description, ideal partner criteria. Profile creates a public page at `collabmatch.io/newsletter/{slug}` (e.g., `collabmatch.io/newsletter/podup`).
- **Weekly matching** (UI-only): The platform proposes partner matches based on similar size + complementary niche on a weekly cadence. Match suggestions arrive in-platform.
- **Public newsletter directory** (UI-only, but scrapeable): Each listed newsletter has a public-indexed page — useful for off-platform discovery and outreach.
- **Swap coordination** (UI-only): No built-in messaging, no tracked links, no automated send. Coordination happens via direct contact between partners.
- **No API / No webhooks / No Zapier / No Make / No MCP**: All automation must be built around UTM-tagged links in your own ESP.

## Pricing, limits & plan gates

<!-- Pricing not publicly disclosed at time of research — best-effort -->

- **Listing and matching**: Free during beta — pricing was not publicly disclosed.
- **No paid tier observed**: Unlike SparkLoop (paid recs share revenue) or Beehiiv Boosts (per-sub CPA), Collab Match doesn't appear to monetize matches.
- **Niche coverage**: Best for Business, Tech, Health, and Web3 newsletters. Other niches have very thin partner pools.
- **Scale ceiling**: Manual swap workflow caps useful activity around ~10K subscribers — at that scale, automated platforms (SparkLoop, Beehiiv Boosts) drive more swaps per hour spent.

## Integrations

- **None native**: No CRM connectors, no ESP integrations, no Zapier/Make modules.
- **DIY tracking**: Append UTM parameters to swap links and segment in your ESP. Example: `?utm_source=collabmatch&utm_medium=crosspromo&utm_campaign={partner-slug}`.
- **Profile sharing**: Public directory page can be linked from your media kit or sponsorship pitches as proof of swap activity.

## Data model

Collab Match exposes no public API, so there is no documented schema. Inferred from public directory pages:

```json
<!-- Constructed from public profile pages — verify against live site -->
{
  "newsletter": {
    "slug": "podup",
    "name": "Podup Newsletter",
    "url": "https://collabmatch.io/newsletter/podup",
    "niche": "Tech / Podcasting",
    "subscriber_count_range": "1K-5K",
    "audience_description": "Podcasters and audio content creators",
    "ideal_partner_criteria": "Adjacent creator tools, tech, marketing",
    "open_to": ["swap", "shoutout", "dedicated"]
  }
}
```

## Quick-start recipes

### Recipe 1: List your newsletter for swaps
1. Visit collabmatch.io and create a profile.
2. Enter title, signup URL, subscriber count, niche (pick the closest of Business / Tech / Health / Web3 / other).
3. Write a one-paragraph audience description focused on demographics, interests, and what they buy — partners filter on this.
4. Specify ideal partner: target size range (0.5x-2x your size is the rule of thumb), niche adjacency, and swap type (mutual shoutout, dedicated recommendation, cross-promo banner).
5. Wait for weekly match suggestions.

**Gotcha**: Profile descriptions that read like a pitch underperform. Lead with what the audience cares about, not why your newsletter is great.

### Recipe 2: Track swap performance without an API
1. Generate a unique swap URL per partner: `https://yournewsletter.com/subscribe?utm_source=collabmatch&utm_medium=crosspromo&utm_campaign={partner-slug}`.
2. In your ESP (Beehiiv, Kit, MailerLite), enable UTM-based subscriber tagging — most ESPs auto-tag signups with UTM source if configured.
3. After the swap runs, pull a count of subs tagged `utm_source=collabmatch` plus the partner campaign value.
4. Compare 30-day open rate vs your organic average. Swap-sourced opens below 50% of organic = poor partner fit.

```bash
# Example: pulling Beehiiv subs filtered by UTM source via Beehiiv API (see /sales-beehiiv)
curl -X GET "https://api.beehiiv.com/v2/publications/{pub_id}/subscriptions?utm_source=collabmatch" \
  -H "Authorization: Bearer $BEEHIIV_API_KEY"
```

### Recipe 3: Outreach to a newsletter found via public directory page
1. Visit `collabmatch.io/newsletter/{slug}`.
2. Note the niche and audience description for reference.
3. Find the owner's contact via: their newsletter's signup confirmation, the newsletter homepage, X/LinkedIn (search the newsletter name), or by signing up and replying to the welcome email.
4. Send a short pitch referencing the Collab Match listing to signal swap intent (not cold spam).

Template:
> Hey {name} — saw your Collab Match listing for {newsletter}. I run {your newsletter} — similar size, complementary niche ({why}). Open to a mutual recommendation swap next month? Happy to send first if helpful.

## Integration patterns

Since Collab Match has no programmatic surface, "integration" means:

- **Subscriber attribution**: UTM-based tagging in your ESP, periodic comparison of swap-sourced subscriber LTV vs organic.
- **Partner CRM**: Keep a lightweight CRM (Notion, Airtable, even a spreadsheet) tracking partner name, swap date, subs delivered, open rate, willingness to repeat. Without this, you'll re-pitch the same partners and miss reciprocation gaps.
- **Multi-directory layering**: Pair Collab Match (niche/Web3) with Lettergrowth (1,300+ broader directory), SparkLoop Free Recommendations (automated, any ESP), and ESP-native cross-promo (Beehiiv Boosts, Kit Creator Recs, Ghost Recommendations) to remove single-directory dependence.

## Comparison with alternatives

| Tool | Directory size | Niches | Automation | Cost | Best for |
|---|---|---|---|---|---|
| **Collab Match** | ~200 newsletters | Business, Tech, Health, Web3 | None | Free (beta) | Web3/tech newsletters under 10K subs |
| **Lettergrowth** | 1,300+ | Broad | None | Free | General-purpose swap discovery |
| **SparkLoop Free Recs** | Variable (matched) | Any | Automated post-opt-in | Free | Any-ESP automated swap layer |
| **SparkLoop Paid Recs** | Variable | Any | Automated | 20% + 3.5% fees | Monetizing the post-opt-in slot |
| **Beehiiv Boosts** | Beehiiv-only | Any | Automated | Per-sub CPA | Beehiiv newsletters at any scale |
| **Kit Creator Recs** | Kit-only | Any | Automated | Free for both sides | Kit newsletters |
| **Ghost Recommendations** | Ghost-only | Any | Manual | Free | Ghost newsletters |
| **Refind (cross-promo)** | Refind-curated | Tech/knowledge | Manual | Free reciprocal | Tech newsletter visitor exchange |

## When to use Collab Match

- Web3, crypto, fintech, or dev-tool newsletter under 5K subs
- You want a no-cost manual swap layer and don't mind low volume
- You've already listed on Lettergrowth and want incremental niche coverage
- You're not on Beehiiv/Kit/Ghost and SparkLoop Free Recs isn't producing matches

## When NOT to use Collab Match

- Newsletter is 10K+ subscribers (manual matching doesn't scale)
- Niche is outside Business/Tech/Health/Web3 (thin partner pool)
- You need automated, programmatic swap pipelines (no API, no webhooks)
- The site is currently down or shows signs of project abandonment — recheck activity before investing setup time
