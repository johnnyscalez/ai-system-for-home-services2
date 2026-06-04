#!/usr/bin/env python3
"""
Apollo HVAC Lead Scraper — BookedAI
Pulls HVAC company owners from Apollo database across all target US cities.
Phase 1: Search (free, no credits) — collects all person IDs with has_email=true
Phase 2: Enrich (uses credits) — reveals full name, email, LinkedIn, website
Output: hvac_apollo_leads.csv
"""

import requests
import csv
import time
import json
from collections import defaultdict

API_KEY = "pL6KXhNjV0Zo9QUr9oIGZw"
HEADERS = {"X-Api-Key": API_KEY, "Content-Type": "application/json"}
BASE    = "https://api.apollo.io/api/v1"

# ── ICP Filters ──────────────────────────────────────────────────────────────
TITLES = [
    "owner", "ceo", "president", "founder",
    "co-owner", "co-founder", "principal", "managing owner"
]
EMPLOYEE_RANGES = ["1,10", "11,50"]
HVAC_KEYWORDS   = [
    "hvac",
    "heating and cooling",
    "air conditioning",
    "heating ventilation air conditioning",
    "hvac contractor",
    "hvac services",
]

# Hot-climate metros — peak AC season pain right now
TARGET_LOCATIONS = [
    "Phoenix, Arizona",
    "Scottsdale, Arizona",
    "Mesa, Arizona",
    "Tucson, Arizona",
    "Houston, Texas",
    "Dallas, Texas",
    "San Antonio, Texas",
    "Austin, Texas",
    "Fort Worth, Texas",
    "Miami, Florida",
    "Orlando, Florida",
    "Tampa, Florida",
    "Jacksonville, Florida",
    "Fort Lauderdale, Florida",
    "Atlanta, Georgia",
    "Charlotte, North Carolina",
    "Raleigh, North Carolina",
    "Las Vegas, Nevada",
    "Henderson, Nevada",
    "Denver, Colorado",
    "Nashville, Tennessee",
    "Memphis, Tennessee",
    "Riverside, California",
    "Sacramento, California",
    "Fresno, California",
    "Bakersfield, California",
    "Los Angeles, California",
    "San Diego, California",
    "Albuquerque, New Mexico",
    "Oklahoma City, Oklahoma",
    "Tulsa, Oklahoma",
    "Birmingham, Alabama",
    "Jackson, Mississippi",
    "Columbia, South Carolina",
    "Charleston, South Carolina",
]
# ────────────────────────────────────────────────────────────────────────────


def log(msg): print(msg, flush=True)


def search_people(location, keyword, page=1):
    """Single search call — free, no credits used."""
    payload = {
        "person_titles": TITLES,
        "organization_num_employees_ranges": EMPLOYEE_RANGES,
        "person_locations": [location],
        "q_organization_keyword_tags": [keyword],
        "per_page": 100,
        "page": page,
    }
    try:
        r = requests.post(f"{BASE}/mixed_people/api_search",
                          headers=HEADERS, json=payload, timeout=20)
        return r.json()
    except Exception as e:
        log(f"    [error] {e}")
        return {}


def enrich_person(person_id):
    """Reveal full name + email + LinkedIn for one person. Costs 1 credit."""
    payload = {"id": person_id, "reveal_personal_emails": False}
    try:
        r = requests.post(f"{BASE}/people/match",
                          headers=HEADERS, json=payload, timeout=20)
        d = r.json()
        return d.get("person", {})
    except Exception as e:
        log(f"    [enrich error] {e}")
        return {}


def check_credits():
    """Check remaining email reveal credits."""
    try:
        r = requests.post(f"{BASE}/mixed_people/api_search",
                          headers=HEADERS,
                          json={"per_page": 1, "page": 1},
                          timeout=10)
        return True
    except:
        return False


# ── Phase 1: Search ───────────────────────────────────────────────────────────

def phase1_collect_all():
    """Search Apollo across all cities × keywords. Free, no credits. Returns deduped person list."""
    log("\n" + "═"*60)
    log("PHASE 1 — Searching Apollo (free, no credits used)")
    log("═"*60)

    seen_ids = set()
    all_people = {}  # id → record

    total_searches = len(TARGET_LOCATIONS) * len(HVAC_KEYWORDS)
    completed = 0

    for location in TARGET_LOCATIONS:
        for keyword in HVAC_KEYWORDS:
            completed += 1
            log(f"\n[{completed}/{total_searches}] {location} × '{keyword}'")

            page = 1
            city_count = 0

            while True:
                data = search_people(location, keyword, page)
                people = data.get("people", [])

                if not people:
                    break

                for p in people:
                    pid = p.get("id")
                    if not pid or pid in seen_ids:
                        continue
                    if not p.get("has_email"):
                        continue  # skip if no email available

                    seen_ids.add(pid)
                    org = p.get("organization") or {}
                    all_people[pid] = {
                        "apollo_id":   pid,
                        "first_name":  p.get("first_name", ""),
                        "last_name":   p.get("last_name_obfuscated", ""),
                        "title":       p.get("title", ""),
                        "company":     org.get("name", ""),
                        "search_city": location,
                        "has_email":   True,
                    }
                    city_count += 1

                log(f"  page {page}: {len(people)} results, {city_count} unique with email so far")

                # Apollo caps at 500 pages × 100 = 50,000 but we stop earlier
                if len(people) < 100 or page >= 10:
                    break

                page += 1
                time.sleep(0.4)

            time.sleep(0.3)

    log(f"\n{'═'*60}")
    log(f"PHASE 1 COMPLETE — {len(all_people)} unique HVAC owners with emails found")
    log(f"{'═'*60}\n")
    return list(all_people.values())


# ── Phase 2: Enrich ───────────────────────────────────────────────────────────

def phase2_enrich(people, max_enrich=1000):
    """Enrich top N people to reveal full name, email, LinkedIn, website."""
    log(f"\n{'═'*60}")
    log(f"PHASE 2 — Enriching top {min(max_enrich, len(people))} contacts (1 credit each)")
    log(f"{'═'*60}")

    to_enrich = people[:max_enrich]
    enriched  = []
    failed    = 0

    for i, person in enumerate(to_enrich):
        pid = person["apollo_id"]
        log(f"[{i+1}/{len(to_enrich)}] Enriching: {person['first_name']} {person['last_name']} @ {person['company']}")

        result = enrich_person(pid)

        if not result:
            log(f"  → no data returned")
            failed += 1
            enriched.append(person)  # keep raw data
            time.sleep(0.5)
            continue

        # Extract all available fields
        org       = result.get("organization") or {}
        linkedin  = result.get("linkedin_url", "") or ""
        email     = result.get("email", "") or ""
        website   = org.get("website_url", "") or ""
        phone     = result.get("phone", "") or org.get("phone", "") or ""
        city      = result.get("city", "") or ""
        state     = result.get("state", "") or ""

        enriched.append({
            "apollo_id":    pid,
            "first_name":   result.get("first_name", person["first_name"]),
            "last_name":    result.get("last_name", ""),
            "title":        result.get("title", person["title"]),
            "email":        email,
            "company":      org.get("name", person["company"]),
            "website":      website,
            "linkedin_url": linkedin,
            "phone":        phone,
            "city":         city,
            "state":        state,
            "email_status": result.get("email_status", ""),
            "source":       "Apollo",
            "tier":         "2",  # Tier 2 — will be Tier 1 if on FB ad list
        })

        status = f"✓ {email}" if email else "✗ no email"
        log(f"  → {status} | {city}, {state}")

        time.sleep(0.35)

    log(f"\nEnrichment done. Failed: {failed}/{len(to_enrich)}")
    return enriched


# ── Save CSV ──────────────────────────────────────────────────────────────────

def save_csv(people, filename="hvac_apollo_leads.csv"):
    fields = [
        "first_name", "last_name", "title", "email", "company",
        "website", "linkedin_url", "phone", "city", "state",
        "email_status", "source", "tier", "apollo_id"
    ]
    with open(filename, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(people)

    with_email = sum(1 for p in people if p.get("email"))
    log(f"\n{'═'*60}")
    log(f"  Saved {len(people)} contacts to {filename}")
    log(f"  With verified email: {with_email}")
    log(f"  Without email:       {len(people) - with_email}")
    log(f"{'═'*60}")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Phase 1: collect all (free)
    all_people = phase1_collect_all()

    # Save raw list before enrichment (safety checkpoint)
    save_csv(all_people, "hvac_raw_no_emails.csv")
    log(f"\nRaw list saved. Starting email enrichment for top {min(1000, len(all_people))}...")

    # Phase 2: enrich top 1,000 (uses credits)
    enriched = phase2_enrich(all_people, max_enrich=1000)

    # Save final list
    save_csv(enriched, "hvac_apollo_leads.csv")
    log("\nDone. Import hvac_apollo_leads.csv into your email tool.")
