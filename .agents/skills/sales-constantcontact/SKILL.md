---
name: sales-constantcontact
description: "Constant Contact platform help — email marketing with event management, drag-and-drop campaigns, basic automation, social posting, SMS (US), landing pages, and V3 REST API. Use when Constant Contact emails are landing in spam or deliverability dropped, automation workflows aren't triggering or are too basic for your needs, event registration or ticket sales aren't working in Constant Contact, Constant Contact API calls returning OAuth errors or connection resets, contacts not importing or segments not filtering correctly, migrating to or away from Constant Contact, or Constant Contact billing is counting unsubscribed contacts toward your limit. Do NOT use for cross-platform email marketing strategy (use /sales-email-marketing) or cross-platform deliverability strategy (use /sales-deliverability)."
argument-hint: "[describe your Constant Contact question — e.g., 'event registration not sending confirmations' or 'API to create a campaign']"
license: MIT
version: 1.0.0
tags: [sales, email-marketing, platform]
github: "https://github.com/constantcontact"
---

# Constant Contact Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

Ask the user:

1. **What are you trying to do?**
   - A) Set up or fix an email campaign (broadcast)
   - B) Build or debug an automation workflow
   - C) Create or manage events (registrations, tickets, check-ins)
   - D) Manage contacts, lists, segments, or tags
   - E) Create or optimize signup forms or landing pages
   - F) Integrate Constant Contact with another tool (API, Zapier, webhooks)
   - G) Set up SMS campaigns (US only)
   - H) Post to social media (Facebook, Instagram, LinkedIn)
   - I) Migrate to or from Constant Contact
   - J) Other — describe it

2. **What Constant Contact plan are you on?**
   - Lite ($12/mo, 500 contacts), Standard ($35/mo), Premium ($80/mo), or unsure

3. **What's your list size and sending pattern?**
   - Approximate contact count
   - Send frequency (daily, weekly, monthly)

**Skip-ahead rule**: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| General email marketing strategy | `/sales-email-marketing [question]` |
| SPF/DKIM/DMARC or domain warm-up | `/sales-deliverability [question]` |
| Newsletter monetization | `/sales-newsletter [question]` |
| Growing subscriber list | `/sales-audience-growth [question]` |
| Connecting CC to a CRM | `/sales-integration [question]` |
| SMS marketing strategy | `/sales-sms-marketing [question]` |
| Transactional email strategy | `/sales-transactional-email [question]` |

When routing, provide the exact command: "This is a {domain} question — run: `/sales-{skill} {user's original question}`"

If the question is Constant Contact-specific, continue to Step 3.

## Step 3 — Constant Contact platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, pricing, data model, integration recipes, code examples.

For API-specific questions, also **read `references/constantcontact-api-reference.md`**.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation. Reasonable defaults:

- **New to CC**: Create a list, import contacts, build your first campaign, then set up a welcome automation
- **Migration in**: Export from old ESP, import via CSV, rebuild automations (note: CC automations are basic)
- **Migration out**: Export contacts via API bulk export, consider MailerLite or Brevo for better value
- **API integration**: Use V3 REST with OAuth 2.0 — start with contacts and campaign endpoints
- **Events**: Use the event management module for registrations and ticket sales via PayPal/Stripe
- **Deliverability**: Verify domain (SPF/DKIM/DMARC), warm up gradually, monitor bounce rates

If you discover a gotcha or workaround not in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **Billing counts ALL contacts.** Unsubscribed, bounced, and inactive contacts all count toward your billable total unless manually deleted. Clean your list regularly.
2. **No free plan.** Unlike MailerLite, Sender, or Mailchimp, Constant Contact has no free tier. Lite starts at $12/mo for just 500 contacts.
3. **Cancellation requires a phone call.** You cannot cancel online — you must call during Eastern business hours. This is a common frustration.
4. **Automation is basic on Lite/Standard.** Only welcome emails and simple triggers. Custom automation paths require Premium ($80/mo+).
5. **A/B testing requires Standard+.** Lite plan has no A/B testing or segmentation.
6. **SMS is US-only and Premium-only.** If you need SMS, you need the $80/mo plan and US recipients.
7. **Event ticket sales charge fees.** 5.4% + $0.80 per transaction on top of PayPal/Stripe processing fees.
8. **OAuth 2.0 is mandatory.** No API keys — the API requires a full OAuth flow with access tokens and refresh tokens.

## Related skills

- `/sales-email-marketing` — Cross-platform email marketing strategy (broadcasts, sequences, segmentation, automation)
- `/sales-deliverability` — SPF, DKIM, DMARC, domain warm-up, and inbox placement
- `/sales-audience-growth` — Growing your email list (lead magnets, forms, referral programs)
- `/sales-newsletter` — Newsletter monetization (paid subscriptions, sponsorships)
- `/sales-transactional-email` — Transactional email strategy and platform comparison
- `/sales-sms-marketing` — SMS marketing strategy and compliance
- `/sales-integration` — Connecting tools to CRMs and other systems
- `/sales-sender` — Sender platform help (budget ESP alternative with free tier)
- `/sales-moosend` — Moosend platform help (budget ESP alternative)
- `/sales-mailerlite` — MailerLite platform help (budget ESP alternative with free tier)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Event registrations not sending confirmations
**User**: "I set up an event in Constant Contact but attendees aren't getting confirmation emails. What's wrong?"

**What the skill does**: Reads `references/platform-guide.md` for event management details. Checks if the event confirmation email is enabled in event settings, verifies the sender email domain is authenticated, and confirms the event isn't in draft mode. Notes that event emails use separate templates from regular campaigns.

### Example 2: Create contacts and add to a list via API
**User**: "How do I use the Constant Contact API to add contacts to a list from my signup form?"

**What the skill does**: Reads `references/platform-guide.md` and `references/constantcontact-api-reference.md`. Shows the OAuth 2.0 flow for getting an access token, then demonstrates `POST /v3/contacts` with list membership in the request body. Includes Python code with token refresh handling.

### Example 3: Overpriced for what I need
**User**: "I'm paying $35/mo for Constant Contact Standard with 1,200 contacts but feel like I'm not getting enough features. Are there better options?"

**What the skill does**: Compares CC Standard ($35/mo) with alternatives at similar contact counts: MailerLite ($10/mo with better automation), Sender ($7/mo with automation on free plan), Brevo (free for 300 emails/day). Notes CC's unique event management feature — if the user relies on events, CC may still be worth it. Otherwise recommends migration with step-by-step export guidance.

## Troubleshooting

### "Constant Contact API returns 401 or OAuth errors"
- API requires OAuth 2.0 — not API keys. You need client_id, client_secret, and a redirect_uri registered in your app
- Authorization code must be exchanged for access/refresh tokens within 60 seconds
- Access tokens expire — use the refresh token to get new ones before expiry
- Common mistake: using the authorization code in the Authorization header instead of the access token
- Ensure redirect_uri exactly matches what's registered (including trailing slashes)

### "My Constant Contact emails are going to spam"
- Verify domain authentication: Account > Settings > check SPF, DKIM, and DMARC records
- CC deliverability scores 88-90% in independent tests but ~17% of emails may hit spam on shared IPs
- No dedicated IPs available — deliverability depends on CC's shared IP reputation
- No built-in warm-up guidance or deliverability dashboard — use external tools like Mail Tester
- Clean your list: unsubscribed/bounced contacts hurt sender reputation even though CC still bills for them

### "Contacts keep counting after they unsubscribed"
- Constant Contact counts ALL contacts including unsubscribed and bounced toward billing
- You must manually delete (not just unsubscribe) contacts to reduce your billable count
- Use the API bulk delete endpoint or go to Contacts > filter by "Unsubscribed" > delete
- Set a monthly routine to purge non-engaged and unsubscribed contacts
- Consider this a hidden cost — your effective per-contact price is higher than it appears
