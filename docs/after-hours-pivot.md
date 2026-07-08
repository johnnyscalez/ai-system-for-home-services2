# FieldBuilt AI — After-Hours Agent Pivot (July 2026)

## The product, rethought

**FieldBuilt AI is an after-hours AI employee for HVAC companies that run Housecall Pro.**
When the office closes, the AI answers every inbound lead — calls, SMS, (later) Facebook Messenger and WhatsApp — qualifies them, books them into Housecall Pro against real tech availability, upsells per the owner's playbook, and hands the office a complete morning briefing. The owner wakes up to jobs on his calendar.

We do not replace the contractor's CRM. HCP stays the system of record for calendar, techs, invoicing, reporting. Our UI is a thin performance dashboard: what the AI did, what it booked, what revenue it produced.

**Insight this is built on (from HVAC owner conversation, July 2026):** legitimate shops already run on HCP and won't switch CRMs. The unsolved leak is after hours — nobody captures, books, and upsells leads when the office is closed. Build the missing employee, not another CRM.

## Decisions locked in the grill session

| # | Decision |
|---|----------|
| 1 | **Channels:** inbound calls, SMS, FB Messenger, WhatsApp. All four built as adapters on one shared AI core. |
| 2 | **Launch gating:** ship when voice + SMS are solid. Messenger/WhatsApp go live whenever Meta app review clears (2–6 wks, starts now) — never block launch on Meta. Missed-call text-back is the voice safety net (same conversation continues over SMS). |
| 3 | **Architecture:** ONE codebase, one Railway deployment. Per-company flag `integration_mode: 'standalone' \| 'housecall_pro'`. Standalone companies keep the full CRM we built; HCP companies get the thin dashboard. Never two codebases. |
| 4 | **Dispatch:** per-tech profiles configured at onboarding (zips, job types) + live availability read from HCP schedule. AI matches lead → tech → open slot. Smart auto-dispatch (traffic, skills ranking) is phase 3. |
| 5 | **Money rules:** AI runs owner-configured upsells per service-call type (after-hours fee, membership attach, estimate add-on). AI NEVER quotes job prices — standard line: "the tech diagnoses and gives you an exact price before any work starts." |
| 6 | **Revenue attribution:** customer-level, not job-level. Every HCP webhook (job created/updated/cancelled) is checked against customers the AI sourced; manual office edits get tagged "manually edited in HCP" instead of losing attribution. Solves rebooking + estimate→install conversion. Two dashboard numbers: "Booked by AI" (exact jobs) and "Sourced by AI" (all revenue on AI-sourced customers, 90-day window). Partial/zero-dollar invoices: show "closed without amount — tap to add." |
| 7 | **HCP access:** API-key path (contractor must be on HCP MAX/XL plan — pilot owner pays ~$400/mo, likely qualifies; confirm he sees API key in Settings). Apply to HCP verified-partner program (OAuth) in parallel; never bet launch on it. Risk: HCP builds this themselves → mitigation is multi-CRM (watch cold-email replies for Jobber/ServiceTitan demand). |
| 8 | **Morning handoff (first-class feature):** (a) every AI-booked HCP job carries conversation summary in job notes + transcript link; (b) 7:30 AM owner digest via SMS+email — conversations, bookings, upsells sold, unresolved callback list; (c) on-call tech gets instant SMS the moment an emergency is booked (address + summary). |
| 9 | **Escalation:** no 2 AM live transfers. Demand-human → summarize, promise office-open handoff, notify owner/designated member immediately. Safety keywords (gas, CO, smoke) → hard-coded interrupt: "hang up and call 911 / gas company," log + notify owner. Not AI judgment — tested like a fire alarm. AI always discloses it's an AI assistant in its first sentence. |
| 10 | **Qualification:** zip code + job type checked early. Unqualified → tell them straight, end cleanly, no circles. |
| 11 | **Positioning survives:** "AI Office / done-for-you install" framing unchanged and strengthened — "we install an AI night shift into the CRM you already use." Wedge offer is deliberately narrow: after-hours only. System is 24/7-capable; daytime overflow is the expansion upsell. |
| 12 | **Pricing:** parked by founder decision. Existing structure stands until revisited. |
| 13 | **Cold campaign (999 leads):** already launched on old positioning — treat replies as live market data; pivot the offer in sales conversations; harvest CRM names from replies for integration roadmap. |

## What we keep / demote / build

**Keep (shared core):** AI engine (`lib/ai-engine.ts`), conversation playbooks, Twilio SMS + voice engine (`lib/voice-engine.ts` — inbound answering is an extension of existing outbound voice), follow-up sequences (SMS-only; Meta channels need template redesign due to 24-hour window rule), SMS delivery retry, onboarding shell.

**Demote (standalone-mode only):** CRM pipeline board, appointments page, lead detail as primary UI.

**Build new:**
1. HCP API client (`lib/housecall.ts`) — customers, jobs, employees, schedules + webhook receiver
2. `integration_mode` flag + company-level HCP credentials
3. After-hours activation window (per-company office hours; AI answers only outside them in v1)
4. Inbound voice answering as primary front door + missed-call text-back
5. Tech-matching config (onboarding: per-tech zips, job types, on-call default)
6. Upsell playbook config (per service-call type)
7. Escalation + safety interrupt engine
8. Attribution engine (webhook → customer matching → revenue stamping + "manually edited" tagging)
9. Morning digest + instant on-call tech notifications
10. Thin performance dashboard (conversations, bookings, attach rate, Booked-by-AI / Sourced-by-AI revenue)
11. Messenger + WhatsApp adapters (behind Meta review; submit `pages_messaging` + WhatsApp Business verification now — current FB app has only `email`/`public_profile` live)

## Build order (validation-first)

1. **Day 1 risk kill:** get pilot owner's HCP API key, prove we can read employees/schedules and create a job in his real account. The entire pivot rests on this working.
2. HCP adapter + webhook receiver + attribution engine skeleton
3. Inbound voice answering + after-hours window + missed-call text-back
4. Tech matching + booking flow end-to-end (call → qualified → job in HCP → tech notified)
5. Escalation/safety + upsell playbook
6. Morning digest + dashboard
7. Meta submissions in parallel from week 1; adapters when approved

## Open items

- Owner's after-hours channel mix (ask: "of leads you lose after hours — how many calls vs texts vs FB vs WhatsApp?") → decides polish priority
- Confirm owner's HCP plan exposes API keys
- Design-partner commitment (deposit/terms) — pending pricing discussion
- Verify HCP webhook event list (job completed / invoice paid / estimate approved) during build; fall back to nightly polling if events are missing
