---
name: sales-refind
description: "Refind platform help — CPA-based newsletter ad network with 488K curated-content readers for growing your subscriber list or earning by promoting other newsletters. Use when Refind ads aren't generating enough subscribers for the cost, eCPA is too high and you're not sure how to optimize your bid, wondering whether Refind or SparkLoop or Paved is the better newsletter growth channel, setting up Refind cross-promotion for free reciprocal growth, or trying to earn money by promoting other newsletters through Refind. Do NOT use for general newsletter monetization strategy (use /sales-newsletter), audience growth strategy across all channels (use /sales-audience-growth), or paid recommendation networks like SparkLoop (use /sales-sparkloop)."
argument-hint: "[describe your Refind question — ads, growth, earning, or cross-promotion]"
license: MIT
version: 1.0.0
tags: [sales, newsletter, audience-growth, advertising, platform]
---

# Refind Platform Help

## Step 1 — Gather context

If `references/learnings.md` exists, read it first for accumulated platform knowledge.

Ask the user:

1. **What are you trying to do with Refind?**
   - A) Grow my newsletter subscriber list using Refind Ads
   - B) Earn money by promoting other newsletters on Refind
   - C) Set up free cross-promotion with other newsletters
   - D) Compare Refind to alternatives (SparkLoop, Paved, Beehiiv Boosts)

2. **Newsletter metrics** (helps calibrate advice):
   - Subscriber count (approximate)
   - Niche / topic
   - Open rate

Skip-ahead rule: if the user's prompt already contains enough context, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| General audience growth strategy | `/sales-audience-growth [question]` |
| Newsletter monetization / sponsorships | `/sales-newsletter [question]` |
| SparkLoop referral or paid recommendations | `/sales-sparkloop [question]` |
| Beehiiv Boosts or Beehiiv Ad Network | `/sales-beehiiv [question]` |
| Email deliverability after adding subscribers | `/sales-deliverability [question]` |
| Finding swap partners via a directory | `/sales-lettergrowth [question]` |

When routing to another skill, provide the exact command.

## Step 3 — Refind platform reference

**Read `references/platform-guide.md`** for the full platform reference — how Refind Ads work, CPA optimization, cross-promotion setup, earning as a publisher, and comparison with alternatives.

Answer the user's question using only the relevant section. Don't dump the full reference.

## Step 4 — Actionable guidance

Refind success depends on niche fit, CPA calibration, and subscriber quality tracking.

1. **Niche fit**: Refind's 488K audience skews tech, data science, and B2C curiosity. If your newsletter is B2B enterprise or hyper-niche, expect lower conversion.
2. **CPA calibration**: Start at the minimum bid ($1.50) and increase gradually. Track 30-day open rates of Refind-sourced subscribers before scaling budget.
3. **Quality tracking**: Tag Refind subscribers with UTM parameters. Compare their 30-day and 60-day retention to your organic subscribers.
4. **Earning side**: If you have an engaged audience in tech/knowledge topics, the publisher side ($1.91/click avg) can offset your growth costs.

If you discover a gotcha or tip not covered in `references/learnings.md`, append it there.

## Gotchas

> *Best-effort from research — review these, especially items about pricing and engagement quality.*

1. **No subscriber quality screening** — unlike SparkLoop, Refind doesn't filter by engagement history before sending subscribers. You only pay for ~41% (those who open), but the other 59% still hit your list and inflate ESP costs.
2. **High eCPAs for non-tech niches** — one experiment reported $20/subscriber. Refind works best for B2C tech/data/knowledge newsletters. Lifestyle, finance, or B2B niches may see poor ROI.
3. **Low daily volume** — expect "a few subscribers a day," not hundreds. Refind is a slow-drip channel, not a scale tool.
4. **No API or automation** — no public API (developers page 404), no webhooks, no Zapier/Make. Only integration is Beehiiv API sync for engagement tracking.
5. **Cross-promotion is visitor-based, not subscriber-based** — Refind matches unique visitors, not verified subscribers. Conversion from visit to subscribe depends on your landing page.

## Related skills

- `/sales-audience-growth` — Growing your email list (lead magnets, cross-promotion strategy, referral programs, paid acquisition)
- `/sales-newsletter` — Newsletter monetization (sponsorships, paid subscriptions, ad sales, paid recommendations)
- `/sales-sparkloop` — SparkLoop platform help (referral programs, paid recommendations, partner programs)
- `/sales-beehiiv` — Beehiiv platform help (Boosts for paid cross-promotion, Ad Network)
- `/sales-lettergrowth` — Lettergrowth platform help (free cross-promotion directory, partner discovery)
- `/sales-paved` — Paved platform help (newsletter sponsorship marketplace, Ad Network)
- `/sales-email-marketing` — Email marketing strategy (what to send once you have subscribers)
- `/sales-deliverability` — Email deliverability (keeping Refind-sourced subscribers out of spam)
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do`

## Examples

### Example 1: High eCPA troubleshooting
**User says**: "I'm spending $15 per subscriber on Refind Ads and it doesn't seem worth it"
**Skill does**: Reads platform-guide.md, checks niche fit (Refind audience is tech/curiosity), recommends lowering CPA bid to minimum ($1.50), checking 30-day retention, and comparing to SparkLoop paid recommendations which offer better targeting
**Result**: User either optimizes their Refind campaign or switches to a better-fit channel

### Example 2: Setting up cross-promotion
**User says**: "How does Refind cross-promotion work? Is it free?"
**Skill does**: Explains the reciprocal visitor exchange model, walks through setup, notes that visits aren't guaranteed subscribers, recommends pairing with a strong landing page
**Result**: User understands how to use Refind cross-promotion alongside their existing growth channels

### Example 3: Earning as a publisher
**User says**: "Can I make money promoting other newsletters through Refind?"
**Skill does**: Explains the publisher earning model ($1.91/click avg), recommends it for tech-adjacent newsletters with engaged audiences, notes it works on autopilot once set up
**Result**: User knows expected earnings and whether their audience is a fit

## Troubleshooting

### Refind subscribers aren't opening emails
**Symptom**: Open rate of Refind-sourced subscribers is well below list average
**Cause**: Refind only charges for ~41% who open, but the rest still join your list. Your ESP may count all of them, dragging down open rate.
**Solution**: Tag all Refind subscribers with a UTM source tag. Create a segment for Refind-sourced subscribers and monitor separately. Sunset non-openers after 30 days to keep list healthy.

### eCPA much higher than expected
**Symptom**: Paying $10-20+ per subscriber when you expected $2-5
**Cause**: Newsletter niche doesn't match Refind's tech/curiosity audience, or CPA bid is too high
**Solution**: Check niche alignment — Refind works best for tech, data science, and general knowledge newsletters. Lower your CPA bid to minimum ($1.50) and test for 2 weeks. If eCPA stays above $5 with good niche fit, consider SparkLoop or Beehiiv Boosts instead.

### Cross-promotion sending visitors but no subscribers
**Symptom**: Refind cross-promotion shows visits but your subscriber count barely moves
**Cause**: Refind sends visitors to your signup page, but conversion depends on your landing page quality
**Solution**: Optimize your landing page — clear value prop, single CTA, social proof. Test the landing page URL Refind is sending traffic to. Consider offering a lead magnet to boost conversion.
