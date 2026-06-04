<!-- Source: https://developers.jeeng.com/ -->
<!-- Source: https://developers.jeeng.com/reference/getting-an-access-token -->
<!-- Source: https://developers.jeeng.com/docs/publisher-overview -->

# Jeeng (OpenWeb Email Monetization) API Reference

## Authentication

**Method**: OAuth 2.0 Client Credentials Flow via Microsoft Azure AD

**Token endpoint**:
```
POST https://login.microsoftonline.com/revenuestripe.onmicrosoft.com/oauth2/v2.0/token
```

**Content-Type**: `application/x-www-form-urlencoded`

**Required parameters**:

| Parameter | Type | Description |
|---|---|---|
| `client_id` | string | Application identifier (provisioned by account manager) |
| `client_secret` | string | Secret (provisioned by account manager) |
| `grant_type` | string | Must be `client_credentials` |
| `scope` | string | See scopes below |

**Scopes** (choose one based on API type):
- **Publisher APIs**: `https://revenuestripe.onmicrosoft.com/reportingservice/.default`
- **Advertiser APIs**: `api://revenuestripe.onmicrosoft.com/partners/.default`

**Success response (200)**:
```json
{
  "token_type": "Bearer",
  "expires_in": 3599,
  "ext_expires_in": 3599,
  "access_token": "<access_token>"
}
```

**Error response (400)**:
```json
{
  "error": "invalid_client",
  "error_description": "AADSTS7000215: Invalid client secret provided...",
  "error_codes": [7000215],
  "trace_id": "...",
  "correlation_id": "..."
}
```

**Usage**: Include the `access_token` in the Authorization header:
```
Authorization: Bearer <access_token>
```

**Auth quick-start**:
```bash
curl -X POST \
  'https://login.microsoftonline.com/revenuestripe.onmicrosoft.com/oauth2/v2.0/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&grant_type=client_credentials&scope=https://revenuestripe.onmicrosoft.com/reportingservice/.default'
```

## API Endpoints

### Publisher Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | Containers Report | Revenue and performance by container |
| GET | Placements Report | Revenue and performance by placement |
| GET | Publisher Performance Report | Aggregated publisher performance |

### Advertiser Endpoints

| Method | Endpoint | Description |
|---|---|---|
| PUT | Campaign Lines - Update | Update campaign line configuration |
| POST | Campaign Lines - Update Status | Pause/resume campaign lines |
| POST | Creatives - Update Status | Pause/resume creatives |
| GET | Campaigns Report | Campaign-level performance data |
| GET | Campaign Lines Report | Campaign line-level performance data |
| GET | Advertiser Performance Report | Aggregated advertiser performance |

## Gaps

- **Exact endpoint URLs not publicly documented** — the developer portal at `developers.jeeng.com` lists endpoints by name but full URL paths require account access or account manager confirmation
- **Rate limits not documented** — no published rate limit headers or retry strategy
- **Pagination pattern not documented** — unknown whether cursor, offset, or page-based
- **Webhook support** — no webhooks documented; all data access is pull-based via API
- **No Zapier/Make/iPaaS** integrations documented
- **No MCP server** available
- **No self-serve API key generation** — credentials must be provisioned by account manager
- **Request/response schemas** — only the auth endpoint has a fully documented schema; reporting and campaign management endpoint schemas require account access to view

## Legacy API portal

An older API portal exists at `https://powerinbox.developer.azure-api.net/` (Azure API Management). This may contain additional endpoint documentation accessible after account provisioning.

## Developer resources

- **Main developer portal**: https://developers.jeeng.com/
- **GitHub**: https://github.com/jeeng (contains `json-api-transform` utility)
- **Support**: support@jeeng.com
