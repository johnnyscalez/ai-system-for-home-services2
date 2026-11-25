"use client"

// Steps 1 and 2: who the business is, and a review of what the website scan found.

import { useState } from "react"
import { Check, Globe, Loader2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { BUSINESS_MODELS, KNOWLEDGE_CHIPS, STATE_TIMEZONE, US_STATES } from "./constants"
import { assetsOf, normalizeWebsite, prettyPhone } from "./logic"
import type { ScanSummary, WizardData, WizardKb } from "./logic"
import type { StepProps } from "./types"
import { AreaField, Field, NativeSelect, Notice, Section, Segmented, StepIntro, TextField } from "./ui"

type ScanData = {
  businessDescription?: string | null
  servicesOffered?: string | null
  serviceAreas?: string | null
  pricingInfo?: string | null
  financingOptions?: string | null
  uniqueSellingPoints?: string | null
  yearsInBusiness?: string | null
  certifications?: string | null
  testimonials?: string | null
  logoUrl: string | null
  brandColor: string | null
  imageUrls: string[]
  socialLinks: Record<string, string>
  phone: string | null
  pagesRead: string[]
}

/** Fills empty fields from the scan; with `replace`, the scan wins over what is there. */
function applyScan(d: WizardData, s: ScanData, url: string, replace: boolean): WizardData {
  const pick = (current: string, found: string | null | undefined) =>
    found && (replace || !current.trim()) ? found : current
  const kb: WizardKb = {
    ...d.kb,
    website_url: url,
    business_description: pick(d.kb.business_description, s.businessDescription),
    services_offered: pick(d.kb.services_offered, s.servicesOffered),
    unique_selling_points: pick(d.kb.unique_selling_points, s.uniqueSellingPoints),
    certifications: pick(d.kb.certifications, s.certifications),
    testimonials: pick(d.kb.testimonials, s.testimonials),
    financing_options: pick(d.kb.financing_options, s.financingOptions),
    pricing_info: pick(d.kb.pricing_info, s.pricingInfo),
  }
  const business = d.intake.business ?? {}
  const assets = assetsOf(d.intake)
  return {
    ...d,
    kb,
    intake: {
      ...d.intake,
      business: {
        ...business,
        website: url,
        yearsInBusiness: pick(business.yearsInBusiness ?? "", s.yearsInBusiness),
        businessPhone: pick(business.businessPhone ?? "", s.phone),
      },
      assets: {
        ...assets,
        logoUrl: assets.logoUrl || s.logoUrl || null,
        brandColor: assets.brandColor || s.brandColor || null,
        instagram: assets.instagram || s.socialLinks.instagram || "",
        facebookPage: assets.facebookPage || s.socialLinks.facebook || "",
        googleBusinessUrl: assets.googleBusinessUrl || s.socialLinks.google || "",
      },
    },
  }
}

function useWebsiteScan({ data, update, setCtx, save, enqueue }: StepProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<string | null>(null)

  async function run(replace: boolean) {
    const url = normalizeWebsite(data.intake.business?.website ?? "")
    if (!url) { setError("Enter your website address first."); return }
    setScanning(true)
    setError(null)
    setFound(null)
    try {
      // Save first so the company exists and the scan can be stored with it.
      await save()
      const res = await enqueue(() =>
        fetch("/api/onboarding/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
      )
      const json = (await res.json().catch(() => ({}))) as { data?: ScanData; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? "The scan did not finish. You can fill the details in by hand.")
      const s = json.data
      update((d) => applyScan(d, s, url, replace))
      const summary: ScanSummary = {
        url,
        scannedAt: new Date().toISOString(),
        imageUrls: s.imageUrls ?? [],
        logoUrl: s.logoUrl ?? null,
        brandColor: s.brandColor ?? null,
        socialLinks: s.socialLinks ?? {},
        phone: s.phone ?? null,
        serviceAreas: s.serviceAreas ?? null,
        pagesRead: s.pagesRead?.length ?? 1,
      }
      setCtx({ scan: summary })
      const bits = [
        s.businessDescription ? "your business overview" : "",
        s.servicesOffered ? "your services" : "",
        s.imageUrls?.length ? `${s.imageUrls.length} photo${s.imageUrls.length === 1 ? "" : "s"}` : "",
        s.logoUrl ? "your logo" : "",
        s.phone ? "your phone number" : "",
      ].filter(Boolean)
      setFound(
        bits.length
          ? `Read ${summary.pagesRead} page${summary.pagesRead === 1 ? "" : "s"} and found ${bits.join(", ")}. You check all of it on the next step.`
          : `Read ${summary.pagesRead} page${summary.pagesRead === 1 ? "" : "s"} but could not find much. You can fill the details in by hand on the next step.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "The scan did not finish. You can fill the details in by hand.")
    } finally {
      setScanning(false)
    }
  }

  return { scanning, error, found, run }
}

// ── Step 1 ───────────────────────────────────────────────────────────────────

export function StepBusiness(props: StepProps) {
  const { data, update, ctx } = props
  const b = data.intake.business ?? {}
  const scan = useWebsiteScan(props)

  const setBusiness = (patch: Partial<NonNullable<WizardData["intake"]["business"]>>) =>
    update((d) => ({ ...d, intake: { ...d.intake, business: { ...(d.intake.business ?? {}), ...patch } } }))
  const setCompany = (patch: Partial<WizardData["company"]>) =>
    update((d) => ({ ...d, company: { ...d.company, ...patch } }))

  function setState(code: string) {
    update((d) => ({
      ...d,
      intake: { ...d.intake, business: { ...(d.intake.business ?? {}), state: code } },
      // The assistant's clock follows the state until the owner picks one on the calendar step.
      agent: !d.intake.calendar && STATE_TIMEZONE[code] ? { ...d.agent, timezone: STATE_TIMEZONE[code] } : d.agent,
    }))
  }

  return (
    <div>
      <StepIntro
        title="Tell us about your business"
        lead="This is what your ads, your assistant and your booked-measure texts are built on. It takes about ten minutes and saves as you go."
      />

      <div className="space-y-5">
        <Section>
          <TextField id="companyName" label="Company name" value={data.company.name} onChange={(v) => setCompany({ name: v })}
            placeholder="Summit Floors" autoComplete="organization" maxLength={120} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="ownerName" label="Owner's name" value={b.ownerName ?? ""} onChange={(v) => setBusiness({ ownerName: v })}
              placeholder="Mike Alvarez" autoComplete="name" />
            <TextField id="ownerEmail" label="Owner's email" type="email" inputMode="email" value={b.ownerEmail ?? ""}
              onChange={(v) => setBusiness({ ownerEmail: v })} placeholder="mike@summitfloors.com" autoComplete="email" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="notifyPhone" label="Owner's mobile" type="tel" inputMode="tel" value={data.company.notification_phone}
              onChange={(v) => setCompany({ notification_phone: v })}
              onBlur={() => setCompany({ notification_phone: prettyPhone(data.company.notification_phone) })}
              placeholder="(214) 555-0199" hint="We text you here for every new lead, every booked estimate and every lead that needs you." />
            <TextField id="businessPhone" label="Business phone" optional type="tel" inputMode="tel" value={b.businessPhone ?? ""}
              onChange={(v) => setBusiness({ businessPhone: v })} onBlur={() => setBusiness({ businessPhone: prettyPhone(b.businessPhone ?? "") })}
              placeholder="(214) 555-0142" hint="The number customers know you by. Your texting number gets the same area code when one is free." />
          </div>
        </Section>

        <Section title="How you sell">
          <Segmented label="Business model" stack value={b.businessModel ?? ""} onChange={(v) => setBusiness({ businessModel: v })}
            options={BUSINESS_MODELS} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="crews" label="Install crews" optional inputMode="numeric" value={b.crews ?? ""}
              onChange={(v) => setBusiness({ crews: v })} placeholder="3" hint="How many crews can be installing at once." />
            <TextField id="years" label="Years in business" optional value={b.yearsInBusiness ?? ""}
              onChange={(v) => setBusiness({ yearsInBusiness: v })} placeholder="18" />
          </div>
        </Section>

        <Section title="Where you are based">
          <TextField id="officeAddress" label="Office address" value={data.company.office_address}
            onChange={(v) => setCompany({ office_address: v })} placeholder="4501 Main St, Dallas, TX 75201" autoComplete="street-address"
            hint="Street, city, state and zip. Your texting number gets a local area code from it." />
          <Field label="State" htmlFor="state">
            <NativeSelect id="state" value={b.state ?? ""} onChange={setState} placeholder="Select your state"
              options={US_STATES.map((s) => ({ value: s.code, label: s.name }))} />
          </Field>
        </Section>

        <Section title="Your website" hint="We read it so you do not have to type everything out. You check what we found on the next step.">
          <Field label="Website address" optional htmlFor="website">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="website" type="url" inputMode="url" placeholder="summitfloors.com" value={b.website ?? ""}
                onChange={(e) => setBusiness({ website: e.target.value })} className="h-10 flex-1 bg-white" autoComplete="url" />
              <Button type="button" variant="outline" className="h-10 shrink-0 gap-2 px-4" disabled={scan.scanning || !(b.website ?? "").trim()}
                onClick={() => scan.run(false)}>
                {scan.scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : ctx.scan ? <RefreshCw className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                {scan.scanning ? "Reading your website" : ctx.scan ? "Scan again" : "Scan my website"}
              </Button>
            </div>
          </Field>
          {scan.scanning && <p className="text-sm text-muted-foreground" role="status">This takes about half a minute. You can keep filling in the form.</p>}
          {scan.found && <Notice tone="good">{scan.found}</Notice>}
          {scan.error && <Notice tone="warn">{scan.error}</Notice>}
          {!scan.found && !scan.error && !scan.scanning && ctx.scan && (
            <p className="text-sm text-muted-foreground">Scanned {new Date(ctx.scan.scannedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. {ctx.scan.imageUrls.length} photos found.</p>
          )}
        </Section>
      </div>
    </div>
  )
}

// ── Step 2 ───────────────────────────────────────────────────────────────────

const REVIEW_FIELDS: Array<{ key: keyof WizardKb; label: string; placeholder: string; hint?: string; rows: number }> = [
  { key: "business_description", label: "Business overview", rows: 3,
    placeholder: "Family owned flooring company serving the Dallas area since 2006. We sell and install LVP, hardwood, carpet and tile with our own crews." },
  { key: "services_offered", label: "What you install and do", rows: 4,
    placeholder: "LVP and vinyl plank\nHardwood and engineered hardwood\nCarpet\nTile\nStairs\nOld floor removal and haul away" },
  { key: "unique_selling_points", label: "Why customers choose you", rows: 3,
    placeholder: "Our own install crews, never subcontractors. Lifetime labor warranty. Samples brought to your home." },
  { key: "certifications", label: "Licenses and credentials", rows: 2,
    placeholder: "Licensed and insured. NWFA member. CFI certified installers." },
  { key: "testimonials", label: "A customer review or two", rows: 3,
    placeholder: "\"They finished our whole downstairs in two days and it looks incredible.\" Sarah M." },
  { key: "financing_options", label: "Financing", rows: 3,
    placeholder: "0% for 12 months through Synchrony on approved credit. Approval takes a few minutes.",
    hint: "Leave empty if you do not offer financing. Your assistant then never mentions payment plans." },
  { key: "pricing_info", label: "Pricing notes", rows: 3,
    placeholder: "Minimum job is 300 square feet. Furniture moving is included.",
    hint: "Your offer goes on the Offer step. Your assistant never quotes a job price: the quote comes after the measure." },
]

export function StepReview(props: StepProps) {
  const { data, update, ctx, setIntake } = props
  const scan = useWebsiteScan(props)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [broken, setBroken] = useState<string[]>([])
  const assets = assetsOf(data.intake)
  const picked = assets.websiteImages ?? []
  const candidates = (ctx.scan?.imageUrls ?? []).filter((u) => !broken.includes(u))
  const hasWebsite = !!(data.intake.business?.website ?? "").trim()

  const setKb = (key: keyof WizardKb, value: string) => update((d) => ({ ...d, kb: { ...d.kb, [key]: value } }))

  function togglePhoto(url: string) {
    const next = picked.includes(url) ? picked.filter((u) => u !== url) : [...picked, url]
    setIntake({ assets: { ...assets, websiteImages: next } })
  }

  function addFact(text: string) {
    const current = data.kb.custom_ai_knowledge.trim()
    if (current.includes(text)) return
    setKb("custom_ai_knowledge", current ? `${current}\n${text}` : text)
  }

  return (
    <div>
      <StepIntro
        title="Review what we found"
        lead="Your assistant answers homeowners from what is written here, so it has to be right. Fix anything that is wrong or out of date."
      />

      <div className="space-y-5">
        {ctx.scan ? (
          <Notice tone="warn">
            This came from {ctx.scan.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}. Read each box before you continue. Websites are often out of date.
          </Notice>
        ) : hasWebsite ? (
          <Notice>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>We have not read your website yet. A scan fills most of this in for you.</span>
              <Button type="button" variant="outline" className="h-9 shrink-0 gap-2 px-3" disabled={scan.scanning} onClick={() => scan.run(false)}>
                {scan.scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                {scan.scanning ? "Reading your website" : "Scan my website"}
              </Button>
            </div>
          </Notice>
        ) : (
          <Notice>No website? Fill these in by hand. A few lines each is plenty.</Notice>
        )}
        {scan.error && <Notice tone="warn">{scan.error}</Notice>}
        {scan.found && <Notice tone="good">{scan.found}</Notice>}

        <Section>
          {REVIEW_FIELDS.map((f) => (
            <AreaField key={f.key} id={`kb-${f.key}`} label={f.label} rows={f.rows} placeholder={f.placeholder} hint={f.hint}
              value={data.kb[f.key]} onChange={(v) => setKb(f.key, v)} maxLength={6000} />
          ))}
        </Section>

        <Section title="Good to know" hint="Facts your assistant should always have at hand. One per line. Tap any that apply, then edit the wording to match your business.">
          <div className="flex flex-wrap gap-2">
            {KNOWLEDGE_CHIPS.map((chip) => (
              <button key={chip.label} type="button" onClick={() => addFact(chip.text)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-white px-3 text-sm text-[#1A1614] outline-none transition-colors hover:border-[#A8A29E] focus-visible:ring-3 focus-visible:ring-ring/50">
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                {chip.label}
              </button>
            ))}
          </div>
          <AreaField id="kb-custom" label="Facts for your assistant" optional rows={5} value={data.kb.custom_ai_knowledge}
            onChange={(v) => setKb("custom_ai_knowledge", v)} maxLength={6000}
            placeholder={"We carry Shaw, Mohawk and COREtec.\nWe move the furniture and haul away the old floor.\nMost installs start within 2 to 3 weeks of signing."} />
        </Section>

        {candidates.length > 0 && (
          <Section
            title="Photos from your website"
            hint={`Tick the ones we may use in your ads. Real photos of your own work only. ${picked.length} selected.`}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {candidates.map((url) => {
                const on = picked.includes(url)
                return (
                  <button key={url} type="button" role="checkbox" aria-checked={on} aria-label={on ? "Remove this photo from your ads" : "Use this photo in your ads"}
                    onClick={() => togglePhoto(url)}
                    className={cn(
                      "group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "border-[#1A1614] ring-2 ring-[#1A1614]" : "border-border"
                    )}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- third-party site photos, shown as found */}
                    <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover"
                      onError={() => setBroken((prev) => (prev.includes(url) ? prev : [...prev, url]))} />
                    <span className={cn(
                      "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border",
                      on ? "border-[#1A1614] bg-[#1A1614]" : "border-white bg-white/85"
                    )}>
                      {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {ctx.scan && (
          <div className="text-sm text-muted-foreground">
            {confirmReplace ? (
              <span className="flex flex-wrap items-center gap-2">
                Replace everything above with a fresh scan?
                <Button type="button" variant="outline" size="sm" disabled={scan.scanning}
                  onClick={async () => { await scan.run(true); setConfirmReplace(false) }}>
                  {scan.scanning ? "Reading your website" : "Yes, replace"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReplace(false)}>Keep what I have</Button>
              </span>
            ) : (
              <button type="button" className="underline underline-offset-4 outline-none hover:text-[#1A1614] focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setConfirmReplace(true)}>
                Scan the website again and replace these answers
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
