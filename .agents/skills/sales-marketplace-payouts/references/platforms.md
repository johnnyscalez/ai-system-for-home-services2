# Marketplace Payout Platforms — Per-Platform Notes

Best-effort guidance from research and platform documentation on payout-side payment infrastructure for two-sided marketplaces. Pricing, country coverage, and KYC rules may shift — verify against current vendor pages before quoting.

## Table of contents

- [Stripe Connect — Standard](#stripe-connect--standard)
- [Stripe Connect — Express](#stripe-connect--express)
- [Stripe Connect — Custom](#stripe-connect--custom)
- [Stripe Instant Payouts](#stripe-instant-payouts)
- [PayPal Hyperwallet](#paypal-hyperwallet)
- [Adyen for Platforms](#adyen-for-platforms)
- [Trolley](#trolley)
- [Tipalti](#tipalti)
- [Routable](#routable)
- [dots.dev](#dotsdev)
- [Branch](#branch)
- [Nium](#nium)
- [Wise Business](#wise-business)
- [Tremendous](#tremendous)
- [Quick selection grid](#quick-selection-grid)

---

## Stripe Connect — Standard

**What it is:** the supply worker creates a full Stripe account; you connect to it via OAuth. Branding is co-Stripe.

**Best for:** marketplaces where workers can manage their own Stripe dashboard (creator marketplaces, vendor marketplaces).

**Onboarding:** worker goes through Stripe's hosted flow; KYC handled by Stripe.

**Pros:** lowest engineering effort; worker owns their Stripe account; works in 50+ countries.

**Cons:** co-branding (worker sees Stripe); less control over UX.

**Fees:** standard Stripe processing fees on the buyer side; payouts to workers are part of their own Stripe balance.

**Tax forms:** Stripe handles 1099-K issuance for workers above threshold.

---

## Stripe Connect — Express

**What it is:** Stripe-hosted onboarding inside your branded flow. Express workers don't see the Stripe dashboard.

**Best for:** most US marketplaces with 50-5K active workers. The default modern choice.

**Onboarding:** ~5 min mobile-optimized hosted flow. KYC handled by Stripe.

**Pros:** best onboarding completion rate in the market; minimal engineering; 1099-NEC + 1099-K issuance native; free until scaling.

**Cons:** less UX customization than Custom; some country gaps; Stripe's terms apply to worker accounts.

**Fees:** $2/active-account/month (active = received a payout). Buyer-side processing fees standard.

**Tax forms:** 1099-K and 1099-NEC issuance native.

---

## Stripe Connect — Custom

**What it is:** fully white-labeled — workers never see Stripe at all. You collect KYC info and pass it to Stripe via API.

**Best for:** marketplaces that need full UX control and have engineering capacity.

**Onboarding:** you build it. Stripe verifies via API.

**Pros:** full white-label; deepest control.

**Cons:** months of engineering; you handle KYC UX and edge cases; compliance burden is yours.

**Fees:** higher engineering cost; underlying fees similar to Express.

---

## Stripe Instant Payouts

**What it is:** an overlay on Stripe Connect — workers can withdraw their balance instantly (typically <30 min) for a fee.

**Best for:** combating supply churn from slow payouts when already on Stripe Connect.

**Pros:** competing on payout speed without changing primary infra.

**Cons:** worker pays the instant-payout fee (or you absorb it).

**Fees:** ~1.5% of payout amount, capped.

---

## PayPal Hyperwallet

**What it is:** global mass-payout platform from PayPal. Powers Uber Eats, GrubHub-class marketplaces.

**Best for:** marketplaces with significant non-US worker volume or 5K+ payouts/month.

**Onboarding:** Hyperwallet-hosted or via API. Workers pick a payout method (bank, PayPal, debit card, etc.).

**Pros:** deepest multi-country coverage (200+); multiple payout methods; designed for scale.

**Cons:** heavier integration than Stripe; quote-based pricing; PayPal-as-parent rules apply.

**Fees:** quote-based; typically $1-3 per payout depending on volume + method.

**Tax forms:** 1099-K issuance available.

---

## Adyen for Platforms

**What it is:** Adyen's marketplace payments product — enterprise-grade, embedded financial products available.

**Best for:** enterprise marketplaces with sophisticated needs (issuing, accounts, multi-currency at scale).

**Onboarding:** quote-based; you negotiate. Adyen handles KYC.

**Pros:** enterprise SLA; Adyen's payment processing is best-in-class globally; embedded financial products (issuing cards, business accounts).

**Cons:** wrong scale for early-stage marketplaces; sales-led onboarding; minimums.

**Fees:** quote-based.

---

## Trolley

**What it is:** formerly Payment Rails. Multi-currency mass payouts with tax form (1099 / W-9 / W-8) automation as the core product.

**Best for:** creator / vendor / multi-currency marketplaces that need to pay 100s-10Ks of recipients across countries with clean tax forms.

**Onboarding:** Trolley-hosted or via API.

**Pros:** native 1099 / W-9 / W-8 form generation; multi-currency native; mass payout file format; lighter integration than Hyperwallet.

**Cons:** custodial model — you can't hold/release funds for buyer disputes the way you can with Stripe Connect; smaller player than PayPal/Stripe.

**Fees:** per-payout fee + monthly platform fee; scales by volume.

**Tax forms:** core product. 1099-NEC, 1099-K, 1099-MISC, W-9, W-8 all native.

---

## Tipalti

**What it is:** AP automation platform with payouts. Includes invoice approval chains, supplier onboarding, tax compliance.

**Best for:** marketplaces where payouts go through approval workflows (creator marketplaces with payment terms, vendor marketplaces).

**Onboarding:** Tipalti-hosted supplier portal; you collect invoices.

**Pros:** invoice/approval workflow integrated; tax compliance native; multi-currency.

**Cons:** overkill for simple "pay the worker after each job" flows; pricing is enterprise.

**Fees:** quote-based subscription + per-payout fees.

**Tax forms:** native.

---

## Routable

**What it is:** B2B and 1099 payouts platform. Simpler than Tipalti.

**Best for:** small-to-mid marketplaces that need 1099 worker payouts plus B2B vendor payments in one place.

**Onboarding:** Routable-hosted onboarding for recipients.

**Pros:** lighter than Tipalti; B2B + 1099 combined; multi-currency.

**Cons:** smaller player; less marketplace-specific tooling than Stripe Connect or Trolley.

**Fees:** quote-based.

**Tax forms:** 1099 form generation native.

---

## dots.dev

**What it is:** embedded payout SDK purpose-built for gig platforms. Workers stay on your platform; payouts handled via dots.

**Best for:** gig marketplaces that want a focused payout SDK without the full Stripe/Adyen surface area.

**Onboarding:** SDK-driven; dots handles KYC.

**Pros:** purpose-built for gig; fast integration; tighter fit than Stripe for some use cases.

**Cons:** smaller ecosystem; less battle-tested than Stripe/Hyperwallet at scale.

**Fees:** per-payout + platform fee.

**Tax forms:** 1099 generation available.

---

## Branch

**What it is:** on-demand pay platform. Workers can withdraw earned-but-not-yet-paid wages instantly.

**Best for:** supply retention in tight labor markets. Layered ON TOP of a primary payout API.

**Onboarding:** Branch handles worker accounts; you tell Branch what each worker has earned.

**Pros:** the highest-leverage tool against supply churn from slow payouts; helps the 1099 classification picture (worker-controlled timing).

**Cons:** not a primary payout platform — you still need Stripe / Hyperwallet / Trolley underneath; cost is real.

**Fees:** quote-based; some plans pass cost to worker.

---

## Nium

**What it is:** global payment rails for enterprises — multi-currency, embedded finance.

**Best for:** larger marketplaces with global recipients and treasury/banking needs.

**Onboarding:** enterprise sales.

**Pros:** broad global coverage; embedded finance / cards / accounts.

**Cons:** enterprise scale; not for early-stage marketplaces.

**Fees:** quote-based.

---

## Wise Business

**What it is:** Wise's business account with multi-currency payouts. Not marketplace-specific.

**Best for:** very early-stage marketplaces with <50 multi-country payouts/month. Manual or lightly integrated.

**Pros:** cheapest multi-currency transfers (midmarket rates); fast multi-country payouts; no marketplace-specific setup needed.

**Cons:** no marketplace tooling — no KYC for sub-recipients, no tax forms, no hold/release, no embedded UX. Manual at scale.

**Fees:** ~0.5% above midmarket FX rate; transfer fees low.

**Tax forms:** none.

---

## Tremendous

**What it is:** payout platform that lets workers choose cash, gift cards, prepaid debit, or charity donations.

**Best for:** marketplaces where workers / recipients value optionality (rewards, referral incentives, occasional payouts).

**Pros:** worker choice = higher satisfaction; gift card options reduce cost in some cases.

**Cons:** not a primary worker payout platform; no 1099 generation; not where you'd run an ongoing 1099 gig marketplace.

**Fees:** per-payout + program fee.

---

## Quick selection grid

| Situation | Recommended primary | Recommended overlay |
|---|---|---|
| Pre-PMF, <50 payouts/month, US-only | Stripe Standard payouts or Wise Business (manual) | — |
| Small US marketplace, 50-500/mo | **Stripe Connect Express** | Add Branch only if churning |
| Scaling US, 500-5K/mo | **Stripe Connect Express** | **Branch** for on-demand |
| Multi-country (any) | **PayPal Hyperwallet** or **Trolley** | — |
| Heavy tax-form workflow | **Trolley** | — |
| Enterprise multi-product (issuing, accounts) | **Adyen for Platforms** | — |
| AP-approval-chain payouts | **Tipalti** | — |
| Embedded gig SDK | **dots.dev** | — |
| Rewards / gift cards | **Tremendous** | — |
