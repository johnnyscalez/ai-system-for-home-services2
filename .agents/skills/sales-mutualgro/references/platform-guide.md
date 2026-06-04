# MutualGro Platform Reference

<!-- Source: https://www.mutualgro.com (homepage + pricing + how-it-works + blog content). Research date 2026-05-30. Pricing in GBP and feature gates may shift; verify against the current /pricing page before quoting hard numbers. -->

## Overview

MutualGro (mutualgro.com) is a UK-based creator collaboration platform. Indie founders, newsletter operators, and creators build a profile listing projects + skills + collaboration interests; an AI-powered matching algorithm proposes complementary partners; the platform handles partnership proposals, messaging, and scheduled X/LinkedIn swap posts. Differentiator vs newsletter-only directories: accepts non-newsletter project types and includes built-in scheduled social posting for partner-coordinated content.

## Capabilities & automation surface

- **Profile setup** (UI-only, both tiers): Projects, skills, collaboration interests, what you offer + what you're looking for. Drives all matching.
- **Project showcase** (UI-only): Public listings of each project — 1 on Free Explorer, unlimited on Collaborator.
- **Smart matching** (UI-only): Manual browse on Free Explorer. AI-powered ranked matching on Collaborator.
- **Partnership proposals** (UI-only, both tiers): Structured proposal flow from one creator to another. Includes proposed format, timing, ask.
- **Messaging** (UI-only, both tiers): In-platform conversations between matched partners.
- **Growth scoring** (UI-only, both tiers): Combines self-reported audience size + on-platform activity into a per-profile score.
- **Scheduled posting to X + LinkedIn** (UI-only, Collaborator only): Schedule swap posts to publish on partner-coordinated dates.
- **Auto-scheduled AI-generated post copy** (UI-only, Collaborator only): AI drafts the swap post; user edits before scheduling.
- **Partnership intelligence dashboard** (UI-only, Collaborator only): Surfaces success tracking, engagement on swap posts, partner growth signals.
- **Priority discovery placement** (Collaborator only): Higher rank in other creators' match feeds.
- **Project boosts** (Collaborator only): Temporary visibility lift on a specific project.
- **No API / No webhooks / No Zapier / No Make / No MCP server.** Confirmed via WebSearch — no developer documentation surfaces.

## Pricing, limits & plan gates

<!-- Best-effort from mutualgro.com/pricing at research time — verify before quoting. Prices in GBP. -->

| Plan | Price | Projects | Matching | Posting | Dashboard | Notes |
|---|---|---|---|---|---|---|
| **Explorer** | Free | 1 | Manual browse | None | Basic | Unlimited partnership requests, partnership proposals, growth scoring |
| **Collaborator** | £3.99/mo or £47.90/yr (~$5/mo, ~$60/yr at current rates) | Unlimited | AI-powered smart matching | Scheduled X + LinkedIn + AI copy | Partnership intelligence dashboard | + Priority discovery placement, success tracking, project boosts |
| **Custom** | Contact sales | Custom | Custom | Custom | Custom | For enterprises and agencies managing multiple brands |

**Annual billing**: ~12 months for the price of 12 (the £47.90/yr math is essentially flat — no advertised annual discount, just the monthly rate × 12).

## Integrations

- **Native social posting** to X (Twitter) and LinkedIn — Collaborator tier. OAuth-style connection through MutualGro settings.
- **No CRM connectors, no ESP plugins, no Zapier/Make modules, no MCP server.** No data export documented either.
- **Manual workflows only.** Any pipeline that needs to leave the platform (CRM sync, subscriber tagging, analytics export) is DIY via UTM tags on swap links.

## Data model

MutualGro exposes no public API, so no documented schema. Inferred from the UI and pricing page:

```json
<!-- Constructed from public UI and pricing page — verify against live app -->
{
  "creator_profile": {
    "handle": "example-creator",
    "name": "Example Creator",
    "bio": "Independent B2B SaaS founder",
    "growth_score": 73,
    "what_i_offer": ["B2B SaaS audience", "newsletter swap", "X shoutout"],
    "what_im_looking_for": ["GTM founders", "indie SaaS", "audience 1K-10K"],
    "projects": [
      {
        "name": "My SaaS Newsletter",
        "type": "newsletter",
        "audience_size": 2100,
        "audience_size_self_reported": true,
        "url": "https://mynewsletter.com",
        "collab_formats": ["swap", "shoutout", "joint_launch"]
      }
    ]
  },
  "match": {
    "ranked_by": "ai_compatibility",
    "score": 0.81,
    "rationale": "Adjacent niche, complementary audience size, overlapping interests"
  },
  "partnership_proposal": {
    "to_creator": "other-creator-handle",
    "format": "newsletter_swap | shoutout | joint_launch",
    "proposed_date": "2026-06-15",
    "ask": "Mutual newsletter recommendation in next issue",
    "status": "proposed | accepted | declined | completed"
  },
  "scheduled_post": {
    "platform": "x | linkedin",
    "content": "Excited to recommend ...",
    "scheduled_for": "2026-06-15T14:00:00Z",
    "partner_handle": "other-creator-handle"
  }
}
```

## Quick-start recipes

### Recipe 1: Set up your MutualGro profile for high-quality matches

1. Sign up for Free Explorer at mutualgro.com.
2. Create one project — newsletter, SaaS, podcast, etc. — with audience size, URL, and 3 collab formats you're open to (swap, shoutout, joint launch).
3. Fill "what I offer" with niche-specific keywords: audience description, ad rate range if a newsletter, growth stage. Avoid generic terms like "marketing" or "tech."
4. Fill "what I'm looking for" with target partner traits: niche adjacency, audience size band, collab format preferences.
5. Set growth score expectations — let MutualGro calculate it from your self-reported metrics + activity.

**Gotcha**: Vague profiles get vague matches. Specific niches + specific asks outperform polished bios.

### Recipe 2: Run a tracked cross-promotion swap without an API

1. Match with a partner via the matching feed or direct search.
2. Send a partnership proposal: format (swap), date, ask.
3. Once accepted, generate a unique swap URL per partner: `https://yournewsletter.com/subscribe?utm_source=mutualgro&utm_medium=crosspromo&utm_campaign={partner-handle}`.
4. (Collaborator only) Schedule the X / LinkedIn swap post in MutualGro to publish on the agreed date — let AI draft the copy, then edit for voice.
5. In your ESP (Beehiiv, Kit, MailerLite), enable UTM-based subscriber tagging on the subscribe page.
6. After 30 days, compare swap-sourced subscriber open rate to your organic baseline. Sunset non-openers; rebook high-quality partners.

```bash
# No MutualGro API — closest you get is pulling tagged subs from your ESP:
curl -X GET "https://api.beehiiv.com/v2/publications/{pub_id}/subscriptions?utm_source=mutualgro" \
  -H "Authorization: Bearer $BEEHIIV_API_KEY"
```

```python
# Python: pull MutualGro-sourced subs from Beehiiv and push to HubSpot
import os, requests
subs = requests.get(
    f"https://api.beehiiv.com/v2/publications/{os.environ['BEEHIIV_PUB_ID']}/subscriptions",
    params={"utm_source": "mutualgro"},
    headers={"Authorization": f"Bearer {os.environ['BEEHIIV_API_KEY']}"},
).json()["data"]
for sub in subs:
    requests.post(
        f"https://api.hubapi.com/contacts/v1/contact/createOrUpdate/email/{sub['email']}",
        headers={"Authorization": f"Bearer {os.environ['HUBSPOT_TOKEN']}", "Content-Type": "application/json"},
        json={"properties": [
            {"property": "newsletter_source", "value": "mutualgro"},
            {"property": "mutualgro_partner", "value": sub.get("utm_campaign", "")},
        ]},
    )
```

**Gotcha**: MutualGro doesn't auto-tag swap traffic. Without UTMs, you have no attribution.

### Recipe 3: Decide between Free Explorer and Collaborator after 2 weeks

1. Log in to Free Explorer; spend 15 minutes/week browsing matches and sending 3-5 partnership requests.
2. After 14 days, count: accepted partnerships, completed swaps, swap-sourced subscribers.
3. If you got ≥1 successful swap and matching feels promising, upgrade to Collaborator (£3.99/mo) for AI matching + scheduled posting — typically pays for itself with 1 swap per quarter.
4. If matches were sparse, MutualGro's pool isn't deep enough for your niche yet. Stay on Free or pause.

**Gotcha**: Don't upgrade in week 1 — Free Explorer is enough to validate fit.

## Integration patterns

Since MutualGro has no programmatic surface, "integration" means:

- **Manual partner CRM**: Track partners in Notion/Airtable/Google Sheet with name, swap date, format, subs delivered, open rate, willingness to repeat.
- **UTM-driven subscriber attribution** in your ESP: tag every swap link, segment swap-sourced subs, measure 30-day engagement.
- **Multi-platform layering**: Pair MutualGro (AI matching + scheduled posting) with Lettergrowth (free broad directory), Collab Match (Web3/tech niche), and SparkLoop Free Recs (automated ESP-side matching) for redundancy.
- **Scheduled posting as a content layer**: MutualGro's X/LinkedIn scheduler is collab-scoped. For your own content calendar, keep Buffer/Hypefury/Typefully.

## Comparison with alternatives

| Tool | Primary use | Partner pool | AI matching | Posting automation | API | Pricing | Best for |
|---|---|---|---|---|---|---|---|
| **MutualGro** | Creator collab (newsletter + founder + creator) | Newer / smaller | ✅ Paid tier | ✅ X + LinkedIn (paid) | ❌ | Free / £3.99/mo (~$5) / Custom | Multi-project creators wanting matching + posting in one tool |
| **Lettergrowth** | Newsletter cross-promo directory | 1,300+ newsletters | ❌ | ❌ | ❌ | Free | Free broad newsletter swap discovery |
| **Collab Match** | Newsletter cross-promo (niche) | ~200 newsletters | ❌ | ❌ | ❌ | Free | Web3/tech newsletter swap partners |
| **InboxReads** | Newsletter directory + Opportunities Board | 5,600+ newsletters | ❌ | ❌ | ❌ | Free / $8 / $33 / $58 | Discovery + sponsor pitching + Media Kits |
| **SparkLoop Free Recs** | Automated post-opt-in swaps | Network-wide | ✅ Automated | N/A (post-opt-in widget) | ❌ | Free | Any-ESP automated swap layer |
| **SparkLoop Paid Recs** | Monetize the post-opt-in slot | Network-wide | ✅ Automated | N/A | ❌ | 20% + 3.5% fees | Newsletter revenue from recommendations |

## When to use MutualGro

- Multi-project creator (newsletter + side product + course) wanting one tool for all partner discovery
- Indie SaaS founder wanting to swap with other founders (Lettergrowth and Collab Match are newsletter-only)
- Newsletter operator who wants AI matching + scheduled X/LinkedIn posting bundled in one £3.99/mo subscription
- Free-tier validator — Explorer gives enough surface to test partner density before paying

## When NOT to use MutualGro

- You need a programmatic pipeline (no API, no webhooks, no Zapier)
- You're already paying for InboxReads + SparkLoop and have a working stack — MutualGro adds posting automation but overlaps on discovery
- You only do newsletter swaps and Lettergrowth's free directory is already covering you
- You need >5,000 partner inventory immediately — MutualGro is newer and the pool is still growing
