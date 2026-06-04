---
name: sales-field-sales
description: "Hyperlocal field-sales strategy — door-to-door / territory / route-based outbound to cash-heavy local SMB owners (restaurants, gas stations, convenience stores, salons, gyms, contractors, HVAC, lawn care) who ignore email cadences and aren't on database providers like Apollo or ZoomInfo. Covers corridor and territory target-list building from local sources (Google Maps Places API, Yelp Fusion, Foursquare, Outscraper, Phantombuster local-business scrapers — NOT Apollo), route planning and density optimization, in-person pitch frameworks for 60-second clerk encounters, objection handling for cash-heavy owners, non-email follow-up via SMS/handwritten note/phone, and platform selection across SalesRabbit, Spotio, Map My Customers, Badger Maps, Outfield, Repsly, Skynamo, and Geopointe. Use when planning a single-corridor pilot before multi-city expansion, can't find local SMBs on Apollo or ZoomInfo, an email cadence isn't getting replies from restaurant or gas-station owners, deciding which field-sales platform to pick for a small rep team, designing a 60-second clerk pitch, or following up on an in-person 'maybe' without an email sequence. Do NOT use for database-driven B2B SaaS prospect lists (use /sales-prospect-list) or digital email/LinkedIn cadences (use /sales-cadence)."
argument-hint: "[describe your field-sales / door-to-door / territory question]"
license: MIT
version: 1.0.0
tags: [sales, outbound, field-sales, territory, smb]
---

# Hyperlocal Field-Sales Strategy

This skill is tool-agnostic. It covers how to plan, target, pitch, and follow up on door-to-door / territory / route-based outbound to cash-heavy local SMBs — the kind that don't show up in Apollo and don't reply to cold email.

## Step 1 — Gather context

If `references/learnings.md` exists, read it first.

1. **What's the motion?**
   - A) Single-corridor pilot (one street, one neighborhood)
   - B) Multi-corridor in one city
   - C) Multi-city / multi-rep expansion
   - D) Just building the first target list

2. **What's the SMB vertical?** (restaurants, gas stations, convenience stores, salons, gyms, contractors, HVAC, lawn care, mobile detailing, courier — drives the right pitch and objection framework)

3. **What's the local-data source you've tried?** (Google Maps, Yelp, Foursquare, an LLM, paid scrapers, or nothing yet)

4. **Are you the founder doing the canvassing yourself, or building a rep team?** (drives platform selection)

Skip-ahead rule: if the user's prompt already has these details, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Database B2B SaaS prospect lists (Apollo, ZoomInfo, Clay) | `/sales-prospect-list [question]` |
| Digital email / LinkedIn / phone sequences | `/sales-cadence [question]` |
| Reviewing a recorded in-person call for coaching | `/sales-siro [question]` |
| Two-sided marketplace GTM (cold-start sequencing, supply recruiting, flywheel) | `/sales-two-sided-marketplace [question]` |
| Local SEO and Google Business Profile for inbound demand | `/sales-seo [question]` |
| Cold email deliverability (when you also have a digital channel) | `/sales-deliverability [question]` |

If the question is genuinely about field-sales execution, continue to Step 3.

## Step 3 — Field-sales platform reference

**Read `references/platforms.md`** for per-platform notes on SalesRabbit, Spotio, Map My Customers, Badger Maps, Outfield, Repsly, Skynamo, and Geopointe — what each is best at, team-size fit, vertical fit, and the rough pricing band.

Answer using only the relevant platform sections. Don't dump the full file.

## Step 4 — Actionable guidance

The hyperlocal field-sales motion has six pillars. Work them in order on a new pilot.

### 4.1 Corridor / territory target-list building

Cash-heavy SMBs aren't on Apollo. The right data sources are local-business APIs and scrapers.

| Source | What it's for | Cost | Best fit |
|---|---|---|---|
| Google Maps Places API | Authoritative business directory + hours + category | Pay-per-request | Any corridor list |
| Yelp Fusion API | Categories + ratings + photo proof | Free tier, then paid | Restaurant / hospitality |
| Foursquare Places API | Foot traffic + category richer than Google | Free tier | Retail-heavy corridors |
| Outscraper | Google Maps / Yelp / Foursquare scraping at scale | $50-200/mo flat | When API rate limits bite |
| Phantombuster | Generic scraping for niche directories | $69/mo+ | Salon / gym / contractor sites |
| Manual + walk-by audit | Validate the scrape against what's actually open | Time only | First corridor only — always do this once |

**Corridor heuristic:** start with a 10-15 stop walking corridor. Density beats sparseness. A 50-stop sparse city beats nothing, but a 15-stop dense walk converts faster per hour.

### 4.2 Route planning and density optimization

- **Walking corridors** (sub-2 miles) — order stops by side-of-street to minimize crossings; plan 8-15 stops per shift.
- **Drive routes** — cluster by drive-time, not distance. A 15-min drive between two stops kills a 4-hour shift. Use Badger / Map My Customers / Spotio's optimizer.
- **Anchor stops** — start each route at a "known yes" or a friendly current customer. Builds momentum and gives a fresh case study to drop in pitch #2.
- **Time-of-day rules:** restaurant pitches before 11am or 2-4pm; gas stations 10am-noon or 2-4pm; salons mornings on Tue-Thu. Avoid lunch rush and weekend nights.

### 4.3 In-person pitch frameworks (60-second clerk encounter)

Most pitches land with a clerk, not the owner. Optimize for the clerk.

**Hook → Proof → Ask → Leave-behind:**

1. **Hook (5 sec):** one-sentence problem-statement in the owner's language. "I clean bathrooms for restaurants so your team can stop doing it."
2. **Proof (15 sec):** one local example. "[Place down the corridor] uses us 3x/week — saves them about 10 hours of staff time."
3. **Ask (10 sec):** ask the clerk what they need to pass it up. "Is the owner usually here mornings? Or is text easier?"
4. **Leave-behind (10 sec):** a card or one-page sheet. The clerk WILL lose it — that's fine. The point is owner sees it.
5. **Capture (10 sec):** owner name, owner phone if clerk volunteers it, best time to come back. Log immediately.

**The clerk-is-not-the-buyer flip:** if the clerk says "I don't mind cleaning the bathrooms," that's a recruiting signal, not a rejection — but route to `/sales-two-sided-marketplace` for the supply-recruiting layer if you're building a marketplace.

### 4.4 Objection handling for cash-heavy SMB owners

Cash-heavy owners have a fundamentally different objection set than SaaS buyers.

- **"Too expensive":** they're picturing cash out of the drawer today, not annual contract value. Reframe as cash-equivalent: "It's $40/visit, you'd be paying staff $25/hour to do 1.5 hours, so net $2-5/visit."
- **"I don't know you":** trust without a brand. Drop a local proof point — name another customer on the same corridor. If you don't have one, offer the first visit free.
- **"Owner's not here":** never push the clerk past "yes, I'll mention it." Get the best time + phone. The follow-up is the actual pitch.
- **"I'll think about it":** that's a no until proven otherwise. Set a specific next step: "Mind if I swing back Thursday morning?"

### 4.5 Light post-visit follow-up

**Do NOT use email cadences.** Owners don't open email. Use this order:

| Touch | Timing | Channel | Content |
|---|---|---|---|
| 1 | Same day, evening | SMS to owner | "Hey [name], met your clerk [name] today at [place]. Sending the one-pager — let me know if you want to try one visit on us." |
| 2 | Day +4 | Handwritten note dropped at the location | Single sentence + your number. The fact that you came back beats anything you write. |
| 3 | Day +10 | Phone call | "Hey [name], just checking — want to set up that first visit?" |

Stop after 3 touches. If no reply, they're a no for now — circle back in 60-90 days when the corridor matures.

### 4.6 Platform selection

See `references/platforms.md` for full per-platform notes. Quick decision pivot:

- **Solo founder canvassing:** Badger Maps (route opt only, $58/user/mo) or Outfield (canvassing tracking).
- **Small rep team (2-10), HVAC / home services:** SalesRabbit.
- **Rep team (5-20), territory-heavy multichannel:** Spotio.
- **Mobile-first CRM with simpler route planning:** Map My Customers.
- **Retail execution / FMCG (rep visits stores to merchandise):** Repsly.
- **FMCG / distribution with order capture in-shift:** Skynamo.
- **Already on Salesforce:** Geopointe (native).

If you discover something not covered here, append it to `references/learnings.md` with today's date.

## Gotchas

> *Best-effort from research and field experience — verify pricing and feature gates against current vendor pages.*

1. **Treating SMB pitches like SaaS demos kills the close in the first 10 seconds.** Owners don't want a deck. They want to know what it costs and what changes for them. Lead with both.
2. **Email follow-up after an in-person "yes" destroys the deal.** Owners aren't checking email. Switch to SMS or phone the moment the in-person meeting ends.
3. **Single-corridor density beats multi-city sparseness.** Ten doors on one street with a 30% close rate is more revenue than 100 doors across a city with a 3% close rate — and the references compound.
4. **The clerk is not the buyer, but the clerk is the gate.** Win the clerk by being respectful and quick. Lose the clerk and you never see the owner.
5. **Apollo-style lists are a trap.** You'll get marketing-listed franchise corporate HQs, not the actual local owners. Start with Google Maps Places + a walk-by audit.
6. **Field-sales platforms are not CRMs.** Don't try to make Spotio your system of record. Use it for routing + activity tracking and sync into HubSpot or Pipedrive nightly.

## Before recommending a specific platform skill

This skill covers a strategy domain across many platforms. **Before pointing the user to any specific platform skill** (any `/sales-{platform}` listed in `## Related skills`), read that platform skill's actual `SKILL.md` first. The 1-line description in `## Related skills` is enough to *identify* a candidate — not enough to *commit* to it or to write a prompt that invokes it well.

**How to read it:** if `~/.claude/skills/{skill-name}/SKILL.md` exists locally, `Read` it. Otherwise `WebFetch` `https://raw.githubusercontent.com/sales-skills/sales/main/skills/{skill-name}/SKILL.md`.

**After reading,** ground your recommendation in something concrete from the SKILL.md (its scope, an argument-hint shape, or a "Do NOT use for..." clause). If the platform skill turns out to be a poor fit, swap to another or handle the question here directly.

## Related skills

- `/sales-prospect-list` — Database-driven B2B SaaS prospect lists (Apollo, ZoomInfo, Clay) — the digital-channel alternative when targets ARE on databases
- `/sales-cadence` — Digital email / LinkedIn / phone outbound sequences — for prospects who respond to digital
- `/sales-siro` — Field-sales recording and AI call coaching — for reviewing recorded in-person calls after the visit
- `/sales-outscraper` — Google Maps / Yelp / Foursquare scraping — the canonical data source for building corridor target lists
- `/sales-seo` — Local SEO and Google Business Profile — drives inbound demand alongside outbound corridor canvassing
- `/sales-deliverability` — Email deliverability — only relevant if you have a digital channel alongside the field motion
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do -a claude-code`

## Examples

### Example 1: Single-corridor cleaning-services pilot
**User says**: "I run a bathroom-cleaning service for restaurants. How do I pick a corridor and pitch the first 15 stops?"
**Skill does**: Recommends building a Google Maps Places API pull for a 2-mile walking corridor (dense restaurant zone), filters to independent restaurants (skip franchised chains), sequences stops by time-of-day window (before 11am or 2-4pm), provides the 60-second clerk hook → proof → ask → leave-behind structure for restaurants, and the same-day SMS / day-4 handwritten / day-10 phone follow-up cadence. Suggests starting with Badger Maps free trial for routing if going solo.
**Result**: User has a corridor list, a daily route plan, a pitch frame, and a 3-touch follow-up — ready to walk Tuesday morning.

### Example 2: Multi-city HVAC route expansion
**User says**: "We have 6 HVAC field reps now and want to expand from Phoenix to Tucson. Which platform and how should we plan routes?"
**Skill does**: Routes to `references/platforms.md`, surfaces SalesRabbit and Spotio as the leading candidates for a 6-rep HVAC team (SalesRabbit for home-services-native, Spotio for territory-mapping depth), recommends Spotio if multichannel digital is in the mix and SalesRabbit if pure D2D, suggests piloting one corridor in Tucson before full expansion, references the density-over-sparseness rule. Notes pricing in the reference is best-effort.
**Result**: User picks a platform, runs a single-corridor Tucson pilot before committing to multi-territory expansion.

### Example 3: Restaurant-corridor pitch design
**User says**: "I tried walking a restaurant corridor and the clerks all said the owner wasn't there. How do I fix the pitch?"
**Skill does**: Diagnoses the clerk-as-gate problem, gives the Hook → Proof → Ask → Leave-behind structure with the explicit "ask the clerk what they need to pass it up" step, recommends capturing owner name + best time to come back instead of pushing, sets up the same-day SMS to the owner (if the clerk volunteers a phone) or a day-2 return visit with a handwritten note. Reminds the user that email follow-up after a clerk encounter doesn't work.
**Result**: User has a clerk-respecting pitch that converts "owner not here" from a dead end into a captured next-step.

## Troubleshooting

### Clerk says "owner's not here" every time
**Symptom**: Three walks of the corridor, never met an owner
**Cause**: Wrong time-of-day window, or pushing past the clerk's stated limit
**Solution**: For restaurants, switch to 10-11am or 2-4pm windows. For gas stations / C-stores, try 10am-noon. Always end the encounter with "what time tomorrow would I catch [name]?" — the answer is the next visit.

### In-person "yes" ghosting after the visit
**Symptom**: Owner said "sounds good, send me details" — then nothing
**Cause**: You emailed the details. Owners don't open email.
**Solution**: Switch to SMS the moment they say yes. Send a same-day text with a one-line summary and a single CTA: "Want to start with one visit on us this week?" Follow up with a handwritten drop and a phone call per the 3-touch frame.

### Corridor lists from Apollo / ZoomInfo are mostly franchise HQs
**Symptom**: The list is "Subway corporate" not the local Subway owner
**Cause**: Database providers index marketing-listed entities, not local operators
**Solution**: Switch to Google Maps Places API or Outscraper as the corridor source. Do a walk-by audit on the first corridor to verify what's actually open and independent. Skip franchised chains entirely unless the local owner is also the GM.
