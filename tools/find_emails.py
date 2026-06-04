#!/usr/bin/env python3
"""
Email Finder — BookedAI
Finds contact emails for HVAC companies from multiple input sources.

Usage:
  1. Paste company websites into WEBSITES list below
     OR point OUTSCRAPER_CSV to your Outscraper export
  2. Set your HUNTER_API_KEY (free at hunter.io — 25/month free, $49/mo for 1,000)
  3. python3 find_emails.py
  4. Results saved to found_emails.csv

Get your input list from:
  - Outscraper.com Google Maps export (best — $3 per 1,000 results)
  - Manual Meta Ad Library website (facebook.com/ads/library)
  - Apollo.io export
"""

import requests
import csv
import time
from urllib.parse import urlparse

# ─── CONFIG ─────────────────────────────────────────────────────────────────
HUNTER_API_KEY   = ""   # Get free at hunter.io/users/sign_up

# Option A: Point to an Outscraper CSV export
# Download from outscraper.com after your Google Maps scrape
OUTSCRAPER_CSV   = ""   # e.g. "outscraper_hvac_phoenix.csv"

# Option B: Paste websites manually (from facebook.com/ads/library or anywhere)
WEBSITES = [
    # "https://www.example-hvac.com",
    # "coolairphoenix.com",
]

# Option C: Paste company names (script will try to find their website)
COMPANY_NAMES = [
    # "Phoenix HVAC Solutions",
    # "Cool Air Experts Houston",
]
# ────────────────────────────────────────────────────────────────────────────


def clean_domain(website):
    if not website:
        return ""
    if "://" not in website:
        website = "https://" + website
    parsed = urlparse(website)
    domain = parsed.netloc.replace("www.", "").strip()
    return domain


def find_email_hunter(domain):
    """Find email for domain using Hunter.io"""
    if not HUNTER_API_KEY or not domain:
        return "", ""

    url = "https://api.hunter.io/v2/domain-search"
    params = {
        "domain": domain,
        "api_key": HUNTER_API_KEY,
        "limit": 3,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json().get("data", {})
        emails = data.get("emails", [])
        org = data.get("organization", "")
        if emails:
            best = emails[0]
            return best.get("value", ""), org
    except Exception as e:
        print(f"  Hunter error for {domain}: {e}")
    return "", ""


def scrape_contact_page(website):
    """Try to find email on the company's contact page directly."""
    import re
    if not website:
        return ""
    try:
        if "://" not in website:
            website = "https://" + website
        headers = {"User-Agent": "Mozilla/5.0 (compatible; research)"}
        resp = requests.get(website + "/contact", headers=headers, timeout=8)
        emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", resp.text)
        # Filter out common false positives
        filtered = [e for e in emails if not any(x in e.lower() for x in
                    ["example", "domain", "email", "user", "test", "noreply", "no-reply", "support@sentry"])]
        if filtered:
            return filtered[0]
    except Exception:
        pass
    return ""


def google_find_website(company_name):
    """Simple Google search to find company website (uses SerpAPI if key set)."""
    # Without SerpAPI, return empty — manual fallback
    return ""


def load_outscraper_csv(path):
    """Load companies from an Outscraper Google Maps CSV export."""
    import os
    if not path or not os.path.exists(path):
        return []
    results = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Outscraper column names vary slightly — handle both formats
            website = (row.get("site") or row.get("website") or row.get("Website") or "").strip()
            name    = (row.get("name") or row.get("Name") or row.get("title") or "").strip()
            phone   = (row.get("phone") or row.get("Phone") or "").strip()
            city    = (row.get("city") or row.get("City") or "").strip()
            state   = (row.get("state") or row.get("State") or "").strip()
            if name or website:
                results.append({"website": website, "name": name, "phone": phone,
                                 "city": city, "state": state})
    print(f"  Loaded {len(results)} companies from Outscraper CSV")
    return results


def main():
    if not HUNTER_API_KEY:
        print("⚠️  No Hunter API key set. Email discovery will use website scraping only.")
        print("   Get a free key at: hunter.io/users/sign_up\n")

    results = []

    # Build input list from all sources
    all_inputs = []

    # Source 1: Outscraper CSV
    if OUTSCRAPER_CSV:
        all_inputs.extend(load_outscraper_csv(OUTSCRAPER_CSV))

    # Source 2: Manual websites
    for w in WEBSITES:
        all_inputs.append({"website": w, "name": "", "phone": "", "city": "", "state": ""})

    # Source 3: Company names
    for n in COMPANY_NAMES:
        all_inputs.append({"website": "", "name": n, "phone": "", "city": "", "state": ""})

    if not all_inputs:
        print("No websites or company names provided.")
        print("Add websites to the WEBSITES list in find_emails.py and run again.")
        return

    print(f"Processing {len(all_inputs)} companies...\n")

    for i, item in enumerate(all_inputs):
        website = item["website"]
        name = item["name"]

        if not website and name:
            website = google_find_website(name)

        website = item.get("website", "")
        name    = item.get("name", "")
        phone   = item.get("phone", "")
        city    = item.get("city", "")
        state   = item.get("state", "")

        domain = clean_domain(website)
        label  = name or domain or website

        print(f"[{i+1}/{len(all_inputs)}] {label} ({city}, {state})")

        email = ""
        org   = ""

        # Try Hunter first (best quality)
        if domain and HUNTER_API_KEY:
            email, org = find_email_hunter(domain)
            time.sleep(0.5)

        # Fallback: scrape contact page
        if not email and website:
            print(f"  Hunter empty — trying contact page scrape...")
            email = scrape_contact_page(website)

        status = f"✓ {email}" if email else "✗ not found"
        print(f"  {status}")

        results.append({
            "Company":   org or name or domain,
            "City":      city,
            "State":     state,
            "Website":   website,
            "Domain":    domain,
            "Email":     email,
            "Phone":     phone,
            "Found Via": "Hunter" if (email and HUNTER_API_KEY) else ("Scrape" if email else ""),
        })

    # Write CSV
    output = "found_emails.csv"
    fields = ["Company", "City", "State", "Email", "Phone", "Website", "Domain", "Found Via"]

    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(results)

    found = sum(1 for r in results if r["Email"])
    print(f"""
═══════════════════════════════════════════
  Done! Saved to: {output}
  Total:          {len(results)}
  Emails found:   {found} ({int(found/max(len(results),1)*100)}%)
  Not found:      {len(results) - found}
═══════════════════════════════════════════
""")


if __name__ == "__main__":
    main()
