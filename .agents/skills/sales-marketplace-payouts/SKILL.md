---
name: sales-marketplace-payouts
description: "Marketplace payouts strategy — selecting and operating the payment infrastructure that pays 1099 supply workers, sellers, drivers, hosts, and creators on a two-sided marketplace. Covers Stripe Connect (Standard / Express / Custom), PayPal Hyperwallet, Adyen for Platforms, Trolley, Tipalti, Branch, and more in the catalog — when to pick each, connected-account vs custodial, KYC / onboarding burden, on-demand-vs-scheduled pay, multi-currency, tax forms (1099-K, 1099-NEC, W-9, W-8), and 1099-misclassification risk. Use when choosing Stripe Connect Standard vs Express vs Custom for a 1099 marketplace, comparing Hyperwallet vs Trolley for multi-country payouts, the supply side churns because payouts arrive too slowly, choosing a per-payout API vs a full marketplace stack, or needing on-demand pay to compete on supply recruiting. Do NOT use for buyer-side checkout or payment collection (use /sales-checkout) or affiliate commission tracking that isn't a marketplace payout (use /sales-affiliate-program)."
argument-hint: "[describe your marketplace payouts question]"
license: MIT
version: 1.0.0
tags: [sales, marketplace, payments, payouts, gig-economy]
---

# Marketplace Payouts Strategy

This skill is tool-agnostic. It covers how to pick and operate the payout-side payment infrastructure for a two-sided marketplace — Stripe Connect, Hyperwallet, Adyen for Platforms, Trolley, Tipalti, Routable, dots.dev, Branch, and others.

## Step 1 — Gather context

If `references/learnings.md` exists, read it first.

1. **Where are you in the marketplace?**
   - A) Pre-launch / first 10 payouts — manual is still ok
   - B) Small scale (10-200 workers, US-only) — picking your first payout API
   - C) Scaling (200-5K workers, possibly multi-state) — picking the system that grows
   - D) Multi-country (any non-US recipients) — multi-currency is now table stakes
   - E) Already on a payout API and considering switching

2. **What's the worker relationship?**
   - 1099 contractor / gig worker (most marketplaces)
   - W-2 employee (Bluecrew-style)
   - Mixed
   - Outside-US recipients (different tax + currency rules)

3. **What's the payout cadence the supply side expects?**
   - Daily / on-demand (gig economy default)
   - Weekly
   - Bi-weekly / monthly (rarer for marketplaces)

4. **What's the marketplace vertical?** (cleaning, courier, food delivery, home services, pet care, creator/seller marketplace, multi-vertical) — drives which platforms fit.

Skip-ahead rule: if the user's prompt already has these details, skip to Step 2.

## Step 2 — Route or answer directly

| If the question is about... | Route to... |
|---|---|
| Buyer-side checkout, cart abandonment, payment collection | `/sales-checkout [question]` |
| Affiliate commissions tracking (NOT marketplace worker payouts) | `/sales-affiliate-program [question]` |
| The marketplace GTM strategy layer (cold-start, supply recruiting) | `/sales-two-sided-marketplace [question]` |
| Door-to-door / field outbound for marketplace demand | `/sales-field-sales [question]` |
| Hourly worker hiring + onboarding (not payouts) | `/sales-two-sided-marketplace [question]` for Workstream coverage |
| Tax filing deep-dive (not selection) | No skill yet — flag as a gap |
| W-2 payroll (not marketplace 1099 payouts) | No skill yet — outside scope |

If the question is genuinely about marketplace payout infrastructure selection or operation, continue to Step 3.

## Step 3 — Payout platform reference

**Read `references/platforms.md`** for per-platform notes on Stripe Connect (Standard / Express / Custom), PayPal Hyperwallet, Adyen for Platforms, Trolley, Tipalti, Routable, dots.dev, Branch, Nium, Wise Business, and Tremendous. Each entry covers what it's best for, marketplace stage fit, fee structure, KYC/onboarding flow, multi-currency reach, 1099-K/1099-NEC handling, and the embedded vs custom UX trade-off.

Answer using only the relevant sections. Don't dump the full file.

## Step 4 — Actionable guidance

The payouts decision has four pillars. Work them in order.

### 4.1 Selection criteria

Pick the platform based on **the dimension that will break first** if you pick wrong:

| Dimension | When it dominates the choice |
|---|---|
| **Onboarding burden** (KYC docs, identity verification, payout-method setup) | If supply churns at the onboarding step. Stripe Express / dots.dev minimize this. |
| **Payout speed** (daily / on-demand vs weekly) | If competing on supply recruiting in a tight labor market. Branch and Stripe Instant Payouts unlock <24hr. |
| **Multi-currency / multi-country** | If ANY worker is outside the US. Wise, Hyperwallet, Trolley, Nium dominate; Stripe Connect is good in 50+ countries but with caveats. |
| **Hold / release for disputes** | If buyer disputes drive chargebacks. Stripe Connect, Adyen handle this natively; per-payout APIs don't. |
| **Tax form generation** (1099-K, 1099-NEC, W-9, W-8) | If you'll cross 1099 thresholds. Trolley, Tipalti, Stripe Connect handle 1099 forms; Wise and Tremendous don't. The 1099-K threshold dropped to $5K starting 2024 — affects more marketplaces than before. |
| **Embedded vs custom UX** | If branded onboarding matters. Stripe Custom + Adyen Custom = full white-label; Stripe Standard = co-branded. |
| **Worker classification risk** | If payment design contributes to misclassification (see 4.4). |

The right answer is usually a stack of 2: a primary payouts layer (Stripe Connect or Adyen for Platforms or Hyperwallet) plus an on-demand pay layer (Branch) bolted on if you need it for supply retention.

### 4.2 Decision matrix by marketplace stage

| Stage | Default pick | Why |
|---|---|---|
| Pre-PMF, <50 payouts/month | Manual via Wise Business / Stripe Standard payouts | Don't build infra you'll throw away |
| Small US-only marketplace, 50-500/mo | **Stripe Connect Express** | Best onboarding/KYC UX, free until you scale, the embedded flow keeps supply on-platform |
| Scaling US-only, 500-5K/mo | **Stripe Connect Express OR Standard** + Branch for on-demand pay if supply churns | Stripe scales, Branch handles the "I need money today" supply objection |
| Multi-country, any volume | **Hyperwallet OR Adyen for Platforms** | Stripe Connect covers most countries but has gaps; Hyperwallet built for this |
| Mass payouts with tax handling | **Trolley** | Multi-currency mass payouts + 1099 / W-9 / W-8 generation is its core product |
| AP-style approvals + payouts | **Tipalti** | If payouts go through approval chains (creator marketplaces, vendor marketplaces) |
| Embedded gig-specific SDK | **dots.dev** | If you want a payout SDK purpose-built for gig platforms — fewer features but tighter fit |
| Rewards / gift cards as payout option | **Tremendous** | If supply has a choice between cash and gift cards |

### 4.3 Integration patterns

**Connected-account model** (Stripe Connect, Adyen for Platforms):
- The supply worker has their own account inside your platform's account hierarchy
- KYC happens at account creation, not per payout
- You can hold funds, dispute, refund, and have full visibility
- Best for: most US marketplaces with ongoing relationships

**Custodial / mass-payout model** (Trolley, Routable, Hyperwallet partial mode):
- You hold the money; you send batch payouts to a list of recipients
- Simpler integration; less compliance overhead per worker
- Best for: high-volume one-off-ish payouts, multi-currency, tax-form-heavy use cases

**On-demand pay overlay** (Branch):
- Sits ALONGSIDE your primary payout API
- Workers can advance earned-but-not-yet-paid wages
- Reduces supply churn in tight labor markets

**Webhook handling** — every payout API has events; the critical ones are:
- `payout.created`, `payout.paid`, `payout.failed`
- `account.updated` (KYC status change)
- `transfer.failed` / `payout.canceled`
- Always handle idempotently; payment retries are real.

### 4.4 Compliance and worker classification risk

**The single biggest gotcha** in marketplace payouts isn't picking the wrong API — it's that **how you pay workers becomes evidence in a 1099 misclassification suit**.

The ABC test (used in California and many states) asks:
- A: Is the worker free from your control? (If you set the schedule, you fail A.)
- B: Is the work outside your usual business? (If you're a cleaning marketplace and they clean for you, you usually fail B.)
- C: Does the worker have an independent trade? (Most gig workers fail C.)

Payment-design factors that worsen the classification picture:
- Hourly pay (vs per-job)
- Mandatory pay rates (vs worker-set)
- Payment timing you control fully (vs they can withdraw on demand)
- No 1099-NEC issued (so it looks like W-2)

Payment-design factors that improve it:
- Per-completed-job payments
- Worker chooses their own rate (or accepts/rejects offered rate)
- Worker controls payout timing (Branch / Stripe Instant Payouts)
- Clean 1099-NEC issued every year above threshold

**The 1099-K shift to $5K threshold** (effective tax year 2024, ramping further) means many small marketplaces now hit the threshold who didn't before. Pick a platform that handles 1099-K generation natively (Trolley, Stripe Connect, Tipalti) or budget engineering time to do it yourself.

Read your state's specific rules — California (AB5), New Jersey, Massachusetts have aggressive ABC tests. A misclassification ruling can wipe out 24+ months of margin.

If you discover something not covered here, append it to `references/learnings.md` with today's date.

## Gotchas

> *Best-effort from research and platform documentation — verify pricing, country support, and KYC rules against current vendor pages.*

1. **Stripe Connect is three products, not one.** Standard / Express / Custom have very different onboarding UX and developer surface. Picking Custom when Express would have worked = months of unnecessary engineering.
2. **"Multi-currency" varies wildly.** Some platforms support sending to 50+ countries but only in USD; others convert to local currency at midmarket rates. Read the fine print before assuming Hyperwallet, Wise, and Stripe Connect are interchangeable.
3. **The 1099-K threshold drop changes the calculus.** Until 2023 the threshold was $20K + 200 transactions. From 2024 it's stepping down toward $600 (currently $5K as of latest IRS guidance). Many platforms that didn't issue 1099-Ks now have to — pick infra that handles this.
4. **On-demand pay is a supply-retention weapon.** In tight labor markets, "you can withdraw what you earned today" wins workers from competitors. If you don't offer it and a competitor does, you'll see churn even with identical pay rates.
5. **Per-payout fees compound at scale.** $0.25 per payout × 1000 payouts/week = $13K/year just in fees. Negotiate at scale; some platforms bundle by transaction volume.
6. **Hold/release for disputes only works inside the connected-account model.** If you picked a mass-payout API, you can't claw back a payment after a buyer dispute — you ate it.
7. **KYC failure rate is a feature, not a bug.** A platform that approves 100% of supply onboardings has weaker compliance and you'll pay for it later. Stripe Connect's ~70-85% first-pass approval is healthier than 100% with weak checks.

## Before recommending a specific platform skill

This skill covers a strategy domain across many platforms. **Before pointing the user to any specific platform skill** (any `/sales-{platform}` listed in `## Related skills`), read that platform skill's actual `SKILL.md` first. The 1-line description in `## Related skills` is enough to *identify* a candidate — not enough to *commit* to it or write a prompt that invokes it well.

**How to read it:** if `~/.claude/skills/{skill-name}/SKILL.md` exists locally, `Read` it. Otherwise `WebFetch` `https://raw.githubusercontent.com/sales-skills/sales/main/skills/{skill-name}/SKILL.md`.

**After reading,** ground your recommendation in something concrete from the SKILL.md (its scope, an argument-hint shape, or a "Do NOT use for..." clause). If the platform skill turns out to be a poor fit, swap to another or handle the question here directly.

## Related skills

- `/sales-two-sided-marketplace` — Marketplace GTM strategy (cold-start, supply recruiting, pilot framework) — pairs with this skill: that one recruits supply, this one pays them
- `/sales-field-sales` — Door-to-door / territory outbound to marketplace demand
- `/sales-checkout` — Buyer-side checkout optimization and payment collection (the OTHER side of the marketplace's money flow)
- `/sales-affiliate-program` — Affiliate commission tracking — different from marketplace worker payouts but adjacent
- `/sales-do` — Not sure which skill to use? The router matches any sales objective to the right skill. Install: `npx skills add sales-skills/sales --skill sales-do -a claude-code`

## Examples

### Example 1: Small US cleaning marketplace picking its first payout API
**User says**: "I have a cleaning marketplace with 30 active 1099 cleaners in Phoenix. Weekly payouts. Stripe Connect, Hyperwallet, or Tipalti?"
**Skill does**: Recommends Stripe Connect Express. Reasoning: US-only at 30 workers means multi-currency isn't a factor, Hyperwallet is overkill, Tipalti's AP-approval flow is wrong for direct worker payouts. Stripe Express has the best onboarding UX (which is what will break first at 30 workers since each onboarding is a churn moment), free until you scale, and 1099-NEC generation is native. Notes that if any worker is outside the US, switch to Hyperwallet or Trolley. References the 1099-K $5K threshold dropping and confirms Stripe Express handles it.
**Result**: User picks Stripe Express, onboards cleaners in <5 min each, has clean 1099-NEC end of year.

### Example 2: Supply churn from slow payouts
**User says**: "Our food courier supply is churning to a competitor. Both pay $X but they pay daily and we pay weekly. What do we do?"
**Skill does**: Identifies on-demand pay as the supply-retention lever. Recommends adding Branch ALONGSIDE the existing payout API rather than ripping out the primary infra. Also recommends Stripe Instant Payouts as a cheaper alternative if already on Stripe Connect. Flags the 1099 classification angle — worker-controlled payout timing actually IMPROVES the misclassification picture.
**Result**: User bolts on Branch for on-demand withdraw, supply churn drops within 30 days, classification posture also improves.

### Example 3: Multi-country marketplace selecting between Hyperwallet and Trolley
**User says**: "We're launching a creator marketplace that will pay people in 40 countries. Hyperwallet vs Trolley?"
**Skill does**: Walks through the trade-off — Hyperwallet has deeper geographic reach and is the historical default for large platforms (Uber Eats / GrubHub class) but heavier integration. Trolley is lighter to integrate, handles mass payouts + tax forms natively (1099 / W-9 / W-8), and is the better pick when the volume per country is uneven. Recommends Trolley for a new launch at unproven scale, with the option to switch to Hyperwallet or Adyen for Platforms if hitting Hyperwallet's volume threshold. References the connected-account vs custodial trade-off — Trolley is custodial which simplifies integration but limits dispute handling.
**Result**: User picks Trolley for launch, plans Hyperwallet migration path for scale.

## Troubleshooting

### Supply onboarding completion rate is below 60%
**Symptom**: Workers sign up for the marketplace but never finish payout-account KYC
**Cause**: Onboarding UX has too many steps, OR you're using Stripe Connect Custom when Express would have worked
**Solution**: Switch to Stripe Connect Express (hosted onboarding, mobile-optimized, ~5 minutes typical). If already on Express, audit: are you collecting non-required fields, or is the issue that workers don't have a bank account ready? Pair with debit-card-payout option if many workers are unbanked.

### Payouts arriving slower than competitor's
**Symptom**: Supply leaving for competitors who pay daily / on-demand
**Cause**: Weekly batch payouts via direct ACH
**Solution**: Add Branch or Stripe Instant Payouts as an on-demand overlay. Workers can withdraw earned wages whenever they want; you still settle the underlying batch on your preferred cadence. Bonus: worker-controlled timing helps the 1099 classification picture.

### Tax form generation broke — 1099-K threshold confusion
**Symptom**: It's tax season and you don't know which workers need 1099-Ks vs 1099-NECs
**Cause**: The 1099-K threshold dropped from $20K + 200 transactions to $5K (and trending toward $600). You probably weren't issuing 1099-Ks at all before; now you have to.
**Solution**: Use a platform that auto-generates both 1099-NEC and 1099-K (Stripe Connect, Trolley, Tipalti). If on a mass-payout API that doesn't generate forms (Routable, Wise, Tremendous), budget engineering time to integrate with a tax-filing service (Track1099, Tax1099) or migrate to a platform that handles it inline. Don't try to hand-issue forms above 50 workers.
