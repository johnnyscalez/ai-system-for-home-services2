# Lettergrowth Platform Reference

## Overview

Lettergrowth is a free directory of 1,300+ newsletters open to cross-promotion partnerships. Search by category, subscriber count, or recency. Built on Glide (no-code), acquired by The Wisdom Group. No API, no paid tiers — purely a discovery tool for manual outreach.

## Capabilities & automation surface

| Capability | Access |
|---|---|
| Browse newsletter directory | UI-only (app.lettergrowth.com) |
| Search by category/subscribers/recency | UI-only |
| Create a newsletter profile | UI-only (email PIN auth) |
| Message potential partners | Manual (email/DM outside platform) |
| Track swap performance | Not available — use UTM tags manually |
| API / webhooks / Zapier / Make | None |

**No public API.** Lettergrowth is a Glide-powered web app with Firebase backend. There is no programmatic interface. All interaction is through the web UI.

## How Lettergrowth works

1. **Sign up** at app.lettergrowth.com (free, email-based auth)
2. **Create your profile**: Newsletter name, description, subscriber count, niche/category, what your ideal cross-promotion partner looks like
3. **Browse the directory**: Filter by category, subscriber count, or recently added
4. **Reach out**: Contact interesting newsletters directly (email, Twitter DM, LinkedIn) — Lettergrowth surfaces the connection, you handle outreach
5. **Arrange the swap**: Agree on format (shoutout, takeover, co-created content), timing, and tracking

## Profile optimization

Your Lettergrowth profile is your pitch to potential partners. Optimize it:

- **Newsletter description**: Lead with what readers get, not what you publish. "Weekly teardowns of SaaS pricing pages with conversion data" beats "A newsletter about SaaS."
- **Subscriber count**: Be honest. Partners will verify via open rates. Inflating leads to bad matches.
- **Ideal partner**: Be specific. "Looking for newsletters about no-code tools, indie hacking, or bootstrapping with 1K–5K subscribers" gets more relevant matches than "Open to all niches."
- **Category**: Pick the most specific category available. Broad categories get lost.

## Cross-promotion formats

| Format | Effort | Best for | Expected conversion |
|---|---|---|---|
| **Mutual shoutout** | Low | Quick test of audience fit | 0.5–2% of partner's opens |
| **Dedicated recommendation** | Medium | Proven partners | 2–5% of partner's opens |
| **Newsletter takeover** | High | Deep audience overlap | 3–8% of partner's opens |
| **Co-created content** | High | Adjacent niches | Variable |
| **Competition/giveaway** | Medium | Engagement boost | High signups, lower retention |

## Partner evaluation checklist

Before committing to a swap, verify:

1. **Open rate**: Ask directly. Below 25% means low engagement — your recommendation won't be seen.
2. **List size ratio**: Stay within 0.5x–2x your own size. A 500-sub newsletter swapping with a 50K-sub one gets little value from the trade.
3. **Niche adjacency**: Adjacent niches (indie SaaS ↔ no-code) outperform same-niche (indie SaaS ↔ indie SaaS). Adjacent expands reach; same-niche cannibalizes.
4. **Recent activity**: Check their archive. If they haven't sent in 2+ weeks, they may be inactive.
5. **Audience geography**: If your content or sponsors are US-focused, confirm the partner's audience isn't primarily non-US.

## Outreach template

```
Subject: Cross-promotion swap — [Your Newsletter] x [Their Newsletter]

Hi [Name],

I found your newsletter on Lettergrowth and read your recent issue
on [specific topic]. Great breakdown — especially [specific detail].

I write [Your Newsletter] for [audience] — [subscriber count] subscribers,
[open rate]% open rate. I think our audiences overlap well because
[specific reason].

Would you be open to a mutual shoutout swap? I'd recommend your
newsletter in my next issue, and you'd do the same.

Happy to share my media kit or a sample recommendation blurb.

[Your name]
```

## Tracking cross-promotions

Lettergrowth has no built-in analytics. Track manually:

1. **UTM parameters**: Add `?utm_source=lettergrowth&utm_medium=crosspromo&utm_campaign={partner_name}` to your signup link
2. **Unique landing page**: Create a partner-specific landing page (e.g., yoursite.com/welcome-from-partnername) for cleaner attribution
3. **30-day retention**: Tag swap-sourced subscribers in your ESP. Check 30-day open rate. If <15%, the audience fit was poor.
4. **Conversion rate**: Track signups from each partner. Benchmark: 1-5% of partner's open count is good.

## Comparison with alternatives

| Tool | Type | Cost | Scale | Best for |
|---|---|---|---|---|
| **Lettergrowth** | Directory | Free | Manual, 1,300+ newsletters | Finding swap partners manually, any ESP |
| **Collab Match** | Directory | Free | Manual, 200+ newsletters | Smaller alternative to Lettergrowth |
| **Beehiiv Boosts** | Paid recommendation | $1–$3/sub acquired | Automated, Beehiiv-only | Beehiiv users wanting automated growth |
| **Kit Creator Recs** | Recommendation network | Free–$5/sub | Automated, Kit-only | Kit users wanting cross-promotion |
| **SparkLoop** | Referral + recommendations | $2K/yr–$2K/mo | Automated, 25+ ESPs | Serious newsletter operators at scale |
| **Substack Recs** | Recommendation network | Free | Automated, Substack-only | Substack users wanting network growth |
| **Refind Ads** | Paid acquisition | CPA ($1.91 avg/click) | Automated, 100+ newsletters | Paying for high-quality subscribers |
| **Reletter** | Newsletter search engine | Free–$49/mo | 7M+ newsletters, API | Finding newsletters to pitch for partnerships |

**When to use Lettergrowth vs alternatives:**
- **Under 1K subs**: Lettergrowth or Collab Match (free, manual)
- **1K–5K subs**: Lettergrowth + built-in ESP recommendations (Kit, Beehiiv, Substack)
- **5K–10K subs**: Add SparkLoop paid recommendations
- **10K+ subs**: Transition primarily to SparkLoop/Beehiiv Boosts — manual swaps don't scale

## Pricing

**Free.** No paid tiers, no premium features, no transaction fees. The platform monetized through newsletter sponsorships to its user base, not through subscription fees.

## Current status

Lettergrowth was founded by Paul Metcalfe, built in approximately one week using Glide, and grew to 700+ newsletters (6.5M combined subscribers) in under 6 months. It was acquired by The Wisdom Group in a five-figure deal. The buyer plans to expand cross-promotion services to podcasts and other media. Current feature set and activity level may have changed post-acquisition — verify at app.lettergrowth.com.
