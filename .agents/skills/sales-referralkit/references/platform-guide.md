# ReferralKit Platform Reference

<!-- Source: https://referralkit.co (homepage, attempted /pricing returned 404), plus third-party comparisons (viral-loops.com SparkLoop alternatives roundup, IndieHackers thread, todaytesting.com SparkLoop review). Research date 2026-05-30. Pricing model and ESP integration list may shift; verify before quoting hard numbers. -->

## Overview

ReferralKit (referralkit.co — NOT referralkit.io, which returns ECONNREFUSED) is a no-code newsletter referral program tool built by Copyhackers. Subscribers refer friends via unique merge-tag-driven links inserted directly into your existing email body; rewards trigger at configurable milestones; the platform tracks referral counts inside the email itself. Differentiator vs SparkLoop/Viral Loops/GrowSurf: free for the first 10,000 leads and merge-tag-only flow with no separate landing pages or JavaScript widgets.

## Capabilities & automation surface

- **Email-body merge-tag insertion** (UI-only, all tiers): Unique referral link rendered via merge tags directly inside campaign sends — no widget, no landing page, no JS.
- **Milestone-based reward configuration** (UI-only, all tiers): Set rewards at any referral threshold (3, 10, 25, 50 referrals — Morning Brew style).
- **Automated reward notification emails** (UI-only, all tiers): When a subscriber crosses a milestone, ReferralKit triggers an email containing the reward details.
- **Referral count tracking in-email** (UI-only, all tiers): The current referral count for each subscriber is also a merge tag — show it in every newsletter to drive engagement.
- **ESP integration** (UI-only, all tiers): Native connectors to Mailchimp, ConvertKit (Kit), MailerLite, AWeber. Listed as "planned": Drip, Ghost, Campaign Monitor, ActiveCampaign.
- **Creator dashboard** (UI-only): View total referrals, top referrers, conversion funnel.
- **No public API / No webhooks / No Zapier / No Make / No MCP server.** Confirmed via WebSearch.

## Pricing, limits & plan gates

<!-- Pricing data uncertain. Homepage states "100% free for your first 10,000 leads." /pricing returned 404 at research time. Third-party sources from earlier years mention "$19/mo for 3K subs" — this conflicts with the current homepage and the pricing model appears to have changed. Verify before quoting. -->

| Plan | Price | Lead cap | Notes |
|---|---|---|---|
| **Free** | $0 | 10,000 leads | All features included; "100% free for your first 10,000 leads" per homepage |
| **Premium tiers** | Not disclosed publicly | Above 10K | Tiers exist but details not visible — /pricing page 404 at research time |

**Free trial**: Older sources mentioned a 30-day free trial; current model appears to have moved to a permanent free tier instead. Confirm with support.

**What "leads" means**: Homepage uses "leads"; third-party sources use "subscribers." The definition (signups? referrals? both?) is not crystal clear — confirm with support before quoting.

## Integrations

- **Native ESP connectors (live)**: Mailchimp, ConvertKit (Kit), MailerLite, AWeber.
- **Planned ESP connectors**: Drip, Ghost, Campaign Monitor, ActiveCampaign — not live at research time.
- **No CRM connectors, no Zapier/Make modules, no MCP server, no API.**
- **DIY workflows**: CSV export from the ReferralKit dashboard for downstream CRM imports.

## Data model

ReferralKit exposes no public API, so no documented schema. Inferred from the merge-tag-driven UX:

```json
<!-- Constructed from public UX behavior — verify against live app -->
{
  "subscriber": {
    "email": "subscriber@example.com",
    "referral_code": "abc123",
    "referral_url": "https://referralkit.co/r/abc123",
    "referral_count": 7,
    "milestones_hit": [3, 5],
    "rewards_earned": [
      {"milestone": 3, "reward": "Stickers", "claimed_at": "2026-04-15"},
      {"milestone": 5, "reward": "Tote bag", "claimed_at": "2026-05-02"}
    ]
  },
  "referral": {
    "referrer_email": "subscriber@example.com",
    "referee_email": "newsignup@example.com",
    "referred_at": "2026-05-30T14:00:00Z",
    "esp": "mailchimp",
    "list_id": "abcd1234"
  },
  "milestone": {
    "threshold": 10,
    "reward_name": "Exclusive ebook",
    "notification_email_template_id": "tpl_xyz"
  }
}
```

## Quick-start recipes

### Recipe 1: Set up a Morning Brew-style milestone referral program

1. Sign up at referralkit.co (NOT .io).
2. Connect your ESP (Mailchimp, Kit, MailerLite, or AWeber).
3. Configure milestones: e.g., 3 referrals = stickers, 10 referrals = tote bag, 25 referrals = exclusive ebook.
4. In your email template (broadcast or sequence), insert ReferralKit's merge tags:
   - `{{referral_link}}` — unique URL for this subscriber to share
   - `{{referral_count}}` — current count
   - `{{next_milestone_remaining}}` — how many more refs until next reward
5. Send a test to yourself with a sample subscriber to confirm the merge tags render correctly.
6. Launch the program with a dedicated announcement send.

**Gotcha**: Some ESPs strip merge tags in unsegmented broadcasts — use subscriber-targeted sends.

### Recipe 2: Workaround for non-native ESPs (Ghost, Drip, Campaign Monitor, ActiveCampaign)

1. Create the ReferralKit program even without a native integration.
2. Use ReferralKit's generic referral URL: `https://referralkit.co/r/{subscriber_id}`.
3. Manually embed the URL in your newsletter sends with UTM tags: `?utm_source={your-esp}&utm_medium=referral&utm_campaign=milestone-program`.
4. Track referral counts in the ReferralKit dashboard (subscriber-level updates happen via referee landing pages, not ESP integration).
5. Plan to switch to a native integration when ReferralKit ships your ESP — or switch to SparkLoop (25+ ESPs supported).

```bash
# No ReferralKit API exists. The closest you get is a CSV export → import elsewhere:
# 1. Export referral data from dashboard manually (weekly)
# 2. Process with csvkit / pandas
# 3. Push to HubSpot via their API:
curl -X POST "https://api.hubapi.com/contacts/v1/contact/batch" \
  -H "Authorization: Bearer $HUBSPOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @referralkit_export.json
```

### Recipe 3: Pipe referral signals to a CRM without an API

1. Configure your ESP to tag subscribers as "referred_via_referralkit" at signup (use the ESP's automation — Mailchimp Customer Journeys, Kit Sequences, etc.).
2. Sync ESP → HubSpot/Salesforce via the ESP's existing native CRM connector (Mailchimp ↔ HubSpot is native; Kit has a HubSpot integration; MailerLite has Zapier).
3. The ReferralKit-sourced flag flows to the CRM as a subscriber property.
4. In HubSpot, build a list/segment filtered to `referred_via_referralkit = true` for sales follow-up or LTV analysis.

```python
# Python: pull ESP-side referral-tagged contacts and upsert to HubSpot
import os, requests
# Example: Mailchimp tag-based fetch
mc_url = f"https://us1.api.mailchimp.com/3.0/lists/{os.environ['MC_LIST']}/segments/{os.environ['MC_SEG_ID']}/members"
members = requests.get(mc_url, auth=("anystring", os.environ["MC_API_KEY"])).json()["members"]
for m in members:
    requests.post(
        f"https://api.hubapi.com/contacts/v1/contact/createOrUpdate/email/{m['email_address']}",
        headers={"Authorization": f"Bearer {os.environ['HUBSPOT_TOKEN']}", "Content-Type": "application/json"},
        json={"properties": [
            {"property": "referral_source", "value": "referralkit"},
            {"property": "referral_count", "value": str(m.get("merge_fields", {}).get("REF_COUNT", 0))},
        ]},
    )
```

**Gotcha**: ReferralKit's referral count lives in the platform, not the ESP — you'll need to sync the count to your ESP as a merge field if you want it in the CRM.

## Integration patterns

Since ReferralKit has no programmatic surface, "integration" means:

- **Merge-tag-driven email body** — the primary mechanic, no extra surface area
- **Manual CSV export** for ad-hoc reporting and CRM batch imports
- **ESP-side automation** to tag referred subscribers, then sync ESP → CRM via the ESP's existing integration
- **UTM tagging** on the referral link to attribute referral-sourced subscribers in your analytics stack

## Comparison with alternatives

| Tool | Primary use | Free tier | API/Zapier | ESP support | Best for |
|---|---|---|---|---|---|
| **ReferralKit** | Newsletter referral program (milestone-based, merge-tag-driven) | ✅ First 10K leads free | ❌ | 4 native + 4 planned | Newsletter operators wanting Morning Brew-style referrals in their existing ESP, free up to 10K |
| **SparkLoop** | Newsletter referrals + paid recommendations + partner network | ❌ (Free Recs only) | ❌ API; Zapier via ESP | 25+ ESPs | Newsletters at scale wanting referral + recommendation monetization in one stack |
| **ReferralHero** | Generic referral marketing (multi-vertical) | Limited free | ✅ API, webhooks, Zapier | Generic via API | Teams with engineering capacity needing custom rewards |
| **Viral Loops** | Templated referral campaigns (waitlist, milestone, prelaunch) | 14-day trial | ✅ API, webhooks, Zapier | Generic via API | Marketers running multi-format viral campaigns beyond newsletters |
| **GrowSurf** | Scalable referral programs with rich analytics | 14-day trial | ✅ API, webhooks, Zapier | Generic via API | SaaS / e-commerce teams needing fraud detection + real-time analytics |
| **KickoffLabs** | Viral giveaways, waitlists, milestone rewards | 7-day trial | ✅ API, webhooks, Zapier | Generic via API | Pre-launch campaigns and giveaway-driven growth |

## When to use ReferralKit

- Newsletter operator under 10K subscribers wanting a free, no-code referral program
- Already on Mailchimp, Kit, MailerLite, or AWeber and wanting native merge-tag-driven referrals
- Wanting the Morning Brew / The Hustle milestone-reward mechanic without engineering work
- Don't need API access — manual dashboard + CSV exports are enough

## When NOT to use ReferralKit

- Need a public API, webhooks, or Zapier — none exist
- On Ghost, Drip, Campaign Monitor, or ActiveCampaign — wait for native support or use SparkLoop / GrowSurf
- Want paid recommendations or partner network monetization — use SparkLoop
- Need fraud detection or advanced analytics on referrals — use GrowSurf
- Running multi-vertical referral programs (e-commerce, SaaS) — use Viral Loops or GrowSurf
