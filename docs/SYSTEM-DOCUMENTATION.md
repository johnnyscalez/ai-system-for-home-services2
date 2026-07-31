# FieldBuilt AI — Complete System Documentation

**Last updated:** July 31, 2026 (post-audit rounds 1+2: C1–C9/H4/H5 + all 9 adversarial seam fixes deployed)
**Production:** https://fieldbuiltai.com · Railway (US East) · auto-deploys from `main` on GitHub `johnnyscalez/ai-system-for-home-services2`
**Database:** Supabase project `lzeukaamhhoctahmgbha` (Postgres + Auth + RLS on all tables, scoped per `company_id`)

This document explains what the system does, every AI agent and its goal, every automation, every webhook, and every integration — in enough detail that someone new can understand exactly how a lead flows from first contact to revenue.

---

## 1. What the product is

FieldBuilt AI is an **AI employee for home-services contractors** (HVAC focus). It answers every lead within seconds — by SMS, phone call, Facebook Messenger, or WhatsApp — qualifies them, offers real appointment slots based on actual technician availability and drive routes, books the job, and (in V2 mode) writes it straight into the contractor's **Housecall Pro** CRM with the right technician assigned.

### The two product modes (per-company flag: `companies.integration_mode`)

| Mode | Value | What it means |
|---|---|---|
| **V1 — Standalone** | `standalone` | Full built-in CRM: pipeline board, appointments, calendar, reports. Default for new signups. |
| **V2 — AI employee** | `housecall_pro` | The contractor keeps Housecall Pro as their system of record. Our dashboard becomes a thin "AI Performance" view; every AI booking is pushed into HCP; tech rosters/schedules sync FROM HCP. Activated by connecting an HCP API key (Integrations → Housecall Pro card). |

The mode flips **automatically** when a Housecall Pro API key is connected (`POST /api/integrations/housecall/connect`): validates the key against HCP, stores the connection, sets `integration_mode='housecall_pro'`, imports employees as technicians, and starts the sync.

Route access in V2: CRM-only pages (`/leads` index, `/appointments`, `/calendar`, `/reports`, …) redirect to the dashboard (`components/layout/AgentModeGate.tsx`) — **except `/leads/<id>`**, the lead-detail/conversation thread, which stays reachable so the owner can read threads, see human-takeover state, and resume the AI.

---

## 2. The AI agents

All agents share one brain (Claude API) but run through different engines and channel adapters. Each company gets its own generated system prompt (`ai_agent_config.generated_system_prompt`, built at onboarding), agent name (e.g. "Linda"), knowledge base, qualifying questions, and pricing policy.

### 2.1 SMS agent (`lib/ai-engine.ts` — `runConversation` / `processAndSave`)

**Goal:** reply to every inbound text within seconds, qualify the lead, collect the missing contact fields, offer 2 real slots, and book.

- **Entry points:** inbound SMS webhook (`/api/webhooks/sms`), new-lead opener (generic webhook `/api/webhooks/lead`, Facebook leadgen), follow-up cron.
- **Prompt assembly (order matters):** base system prompt → financing block (explicit "no financing configured" if empty) → service-call fee policy (the ONLY prices it may quote) → company knowledge base → conversation flow playbook (per job type) → qualification rules → technician context → **Messenger channel flow (only when channel=messenger and the company configured one)** → live slots → lead file → silent reasoning checklist → SMS hard rules.
- **Tools:** `find_available_slots` (requires a 5-digit zip — without one it asks for the address instead), `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `request_callback` (triggers an outbound AI call), `update_lead_status`, `update_lead_details`.
- **Key behaviors:** never invents times (slots come only from the engine); never quotes job prices (only the visit fee policy); books only with confirmed time + address; hard opt-out compliance; every reply ends with a question or slot offer until booked.
- **Booking integrity (post-audit):** the tech locked at slot-offer time is **re-validated at booking** against the final job type + address zip (`techCanTakeBooking`); naive datetimes are interpreted in the company timezone; if the pre-selected tech is invalid, `selectTechnician` re-picks or the appointment is flagged for manual dispatch.

### 2.2 Messenger agent (same engine, channel adapter in `/api/webhooks/facebook`)

**Goal:** same as SMS, plus Messenger-specific contact collection (Messenger gives us no phone/email — the agent must collect a mobile number before booking; a regex also auto-captures phones/emails typed in chat).

- Leads are identified by **PSID** (`leads.messenger_psid`); until a real phone is captured the lead carries a `msgr:<psid>` placeholder (placeholder leads are excluded from SMS sequences and HCP pushes).
- **Human takeover:** when a team member replies manually from Meta's inbox (detected via message *echoes* that don't carry our app ID), the lead is set `ai_paused=true` — the AI goes silent for that thread, inbound messages are still logged to the CRM, and the owner resumes the AI from the lead-detail page. Replies sent from OUR dashboard (`/api/messenger/send`) also pause the AI.
- **Per-company Messenger flow override** (`ai_agent_config.messenger_instructions`): a channel-scoped instruction block injected ONLY for Messenger, only for companies that set it. Empty for everyone by default. **Top Air's** is a duct-cleaning sales flow (see §8).
- **[[SILENT]] protocol:** a Messenger flow may instruct the agent to emit the `[[SILENT]]` sentinel — the system then sends nothing at all (used when a lead refuses a mandatory upsell; lead is closed).

### 2.3 WhatsApp agent (same engine, adapters in `/api/webhooks/sms` for Twilio-WhatsApp and `/api/webhooks/meta-whatsapp` for Cloud API)

**Goal:** same as SMS; the lead's phone IS the chat, so no phone collection. Two provider paths:
- **Twilio senders** (company's Twilio number or their own number registered as a WhatsApp sender) → messages arrive on the same webhook as SMS with a `whatsapp:` prefix.
- **Meta Cloud API** (`whatsapp_connections` row with `provider='meta_cloud'`) → dedicated webhook resolves the company by `phone_number_id`; echoes of replies typed in the WhatsApp Business app trigger the same human-takeover pause.

### 2.4 Voice agent (`lib/voice-engine.ts` + `/api/voice/*`)

**Goal:** answer inbound calls (and place outbound/callback calls) as a natural-sounding human scheduler with full lead context — know who's calling, why, their history — qualify, check real availability, and book, all in one call.

- **Pipeline per turn:** Twilio `<Gather>` speech → `/api/voice/turn` → `runVoiceTurn` (Claude; Haiku for discovery speed, Sonnet once slots are offered — Sonnet reliably pairs verbal confirmation with the actual booking tool call) → reply text → ElevenLabs TTS via `/api/voice/speak`.
- **Latency/reliability architecture:** prompt caching on all Claude calls; TTS **pre-warmed** the moment reply text exists (`lib/tts.ts` dedup cache); TTS fully buffered with timeout+retry — `/api/voice/speak` **never** returns non-200 (last resort: a short silent WAV so Twilio never plays "application error"); CRM bookkeeping writes don't block the reply.
- **Tools:** `find_available_slots` (zip required; **enum-constrained job types** so the model can't invent unroutable strings), `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `schedule_callback`, `update_lead_status`, `transfer_to_human`, `end_call`.
- **Safety nets:** forced slot lookup when the model says "let me check" without calling the tool; never-silent guarantee (a live call never plays empty text); **booking safety net** — if the agent SAYS "you're booked" without calling the tool, the system books the matching slot deterministically; do-not-call regex fast path; failed tech assignment flags the appointment for manual dispatch and notifies the owner.
- **No mid-call note-taking:** the live call takes zero notes (they cost a second AI round-trip of dead air). Instead, on call completion (`/api/voice/status`), **the post-call summarizer** runs.

### 2.5 Post-call summarizer (`lib/call-notes.ts`)

**Goal:** after every completed voice call, one cheap Haiku pass reads the full transcript and files structured intel to the lead: `job_type`, `system_type`, `system_age`, plus factual notes (objections, competitor quotes, access details, homeowner status). Guarded against double-runs and empty/no-answer transcripts. This keeps the lead file as complete as live note-taking did, without the latency.

### 2.6 Outbound calling / AMD

- Sequence voice steps and lead-requested callbacks place outbound calls (`/api/voice/outbound`); `/api/voice/amd` does answering-machine detection — on voicemail it plays a short message (agent name + callback ask) and **expedites the next SMS step** so the lead gets a text minutes after the missed call.

### 2.7 FieldBuilt's own sales agent (separate project)

The marketing funnel (`fieldbuiltai.com/start/*` landing pages → `/api/lead-intake` proxy) forwards to a **separate Railway project** (`fieldbuilt-sales-agent`) which runs FieldBuilt's own SMS sales agent on GoHighLevel — that system qualifies contractors (min-techs gate), runs its own sequences, and books sales calls. It is documented separately; the only coupling is the intake proxy and shared brand.

---

## 3. Booking, availability & smart dispatch (`lib/technician-booking.ts`, `lib/routing.ts`, `lib/availability.ts`)

The heart of the product. **No phantom slots:** a time is only offered if a *qualified, free* technician exists for it.

### 3.1 `findSlotsForLead(company, jobType, zip)` — what may be offered

Filter chain (all computed in the **company timezone** — never server time):
1. **Company service-area gate** — if `companies.service_area_zips` is set (from office-address + radius onboarding), out-of-area zips fail immediately.
2. **Job-type capability** (`technicians.job_types`): empty list = tech does everything; non-empty = only those types. If NO active tech handles the type → `job_not_offered` → the AI politely declines ("that's not something we handle") and closes the lead. **Vocabulary-proof:** `canonJob()` normalizes both engines' vocabularies (`duct_cleaning` ≡ `ductwork`, `ac_installation` ≡ `new_ac_install`, …), handles case/separators, has substring fallbacks (`"air_duct_cleaning"` → duct), treats `general` as a wildcard, and **never declines an unclassifiable string** (unknown → unrestricted).
3. **Zip coverage** per tech (`serves_all_areas` / `zip_codes`).
4. **Schedule windows** — company booking windows (`ai_agent_config.appointment_windows` + `available_days`) intersected with each tech's weekly schedule.
5. **Busy check** — the tech's real day from BOTH systems: our `appointments` AND live Housecall Pro jobs (`getHcpBusyIntervals`).
6. **Route scoring (smart dispatch):** each candidate slot is scored by **insertion cost** — the extra drive minutes of inserting this job into that tech's existing day (zip centroids, haversine × road factor at 28 mph avg) plus an **end-of-day overtime penalty** (no "5 PM job an hour from home"). Slots costing >40 min more than the lead's best option are hidden entirely (`ROUTE_SLACK_MIN`). Least-loaded tech breaks ties.

Zip geodata: US Census centroids (~33k zips) with a 3-digit-prefix fallback for PO-box-only zips, so no valid business address resolves to nothing.

### 3.2 `selectTechnician(company, appointment, time, jobType, zip)` — who gets assigned

Used at booking time (voice bookings; SMS/Messenger when no valid pre-selected tech). Same hard filters as slot-finding — **job-type and zip failures are hard failures** (no silent any-tech fallback): the appointment is created unassigned, `flagNoTechAvailable` writes a "manual dispatch required" note, and the owner is notified. Schedule check runs in company tz; conflict check consults both our appointments and live HCP jobs with drive-time awareness.

### 3.3 Booking-time re-validation

A tech locked in at slot-offer time is re-checked at booking (`techCanTakeBooking`): still active, still handles the job type, still covers the final address zip. Slot offers **require a zip first** — the AI is instructed to collect the address before any times are shown.

---

## 4. Automations

### 4.1 Follow-up sequences (`lib/sequences.ts`, executed by `/api/cron/follow-up` every 5 min)

- **NO-REPLY** (lead never responded): 30min voice → 24h SMS → day-2 9am SMS → day-2 noon voice → day-4 SMS → day-7 SMS → day-14 SMS → lead marked `cold`. Created when a lead is ingested (webhook/leadgen).
- **REPLIED-NOT-BOOKED**: 4h SMS → next-day 9am SMS → 48h voice → day-5 SMS. Re-armed on every lead reply (timers restart from the last message), **using the post-AI-turn status** so a lead the AI just closed never gets re-armed.
- All step times are computed in the **company timezone** (no 3 AM texts).
- **Cancellation rules:** booking cancels pending steps; any reply cancels no-reply steps; human takeover (`ai_paused`) cancels SMS steps; deleted leads cancel everything; **terminal statuses** (single source of truth `TERMINAL_LEAD_STATUSES` — includes BOTH `lost` and `closed_lost` vocabularies, `appointment_booked`, `closed_won`, `unqualified`) cancel everything; permanent Twilio errors (21610 opted-out / 21211 invalid number) cancel the lead's whole sequence.
- **Messenger-only leads (placeholder phones) never enter SMS sequences.**

### 4.2 Opt-out (STOP) handling — deterministic, pre-AI, total

On SMS **and** Messenger, a message matching the opt-out pattern (`stop`, `unsubscribe`, `opt out`, `don't text me`, …) short-circuits **before** any AI call: lead → `closed_lost` + `ai_paused`, ALL pending sequences and scheduled calls cancelled, message logged, **no reply sent**. Opt-out is enforced EVERYWHERE: the appointment pipeline (confirmations/reminders/no-response calls) checks lead state and flags standing appointments for manual decision; ingestion webhooks never revive an opted-out lead; cron voice steps respect the pause. Confirmation replies OUTRANK opt-out — a booked lead replying "CANCEL" (per our own confirmation SMS) cancels the appointment, not the relationship; bare cancel/end/quit are not opt-out keywords.

**Quiet hours:** all follow-up SMS fire only 8 AM–9 PM company-local (TCPA); voice steps only within company working hours. Out-of-window steps wait for the next in-window cron run.

**Delivery failures:** transient carrier errors retry exactly once per lead, ever. Permanent errors (A2P-unregistered sender 30034, landline, invalid, opt-out) never retry — all outreach is cancelled and the lead is flagged `needs_attention` for a manual call.

### 4.3 Appointment reminders (`/api/cron/appointment-reminders` every 10 min)

Confirmation SMS+email at booking (fired only on the booking turn, never re-sent), 24-hour reminder, 2-hour reminder, and confirmation-request replies (YES/NO intercepted without an AI call). Uses the lead's real phone (a Messenger lead gets these only after their number is captured).

### 4.4 Housecall Pro reconcile (`/api/cron/hcp-sync` every 15 min)

For every active HCP connection: re-import technicians (roster changes), pull recent HCP jobs (office-side bookings/cancels/completions → mirrored into our `appointments` with `origin='hcp'`), retry failed booking pushes, and stamp revenue events. This cron is the **only** sync path — HCP's public API has no webhook registration (the `/webhooks` endpoint the code once called does not exist; `hcp_connections.hcp_webhook_id` stays null).

### 4.5 Cron worker

`cron-worker.mjs` runs alongside Next.js on Railway and calls the three cron endpoints (follow-up */5, reminders */10, hcp-sync */15) with the `CRON_SECRET` bearer token. All cron routes reject unauthenticated calls.

---

## 5. Webhooks (inbound event receivers)

| Endpoint | Source | What it does |
|---|---|---|
| `/api/webhooks/sms` | Twilio | Inbound SMS/WhatsApp. Opt-out short-circuit → confirmation-reply interception → AI turn → reply. Auto-captures address/email from message text. Schedules/cancels sequences from post-turn status. |
| `/api/webhooks/sms-status` | Twilio | Delivery receipts → `conversations.delivery_status` (failed sends get retried by channel fallback). |
| `/api/webhooks/facebook` (+ alias `/facebook2`) | Meta | Page webhooks: **`leadgen`** (fetch lead fields via Graph, punctuation-tolerant + fuzzy phone/email/zip extraction via the strict `parseLeadPhone` validator (extension-stripping, E.164-validated — garbage never becomes a phone), never drops silently — no-phone leads become `needs_attention` placeholders with the typed value kept in notes; creates lead → AI SMS opener → no-reply sequence. Duplicate Meta deliveries never re-text a lead that already has an outbound message; opted-out leads are never revived) and **`messaging`** (Messenger conversations: find/create lead by PSID, opt-out check, human-takeover echo detection, ai_paused gate, AI reply). HMAC signature verified. `/facebook2` exists because Meta once wedged delivery to the original callback path. |
| `/api/webhooks/meta-whatsapp` | Meta Cloud API | WhatsApp messages/statuses/echoes per `phone_number_id`; echo without our sends → human takeover pause. |
| `/api/webhooks/housecall` | HCP (if ever enabled) | Job created/updated/completed/canceled → upsert mirrored appointment, revenue attribution. Currently events do not arrive (no registration API); the reconcile cron covers this. |
| `/api/webhooks/lead` | Anything (Zapier, Make, website forms, GHL) | Generic lead intake, secret-authenticated (`?secret=` / header / body). Normalizes any field naming, creates lead, AI opener, sequences. **This is the universal bridge** when a source can't integrate directly. |
| `/api/webhooks/google` | Google Ads lead forms | Same pattern as generic. |
| `/api/webhooks/stripe` | Stripe | Subscription/billing events. |

**Outbound "webhooks" (what WE call):** Twilio (SMS/voice/provisioning), Meta Graph (send Messenger/WA messages, fetch leads, page tokens), Housecall Pro REST (customers/jobs/employees/schedules), ElevenLabs (TTS), Anthropic (all AI), Google Calendar (optional booking mirror), Resend (email).

---

## 6. Integrations

- **Twilio:** one local number auto-provisioned per company at onboarding (voice+SMS webhooks pre-wired). Call forwarding from the contractor's existing business number is self-verifying (Settings card walks the carrier codes; `/api/voice/verify-forwarding` places a test call). WhatsApp senders via Twilio's Senders API (options: FieldBuilt number or bring-your-own with OTP).
- **Meta (app "ai systems for home services", ID 1607082137246333):** Facebook Login → page selection → `leadgen,messages,messaging_postbacks` page subscription. Until App Review grants Advanced Access, pages connect via the documented onboarding runbook (page shared to ScaleZ BM + connect with an app-role profile; see `docs/meta-integration-runbook.md` and memory notes). Meta's own "Business Agent" AI must be OFF on the client's page or it intercepts messages before our webhook.
- **Housecall Pro:** API-key connection (MAX/XL plans). We READ: company, employees, schedules/jobs (busy times, reconcile). We WRITE: customers (resolve-or-create by last-10 phone), service addresses, and **jobs** for every AI booking (assigned to the mapped `hcp_employee_id`, with job type, lead source, and conversation summary in the job notes).
- **Stripe:** subscription billing + customer portal. **Resend:** transactional email (confirmations, reminders). **Google Calendar (optional):** mirrors bookings. **ElevenLabs:** the voice (flash v2.5, fixed voice settings).

---

## 7. Data model (the load-bearing tables)

`companies` (tenant root; `integration_mode`, service area, webhook_secret) · `users` · `leads` (status lifecycle: `just_came_in → contacted/active_conversation → qualified → appointment_booked → closed_won/closed_lost` + `needs_attention`, `cold`, `nurturing`; `ai_paused`, `channel`, `messenger_psid`, `hcp_customer_id`, `selected_slots` slot→tech map, `metadata`) · `conversations` (every message, `channel` sms/messenger/whatsapp/voice, `direction`, **`sent_by` ai|human** — the AI-vs-team distinction, delivery status) · `appointments` (tech assignment, `origin` ai|hcp, `hcp_job_id`, confirmation/reminder flags) · `sequences` (follow-up steps) · `scheduled_calls` (callbacks) · `technicians` (per-tech `job_types`, `zip_codes`, `serves_all_areas`, weekly `schedule`, `hcp_employee_id`, `status` — **inactive persists across HCP syncs; deleting doesn't**) · `ai_agent_config` (prompt, agent name, hours, windows, timezone, qualifying questions, `messenger_instructions`) · `knowledge_base` (business description, services, pricing_info, financing, custom AI knowledge) · `integrations` (Facebook page/token/forms) · `whatsapp_connections` · `hcp_connections` · `hcp_revenue_events` (attributed revenue) · `phone_numbers` · `voice_sessions` (live call state + transcript).

---

## 8. Top Air Solutions — client-specific configuration

Company `bc9fb131-2af2-4c31-8d79-f46bb9663e60` · V2 (HCP mode) · AI number +1 630-593-7895 · Agent "Linda" · Hours 8–18 America/Chicago · Two metros.

**Roster & routing (the owner/crew split):**
- **David G** — the owner slot (whichever of the two rotating owners is in the US answers this account's jobs). Job types: `ac_repair, ac_replacement, new_ac_install, furnace_repair, furnace_replacement, full_hvac_upgrade, hvac_maintenance`. Illinois metro (457-zip Chicago radius set, incl. the NW-Indiana corridor they genuinely serve).
- **Duct crew (IL):** Sam A A, John R, Ariel R, Sean S, Jacob G — `ductwork` only, same IL zip set.
- **Alex K:** `ductwork` only, **Michigan** (metro Detroit) — 188-zip set (job-history + 6-mile hole-fill dilation; includes Roseville 48066, Detroit proper, Southfield).
- **Inactive (never bookable):** Michael K (owner #2 — never booked by design), Jason B, Jonathan G, Daniel G.
- **Declined services** (no tech): heat pump, mini-split, thermostat, air-quality, other → polite "we don't offer that." **Michigan complex jobs are declined** (no MI owner) — per the owner.

**Messenger duct-cleaning flow** (`messenger_instructions`; Top Air ONLY — their FB ads are all duct-cleaning): greet by first name → home/townhome/condo → furnace count → last cleaned → **sell the $189 full clean (per furnace; $249 condo)** — the $89 ad package is never bookable; if the lead refuses the upsell after a genuine expert pitch, the agent emits `[[SILENT]]` and the lead is closed with no further replies. SMS/voice on the same account use the normal flow.

**Current operational state (July 31, 2026):** Messenger AI is **suspended** for live leads at the owner's request — the page subscription is `leadgen`-only (messages don't reach us; the team inbox handles chats) and existing Messenger leads are `ai_paused`. To re-enable: re-subscribe `messages,messaging_postbacks` with the stored page token and unpause. Facebook Lead Ads sync is LIVE (2 active duct forms; 17 dropped leads were backfilled as `needs_attention` on Jul 31 — owner to work that list).

---

## 9. Dashboards & reporting

- **V2 "AI Performance" dashboard:** 30-day bookings, night conversations, new leads, needs-attention queue, upcoming AI-booked jobs, and two revenue numbers — **"Booked by AI"** (jobs the AI created) and **"Sourced by AI"** (all HCP revenue on AI-sourced customers, 90-day window, from `hcp_revenue_events`). Manual HCP edits keep attribution with a "manually edited" tag.
- **Conversations page:** every thread across ALL channels (SMS/Messenger/WhatsApp/voice) with channel labels, message counts, a **"human handling"** badge for AI-paused threads; rows link to the lead detail (reachable in both modes) where the full thread, the sender distinction (`sent_by` ai/human), and the **Resume AI** control live.
- **Tech portal** (`/tech/*`): per-technician appointment list/calendar, on-my-way, close-out.

## 10. Known limitations & operational notes

- **HCP webhooks can't be registered via API** — sync freshness = the 15-min reconcile cron. If HCP support enables account webhooks, `/api/webhooks/housecall` is ready.
- **HCP `updated_after` is ignored by their API** — reconcile walks recent pages only; very old edits surface via the busy-time reads at booking rather than reconcile.
- **Meta App Review still pending** — until Advanced Access, client pages connect via the runbook (BM share + app-role profile) and Meta's Business Agent AI must be off.
- **Test endpoints** (`/api/test/*`) are self-cleaning harnesses used for verification (ai-flow, voice-flow, booking, dispatch, lead). Do not remove — they're the fastest way to prove a client's config end-to-end.
- The full audit trail of what was found and fixed on July 30–31 lives in the git history (`Audit fixes C1-C9 + H4/H5`) and the session notes.
