"use client"

// Steps 6 to 10: photos and brand, ads and access, the texting number,
// the measure calendar with the assistant, and the launch checklist.

import { useRef, useState } from "react"
import { AlertCircle, Check, CheckCircle2, Circle, ImagePlus, Loader2, Minus, Phone, Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { A2pBusiness, IntakePhoto, MeasureWindow } from "@/lib/intake"
import { cn } from "@/lib/utils"
import {
  A2P_BUSINESS_TYPES, A2P_STATUS_TEXT, DOMAIN_ACCESS, LEAD_TIMES, MEASURE_LENGTHS, PHOTO_KINDS, TIMEZONES, TONES, US_STATES, WEEK_DAYS,
} from "./constants"
import type { StepId } from "./constants"
import { a2pDefaults, a2pMissing, assetsOf, calendarOf, launchChecklist, missingForLaunch, prettyPhone, withA2pDefaults } from "./logic"
import type { StepProps } from "./types"
import { AreaField, Field, NativeSelect, Notice, Section, Segmented, StepIntro, Switch, TextField } from "./ui"

// ── Step 6: photos and brand ─────────────────────────────────────────────────

const MAX_PHOTO_BYTES = 15 * 1024 * 1024
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"

function looksLikePhoto(file: File): boolean {
  return /^image\/(jpe?g|png|webp|hei[cf])$/i.test(file.type) || /\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)
}

function Thumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    // HEIC uploads are kept but most browsers cannot draw them.
    return <div className={cn("flex items-center justify-center bg-muted px-2 text-center text-xs text-muted-foreground", className)}>Preview not available</div>
  }
  // eslint-disable-next-line @next/next/no-img-element -- user uploads and third-party logos, shown at thumbnail size
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} onError={() => setFailed(true)} />
}

export function StepPhotos({ data, ctx, setIntake, enqueue, goTo }: StepProps) {
  const assets = assetsOf(data.intake)
  const photos = assets.photos
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  const setAssets = (patch: Partial<typeof assets>) => setIntake({ assets: { ...assetsOf(data.intake), ...patch } })
  const setPhotos = (next: IntakePhoto[]) => setIntake({ assets: { ...assetsOf(data.intake), photos: next } })

  async function uploadFiles(list: FileList | File[]) {
    const files = Array.from(list)
    if (files.length === 0) return
    const issues: string[] = []
    const good = files.filter((f) => {
      if (!looksLikePhoto(f)) { issues.push(`${f.name}: only JPG, PNG, WebP or HEIC photos.`); return false }
      if (f.size > MAX_PHOTO_BYTES) { issues.push(`${f.name} is larger than 15 MB.`); return false }
      return true
    })
    setProblems(issues)
    if (good.length === 0) return
    setUploading({ done: 0, total: good.length })
    // One at a time: every upload rewrites the same stored list.
    for (let i = 0; i < good.length; i++) {
      const file = good[i]
      try {
        const json = await enqueue(async () => {
          const body = new FormData()
          body.append("file", file)
          body.append("kind", "finished")
          const res = await fetch("/api/onboarding/assets", { method: "POST", body })
          return { ok: res.ok, ...((await res.json().catch(() => ({}))) as { photos?: IntakePhoto[]; error?: string }) }
        })
        if (json.ok && json.photos) setPhotos(json.photos)
        else issues.push(json.error ?? `${file.name} could not be uploaded.`)
      } catch {
        issues.push(`${file.name} could not be uploaded. Check your connection.`)
      }
      setUploading({ done: i + 1, total: good.length })
      setProblems([...issues])
    }
    setUploading(null)
    if (fileInput.current) fileInput.current.value = ""
  }

  async function changePhoto(path: string, method: "PATCH" | "DELETE", extra: Record<string, string> = {}) {
    setBusyPath(path)
    try {
      const json = await enqueue(async () => {
        const res = await fetch("/api/onboarding/assets", {
          method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, ...extra }),
        })
        return { ok: res.ok, ...((await res.json().catch(() => ({}))) as { photos?: IntakePhoto[]; error?: string }) }
      })
      if (json.ok && json.photos) setPhotos(json.photos)
      else setProblems([json.error ?? "That change did not save. Please try again."])
    } catch {
      setProblems(["That change did not save. Check your connection."])
    } finally {
      setBusyPath(null)
    }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return
    if (!looksLikePhoto(file) || file.size > MAX_PHOTO_BYTES) { setProblems(["The logo must be a JPG, PNG or WebP under 15 MB."]); return }
    setLogoBusy(true)
    try {
      const json = await enqueue(async () => {
        const body = new FormData()
        body.append("file", file)
        body.append("kind", "logo")
        const res = await fetch("/api/onboarding/assets", { method: "POST", body })
        return { ok: res.ok, ...((await res.json().catch(() => ({}))) as { logo?: { url: string }; error?: string }) }
      })
      if (json.ok && json.logo) setAssets({ logoUrl: json.logo.url })
      else setProblems([json.error ?? "The logo could not be uploaded."])
    } catch {
      setProblems(["The logo could not be uploaded. Check your connection."])
    } finally {
      setLogoBusy(false)
      if (logoInput.current) logoInput.current.value = ""
    }
  }

  const websitePicked = (assets.websiteImages ?? []).length

  return (
    <div>
      <StepIntro
        title="Photos and brand"
        lead="Real photos of your own jobs make the strongest ads. Before and after shots work best, then finished floors, then your crew at work."
      />

      <div className="space-y-5">
        <Section title="Job photos" hint="JPG, PNG, WebP or HEIC, up to 15 MB each. Phone photos are fine.">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void uploadFiles(e.dataTransfer.files) }}
            className={cn(
              "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              dragging ? "border-[#1A1614] bg-white" : "border-[#D6D3D1] bg-[#FAFAF8]"
            )}
          >
            <ImagePlus className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-[#44403C]">Drag photos here, or pick them from your phone or computer.</p>
            <input ref={fileInput} id="photo-files" type="file" multiple accept={PHOTO_ACCEPT} className="sr-only"
              onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files) }} />
            <Button type="button" variant="outline" className="h-10 gap-2 px-4" disabled={!!uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? `Uploading ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}` : "Choose photos"}
            </Button>
          </div>

          {problems.length > 0 && (
            <Notice tone="warn">
              <ul className="space-y-1">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </Notice>
          )}

          {photos.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Uploaded photos">
              {photos.map((p) => (
                <li key={p.path} className={cn("overflow-hidden rounded-xl border border-border bg-white", busyPath === p.path && "opacity-60")}>
                  <div className="relative">
                    <Thumb src={p.url} alt={p.label ?? "Job photo"} className="aspect-[4/3] w-full" />
                    <button type="button" aria-label={`Remove ${p.label ?? "photo"}`} disabled={busyPath === p.path}
                      onClick={() => void changePhoto(p.path, "DELETE")}
                      className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1A1614] shadow-sm outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-ring">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-2">
                    <NativeSelect ariaLabel="What this photo shows" value={p.kind ?? "other"} options={PHOTO_KINDS} className="h-9 text-sm"
                      onChange={(kind) => void changePhoto(p.path, "PATCH", { kind })} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No photos uploaded yet. You can skip this and send them to us later.</p>
          )}

          {(ctx.scan?.imageUrls.length ?? 0) > 0 && (
            <p className="text-sm text-muted-foreground">
              {websitePicked > 0 ? `${websitePicked} photo${websitePicked === 1 ? "" : "s"} from your website selected for ads. ` : "You have not picked any photos from your website. "}
              <button type="button" onClick={() => goTo("review")} className="underline underline-offset-4 outline-none hover:text-[#1A1614] focus-visible:ring-2 focus-visible:ring-ring">
                Choose website photos
              </button>
            </p>
          )}
        </Section>

        <Section title="Logo and color">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2">
              {assets.logoUrl
                ? <Thumb src={assets.logoUrl} alt="Your logo" className="max-h-full max-w-full !object-contain" />
                : <span className="text-xs text-muted-foreground">No logo yet</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Logo file"
                onChange={(e) => void uploadLogo(e.target.files?.[0])} />
              <Button type="button" variant="outline" className="h-10 gap-2 px-3" disabled={logoBusy} onClick={() => logoInput.current?.click()}>
                {logoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {assets.logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {ctx.scan?.logoUrl && ctx.scan.logoUrl !== assets.logoUrl && (
                <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => setAssets({ logoUrl: ctx.scan?.logoUrl ?? null })}>
                  Use the one from my website
                </Button>
              )}
              {assets.logoUrl && (
                <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => setAssets({ logoUrl: null })}>Remove</Button>
              )}
            </div>
          </div>
          <Field label="Brand color" optional htmlFor="brandColorHex" hint="The main color on your trucks, shirts or sign. We match your landing page to it.">
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pick your brand color" value={/^#[0-9a-f]{6}$/.test(assets.brandColor ?? "") ? (assets.brandColor as string) : "#1a1614"}
                onChange={(e) => setAssets({ brandColor: e.target.value.toLowerCase() })}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-white p-1" />
              <Input id="brandColorHex" placeholder="#1b4d3e" value={assets.brandColor ?? ""} maxLength={7} className="h-10 w-32 bg-white font-mono"
                onChange={(e) => {
                  const v = e.target.value.trim().toLowerCase()
                  // Kept as typed so the owner can finish the code; the server only stores a full 6 digit hex.
                  setAssets({ brandColor: v || null })
                }} />
              {assets.brandColor && <Button type="button" variant="ghost" size="sm" onClick={() => setAssets({ brandColor: null })}>Clear</Button>}
            </div>
          </Field>
        </Section>

        <Section title="Where people find you" hint="We pull your reviews and match your ads to your pages.">
          <TextField id="gbp" label="Google Business Profile link" optional type="url" inputMode="url" value={assets.googleBusinessUrl ?? ""}
            onChange={(v) => setAssets({ googleBusinessUrl: v })} placeholder="https://g.page/summit-floors" />
          <TextField id="reviewsUrl" label="Another reviews page" optional type="url" inputMode="url" value={assets.reviewsUrl ?? ""}
            onChange={(v) => setAssets({ reviewsUrl: v })} placeholder="Houzz, Yelp, Angi or Facebook reviews" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="instagram" label="Instagram" optional value={assets.instagram ?? ""} onChange={(v) => setAssets({ instagram: v })}
              placeholder="@summitfloors" />
            <TextField id="facebookPage" label="Facebook page" optional type="url" inputMode="url" value={assets.facebookPage ?? ""}
              onChange={(v) => setAssets({ facebookPage: v })} placeholder="facebook.com/summitfloors" />
          </div>
        </Section>
      </div>
    </div>
  )
}

// ── Step 7: ads and access ───────────────────────────────────────────────────

const YES_NO: Array<{ value: string; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
]

export function StepAds({ data, ctx, mode, setIntake, save }: StepProps) {
  const ads = data.intake.ads ?? {}
  const domain = data.intake.domain ?? {}
  const [leaving, setLeaving] = useState(false)
  const setAds = (patch: Partial<typeof ads>) => setIntake({ ads: { ...ads, ...patch } })
  const setDomain = (patch: Partial<typeof domain>) => setIntake({ domain: { ...domain, ...patch } })

  async function connectFacebook() {
    setLeaving(true)
    // Nothing typed on this page may be lost by the trip to Facebook and back.
    await save()
    window.location.href = mode === "onboarding" ? "/api/auth/facebook?return_to=onboarding" : "/integrations"
  }

  return (
    <div>
      <StepIntro
        title="Ads and access"
        lead="We build and run your ads on Facebook and Instagram. To do that we need to reach your Facebook page, your ad account and your website domain."
      />

      <div className="space-y-5">
        <Section title="Facebook">
          {ctx.facebook.connected ? (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-3.5 py-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#16A34A]" aria-hidden="true" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-[#1A1614]">Connected to {ctx.facebook.pageName ?? "your Facebook page"}</p>
                <p className="mt-0.5 text-[#44403C]">
                  {ctx.facebook.adAccountId ? `Ad account ${ctx.facebook.adAccountId}` : "Ad account not chosen yet. We pick it with you on the install call."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-relaxed text-[#44403C]">
                Log in with the Facebook account that manages your business page. You choose which page and ad account we can use.
              </p>
              <Button type="button" className="h-10 shrink-0 gap-2 px-4" disabled={leaving} onClick={() => void connectFacebook()}>
                {leaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "onboarding" ? "Connect Facebook" : "Open Integrations"}
              </Button>
            </div>
          )}
          <Notice>
            You pay Meta directly for the ads. It goes on the card in your own ad account and is separate from FieldBuilt.
          </Notice>
          {!ctx.facebook.connected && (
            <Field label="Not ready to connect?">
              <Segmented label="How to give access" stack value={ads.accessMethod ?? ""} onChange={(v) => setAds({ accessMethod: v })}
                options={[
                  { value: "later", label: "Do it on the install call", hint: "We walk you through it" },
                  { value: "partner_access", label: "Add FieldBuilt as a partner", hint: "You share the page from Business Manager" },
                  { value: "connected", label: "I will connect now", hint: "Use the button above" },
                ]} />
            </Field>
          )}
        </Section>

        <Section title="Your ads so far">
          <TextField id="monthlyBudget" label="Monthly ad budget" optional value={ads.monthlyBudget ?? ""} onChange={(v) => setAds({ monthlyBudget: v })}
            placeholder="$2,000" hint="What you are comfortable spending with Meta each month. A range is fine." />
          <Field label="Have you run Facebook or Instagram ads before?">
            <Segmented label="Run ads before" value={ads.hasRunAdsBefore ?? ""} onChange={(v) => setAds({ hasRunAdsBefore: v })} options={YES_NO} />
          </Field>
          <Field label="Do you already have a Meta ad account?">
            <Segmented label="Has ad account" value={ads.hasAdAccount ?? ""} onChange={(v) => setAds({ hasAdAccount: v })} options={YES_NO} />
          </Field>
          <AreaField id="adsNotes" label="Anything we should know" optional rows={2} maxLength={1000} value={ads.notes ?? ""}
            onChange={(v) => setAds({ notes: v })} placeholder="An agency ran ads for us last year. The ad account is under my wife's Facebook." />
        </Section>

        <Section title="Your website domain" hint="Your landing page lives on your own domain so homeowners see your name, not ours.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="domain" label="Domain" optional value={domain.domain ?? ""} onChange={(v) => setDomain({ domain: v })} placeholder="summitfloors.com" />
            <TextField id="registrar" label="Where it is registered" optional value={domain.registrar ?? ""} onChange={(v) => setDomain({ registrar: v })}
              placeholder="GoDaddy, Squarespace, Wix" />
          </div>
          <Field label="How should we get access?">
            <div role="radiogroup" aria-label="Domain access" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DOMAIN_ACCESS.map((o) => {
                const selected = domain.access === o.value
                return (
                  <button key={o.value} type="button" role="radio" aria-checked={selected} onClick={() => setDomain({ access: o.value })}
                    className={cn(
                      "min-h-11 rounded-xl border px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected ? "border-[#1A1614] bg-white ring-1 ring-[#1A1614]" : "border-border bg-white hover:border-[#A8A29E]"
                    )}>
                    <span className={cn("block text-[#1A1614]", selected && "font-semibold")}>{o.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>
                  </button>
                )
              })}
            </div>
          </Field>
          <TextField id="domainContact" label="Who handles your website?" optional value={domain.contactName ?? ""}
            onChange={(v) => setDomain({ contactName: v })} placeholder="Name and phone or email of your web person, if you have one" />
          <AreaField id="domainNotes" label="Notes" optional rows={2} maxLength={1000} value={domain.notes ?? ""} onChange={(v) => setDomain({ notes: v })} />
        </Section>
      </div>
    </div>
  )
}

// ── Step 8: texting number ───────────────────────────────────────────────────

export function StepNumber({ data, ctx, setIntake, setCtx, enqueue, save }: StepProps) {
  const a2p = data.intake.a2p ?? { status: "not_started" as const }
  const status = A2P_STATUS_TEXT[a2p.status] ?? A2P_STATUS_TEXT.not_started
  const locked = !["not_started", "info_collected"].includes(a2p.status)
  // Shown prefilled from the business step; the first edit saves the whole set,
  // and the server fills the same defaults before filing (lib/a2p.ts).
  const business = locked ? a2p.business ?? {} : withA2pDefaults(a2p.business, a2pDefaults({
    companyName: data.company.name,
    officeAddress: data.company.office_address,
    ownerMobile: data.company.notification_phone,
    business: data.intake.business,
  }))
  const missing = a2pMissing(business)
  const [reserving, setReserving] = useState(false)
  const [reserveError, setReserveError] = useState<string | null>(null)

  const setBusiness = (patch: Partial<A2pBusiness>) => {
    const next = { ...business, ...patch }
    setIntake({ a2p: { ...a2p, business: next, status: locked ? a2p.status : a2pMissing(next).length === 0 ? "info_collected" : "not_started" } })
  }

  async function reserve() {
    setReserving(true)
    setReserveError(null)
    try {
      await save()
      const json = await enqueue(async () => {
        const res = await fetch("/api/onboarding/provision-phone", { method: "POST" })
        return { ok: res.ok, ...((await res.json().catch(() => ({}))) as { phoneNumber?: string; error?: string }) }
      })
      if (json.ok && json.phoneNumber) setCtx({ phoneNumber: json.phoneNumber })
      else setReserveError(json.error ?? "We could not reserve a number. Please try again.")
    } catch {
      setReserveError("We could not reserve a number. Check your connection and try again.")
    } finally {
      setReserving(false)
    }
  }

  const tones = { idle: "plain", progress: "plain", good: "good", bad: "bad" } as const

  return (
    <div>
      <StepIntro
        title="Your texting number"
        lead="US mobile carriers only deliver business texts from a number registered to a real business. FieldBuilt files that registration for you when you finish setup. You only need to add your business type and EIN."
      />

      <div className="space-y-5">
        <Section title="Your number">
          {ctx.phoneNumber ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F4F2]"><Phone className="h-5 w-5 text-[#1A1614]" /></span>
              <div>
                <p className="font-mono text-xl font-semibold tracking-wide text-[#1A1614]">{prettyPhone(ctx.phoneNumber)}</p>
                <p className="text-sm text-muted-foreground">Your assistant texts every lead from this number.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-relaxed text-[#44403C]">A local number with an area code near your office. It is yours for as long as your account is active.</p>
              <Button type="button" variant="outline" className="h-10 shrink-0 gap-2 px-4" disabled={reserving} onClick={() => void reserve()}>
                {reserving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {reserving ? "Finding a local number" : "Reserve my number"}
              </Button>
            </div>
          )}
          {reserveError && <Notice tone="warn">{reserveError}</Notice>}
        </Section>

        <Section title="Carrier registration">
          <Notice tone={tones[status.tone]}>
            <span className="font-semibold">{status.label}.</span> {status.detail}
          </Notice>

          <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
            <legend className="sr-only">Business details for the carrier registration</legend>
            <TextField id="legalName" label="Legal business name" value={business.legalName ?? ""} onChange={(v) => setBusiness({ legalName: v })}
              placeholder="Summit Floors LLC" hint="Exactly as it appears on your EIN letter from the IRS." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business type" htmlFor="businessType">
                <NativeSelect id="businessType" value={business.businessType ?? ""} placeholder="Select one" options={A2P_BUSINESS_TYPES}
                  onChange={(v) => setBusiness({ businessType: v })} />
              </Field>
              {business.businessType !== "sole_proprietor" && (
                <TextField id="ein" label="EIN" value={business.ein ?? ""} inputMode="numeric" placeholder="12-3456789" maxLength={10}
                  onChange={(v) => setBusiness({ ein: v.replace(/[^\d-]/g, "") })} hint="Your 9 digit federal tax ID." />
              )}
            </div>
            <TextField id="a2pStreet" label="Business street address" value={business.street ?? ""} onChange={(v) => setBusiness({ street: v })}
              placeholder="4501 Main St" autoComplete="address-line1" />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="a2pCity" label="City" value={business.city ?? ""} onChange={(v) => setBusiness({ city: v })} autoComplete="address-level2" />
              <Field label="State" htmlFor="a2pState">
                <NativeSelect id="a2pState" value={business.state ?? ""} placeholder="State" onChange={(v) => setBusiness({ state: v })}
                  options={US_STATES.map((s) => ({ value: s.code, label: s.name }))} />
              </Field>
              <TextField id="a2pZip" label="Zip code" value={business.zip ?? ""} inputMode="numeric" maxLength={5}
                onChange={(v) => setBusiness({ zip: v.replace(/\D/g, "") })} autoComplete="postal-code" />
            </div>
            <TextField id="a2pWebsite" label="Business website" optional value={business.website ?? ""} onChange={(v) => setBusiness({ website: v })}
              placeholder="summitfloors.com" hint="Carriers approve faster when the website shows the same business name." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="repFirst" label="Contact first name" value={business.repFirstName ?? ""} onChange={(v) => setBusiness({ repFirstName: v })} autoComplete="given-name" />
              <TextField id="repLast" label="Contact last name" value={business.repLastName ?? ""} onChange={(v) => setBusiness({ repLastName: v })} autoComplete="family-name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="repTitle" label="Title" optional value={business.repTitle ?? ""} onChange={(v) => setBusiness({ repTitle: v })} placeholder="Owner" />
              <TextField id="repEmail" label="Contact email" type="email" inputMode="email" value={business.repEmail ?? ""} onChange={(v) => setBusiness({ repEmail: v })} />
              <TextField id="repPhone" label="Contact mobile" type="tel" inputMode="tel" value={business.repPhone ?? ""}
                onChange={(v) => setBusiness({ repPhone: v })} onBlur={() => setBusiness({ repPhone: prettyPhone(business.repPhone ?? "") })} />
            </div>
          </fieldset>

          {!locked && missing.length > 0 && (
            <p className="text-sm text-muted-foreground">Still needed before we can file: {missing.join(", ")}.</p>
          )}
          {locked && <p className="text-sm text-muted-foreground">These details are on file with the carriers. Contact FieldBuilt to change them.</p>}
        </Section>
      </div>
    </div>
  )
}

// ── Step 9: measure calendar and assistant ───────────────────────────────────

function hourLabel(h: number): string {
  if (h === 0 || h === 24) return "12:00 AM"
  if (h === 12) return "12:00 PM"
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`
}

export function StepCalendar({ data, ctx, mode, update, setIntake, save }: StepProps) {
  const cal = calendarOf(data.intake)
  const agent = data.agent
  const [leaving, setLeaving] = useState(false)
  const setCal = (patch: Partial<typeof cal>) => setIntake({ calendar: { ...cal, ...patch } })
  const setAgent = (patch: Partial<typeof agent>) => update((d) => ({ ...d, agent: { ...d.agent, ...patch } }))
  const setWindow = (id: string, patch: Partial<MeasureWindow>) =>
    setCal({ windows: cal.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) })

  async function connectGmail() {
    setLeaving(true)
    await save()
    window.location.href = `/api/auth/gmail?return_to=${mode === "onboarding" ? "onboarding" : "settings"}`
  }

  return (
    <div>
      <StepIntro
        title="Measure calendar and assistant"
        lead="Your assistant only offers times you set here, and it never books two measures into the same slot unless you say you can run them at once."
      />

      <div className="space-y-5">
        <Section title="Days you run measures" hint="No measures are ever booked on New Year's Day, Memorial Day, July 4, Labor Day, Thanksgiving or Christmas Day. They show as closed on your calendar.">
          <div role="group" aria-label="Measure days" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {WEEK_DAYS.map((d) => {
              const on = cal.days.includes(d.value)
              return (
                <button key={d.value} type="button" role="checkbox" aria-checked={on} aria-label={d.label}
                  onClick={() => setCal({ days: on ? cal.days.filter((x) => x !== d.value) : [...cal.days, d.value] })}
                  className={cn(
                    "h-11 rounded-xl border text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    on ? "border-[#1A1614] bg-[#1A1614] font-semibold text-white" : "border-border bg-white text-[#44403C] hover:border-[#A8A29E]"
                  )}>
                  {d.short}
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Time windows" hint="The homeowner is told your estimator arrives inside the window they pick.">
          <ul className="space-y-2">
            {cal.windows.map((w) => (
              <li key={w.id} className="rounded-xl border border-border bg-white p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Switch checked={w.enabled} onChange={(on) => setWindow(w.id, { enabled: on })} label={`${w.label} window`} />
                  <span className={cn("w-24 text-sm font-medium", w.enabled ? "text-[#1A1614]" : "text-muted-foreground")}>{w.label}</span>
                  <div className="flex items-center gap-2">
                    <Input type="time" aria-label={`${w.label} start`} value={w.start} disabled={!w.enabled} step={900}
                      onChange={(e) => setWindow(w.id, { start: e.target.value })} className="h-10 w-[7.25rem] bg-white" />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input type="time" aria-label={`${w.label} end`} value={w.end} disabled={!w.enabled} step={900}
                      onChange={(e) => setWindow(w.id, { end: e.target.value })} className="h-10 w-[7.25rem] bg-white" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="How you run them">
          <Field label="Measures you can run at the same time" hint="Most contractors start with 1. Raise it if more than one person measures.">
            <div className="flex items-center gap-4">
              <Button type="button" variant="outline" size="icon-lg" aria-label="One fewer" disabled={cal.capacity <= 1}
                onClick={() => setCal({ capacity: Math.max(1, cal.capacity - 1) })}><Minus className="h-4 w-4" /></Button>
              <span className="w-8 text-center font-mono text-2xl font-semibold tabular-nums text-[#1A1614]" aria-live="polite">{cal.capacity}</span>
              <Button type="button" variant="outline" size="icon-lg" aria-label="One more" disabled={cal.capacity >= 10}
                onClick={() => setCal({ capacity: Math.min(10, cal.capacity + 1) })}><Plus className="h-4 w-4" /></Button>
            </div>
          </Field>
          <Field label="Earliest a measure can be booked">
            <Segmented label="Earliest booking" value={cal.minLeadDays} onChange={(v) => setCal({ minLeadDays: v })} options={LEAD_TIMES} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Length of a measure" htmlFor="measureLength">
              <NativeSelect id="measureLength" value={String(cal.measureDurationMin)} onChange={(v) => setCal({ measureDurationMin: Number(v) })}
                options={MEASURE_LENGTHS.map((m) => ({ value: String(m.value), label: m.label }))} />
            </Field>
            <Field label="Time zone" htmlFor="timezone">
              <NativeSelect id="timezone" value={TIMEZONES.some((t) => t.value === agent.timezone) ? agent.timezone : ""}
                placeholder={TIMEZONES.some((t) => t.value === agent.timezone) ? undefined : agent.timezone}
                onChange={(v) => { if (v) setAgent({ timezone: v }) }} options={TIMEZONES} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="estimatorName" label="Who runs the measures?" optional value={cal.estimatorName ?? ""} onChange={(v) => setCal({ estimatorName: v })}
              placeholder="Mike" />
            <TextField id="estimatorPhone" label="Their mobile" optional type="tel" inputMode="tel" value={cal.estimatorPhone ?? ""}
              onChange={(v) => setCal({ estimatorPhone: v })} onBlur={() => setCal({ estimatorPhone: prettyPhone(cal.estimatorPhone ?? "") })}
              placeholder="(214) 555-0199" />
          </div>
        </Section>

        <Section title="Your assistant" hint="It answers every lead by text within seconds, asks your questions and books the measure. It always says it is an AI assistant when asked.">
          <TextField id="agentName" label="Assistant's name" value={agent.agent_name} onChange={(v) => setAgent({ agent_name: v })} placeholder="Mia" maxLength={40} />
          <Field label="How it sounds">
            <Segmented label="Tone" stack value={agent.tone} onChange={(v) => setAgent({ tone: v })} options={TONES} />
          </Field>
          <Field label="Hours it may text" hint="Leads that come in outside these hours get their first text when the window opens.">
            <div className="flex items-center gap-2">
              <NativeSelect ariaLabel="Texting starts" value={String(agent.working_hours_start)} onChange={(v) => setAgent({ working_hours_start: Number(v) })}
                options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }))} />
              <span className="text-sm text-muted-foreground">to</span>
              <NativeSelect ariaLabel="Texting ends" value={String(agent.working_hours_end)} onChange={(v) => setAgent({ working_hours_end: Number(v) })}
                options={Array.from({ length: 24 }, (_, i) => ({ value: String(i + 1), label: hourLabel(i + 1) }))} />
            </div>
          </Field>
          <AreaField id="customInstructions" label="Anything it should always or never say" optional rows={4} maxLength={4000} value={agent.custom_instructions}
            onChange={(v) => setAgent({ custom_instructions: v })}
            placeholder={"Always mention we bring samples to the measure.\nNever promise an install date.\nIf someone names a competitor, stay neutral."} />
        </Section>

        <Section title="Confirmation emails" hint="Optional. Connect Gmail and measure confirmations go out from your own address.">
          {ctx.gmailConnected ? (
            <p className="flex items-center gap-2 text-sm text-[#1A1614]"><CheckCircle2 className="h-4 w-4 text-[#16A34A]" /> Gmail is connected.</p>
          ) : (
            <Button type="button" variant="outline" className="h-10 gap-2 px-4" disabled={leaving} onClick={() => void connectGmail()}>
              {leaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Connect Gmail
            </Button>
          )}
        </Section>
      </div>
    </div>
  )
}

// ── Step 10: finish ──────────────────────────────────────────────────────────

export function StepFinish({
  data, ctx, mode, goTo, onFinish, finishing, finishError,
}: StepProps & { onFinish: () => void; finishing: boolean; finishError: string | null }) {
  const items = launchChecklist(data, ctx)
  const blocking = missingForLaunch({ companyName: data.company.name, ownerMobile: data.company.notification_phone, intake: data.intake })
  const stepsWithGaps = new Set<StepId>(blocking.map((b) => b.step))
  const open = items.filter((i) => !i.done && !i.required)

  return (
    <div>
      <StepIntro
        title={mode === "edit" ? "Launch checklist" : blocking.length > 0 ? "Almost there" : "You are ready to launch"}
        lead={
          mode === "edit"
            ? "Where your account stands today. Tap any line to change it."
            : blocking.length > 0
              ? "A few details are still needed before your dashboard opens. They are marked below."
              : "Here is where everything stands. Anything still open below, we finish with you during the install."
        }
      />

      <div className="space-y-5">
        <ul className="overflow-hidden rounded-2xl border border-border bg-card" aria-label="Launch checklist">
          {items.map((item, i) => {
            const blocked = item.required && !item.done
            return (
              <li key={item.key} className={cn("flex items-start gap-3 px-4 py-3.5", i > 0 && "border-t border-border")}>
                {item.done
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#16A34A]" aria-label="Done" />
                  : blocked
                    ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-label="Needed before launch" />
                    : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[#A8A29E]" aria-label="Still open" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1A1614]">{item.label}</p>
                  <p className={cn("mt-0.5 text-sm leading-relaxed", blocked ? "text-destructive" : "text-muted-foreground")}>{item.detail}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => goTo(item.step)}>
                  {item.done ? "Edit" : "Add"}
                </Button>
              </li>
            )
          })}
        </ul>

        {blocking.length > 0 ? (
          <Notice tone="bad">
            {stepsWithGaps.size === 1 ? "One thing is" : "A few things are"} needed before your dashboard opens: {blocking.map((b) => b.message.toLowerCase()).join(", ")}.
          </Notice>
        ) : open.length > 0 && mode === "onboarding" ? (
          <Notice>
            You can open your dashboard now. Still open: {open.map((o) => o.label.toLowerCase()).join(", ")}. We pick those up with you on the install call.
          </Notice>
        ) : null}

        {finishError && <Notice tone="bad">{finishError}</Notice>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" className="h-11 gap-2 px-5 text-[15px]" disabled={finishing || blocking.length > 0} onClick={onFinish}>
            {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {finishing
              ? "Setting up your assistant"
              : mode === "onboarding" ? "Go to my dashboard" : "Save and retrain my assistant"}
          </Button>
          {finishing && <p className="text-sm text-muted-foreground" role="status">This takes about a minute. Keep this page open.</p>}
        </div>
      </div>
    </div>
  )
}
