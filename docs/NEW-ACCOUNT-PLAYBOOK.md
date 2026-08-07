# FieldBuilt AI — New Account & New Agent Playbook

**Purpose:** this is the map for launching every new account and every new chat/voice agent RIGHT the first time — one pass, no back-and-forth revisions. It is built from the complete July–August 2026 test campaign: two audit rounds, the adversarial seam-testing round, the exhaustive live-issue test pass, the SMS/Messenger agent batteries, the live Housecall Pro write proof, and every production incident (London Cook, Marilyn, Nina, the zip extractor, the A2P block). Every checklist item below exists because skipping it already burned us once.

**How to use:**
1. Setting up a new account → run Phases 0–5 top to bottom, checking every box.
2. Creating/changing an agent for an existing account → run Phase 2 + Phase 5.
3. Debugging a weird production behavior → jump to Phase 4 (the seam-bug map) and find the matching class.
4. Never mark an account live until Phase 5's test battery passes and Phase 6's go-live checks are done.

**The one law learned from all of this:** *two subsystems that are each correct in isolation will disagree at their seam, and the failure surfaces as a confident false statement to a customer.* ("I'm sorry Marilyn, it looks like we don't actually service the 60619 zip code.") The only defense is testing the seams with real-shaped data before a real lead hits them.

**Its corollary, learned the expensive way:** *a conversation that looks perfect can still be failing silently downstream.* Both Messenger bookings that prompted class J and class K read beautifully end to end — and produced customers named "Unknown" in the client's CRM with no confirmation sent to anyone. **Never judge a channel by its transcript. Follow one booking all the way through to the CRM record, the confirmation, and the owner's notification.**

---

## Phase 0 — Infrastructure (before anything else)

| # | Check | Why (what broke before) |
|---|---|---|
| 0.1 | ☐ **A2P 10DLC registered** — Brand + Campaign approved in Twilio Console, number attached to the Messaging Service | THE hard blocker. An unregistered account = every SMS silently carrier-blocked with error 30034 while the dashboard looks fine. We ran for weeks with ZERO deliverable SMS. GHL accounts "just work" because LeadConnector registers under its ISV umbrella — a raw Twilio account does NOT. |
| 0.1a | ☐ **Verify A2P by delivery statistics, never by a single thread.** Query Twilio for the number's last-7-day status breakdown and require ~0 messages with error 30034. | **The most dangerous trap in this document.** A2P is enforced per receiving carrier: T-Mobile hard-blocks, others don't. Top Air had a perfectly healthy-looking 4-message conversation with a real lead while the same week's totals were **187 sent → 9 delivered → 174 blocked (30034)**. One delivered thread, or even a lead replying, is NOT proof the channel works. Only the failure-code breakdown is. |
| 0.2 | ☐ Twilio number provisioned, voice + SMS webhooks pointed at **https://fieldbuiltai.com** (never a railway.app URL) | All webhook URLs and OAuth redirects must use the production domain. |
| 0.3 | ☐ `companies.is_pilot` set intentionally (`true` = billing gate never blocks; new signups default `false`) | F36: AI hard-stops when `plan='cancelled'` unless pilot. Forgetting the flag on a pilot = silent shutdown on cancellation. |
| 0.4 | ☐ `ai_agent_config.timezone` set to the company's real timezone | Server is UTC. Every CT evening the server weekday is already "tomorrow" — schedule math, sequences, quiet hours, and slot generation all run in COMPANY time (audit C3). Wrong timezone = wrong workdays, 3 AM texts, phantom slots. |
| 0.5 | ☐ Cron worker verified ALIVE post-deploy: Railway logs show `[cron] follow-up: 200`, `appointment-reminders: 200`, `hcp-sync: 200` | Audit C4: the HCP sync cron was **never scheduled** — sync was dead for weeks and nothing complained. H40: a CRON_SECRET mismatch used to 401 silently; it now logs `AUTH FAILED` loudly — grep for it. |
| 0.6 | ☐ Exactly ONE active row in `phone_numbers` per company | Two active rows break every `.single()` phone lookup — reminders and confirmation requests silently stop. |
| 0.7 | ☐ `CRON_SECRET`, `ANTHROPIC_API_KEY`, Twilio, Resend, ElevenLabs env vars present on Railway | AI-engine calls only work where the key lives. |
| 0.8 | ☐ **Email sender identity decided** — either connect the client's Gmail (Email & SMS page) or confirm `RESEND_FROM_EMAIL` is set to a verified branded domain | With neither, every confirmation goes out from **`onboarding@resend.dev`** — the Resend sandbox default. It looks like spam, reads as fake to the homeowner, and is a deliverability problem. Top Air ran this way unnoticed because the page was gated out of their product mode. |

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
| 1.13 | ☐ **Property types enumerated and priced** — single-family, townhome, condo, apartment, mobile home: which are served, and the price for each | The **Nina failure**: a condo unit was told "we only serve single-family residential homes." Condos were a real $249 product the whole time. |
| 1.14 | ☐ **Every decline rule tested at its BOUNDARY** — list the rule's literal trigger words and ask: what legitimate customer also says these words? | Nina's decline rule triggered on "multi-unit" and "property management" — written to reject commercial buildings, it also rejected a condo unit and an authorized property manager. A decline rule is the most dangerous sentence in a prompt: it fires rarely and always ends a conversation. |
| 1.15 | ☐ **Authorization sources listed** — owner, property manager, authorized rep, landlord-approved renter | "Renters may not have authority" cascaded into refusing an authorized manager. Authorization ≠ ownership. |
| 1.16 | ☐ **Standalone price for every service that can be sold alone**, not just the bundles | Dryer vent cleaning is bundled into both duct packages but has no standalone price — the agent has to redirect to an estimate instead of quoting and booking it. Silent revenue leak. |
| 1.16a | ☐ **Price book configured** (`ai_agent_config.pricing_rules`) when the company sells FIXED-price work — property type × unit price, as data not code. Leave NULL for estimate-style businesses | Without it the "Potential revenue booked by AI" card cannot value a booking, HCP jobs land at $0, and revenue only appears after the office invoices. |
| 1.17 | ☐ **Entry-hook prices vs the booking floor** — if ads run a low hook price, state explicitly which prices are quotable-but-never-bookable and what the hard minimum is | Top Air's $89/$99 ad prices are hooks; the floor is $189. Without an explicit floor the agent negotiates down under pressure. |
| 1.18 | ☐ **Channel scoping deliberate** — any flow that should apply everywhere lives in the BASE prompt, not in `messenger_instructions` | The Nina root cause: the condo/duct playbook existed only in the Messenger block, so the SMS agent — which handles most Facebook duct leads — had never seen it. Channel-scoped instructions create two agents with different knowledge. |
| 1.19 | ☐ **Multi-metro service scope** — if a metro can only do a subset of services (no tech for the rest), the prompt must say so per metro | Top Air's prompt advertises the full HVAC menu and says it serves metro Detroit — but only ductwork has a Michigan tech. A Detroit furnace lead gets encouraged, then dead-ends at booking. |
| 1.19a | ☐ **Multi-timezone service area?** If any metro sits in a different timezone than the office, verify customer-facing times render in the SERVICE-ADDRESS timezone (zip→tz via `lib/timezones.ts`) — slot labels, confirmations, reminders, quiet hours | The **Tasha failure**: a Michigan customer was told "10am–1pm" (Chicago time) for what is physically 11am–2pm at her door; HCP's own notification contradicted us, and the agent then confidently "corrected" her with the wrong time. |
| 1.19b | ☐ **Writing style checked on real replies** — no dash punctuation, no asterisks, time ranges as "8 to 11am", relaxed everyday tone, at most one exclamation in a conversation | A dash joining two clauses is the clearest tell that a message was machine-written. The prompt forbids it and the model still slipped one into ~half of repeated test runs, so `sanitizeAgentText` enforces it deterministically before every send (phone numbers and hyphenated words are protected). |
| 1.20 | ☐ **Name capture confirmed working** — run one test conversation per live channel and check `leads.first_name` is populated, not just mentioned in notes | Two live Messenger bookings reached the client's CRM as customer **"Unknown"** — the technician's schedule showed "Unknown" for a real job. See class J. |

**Consistency rule:** after any prompt/KB edit, grep the WHOLE prompt + KB for the old value. Partial patches are how $399 survived in 2 of 3 places.

### 1.A — Know which knowledge-base fields actually reach a conversation

Only **six** KB fields are injected at runtime by the SMS/Messenger and voice engines:

`business_description` · `services_offered` · `service_areas` · `custom_ai_knowledge` · `financing_options` · `pricing_info`

Every other field (`unique_selling_points`, `team_info`, `testimonials`, `certifications`, `years_in_business`, `custom_facts`…) is read **only when a system prompt is generated**. This split matters twice:

- **Auditing live behavior?** Only those six fields can be causing it. A wrong fact elsewhere is dormant.
- **⚠️ Regenerating a prompt is destructive.** The generator rebuilds from the KB, so it will (a) discard every hand-patch made to the prompt since onboarding, and (b) re-inject whatever stale content still sits in the non-runtime fields. Top Air's `unique_selling_points` held a `$399/system` line for weeks after $399 was purged from the prompt — one click of "regenerate" would have brought it back. `testimonials` still names technicians, which is exactly how phantom tech names entered the prompt originally.

**Rule: before ever regenerating a prompt, clean the non-runtime KB fields first, and expect to re-apply every manual prompt fix afterward. For a mature account, edit the prompt directly instead.**

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
| 2.9 | ☐ **Advertised services ⊆ bookable job types** — take the service list from the prompt AND `services_offered`, map each through `canonJob()`, confirm an active tech covers it. Anything with no tech comes out of the prompt or gets a scripted decline | Top Air's prompt advertises **Thermostat Installation** and no technician has `thermostat` — the agent can promise it, then the booking dead-ends as `job_not_offered`. |
| 2.10 | ☐ **Per-metro capability matrix** for multi-metro accounts — which job types are bookable in which metro | Only one Top Air tech does non-duct HVAC and he is Illinois-only, so metro Detroit is duct-only. Nothing in the prompt says that (see 1.19). |

---

## Phase 3 — Channel integrations

### Facebook / Meta
- ☐ Page connected via **"Edit settings"** in the FB Login dialog, granting the app BOTH the page and the business — `/me/accounts` only shows app-granted pages. Symptom of skipping: **"Cannot parse access token."**
- ☐ Until Meta App Review passes: connect via the runbook (page shared to ScaleZ BM + app-role profile) — `docs/meta-integration-runbook.md`.
- ☐ **Meta's own "Business Agent" AI switched OFF on the client page** — it intercepts messages before our webhook.
- ☐ Page subscription matches intent: `leadgen` only (lead ads, team handles chat) vs `leadgen,messages,messaging_postbacks` (Messenger agent live). Verify by READING the subscription back from Graph after any change — don't trust the POST's `{"success":true}` alone.
- ☐ Turning the Messenger agent on/off is two steps, not one: the page subscription **and** the `ai_paused` flag on existing Messenger leads. When re-enabling, unpause only non-terminal leads — leads closed as `lost`/`closed_lost` stay paused forever.
- ☐ **A "stopped" Messenger agent can still SPEAK.** The questionnaire opener rides the `leadgen` webhook, and sending needs no `messages` subscription — so with the channel "off," new form leads still get one AI opener and then face total silence (their replies only reach the CRM through the read-only 15-min sweep). Live: 3 hot leads waited 13–16h unanswered after saying yes. A real stop must either keep `leadgen` off the Messenger-opener path too, or accept that every new questionnaire lead needs a human within the 24h window. When stopping, decide which — never leave the mouth on with the ears off.
- ☐ **The subscription MUST include `message_echoes`** — human-takeover detection is built on echo events, and without that field every office reply from the Meta inbox is invisible to the system. The Nicole incident: a rep declined a lead ("we do not service your area"), the echo never arrived, and 40 minutes later the AI restarted intake in the same thread. Verify by READING the fields back, and re-check after every reconnect/re-subscribe — this field was silently dropped once already.
- ☐ **First contact with an unknown PSID imports the thread's prior history** (Conversations API, standard page token) before the AI speaks — pre-connect threads are otherwise invisible and the AI restarts intake from zero. If that history shows recent page-side activity (rep or inbox automation), the lead is created **AI-paused + needs_attention** — the thread belongs to the office until they Resume AI.
- ☐ **Turn Meta's own inbox automations OFF** if the AI should own new conversations. Two bots on one thread actively corrupts data: observed live, Meta's flow asked "single furnace or multiple units?" while our agent asked "house, townhome, or condo?" — the customer's "Single" landed on the wrong question. The automation also collects name/zip/email/phone/duct-history into a place our system can't act on, so the agent re-asks what she already answered ("I already said last year").
- ☐ Automation messages do NOT count as human takeover (`isAutomationMessage`), and neither do our own past AI sends — only a real person's reply holds the AI back. Live human takeover rides on `message_echoes`. If a client's automation uses unusual wording, add its signatures to the pattern list or the agent will be silenced on every new thread.
- ☐ **Messenger lead forms answer ON MESSENGER, never by SMS.** A click-to-Messenger lead ad runs its questions inside a Messenger thread and the leadgen payload carries that thread's PSID in the form field `inbox_url` (`…/latest/<PSID>?nav_ref=thread_view_by_psid`). On form completion the system extracts it, merges the Messenger and form rows into ONE lead, imports the thread, and sends the AI opener **into that same thread** — with the questionnaire answers used, not re-asked. SMS remains the path only for forms with no PSID. **Verify at setup:** submit one test form and confirm the lead has `messenger_psid` set, `channel='messenger'`, and exactly one lead row. Before this, Top Air's questionnaire leads got a cold SMS on a brand-new thread — 23 leads in 3 days, 0 delivered (all A2P-blocked), while the customer sat in Messenger waiting.
- ☐ The Messenger opener is framed as a FIRST TOUCH via an explicit angle. Without it the engine reads the imported questionnaire as an in-progress chat and sends a nudge ("still thinking it over?") instead of a real opening message.
- ☐ **First contact mines the thread for facts already given** — phone/email/zip and every question-answer pair — because the message that CREATES a lead used to be the one message never scanned (a lead whose first words were her phone number had it dropped).
- ☐ Lead form field mapping tested with one real form submission: phone/email/zip extracted, `parseLeadPhone` accepts the format (it strips "ext. 12" suffixes and rejects garbage — a no-phone lead becomes a `needs_attention` placeholder, never a silent drop).
- ☐ Messenger-specific: agent must collect a real mobile before booking (PSID leads carry `msgr:` placeholder phones — excluded from SMS sequences and HCP pushes until a real number is captured).
- ☐ If the account uses a Messenger sales flow (`messenger_instructions`, e.g. Top Air's $189 duct upsell + `[[SILENT]]` close): test the flow AND that SMS/voice on the same account still use the normal flow.
- ☐ **Know exactly which fields each form/questionnaire ACTUALLY captures — never assume "the form gets the address."** Messenger questionnaires commonly capture a ZIP only (live: Gina — "60706" became her entire address and the whole booking chain carried it). A zip stored as the address is expected intake; the STREET is the agent's job, and the booking gate enforces it. Leadgen forms with real street fields DO map automatically (`ADDRESS_KEYS` in the webhook) — verify with one test submission per form.

### Housecall Pro (V2)
- ☐ API key valid (MAX/XL plan), `integration_mode` flipped to `housecall_pro`, employees imported.
- ☐ Remember: **no HCP webhooks exist** — freshness is the 15-min reconcile cron only. Office-side cancels take up to 15 min to reach us.
- ☐ Testing against a client's live HCP: **GET-only. Never write without explicit owner go-ahead.** Placeholder-phone leads never push (HCP 400s on non-10-digit mobiles — verified live).
- ☐ **⚠️ HCP jobs cannot be deleted or cancelled through the API — it is create-and-read only.** Every cancel/update endpoint shape returns 404 (verified live, Aug 2026). Consequences: (a) an owner-approved live write test leaves a job that must be removed **by hand** in the HCP UI, so name the test customer something obvious like "test" and tell the owner immediately; (b) this is *why* the AI-cancels-a-synced-appointment flow notifies the office instead of cleaning up — the manual step is the ceiling of what HCP allows, not a shortcut.
- ☐ Live write proof (once, with owner approval) verifies the whole chain at once: customer created, schedule + arrival window, **tech assignment via `hcp_employee_id`**, tags (`FieldBuilt AI` + job type), lead source, and the conversation summary in job notes.

### Voice
- ☐ Inbound call answered by the agent with correct greeting/company name; forwarding from the office number self-verified (`/api/voice/verify-forwarding`).
- ☐ Voice tool job-types are enum-constrained for this account's services (the model cannot invent unroutable strings).
- ☐ **Booking chain proof** (per account, sandbox or approved test): one voice booking → exactly ONE appointment row, technician attached at INSERT (inherited from the slot map, never a post-hoc race), and in V2 the HCP job shows that tech at CREATION — not after a sync cycle (class M-2).
- ☐ **Acknowledgement immunity**: after the booking turn, feed "okay" / "thanks" / "bye" — appointment count stays 1. The prompt's booked-state block replaces the "book IMMEDIATELY" slots block, the handler suppresses repeats, and the DB index is the floor (M-1). Ten duplicate HCP jobs came out of one call before this existed.
- ☐ **Zip-only address on a call flags, never blocks**: the confirmation is already being spoken when tools run, so a missing street address becomes `needs_attention` + a note + an owner ping instead of a mid-call refusal (N-1). The office collects the street before dispatch.
- ☐ **Post-call extraction writes verified**: names/emails fill blanks only; a corrected address or furnace count heard on the call goes through the shared writer — lead + appointment + HCP manual-fix flag (N-3).
- ☐ **Price capture**: an agreed total reaches `quoted_total` (voice rule 18); a mid-call correction ("two furnaces… actually one") must produce the corrected amount, never the multiplied stale one (M-4).
- **Know the architecture before "improving" it:** the voice session transcript stores SPOKEN WORDS ONLY — the model has no memory of its own past tool calls. Every repeat-action guard exists because of that amnesia (the class-M law). Reschedules of HCP-pushed jobs are two-step by design (their API cannot move a job): local move + note + owner ping, and the reconcile pass deliberately does not revert while the office catches up (M-5).

---

## The deterministic guarantee ledger — what the system promises on EVERY account (updated Aug 6, 2026)

The compact list of hard guarantees now built into the shared engines. Prompts reduce how often these fire; only the code layer is the promise. If a future change would weaken a line here, that change is wrong until proven otherwise.

**Booking integrity**
- ONE active AI appointment per lead — prompt state + engine guards + DB partial unique index. A repeat booking at the same slot/window is a no-op; a different time only MOVES the appointment when the customer's own message expresses a time or a change — "thanks!" can never relocate a visit (M-1, M-6).
- A site visit is never booked on a zip alone: SMS/Messenger hold the booking and ask for the street; voice books-and-flags (N-1). Sales/video and `requires_travel=false` accounts exempt.
- Slots come only from anchored days (tech already has a real job), searched ≥21 days out, with the ≥7-day open-day fallback; 4 overlapping arrival windows, one job per window per tech, max 4/day; `min_booking_lead_days` enforced at slot time AND booking time.
- The technician chosen at slot time rides into the booking row and the HCP push on every channel; voice bookings are policy-audited after insert (coverage / capacity / anchor / lead time) — violations flag loudly, never block a live call (M-2, M-3).

**Data integrity**
- LAST CONFIRMED VALUE WINS, everywhere: address / unit count / property type corrections save via `update_lead_details` (or the post-call extractor), update the scheduled appointment, and flag HCP-pushed jobs for the manual fix their API forces (N-2, N-3).
- A street-address inbound auto-attaches to a street-less booking even if the model forgets the tool (the Gina backstop).
- One shared zip extractor (last 5-digit group; a lone leading house number yields NO zip, never a wrong one) feeds routing, timezones, dispatch, and the HCP address writer (class B).
- **ZIP and street address are SEPARATE lead fields** (`leads.zip` / `leads.address`, Aug 7 2026): a questionnaire zip lands in `zip`, never as the "address"; `address` holds a real street or nothing. The lead file shows the model both lines distinctly, the profile UI renders them under different icons, the booking zip falls back `address → lead.zip`, and confirmation timezones use the zip when no street exists yet. A bare zip stored as an address is now a data bug, not intake.
- Quoted price ladder: agent-stated → stored corrections → price book → transcript extraction with corrections-win — the system never invents a price (N-4).

**Message integrity**
- Every written outbound passes `sanitizeAgentText`; the reasoning-leak guard has an instant-block tier ("lead file", tool names) that fires at any message length (N-6).
- Confirmations send once per REAL change (created/moved, never noop), idempotent per channel; every move-path resets the flags so a new time still confirms fresh (N-5).
- Customer-facing times always render in the service-address timezone.

**Sync integrity**
- One HCP push per appointment (atomic claim + retry cron); the reconcile pass mirrors office edits back but never reverts a pending phone reschedule (M-5); office-created HCP jobs import with comms owned by the office.

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
| — | **Zip extractor took the FIRST 5-digit group**: "29901 Common Rd … Roseville 48066" → zip "29901" → correct tech invalidated → unassigned appointment. Reappeared Aug 2026 in the LAST holdout — the HCP address writer (`parseAddress`) — which pushed a customer address with **zip = her house number** ("13496 Melanie Dr … 48313" → zip 13496, a Utica NY zip, live: Wafaa) | ALL extraction sites now share `zipFromAddress` (last 5-digit group); a lone leading 5-digit number followed by a street name yields **no zip, never a wrong zip** (a bare "48234" zip-only address still counts) | Test with a street number that looks like a zip ("29901 Common Rd") AND a 5-digit house number ("13496 Melanie Dr"). When adding ANY new code that parses an address, use `zipFromAddress` — never write a fresh regex. |
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

### I. The prompt contradicting itself (the Nina class — added Aug 2026)

This class has no code guard, and that is the point: **the prompt is a program the model executes, and two clauses that disagree are a bug the model resolves at runtime — almost always toward the restrictive branch, stated as confident fact.** These are found only by reading the prompt adversarially and by boundary-testing declines.

| ID | Symptom | Root cause | New-account check |
|---|---|---|---|
| I-1 | Agent told an authorized property manager of a condo unit: *"We only serve single-family residential homes"* — a sentence that appears **nowhere** in the prompt, refusing a real $249 product | A decline rule ("commercial, multi-unit, property management → disengage") and a pricing line ("$249 condo") contradicted each other. The model picked the restrictive one and **over-generalized it into a new, harsher rule.** | Boundary-test every decline rule (1.14). Ask the agent, as a lead, for each edge case the rule's trigger words could catch. |
| I-2 | The Messenger agent knew the condo/duct playbook; the SMS agent — handling most Facebook duct leads — did not | Playbook lived in `messenger_instructions`, injected only when `channel = messenger` | Channel scoping must be deliberate (1.18). Run the SAME scenario on every live channel and diff the answers. |
| I-3 | Agent negotiated toward a below-floor price under pressure (discounts, competitor match, sympathy) | Prompt said "never book the $89" but never stated a numeric floor, so anything ≥ $90 looked arguable | If ads run hook prices, state the hard floor explicitly and name the dodges (discount, price match, "ask your manager", cash). Then attack it (Phase 5 item 17). |
| I-4 | A purged price survived in a KB field nobody was checking | `unique_selling_points` isn't runtime-injected, so a grep of "what the agent says" missed it — but it WOULD return via prompt regeneration | Grep every KB field, not just the runtime six (1.A). |

### J. Data captured in conversation that never reaches a system (added Aug 2026)

The agent can say something back to the customer and still not have *saved* it. Anything the agent only "knows" inside the conversation is lost to the CRM, the confirmation, the technician, and the client's CRM. **If a fact matters downstream, there must be a tool field for it AND a deterministic backstop — a prompt instruction alone is not a guarantee.**

| ID | Symptom | Root cause | Guard now in place |
|---|---|---|---|
| J-1 | Two booked customers appeared in the client's Housecall Pro as **"Unknown"**; techs saw "Unknown" on their schedule | `update_lead_details` had fields for job/system/notes but **none for name or email** — the agent had no way to save a name, so it wrote "Customer name: Mourad" into notes. `resolveOrCreateCustomer` then does `first_name ?? "Unknown"` | Name/email fields added to the tool (SMS + voice extractor), with sanitising that rejects "unknown"/"n/a"/junk |
| J-2 | Agent greeted a customer by name in its reply and still never saved it (seen on a Spanish thread) | Prompt instructions are probabilistic — the model complies most turns, not every turn | **Deterministic backstop** `ensureLeadName()`: at booking, and again before an HCP customer is created, the transcript is re-read by one cheap Haiku call if the name is still blank. Ignores agent/company/street names; saves nothing when no name was given |
| J-3 | Only first names were ever collected | The agent asked "What's your name?" and accepted whatever came back | Instructed to ask for the surname **once** at booking, then move on. Never nag, never invent |
| J-4 | Messenger leads were nameless even before the conversation started | The Meta profile lookup 400s without Advanced Access and the failure was swallowed by a bare `catch` (class H39) | Now logs loudly; in-conversation capture is the primary path, profile lookup only a bonus |
| J-5 | Owner had no way to fix a wrong/missing name | No edit UI existed on the lead page, and in HCP mode most CRM surfaces are gated off | **Edit details** dialog on the lead page in both modes → validates phone, blocks duplicates, and pushes the corrected name to the linked HCP customer |

### L. Stale context when the AI intervenes in someone else's conversation (added Aug 2026)

The history import runs **once, at lead creation**. It is a snapshot, not a sync. Anything that happens in the thread while we are not receiving — Meta's automation owning it, or a rep working it for two days while the AI is paused — never reaches the agent. Measured live: one lead was missing **20 of 45 messages**, and four of nine leads had **no name, phone or email at all**.

Why it matters: the agent doesn't know it's missing anything. It answers confidently from a partial thread and contradicts what the rep already told the customer — the Marilyn failure mode, arriving through a different door.

| ID | Symptom | Guard now in place | New-account check |
|---|---|---|---|
| L-1 | AI resumes after a human takeover with a stale picture and re-asks / contradicts | `syncMessengerHistory` runs when the AI is un-paused, and again before the AI's FIRST message in any thread | Pause a lead, reply as a rep from the Meta inbox, resume the AI — it must respect what the rep established |
| L-2 | Leads created before the import existed keep permanent holes | The same sync heals gaps on contact — additive only, never edits or deletes | Spot-check one old lead: our message count should match Meta's |
| L-3 | Identity fields blank even though the thread contains them | `backfillLeadFromThread` fills ONLY blanks (phone/email/zip) — never overwrites office-entered data | After a sync, the lead should have a real phone instead of `msgr:` |
| L-4 | A repeated short message ("Yes", "Ok") made one stored row satisfy every copy, leaving holes no future sync could heal | Matching **consumes** the local row it matched | Covered by the sync battery — re-run if the matcher is ever touched |

**Rule: any code that lets the AI speak into a thread it did not start must re-sync that thread first.** Cheap (one API call, once per thread), and it is the difference between the agent sounding informed and sounding like it wasn't listening.

### K. Channel drift — a capability wired on one channel only (added Aug 2026)

| ID | Symptom | Root cause | New-account check |
|---|---|---|---|
| K-1 | Two Messenger bookings sent **no confirmation SMS, no confirmation email, and no owner notification** — they landed completely silently | The post-booking block (`sendConfirmations` + `notifyAppointmentBooked`) existed in the SMS webhook and the voice route but was never added to the Facebook webhook | Now wired in all three. **Whenever you add a channel or a post-action side effect, diff the channel handlers against each other** — that is the whole lesson of this class (see also I-2, where the playbook itself was channel-scoped) |
| K-2 | HCP-mode accounts could not configure who their emails come from | `/email` was in the CRM-only gate list, but we send confirmations in BOTH modes | `/email` ungated + added to the agent-mode nav. Check 0.8 |
| K-3 | Messenger leads who replied but never booked got NO nurture sequence — `replied_not_booked` was seeded only by the SMS and GHL webhooks (found via Brittany) | ONE shared `reseedRepliedNotBooked()` in lib/sequences, called by every channel webhook; the follow-up cron sends Messenger leads their steps ON Messenger inside Meta's 24h window, falls back to SMS with a real phone, and cancels cleanly when neither is possible | Reply-without-booking on each live channel → 4 pending nurture steps must exist. |
| K-4 | A lead the AI worked who then booked BY PHONE with the office never linked to their HCP job (no `hcp_customer_id`) — stuck "active" forever, nurture kept running, zero "Sourced by AI" attribution | Reconcile phone-fallback: an unmatched job's customer is matched by mobile to exactly ONE lead (ambiguity = no link, E28) and adopted; the import then sets `appointment_booked` and cancels ALL pending follow-ups | Book a test lead's number office-side in HCP → next reconcile links it, status flips, sequences die. |

### M. The model repeating a mutating action it cannot remember performing (the Wafaa class — added Aug 2026)

One voice call produced **ten identical appointments and ten Housecall Pro jobs in four minutes**. After the first booking, every acknowledgement from the caller — "Okay", "Yes", "Thank you", literally "Bye" — created another one. Three properties lined up: the voice session transcript stores only spoken words (the model never sees its own past tool calls), the prompt kept demanding "call book_appointment IMMEDIATELY when they accept" even after booking, and the tool handler inserted unconditionally. Each row then pushed its own HCP job, sent its own confirmation SMS, and pinged the owner.

**The law of this class: an instruction to act immediately, given to a model with no memory of having acted, is an instruction to act EVERY time.** Any mutating tool a model can call repeatedly needs (1) state injected back into the prompt saying the action is DONE, and (2) a code-level idempotency guard that makes the repeat harmless anyway — the prompt reduces how often the guard fires; only the guard is a guarantee.

| ID | Symptom | Guard now in place | New-account check |
|---|---|---|---|
| M-1 | One booking per conversational turn after the first (10 duplicate HCP jobs, 10 confirmation texts, 10 owner pings) | Triple layer: booked-state block REPLACES the "book immediately" slots block in the prompt; the handler suppresses same-slot repeats and converts different-time repeats into a reschedule of the SAME row (ported from the SMS engine); DB partial unique index `one_active_ai_appointment_per_lead` makes duplicates impossible even for future code | Battery: replay a booking then 9 acknowledgement turns → exactly 1 row. Run 5 bookings CONCURRENTLY → still 1 row. |
| M-2 | Every voice job reached HCP **unassigned** → HCP stamped a wrong (inactive-in-our-dispatch) tech → our reconcile mirrored the wrong tech back over our own data | Slot→tech map persisted at slot time (same as SMS); booking INSERTS with the technician; when no map hit, selectTechnician → policy audit → HCP push run in ONE ORDERED chain, never in parallel | Book via voice on a fresh account and check the HCP job shows the right tech at CREATION, not after a sync cycle. |
| M-3 | Booking accepted for a time/zip the slot engine never offered, silently | Post-insert policy audit (`techCanTakeBooking` with self-exclusion): coverage, capacity, anchor, lead-time — flags `needs_attention` + notes + owner ping; never blocks a live call | Book a model-invented time → row flagged "outside policy" within seconds. |
| M-4 | Recorded price = 2× what the caller agreed ($378 vs $189): the transcript extractor multiplied a STALE unit count the caller had corrected mid-call — and the extractor's own prompt example taught it that exact arithmetic | Extractor rule: CORRECTIONS WIN — only the final corrected configuration counts, never self-multiplied units; voice prompt now demands quoted_total/unit_count on the booking tool so extraction is the last resort | Run a call that corrects a detail mid-way ("two furnaces… actually one") and check `quoted_amount_cents`. |
| M-5 | A phone reschedule of a job already pushed to HCP was silently REVERTED by the next reconcile pass (HCP time treated as truth; their API cannot move a job) | Reconcile skips the revert while HCP still shows the pre-reschedule time (`rescheduled_from` match) and the office is pinged to move the job manually; any OTHER HCP-side time still wins | Reschedule a pushed test booking by phone → local time holds through the next reconcile, office notified. |
| M-6 | On a bare "thanks!" the model re-booked the OTHER offered window and silently relocated the visit (collapse treated ANY time difference as an intentional move) | A booking may only MOVE when the customer's own inbound expresses a time or change ("3pm instead", "Thursday", "the other option"); same-window drift is a no-op; a contentless acknowledgement can never relocate an appointment | Battery: booked lead + "thanks" turn → time unmoved, no confirmation resend. |

### N. The detail the lead gave that the system never kept (the Gina class — added Aug 2026)

A Messenger questionnaire captured only a ZIP; the lead accepted a slot; the agent **booked with "60706" as the entire address**, asked for the street AFTER booking, got it, said "Got it, 7729 W Foster Ave" — **and stored nothing**. Our appointment, the confirmation SMS, and the HCP job all carried a bare zip; the office fixed HCP by hand. Root causes: `update_lead_details` had NO address field (the model literally could not save it), nothing gated a visit booking on having a real street, and an acknowledged correction lived only in the reply text.

**The law of this class: anything the lead states or corrects must have (1) a tool field to land in, (2) a deterministic backstop when the model forgets the tool, and (3) propagation to every copy — the lead file, the appointment, and a flag when the HCP mirror can't be edited. The last confirmed value wins everywhere.**

| ID | Symptom | Guard now in place | New-account check |
|---|---|---|---|
| N-1 | Visit booked with a zip-only "address"; confirmation SMS read "at 60706" | `isCompleteServiceAddress` gate: a visit booking without a real street does NOT proceed — the reply becomes the address ask, and the model books next turn (sales/video + requires_travel=false exempt). Voice flags instead of blocking (confirmation already spoken) | Battery: accept a slot with only a zip on file → 0 appointments, agent asks for the street. |
| N-2 | Street given right after booking, acknowledged in words, stored nowhere | `update_lead_details` gained address/unit_count/property_type; PLUS the deterministic auto-attach: an inbound that IS a street address, while the active appointment lacks one, attaches itself before the model even runs | Battery: send "7729 w foster ave" → lead + appointment updated with street + carried zip, no model needed. |
| N-3 | A corrected detail updated the lead but not the appointment/HCP job | `saveLeadDetailsForLead` propagates: address corrections rewrite the scheduled appointment; HCP-pushed jobs get a manual-fix note + owner ping (their API can't edit a job). Voice: post-call extractor feeds the same shared writer | Battery: correct the address after the HCP push → appointment updated + note + notification. |
| N-4 | Stale form answer outranked the live correction ("two furnaces" form vs "actually one" in-conversation → $378 recorded on a $189 deal) | Corrections land in `leads.metadata` (unit_count/property_type) and the pricing ladder reads them BEFORE free-text mining; the transcript extractor's own prompt example that taught the multiplication is gone, replaced by CORRECTIONS WIN | Battery: store 2 units then correct to 1 → computed price $189, no LLM call. |
| N-5 | Three identical confirmation texts for one booking (each collapsed duplicate re-fired the webhook's confirmation block; two rendered in server-UTC — a stale pre-deploy instance during a rolling deploy) | Booking outcome plumbing (`created`/`moved`/`noop`) — webhooks send only on real changes; `sendConfirmations` is per-channel idempotent via the confirmation flags; every move-path resets the flags so a NEW time still confirms fresh | Battery: repeat trigger on a confirmed appointment sends nothing; a genuine move re-confirms. |
| N-6 | "Looking at the lead file…" reached a customer (1 machinery mention in a short message slipped the scored leak check) | Instant-block tier: "lead file" and tool names block at ANY length | Unit test in the battery. |

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
16. ☐ **Decline-boundary attack** (I-1) — for EVERY decline rule, play the customer who trips its trigger words but is legitimate business. For a "no commercial / no multi-unit" rule that means at minimum: a condo owner, an apartment renter with landlord approval, an authorized property manager, a townhome owner, and a genuinely commercial caller. Only the last one may be declined. Also try the awkward middle (a landlord wanting 12 units) — the answer should be "the office will call you," never a refusal and never invented bulk pricing.
17. ☐ **Price-floor attack** (I-3) — if the account has a floor, try to break it from six angles: the hook price ("the ad said $89"), a flat discount beg, per-unit haggling ("$150 each"), competitor match ("they quoted $120 — you advertise a Best Price Guarantee"), authority appeal ("ask your manager", cash offer), and sympathy (fixed income/retiree). Pass = zero appointments below the floor AND the agent stays warm while refusing. Also verify the positive path: a lead who accepts after the pitch gets booked normally.
18. ☐ **Channel parity** (I-2) — run the SAME 3 scenarios on every live channel (SMS, Messenger, voice) and diff the answers. Any difference must be a deliberate channel rule, not an accident of where an instruction was stored.
19. ☐ **Authorization matrix** (1.15) — owner, property manager, landlord-approved renter all proceed; an unapproved renter is asked to get the OK and offered a tentative time, never refused outright.
20. ☐ **Prompt self-contradiction read** (I-1) — before going live, read the assembled prompt looking only for pairs of clauses that could disagree: a decline rule vs a product line, a hard rule vs an exception, a scope limit in one section vs a broader claim in another. This is a reading task, not a testing task, and it is the cheapest bug-per-minute step in the whole playbook.
21. ☐ **Identity round-trip** (class J) — book a test lead who states a full name mid-conversation, then check the whole chain: `leads.first_name`/`last_name` AND `email` populated (NOT just in notes) → the name on the confirmation → the HCP customer record. The email ask is a REQUIRED booking step (one direct ask; refusal never blocks the booking — that policy came from live bookings that reached HCP with no email at all because email was classed "nice to have"). Repeat once in the client's second language if they get non-English leads. A name that only appears in `notes` is a failure, not a pass.
22. ☐ **Channel side-effect diff** (class K) — for each live channel, book one test appointment and confirm all four downstream effects fire: appointment row, confirmation email, confirmation SMS, owner notification. Missing effects on one channel and not another is the signature of this class.
23. ☐ **Email sender check** (0.8) — trigger one confirmation email and look at the actual From address. If it reads `onboarding@resend.dev`, the account is not ready to go live.
24. ☐ **Manual repair path** — open a lead, use **Edit details**, change the name, and confirm it saves and (in HCP mode) updates the customer in Housecall Pro. The owner needs this to work before they need it in anger.
25. ☐ **Duplicate-booking storm** (class M) — book a voice test lead, then drive 9 more book_appointment calls at the same slot: exactly ONE appointment row, repeats suppressed, session marked booked. Then 5 bookings concurrently on a fresh lead: the unique index must hold at 1.
26. ☐ **House-number address** (class M/B) — book with an address whose house number is 5 digits ("13496 Melanie Dr … 48313"): the HCP customer address must carry the REAL zip, and the assigned tech must match that zip's territory at job creation.
27. ☐ **Mid-call correction price** (M-4) — a call that corrects a detail ("two furnaces… actually one, $189") must record the corrected total, not the multiplied stale one.
28. ☐ **Zip-only booking hold** (N-1) — accept a slot for a lead whose address is just a zip: expect NO appointment and an address ask; give the street: expect ONE appointment carrying the full street.
29. ☐ **Correction round-trip** (N-3) — after booking (and after the HCP push), correct the address in conversation: lead + appointment must update, the job must get the manual-fix note, the owner must get pinged.
30. ☐ **Acknowledgement immunity** (M-6) — reply "thanks!" / "ok" / "great" to a booked lead several times: appointment count and time must not change, and no confirmation may re-send.

**Known real-world untestables — verify in week 1 with real traffic instead:** actual SMS deliverability (A2P-dependent), real-caller STT quality, email spam-folder rates across providers, Messenger 24h-window behavior.

**What "engine-level" testing does and doesn't prove.** Driving `processAndSave(...)` directly with test leads exercises the real brain, the real playbook injection, the real tools, routing and DB writes — so it proves reasoning, pricing, qualification, and booking logic. It does NOT prove the transport layer: Graph/Twilio delivery, webhook signature handling, or human-takeover echoes. Those need one real message on the live channel.

---

## Phase 6 — Go-live + first week

- ☐ Flip the channel switches deliberately (e.g. leadgen first, Messenger agent later — Top Air pattern).
- ☐ Day 1: pull the Twilio **status breakdown** for the account's number (delivered vs undelivered vs failed, grouped by error code) — not a spot-check of one thread (0.1a). 30034 = A2P problem; 21211 = form producing garbage phones.
- ☐ Day 1: confirm the three cron log lines cycle in Railway logs.
- ☐ Days 1–7: review EVERY AI conversation transcript daily — this is where the next Marilyn-class seam shows itself. Anything the agent said that isn't literally true goes back into Phase 1 as a prompt/KB fix, then re-run battery item 3.
- ☐ Week 1: check the `needs_attention` queue is being worked by the owner (F32 — it has no automated exit).
- ☐ Week 1: spot-check HCP customer attachments if the client's book has shared landlines (E28).
- ☐ Confirm revenue attribution appearing (`hcp_revenue_events`, "Booked by AI" vs "Sourced by AI").
- **Rolling deploys serve TWO app versions for a few minutes.** Messages produced in that window can differ in format from one minute to the next (live: three confirmations to one lead — the first rendered 3:00 PM by the new instance, the next two rendered raw-UTC 8:00 PM by a draining pre-fix instance). Before diagnosing a "regression" in messages sent near a deploy, check the commit/deploy timestamps against the message timestamps — deploy overlap explains mixed behavior that no single code version could produce.

---

## Appendix — by-design behaviors (don't "fix" these)

- `needs_attention` never auto-clears; the AI still replies to inbound on flagged leads (F32).
- Two-zip addresses resolve to the LAST 5-digit group (E27) — street-number-first is the common case.
- `past_due` does not stop the AI — only `cancelled` does, and pilots never stop (F36).
- Reconcile is the only HCP sync path (no webhooks exist on their public API).
- Placeholder-phone leads intentionally skip SMS sequences and HCP pushes until a real phone is captured.
- Deleting a lead gives that person a clean slate on re-contact; it does not resurrect history.
- Inactive technicians survive HCP re-imports on purpose; deleted ones come back — use `inactive`.
- Housecall Pro jobs can be created and read through the API but **never cancelled or deleted** — manual removal in their UI is the only way, so the AI's cancel flow notifies the office by design.
- Hook prices (e.g. an $89/$99 ad special) are quotable so the agent can explain the difference, but are never bookable. Quoting ≠ selling.
- **Two revenue numbers, never conflated:** *Potential revenue booked by AI* = what the agent SOLD (sum of `appointments.quoted_amount_cents` on AI-booked, non-cancelled jobs in range) — amber; *Revenue closed by the team from AI agent jobs* = money actually collected in HCP on those jobs (`hcp_revenue_events`, `attribution='booked_by_ai'`) — lime. Both obey the range/source filters; office-booked jobs never count toward either.
- Quoted price resolution ladder: **agent-stated** (book_appointment `quoted_total`) → **computed** from the price book × unit count → **LLM transcript extraction** (last resort only). Unresolvable stays NULL and the card reports it as unpriced — the system never invents a price. `quoted_source` records which path was used.
- Customer-facing times always render in the **service-address timezone** (zip→tz, fallback company tz); owner/office notifications stay in company time; the HCP calendar shows the account's own timezone. Slot ISO times are absolute UTC — only the labels differ.
- A booked lead's status can never slide back to a discovery stage (`isStatusDowngrade`) — terminal and needs-attention moves stay legal.
- `min_booking_lead_days` (ai_agent_config) gates how soon a booking may land, in company-local days: 0 = same-day OK (default), 2 = today and tomorrow never offered (Top Air). Enforced in the slot engine AND at booking time, so a model hand-writing tomorrow's ISO still bounces.
- On a refused upsell the Messenger agent goes fully silent (`[[SILENT]]`), while the SMS agent sends one short polite close — a deliberate channel difference (dead air reads as a glitch over SMS).
- Non-runtime KB fields (`unique_selling_points`, `testimonials`, `team_info`, …) do not affect live conversations; they only shape a regenerated prompt.
- Every outbound message on a written channel passes through `sanitizeAgentText` (no dash punctuation, no asterisks, ranges as "to"). Prompt rules alone were probabilistic; this makes the style guarantee absolute. Voice is unaffected.
- The name backstop only ever *fills* a blank name — it never overwrites one already on file, because an earlier capture (form, prior conversation) beats one heard mid-call.
- `/email` is reachable in Housecall Pro mode on purpose: we own the confirmation and reminder emails in both modes, even though their CRM owns the pipeline.
- The voice agent takes no notes during a live call (dead air); identity and job details are extracted from the transcript after the call ends.
- **Bookings are 3-hour ARRIVAL windows** (8–11 / 10–1 / 12–3 / 3–6 company-local, product standard Aug 2026), and the windows deliberately overlap. Capacity is one job per window per tech (max 4/day) enforced by **window-bucket** logic — never "fix" it back to time-overlap checks, which cap techs at ~2 jobs/day; and never count our own HCP job mirrors as busy intervals (`excludeOurJobs`), which cross-blocks adjacent windows. Office-booked HCP jobs DO block every window they overlap, on purpose.
- Technician weekly schedules gate the window START (a 3–6 window is offered to a tech whose shift ends at 5) — the arrival promise is what's sold; dispatch sequences the day.
- **Anchor-day booking (Aug 2026):** slots are only offered on days where the tech ALREADY has a job (ours or office-booked HCP) — new jobs join existing routes; the anchored search runs ≥21 days out with a 45-min route-insertion ceiling. Only when the entire anchored search is empty does the open-day fallback fire, and it never lands sooner than 7 days out. Fallback bookings stamp "NEW ROUTE DAY" on the appointment notes. The booking-time guard enforces the same rule, with one escape: a time the slot tool actually offered (leads.selected_slots). A brand-new account with zero jobs behaves like the old system (fallback) until its first jobs exist — the anchor logic then takes over automatically.
- **One active AI booking per lead** (class M): a lead holds at most ONE `scheduled` AI-origin appointment, enforced by prompt state + handler guard + DB unique index. A repeat booking at the same slot is a no-op; at a different time it MOVES the existing appointment (reschedule semantics). Office-imported jobs (`origin='hcp'`) stack freely — repeat customers are normal. Don't "fix" a second AI booking into existence; fix whatever asked for it.
- **Phone reschedules of HCP-pushed jobs are two-step by design:** their API cannot move a job, so we move OUR row, note "move the Housecall Pro job manually" on the appointment, ping the office, and the reconcile pass deliberately does NOT revert to HCP's stale time while it still equals the pre-reschedule time. The board catching up is the office's manual step, not a sync bug.
- **Voice bookings are audited AFTER insert, never blocked inline:** by the time the tool runs, the confirmation is already being spoken — a hard reject would create a phantom promise. Policy violations (coverage/capacity/anchor/lead-time) flag `needs_attention` + note + owner ping instead. On SMS the same validator runs BEFORE insert and does hard-reject; that difference is deliberate.
- **The behavior rules are GLOBAL — they ship with the engines, not with any company's prompt.** SMS/Messenger core rules 2c (changed-details confirmation) and 2d (full street address), voice rules 17–19 (book once / price capture / changed details), the booked-state prompt block, and the hardened tool descriptions apply to EVERY account automatically. A per-company generated prompt only needs account-specific policy (prices, territories, offers); never hand-copy the global rules into it — Top Air's RULE 16/17 exist there as reinforcement, not as the mechanism.
- **A booked lead's badge names WHO booked it:** "Booked by AI agent" (origin `ai`) vs "Booked by office" (origin `hcp`, sky tint) — derived from the latest scheduled appointment's origin on the lead profile and the leads list. Office phone-bookings linked by the reconcile land as origin `hcp`, so they read "Booked by office" automatically (Brittany). Dashboard "Jobs booked by AI" already counts origin `ai` only — the badge and the metric agree by construction.
- **Booking outcomes are typed:** every book action resolves to `created`, `moved`, or `noop`, and side effects (confirmation SMS/email, owner notification) fire only on real changes. `sendConfirmations` is additionally idempotent per channel via the confirmation flags. Don't wire a new channel's post-booking block without honoring the outcome — that's how one lead got three confirmation texts.

---

## Appendix B — open questions to settle per account (don't guess these)

These are the questions that have actually blocked work. Get them answered at onboarding rather than mid-incident:

- Does any advertised price have **tiers or conditions** (property type, access difficulty, metro, seasonal), and what exactly triggers each tier? A second price with no stated trigger is unusable — the agent cannot know when to quote it, and guessing produces a customer-facing wrong price.
- Which services have a **standalone** price versus only existing inside a bundle?
- Is there a **hard price floor**, and does it apply per unit or per job?
- Which property types are served, and does each have its own price?
- For multi-metro accounts: which services are available in which metro?
- Who can authorize work besides the owner?
