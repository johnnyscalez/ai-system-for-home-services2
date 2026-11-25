# FieldBuilt AI — booked measures and chased quotes for flooring contractors

**Niche switch 2026-10-20: FieldBuilt now sells to flooring contractors, not HVAC.** All marketing (site, /book, /start funnels, ads, deck, content prompts) follows `docs/flooring-pivot.md`. The product engine below is still the HVAC build that runs Top Air; reworking it for flooring (measures, quote follow-up, flooring job types) is a separate, not-yet-started pass.

Last rewritten: 2026-09-06. The previous version of this file described the April 2026 "LeadReply / BookedAI" product, which no longer exists. If something here disagrees with `docs/SYSTEM-DOCUMENTATION.md` or `docs/NEW-ACCOUNT-PLAYBOOK.md`, those two files win.

## What this is

An AI employee for home-services contractors, HVAC first. It answers every inbound lead within seconds over SMS, phone (inbound and outbound), Facebook Messenger and WhatsApp, qualifies the lead, offers real appointment slots based on technician availability and drive routes, books the job, and in Housecall Pro mode writes it into the contractor's Housecall Pro with the right technician assigned. The owner wakes up to booked jobs.

Production: https://fieldbuiltai.com on Railway, auto-deploys from `main` of `johnnyscalez/ai-system-for-home-services2`. Cron worker (`cron-worker.mjs`) runs beside Next.js.

## Two product modes (per company: `companies.integration_mode`)

- `standalone` — full built-in CRM: pipeline board, appointments, calendar, reports. Default for new signups.
- `housecall_pro` — "agent mode". Housecall Pro stays the system of record. Our dashboard becomes a thin AI Performance view, every AI booking is pushed into HCP, tech rosters sync from HCP. Flipped automatically when an HCP API key is connected. CRM-only routes redirect to the dashboard (`components/layout/AgentModeGate.tsx`), except `/leads/[id]`.

## ICP and positioning (current)

Flooring contractors in the USA with their own installation crews (shop-at-home, showrooms that install, installer-led contractors). Offer, exact wording: "Guaranteed 20 in-home measures in 60 days, and every quote chased until it signs or says no." We run the Meta ads (client pays ad spend to Meta), the AI answers, qualifies, books the measure and chases every quote. Never state the guarantee's failure terms and never show price publicly; both are unconfirmed. Full rules: `docs/flooring-pivot.md`. Still never "software", "platform", "SaaS", "tool" or "app". Other positioning docs: `content-machine/brief.md`, `docs/positioning-holy-trio.md`. `docs/after-hours-pivot.md` is HVAC-era history.

Previous ICP (HVAC owners, 4+ techs, $1M+) is retired for marketing.

## Pricing (confirmed by Jonathan 2026-09-06)

- $5,997 install + $799/month retainer (HVAC-era figure; not confirmed for the flooring offer, never shown on public pages).
- Older figures that may still appear in docs and are NOT current: $297/month pilot, $2,250 + $597, $497/month, and the $297/$497/$997 self-serve tiers. Whether a discounted pilot offer still exists is unconfirmed; ask before quoting one.

## Where the truth lives

- `docs/SYSTEM-DOCUMENTATION.md` — every agent, automation, webhook and integration, plus the Top Air client config.
- `docs/NEW-ACCOUNT-PLAYBOOK.md` — the launch/QA bible. Phases 0–6, the deterministic guarantee ledger, seam-bug classes A–T, the 37-item pre-go-live battery. Read before touching booking, sequences, Messenger, HCP sync or prompts.
- `docs/meta-integration-runbook.md` — Meta app (ID 1607082137246333, ScaleZ BM), App Review status, client page onboarding.
- `docs/hcp-sync-map.md`, `docs/domain-configuration.md`.
- Git history is the audit trail (search "audit C", "adversarial finding", "class K").

## Stack

Next.js 16 App Router, TypeScript strict, Tailwind v4 + shadcn/ui, Framer Motion. Supabase (Postgres + Auth + Storage + Realtime; project `lzeukaamhhoctahmgbha`, org `zvagbbliuyauqvehwuuf`, us-west-1; use the Supabase MCP for DB work). Anthropic SDK only: `claude-sonnet-4-6` for conversation turns, `claude-haiku-4-5-20251001` for cheap passes. Twilio (numbers, SMS, voice, WhatsApp senders), ElevenLabs TTS (`eleven_flash_v2_5`), Meta Graph (Lead Ads, Messenger, WhatsApp Cloud), Housecall Pro REST, GoHighLevel (SMS transport + calendar for FieldBuilt's own funnel), Google Calendar + Gmail, Resend, Stripe (scaffolded).

## Key modules

- `lib/ai-engine.ts` — text agent (`runConversation`, `processAndSave`), prompt assembly, tools, and the deterministic guard layer (agreed-time contract via `resolveAgreedSlot`, phantom-booking guard, reasoning-leak block, `sanitizeAgentText`).
- `lib/voice-engine.ts`, `lib/voice-agents.ts`, `lib/voice-session.ts`, `lib/tts.ts`, `lib/call-notes.ts` — voice agent.
- `lib/technician-booking.ts`, `lib/routing.ts`, `lib/availability.ts`, `lib/timezones.ts`, `lib/job-types.ts` — slot finding, smart dispatch, anchor-day policy.
- `lib/sequences.ts`, `lib/appointment-reminders.ts` — follow-up cadences and reminders.
- `lib/housecall.ts`, `lib/housecall-sync.ts` — HCP client and reconcile (cron is the only sync path; HCP has no webhook registration).
- `lib/messenger.ts`, `lib/whatsapp-cloud.ts`, `lib/ghl.ts`, `lib/ghl-calendar.ts`, `lib/twilio.ts` (`sendToLead` transport ladder).
- `lib/fieldbuilt-qualify.ts` — qualification for FieldBuilt's own sales funnel (`service_type = fieldbuilt_sales`).
- `app/api/webhooks/*`, `app/api/voice/*`, `app/api/cron/*` — see `docs/SYSTEM-DOCUMENTATION.md` §5.
- `types/database.ts` is materially out of date versus the columns the engines use. Check the live schema via MCP, not this file.

## Live accounts

- 2026-10-26: all HVAC accounts (Top Air Solutions, the old Top Air duplicate, Rocket HVACR, Peak Comfort) were deleted along with their logins. Hardcoded IDs in `app/api/test/*` and `scripts/*` now point at nothing.
- FieldBuilt sales tenant — `34f34432-9e1e-4e74-9383-83d5f3f96946`, `service_type = fieldbuilt_sales`, books Google Meet sales calls through GHL. The only company left; jonathan@scalezz.com and the Meta App Review login (meta-reviewer@fieldbuiltai.com) live here.
- FieldBuilt's own sales SMS agent is a separate project: `/Users/haimcohen/Desktop/ai agent for fieldbuilt`.
- Content engine (research + idea generation) is a separate project: `/Users/haimcohen/Desktop/FieldBuilt Content Engine`, using the `content` schema in this same Supabase project and read-only access to `public`.

## Rules

- TypeScript always. shadcn before custom. DB access through `lib/supabase.ts` (client) / `lib/supabase-server.ts` (server; `createServiceRoleClient` for engines).
- Never hardcode secrets. Every table with company data has `company_id` and RLS.
- Multi-tenant: never bake client-specific copy into shared code (there is Top Air copy in the Facebook webhook `FORM_ANGLE`; treat as debt).
- All customer-facing times are computed in the company or service-address timezone, never server time.
- Prompts reduce how often a failure fires; only code guards are the promise. Add a deterministic guard, not a prompt line, for anything that must never happen.
- The AI never diagnoses and never quotes job prices; only the service-call fee policy. It always discloses it is an AI. Gas/CO/smoke is a hard-coded 911 interrupt.
- Test endpoints under `app/api/test/*` hit real companies and spend credits; they are unauthenticated. `app/api/dev/fix-user` is a password-reset backdoor and must be removed.
- Agent writing style: no dashes, no asterisks, relaxed everyday tone, ranges as "8 to 11am". Enforced by `sanitizeAgentText`.

## Design

Brand: FieldBuilt AI. Warm cream `#FAFAF8` ground, construction orange `#F97316` (deep `#EA580C`, soft `#FFF3EC`), warm near-black `#1A1614` for text and the logo tile (marketing pages are light mode only since 2026-10-20: no dark hero, proof band or footer), green `#16A34A` for revenue. Plus Jakarta Sans (display, 800), Inter (body), JetBrains Mono (data). Orange at most ~10% of any view. No purple, no corporate blue. Source of truth: `/Users/haimcohen/Desktop/design_handoff_fieldbuilt_brand/assets/brand.css`. Purple remnants remain in `PipelineBoard`, `components/ui/DateRangePicker.tsx` and `TechniciansClient` hover states; replace when touched.

## Environment variables

See `.env.local` for the full list: Supabase (url, anon, service role), `ANTHROPIC_API_KEY`, Twilio, `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`, Google OAuth, `NEXT_PUBLIC_APP_URL`, Stripe, `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, Facebook app id/secret/verify token, `CRON_SECRET`, `GOOGLE_MAPS_API_KEY`, `AGENT_INTAKE_URL`/`AGENT_INTAKE_SECRET`. Railway env must match; Twilio and Meta webhooks point at fieldbuiltai.com, never a railway.app URL.
