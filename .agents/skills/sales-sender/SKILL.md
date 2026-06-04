---
name: sales-sender
description: "Sender platform help — budget email marketing with drag-and-drop campaigns, automation workflows, SMS, landing pages, transactional email, and REST API. Use when Sender emails are landing in spam or open rates dropped, automation workflows aren't triggering or firing on the wrong event, subscribers aren't importing or segments aren't filtering correctly, Sender API calls to campaigns or subscribers are returning errors, forms or popups aren't capturing leads, migrating to Sender from Mailchimp or another ESP, or webhooks aren't delivering on your paid plan. Do NOT use for cross-platform email marketing strategy (use /sales-email-marketing), cross-platform deliverability (use /sales-deliverability), or newsletter monetization strategy (use /sales-newsletter)."
argument-hint: "[describe your Sender question — e.g., 'automation not triggering on form submit' or 'API to create a campaign']"
license: MIT
version: 1.0.0
tags: [sales, email-marketing, platform]
---

# Sender Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

Ask the user:

1. **What are you trying to do?**
   - A) Set up or fix an email campaign (broadcast)
   - B) Build or debug an automation workflow
   - C) Create or optimize a form, popup, or landing page
   - D) Manage subscribers, groups, or segments
   - E) Send transactional emails via API
   - F) Integrate Sender with another tool (API, Zapier, webhooks)
   - G) Set up SMS campaigns
   - H) Migrate to Sender from another ESP
   - I) Other — describe it

2. **What Sender plan are you on?**
   - Free Forever (2,500 subs / 15K emails), Standard (from $7/mo), Professional, Enterprise, Pay-As-You-Go

3. **What's your list size and sending pattern?**
   - Approximate subscriber count
   - Send frequency (daily, weekly, monthly)

**Skip-ahead rule**: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| General email marketing strategy | `/sales-email-marketing [question]` |
| SPF/DKIM/DMARC or domain warm-up | `/sales-deliverability [question]` |
| Newsletter monetization | `/sales-newsletter [question]` |
| Growing subscriber list | `/sales-audience-growth [question]` |
| Connecting Sender to a CRM | `/sales-integration [question]` |
| SMS marketing strategy | `/sales-sms-marketing [question]` |
| Transactional email strategy | `/sales-transactional-email [question]` |

When routing, provide the exact command: "This is a {domain} question — run: `/sales-{skill} {user's original question}`"

If the question is Sender-specific, continue to Step 3.

## Step 3 — Sender platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, pricing, data model, integration recipes, code examples.

For API-specific questions, also **read `references/sender-api-reference.md`**.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation. Reasonable defaults:

- **New to Sender**: Create a group, import subscribers, build your first campaign, then set up automation
- **Migration**: Export from old ESP, import via CSV, rebuild automations using Sender's visual builder
- **API integration**: Use REST v2 with Bearer token — start with subscriber and campaign endpoints
- **Ecommerce**: Connect WordPress/WooCommerce/Shopify plugin, set up cart abandonment automation
- **Deliverability**: Verify domain (SPF/DKIM), warm up gradually, monitor bounce/complaint rates

If you discover a gotcha or workaround not in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **Webhooks are paid-only.** Account webhooks require a Standard or Professional plan. Free plan users can only use Zapier for event-driven integrations.
2. **Free plan includes Sender branding.** All emails on the free plan show Sender branding in the footer. Standard+ removes it.
3. **No built-in deliverability dashboard.** Sender doesn't provide inbox placement or sender reputation visibility. If open rates drop, you're debugging blind — use external tools like Mail Tester or GlockApps.
4. **Segmentation is basic.** Filters support opened/clicked/subscribed-date conditions, but no advanced logic or real-time behavioral triggers like ActiveCampaign or Klaviyo.
5. **Dedicated IPs require Professional plan at 20K+ subscribers.** If you need IP isolation for deliverability, you need both the right plan and list size.
6. **Email builder paragraph spacing.** Each paragraph must go in a separate text block — combining multiple paragraphs in one block causes inconsistent spacing across email clients.

## Related skills

- `/sales-email-marketing` — Cross-platform email marketing strategy (broadcasts, sequences, segmentation, automation)
- `/sales-deliverability` — SPF, DKIM, DMARC, domain warm-up, and inbox placement
- `/sales-audience-growth` — Growing your email list (lead magnets, forms, referral programs)
- `/sales-newsletter` — Newsletter monetization (paid subscriptions, sponsorships)
- `/sales-transactional-email` — Transactional email strategy and platform comparison
- `/sales-sms-marketing` — SMS marketing strategy and compliance
- `/sales-integration` — Connecting tools to CRMs and other systems
- `/sales-moosend` — Moosend platform help (similar budget ESP, Sender competitor)
- `/sales-mailerlite` — MailerLite platform help (similar budget ESP with free tier)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Open rates dropped after switching to Sender
**User**: "I migrated from Mailchimp to Sender and my open rates went from 45% to 12%. What's going on?"

**What the skill does**: Checks domain verification (SPF/DKIM), confirms warm-up was done gradually, reviews sending reputation. Notes that Sender lacks a deliverability dashboard so external tools are needed. Recommends verifying authentication in Sender settings, sending to engaged segments first, and gradually increasing volume over 2-4 weeks.

### Example 2: Create a subscriber and trigger automation via API
**User**: "How do I use the Sender API to add a subscriber to a group and trigger a welcome automation?"

**What the skill does**: Reads `references/platform-guide.md` for API recipes. Shows how to create a subscriber via `POST /v2/subscribers` with group assignment, then explains that adding to a group can trigger an automation set to the "Joins group" trigger. Includes Python code with Bearer token auth and error handling.

### Example 3: Free plan limits for a small newsletter
**User**: "I have 1,500 subscribers and send weekly. Is Sender's free plan enough?"

**What the skill does**: Calculates 1,500 subs x 4 sends/mo = 6,000 emails, well under the 15K limit. Notes the free plan includes automation, forms, landing pages, and transactional email. Flags that free plan has Sender branding and no webhooks. Recommends starting free and upgrading to Standard ($7/mo) when branding becomes an issue or list grows past 2,500.

## Troubleshooting

### "My Sender emails are going to spam"
- Verify domain authentication: Settings > Domains > check SPF, DKIM, and DMARC records are properly configured
- If you recently migrated, warm up gradually — send to your most engaged segment first, increase volume 20-30% daily
- Check bounce rate — Sender auto-cleans bounces but high bounce on first send damages reputation
- Review email content for spam triggers (all caps, excessive links, misleading subject lines)
- Sender doesn't have a deliverability dashboard — use Mail Tester (mail-tester.com) to check your spam score

### "Sender API returns 401 or 403 errors"
- API uses Bearer token auth: `Authorization: Bearer {API_ACCESS_TOKEN}` in the header
- Generate tokens in Settings > API access tokens — tokens are only shown once at creation
- Tokens are organization-wide (all groups/newsletters under the org)
- Ensure you're using HTTPS — Sender API doesn't support unencrypted HTTP
- If token was regenerated, old tokens stop working immediately

### "Subscribers not importing or groups not updating"
- CSV imports require an email column — Sender auto-maps common headers
- Custom fields must exist in Sender before importing data that references them
- Duplicate emails within the same group are silently skipped
- Segment filters update in near-real-time but may lag on large lists
- If importing via API, check for 422 validation errors — invalid email format is the most common cause
