# Refind Platform Reference

## Overview

Refind is a content curation platform with 488K subscribers ("curious minds") that operates a CPA-based newsletter ad network. Newsletter creators can grow their list by advertising to Refind's audience, or earn money by promoting other newsletters to their own audience. Also offers free cross-promotion (reciprocal visitor exchange). No public API.

## Capabilities & automation surface

| Capability | Description | Access |
|---|---|---|
| Newsletter Ads (Growth) | Promote your newsletter to Refind's audience, pay only for engaged subscribers | UI-only (dashboard) |
| Newsletter Ads (Earning) | Promote other newsletters, earn per engaged subscriber/click | UI-only (dashboard) |
| Cross-promotion | Free reciprocal visitor exchange with other newsletters | UI-only (self-serve setup) |
| ESP engagement sync | Beehiiv API integration to track which subscribers open | Beehiiv API (automatic) |
| Refind Premium | Consumer subscription: ad-free, audio, library, search, Readwise/RSS | UI-only (consumer product) |

**No API, no webhooks, no Zapier/Make triggers, no MCP server.** The `/developers` page returns 404. The only programmatic integration is the Beehiiv API sync for engagement tracking (used to determine which subscribers count as "engaged" for billing).

## Pricing, limits & plan gates

### For advertisers (grow your newsletter)

| Setting | Details |
|---|---|
| Pricing model | CPA (cost per acquisition) — you set your price |
| Minimum bid | $1.50 per engaged subscriber |
| What counts as engaged | Subscriber who opens your emails (tracked via ESP sync) |
| Average payment rate | ~41% of subscribers sent — you only pay for the engaged ones |
| Targeting | Interests + geo |
| Ad format | Newsletter signup link appears as a recommendation in Refind's feed |
| Volume | Low — expect a few subscribers per day, not hundreds |

### For publishers (earn money)

| Setting | Details |
|---|---|
| Payout model | Per engaged subscriber (click-based) |
| Average payout | $1.91 per click |
| Effort | Autopilot — once set up, runs automatically |

### Cross-promotion (free)

| Setting | Details |
|---|---|
| Cost | Free |
| Mechanism | Reciprocal visitor exchange — you send visitors to partner, partner sends visitors to you |
| Matching | Automatic — Refind counts unique non-spam visits to your referral link and sends equal visits back |
| Scale | Works with any newsletter size |
| Partners | 100+ newsletters have cross-promoted via Refind |

### Refind Premium (consumer)

Ad-free reading, audio articles, library/collections, search across curated content, Readwise and RSS integrations, priority support. Pricing not publicly listed.

## Integrations

| Integration | Type | Notes |
|---|---|---|
| Beehiiv | API sync | Tracks which Refind-sourced subscribers open emails — determines "engaged" status for CPA billing |
| Any ESP | Manual | Tag Refind subscribers with UTM parameters for tracking. No native integration. |
| Readwise | Consumer feature | Premium subscribers can sync saved articles to Readwise |
| RSS | Consumer feature | Premium subscribers get RSS feed access |

**No Zapier triggers/actions.** No Make modules. No native CRM connectors. No webhooks.

## Data model

Refind does not expose a public API, so there is no programmatic data model. Key concepts:

- **Newsletter**: Your publication listed on Refind's network
- **CPA bid**: The maximum you'll pay per engaged subscriber
- **Engaged subscriber**: Someone who opens your emails after subscribing through Refind (tracked via ESP sync)
- **Cross-promotion visitor**: A unique, non-spam visit to your referral link from a partner

## Audience profile

Refind's 488K subscribers skew toward:
- **Interests**: Technology, software, data science, innovation, general knowledge
- **Education**: Higher than average — BA, Masters, PhD holders overrepresented
- **Engagement**: 11x higher click rate than subscribers acquired from other newsletters (per Refind's claims)
- **Geography**: Global, English-language

**Best fit**: B2C newsletters about tech, science, productivity, startups, AI, data. **Poor fit**: B2B enterprise, hyper-niche verticals, non-English, lifestyle/fashion.

## Quick-start recipes

### Recipe 1: Start a Refind Ads growth campaign

1. Go to refind.com/ads and click "Get started"
2. Choose "Grow" objective
3. Enter your newsletter signup URL
4. Set your CPA bid (start at **$1.50** minimum — don't overbid initially)
5. Select interest targeting that matches your newsletter's topic
6. Add geo targeting if your newsletter is region-specific
7. Launch and wait 1-2 weeks for data

**Tracking setup (do this FIRST):**
- Add UTM parameters to your signup URL: `?utm_source=refind&utm_medium=paid&utm_campaign=growth`
- Create an ESP tag/segment for Refind subscribers
- Monitor 7-day and 30-day open rates for this segment

**Optimization after 2 weeks:**
- Check how many subscribers you received vs how many you were billed for (~41% billing rate is average)
- Calculate your effective CPA: total spend / total engaged subscribers
- If eCPA > $5 and your niche is tech-adjacent, increase bid slightly
- If eCPA > $5 and your niche is NOT tech-adjacent, consider switching to SparkLoop or Paved

### Recipe 2: Set up free cross-promotion

1. Go to refind.com/cross-promotion
2. Sign in and submit your newsletter
3. Get your unique referral link
4. Add a mention of Refind in your newsletter (with your referral link)
5. Refind counts unique non-spam visits and sends equal visits back to your signup page

**Tips:**
- Place the mention naturally — a "Recommended reading" section works well
- Refind has cross-promoted with 100+ newsletters including Sidekick (Morning Brew), Nautilus, Every, Ness Labs
- This is a visitor exchange, not a subscriber exchange — optimize your landing page for conversion

### Recipe 3: Earn money as a Refind publisher

1. Go to refind.com/ads and choose "Earn" objective
2. Connect your newsletter
3. Refind will show high-quality newsletter recommendations to your audience
4. You earn per engaged subscriber/click (avg $1.91/click)

**Economics:** If you drive 100 clicks/month, expect ~$191/month. Volume depends on your audience size and engagement.

## Refind vs alternatives

| Feature | Refind | SparkLoop | Beehiiv Boosts | Paved |
|---|---|---|---|---|
| Model | CPA (engaged subs) | CPA (verified subs) | CPA (Beehiiv subs) | CPM / flat rate |
| Audience | 488K curated readers | 25+ ESP networks | Beehiiv network only | 3,000+ publishers |
| Quality filter | Pay for ~41% (openers) | Advanced quality scoring | Beehiiv engagement data | Publisher vetting |
| Volume | Low (few/day) | Medium-high | Medium | High |
| Min spend | $1.50/sub | Varies by partner | $0.50/sub min | Varies |
| Free option | Cross-promotion | Free referral program | Boosts (paid only) | No |
| API | None | Yes (webhooks + API) | Yes (Beehiiv API) | Yes |
| Best for | Tech/B2C newsletters | Any niche, scale growth | Beehiiv users | Sponsorship revenue |

**When to use Refind**: Tech or knowledge newsletters wanting a low-effort, set-and-forget growth channel. Good supplement, not a primary growth engine.

**When NOT to use Refind**: B2B enterprise, non-tech niches, anyone needing API integration or high volume.

## Integration patterns

Since Refind has no API or webhooks, integration is manual:

1. **UTM tracking**: Add `?utm_source=refind&utm_medium=paid&utm_campaign=growth` to your signup URL
2. **ESP tagging**: Create a Refind segment in your ESP based on UTM source
3. **Quality monitoring**: Compare 30-day open rates and 60-day retention of Refind segment vs organic
4. **Sunset policy**: Auto-remove Refind-sourced subscribers who don't open within 30 days to protect deliverability
5. **Beehiiv users**: Engagement sync is automatic — Refind reads your Beehiiv data to determine billing
