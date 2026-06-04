# Ad Slots Platform Reference

## Overview

Ad Slots (adslots.co) is a lightweight newsletter ad management tool that replaces spreadsheet-based sponsor tracking with a visual calendar, Stripe-powered invoicing, and AI ad copy generation. Built for independent newsletter creators and small media teams managing direct sponsorships.

## Capabilities & automation surface

| Capability | Description | Access |
|---|---|---|
| **Calendar scheduling** | Visual monthly calendar showing ad slots as booked, pending, or fulfilled. Supports daily and weekly newsletter frequencies. Drag to reschedule. | UI-only |
| **Sponsor CRM dashboard** | Centralized client management — revenue per sponsor, fulfillment progress (completed vs total ads), contact info, notes, search. | UI-only |
| **Stripe invoicing** | One-click Stripe connection. Auto-generates invoices when you book a sponsor. Tracks payment status via Stripe webhooks. | UI-only (Growth plan) |
| **AI ad copy generator** | Input sponsor talking points, generate multiple ad copy variations. Customizable tone. | UI-only |
| **Fulfillment tracking** | Toggle slots between pending and fulfilled status. See completion percentage per sponsor. | UI-only |

**No public API.** No webhooks (outbound). No Zapier/Make. No MCP server. All operations are manual/UI-driven.

## Pricing, limits & plan gates

| Feature | Starter (Free) | Growth ($49/mo) |
|---|---|---|
| Active sponsors | 5 | Unlimited |
| AI ad generations | 25/month | Unlimited |
| Calendar scheduling | Yes | Yes |
| Sponsor CRM | Yes | Yes |
| Stripe integration | No | Yes |
| Priority support | No | Yes |

No setup fees. Monthly billing. Cancel anytime. No annual plan discount mentioned.

**Key gate**: Stripe invoicing — the core automation feature — requires the Growth plan. The free plan is essentially a visual calendar + limited AI copy tool.

## Integrations

**Current:**
- **Stripe** (Growth plan only): One-click OAuth connection. Ad Slots creates invoices in Stripe when you book a sponsor. Payment status updates in Ad Slots via Stripe webhooks (Stripe → Ad Slots, not vice versa).

**Planned (roadmap):**
- Beehiiv direct integration (auto-populate ad sections)
- Substack direct integration

**Not available:**
- No API for external tools to read/write Ad Slots data
- No Zapier triggers or actions
- No Make modules
- No webhook endpoints for external consumers
- No ESP integrations (copy-paste workflow for now)

## Data model

Ad Slots organizes data around three core objects:

<!-- Constructed from docs — verify against live API -->

**Sponsor (Business/Client)**
```json
{
  "name": "Acme Corp",
  "email": "sponsor@acme.com",
  "notes": "Q3 campaign, wants primary placement",
  "total_revenue": 2400,
  "slots_fulfilled": 8,
  "slots_total": 12,
  "payment_status": "paid"
}
```

**Ad Slot**
```json
{
  "date": "2026-06-15",
  "sponsor": "Acme Corp",
  "status": "pending",
  "placement_type": "primary"
}
```

**AI Ad Copy**
```json
{
  "sponsor": "Acme Corp",
  "input_brief": "Project management tool, saves 5 hours/week...",
  "variations": [
    "Tired of juggling tasks across...",
    "What if you could get 5 hours back..."
  ]
}
```

## Workflow guide

### Setting up Ad Slots (3-step process)

1. **Add sponsors**: Enter client name, contact email, notes, and ad package details (~30 seconds per client)
2. **Book slots on the calendar**: Assign sponsors to specific dates on the visual calendar
3. **Connect Stripe** (Growth plan): One-click connection → invoices auto-generate when you book a slot

### Using the AI ad copy generator

1. Navigate to the AI copy tool
2. Enter sponsor's product details, key talking points, and desired tone
3. Generate multiple variations (2-4 typically)
4. Copy the best variation and paste into your newsletter editor
5. Edit for your newsletter's voice — the AI doesn't know your tone

### Managing fulfillment

1. After sending a newsletter with a sponsor's ad, toggle the slot from "pending" to "fulfilled"
2. Monitor completion percentages per sponsor on the CRM dashboard
3. Use fulfillment progress to trigger renewal conversations when a package is nearly complete

### Revenue tracking

The CRM dashboard shows:
- Total revenue across all sponsors
- Per-sponsor revenue and fulfillment progress
- Payment status (paid/pending/overdue) synced from Stripe

## Ad Slots vs Sponsy comparison

| Factor | Ad Slots | Sponsy |
|---|---|---|
| **Price** | Free / $49/mo | $79-$349/mo |
| **Calendar** | Visual monthly calendar | Ad inventory calendar |
| **Stripe invoicing** | Yes (Growth plan) | Yes (all plans) |
| **Sponsor portal** | No | Yes (branded portals for asset collection) |
| **API** | No | Yes (REST API) |
| **Zapier** | No | Yes (triggers + actions) |
| **ESP integration** | No (copy-paste) | Beehiiv, Substack, Ghost, Mailchimp |
| **Reporting** | Basic (revenue, fulfillment %) | Automated performance reports |
| **AI copy** | Yes (built-in) | No |
| **Best for** | Solo creators, <10 sponsors | Established publishers, 10+ sponsors, need automation |

**Choose Ad Slots when**: You manage a handful of sponsors, want free/cheap calendar + invoicing, and don't need portals or automation.

**Choose Sponsy when**: You manage 10+ sponsors, need advertiser-facing portals, automated reporting, or API/Zapier integration.

## Ad Slots vs spreadsheets

| Factor | Spreadsheets | Ad Slots |
|---|---|---|
| **Cost** | Free | Free-$49/mo |
| **Calendar view** | Manual (build your own) | Built-in visual calendar |
| **Double-booking risk** | High | Prevented by slot assignment |
| **Invoicing** | Manual (separate tool) | Stripe auto-invoicing |
| **Formula breakage** | Common with edits | Not possible |
| **Sponsor search** | Ctrl+F | Instant search + filters |
| **Ad copy** | Write from scratch | AI generates variations |

## Limitations

- **No reporting beyond fulfillment tracking** — no click-through rates, opens, or engagement metrics. You still need your ESP's analytics.
- **No multi-newsletter support documented** — unclear if one account can manage slots across multiple publications.
- **No team/collaboration features** — appears single-user only.
- **No contract or agreement management** — use a separate tool for sponsor agreements.
- **Copy-paste workflow** — until ESP integrations ship, ad copy goes from Ad Slots → clipboard → newsletter editor manually.
