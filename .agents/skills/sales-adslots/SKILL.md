---
name: sales-adslots
description: "Ad Slots platform help — calendar-based newsletter ad management with Stripe invoicing, sponsor CRM dashboard, and AI ad copy generation for replacing spreadsheet-based sponsorship tracking. Use when managing newsletter sponsors in spreadsheets is getting chaotic, you keep double-booking ad slots or forgetting to invoice sponsors, need a visual calendar showing which newsletter ad placements are booked vs available, Stripe invoices for newsletter sponsors aren't syncing or tracking correctly, or AI-generated ad copy from sponsor briefs doesn't match your newsletter tone. Do NOT use for general newsletter monetization strategy (use /sales-newsletter) or finding new sponsors to pitch (use /sales-sponsorgap or /sales-paved)."
argument-hint: "[describe your Ad Slots question or newsletter ad management problem]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, sponsorship, platform]
---

# Ad Slots Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

Ask the user:

1. **What's your Ad Slots situation?**
   - A) Evaluating Ad Slots — haven't signed up yet
   - B) Setting up Ad Slots — configuring sponsors, calendar, or Stripe
   - C) Using Ad Slots — troubleshooting or optimizing workflows
   - D) Comparing Ad Slots to Sponsy or other ad management tools

2. **Which plan are you on (or considering)?**
   - A) Starter (free — 5 active sponsors, 25 AI ads/month)
   - B) Growth ($49/mo — unlimited sponsors, Stripe integration, unlimited AI)
   - C) Not sure yet

3. **What's your newsletter setup?**
   - How many sponsors do you typically manage?
   - Which ESP do you use (Beehiiv, Substack, Ghost, etc.)?
   - Are you currently using spreadsheets to track sponsors?

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Newsletter monetization strategy (pricing, models, which revenue streams) | `/sales-newsletter [user's question]` |
| Finding sponsors to pitch | `/sales-sponsorgap [user's question]` or `/sales-paved [user's question]` |
| Sponsorship operations with advertiser portals and Zapier automation | `/sales-sponsy [user's question]` |
| Growing your subscriber list | `/sales-audience-growth [user's question]` |
| Email deliverability or spam issues | `/sales-deliverability [user's question]` |

When routing to another skill, provide the exact command.

If the question is about Ad Slots itself (setup, configuration, Stripe, AI copy, calendar management), continue to Step 3.

## Step 3 — Ad Slots platform reference

**Read `references/platform-guide.md`** for the full platform reference — capabilities, pricing, Stripe integration, AI copy generator, and workflow guidance.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Focus on the user's specific situation:

- **Evaluating**: Compare Ad Slots vs Sponsy vs spreadsheets based on sponsor count, budget, and automation needs
- **Setting up**: Walk through sponsor entry, calendar configuration, and Stripe connection
- **Optimizing**: Help with AI copy workflows, fulfillment tracking, and revenue reporting
- **Migrating**: Guide spreadsheet-to-Ad Slots transition

If you discover a gotcha, workaround, or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about plan-gated features and integration gotchas that may be outdated.*

1. **Stripe is Growth-plan only** — the free Starter plan doesn't include Stripe integration. You can track sponsors but can't automate invoicing until $49/mo.
2. **No ESP integration yet** — Ad Slots doesn't auto-insert ads into Beehiiv, Substack, or any ESP. You copy-paste the AI-generated ad copy manually. Direct ESP integrations are on the roadmap.
3. **No API, no webhooks, no Zapier** — there's no programmatic access. Everything is UI-driven. If you need automation, consider Sponsy instead.
4. **AI copy limit on free plan** — Starter plan caps AI ad generation at 25 per month. Growth plan is unlimited.
5. **Manual workflow beyond scheduling** — Ad Slots handles the calendar and invoicing, but ad creative delivery, performance reporting, and sponsor communication still happen outside the tool.

## Related skills

- `/sales-sponsy` — Sponsy platform help (sponsorship operations — ad inventory calendar, sponsor CRM, advertiser portals, automated reporting, Zapier)
- `/sales-newsletter` — Newsletter monetization strategy (paid subscriptions, sponsorships, ad sales, pricing)
- `/sales-sponsorgap` — SponsorGap sponsor intelligence (38K+ brands, verified contacts, competitor monitoring)
- `/sales-paved` — Paved newsletter sponsorship marketplace (Ad Network, Booker, Radar)
- `/sales-hecto` — Hecto self-serve newsletter advertising marketplace
- `/sales-adlynews` — adly.news two-sided newsletter advertising marketplace
- `/sales-audience-growth` — Growing your subscriber list
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: Evaluating Ad Slots vs Sponsy
**User says**: "I manage 3 newsletter sponsors in a spreadsheet and it's getting messy. Should I use Ad Slots or Sponsy?"
**Skill does**: Reads platform guide, compares pricing (free/$49 vs $79+), features (Ad Slots is simpler calendar+invoicing; Sponsy adds portals, Zapier, API), and recommends Ad Slots for simple sponsor tracking or Sponsy for full ops automation
**Result**: User has a clear decision framework based on sponsor count and automation needs

### Example 2: Setting up Stripe invoicing
**User says**: "How do I connect Stripe to Ad Slots so invoices go out automatically when I book a sponsor?"
**Skill does**: Reads platform guide Stripe section, walks through one-click Stripe connection on Growth plan, explains webhook-based payment tracking
**Result**: User has Stripe connected and understands how invoice status updates automatically

### Example 3: AI ad copy workflow
**User says**: "A sponsor gave me bullet points about their product. How do I use Ad Slots to turn that into newsletter ad copy?"
**Skill does**: Reads platform guide AI copy section, explains how to input sponsor details and generate multiple copy variations, recommends editing for newsletter voice
**Result**: User generates 3-4 ad copy variations and picks the best fit for their newsletter tone

## Troubleshooting

### Stripe invoices not syncing
**Symptom**: You booked a sponsor but the payment status isn't updating in Ad Slots
**Cause**: Stripe webhook connection may be interrupted, or you're on the Starter plan which doesn't include Stripe
**Solution**: Verify you're on the Growth plan ($49/mo). Check that Stripe is connected in Settings. Disconnect and reconnect Stripe if the webhook stopped firing. Check Stripe dashboard directly to confirm invoice was sent.

### Hit the 5-sponsor limit on free plan
**Symptom**: Can't add more sponsors on the Starter plan
**Cause**: The free plan caps at 5 active sponsors
**Solution**: Upgrade to Growth ($49/mo) for unlimited sponsors. Alternatively, mark completed sponsors as fulfilled to free up slots if you're managing sponsors sequentially rather than concurrently.

### Ad copy doesn't match newsletter voice
**Symptom**: AI-generated copy sounds generic or off-brand
**Cause**: The AI generator creates copy from sponsor details alone — it doesn't know your newsletter's tone
**Solution**: Use the generated copy as a starting draft, not final copy. Generate multiple variations and edit the closest one to match your voice. Include tone notes in the sponsor details you input (e.g., "casual, first-person, conversational").
