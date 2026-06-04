<!-- Source: https://developer.constantcontact.com/api_guide/v3_technical_overview.html -->
<!-- Source: https://v3.developer.constantcontact.com/ -->
<!-- Source: https://developer.constantcontact.com/api_guide/rate_limits.html -->
<!-- Source: https://developer.constantcontact.com/api_guide/auth_overview.html -->

# Constant Contact V3 API Reference

## Authentication

OAuth 2.0 only — no API keys for standard calls. All requests require TLS 1.2+ with AES encryption.

### OAuth 2.0 Flows

| Flow | Use Case | Refresh Tokens |
|---|---|---|
| Authorization Code | Server-side web apps | Yes |
| PKCE | SPAs, mobile apps (no client secret) | Yes |
| Device Authorization | Input-constrained devices (TV, CLI) | No |
| Implicit | Legacy browser apps | No |

### Endpoints

```
Authorization:  https://authz.constantcontact.com/oauth2/default/v1/authorize
Token:          https://authz.constantcontact.com/oauth2/default/v1/token
Device Auth:    https://authz.constantcontact.com/oauth2/default/v1/device/authorize
```

### Scopes

| Scope | Grants |
|---|---|
| `contact_data` | Read/write contacts, view contact reports |
| `campaign_data` | Read/write email campaigns |
| `offline_access` | Required for refresh tokens (Authorization Code + PKCE only) |

### Token Details

- **Access token lifetime:** 1,440 minutes (24 hours)
- **Refresh token lifetime:** 180 days if unused; rotates on each use (recommended) or long-lived
- **Access token format:** JWT (Bearer), 1,000-1,200 characters

**Token exchange cURL:**
```bash
curl -X POST "https://authz.constantcontact.com/oauth2/default/v1/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "CLIENT_ID:CLIENT_SECRET" \
  -d "grant_type=authorization_code&code=AUTH_CODE&redirect_uri=YOUR_REDIRECT_URI"
```

**Token refresh:**
```bash
curl -X POST "https://authz.constantcontact.com/oauth2/default/v1/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "CLIENT_ID:CLIENT_SECRET" \
  -d "grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN"
```

## Base URL

```
https://api.cc.email/v3
```

All requests require HTTPS with TLS v1.2+. JSON only for request/response payloads. Resource IDs use UUID format (36 characters).

**Required headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
```

## Rate Limits

### Standard Accounts

| Limit | Threshold | Reset |
|---|---|---|
| Per-second | 4 requests/second | Rolling |
| Daily quota | 10,000 requests/day | UTC 00:00:00 |
| Queued activities | 1,000 queued bulk activities | Per account |

### Technology Partner Accounts

| Limit | Threshold |
|---|---|
| Per-second | 10 requests/second |
| Daily quota | 250,000 requests/day |

### Rate Limit Errors

Both return HTTP 429:
```json
{ "error_key": "throttled", "error_message": "Too Many Requests" }
{ "error_key": "quota_exceeded", "error_message": "Limit Exceeded" }
```

No `X-RateLimit-*` headers documented. Retry with exponential backoff on 429; for daily quota, resume after UTC midnight.

**Retry strategy:**
```python
import time
import requests

def api_call_with_retry(url, headers, max_retries=3):
    for attempt in range(max_retries):
        resp = requests.get(url, headers=headers)
        if resp.status_code == 429:
            wait = 2 ** attempt  # 1s, 2s, 4s
            time.sleep(wait)
            continue
        return resp
    raise Exception("Rate limit exceeded after retries")
```

## Pagination

Cursor-based. Use `limit` param (max 500) and follow `_links.next.href` in response.

```json
{
  "contacts": [...],
  "_links": {
    "next": {
      "href": "/v3/contacts?cursor=abc123&limit=500"
    }
  }
}
```

When `_links.next` is absent, you've reached the last page. Multiple query filters are ANDed. Dates use ISO-8601 UTC: `YYYY-MM-DDThh:mm:ss.sZ`.

```python
def get_all_contacts(headers):
    url = "https://api.cc.email/v3/contacts?limit=500&status=active"
    all_contacts = []
    while url:
        resp = requests.get(url, headers=headers)
        data = resp.json()
        all_contacts.extend(data.get("contacts", []))
        next_link = data.get("_links", {}).get("next", {}).get("href")
        url = f"https://api.cc.email{next_link}" if next_link else None
    return all_contacts
```

## Error Handling

JSON error array format:
```json
[{ "error_key": "contacts.api.not_found", "error_message": "contact_id is in an invalid format." }]
```

| Code | Meaning |
|---|---|
| 200/201/202/204 | Success |
| 400 | Bad request (invalid JSON, missing field) |
| 401 | Unauthorized (expired/invalid token) |
| 403 | Forbidden (insufficient scope) |
| 404 | Resource not found |
| 409 | Conflict (duplicate contact email) |
| 429 | Rate limited |
| 500/503 | Server error |

## Endpoints

### Account Services

| Method | Path | Description |
|---|---|---|
| GET | `/account/summary` | Get account details |
| PUT | `/account/summary` | Update account details |
| GET | `/account/summary/physical_address` | Get physical address |
| PUT | `/account/summary/physical_address` | Update physical address |
| POST | `/account/summary/physical_address` | Add physical address |
| GET | `/account/emails` | Get account email addresses |
| POST | `/account/emails` | Add an email address |
| GET | `/account/user/privileges` | Get user role privileges |

### Contacts

| Method | Path | Description |
|---|---|---|
| GET | `/contacts` | Get contacts (filterable by email, list, tag, segment, dates, SMS status) |
| POST | `/contacts` | Create a contact |
| GET | `/contacts/{contact_id}` | Get a single contact |
| PUT | `/contacts/{contact_id}` | Update a contact |
| DELETE | `/contacts/{contact_id}` | Delete a contact |
| POST | `/contacts/sign_up_form` | Upsert contact by email (no prior existence check needed) |
| GET | `/contacts/counts` | Get consent-state counts |
| GET | `/contacts/sms_engagement_history/{contact_id}` | Get SMS engagement history |

**Create contact request:**
```json
{
  "email_address": {
    "address": "user@example.com",
    "permission_to_send": "implicit"
  },
  "first_name": "Jane",
  "last_name": "Smith",
  "list_memberships": ["LIST_UUID"],
  "custom_fields": [{ "custom_field_id": "cf-uuid", "value": "Premium" }],
  "phone_numbers": [{ "phone_number": "+15551234567", "kind": "mobile" }],
  "taggings": ["tag-uuid-1"],
  "create_source": "Account"
}
```
<!-- Constructed from docs — verify against live API -->

**Create contact response (201):**
```json
{
  "contact_id": "CONTACT_UUID",
  "email_address": {
    "address": "user@example.com",
    "permission_to_send": "implicit",
    "created_at": "2024-01-15T10:30:00.000Z"
  },
  "first_name": "Jane",
  "last_name": "Smith",
  "list_memberships": ["LIST_UUID"],
  "create_source": "Account",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```
<!-- Constructed from docs — verify against live API -->

**Key query parameters for GET /contacts:**

| Parameter | Description |
|---|---|
| `email` | Filter by exact email address |
| `lists` | Filter by list UUID |
| `tags` | Filter by tag IDs |
| `segment_id` | Filter by segment |
| `status` | `active`, `optout`, `removed` |
| `include` | Subresources: `custom_fields`, `taggings`, `notes`, `phone_numbers`, `street_addresses`, `sms_channel` |
| `limit` | Page size |

### Contact Lists

| Method | Path | Description |
|---|---|---|
| GET | `/contact_lists` | Get all lists |
| POST | `/contact_lists` | Create a list |
| GET | `/contact_lists/{list_id}` | Get a specific list |
| PUT | `/contact_lists/{list_id}` | Update a list |
| DELETE | `/contact_lists/{list_id}` | Delete a list |

### Tags

| Method | Path | Description |
|---|---|---|
| GET | `/contact_tags` | Get all tags |
| POST | `/contact_tags` | Create a tag |
| GET | `/contact_tags/{tag_id}` | Get a specific tag |
| PUT | `/contact_tags/{tag_id}` | Rename a tag |
| DELETE | `/contact_tags/{tag_id}` | Delete a tag |

### Custom Fields

| Method | Path | Description |
|---|---|---|
| GET | `/contact_custom_fields` | Get all custom fields (max 100/account) |
| POST | `/contact_custom_fields` | Create a custom field |
| GET | `/contact_custom_fields/{custom_field_id}` | Get a custom field |
| PUT | `/contact_custom_fields/{custom_field_id}` | Update a custom field |
| DELETE | `/contact_custom_fields/{custom_field_id}` | Delete a custom field |

Field types: `text`, `date`, `datetime`, `currency`, `text_area`, `number`, `boolean`, `single_select`, `multi_select`.

### Segments

| Method | Path | Description |
|---|---|---|
| GET | `/segments` | Get all segments |
| POST | `/segments` | Create a segment |
| GET | `/segments/{segment_id}` | Get a segment |
| PUT | `/segments/{segment_id}` | Update a segment |
| PATCH | `/segments/{segment_id}/name` | Rename a segment |
| DELETE | `/segments/{segment_id}` | Delete a segment |

### Email Campaigns

| Method | Path | Description |
|---|---|---|
| GET | `/emails` | Get all campaigns (filterable by date, name) |
| POST | `/emails` | Create a campaign |
| GET | `/emails/{campaign_id}` | Get a campaign |
| PATCH | `/emails/{campaign_id}` | Rename a campaign |
| DELETE | `/emails/{campaign_id}` | Delete a campaign (not if Scheduled) |
| GET | `/emails/activities/{id}` | Get campaign activity details |
| PUT | `/emails/activities/{id}` | Update campaign content/targets |
| POST | `/emails/activities/{id}/schedules` | Schedule send (`"0"` = immediately) |
| GET | `/emails/activities/{id}/schedules` | Get scheduled time |
| DELETE | `/emails/activities/{id}/schedules` | Unschedule |
| POST | `/emails/activities/{id}/tests` | Test send (up to 5 recipients) |
| GET | `/emails/activities/{id}/previews` | HTML preview |
| POST | `/emails/activities/{id}/abtest` | Create A/B test |
| GET | `/emails/activities/{id}/abtest` | Get A/B test details |
| DELETE | `/emails/activities/{id}/abtest` | Delete A/B test |
| POST | `/emails/activities/{id}/non_opener_resends` | Resend to non-openers |

**Create campaign request:**
```json
{
  "name": "May Newsletter",
  "email_campaign_activities": [{
    "format_type": 5,
    "from_name": "Your Name",
    "from_email": "you@yourdomain.com",
    "reply_to_email": "you@yourdomain.com",
    "subject": "May Updates",
    "html_content": "<html><body><h1>May Newsletter</h1></body></html>",
    "contact_list_ids": ["LIST_UUID"],
    "segment_ids": ["SEGMENT_UUID"]
  }]
}
```
<!-- Constructed from docs — verify against live API -->

`format_type: 5` = custom code email (supports segments + personalization tags).

### Email Reporting

| Method | Path | Description |
|---|---|---|
| GET | `/reports/email_reports/{id}/tracking/sends` | Sends |
| GET | `/reports/email_reports/{id}/tracking/opens` | Opens |
| GET | `/reports/email_reports/{id}/tracking/unique_opens` | Unique opens |
| GET | `/reports/email_reports/{id}/tracking/clicks` | Clicks |
| GET | `/reports/email_reports/{id}/tracking/bounces` | Bounces |
| GET | `/reports/email_reports/{id}/tracking/optouts` | Opt-outs |
| GET | `/reports/email_reports/{id}/tracking/forwards` | Forwards |
| GET | `/reports/email_reports/{id}/tracking/didnotopens` | Did-not-opens |
| GET | `/reports/email_reports/{id}/links` | Link clicks |
| GET | `/reports/stats/email_campaign_activities/{ids}` | Aggregate stats |
| GET | `/reports/summary_reports/email_campaign_summaries` | Campaign summaries |

### Contact Reporting

| Method | Path | Description |
|---|---|---|
| GET | `/reports/contact_reports/{id}/open_and_click_rates` | Contact open/click rates |
| GET | `/reports/contact_reports/{id}/tracking/count` | Tracking event count |
| GET | `/reports/contact_reports/{id}/tracking` | Full contact tracking report |

### Landing Page Reporting

| Method | Path | Description |
|---|---|---|
| GET | `/reports/landing_pages/contacts_adds` | Contacts added |
| GET | `/reports/landing_pages/unique_contact_clicks` | Unique clicks |
| GET | `/reports/landing_pages/unique_contact_sms_opt_ins` | SMS opt-ins |

### SMS Reporting

| Method | Path | Description |
|---|---|---|
| GET | `/reports/summary_reports/sms_campaign_summaries` | SMS campaign summaries |

### Events

| Method | Path | Description |
|---|---|---|
| GET | `/events` | Get all events |
| POST | `/events/default` | Create event with default settings |
| GET | `/events/{event_id}` | Get a single event |
| PATCH | `/events/{event_id}` | Update an event |
| POST | `/events/{event_id}/copy` | Duplicate an event |
| POST | `/events/{event_id}/check_in/tickets` | Check in tickets |
| POST | `/events/{event_id}/undo_check_in/tickets` | Reverse check-ins |
| GET | `/events/{event_id}/tracks/{track_key}/registrations` | Get registrations |
| GET | `/events/{event_id}/tracks/{track_id}/registrations/{reg_id}` | Get single registration |
| PUT | `/events/{event_id}/tracks/{track_id}/registrations` | Update registration status |
| PUT | `/events/{event_id}/tracks/{track_id}/registrations/payment_status` | Update payment status |

### Social

| Method | Path | Description |
|---|---|---|
| GET | `/social/profiles` | Get connected social profiles |
| GET | `/social/connections` | List connected networks |
| GET | `/social/hashtags/groups` | Get saved hashtag groups |
| POST | `/social/posts` | Create social posts (multi-profile) |

### Bulk Activities

| Method | Path | Description |
|---|---|---|
| GET | `/activities` | Get all activities |
| GET | `/activities/{activity_id}` | Get activity status |
| POST | `/activities/contacts_json_import` | Import contacts via JSON (max 39,999) |
| POST | `/activities/contacts_file_import` | Import contacts via CSV |
| POST | `/activities/contact_exports` | Export contacts |
| POST | `/activities/add_list_memberships` | Add contacts to lists |
| POST | `/activities/remove_list_memberships` | Remove from lists |
| POST | `/activities/contact_delete` | Bulk delete contacts (500+) |
| POST | `/activities/contacts_taggings_add` | Add tags |
| POST | `/activities/contacts_taggings_remove` | Remove tags |
| GET | `/activities/{activity_id}/csv` | Download exported CSV |

Bulk activities are asynchronous — poll `GET /activities/{activity_id}` for status. Max 1,000 queued per account.

## Webhooks

**Technology Partner-only** — standard accounts cannot subscribe to webhooks.

### Supported Event Topics

| Topic ID | Event |
|---|---|
| `tier.increase` | Billing tier upgrade |
| `tier.decrease` | Billing tier downgrade |
| `account.cancel` | Account cancelled |
| `account.disable` | Account disabled |

### Webhook Payload

```json
{
  "url": "https://api.cc.email/v3/partner/accounts/{account_id}/plan",
  "api_key": "{api_key}",
  "event_type": "tier.increase"
}
```

The payload is a notification pointer — call the `url` for full event data. Retries every 60 seconds for up to 1 hour.

For regular users, use **Zapier triggers** as webhook alternatives:
- New Contact → webhook POST
- Contact Unsubscribed → notification
- New List → notification

## SDKs

- Ruby: [github.com/constantcontact/constant-contact-v3api-client-ruby](https://github.com/constantcontact/constant-contact-v3api-client-ruby)
- C#: [github.com/constantcontact/constant-contact-v3api-client-csharp](https://github.com/constantcontact/constant-contact-v3api-client-csharp)
- PHP: available (released September 2025)
- Interactive reference: [developer.constantcontact.com/api_reference/index.html](https://developer.constantcontact.com/api_reference/index.html)

## Gaps

- Interactive API reference is JS-rendered — full endpoint details could not be scraped
- Webhook payload schemas limited (Technology Partners only, notification pointers not data payloads)
- SMS campaign creation endpoints not documented in accessible pages (Premium, UI-only suspected)
