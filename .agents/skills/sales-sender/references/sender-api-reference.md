<!-- Source: https://api.sender.net/ -->

# Sender API Reference

## Base URL

```
https://api.sender.net/v2/
```

HTTPS only — unencrypted HTTP is not supported.

## Authentication

Bearer token in the Authorization header:

```
Authorization: Bearer {API_ACCESS_TOKEN}
```

Generate tokens in Sender: Settings > API access tokens. Tokens are organization-wide (cover all groups/newsletters). Tokens are only shown once at creation — if lost, create a new one.

### Auth quick-start

```bash
curl -X GET https://api.sender.net/v2/subscribers \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

## Endpoints

### Subscribers (9 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/subscribers` | Create new subscriber |
| GET | `/subscribers` | List all subscribers |
| GET | `/subscribers/{id}` | Get subscriber data |
| PATCH | `/subscribers/{id}` | Update subscriber |
| DELETE | `/subscribers/{id}` | Delete subscriber |
| POST | `/subscribers/{id}/groups/{group_id}` | Add subscriber to a group |
| DELETE | `/subscribers/{id}/groups/{group_id}` | Remove subscriber from a group |
| DELETE | `/subscribers/{id}/phone` | Remove phone from subscriber |
| GET | `/subscribers/{id}/events` | Get subscriber's events |

#### Create subscriber — request

```json
POST /v2/subscribers

{
  "email": "user@example.com",
  "firstname": "Jane",
  "lastname": "Doe",
  "phone": "+15551234567",
  "groups": ["GROUP_ID"],
  "trigger_automation": true
}
```
<!-- Constructed from docs — verify against live API -->

#### Create subscriber — response

```json
{
  "id": "z61Z7gy",
  "email": "user@example.com",
  "firstname": "Jane",
  "lastname": "Doe",
  "created": "2025-06-05T12:55:13.000000Z",
  "status": {
    "email": "active",
    "temail": "active"
  }
}
```
<!-- Constructed from docs — verify against live API -->

### Groups (6 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/groups` | Create group |
| GET | `/groups` | List all groups |
| GET | `/groups/{id}` | Get group details |
| PATCH | `/groups/{id}` | Update group |
| DELETE | `/groups/{id}` | Delete group |
| GET | `/groups/{id}/subscribers` | List subscribers in group |

### Segments (4 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/segments` | List all segments |
| GET | `/segments/{id}` | Get segment details |
| DELETE | `/segments/{id}` | Delete segment |
| GET | `/segments/{id}/subscribers` | Query subscribers in segment |

### Fields (4 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/fields` | Create custom field |
| GET | `/fields` | List all custom fields |
| PATCH | `/fields/{id}` | Rename custom field |
| DELETE | `/fields/{id}` | Delete custom field |

### Campaigns (10 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/campaigns` | Create campaign |
| GET | `/campaigns` | List all campaigns |
| GET | `/campaigns/{id}` | Get campaign details |
| PATCH | `/campaigns/{id}` | Update campaign |
| DELETE | `/campaigns/{id}` | Delete campaign |
| POST | `/campaigns/{id}/send` | Send campaign immediately |
| POST | `/campaigns/{id}/schedule` | Schedule campaign send |
| POST | `/campaigns/{id}/copy` | Copy/duplicate campaign |
| GET | `/campaigns/{id}/errors` | Get campaign errors |
| DELETE | `/campaigns/{id}/schedule` | Cancel scheduled send |

#### Create campaign — request

```json
POST /v2/campaigns

{
  "title": "Weekly Newsletter #42",
  "subject": "This week in tech",
  "from": "Tech Digest",
  "reply_to": "hello@example.com",
  "preheader": "5 stories you missed",
  "content_type": "html",
  "content": "<html><body><h1>Hello</h1></body></html>",
  "groups": ["GROUP_ID"],
  "segments": [],
  "google_analytics": 1,
  "auto_followup_active": false,
  "auto_followup_subject": "Did you miss this?",
  "auto_followup_delay": 24
}
```

#### Create campaign — response

```json
{
  "success": true,
  "data": {
    "id": "campaign-id",
    "title": "Weekly Newsletter #42",
    "subject": "This week in tech",
    "status": "DRAFT"
  }
}
```
<!-- Constructed from docs — verify against live API -->

**Campaign parameters:**
- `content_type`: "editor", "html", or "text"
- `auto_followup_delay`: 12, 24, 48, 72, 96, 120, 144, or 168 hours
- `reply_to`: must belong to a verified domain in your account

### Transactional Campaigns (7 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/transactional-campaigns` | Create transactional campaign template |
| GET | `/transactional-campaigns` | List all transactional campaigns |
| GET | `/transactional-campaigns/{id}` | Get transactional campaign details |
| PATCH | `/transactional-campaigns/{id}` | Update transactional campaign |
| DELETE | `/transactional-campaigns/{id}` | Delete transactional campaign |
| POST | `/transactional-campaigns/{id}/send` | Send using template |
| POST | `/transactional-campaigns/send-raw` | Send raw HTML transactional email |

### Statistics (8 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/statistics/sents` | Get campaign sends |
| GET | `/statistics/opens` | Get campaign opens |
| GET | `/statistics/clicks` | Get campaign clicks |
| GET | `/statistics/hard-bounces` | Get hard bounces |
| GET | `/statistics/soft-bounces` | Get soft bounces |
| GET | `/statistics/complaints` | Get spam reports |
| GET | `/statistics/unsubscribes` | Get unsubscribes |
| GET | `/statistics/group-percentages` | Get group performance (Pro plan) |

### Workflows (6 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/workflows` | Create workflow |
| GET | `/workflows` | List all workflows |
| GET | `/workflows/{id}` | Get workflow details |
| PATCH | `/workflows/{id}` | Update workflow |
| DELETE | `/workflows/{id}` | Delete workflow |
| GET | `/workflows/{id}/performance` | Get workflow performance metrics |

### Custom Events (1 endpoint)

| Method | Path | Description |
|---|---|---|
| POST | `/custom-events` | Create custom event (triggers automations) |

### Account Webhooks (6 endpoints) — paid plans only

| Method | Path | Description |
|---|---|---|
| POST | `/account/webhooks` | Create webhook |
| GET | `/account/webhooks` | List all webhooks |
| GET | `/account/webhooks/{id}` | Get webhook details |
| PATCH | `/account/webhooks/{id}` | Update webhook |
| DELETE | `/account/webhooks/{id}` | Delete webhook |

#### Create webhook — request

```json
POST /v2/account/webhooks

{
  "url": "https://your-app.com/webhooks/sender",
  "topic": "groups/new-subscriber",
  "relation_id": "GROUP_ID"
}
```

#### Create webhook — response

```json
{
  "id": "QbY0Wa",
  "account_id": "Eqqve",
  "url": "https://your-app.com/webhooks/sender",
  "topic": "groups/new-subscriber",
  "group": "GROUP_ID",
  "total_deliveries": 0,
  "total_failures": 0,
  "response_time": 0,
  "status": "ACTIVE"
}
```

**Known webhook topics:**
- `groups/new-subscriber` — fires when a subscriber is added to a group
- `groups/unsubscribed` — fires when a subscriber leaves a group

Both require `relation_id` (the group ID to track).

## Pagination

Page-based pagination is used on list endpoints. Specific pagination parameters are not documented publicly — check response headers for page/total metadata.

<!-- Pagination details not fully documented — verify against live API -->

## Rate limits

Rate limits are not publicly documented. If you encounter HTTP 429 responses, implement exponential backoff starting with a 1-second delay.

## Error handling

The API returns standard HTTP status codes:
- `200` — Success
- `401` — Invalid or missing Bearer token
- `403` — Insufficient permissions (e.g., webhook on free plan)
- `404` — Resource not found
- `422` — Validation error (e.g., invalid email format)
- `429` — Rate limited

## Gaps

- Rate limits not publicly documented
- Pagination parameters not fully documented
- Full list of webhook topics not confirmed (only `groups/new-subscriber` and `groups/unsubscribed` verified)
- Custom event payload schema not documented
- Workflow creation parameters not documented
- No official SDKs (use any HTTP library)
