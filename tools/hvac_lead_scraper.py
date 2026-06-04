#!/usr/bin/env python3
"""
HVAC Lead Scraper — BookedAI
Pulls HVAC companies currently running Facebook ads + finds their contact info.

Sources:
  1. Meta Ad Library API  → proven Facebook ad spenders (best leads)
  2. Google Maps Places API → all HVAC businesses in target cities (Google ad proxy)

Output: hvac_leads.csv  (Company, City, State, Email, Phone, Website, FB Page, Source)

Setup (5 min):
  1. Get Meta token   → see README section below
  2. Get Hunter key   → hunter.io/users/sign_up (free, 25/month)
  3. Get Google key   → console.cloud.google.com → Enable Places API (optional)
  4. pip3 install requests
  5. python3 hvac_lead_scraper.py
"""

import requests
import csv
import time
import json
import os
from urllib.parse import urlparse

# ─── CONFIG ─────────────────────────────────────────────────────────────────
META_ACCESS_TOKEN = os.environ.get("META_ACCESS_TOKEN", "")   # required
HUNTER_API_KEY    = os.environ.get("HUNTER_API_KEY", "")      # optional but recommended
GOOGLE_PLACES_KEY = os.environ.get("GOOGLE_PLACES_KEY", "")   # optional

# Search terms — cast wide, dedup happens automatically
SEARCH_TERMS = [
    "HVAC",
    "HVAC repair",
    "air conditioning repair",
    "AC installation",
    "heating cooling contractor",
    "furnace repair",
    "heat pump installation",
]

# Target metros — hot climates = peak AC season pain
TARGET_CITIES = [
    "Phoenix, AZ",
    "Houston, TX",
    "Dallas, TX",
    "Miami, FL",
    "Atlanta, GA",
    "Las Vegas, NV",
    "Orlando, FL",
    "San Antonio, TX",
    "Austin, TX",
    "Tampa, FL",
    "Charlotte, NC",
    "Nashville, TN",
    "Jacksonville, FL",
    "Denver, CO",
    "Riverside, CA",
]

# Google Maps lat/lng centers for target cities (for Places API)
CITY_COORDS = {
    "Phoenix, AZ":       (33.4484, -112.0740),
    "Houston, TX":       (29.7604, -95.3698),
    "Dallas, TX":        (32.7767, -96.7970),
    "Miami, FL":         (25.7617, -80.1918),
    "Atlanta, GA":       (33.7490, -84.3880),
    "Las Vegas, NV":     (36.1699, -115.1398),
    "Orlando, FL":       (28.5383, -81.3792),
    "San Antonio, TX":   (29.4241, -98.4936),
    "Austin, TX":        (30.2672, -97.7431),
    "Tampa, FL":         (27.9506, -82.4572),
    "Charlotte, NC":     (35.2271, -80.8431),
    "Nashville, TN":     (36.1627, -86.7816),
    "Jacksonville, FL":  (30.3322, -81.6557),
    "Denver, CO":        (39.7392, -104.9903),
    "Riverside, CA":     (33.9533, -117.3962),
}
# ────────────────────────────────────────────────────────────────────────────


def log(msg):
    print(msg, flush=True)


# ── Source 1: Meta Ad Library ────────────────────────────────────────────────

def fetch_meta_ads(search_term, limit=500):
    """Return dict of {page_id: {page_name, ad_running_since}} for active US ads."""
    if not META_ACCESS_TOKEN:
        log("  [skip] META_ACCESS_TOKEN not set")
        return {}

    url = "https://graph.facebook.com/v19.0/ads_archive"
    params = {
        "access_token": META_ACCESS_TOKEN,
        "search_terms": search_term,
        "ad_type": "ALL",
        "ad_reached_countries": '["US"]',
        "ad_active_status": "ACTIVE",
        "fields": "page_name,page_id,ad_delivery_start_time",
        "limit": min(limit, 100),
    }

    advertisers = {}
    fetched = 0

    while fetched < limit:
        try:
            resp = requests.get(url, params=params, timeout=15)
            data = resp.json()
        except Exception as e:
            log(f"  [error] Meta API request failed: {e}")
            break

        if "error" in data:
            log(f"  [error] Meta API: {data['error'].get('message', data['error'])}")
            break

        for ad in data.get("data", []):
            pid = ad.get("page_id")
            if pid and pid not in advertisers:
                advertisers[pid] = {
                    "page_name": ad.get("page_name", ""),
                    "page_id": pid,
                    "ad_running_since": (ad.get("ad_delivery_start_time") or "")[:10],
                    "source": "Facebook Ads",
                }
                fetched += 1

        next_url = data.get("paging", {}).get("next")
        if not next_url or fetched >= limit:
            break
        url = next_url
        params = {}
        time.sleep(0.4)

    return advertisers


def fetch_page_contacts(page_id):
    """Fetch website, email, phone, city from a Facebook page."""
    url = f"https://graph.facebook.com/v19.0/{page_id}"
    params = {
        "access_token": META_ACCESS_TOKEN,
        "fields": "website,emails,phone,location,category_list",
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if "error" in data:
            return {}
        return {
            "website": (data.get("website") or "").strip(),
            "fb_email": ", ".join(data.get("emails") or []),
            "phone": (data.get("phone") or "").strip(),
            "city": (data.get("location") or {}).get("city", ""),
            "state": (data.get("location") or {}).get("state", ""),
        }
    except Exception:
        return {}


# ── Source 2: Google Maps Places API ────────────────────────────────────────

def fetch_google_places(city, lat, lng, radius_m=25000, keyword="HVAC contractor"):
    """Return list of HVAC businesses from Google Maps Places API."""
    if not GOOGLE_PLACES_KEY:
        return []

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "key": GOOGLE_PLACES_KEY,
        "location": f"{lat},{lng}",
        "radius": radius_m,
        "keyword": keyword,
        "type": "electrician",   # closest available type; keyword does the real filtering
    }

    businesses = []
    while True:
        try:
            resp = requests.get(url, params=params, timeout=15)
            data = resp.json()
        except Exception as e:
            log(f"  [error] Google Places: {e}")
            break

        for place in data.get("results", []):
            businesses.append({
                "name": place.get("name", ""),
                "place_id": place.get("place_id", ""),
                "city": city.split(",")[0],
                "state": city.split(",")[1].strip() if "," in city else "",
                "google_rating": place.get("rating", ""),
            })

        next_token = data.get("next_page_token")
        if not next_token:
            break
        time.sleep(2)
        params = {"key": GOOGLE_PLACES_KEY, "pagetoken": next_token}

    return businesses


def fetch_place_details(place_id):
    """Get website and phone for a Google Place."""
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "key": GOOGLE_PLACES_KEY,
        "place_id": place_id,
        "fields": "website,formatted_phone_number,name",
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json().get("result", {})
        return {
            "website": (data.get("website") or "").strip(),
            "phone": (data.get("formatted_phone_number") or "").strip(),
        }
    except Exception:
        return {}


# ── Email Finder (Hunter.io) ─────────────────────────────────────────────────

def find_email(website):
    """Find a contact email for a domain using Hunter.io free API."""
    if not HUNTER_API_KEY or not website:
        return ""

    domain = urlparse(website).netloc or website
    domain = domain.replace("www.", "").split("/")[0].strip()
    if not domain or "." not in domain:
        return ""

    url = "https://api.hunter.io/v2/domain-search"
    params = {
        "domain": domain,
        "api_key": HUNTER_API_KEY,
        "limit": 1,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        emails = resp.json().get("data", {}).get("emails", [])
        if emails:
            return emails[0].get("value", "")
    except Exception:
        pass
    return ""


# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    all_leads = {}   # keyed by (company_name.lower, city) to dedup

    # ── Step 1: Meta Ad Library ──────────────────────────────────────────────
    if META_ACCESS_TOKEN:
        log("\n── Meta Ad Library (Facebook Ad Runners) ──────────────────────")
        raw_advertisers = {}

        for term in SEARCH_TERMS:
            log(f"  Searching: '{term}'...")
            ads = fetch_meta_ads(term, limit=300)
            raw_advertisers.update(ads)
            time.sleep(0.8)

        log(f"\n  Found {len(raw_advertisers)} unique Facebook advertisers. Fetching contact info...")

        for i, (page_id, advertiser) in enumerate(raw_advertisers.items()):
            name = advertiser["page_name"]
            log(f"  [{i+1}/{len(raw_advertisers)}] {name}")

            contact = fetch_page_contacts(page_id)
            time.sleep(0.3)

            email = contact.get("fb_email", "")
            if not email and contact.get("website"):
                email = find_email(contact["website"])
                time.sleep(0.4)

            city = contact.get("city", "")
            state = contact.get("state", "")
            key = (name.lower().strip(), city.lower())

            all_leads[key] = {
                "Company":          name,
                "City":             city,
                "State":            state,
                "Email":            email,
                "Phone":            contact.get("phone", ""),
                "Website":          contact.get("website", ""),
                "Facebook Page":    f"https://www.facebook.com/{page_id}",
                "Ad Running Since": advertiser.get("ad_running_since", ""),
                "Source":           "Facebook Ads",
                "Google Rating":    "",
            }
    else:
        log("\n[!] META_ACCESS_TOKEN not set — skipping Meta Ad Library")
        log("    Get one free at: https://developers.facebook.com/tools/explorer/")

    # ── Step 2: Google Maps ──────────────────────────────────────────────────
    if GOOGLE_PLACES_KEY:
        log("\n── Google Maps Places (HVAC Businesses in Target Cities) ───────")
        gm_keywords = ["HVAC contractor", "air conditioning repair", "heating cooling"]

        for city, (lat, lng) in CITY_COORDS.items():
            for kw in gm_keywords:
                log(f"  {city}: '{kw}'...")
                places = fetch_google_places(city, lat, lng, keyword=kw)

                for place in places:
                    name = place["name"]
                    details = fetch_place_details(place["place_id"])
                    time.sleep(0.3)

                    email = find_email(details.get("website", "")) if details.get("website") else ""
                    if email:
                        time.sleep(0.4)

                    key = (name.lower().strip(), place["city"].lower())
                    if key not in all_leads:
                        all_leads[key] = {
                            "Company":          name,
                            "City":             place["city"],
                            "State":            place["state"],
                            "Email":            email,
                            "Phone":            details.get("phone", ""),
                            "Website":          details.get("website", ""),
                            "Facebook Page":    "",
                            "Ad Running Since": "",
                            "Source":           "Google Maps",
                            "Google Rating":    str(place.get("google_rating", "")),
                        }
    else:
        log("\n[!] GOOGLE_PLACES_KEY not set — skipping Google Maps")
        log("    Optional: console.cloud.google.com → Enable Places API")

    # ── Step 3: Write CSV ─────────────────────────────────────────────────────
    results = list(all_leads.values())
    results.sort(key=lambda r: (r["Source"], r["State"], r["City"], r["Company"]))

    output = "hvac_leads.csv"
    fields = ["Company", "City", "State", "Email", "Phone",
              "Website", "Facebook Page", "Ad Running Since", "Source", "Google Rating"]

    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(results)

    with_email = sum(1 for r in results if r["Email"])
    fb_leads   = sum(1 for r in results if r["Source"] == "Facebook Ads")
    gm_leads   = sum(1 for r in results if r["Source"] == "Google Maps")

    log(f"""
═══════════════════════════════════════════════
  Done! Results saved to: {output}
═══════════════════════════════════════════════
  Total companies:         {len(results)}
  Facebook ad runners:     {fb_leads}
  Google Maps businesses:  {gm_leads}
  Companies with email:    {with_email}  ({int(with_email/max(len(results),1)*100)}%)
  Companies without email: {len(results) - with_email}
═══════════════════════════════════════════════
  Next: import hvac_leads.csv into your email
  tool (Instantly, Lemlist, or Gmail) and start
  sending the cold email sequence.
""")


if __name__ == "__main__":
    run()
