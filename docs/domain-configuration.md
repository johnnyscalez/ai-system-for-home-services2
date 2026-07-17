# Domain Configuration — fieldbuiltai.com

## Final Architecture

```
fieldbuiltai.com     → Cloudflare DNS → A record → 69.46.46.119 (Railway)
www.fieldbuiltai.com → Cloudflare DNS → CNAME    → d0tl7g7v.up.railway.app
```

DNS managed by: **Cloudflare** (nameservers: `kia.ns.cloudflare.com`, `kobe.ns.cloudflare.com`)
Domain registrar: **GoDaddy** (nameservers pointed to Cloudflare, GoDaddy no longer controls DNS)
Hosting: **Railway** — service `leadreply` at `leadreply-production.up.railway.app`

---

## Cloudflare DNS Records (active)

| Type  | Name | Content                       | Proxy |
|-------|------|-------------------------------|-------|
| A     | @    | 69.46.46.119                  | OFF (DNS only) |
| CNAME | www  | d0tl7g7v.up.railway.app       | OFF (DNS only) |
| MX    | @    | (Google Workspace MX records) | DNS only |
| TXT   | @    | SPF, DMARC, Google verify     | DNS only |

**Proxy must stay OFF** on A and CNAME records. Railway handles its own SSL via Let's Encrypt. Cloudflare proxy (orange cloud) intercepts TLS and breaks Railway's cert provisioning.

---

## Railway Domain Setup

Railway service has these custom domains configured (Settings → Networking):
- `fieldbuiltai.com`
- `www.fieldbuiltai.com`
- `leadreply-production.up.railway.app` (internal, always works)

Railway validates domain ownership via:
- CNAME record pointing to their verification hostname (`d0tl7g7v.up.railway.app`)
- TXT record `_railway-verify` with token

Once DNS resolves correctly, Railway auto-provisions Let's Encrypt SSL cert. No manual cert management needed.

---

## Why This Setup Was Needed (full history)

### Problem 1 — Domain pointed to old server
`fieldbuiltai.com` was previously hosted on Vercel. DNS A records (`15.197.225.128`, `3.33.251.168`) were AWS Global Accelerator IPs used by Vercel. When the app moved to Railway, these were never updated. Railway showed the service as "Online" (healthcheck uses internal URL), but the custom domain hit the old Vercel server → 404/405 on all routes.

### Problem 2 — GoDaddy locked A records
The two old Vercel A records showed "Can't delete / Can't edit" in GoDaddy DNS. Cause: GoDaddy's "Websites + Marketing" product was attached to the domain, locking those records. Fix: disconnect the GoDaddy Website product, which released the lock.

### Problem 3 — Wrong Railway IP
Initial fix used IP from `leadreply-production.up.railway.app` (`69.46.46.43`). Railway's domain validation checks a different hostname (`d0tl7g7v.up.railway.app` = `69.46.46.119`). Using the wrong IP caused Railway to stay in "Waiting for DNS update" state indefinitely.

### Problem 4 — GoDaddy can't CNAME at apex
Railway's domain validation requires a CNAME record at `@` (apex). Standard DNS spec forbids CNAME at apex. GoDaddy's DNS editor enforces this — returns "Invalid name provided for record data" when you try. An A record to the correct IP is accepted by the DNS system but Railway's verification system looks for a CNAME specifically.

### Solution — Move DNS to Cloudflare
Cloudflare supports **CNAME flattening** at the apex domain. Internally resolves the CNAME to an IP and serves it as an A record, satisfying both the DNS spec and Railway's CNAME requirement. Free plan sufficient.

Migration steps:
1. Added `fieldbuiltai.com` to Cloudflare (free plan)
2. Cloudflare scanned and imported existing DNS records
3. Turned proxy OFF (gray cloud) on A and www CNAME records
4. Updated www CNAME target from `leadreply-production.up.railway.app` to `d0tl7g7v.up.railway.app`
5. In GoDaddy: changed nameservers to `kia.ns.cloudflare.com` + `kobe.ns.cloudflare.com`
6. GoDaddy old nameservers (`ns17/ns18.domaincontrol.com`) removed automatically

---

## Middleware Fix (related)

`/technicians` route was unreachable because middleware used `path.startsWith("/tech")` for tech portal detection, which matched `/technicians`. Admins clicking Technicians in sidebar were silently redirected to `/dashboard`.

Fix: changed to `path === "/tech" || path.startsWith("/tech/")` — exact match or sub-path only.

---

## Environment Variables (Railway)

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_APP_URL` | `https://fieldbuiltai.com` | Login URL in invite emails |
| `RESEND_API_KEY` | `re_Eg5mvKX...` | Sends technician invite emails |

`RESEND_FROM_EMAIL` not set — defaults to `onboarding@resend.dev` (Resend test sender). Works for delivery but shows generic from-address. To use `noreply@fieldbuiltai.com` as sender, verify domain in Resend dashboard and set this variable.

---

## Technician Portal Routes

| URL | Purpose |
|-----|---------|
| `fieldbuiltai.com/tech/login` | Tech login page |
| `fieldbuiltai.com/tech/appointments` | Tech appointments list |
| `fieldbuiltai.com/tech/appointments/[id]` | Appointment detail |

Route group structure in Next.js App Router:
- `app/(tech-auth)/tech/login/page.tsx` — unauthenticated login page
- `app/(tech-dashboard)/tech/appointments/` — authenticated tech pages

---

## Ongoing Notes

- Cloudflare proxy (orange cloud) must remain OFF for Railway SSL to work
- If Railway cert ever needs re-provisioning: remove and re-add the domain in Railway Settings → Networking
- Technician delete now also removes auth.users entry (fixed) — email can be reused immediately after deletion
- `_railway-verify` TXT record must stay in Cloudflare DNS — Railway uses it for ownership verification
