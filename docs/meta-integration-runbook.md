# Meta Integration Runbook — Facebook, Messenger, WhatsApp

Written July 13, 2026, after the full integration + debugging session.
This is the single source of truth for how FieldBuilt connects to Meta,
what was fixed, what state everything is in, and what happens when a
client onboards.

---

## 1. How the system works (architecture)

One Meta app serves ALL clients: **"ai systems for home services"** (App ID
1607082137246333), owned by the ScaleZ Business Manager.

**Per-client, everything is automatic in the product:**

| Client action (in FieldBuilt) | What happens automatically |
|---|---|
| Connects Facebook (OAuth) | We get tokens for THEIR pages |
| Picks page + lead forms in wizard | Product subscribes their page to `leadgen`, `messages`, `messaging_postbacks` via API |
| Lead submits their Lead Ad form | Meta → our webhook → lead in CRM → AI texts within seconds |
| Customer messages their FB page (incl. from click-to-Messenger ads) | Meta → our webhook → AI replies on Messenger → thread in CRM |
| Connects WhatsApp | WABA subscribed → same flow on WhatsApp |

**One-time platform setup (ALREADY DONE — never repeated per client):**
- App-level webhook: Page object → `https://fieldbuiltai.com/api/webhooks/facebook`
  with fields leadgen, messages, messaging_postbacks
- App-level webhook: WhatsApp → `https://fieldbuiltai.com/api/webhooks/meta-whatsapp`
- Verify token = `FACEBOOK_VERIFY_TOKEN` (Railway env; same for both)
- Business verification: ✅ complete
- App published, then intentionally switched back to **Development Mode**
  for testing (see §4)

---

## 2. Access levels — the single most important concept

Meta has two access levels per permission. This explains almost everything
that confused us today:

- **Standard Access** (what we have now): the app only works for people
  with roles ON THE APP (admin/developer/tester). Real customers' messages
  are NOT delivered in Live mode.
- **Advanced Access** (granted by App Review): the app works for EVERYONE —
  any client, any page, any customer. Fully automatic.

**Testing happens in Development Mode with role users (this is Meta's
intended workflow).** Jonathan = Admin, Haim = Tester. The screencast for
App Review is recorded in this mode.

**The launch sequence is:**
1. Film screencast in Development Mode (role users) ✅ everything ready except one item (§5)
2. Submit App Review (10 permissions, descriptions already written)
3. Approval (typically 2–10 business days)
4. Flip app to Live
5. From that moment: clients onboard 100% self-serve. No dev dashboard,
   no roles, no manual steps per client.

---

## 3. Product bugs found & fixed today (all deployed to production)

These were REAL product bugs the testing uncovered — all fixed:

1. **DB constraint blocked Messenger/WhatsApp conversations** —
   `conversations.channel` only allowed sms/voice. Every Messenger message
   was silently rejected. Fixed via migration.
2. **AI amnesia on Messenger/WhatsApp** — the engine loaded SMS-only
   history, so every message looked like first contact (Linda re-greeted
   endlessly). Fixed in all 3 history-loading paths.
3. **WhatsApp was dead on arrival** — code read/wrote an `is_active`
   column that never existed in `whatsapp_connections`; every connect and
   every inbound lookup silently failed. Column added.
4. **No Disconnect button** on connected Facebook card. Added (2-click confirm).
5. **OAuth callback fragility** — single network hiccup killed the whole
   connect flow with a vague error. Now retries + distinct error messages.
6. **Channel-aware UI** — lead profile shows "Messenger lead" badge; thread
   shows channel icons; manual dashboard replies to Messenger leads now go
   through the Messenger Send API (previously would have been SMS'd to a
   placeholder phone). Phone + email typed in chat auto-save to the lead.
7. **Webhook delivery logging** — every Meta delivery now logs one line
   (`[webhook/facebook] delivery: ...`) visible via `railway logs`.

---

## 4. The webhook delivery saga (what "the mess" actually was)

**Symptom:** all config verified perfect, but real events (Messenger
messages, test leads) sat in Meta's queue as "Pending" forever. Meta's own
dashboard Test button worked; real events never arrived.

**Root cause:** Meta's webhook dispatcher was holding stale/corrupted
routing state for the app — likely caused by the same-day churn of
publishing, mode-flipping, and repeated subscription edits.

**The fix that worked:** delete and recreate the webhook subscription at
BOTH levels (app-level `/{app-id}/subscriptions` and page-level
`/{page-id}/subscribed_apps`). Messaging events began flowing instantly.

**Confirmed working end-to-end after the fix:**
- Messenger: Haim → demo page → webhook → lead created → Linda replied →
  Haim received the reply → thread in CRM. FULLY PROVEN.

**Still pending at session end:** leadgen (test-lead) delivery for the NEW
demo page. Important context:
- Leadgen DID deliver + fully process this morning (08:43 UTC) on the old
  page — the pipeline itself works.
- The demo page was created ~2 hours before testing, wasn't in the
  Business Manager, and had restricted Lead Access Manager state (both
  since fixed: added to BM + "Restore default access").
- Meta's own UI says access changes can take **up to 24 hours** to
  propagate. Retest the morning after (see checklist).

**Sender-side gotchas discovered (test-environment only, not product):**
- A page owner cannot Messenger their own page (that's why Jonathan's
  first tests said "couldn't send").
- Haim's desktop Messenger was in a broken encrypted-sync state until he
  entered his PIN ("couldn't send" randomly). Mobile app or PIN fixes it.
- Repeating identical message text trips FB's spam filter.
- The "Johnny Cohen" page is a profile-hybrid (professional-mode style);
  the clean classic page **"FieldBuilt Demo Heating & Air"**
  (1219786441220643) is now the demo/testing page connected to the CRM
  (Rocket HVACR company account).

---

## 5. Current status board

| Channel / feature | Status |
|---|---|
| SMS agent | ✅ Live in production (pilot-ready) |
| Voice agent + smart dispatch | ✅ Live, fully tested |
| Call forwarding (existing business numbers) | ✅ Live, self-verifying |
| Messenger | ✅ PROVEN end-to-end (dev mode; real clients unlock at Advanced Access) |
| WhatsApp | ✅ Proven server-side + live reply loop (test number; 24h token — regenerate before filming) |
| Facebook Lead Ads → CRM | ✅ Pipeline proven (morning delivery, old page). ⏳ New demo page's dispatch still propagating — retest after 24h |
| Meta App Review | 📝 Ready to film + submit (only Scene 3 pending the leadgen retest) |

---

## 6. Pre-filming checklist (final)

1. ☐ Retest leadgen on demo page (Testing Tool → delete/create → Track
   status). If delivered → film everything. If still Pending after 24h →
   either film Scene 3 on the old Johnny Cohen page (leadgen provably
   works there; switch page in wizard, film, switch back) or file a Meta
   bug with the stuck-Pending tracker screenshot.
2. ☐ Regenerate WhatsApp temp token (24h expiry) on filming day → send to
   Claude to update the connection (10-second SQL update).
3. ☐ App must be in **Development Mode** while filming (it is).
4. ☐ Film the 5 scenes (shot list in the session notes / ask Claude).
5. ☐ Submit App Review with the prepared usage descriptions.
6. ☐ After approval: flip app to Live. Messenger/leads work for ALL clients.

---

## 7. New client onboarding — what's manual vs automatic

**After App Review approval + Live mode, a new client's setup is:**

1. Sign up → onboarding wizard (company, service type, area, knowledge
   base) — client self-serve
2. Twilio number auto-provisioned — automatic
3. Connect Facebook → OAuth → pick page + forms — client self-serve,
   ~2 minutes; page subscription happens automatically
4. (Optional) Call forwarding from their business number — dial-code
   instructions shown in Settings, self-verifying test call
5. (Optional) WhatsApp — connect their WABA (embedded signup flow)

**Nothing manual on the Meta developer dashboard. Ever. Per client.**

**Troubleshooting items to check if a client's leads don't arrive:**
- Their page must be a real Page (not a profile in professional mode)
- If their business uses Lead Access Manager with restricted access:
  Business Settings → Integrations → Leads Access → their page →
  "Restore default access" or assign the app under CRMs
- Lead Ads TOS must be accepted for the page (happens when they create
  their first form)
- Diagnose deliveries live: `railway logs | grep "delivery:"` shows every
  event Meta sends, per page ID

---

## 8. Key IDs and locations

- Meta App: `1607082137246333` (ai systems for home services), owned by
  ScaleZ BM (`501956907535552`)
- Demo page: FieldBuilt Demo Heating & Air — `1219786441220643` (in ScaleZ BM)
- Old page (avoid for Messenger testing): Johnny Cohen — `105226909106813`
- Demo lead form: "test fieldbuilt" — `1662981598126034`
- WhatsApp test number: +1 555-166-7105, phone_number_id `1186212977912304`,
  WABA `1332517462413727` (Test WhatsApp Business Account)
- Testers: Haim Cohen (accepted)
- CRM company for all demos: Rocket HVACR (`1b840058-fc41-4c90-9426-039c8088de2a`)
- Webhooks: `/api/webhooks/facebook` (page), `/api/webhooks/meta-whatsapp` (WhatsApp)
- Lead Ads Testing Tool: developers.facebook.com/tools/lead-ads-testing
