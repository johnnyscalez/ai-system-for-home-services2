# Sponsor This Newsletter Platform Reference

## Overview

Sponsor This Newsletter is a curated Airtable database of 530+ newsletters that accept sponsorships, built by MakerBox (Dan Kulkov & Sveta Bay, also behind Founderpal.ai). It's designed for startup founders, creators, and agency owners who want to find newsletters to buy ad placements in. One-time purchase with lifetime access.

## Capabilities & automation surface

| Capability | Access |
|---|---|
| Newsletter database browsing | UI-only (Airtable) |
| Filtering by niche, subscriber count, price, open rate | UI-only (Airtable) |
| CSV/Excel export | UI-only (Airtable native export) |
| Cross-promotion indicator | UI-only (91% of newsletters flagged) |
| Affiliate marketing indicator | UI-only (73% of newsletters flagged) |
| API | None |
| Webhooks | None |
| Zapier/Make | None |
| MCP server | None |

**No public API** — all access is through the Airtable interface. Airtable's own API could theoretically be used if you have the base URL, but this is not officially supported by the product.

## Pricing, limits & plan gates

- **One-time payment**: Lifetime access to the database (exact price not publicly listed on the website — typically in the $49-97 range based on Product Hunt launch data)
- **Includes**: $197 training bonus on newsletter sponsorship funnel building
- **No subscription**: No recurring fees, no plan tiers
- **No free trial**: Purchase required for database access
- **No refund policy documented**

## Database contents

The Airtable database includes these data points per newsletter:

| Field | Description |
|---|---|
| Newsletter name | Publication name |
| Niche/category | Topic area (startup, marketing, tech, etc.) |
| Subscriber count | Average ~5,030 across the database |
| Open rate | Average 44% across the database |
| Click-through rate | Average 6% across the database |
| Median ad price | ~$70 across the database |
| Cross-promotion open | 91% of newsletters flagged yes |
| Affiliate marketing open | 73% of newsletters flagged yes |
| Contact info | Newsletter owner/editor contact |

<!-- Constructed from product descriptions — verify against live database -->

## Database statistics

- 530+ newsletters (expanded from 100+ at launch in Oct 2022)
- 56 newsletters under 1,000 subscribers (affordable sponsorship entry point)
- Curated for startup founders, creators, and agency owners
- Hand-picked and filtered (100+ hours of curation per MakerBox)

## Integrations

No native integrations. Workaround options:

1. **Airtable CSV export** → import into outreach tool (Lemlist, Mailshake, Smartlead)
2. **Airtable duplicate** → copy base to your own Airtable workspace for custom views/filters
3. **Manual copy** → copy individual newsletter contacts into your CRM

## Comparison with alternatives

| Feature | Sponsor This Newsletter | Reletter | Paved | SponsorGap | SponsorLeads |
|---|---|---|---|---|---|
| **Purpose** | Find newsletters to sponsor | Find newsletters by topic | Buy/sell newsletter ads | Find sponsors for your newsletter | Find sponsors for your newsletter |
| **Direction** | Brand → newsletter | Brand → newsletter | Both sides | Publisher → brands | Publisher → brands |
| **Database size** | 530+ newsletters | 7M+ publications | 3,000+ publishers | 38K+ brands | 4,318+ companies |
| **Pricing** | One-time (~$49-97) | $49/mo (API plan) | Commission-based | $39-$199/mo | $97/mo |
| **API** | None | REST API + MCP | None (publisher side) | REST API | None |
| **Real-time data** | No (snapshot) | Yes (indexed) | Yes (live marketplace) | Yes (monitored) | Yes (weekly updates) |
| **Cross-promo data** | Yes (91% flagged) | No | No | No | No |
| **Affiliate openness** | Yes (73% flagged) | No | No | No | No |
| **Best for** | Quick curated start | Comprehensive search | Marketplace transactions | Sponsor intelligence | Sponsor lead lists |

## Outreach workflow

### From database to newsletter sponsor pitch

1. **Filter the database** — narrow by niche, subscriber count range, and ad price budget
2. **Export to CSV** — use Airtable's export feature
3. **Verify data** — check each newsletter's current subscriber count and open rate (data may be stale)
4. **Import to outreach tool** — map fields: newsletter name → company, contact → email, niche → custom field
5. **Personalize outreach** — reference specific newsletter content, explain product-audience fit
6. **Track results** — note which newsletters drive the most signups/traffic per dollar spent

### Outreach message framework

When pitching a newsletter for sponsorship:
- Reference a recent issue to show you actually read their content
- Explain why your product fits their audience (be specific)
- Propose a test placement with clear metrics you'll share back
- Offer flexible formats (dedicated send, inline mention, or classified)
- Include your budget range — transparency speeds up negotiation

## Limitations

- **Static database**: No real-time updates after purchase. Newsletter metrics change.
- **No automation surface**: Cannot programmatically query, filter, or sync the database.
- **Curated but small**: 530 newsletters is useful but not comprehensive — supplement with Reletter for broader search.
- **No sponsor intelligence**: Doesn't track ad creatives, spend trends, or competitor sponsorships (SponsorGap and Who Sponsors Stuff do).
- **No marketplace function**: You still need to do manual outreach — this is a directory, not a booking platform.
- **Website SSL issues**: sponsorthisnewsletter.com has intermittent SSL certificate errors.
