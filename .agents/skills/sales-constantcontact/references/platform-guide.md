# Constant Contact Platform Reference

## Overview

Constant Contact is an established email marketing platform (founded 1995) targeting small businesses and nonprofits. Primary differentiator is built-in event management with ticket sales. V3 REST API with OAuth 2.0. Overpriced compared to newer competitors but has strong deliverability (88-90%, ranked 2nd in independent tests) and 300+ integrations. No free plan.

## Capabilities & automation surface

| Capability | Access | Notes |
|---|---|---|
| Email campaigns | API + UI | Drag-and-drop editor, ~200 templates, HTML editor, A/B testing (Standard+) |
| Automation workflows | UI + limited API | Welcome, birthday, anniversary, click-based triggers. Custom paths Premium-only |
| Contact management | API + UI | Lists, segments, tags, custom fields, bulk import/export |
| Event management | API + UI | Registrations, ticket sales (PayPal/Stripe, 5.4% + $0.80), check-ins, payment tracking |
| Landing pages | UI-only | Basic builder, limited templates and customization |
| Signup forms | UI-only | Pop-up, flyout, banner, inline — limited customization |
| Social posting | API + UI | Facebook, Instagram, LinkedIn — schedule and publish |
| SMS campaigns | UI-only | US only, Premium plan required, modest allocation included |
| Reporting | API + UI | Opens, clicks, bounces, opt-outs, link tracking, campaign stats |
| A/B testing | UI-only | Subject line and content testing, Standard+ only |
| AI content generator | UI-only | Email and social post content suggestions |
| Contact segments | API + UI | Behavioral and demographic filtering, Standard+ only |

## Pricing, limits & plan gates

| Plan | Price (500 contacts) | Users | Key features |
|---|---|---|---|
| **Lite** | $12/mo | 1 | Basic campaigns, 1 automation (welcome email), social posting, basic event forms |
| **Standard** | $35/mo | 3 | A/B testing, segmentation, pre-built automations, drill-down reporting |
| **Premium** | $80/mo | Unlimited | Custom automation paths, dynamic content, SMS (US), advanced segmentation, SEO tools, Ad Manager |

<!-- Pricing verified April 2026 — rates scale with contact count. Annual prepayment saves 15%. -->

**Scaling costs (Standard plan):**
- 500 contacts: $35/mo
- 1,000 contacts: $30/mo (price drops oddly)
- 2,500 contacts: $50/mo
- 5,000 contacts: $80/mo
- 10,000 contacts: $120/mo

**Plan gates that affect integrations:**
- OAuth API access: all plans
- Webhooks: Technology Partners program only (not available to regular users)
- A/B testing: Standard+
- Segmentation: Standard+
- SMS: Premium only, US only
- Custom automation: Premium only
- Dedicated IP: not available on any plan

**Critical billing detail:** ALL contacts count toward billing — including unsubscribed, bounced, and inactive. Deleting contacts (not just unsubscribing) is the only way to reduce your billable count.

## Integrations

**Native connectors:** Shopify, WooCommerce, WordPress, Salesforce, Outlook, Canva, Vimeo, Eventbrite, DonorPerfect, Mindbody, and 300+ more via app marketplace.

**Zapier (bidirectional):**
- Triggers: New Contact, Contact Unsubscribed, New List Created
- Actions: Create/Update Contact, Add Contact to List, Add Tag to Contact

**Data flow patterns:**
- Shopify → CC: Customer data sync, purchase-triggered automations
- WordPress → CC: Form submissions create contacts
- CC → CRM: Contact activity data via API or Zapier
- CC → Analytics: Campaign performance via reporting API

## Data model

### Contact object
```json
{
  "contact_id": "04545ea0-451c-45e8-b0ca-d4ae45450c45",
  "email_address": {
    "address": "user@example.com",
    "permission_to_send": "implicit",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-06-20T14:22:00.000Z",
    "opt_in_source": "Account",
    "opt_in_date": "2024-01-15T10:30:00.000Z"
  },
  "first_name": "Jane",
  "last_name": "Smith",
  "job_title": "Founder",
  "company_name": "Acme Inc",
  "create_source": "Account",
  "list_memberships": ["a1234567-89ab-cdef-0123-456789abcdef"],
  "taggings": ["tag-uuid-1"],
  "custom_fields": [
    {
      "custom_field_id": "cf-uuid-1",
      "value": "Premium"
    }
  ],
  "phone_numbers": [
    {
      "phone_number": "+15551234567",
      "kind": "mobile"
    }
  ],
  "street_addresses": [],
  "notes": []
}
```
<!-- Constructed from docs — verify against live API -->

### Email campaign object
```json
{
  "campaign_id": "campaign-uuid",
  "name": "May Newsletter",
  "type": "CUSTOM_CODE_EMAIL",
  "status": "DRAFT",
  "current_status": "Draft",
  "created_at": "2024-05-01T09:00:00.000Z",
  "updated_at": "2024-05-01T09:30:00.000Z",
  "type_code": 10
}
```
<!-- Constructed from docs — verify against live API -->

### Event object
```json
{
  "event_id": "event-uuid",
  "name": "Product Launch Webinar",
  "title": "Product Launch Webinar",
  "status": "ACTIVE",
  "type": "OTHER",
  "start_date": "2024-06-15T14:00:00.000Z",
  "end_date": "2024-06-15T16:00:00.000Z",
  "location": {
    "location": "Virtual",
    "virtual_link": "https://zoom.us/j/123456"
  },
  "contact": {
    "email": "events@example.com",
    "name": "Jane Smith"
  },
  "is_virtual_event": true,
  "created_at": "2024-05-01T09:00:00.000Z"
}
```
<!-- Constructed from docs — verify against live API -->

## Quick-start recipes

### Recipe 1: Create a contact and add to a list

**Use case:** Signup form on your website sends new contacts directly to Constant Contact.

**cURL:**
```bash
curl -X POST "https://api.cc.email/v3/contacts" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": {
      "address": "newuser@example.com",
      "permission_to_send": "implicit"
    },
    "first_name": "Jane",
    "last_name": "Smith",
    "list_memberships": ["LIST_UUID_HERE"],
    "create_source": "Account"
  }'
```

**Python:**
```python
import requests

BASE = "https://api.cc.email/v3"
TOKEN = "YOUR_ACCESS_TOKEN"
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

contact = {
    "email_address": {
        "address": "newuser@example.com",
        "permission_to_send": "implicit"
    },
    "first_name": "Jane",
    "last_name": "Smith",
    "list_memberships": ["LIST_UUID_HERE"],
    "create_source": "Account"
}

resp = requests.post(f"{BASE}/contacts", json=contact, headers=headers)
if resp.status_code == 201:
    print("Contact created:", resp.json()["contact_id"])
elif resp.status_code == 409:
    print("Contact already exists — use PUT to update")
else:
    print("Error:", resp.status_code, resp.json())
```

**Gotchas:**
- Duplicate emails return 409 Conflict — use PUT to update existing contacts
- `permission_to_send` must be "implicit" or "explicit" — "explicit" is recommended for GDPR compliance
- `list_memberships` takes an array of list UUIDs — get these via `GET /v3/contact_lists`

### Recipe 2: Send a campaign to a specific list

**Use case:** Monthly newsletter to your subscriber list.

**Python:**
```python
import requests

BASE = "https://api.cc.email/v3"
TOKEN = "YOUR_ACCESS_TOKEN"
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

# Step 1: Create the campaign
campaign = {
    "name": "May Newsletter",
    "email_campaign_activities": [{
        "format_type": 5,
        "from_email": "you@yourdomain.com",
        "from_name": "Your Name",
        "reply_to_email": "you@yourdomain.com",
        "subject": "May Updates - What's New",
        "html_content": "<html><body><h1>May Newsletter</h1><p>Your content here.</p></body></html>",
        "contact_list_ids": ["LIST_UUID_HERE"]
    }]
}

resp = requests.post(f"{BASE}/emails", json=campaign, headers=headers)
campaign_id = resp.json()["campaign_activities"][0]["campaign_activity_id"]

# Step 2: Schedule or send immediately
schedule = {
    "scheduled_date": "0"  # "0" = send immediately
}
resp = requests.post(
    f"{BASE}/emails/activities/{campaign_id}/schedules",
    json=schedule,
    headers=headers
)
print("Campaign scheduled:", resp.status_code)
```

**Gotchas:**
- `format_type` 5 = custom code email; use this for HTML campaigns
- `scheduled_date` of "0" sends immediately; use ISO-8601 for future scheduling
- From email must be a verified sender address in your CC account

### Recipe 3: Export campaign performance data

**Use case:** Pull open/click metrics into your analytics dashboard.

**Python:**
```python
import requests

BASE = "https://api.cc.email/v3"
TOKEN = "YOUR_ACCESS_TOKEN"
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/json"
}

# Get all campaigns
resp = requests.get(f"{BASE}/emails", headers=headers, params={"limit": 50})
campaigns = resp.json().get("campaigns", [])

for c in campaigns:
    campaign_id = c["campaign_activities"][0]["campaign_activity_id"]

    # Get stats for each campaign
    stats = requests.get(
        f"{BASE}/reports/email_reports/{campaign_id}",
        headers=headers
    )
    if stats.status_code == 200:
        data = stats.json()
        print(f"{c['name']}: "
              f"sent={data.get('sends', 0)}, "
              f"opens={data.get('opens', 0)}, "
              f"clicks={data.get('clicks', 0)}, "
              f"bounces={data.get('bounces', 0)}")
```

**Gotchas:**
- Pagination uses cursor-based navigation — check `_links.next` in response
- Stats may take up to 24 hours to fully populate after a send
- Rate limits apply — implement exponential backoff on 429 responses

## Integration patterns

### CRM sync (Salesforce/HubSpot)
- Native Salesforce integration syncs contacts bidirectionally
- HubSpot sync via Zapier: CC trigger (New Contact) → HubSpot action (Create/Update Contact)
- Field mapping: CC custom fields → CRM properties (requires manual mapping)
- Sync frequency: near-real-time via Zapier, batch via API bulk export

### Webhook listeners (Technology Partners only)
- Webhooks available only through the Technology Partners program
- Regular users should use Zapier triggers as a webhook alternative
- Zapier triggers fire on: new contact, unsubscribe, new list

### Batch pipeline pattern
- Bulk export: `POST /v3/activities/contact_exports` → poll activity status → download CSV
- Bulk import: `POST /v3/activities/contacts_file_import` with multipart form data
- Rate limits: implement retry with exponential backoff on 429 responses
- Pagination: use `limit` param (max 500) and follow `_links.next` cursor
