# HVAC Lead Scraper

Pulls HVAC companies currently running Facebook ads + all HVAC businesses in 15 hot-climate US cities.
Outputs `hvac_leads.csv` ready to import into any cold email tool.

---

## What You Get

| Column | Source |
|---|---|
| Company name | Meta / Google |
| City + State | Meta / Google |
| Email | Hunter.io lookup from website |
| Phone | Facebook page / Google Maps |
| Website | Facebook page / Google Maps |
| Facebook Page URL | Meta |
| Ad Running Since | Meta (date they started spending) |
| Source | Facebook Ads or Google Maps |
| Google Rating | Google Maps |

---

## Step 1 — Get Your Meta Access Token (10 min, free)

This gives you access to the public Meta Ad Library.

1. Go to **developers.facebook.com**
2. Click **My Apps** → **Create App** → choose **Business** → fill in any name (e.g. "HVAC Research")
3. After the app is created, go to **Tools** → **Graph API Explorer**
4. Click **Generate Access Token** — select your app
5. Copy the token — it looks like `EAAGm...`

**Important:** The token expires in ~60 days. Generate a new one when it stops working.

Set it in your terminal:
```bash
export META_ACCESS_TOKEN="your_token_here"
```

Or paste it directly into line 35 of `hvac_lead_scraper.py`:
```python
META_ACCESS_TOKEN = "your_token_here"
```

---

## Step 2 — Get Hunter.io API Key (2 min, free — 25 searches/month free)

Hunter finds contact emails from company websites. Free tier = 25 lookups/month.
$49/month = 1,000 lookups. Worth it for a big campaign.

1. Go to **hunter.io/users/sign_up**
2. Sign up free
3. Go to **API** in your dashboard → copy your API key

Set it:
```bash
export HUNTER_API_KEY="your_key_here"
```

---

## Step 3 — Google Places API (optional, ~$10 for 1,000 results)

This adds all HVAC businesses from Google Maps — not just Facebook ad runners.
Skip this if you only want Facebook advertisers.

1. Go to **console.cloud.google.com**
2. Create a project
3. Enable **Places API**
4. Go to **Credentials** → **Create API Key** → copy it

Set it:
```bash
export GOOGLE_PLACES_KEY="your_key_here"
```

Cost: $17 per 1,000 results (first $200/month is free credit = ~11,000 results free).

---

## Step 4 — Run It

```bash
cd "/Users/haimcohen/Desktop/ai system for home services/tools"
python3 hvac_lead_scraper.py
```

Runtime: ~15–30 minutes depending on list size.

Output: `hvac_leads.csv` in the same folder.

---

## What to Expect

| Scenario | Estimated Results |
|---|---|
| Meta only (no Hunter) | 500–1,500 companies, ~20% have email on FB page |
| Meta + Hunter ($49/mo) | 500–1,500 companies, ~60–70% with email |
| Meta + Google + Hunter | 1,500–3,000 companies, ~60% with email |

---

## Step 5 — Send the Emails

Import `hvac_leads.csv` into one of these tools:

**Free (to start):**
- **Gmail + copy-paste** — manual but free. Use for first 50.

**Cheap and good ($30–50/month):**
- **Instantly.ai** — best cold email tool for this. Import CSV, set up sequences, tracks opens/replies. $37/month.
- **Lemlist** — similar, slightly more features, $59/month.
- **Smartlead** — $39/month, good deliverability.

**What to do with leads that have NO email:**
- Go to their Facebook page → Message them (DM template in the marketing strategy doc)
- Or visit their website → find contact form → paste the email there

---

## Supplementary Sources (No Code Required)

### Apollo.io (Recommended — Start Today, Free)
1. Go to **app.apollo.io** → sign up free
2. Search: Industry = "HVAC" / "Heating, Ventilation & Air Conditioning"
3. Filter: Title = "Owner", "Founder", "President"
4. Filter: Location = Phoenix, Houston, Dallas, Miami, Atlanta, Las Vegas
5. Export 50 contacts free → upgrade to $49/month for 1,000

Apollo gives you: Name, Title, Email, LinkedIn, Company, City. High quality.

### Outscraper (Google Maps, No Code)
1. Go to **outscraper.com**
2. Search: "HVAC contractor" in each target city
3. Cost: ~$3 per 1,000 results
4. Get: Company name, address, phone, website, rating
5. Then use Hunter.io to find emails from the website domains

### Apify (Facebook Ad Library, No Code)
1. Go to **apify.com/store**
2. Search "Facebook Ad Library Scraper"
3. Set search term = "HVAC" → run
4. Cost: ~$5–10 for a big scrape
5. Export to CSV

---

## Priority Order

1. **Today:** Apollo.io free 50 leads → start emailing immediately
2. **This week:** Run `hvac_lead_scraper.py` with Meta token → 500–1,500 Facebook advertisers
3. **Next week:** Add Hunter.io ($49) → get emails for 60%+ of the list
4. **Scale:** Add Google Places key → adds another 500–1,000 businesses per city
