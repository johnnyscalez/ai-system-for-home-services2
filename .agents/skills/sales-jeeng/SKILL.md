---
name: sales-jeeng
description: "Jeeng (OpenWeb) platform help — AI-powered multi-channel ad monetization for email publishers with AdFill vacant slot backfill, AdServe direct campaign extension, AdMarket advertiser marketplace (150M+ opt-in subscribers), Google Ad Manager integration, push notification and newsreader monetization. Use when setting up Jeeng to monetize your newsletter with display or native ads, ad fill rates are low and vacant slots aren't generating revenue, Jeeng ad tags aren't rendering correctly in your email template, trying to integrate Jeeng with Google Ad Manager for waterfall or header bidding, push notification ads aren't reaching subscribers, or comparing Jeeng to Paved or Admailr or LiveIntent for email ad monetization. Do NOT use for general newsletter monetization strategy (use /sales-newsletter) or newsletter sponsorship marketplace transactions (use /sales-paved or /sales-hecto)."
argument-hint: "[describe your Jeeng question or newsletter ad monetization goal]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, advertising, ad-server, platform]
---

# Jeeng (OpenWeb) Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

1. **What are you trying to do?**
   - A) Set up Jeeng to monetize my newsletter with ads
   - B) Extend direct-sold campaigns into email via AdServe
   - C) Fill vacant ad slots automatically with AdFill
   - D) Access reporting or management APIs
   - E) Compare Jeeng to other email ad networks
   - F) Integrate with Google Ad Manager

2. **Which side are you on?**
   - A) Publisher (I have a newsletter and want ad revenue)
   - B) Advertiser (I want to place ads in email newsletters)

3. **Newsletter details** (if publisher): ESP, subscriber count, current ad setup, whether you use Google Ad Manager

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| General newsletter monetization strategy | `/sales-newsletter [question]` |
| Email marketing campaigns or automation | `/sales-email-marketing [question]` |
| Growing subscriber list | `/sales-audience-growth [question]` |
| Finding sponsors to pitch directly | `/sales-sponsorgap [question]` or `/sales-paved [question]` |
| Self-hosted ad server alternative | `/sales-revive [question]` |
| API-first custom ad platform | `/sales-kevel [question]` |

When routing, provide the exact command.

## Step 3 — Jeeng platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, pricing, data model, API, integration recipes, code examples.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **New publisher**: Start with AdFill for immediate revenue from vacant slots, then layer in AdServe for direct campaigns
- **GAM user**: Integrate Jeeng as a demand source in your waterfall — configure ad units, sizing, and key-values
- **Multi-channel**: Enable push notifications and newsreader monetization for incremental revenue beyond email
- **Reporting**: Use the Publisher Performance Report API to track revenue by container and placement
- **Scaling**: As traffic grows, negotiate revenue share upward (70-85% range based on volume)

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

- **No self-serve signup** — onboarding requires contacting Jeeng's sales team. Your account manager provisions API credentials and configures your account.
- **No public pricing** — revenue share is 70-85% depending on traffic volume and services used. Negotiate before signing.
- **API credentials are provisioned, not self-serve** — you cannot generate API keys yourself. Reach out to your account manager.
- **Apple Mail Privacy Protection** inflates open-based metrics — Jeeng's reporting docs cover this, but expect CPM discrepancies.
- **Push notification fatigue** — even with customization, the frequency of Jeeng push notifications can overwhelm subscribers. Start conservative and tune.
- **Payment fees** — Jeeng covers transfer fees up to $5 via Tipalti; amounts above are deducted from your payment.

## Related skills

- `/sales-newsletter` — Newsletter monetization strategy (sponsorships, paid subscriptions, ad sales, pricing)
- `/sales-paved` — Paved newsletter sponsorship marketplace (Ad Network, Booker, Radar, 50K+ subscriber minimum)
- `/sales-admailr` — Admailr programmatic email ad server (automated ad insertion, CPM+CPC, campaign API)
- `/sales-passendo` — Passendo email ad server + SSP (programmatic exchange, direct-sold, 15+ demand partners)
- `/sales-buysellads` — BuySellAds contextual advertising marketplace (managed ad sales, Carbon Ads, API)
- `/sales-adbutler` — AdButler full-stack ad server (self-serve portal, email ad zones, REST API + MCP)
- `/sales-kevel` — Kevel API-first ad server infrastructure (Decision API, email ad serving)
- `/sales-postapex` — PostApex CPC ad network (500+ publishers, no subscriber minimum)
- `/sales-email-marketing` — Email marketing strategy (sending campaigns, automation, segmentation)
- `/sales-audience-growth` — Growing your subscriber list (lead magnets, cross-promotion, referrals)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Setting up newsletter ad monetization
**User says**: "I want to start monetizing my newsletter with Jeeng ads"
**Skill does**: Explains onboarding process (contact sales), walks through AdFill setup for vacant slot backfill, covers CNAME configuration and ads.txt setup, explains revenue share model
**Result**: User understands the onboarding path and what to expect from Jeeng integration

### Example 2: Pulling revenue reports via API
**User says**: "How do I get my Jeeng publisher revenue data via the API?"
**Skill does**: Explains OAuth 2.0 client credentials flow via Azure AD, provides Publisher Performance Report endpoint, shows cURL example for fetching container and placement reports
**Result**: User can authenticate and pull revenue reports programmatically

### Example 3: Comparing email ad networks
**User says**: "Should I use Jeeng or Paved or LiveIntent for my newsletter?"
**Skill does**: Compares pricing models (Jeeng: rev-share custom, Paved: CPC with 50K min, LiveIntent: programmatic but self-serve shutting down), ad formats, integration requirements, and audience fit
**Result**: User has a clear comparison to make an informed decision

## Troubleshooting

### Low fill rates on vacant ad slots
**Symptom**: AdFill is enabled but many ad slots show house ads or blanks
**Cause**: Audience geo-targeting may not match advertiser demand, or ad placement configuration needs optimization
**Solution**: Check that containers and placements are correctly configured. Verify CNAME is resolving. Contact your account manager to review demand allocation for your audience demographics.

### Ad tags not rendering in email
**Symptom**: Ads show as broken images or blank spaces in subscriber inboxes
**Cause**: CNAME not configured, ads.txt missing, or email client blocking third-party images
**Solution**: Verify CNAME record resolves correctly. Ensure ads.txt is published on your domain. Test across email clients — some (Outlook, Apple Mail) handle image-based ads differently. Check the Jeeng troubleshooting docs for inbox placement issues.

### Revenue discrepancies between Jeeng and Google Ad Manager
**Symptom**: Jeeng reporting shows different numbers than GAM
**Cause**: Proxy impressions vs user impressions counting methodology, Apple Mail Privacy Protection inflating GAM opens
**Solution**: Use Jeeng's "user impressions" metric for accurate comparison. Review the Apple Mail Privacy Protection documentation in Jeeng's reporting guides. Align counting methodology with your GAM configuration.
