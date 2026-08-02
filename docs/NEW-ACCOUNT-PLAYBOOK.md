# FieldBuilt AI — New Account & New Agent Playbook

**Purpose:** this is the map for launching every new account and every new chat/voice agent RIGHT the first time — one pass, no back-and-forth revisions. It is built from the complete July 2026 test campaign: two audit rounds, the adversarial seam-testing round, the exhaustive live-issue test pass, and every production incident (London Cook, Marilyn, the zip extractor, the A2P block). Every checklist item below exists because skipping it already burned us once.

**How to use:**
1. Setting up a new account → run Phases 0–5 top to bottom, checking every box.
2. Creating/changing an agent for an existing account → run Phase 2 + Phase 5.
3. Debugging a weird production behavior → jump to Phase 4 (the seam-bug map) and find the matching class.
4. Never mark an account live until Phase 5's test battery passes and Phase 6's go-live checks are done.

**The one law learned from all of this:** *two subsystems that are each correct in isolation will disagree at their seam, and the failure surfaces as a confident false statement to a customer.* ("I'm sorry Marilyn, it looks like we don't actually service the 60619 zip code.") The only defense is testing the seams with real-shaped data before a real lead hits them.

---

## Phase 0 — Infrastructure (before anything else)

| # | Check | Why (what broke before) |
|---|---|---|
| 0.1 | ☐ **A2P 10DLC registered** — Brand + Campaign approved in Twilio Console, number attached to the Messaging Service | THE hard blocker. An unregistered account = every SMS silently carrier-blocked with error 30034 while the dashboard looks fine. We ran for weeks with ZERO deliverable SMS. GHL accounts "just work" because LeadConnector registers under its ISV umbrella — a raw Twilio account does NOT. |
| 0.2 | ☐ Twilio number provisioned, voice + SMS webhooks pointed at **https://fieldbuiltai.com** (never a railway.app URL) | All webhook URLs and OAuth redirects must use the production domain. |
| 0.3 | ☐ `companies.is_pilot` set intentionally (`true` = billing gate never blocks; new signups default `false`) | F36: AI hard-stops when `plan='cancelled'` unless pilot. Forgetting the flag on a pilot = silent shutdown on cancellation. |
| 0.4 | ☐ `ai_agent_config.timezone` set to the company's real timezone | Server is UTC. Every CT evening the server weekday is already "tomorrow" — schedule math, sequences, quiet hours, and slot generation all run in COMPANY time (audit C3). Wrong timezone = wrong workdays, 3 AM texts, phantom slots. |
| 0.5 | ☐ Cron worker verified ALIVE post-deploy: Railway logs show `[cron] follow-up: 200`, `appointment-reminders: 200`, `hcp-sync: 200` | Audit C4: the HCP sync cron was **never scheduled** — sync was dead for weeks and nothing complained. H40: a CRON_SECRET mismatch used to 401 silently; it now logs `AUTH FAILED` loudly — grep for it. |
| 0.6 | ☐ Exactly ONE active row in `phone_numbers` per company | Two active rows break every `.single()` phone lookup — reminders and confirmation requests silently stop. |
| 0.7 | ☐ `CRON_SECRET`, `ANTHROPIC_API_KEY`, Twilio, Resend, ElevenLabs env vars present on Railway | AI-engine calls only work where the key lives. |

---

## Phase 1 — Company ground truth (the anti-hallucination interview)

Everything the agent says comes from `ai_agent_config.generated_system_prompt` + `knowledge_base`. **Every wrong fact in there WILL be said to a customer with total confidence.** Top Air's prompt shipped with 7 distinct classes of false information. Collect ground truth from the owner and verify each:

| # | Check | The Top Air failure it prevents |
|---|---|---|
| 1.1 | ☐ **Prices** — every price in the prompt AND `knowledge_base.pricing_info` matches reality; search the prompt for EVERY occurrence (a stale price appeared 3× in one prompt) | Agent quoted $399 for a $189 service. |
| 1.2 | ☐ **Service-call fee policy** — exact, including conditionals ("$0 with repair") — this is the ONLY price the agent may quote | Fee policy was flat when it was actually conditional. |
| 1.3 | ☐ **Business days + hours** — verify per-day; don't assume Mon–Sat | Prompt said Mon–Sat; the company works Mon–Fri. |
| 1.4 | ☐ **NO staff names in the prompt** — add the rule "never promise a specific technician by name" | Prompt contained six phantom tech names (Ron, Justin, Jessie…) that don't exist on the roster. |
| 1.5 | ☐ **Services offered = services the roster can actually do** — cross-check against `technicians.job_types`; remove anything no active tech handles | Prompt sold chimney/attic/UV services no tech performs. |
| 1.6 | ☐ **Full service area, ALL metros** — plus an explicit "never tell a lead in <metro B> we don't serve them" line for multi-metro accounts | Prompt was IL-only; Michigan leads were told "we don't service your area." |
| 1.7 | ☐ **No office-phone diversion** — CTA must be "book right here in this conversation" | Prompt told leads to call the office, defeating the product. |
| 1.8 | ☐ **Warranty/credential claims verified true** (check their website/ask the owner) | We verified Rocket's NASA/Lockheed claim before letting the agent repeat it. |
| 1.9 | ☐ **Financing** — explicitly configured or explicitly "no financing"; never left blank | Blank = the model invents financing terms. |
| 1.10 | ☐ **Declined services scripted** — what the agent says when asked for something the company doesn't do (polite decline + close) | Unscripted = the agent improvises or books the unbookable. |
| 1.11 | ☐ **`knowledge_base` (pricing_info, services_offered) consistent with the prompt** — they are injected separately; a mismatch = the agent contradicts itself between messages | KB still said $399 after the prompt was fixed. |
| 1.12 | ☐ **Owner sign-off on the KB** — the client reads what their agent believes and confirms it | KB ground truth cannot be verified from the outside; only the client knows. |

**Consistency rule:** after any prompt/KB edit, grep the WHOLE prompt + KB for the old value. Partial patches are how $399 survived in 2 of 3 places.

---

## Phase 2 — Technicians & routing (per new account AND per roster change)

| # | Check | Why |
|---|---|---|
| 2.1 | ☐ Every active tech has correct `job_types` (empty = does everything; that's usually wrong) | Job-type filters are hard gates: a tech missing `ductwork` is invisible for duct jobs. |
| 2.2 | ☐ **Job-type vocabulary normalized** — the two engines use different vocabularies (`duct_cleaning` ≡ `ductwork`, `ac_installation` ≡ `new_ac_install`); `canonJob()` in `lib/routing.ts` must map every term this account's ads/forms will produce | The Marilyn bug: SMS-engine vocab vs routing vocab mismatch → valid duct leads "not serviced." Unknown strings must NEVER decline (unknown → unrestricted). |
| 2.3 | ☐ Zip restrictions per tech (`zip_codes` / `serves_all_areas`) — for multi-metro accounts verify each metro's tech has the right set, and spot-check 3 real zips per metro through `findSlotsForLead` | Alex K is Michigan-only; IL crew is Chicago-only. A missing zip = "we don't service your area." |
| 2.4 | ☐ Weekly schedules per tech, expressed in company timezone | UTC drift books techs on their day off. |
| 2.5 | ☐ **Inactive vs deleted**: techs who must never be booked (second owner, departed staff) are `status='inactive'` — inactive persists across HCP re-imports; deleting does NOT (the sync resurrects them) | Michael K (owner #2) must never be bookable. |
| 2.6 | ☐ `hcp_employee_id` mapped for every bookable tech (V2 accounts) | Unmapped tech = HCP job created unassigned. |
| 2.7 | ☐ Owner-slot pattern documented if applicable (e.g. "David G = whichever owner is in the country") | Encodes business reality the roster alone can't show. |
| 2.8 | ☐ Company `service_area_zips` set from onboarding (office + radius) or intentionally empty | It's the first gate in slot-finding. |

---

## Phase 3 — Channel integrations

### Facebook / Meta
- ☐ Page connected via **"Edit settings"** in the FB Login dialog, granting the app BOTH the page and the business — `/me/accounts` only shows app-granted pages. Symptom of skipping: **"Cannot parse access token."**
- ☐ Until Meta App Review passes: connect via the runbook (page shared to ScaleZ BM + app-role profile) — `docs/meta-integration-runbook.md`.
- ☐ **Meta's own "Business Agent" AI switched OFF on the client page** — it intercepts messages before our webhook.
- ☐ Page subscription matches intent: `leadgen` only (lead ads, team handles chat) vs `leadgen,messages,messaging_postbacks` (Messenger agent live). Top Air runs leadgen-only by owner decision.
- ☐ Lead form field mapping tested with one real form submission: phone/email/zip extracted, `parseLeadPhone` accepts the format (it strips "ext. 12" suffixes and rejects garbage — a no-phone lead becomes a `needs_attention` placeholder, never a silent drop).
- ☐ Messenger-specific: agent must collect a real mobile before booking (PSID leads carry `msgr:` placeholder phones — excluded from SMS sequences and HCP pushes until a real number is captured).
- ☐ If the account uses a Messenger sales flow (`messenger_instructions`, e.g. Top Air's $189 duct upsell + `[[SILENT]]` close): test the flow AND that SMS/voice on the same account still use the normal flow.

### Housecall Pro (V2)
- ☐ API key valid (MAX/XL plan), `integration_mode` flipped to `housecall_pro`, employees imported.
- ☐ Remember: **no HCP webhooks exist** — freshness is the 15-min reconcile cron only. Office-side cancels take up to 15 min to reach us.
- ☐ Testing against a client's live HCP: **GET-only. Never write without explicit owner go-ahead.** Placeholder-phone leads never push (HCP 400s on non-10-digit mobiles — verified live).

### Voice
- ☐ Inbound call answered by the agent with correct greeting/company name; forwarding from the office number self-verified (`/api/voice/verify-forwarding`).
- ☐ Voice tool job-types are enum-constrained for this account's services (the model cannot invent unroutable strings).

---

## Phase 4 — The seam-bug map (every class found, what guards it, what to re-test)

These are the "invisible until tested" issues. Each entry: **symptom → root cause → the guard now in code → what to verify for a NEW account.**

### A. Understanding the lead's reply
| ID | Symptom | Guard in code | New-account check |
|---|---|---|---|
| A7 | AI says "your appointment is cancelled" for an appointment that isn't the lead's (wrong/hallucinated ID) | Cancel/reschedule executors verify appointment `id + company_id + lead_id + status='scheduled'` before acting; miss → corrective question, never a false claim (`lib/ai-engine.ts`) | Test a cancel request from a lead with NO appointment — expect a clarifying question, not "cancelled." |
| A9 | "ok, actually can we move it to 2pm?" auto-CONFIRMED the old time; "no problem, see you then!" CANCELLED the appointment; "cant make it" (no apostrophe) was ignored | `COUNTER_SIGNALS` veto + whole-message anchored matchers in `/api/webhooks/sms` (64-case matrix in test history) | If the account's clientele texts in another language, extend the matcher matrix (sí/si are covered; add others) and re-run the matrix. |
| — | Opt-out ate confirmation replies: booked lead replying "CANCEL" (as our own SMS instructed) was treated as STOP | Confirmation-reply handling runs BEFORE opt-out; bare `cancel/end/quit` are not opt-out keywords | Send "CANCEL" from a lead with a pending confirmation — appointment cancels, relationship survives. |
| — | STOP must be total and pre-AI | Deterministic opt-out short-circuit on SMS + Messenger before any AI call; enforced across reminders, sequences, ingestion (never revive `ai_paused`) | Send "STOP", then re-POST the same lead via webhook — no revival, no reply. |

### B. Booking, routing, availability
| ID | Symptom | Guard in code | New-account check |
|---|---|---|---|
| B10 | Lead with no zip booked to the wrong metro (Ariel R sent to a Michigan address) | `selectTechnician` hard-fails `no_zip_match` when zip is missing and any candidate is geo-restricted → manual-dispatch flag, owner notified | Book a test lead with no address — expect unassigned + flagged, not a guess. |
| B12 | Same tech double-booked for the same instant (two simultaneous bookings both succeeded) | `techCanTakeBooking` checks ±2h local appointment overlap + live HCP busy intervals | Two test bookings same tech/slot — second must be rejected. |
| — | **Zip extractor took the FIRST 5-digit group**: "29901 Common Rd … Roseville 48066" → zip "29901" → correct tech invalidated → unassigned appointment | All 4 extraction sites (routing, ai-engine, voice-engine ×2) take the LAST 5-digit group | Test with a street number that looks like a zip ("29901 Common Rd"). Two-zip addresses resolve to the LAST (E27, documented). |
| — | Valid duct leads declined — "we don't handle that" (vocabulary mismatch between engines) | `canonJob()` normalization + unknown-never-declines | For every job type this account's ads generate, run one lead through slot-finding. |
| — | Slot offered ≠ tech valid at booking time (job type/address changed mid-conversation) | Booking-time re-validation (`techCanTakeBooking`); slots require a zip BEFORE offering times | Change the address between slot-offer and booking — expect re-pick or manual-dispatch flag. |
| — | Voice agent said "you're booked" without calling the booking tool | Deterministic booking safety net + forced slot lookup on "let me check" | Full voice conversation test through booking; verify the appointment row exists. |

### C. Lifecycle, duplicates, races
| ID | Symptom | Guard in code | New-account check |
|---|---|---|---|
| — | **148 duplicate SMS to one lead** (retry loop only deduped `pending` retries; every failure spawned a new one) | Retry exactly ONCE per lead ever; `PERMANENT_SMS_ERRORS` (30034, 21610, 21211, …) never retry — outreach cancelled + `needs_attention` | After go-live, watch `sms-status` for permanent errors on day 1. |
| C15 | Webhook redelivery (Zapier/Make/Google all retry on slow responses) → second opener | Redelivery guard: lead with ANY outbound → `deduped:true`, no re-open (lead + google webhooks) | Double-POST the intake webhook — exactly 1 opener. |
| C16 | Same person arriving via two channels = two leads, two competing agents | Cross-channel identity merge on phone capture | Submit the same phone via form + Messenger — one lead. |
| C17 | Follow-up step fired mid-live-conversation, contradicting what the agent just said | Cron skips `is_active_conversation` leads (flag auto-clears 2h after last inbound); step stays pending | Covered by live test battery (Phase 5). |
| C18 | Booking push and reconcile cron raced → duplicate HCP jobs | Atomic `pending:<ts>` claim on `hcp_job_id`, released on every exit; reconcile clears stale claims >1h | Proven by 8-way concurrency test; re-test only if the push path changes. |
| C19 | Human took over in the dashboard during AI generation → AI talked over them seconds later | `ai_paused` re-checked immediately before the Messenger send | Pause a lead mid-generation in a test thread. |
| — | Human takeover generally | Meta inbox echoes without our app ID → `ai_paused`; dashboard sends also pause; owner resumes from lead detail | Reply from the page inbox as "the team" — AI must go silent, thread still logged. |
| C8 | Follow-ups kept firing after opt-out (two status vocabularies: `lost` vs `closed_lost`) | Single source of truth `TERMINAL_LEAD_STATUSES` covering both vocabularies | If a new status value is ever added, add it there — nowhere else. |
| — | Deleted lead kept getting texted underneath the UI | `deleted_at` cancels all outreach; re-submission of a deleted lead creates a CLEAN new lead (no resurrected history) | — |
| — | Cold-lead revival on new inquiry | `cold`/`closed_lost` webhook re-submissions revive to `just_came_in` (but never `ai_paused` leads) | — |

### D. Silent limits
| ID | Symptom | Guard | Check |
|---|---|---|---|
| D22 | HCP busy-time read was capped at 300 jobs/window — busy techs overflow the cap and look FREE | Pagination cap now 1,000 | For accounts with >6-8 techs, sanity-check one busy day against HCP's calendar. |
| — | HCP ignores `updated_after` | Reconcile walks recent pages; booking-time busy reads are the real freshness | Know this when debugging "stale" HCP mirrors. |

### E. Identity matching
| ID | Symptom | Guard | Check |
|---|---|---|---|
| E28 | Booking attached to the WRONG HCP customer — spouse or stranger sharing a landline | Match priority: mobile+name > mobile-only > landline+name; landline-only WITHOUT name match = create new customer | If the client's book has lots of shared office/landlord numbers, spot-check the first week's pushes. |
| — | "555-1234 ext. 12" became a garbage phone | `parseLeadPhone`: extension-stripping + E.164 validation; unparseable → 400/`needs_attention`, never a send attempt | Test the account's real form output format once. |
| — | Placeholder phones (`msgr:`, `fbform:`) leaked into SMS sends / HCP pushes | `isPlaceholderPhone` guards on `sendSMS` AND `pushBookingToHcp` (unconditional — email presence doesn't bypass) | — |

### F. Billing & attention
| ID | Symptom | Guard | Check |
|---|---|---|---|
| F36 | What happens when a subscription lapses? (Was: nothing — AI kept running unbilled) | `companyAiBlocked` (`lib/billing-gate.ts`): `plan='cancelled'` hard-stops ALL AI/outreach at 5 entry points — unless `is_pilot`. `past_due` never blocks. Leads still ingest, inbound still recorded. | Set `is_pilot` correctly at onboarding (0.3). |
| F34 | AI cancelled an appointment; the HCP job sat there and a tech drove out | Cancel executor notifies the office to remove the HCP job + stamps the appointment notes | — |
| F32 | `needs_attention` has no automated exit — by design; the AI still replies to inbound | Owner must actually work the needs-attention queue — tell them at onboarding. | Dashboard queue reviewed in week-1 check-ins. |
| — | Leadgen submissions without a phone vanished | No-phone leads become `needs_attention` placeholders with the typed value kept in notes | — |

### G. Compliance & timing
| ID | Symptom | Guard | Check |
|---|---|---|---|
| G37 | 2h reminder for an 8 AM job fired at 6 AM | Quiet-hour gates (8 AM–9 PM company-local) on reminder SMS + confirmation requests; deferred sends fire on the first in-window cron pass, flag stays unset | Timezone correctness (0.4) is what makes this work. |
| — | Follow-ups at 3 AM | Cron-level quiet hours: SMS 8–21 local, voice within company working hours | — |
| — | No-response call scheduled for late evening | Post-7 PM callbacks move to 9 AM day-of-appointment | — |

### H. Observability & configuration
| ID | Symptom | Guard | Check |
|---|---|---|---|
| H40 | Cron auth broken = every automation silently dead | Loud `AUTH FAILED (401)` log lines in the worker | Check Railway logs on every deploy (0.5). |
| H39 | 33 swallowed `catch {}` sites hide real failures | Accepted debt — when something "silently doesn't happen," suspect a swallowed catch and add logging at that site | — |
| — | Meta wedged webhook delivery to the original callback path | `/facebook2` alias exists; if FB events stop arriving with no errors, try re-pointing the subscription | — |

---

## Phase 5 — Pre-go-live test battery (run for EVERY new account/agent)

**Test conventions (non-negotiable):**
- Test leads only: `metadata: {"is_test": true}`, placeholder (`msgr:test-*`) or fictional (`+1800555xxxx`) phones. **Never message a real lead.**
- Client HCP: **GET-only** without explicit owner approval; placeholder-phone leads structurally can't push.
- Delete every test row when done (leads + conversations + sequences + appointments).
- AI-engine calls need `ANTHROPIC_API_KEY` → run via `railway run` or against production endpoints.

**The battery** (each maps to a Phase 4 class):

1. ☐ **Opener** — POST a test lead to the intake webhook → opener within 60s, correct agent name, correct company facts, ends with a question.
2. ☐ **Redelivery** — POST the identical payload again → `deduped:true`, still exactly 1 opener. (C15)
3. ☐ **Truth under pressure** — as the test lead, ask: price ("how much exactly?"), warranty, "who will come to my house?" (must not name a tech), a service they don't offer (polite decline), financing, "can I just call the office?" (agent keeps booking in-thread). Every answer checked against Phase 1 ground truth. Push until it breaks or holds.
4. ☐ **Slot integrity** — ask for times BEFORE giving an address → agent must ask for the address, never invent times. Then give an address in each metro → offered slots match the right tech's real availability (cross-check HCP busy times).
5. ☐ **Zip traps** — an address whose street number looks like a zip ("29901 Common Rd, Roseville MI 48066") → routes to the RIGHT metro. A no-zip booking → unassigned + flagged, not guessed. (B10, zip extractor)
6. ☐ **Full booking** — complete a booking; verify: appointment row, correct tech, correct time in company tz, confirmation SMS content correct, confirmation email delivered (check spam placement once per new domain), HCP job created with right employee/notes (only with owner-approved live write, else placeholder-phone dry run).
7. ☐ **Double-booking** — attempt a second booking on the same tech/slot → rejected. (B12)
8. ☐ **Confirmation replies** — from a booked test lead send: "yes" (confirms), "ok, actually can we move it to 2pm?" (goes to AI, NOT confirmed), "no problem, see you then!" (NOT cancelled), "cant make it" (reschedule flow), "CANCEL" (cancels appointment, does NOT opt out). (A9 + opt-out order)
9. ☐ **Cancel scoping** — from a lead with no appointment, demand a cancellation → corrective question, no false "cancelled." (A7)
10. ☐ **Opt-out** — "STOP" → total silence; re-POST the lead via webhook → not revived.
11. ☐ **Human takeover** — reply from the dashboard (and Meta inbox if Messenger is live) mid-thread → AI goes quiet, badge shows, Resume works. (C19/takeover)
12. ☐ **Mid-conversation follow-up** — test lead with a due sequence step + active conversation → step skipped while talking. (C17)
13. ☐ **Voice** — call the number: agent answers with context, quotes only true facts, books with a real slot; hang-up mid-flow doesn't corrupt the lead; post-call summary lands on the lead.
14. ☐ **Cross-channel** — same phone via form + chat → one lead, one agent. (C16)
15. ☐ **Cleanup** — delete all test rows; verify dashboards show zero test residue.

**Known real-world untestables — verify in week 1 with real traffic instead:** actual SMS deliverability (A2P-dependent), real-caller STT quality, email spam-folder rates across providers, Messenger 24h-window behavior.

---

## Phase 6 — Go-live + first week

- ☐ Flip the channel switches deliberately (e.g. leadgen first, Messenger agent later — Top Air pattern).
- ☐ Day 1: watch `sms-status` for permanent errors (30034 = A2P problem; 21211 = form producing garbage phones).
- ☐ Day 1: confirm the three cron log lines cycle in Railway logs.
- ☐ Days 1–7: review EVERY AI conversation transcript daily — this is where the next Marilyn-class seam shows itself. Anything the agent said that isn't literally true goes back into Phase 1 as a prompt/KB fix, then re-run battery item 3.
- ☐ Week 1: check the `needs_attention` queue is being worked by the owner (F32 — it has no automated exit).
- ☐ Week 1: spot-check HCP customer attachments if the client's book has shared landlines (E28).
- ☐ Confirm revenue attribution appearing (`hcp_revenue_events`, "Booked by AI" vs "Sourced by AI").

---

## Appendix — by-design behaviors (don't "fix" these)

- `needs_attention` never auto-clears; the AI still replies to inbound on flagged leads (F32).
- Two-zip addresses resolve to the LAST 5-digit group (E27) — street-number-first is the common case.
- `past_due` does not stop the AI — only `cancelled` does, and pilots never stop (F36).
- Reconcile is the only HCP sync path (no webhooks exist on their public API).
- Placeholder-phone leads intentionally skip SMS sequences and HCP pushes until a real phone is captured.
- Deleting a lead gives that person a clean slate on re-contact; it does not resurrect history.
- Inactive technicians survive HCP re-imports on purpose; deleted ones come back — use `inactive`.
