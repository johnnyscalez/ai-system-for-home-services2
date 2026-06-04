#!/usr/bin/env python3
"""
Build Master HVAC Lead List — BookedAI
Merges Apollo (verified owner emails) + Apify (Facebook ad runners) into one CSV.

Tier 1 GOLD  — In Apollo AND running Facebook ads → email + DM them
Tier 1       — Running Facebook ads only          → Facebook DM only
Tier 2       — In Apollo only                     → Cold email
"""

import csv, json, re, os

APOLLO_FILE = "/tmp/hvac_enriched.csv"
APIFY_FILE  = "/tmp/apify_hvac_only.json"
OUTPUT      = "/Users/haimcohen/Desktop/ai system for home services/tools/hvac_master_leads.csv"

def normalize(name):
    name = (name or "").lower()
    for s in [" llc", " inc", " corp", " co.", " company", " services", " service",
              " heating", " cooling", " air", " hvac", ",", ".", "&", " and ", "the "]:
        name = name.replace(s, " ")
    return re.sub(r"\s+", " ", name).strip()

# ── Load Apollo ──────────────────────────────────────────────────────────────
apollo_rows = list(csv.DictReader(open(APOLLO_FILE)))
print(f"Apollo contacts loaded: {len(apollo_rows)}")

# Build lookup by normalized company name
apollo_by_name = {}
for row in apollo_rows:
    key = normalize(row.get("company", ""))
    if key and key not in apollo_by_name:
        apollo_by_name[key] = row

# ── Load Apify ───────────────────────────────────────────────────────────────
apify = json.load(open(APIFY_FILE))
print(f"Apify Facebook advertisers: {len(apify)}")

# ── Cross-reference ──────────────────────────────────────────────────────────
master = []
apify_matched_ids = set()

# Pass 1: Apify companies that are also in Apollo → Tier 1 GOLD
for a in apify:
    key = normalize(a["page_name"])
    if key in apollo_by_name:
        row = apollo_by_name[key]
        master.append({
            "tier":         "1_GOLD",
            "outreach":     "email+facebook_dm",
            "first_name":   row["first_name"],
            "last_name":    row["last_name"],
            "title":        row["title"],
            "email":        row["email"],
            "email_status": row["email_status"],
            "company":      a["page_name"],
            "website":      row["website"],
            "linkedin_url": row["linkedin_url"],
            "facebook_url": a["facebook_url"],
            "phone":        row["phone"],
            "city":         row["city"] or a.get("city", ""),
            "state":        row["state"] or a.get("state", ""),
            "source":       "Apollo+Facebook Ads",
            "note":         "Running FB ads — reference their ad in email opener",
        })
        apify_matched_ids.add(a["page_id"])

# Pass 2: Apify companies NOT in Apollo → Tier 1 (DM only)
for a in apify:
    if a["page_id"] not in apify_matched_ids:
        master.append({
            "tier":         "1",
            "outreach":     "facebook_dm",
            "first_name":   "",
            "last_name":    "",
            "title":        "Owner",
            "email":        "",
            "email_status": "",
            "company":      a["page_name"],
            "website":      a.get("website", ""),
            "linkedin_url": "",
            "facebook_url": a["facebook_url"],
            "phone":        a.get("phone", ""),
            "city":         a.get("city", ""),
            "state":        a.get("state", ""),
            "source":       "Facebook Ads",
            "note":         "Running FB ads — DM with ad-reference opener",
        })

# Pass 3: Apollo contacts NOT in Apify list → Tier 2
apify_companies_norm = {normalize(a["page_name"]) for a in apify}
for row in apollo_rows:
    if normalize(row.get("company", "")) not in apify_companies_norm:
        if row.get("email") and row.get("is_hvac") == "1":
            master.append({
                "tier":         "2",
                "outreach":     "cold_email",
                "first_name":   row["first_name"],
                "last_name":    row["last_name"],
                "title":        row["title"],
                "email":        row["email"],
                "email_status": row["email_status"],
                "company":      row["company"],
                "website":      row["website"],
                "linkedin_url": row["linkedin_url"],
                "facebook_url": "",
                "phone":        row["phone"],
                "city":         row["city"],
                "state":        row["state"],
                "source":       "Apollo",
                "note":         "Verified HVAC owner email",
            })

# ── Write master CSV ─────────────────────────────────────────────────────────
fields = ["tier", "outreach", "first_name", "last_name", "title", "email",
          "email_status", "company", "website", "linkedin_url", "facebook_url",
          "phone", "city", "state", "source", "note"]

with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    writer.writerows(master)

# ── Summary ──────────────────────────────────────────────────────────────────
t1_gold = [r for r in master if r["tier"] == "1_GOLD"]
t1      = [r for r in master if r["tier"] == "1"]
t2      = [r for r in master if r["tier"] == "2"]
with_email = [r for r in master if r["email"]]

print(f"""
{'='*55}
  MASTER LIST COMPLETE → hvac_master_leads.csv
{'='*55}
  Tier 1 GOLD (email + Facebook DM): {len(t1_gold):>5}
  Tier 1      (Facebook DM only):    {len(t1):>5}
  Tier 2      (cold email):          {len(t2):>5}
  ─────────────────────────────────────────────
  TOTAL contacts:                    {len(master):>5}
  Contacts WITH verified email:      {len(with_email):>5}
{'='*55}

SEND ORDER:
  1. Tier 1 GOLD — personalized email referencing their
     Facebook ad + follow-up DM on Facebook
  2. Tier 1      — Facebook DM only (no email found)
  3. Tier 2      — Standard cold email sequence

Tier 1 GOLD companies:
""")
for r in t1_gold:
    print(f"  {r['first_name']} {r['last_name']} @ {r['company']}")
    print(f"  → {r['email']} | {r['facebook_url']}")
