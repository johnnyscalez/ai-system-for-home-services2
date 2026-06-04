# Sender Platform Reference

## Overview

Sender is a budget email marketing platform (est. 2012) offering email campaigns, automation workflows, SMS, landing pages, transactional email, and a REST API. Genuine free tier (2,500 subs, 15K emails/mo) with premium features like automation included. Best for solopreneurs and small teams who need affordable all-in-one email marketing with a developer-friendly API. 180,000+ businesses.

## Capabilities & automation surface

| Capability | Access | Notes |
|---|---|---|
| Email campaigns (broadcasts) | API + UI | Drag-and-drop editor, 1,600+ templates, A/B testing (subject, content, sender, time), HTML builder |
| Automation workflows | UI + API trigger | Visual builder, pre-made sequences, unlimited workflows on all plans (including free) |
| Subscriber management | API + UI | Create, update, delete, groups, segments, custom fields, events |
| Groups (lists) | API + UI | Organize subscribers, target campaigns, trigger automations |
| Segments | API + UI | Filter by behavior (opened, clicked), demographics, custom fields — basic logic only |
| Custom fields | API + UI | Text fields for subscriber data, used in personalization and segmentation |
| SMS campaigns | UI + API | Text message campaigns integrated with email workflows |
| Landing pages | UI-only | Drag-and-drop builder, templates |
| Signup forms & popups | UI-only | Inline, popup, floating bar — embed on website |
| Transactional email | API | Template-based or raw HTML, event-triggered delivery |
| Statistics & reporting | API + UI | Opens, clicks, bounces, complaints, unsubscribes, group performance |
| Workflows (automations) | API + UI | Create, manage, activate, deactivate, performance metrics |
| Custom events | API | Fire custom events to trigger automations |
| Webhooks | API (paid plans only) | Subscribe to subscriber events (new subscriber, unsubscribe) |

## Pricing, limits & plan gates

| Plan | Price | Subscribers | Emails/mo | Key features |
|---|---|---|---|---|
| **Free Forever** | $0 | 2,500 | 15,000 | Campaigns, automation, landing pages, forms, popups, transactional email, 1 seat |
| **Standard** | From $7/mo | Scales | 12x subscriber count | No Sender branding, SMS, A/B testing, 3 seats |
| **Professional** | From ~$15/mo | Scales | 24x subscriber count | Free SMS credits, advanced automation, advanced reports, priority support, 10 seats, dedicated IP (20K+ subs) |
| **Enterprise** | Custom | Unlimited | Unlimited | Dedicated success manager, SSO (SAML v2), SLA, phone support |
| **Pay-As-You-Go** | Credits | Unlimited | Per credits purchased | No recurring fees, all features |

<!-- Pricing is approximate — verify against sender.net/pricing -->

**Plan gates:**
- Sender branding: removed on Standard+
- SMS: Standard+ only
- Webhooks: Standard+ only (paid plans)
- A/B testing: Standard+ only
- Dedicated IP: Professional at 20K+ subscribers
- SSO/SAML: Enterprise only
- API access: All plans including free

**Annual billing**: 30% discount on Standard and Professional plans.

## Integrations

**Native plugins** (data flows bidirectionally where noted):
- **WordPress**: Plugin for forms and subscriber sync
- **WooCommerce**: Plugin for ecommerce triggers, cart abandonment, purchase events
- **Shopify**: App for subscriber sync and ecommerce automation
- **PrestaShop**: Module for subscriber management
- **Jumpseller**: Native connector

**iPaaS:**
- **Zapier**: Triggers (New Subscriber, Subscriber Updated) + Actions (Create Subscriber, Update Subscriber, Delete Subscriber)
- **API**: Full REST v2 for custom integrations
- **Webhooks**: Account webhooks for subscriber events (paid plans)

**Email clients**: Works with any ESP — Sender handles sending infrastructure.

## Data model

### Subscriber

```json
{
  "id": "z61Z7gy",
  "email": "user@example.com",
  "firstname": "Jane",
  "lastname": "Doe",
  "phone": "+15551234567",
  "phone_country": "US",
  "created": "2025-06-05T12:55:13.000000Z",
  "status": {
    "email": "active",
    "temail": "active"
  },
  "ip_address": "85.206.2.72",
  "bounced_at": null,
  "unsubscribed_at": null,
  "location": null,
  "subscriber_tags": [
    {
      "id": "eVnJVX",
      "title": "vip-customer"
    }
  ],
  "columns": [
    {
      "id": "avAlVe",
      "title": "First name",
      "type": "text",
      "default": true,
      "value": "Jane"
    }
  ],
  "source": "FORM"
}
```

### Campaign

```json
{
  "id": "campaign-id",
  "title": "Weekly Newsletter",
  "subject": "This week's updates",
  "from": "Newsletter",
  "reply_to": "hello@example.com",
  "preheader": "Fresh insights inside",
  "content_type": "html",
  "status": "DRAFT",
  "google_analytics": 1,
  "auto_followup_active": false,
  "groups": ["group-id-1"],
  "segments": []
}
```
<!-- Constructed from docs — verify against live API -->

### Webhook

```json
{
  "id": "QbY0Wa",
  "account_id": "Eqqve",
  "url": "https://webhook.site/example",
  "topic": "groups/new-subscriber",
  "group": "eZVD4w",
  "total_deliveries": 0,
  "total_failures": 0,
  "response_time": 0,
  "status": "ACTIVE"
}
```

### Webhook Payload (subscriber event)

```json
{
  "id": "z61Z7gy",
  "email": "user@example.com",
  "firstname": "Jane",
  "lastname": null,
  "phone": null,
  "created": "2025-06-05T12:55:13.000000Z",
  "status": {
    "email": "active",
    "temail": "active"
  },
  "subscriber_tags": [
    {"id": "eVnJVX", "title": "custom_field_group"}
  ],
  "columns": [
    {"id": "avAlVe", "title": "First name", "type": "text", "value": "Jane"}
  ],
  "source": "FORM"
}
```

## Quick-start recipes

### Recipe 1: Create a subscriber and add to a group

**Trigger**: User signs up on your website via custom form.

**Steps**:
1. Capture email from form submission
2. Create subscriber via API with group assignment
3. Sender automation triggers welcome sequence

**cURL**:
```bash
curl -X POST https://api.sender.net/v2/subscribers \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "email": "newuser@example.com",
    "firstname": "Jane",
    "lastname": "Doe",
    "groups": ["GROUP_ID"],
    "trigger_automation": true
  }'
```

**Python**:
```python
import requests

headers = {
    "Authorization": "Bearer YOUR_API_TOKEN",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

data = {
    "email": "newuser@example.com",
    "firstname": "Jane",
    "lastname": "Doe",
    "groups": ["GROUP_ID"],
    "trigger_automation": True
}

resp = requests.post("https://api.sender.net/v2/subscribers", json=data, headers=headers)
print(resp.json())
```

**Gotchas**: Duplicate emails are silently updated, not rejected. Set `trigger_automation: true` to fire group-entry automations.

<!-- Constructed from docs — verify against live API -->

### Recipe 2: Create and send a campaign

**Trigger**: Weekly newsletter content is ready.

**Steps**:
1. Create a campaign via API
2. Send or schedule the campaign

**cURL — create campaign**:
```bash
curl -X POST https://api.sender.net/v2/campaigns \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "title": "Weekly Newsletter #42",
    "subject": "This week in tech",
    "from": "Tech Digest",
    "reply_to": "hello@example.com",
    "preheader": "5 stories you missed",
    "content_type": "html",
    "content": "<html><body><h1>Hello {{firstname}}</h1><p>Your weekly digest...</p></body></html>",
    "groups": ["GROUP_ID"],
    "google_analytics": 1
  }'
```

**cURL — send campaign** (replace `CAMPAIGN_ID` from create response):
```bash
curl -X POST https://api.sender.net/v2/campaigns/CAMPAIGN_ID/send \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

**Gotchas**: `reply_to` must be a verified domain in your account. Auto-followup can be configured at creation to resend to non-openers after 12-168 hours.

<!-- Constructed from docs — verify against live API -->

### Recipe 3: Listen for new subscribers via webhook

**Trigger**: New subscriber joins a specific group.

**Steps**:
1. Create a webhook via API (paid plans only)
2. Receive POST payloads at your endpoint

**cURL — create webhook**:
```bash
curl -X POST https://api.sender.net/v2/account/webhooks \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/sender",
    "topic": "groups/new-subscriber",
    "relation_id": "GROUP_ID"
  }'
```

**Python webhook listener (Flask)**:
```python
from flask import Flask, request

app = Flask(__name__)

@app.route("/webhooks/sender", methods=["POST"])
def handle_sender_webhook():
    data = request.json
    email = data.get("email")
    source = data.get("source")
    print(f"New subscriber: {email} from {source}")
    # Sync to CRM, trigger onboarding, etc.
    return "", 200
```

**Gotchas**: Webhooks require a paid plan (Standard+). Topics include `groups/new-subscriber` and `groups/unsubscribed` — `relation_id` (group ID) is required for group-scoped topics.

## Integration patterns

### CRM sync
- Use subscriber API to pull new/updated contacts → push to CRM
- Or set up webhooks (paid) to get real-time notifications on group changes
- Free plan alternative: use Zapier trigger "New Subscriber" → CRM action
- Field mapping: `firstname`, `lastname`, `email`, `phone`, plus custom `columns` array for additional fields

### Campaign analytics pipeline
- Use Statistics API endpoints to pull campaign performance data
- Endpoints: `/statistics/sents`, `/statistics/opens`, `/statistics/clicks`, `/statistics/hard-bounces`, `/statistics/soft-bounces`, `/statistics/complaints`, `/statistics/unsubscribes`
- Group Performance endpoint (Pro plan) provides aggregate metrics

### Migration from another ESP
1. Export subscribers as CSV from old ESP
2. Import into Sender: Subscribers > Import > Upload CSV
3. Map columns to Sender fields (email is auto-detected)
4. Recreate automations using Sender's visual builder
5. Verify domain authentication (SPF/DKIM) in Settings > Domains
6. Warm up gradually: send to most engaged 10% first, increase 20-30% daily
7. Monitor bounce and complaint rates for 2-4 weeks
