# InboxReads Platform Reference

<!-- Source: https://inboxreads.co (homepage, /pro, /discover, /changelog, /best-crosspromotion-newsletters, /tools/letterwell/alternatives) — research date 2026-05-30. Pricing and feature gates may shift; verify against the current /pro page before quoting hard numbers. -->

## Overview

InboxReads (inboxreads.co) is a newsletter directory plus growth platform. It pairs a searchable database of 5,600+ newsletters (across 40+ topics, 12K+ registered creators) with creator tools: 1-click cross-promotion swaps, an Opportunities Board for sponsorships and cross-promo deals, auto-generated Live Media Kits, ad pricing suggestions, competitor tool analysis, and a "newsletters for sale" marketplace. Serves both publishers (growth, monetization, acquisition) and advertisers (discovery, sponsor research). No public API.

## Capabilities & automation surface

- **Newsletter discovery directory** (UI-only): 5,600+ newsletters across 40+ topics. Filter by niche, subscriber count, open rate. Detailed metrics (subscriber count, open rate, click rate, trending signal) are Pro-only.
- **1-Click Cross Promotions** (UI-only, shipped Feb 2026): Set up newsletter swaps directly from the dashboard. No automated tracking — you supply UTM tags manually.
- **Opportunities Board** (UI-only, shipped Mar 2026): Marketplace for sponsorships, software deals, and cross-promo opportunities. Creators post listings; matches are surfaced based on niche and metrics.
- **Live Media Kits** (UI-only, shipped Feb 2026): Auto-generated shareable URL displaying current metrics. Functions as a sponsorship "resume" — link from your newsletter footer or media outreach.
- **Ad Pricing Suggestions** (UI-only, shipped Mar 2026): Suggests sponsorship rate ranges based on your metrics (subs, open rate, niche). Useful starting point for pricing — verify against Paved/Hecto marketplace rates.
- **Trending Newsletter Topics** (UI-only, shipped May 2026): Surfaces high-demand niches with growth potential and lower competition. Editorial signal, not a guarantee.
- **Competitor Tool Analysis** (UI-only, shipped Apr 2026): Dashboard showing tools used by similar newsletters that you're not using. Adjacency-based recommendation engine.
- **Newsletter acquisition marketplace** (UI-only): "Newsletters for Sale" listings. Creator-claimed metrics — always require proof before transacting.
- **Tools directory** (UI-only): 100+ newsletter tools catalogued with reviews, comparisons, and alternative roundups. SEO content hub, not unbiased reviews.
- **Email alerts** (UI-only, Pro+): Notified when new newsletters match your criteria.
- **CSV exports** (UI-only, Basic+): Only programmatic-ish surface for getting data out. 5/month on Basic, unlimited on Team.
- **No API / No webhooks / No Zapier / No Make / No MCP server**: Confirmed via changelog and official tool catalog. Plan for manual export-driven workflows.

## Pricing, limits & plan gates

<!-- Best-effort from inboxreads.co/pro at research time — verify before quoting -->

| Plan | Price | Messages | Searches | Collections | Email alerts | Exports | Team seats | Notes |
|---|---|---|---|---|---|---|---|---|
| Free | $0 | 0 (browse only) | Basic | 0 | 0 | 0 | 1 | Directory browsing + Tools directory |
| **Lite** | $8/mo or $90/yr | 10/mo | 100/mo | 1 | 1 | 0 | 1 | Stats, submission analytics |
| **Basic** (Recommended) | $33/mo or $400/yr | Unlimited | Unlimited | Unlimited | 5 | 5/mo | 1 | + Read receipts, custom subjects, 5 message templates |
| **Team** | $58/mo or $700/yr | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited | 5 | + Shared team collections, unlimited templates |

**Annual billing**: ~2 months free vs monthly.

**Plan-gated feature highlights**:
- Subscriber/open/click rate analytics — Lite+
- Cross-promotion messaging — Lite+ (capped at 10/mo)
- Unlimited search & messaging — Basic+
- CSV exports — Basic+ (5/mo) → unlimited on Team
- Shared team collections — Team only

## Integrations

- **None native**: No CRM connectors, no ESP plugins, no Zapier/Make modules, no MCP server.
- **Tool catalog**: InboxReads is itself a directory of newsletter tools — it references beehiiv, MailerLite, ConvertKit/Kit, SparkLoop, Paved, Sponsy, etc., but doesn't integrate them.
- **Export-driven workflows**: CSV exports (Basic+) → import into HubSpot/Salesforce/Mailshake/Smartlead/Lemlist manually.

## Data model

InboxReads exposes no public API, so no documented schema. Inferred from the platform's public listings:

```json
<!-- Constructed from public listings — verify against live UI -->
{
  "newsletter": {
    "name": "Example Newsletter",
    "url": "https://example.com",
    "topics": ["Finance", "Investing"],
    "subscriber_count": 8500,
    "open_rate": 0.42,
    "click_rate": 0.038,
    "trending_signal": "rising",
    "open_to": ["cross_promotion", "sponsorship", "affiliate"],
    "ad_pricing_suggestion_usd": { "min": 120, "max": 280 },
    "live_media_kit_url": "https://inboxreads.co/newsletter/{slug}/media-kit"
  },
  "opportunity": {
    "type": "sponsorship | cross_promotion | software_deal",
    "newsletter_slug": "example-newsletter",
    "category": "Finance",
    "subscriber_band": "5K-10K",
    "ask": "Looking for fintech sponsors with $500-$2K budget",
    "posted_at": "2026-05-30T00:00:00Z"
  }
}
```

## Quick-start recipes

### Recipe 1: Set up a Live Media Kit and share it with sponsors

1. From the InboxReads dashboard, claim your newsletter listing (or create a new one).
2. Enter or verify subscriber count, open rate, click rate, niche tags, and audience description.
3. InboxReads auto-generates a Live Media Kit URL — copy it.
4. Paste the URL into your newsletter footer ("Sponsor this newsletter") and into the Opportunities Board listing.
5. When pitching sponsors, link the Media Kit instead of a static PDF — it stays current.

**Gotcha**: The Media Kit shows your *claimed* metrics. Don't inflate — sponsors compare against post-campaign reports and one inflated kit will burn the relationship.

### Recipe 2: Export newsletter prospects to a CRM (no API path)

1. On Basic+, filter the directory: niche + subscriber band + cross-promo or sponsorship flag.
2. Save the filter as a collection.
3. Export to CSV (5/mo Basic, unlimited Team).
4. Map columns to your CRM/outreach tool:
   - `name` → company name
   - `contact_email` → email (if exposed; otherwise enrich via Hunter/Anymail Finder)
   - `subscriber_count` → custom property
   - `topics` → tags or list segment
5. Run outreach via Mailshake/Smartlead/Lemlist with personalization tokens.

```bash
# No API, so no cURL. Closest you get is automating the import side:
csvkit | csvjoin | jq | curl -X POST "https://api.hubapi.com/contacts/v1/contact/batch" \
  -H "Authorization: Bearer $HUBSPOT_TOKEN" -d @contacts.json
# Run InboxReads export → format with jq → push to HubSpot in batch.
```

```python
# Python: parse exported CSV and push to HubSpot
import csv, requests, os
with open("inboxreads-export.csv") as f:
    rows = list(csv.DictReader(f))
for row in rows:
    payload = {
        "properties": [
            {"property": "email", "value": row["contact_email"]},
            {"property": "company", "value": row["newsletter_name"]},
            {"property": "newsletter_subscribers", "value": row["subscriber_count"]},
            {"property": "newsletter_topics", "value": ",".join(row["topics"].split("|"))},
        ]
    }
    requests.post(
        "https://api.hubapi.com/contacts/v1/contact/createOrUpdate/email/" + row["contact_email"],
        headers={"Authorization": f"Bearer {os.environ['HUBSPOT_TOKEN']}", "Content-Type": "application/json"},
        json=payload,
    )
```

**Gotcha**: Many directory entries don't expose a direct contact email — they show the newsletter's sign-up URL only. Enrich with Hunter, Anymail Finder, or by replying to the newsletter's welcome email.

### Recipe 3: Run a tracked cross-promotion swap

1. From the InboxReads dashboard, browse partner candidates in your niche, filtered to 0.5x-2x your size.
2. Send a swap pitch via 1-Click Cross Promotion. Reference the partner's Media Kit metrics to signal you did your homework.
3. Before sending the swap, append UTM parameters to your subscribe link:
   `https://yournewsletter.com/subscribe?utm_source=inboxreads&utm_medium=crosspromo&utm_campaign={partner-slug}`
4. Configure UTM-based subscriber tagging in your ESP (Beehiiv, Kit, MailerLite all support it).
5. After 30 days, compare swap-sourced subscriber open rate to your organic baseline. Sunset non-openers; rebook with high-fit partners.

**Gotcha**: InboxReads doesn't auto-tag swap traffic. Without UTMs, you'll lose attribution and can't tell which swaps were worth it.

## Integration patterns

Since InboxReads has no programmatic surface, "integration" means:

- **Manual ETL via CSV**: Filter → save collection → export → transform → import into CRM/outreach. Build this as a monthly batch job.
- **Live Media Kit as static link**: Embed the URL anywhere you currently link a media kit PDF. It stays current — no version maintenance.
- **Subscriber-side attribution in ESP**: UTM-tag all swap and Opportunities Board traffic. Segment InboxReads-sourced subs and measure 30-day engagement vs organic.
- **Combine with marketplace tools**: InboxReads for discovery + Media Kit, Paved/Hecto for paid placement, Sponsy for sponsor CRM/ops. InboxReads becomes the "top of funnel" research layer, not the system of record.

## Comparison with alternatives

| Tool | Primary use | Directory size | API | Pricing | Best for |
|---|---|---|---|---|---|
| **InboxReads** | Directory + Opportunities Board + Media Kits | 5,600+ | ❌ | Free / $8 / $33 / $58 | Publishers wanting discovery + sponsor pitch tooling |
| **Lettergrowth** | Cross-promo directory | 1,300+ | ❌ | Free | Free swap partner discovery |
| **Collab Match** | Niche cross-promo (Web3/tech) | ~200 | ❌ | Free | Web3/tech swap partners |
| **Reletter** | Newsletter search engine | 7M+ | ✅ + MCP | $49/mo+ | Scale discovery with automation |
| **Paved** | Managed sponsorship marketplace | ~700 publications | Partial | Take rate | Programmatic ad placement |
| **Hecto** | Self-serve sponsorship marketplace | Growing | ❌ | Take rate | Transparent direct deals |
| **Sponsy** | Sponsorship CRM / ops | n/a | ❌ | $19+/mo | Managing booked sponsors |
| **SparkLoop Free Recs** | Automated cross-promo | Network-wide | ❌ | Free | Any-ESP automated swaps |
| **Sponsor This Newsletter** | Curated 530-newsletter database | 530 | ❌ | One-time | Quick advertiser-side discovery |

## When to use InboxReads

- Solo publisher 1K-50K subs wanting a single dashboard for discovery + cross-promo + sponsor pitching
- Sponsor-side researcher needing a directory with metrics filtering
- Newsletter operator pricing their first ad slot — Ad Pricing Suggestions give a starting range
- Publisher running active outreach who needs Live Media Kits and shareable directory pages
- Buyer or seller exploring the newsletter acquisition marketplace

## When NOT to use InboxReads

- You need a programmatic pipeline — there's no API, webhooks, or Zapier
- You're already on Paved + Sponsy + Lettergrowth — you'll mostly duplicate workflows
- You need verified, real-time metrics — Pro analytics are creator-submitted and can lag
- You want totally free cross-promo only — Lettergrowth + SparkLoop Free Recs cover that
