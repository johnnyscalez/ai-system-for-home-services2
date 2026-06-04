# Jeeng (OpenWeb) Platform Reference

## Overview

Jeeng (formerly PowerInbox, acquired by OpenWeb January 2023 for $100M) is an AI-powered publisher monetization platform that delivers targeted ads across email newsletters, web, push notifications, and newsreader applications. It reaches 150M+ unique opt-in subscribers across 650+ publishers including Insider, Seattle Times, Popular Science, Essence, Us Weekly, and Kitchn. Not self-serve — requires sales contact for onboarding.

## Capabilities & automation surface

| Capability | Description | Access |
|---|---|---|
| **AdFill** | Automatically backfills vacant ad spots with targeted ads for 100% monetization | UI-only (setup by account manager) |
| **AdServe** | Extends direct-sold campaigns into email through existing ad servers (GAM) | UI + API |
| **AdMarket** | Connects advertisers to 150M+ opt-in subscribers across email | UI + API |
| **Renderer** | Ad operations workflow optimization for Google Ad Manager | UI-only |
| **Publisher Reporting** | Revenue by container, placement, and performance | API-accessible |
| **Advertiser Reporting** | Campaign, campaign line, and performance reports | API-accessible |
| **Campaign Management** | Create and manage advertiser campaigns and creatives | API-accessible |
| **Push Notifications** | Personalized push notification delivery for additional revenue | UI-only |
| **Newsreader Monetization** | Up to 100% monetization of newsreader inventory | UI-only |
| **Consent Management** | Privacy-compliant ad delivery | UI-only |
| **CNAME Configuration** | Custom domain for ad serving | UI-only (setup) |
| **Ads.txt** | Publisher supply chain transparency | Manual (DNS) |
| **Google Ad Manager Integration** | Ad units, waterfall, sizing, key-values, native templates | UI + configuration |

## Pricing, limits & plan gates

- **No public pricing tiers** — all pricing is custom based on traffic volume
- **Revenue share**: 70-85% to publisher, depending on traffic volume and services used
- **Payment processing**: Via Tipalti with global payment methods. Jeeng covers transfer fees up to $5; amounts above that are deducted
- **Publisher requirements**: Genuine organic traffic, original high-quality content, stable monthly volume (higher traffic prioritized)
- **API access**: Requires account manager to provision credentials — no self-serve key generation
- **CPM rates**: Vary by geographic location, ad inventory type, and content category (not publicly disclosed)
- **Geographic focus**: North America and Europe primary; global audiences supported

## Integrations

| Integration | Direction | Notes |
|---|---|---|
| **Google Ad Manager** | Bidirectional | Ad units, waterfall prioritization, sizing, key-values, native templates |
| **Email ESPs** | Read from | Mailchimp, Constant Contact integration mentioned; ad tag insertion into newsletter templates |
| **Tipalti** | Write to | Payment processing for publisher payouts |
| **Ads.txt** | Read from | Publisher domain verification |

No Zapier, Make, or iPaaS integrations documented. No MCP server. No webhooks documented.

## Data model

### Publisher Container
<!-- Constructed from docs — verify against live API -->
```json
{
  "containerId": "string",
  "containerName": "string",
  "placements": [
    {
      "placementId": "string",
      "placementName": "string",
      "adFormat": "display|native",
      "status": "active|paused"
    }
  ]
}
```

### Advertiser Campaign Line
<!-- Constructed from docs — verify against live API -->
```json
{
  "campaignLineId": "string",
  "campaignId": "string",
  "status": "active|paused|completed",
  "budget": 0.00,
  "pacing": "even|accelerated",
  "targeting": {
    "geo": ["US", "GB"],
    "device": ["desktop", "mobile"],
    "dayparting": {}
  },
  "creatives": [
    {
      "creativeId": "string",
      "status": "active|paused"
    }
  ]
}
```

### Publisher Performance Report Response
<!-- Constructed from docs — verify against live API -->
```json
{
  "reportDate": "2026-05-26",
  "containerId": "string",
  "placementId": "string",
  "impressions": 0,
  "userImpressions": 0,
  "clicks": 0,
  "revenue": 0.00,
  "fillRate": 0.0,
  "ctr": 0.0
}
```

## Quick-start recipes

### Recipe 1: Authenticate and fetch publisher performance report

**Trigger**: Need to pull revenue data for a dashboard or data warehouse

**Steps**:
1. Get OAuth 2.0 access token via Azure AD client credentials flow
2. Call Publisher Performance Report endpoint with date range
3. Parse revenue, impressions, and fill rate data

**cURL**:
```bash
# Step 1: Get access token
curl -X POST \
  'https://login.microsoftonline.com/revenuestripe.onmicrosoft.com/oauth2/v2.0/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=YOUR_CLIENT_ID' \
  -d 'client_secret=YOUR_CLIENT_SECRET' \
  -d 'grant_type=client_credentials' \
  -d 'scope=https://revenuestripe.onmicrosoft.com/reportingservice/.default'

# Step 2: Use token to fetch publisher performance report
curl -X GET \
  'https://developers.jeeng.com/api/publisher/performance?startDate=2026-05-01&endDate=2026-05-26' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json'
```

**Python**:
```python
import requests

# Step 1: Get access token
token_url = "https://login.microsoftonline.com/revenuestripe.onmicrosoft.com/oauth2/v2.0/token"
token_data = {
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "grant_type": "client_credentials",
    "scope": "https://revenuestripe.onmicrosoft.com/reportingservice/.default"
}
token_resp = requests.post(token_url, data=token_data)
access_token = token_resp.json()["access_token"]

# Step 2: Fetch publisher performance
headers = {"Authorization": f"Bearer {access_token}"}
report = requests.get(
    "https://developers.jeeng.com/api/publisher/performance",
    headers=headers,
    params={"startDate": "2026-05-01", "endDate": "2026-05-26"}
)
print(report.json())
```

**Gotchas**: API base URL may differ — verify with your account manager. Token expires in ~3600 seconds. Use the `reportingservice` scope for publisher endpoints, `partners` scope for advertiser endpoints.

### Recipe 2: Update advertiser campaign line status

**Trigger**: Pause or resume a campaign line programmatically

**Steps**:
1. Authenticate with advertiser scope
2. POST to campaign lines update status endpoint

**cURL**:
```bash
# Get advertiser access token
curl -X POST \
  'https://login.microsoftonline.com/revenuestripe.onmicrosoft.com/oauth2/v2.0/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=YOUR_CLIENT_ID' \
  -d 'client_secret=YOUR_CLIENT_SECRET' \
  -d 'grant_type=client_credentials' \
  -d 'scope=api://revenuestripe.onmicrosoft.com/partners/.default'

# Update campaign line status
curl -X POST \
  'https://developers.jeeng.com/api/advertiser/campaign-lines/status' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"campaignLineId": "YOUR_LINE_ID", "status": "paused"}'
```

**Gotchas**: Use the `partners` scope (not `reportingservice`) for advertiser API calls.

## Integration patterns

### Google Ad Manager waterfall
Jeeng integrates as a demand source in GAM's waterfall. Configure ad units in GAM that map to Jeeng containers. Use key-value passthrough (AdServe) to pass first-party data from your ESP to GAM for targeting. Set priority levels to balance Jeeng demand against direct-sold campaigns.

### Revenue data pipeline
1. Authenticate via OAuth 2.0 client credentials flow (token caches for 1 hour)
2. Pull Container Report and Placement Report daily via cron
3. Store in your data warehouse with container/placement dimensions
4. Join with ESP subscriber data for per-subscriber revenue analysis

### Multi-channel setup
Configure email first (highest revenue), then layer:
1. **Email ads**: CNAME + ads.txt + container/placement setup
2. **Push notifications**: Enable via account manager, configure frequency caps
3. **Newsreader**: Add newsreader inventory for additional monetization
