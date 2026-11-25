# Meta integration runbook: Facebook Lead Ads, Messenger, ad results

Rewritten 2026-11-25 for the flooring product. Replaces the July 2026 HVAC version.
WhatsApp was removed from the product on this date and is no longer described here.

What is stated as fact below was checked on 2026-11-25 either in the code or with a
read-only Graph call using the app token. Anything that depends on Meta's review or
on a real client login is marked **not verified**.

---

## 1. What a flooring contractor gets

One Meta app serves every client: **"ai systems for home services"**, App ID
`1607082137246333`, owned by the ScaleZ Business Manager (`501956907535552`).

| The contractor does | The system does |
|---|---|
| Clicks Connect Facebook and signs in | Stores a 60-day login, every Page that login was granted, and (once the app has `ads_read`) its ad accounts |
| Picks the Page, the ad account and the lead forms | Subscribes the Page to our webhook; saves the selection |
| A homeowner submits a Lead Ad form | Lead appears in the CRM with every answer, the ad and campaign it came from, and gets a text within seconds |
| A homeowner messages the Page, or answers a click-to-Messenger ad | The AI replies in that Messenger thread; the thread shows in the CRM |
| Opens the dashboard | Ad spend from the ad account next to CRM results: leads, cost per lead, measures booked, cost per booked measure, signed |

No manual step in the Meta developer dashboard per client, once App Review is done (section 4).

---

## 2. How it is wired

### Routes
- `GET /api/auth/facebook?return_to=integrations|onboarding` starts the login.
- `GET /api/auth/facebook/callback` exchanges the code, collects Pages and ad accounts, then sends the owner to the wizard.
- `/connect/facebook` is the wizard: Page, ad account, lead forms, turn on. It sits outside the dashboard layout so it also works for an account that is still in onboarding. `/integrations/facebook-setup` forwards to it.
- `GET /api/integrations/facebook/forms?page_id=`, `GET /api/integrations/facebook/ad-accounts[?refresh=1]`, `POST /api/integrations/facebook/save`, `POST /api/integrations/facebook/disconnect`.
- `GET /api/ads/insights?range=last_7d|last_30d|this_month` (or `since`/`until`) feeds the dashboard card.
- **Live webhook: `https://fieldbuiltai.com/api/webhooks/facebook2`.** It re-exports `/api/webhooks/facebook`. Meta's app-level Page subscription points at `facebook2` (checked 2026-11-25). Do not delete the alias without re-pointing the subscription in the Meta dashboard first.

### Where the data lives (no schema change was needed)
- `integrations` row with `type = 'facebook'`: Page id and name, the Page token, the selected form ids, `lead_count`, `last_lead_at`, the user token, and `fb_pages_cache`. The cache is a JSON object `{ pages, adAccounts, adAccountsError, selectedForms, fetchedAt }` (older rows hold a bare array of pages; `readFbCache` in `lib/meta-ads.ts` accepts both). It contains tokens and is never sent to the browser.
- `facebook_connections`: one row per company holding `fb_ad_account_id` and the long-lived **user** token in `access_token`. Ad insights need the user token; a Page token cannot read an ad account.
- On each lead (`leads.metadata`):
  - `form_answers`: every non-contact answer as `{ "Question label": "answer" }`. Multi-select answers keep all values, joined with a comma.
  - `qualification`: answers that match a qualifying question, under the keys `project_type`, `project_size`, `timeline`, `homeowner`, `decision_makers`, `budget`, `current_floor`, `financing`.
  - `ad`: `{ ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, form_id, form_name, platform, is_organic }`.
  - `leadgen_id` and `leadgen_ids` (every submission by this person).
  - Lead columns filled from the form: name, phone, email, `zip`, `address` (only a full street address), `job_type` (first floor type selected), `notes` (a readable one-line summary).

### Code
- `lib/meta-ads.ts`: Graph helpers, the connection, ad insights.
- `lib/meta-lead-form.ts`: maps a form submission to lead fields. Pure, no network.
- `lib/meta-leadgen.ts`: the lead pipeline (dedupe, merge, placeholder and recovery, first message).
- `lib/messenger.ts`: Messenger send, history sync, automation detection.

---

## 3. Permissions

Requested at login (`app/api/auth/facebook/route.ts`):

| Permission | Why |
|---|---|
| `leads_retrieval` | Read Lead Ad submissions |
| `pages_manage_ads` | Read lead form definitions (question labels, form names) |
| `pages_show_list`, `pages_read_engagement` | List the Pages and read their details |
| `pages_manage_metadata` | Subscribe the Page to our webhook |
| `pages_messaging` | Messenger conversations |
| `business_management` | Pages and ad accounts that live inside a Business |
| `ads_read` | Ad accounts, spend and results. Read only |

**`ads_read` is not on the Meta app yet.** `GET /{app-id}/permissions` on 2026-11-25 listed the first seven (plus two WhatsApp permissions) and no `ads_read`. Asking Facebook for a permission the app does not carry breaks the login window for app-role users, which would take lead sync down with it. So the code asks the app first (`adsReadRequestable` in `lib/meta-ads.ts`, cached 10 minutes) and adds `ads_read` to the login only when the app has it. Until then:
- the wizard's ad account step shows no accounts and offers "Skip for now";
- leads and Messenger work normally;
- the dashboard card says no ad account is selected.

`FACEBOOK_ADS_READ=on` or `off` in the environment forces the behaviour either way.

---

## 4. What Jonathan must do in the Meta dashboard

In this order.

1. **Add `ads_read` to the app** (App Dashboard, Permissions and features). After that the login asks for it on its own, and app-role users (Jonathan, Haim) can connect an ad account straight away.
2. **Add `message_echoes` to the app-level Page subscription** (Webhooks, Page object). The fields today are `leadgen`, `messages`, `messaging_postbacks`. Without `message_echoes` the system does not see what a person types from the Page inbox the moment it is sent; it only finds out at the next thread sync (before each AI reply). The Page-level subscription already asks for it.
3. **Remove the WhatsApp Business Account webhook subscription** (Webhooks, WhatsApp Business Account object). It still points at `https://fieldbuiltai.com/api/webhooks/meta-whatsapp`, a route that no longer exists. The two WhatsApp permissions and the WhatsApp product can be removed from the app at the same time.
4. **Submit App Review for Advanced Access.** Until it is granted the app works only for people with a role on the app, so a client cannot connect on their own: their Page has to be shared to the ScaleZ Business Manager and connected by an app-role profile. Request Advanced Access for:
   - `leads_retrieval`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_metadata`
   - `pages_manage_ads`
   - `pages_messaging`
   - `business_management`
   - `ads_read` (new; needs its own usage description and a screencast scene showing the ad account picker and the dashboard card)
   Business verification is already complete. The screencast is recorded in Development Mode with a role user.
5. **After approval: switch the app to Live.** From then on clients connect by themselves.

Status of the review itself: **not verified** on 2026-11-25. The July notes say it had not been submitted.

---

## 5. How a client connects (and what goes wrong)

1. Integrations, or the onboarding step "Ads and access": Connect Facebook.
2. In the Facebook window, sign in with the profile that manages the business Page.
3. Wizard: pick the Page, pick the ad account (or skip), choose "Every form on this Page" or specific forms, turn on.

"Every form" is the default and the recommendation: forms created later are picked up without touching the setup. Turning on with zero forms is valid; Messenger starts working immediately.

### The Page is listed but marked "Access not granted"
Facebook Login for Business grants an app a **subset** of the user's Pages. `/me/accounts` returns only the Pages granted to this app, and the Facebook window's **Reconnect** button silently reuses the previous selection. Fix: sign in again, click **Edit settings** (not Reconnect), tick the Page under "current Pages only", tick the owning business under "current Businesses only", keep every permission on. This was the real cause of the "Cannot parse access token" incident in July; it had nothing to do with ownership or partner sharing.

### Leads do not arrive
- The Page must be a real Page, not a profile in professional mode.
- Lead Access Manager: Business Settings, Integrations, Leads Access, the Page, "Restore default access" (or assign the app under CRMs).
- The Page must have accepted the Lead Ads terms (happens when its first form is created).
- A form that is not in the selection is ignored on purpose. The log line says so.
- Watch deliveries live: `railway logs | grep "delivery:"` prints every event Meta sends, per Page id. `grep "\[leadgen\]"` prints what happened to each lead.

### The Facebook login expired or was revoked
The lead is **not lost**. A placeholder lead is created as Needs attention, the owner gets one text per hour at most, and the Integrations card shows how many leads are waiting. Signing in to Facebook again fills each one in automatically (leads under 48 hours old then get the normal first text; older ones are completed and left for a person).

### Meta's dispatcher holds events as "Pending"
Seen in July: configuration was correct, Meta's own Test button worked, real events never arrived. What fixed it: delete and recreate the subscription at **both** levels, app (`/{app-id}/subscriptions`) and Page (`/{page-id}/subscribed_apps`). For lead events that still stuck, pointing the app subscription at a fresh callback path fixed it, which is why `facebook2` exists.

### Testing gotchas
- A Page owner cannot message their own Page.
- Identical repeated test messages trip Facebook's spam filter.
- Desktop messenger.com "couldn't send" is usually the end-to-end-encryption PIN; enter the PIN or use the mobile app.

---

## 6. Behaviour worth knowing

- **One Page, one company.** Saving a Page that is already active under another FieldBuilt account is refused.
- **Signing in again does not interrupt a live connection.** Leads keep flowing on the saved Page and forms until a new selection is saved. Only the tokens are refreshed.
- **Nothing is marked active unless Facebook confirms the Page subscription.** If Facebook refuses, the wizard shows Facebook's reason and a live connection is left as it was.
- **Meta retries webhooks.** A lead submission is processed once per `leadgen_id`; a Messenger message once per message id.
- **A person who submits twice is one lead.** New answers are merged in; nothing on file is removed.
- **Messenger: robot or person?** A message sent by the Page counts as the Page's own automation (and does not pause the AI) when it matches a known canned phrase, or matches one of the Page's configured ice breakers, greeting or lead form questions, or arrived within 3 seconds of the previous message, or opens the thread before the homeowner has said anything. Anything else from the Page is a person, and the AI pauses.
- **Messenger replies are only possible within 24 hours** of the homeowner's last message (Meta's rule). After that the follow-ups go by text.
- **Lead counts on the dashboard card.** "Leads" is what reached the CRM from Facebook in the period. Campaign rows use Meta's own count, taken from exactly one action type per row: `lead`, else `onsite_conversion.lead_grouped`, else `leadgen_grouped`. They are never added together.
- **Disconnect** unsubscribes the Page from the app (best effort) and deletes both rows.

---

## 7. State on 2026-11-25

| Item | State |
|---|---|
| Facebook connections in the database | None. The HVAC accounts were deleted on 2026-10-26 and the FieldBuilt sales tenant has no Facebook connection |
| App-level Page webhook | Active, `…/api/webhooks/facebook2`, fields `leadgen`, `messages`, `messaging_postbacks` |
| App-level WhatsApp webhook | Still active in Meta, pointing at a removed route. Remove it (section 4, step 3) |
| `ads_read` on the Meta app | Not present |
| Lead mapping, dedupe, merge, placeholder and recovery | Tested offline with sample payloads and an in-memory database |
| Webhook signature check and routing | Tested locally with a correctly signed request for an unknown Page |
| Login, wizard, Page subscription, real lead delivery, ad insights against a real ad account | **Not verified.** Needs a real Facebook login with a role on the app |
| Old demo Page "FieldBuilt Demo Heating & Air" (`1219786441220643`) and lead form `1662981598126034` | Exist in Meta but are connected to nothing. A flooring demo Page is still to be created |

## 8. Reference

- Meta app `1607082137246333`, ScaleZ Business Manager `501956907535552`.
- App-role users: Jonathan (admin), Haim Cohen (tester).
- Environment: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_VERIFY_TOKEN`, optional `FACEBOOK_ADS_READ`.
- Lead Ads Testing Tool: developers.facebook.com/tools/lead-ads-testing
