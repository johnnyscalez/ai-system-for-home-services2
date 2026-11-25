"use client"

// Steps 3 to 5: where the company works, who it wants as a customer, and the offer.

import { useId, useRef, useState } from "react"
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OFFER_CATALOG, offerHeadline } from "@/lib/intake"
import type { OfferConfig, OfferType, QualifyingQuestion, QualificationRules, ServiceAreaPlace } from "@/lib/intake"
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/job-types"
import { cn } from "@/lib/utils"
import { PROPERTY_SCOPES, US_STATES } from "./constants"
import { offersOf, qualificationOf, questionKey, servicesOf } from "./logic"
import type { StepProps } from "./types"
import { AreaField, CheckTile, Chip, Field, NativeSelect, Notice, Section, Segmented, StepIntro, Switch, TextField } from "./ui"

// ── Step 3: service areas ────────────────────────────────────────────────────

type Suggestion = { placeId: string; text: string; main: string; secondary: string; kind: string }

function AreaCombobox({
  state, existing, onAdd, initiallyAvailable, mentioned,
}: {
  state: string
  existing: ServiceAreaPlace[]
  onAdd: (area: ServiceAreaPlace) => void
  initiallyAvailable: boolean
  /** Area names found on the owner's website, offered as one-tap searches */
  mentioned: string[]
}) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [available, setAvailable] = useState(initiallyAvailable)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestNo = useRef(0)
  const sessionToken = useRef("")
  const listId = useId()

  const has = (area: { placeId?: string | null; name: string }) =>
    existing.some((e) => (area.placeId && e.placeId === area.placeId) || e.name.toLowerCase() === area.name.toLowerCase())

  function token() {
    if (!sessionToken.current) sessionToken.current = crypto.randomUUID().replace(/-/g, "")
    return sessionToken.current
  }

  async function search(q: string) {
    const no = ++requestNo.current
    setLoading(true)
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}&state=${encodeURIComponent(state)}&session=${token()}`)
      const json = (await res.json().catch(() => ({}))) as { available?: boolean; suggestions?: Suggestion[] }
      if (no !== requestNo.current) return
      if (!res.ok || json.available === false) {
        setAvailable(false)
        setSuggestions([])
        setOpen(false)
        return
      }
      setAvailable(true)
      setSuggestions(json.suggestions ?? [])
      setActive(-1)
      setOpen(true)
    } catch {
      if (no === requestNo.current) { setSuggestions([]); setOpen(false) }
    } finally {
      if (no === requestNo.current) setLoading(false)
    }
  }

  function onType(value: string) {
    setQuery(value)
    setNote(null)
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    if (!available || q.length < 2) {
      requestNo.current++
      setSuggestions([])
      setOpen(false)
      setLoading(false)
      return
    }
    timer.current = setTimeout(() => { void search(q) }, 220)
  }

  function finish(area: ServiceAreaPlace) {
    if (has(area)) setNote(`${area.name} is already on your list.`)
    else onAdd(area)
    setQuery("")
    setSuggestions([])
    setOpen(false)
    setActive(-1)
    sessionToken.current = ""
    inputRef.current?.focus()
  }

  async function pick(s: Suggestion) {
    if (timer.current) clearTimeout(timer.current)
    requestNo.current++
    setOpen(false)
    setAdding(true)
    let area: ServiceAreaPlace | null = null
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(s.placeId)}&session=${token()}`)
      if (res.ok) area = ((await res.json()) as { place?: ServiceAreaPlace }).place ?? null
    } catch { /* fall through to the name-only area below */ }
    setAdding(false)
    // The map lookup failed: keep the area by name. It still tells the assistant where you work.
    finish(area ?? { name: s.text, state: s.secondary.match(/\b[A-Z]{2}\b/)?.[0] ?? null, placeId: s.placeId, kind: "typed" })
  }

  function addTyped() {
    const raw = query.trim().replace(/\s+/g, " ")
    if (raw.length < 2) return
    const name = /,\s*[A-Za-z]{2}$/.test(raw) || !state || /^\d{5}$/.test(raw) ? raw : `${raw}, ${state}`
    finish({ name, state: state || null, placeId: null, kind: "typed" })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (adding) return
      if (open && suggestions.length > 0) void pick(suggestions[active >= 0 ? active : 0])
      else addTyped()
    } else if (e.key === "Escape") {
      setOpen(false)
      setActive(-1)
    }
  }

  const showList = open && suggestions.length > 0
  const unused = mentioned.filter((m) => !existing.some((e) => e.name.toLowerCase().startsWith(m.toLowerCase())))

  return (
    <div className="space-y-2">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="area-search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder={state ? "Start typing a city, county or zip" : "Pick your state first, then type a city"}
          value={query}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          onBlur={() => setOpen(false)}
          className="h-11 bg-white pl-9 pr-24"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {(loading || adding) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          <Button type="button" variant="outline" size="sm" className="h-8" disabled={adding || query.trim().length < 2}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (showList ? void pick(suggestions[active >= 0 ? active : 0]) : addTyped())}>
            Add
          </Button>
        </div>

        {showList && (
          <ul id={listId} role="listbox" aria-label="Matching areas"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-lg">
            {suggestions.map((s, i) => (
              <li key={s.placeId} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => void pick(s)}
                className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm", i === active ? "bg-[#F5F4F2]" : "bg-white")}>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[#1A1614]">{s.main}</span>
                  {s.secondary && <span className="block truncate text-xs text-muted-foreground">{s.secondary}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {s.kind === "county" ? "County" : s.kind === "postal_code" ? "Zip" : s.kind === "neighborhood" ? "Neighborhood" : "City"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
        {note ?? (available
          ? "Pick from the list as you type. Add as many areas as you work in, including ones across the state line."
          : "Suggestions are unavailable right now. Type an area and press Enter to add it.")}
      </p>

      {unused.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Your website mentions:</span>
          {unused.slice(0, 10).map((name) => (
            <button key={name} type="button"
              onClick={() => { inputRef.current?.focus(); onType(name) }}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed border-[#A8A29E] bg-white px-2.5 text-xs text-[#1A1614] outline-none hover:border-[#1A1614] focus-visible:ring-2 focus-visible:ring-ring">
              <Plus className="h-3 w-3 text-muted-foreground" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function StepAreas({ data, ctx, update, setIntake }: StepProps) {
  const state = data.intake.business?.state ?? ""
  const areas = data.intake.serviceAreas ?? []
  const mentioned = (ctx.scan?.serviceAreas ?? "")
    .split(/[,;\n]|\band\b/)
    .map((x) => x.replace(/\(.*?\)/g, "").trim())
    .filter((x) => x.length >= 3 && x.length <= 40 && !/\d{3,}/.test(x))

  return (
    <div>
      <StepIntro
        title="Where do you work?"
        lead="Name the cities and areas you send crews to. Your ads only run there, and your assistant only books measures there. No zip codes needed."
      />

      <div className="space-y-5">
        <Section>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Country">
              <div className="flex h-10 items-center rounded-lg border border-border bg-[#F5F4F2] px-2.5 text-sm text-[#44403C]">United States</div>
            </Field>
            <Field label="State" htmlFor="areas-state">
              <NativeSelect id="areas-state" value={state} placeholder="Select your state"
                onChange={(code) => update((d) => ({ ...d, intake: { ...d.intake, business: { ...(d.intake.business ?? {}), state: code } } }))}
                options={US_STATES.map((s) => ({ value: s.code, label: s.name }))} />
            </Field>
          </div>

          <Field label="Cities and areas you serve" htmlFor="area-search">
            <AreaCombobox state={state} existing={areas} initiallyAvailable={ctx.googlePlaces} mentioned={mentioned}
              onAdd={(area) => setIntake({ serviceAreas: [...areas, area] })} />
          </Field>

          {areas.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-[#1A1614]">{areas.length} area{areas.length === 1 ? "" : "s"} added</p>
              <ul className="flex flex-wrap gap-2" aria-label="Areas you serve">
                {areas.map((a) => (
                  <li key={a.placeId ?? a.name}>
                    <Chip removeLabel={`Remove ${a.name}`} onRemove={() => setIntake({ serviceAreas: areas.filter((x) => x !== a) })}>{a.name}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Notice>Nothing added yet. Start with the city your office is in, then add the ones around it.</Notice>
          )}
        </Section>

        <Section>
          <AreaField id="excludedAreas" label="Areas you do not serve" optional rows={2} maxLength={1000}
            value={data.intake.excludedAreas ?? ""} onChange={(v) => setIntake({ excludedAreas: v })}
            placeholder="Downtown high-rises, anything south of I-20"
            hint="Anywhere inside the areas above that you turn down." />
        </Section>
      </div>
    </div>
  )
}

// ── Step 4: ideal customer ───────────────────────────────────────────────────

const FLOORING_TYPES = JOB_TYPES.filter((t) => t !== "other")

function NumberRule({
  id, label, hint, value, onChange, prefix, suffix, placeholder,
}: {
  id: string; label: string; hint: string; value: number | null; onChange: (v: number | null) => void
  prefix?: string; suffix?: string; placeholder: string
}) {
  return (
    <Field label={label} hint={hint} optional htmlFor={id}>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <Input id={id} inputMode="numeric" placeholder={placeholder} value={value ?? ""} className="h-10 w-32 bg-white"
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "")
            onChange(digits ? Number(digits) : null)
          }} />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </Field>
  )
}

export function StepCustomer({ data, setIntake }: StepProps) {
  const services = servicesOf(data.intake)
  const qual = qualificationOf(data.intake)
  const [newQuestion, setNewQuestion] = useState("")

  const setServices = (patch: Partial<typeof services>) => setIntake({ services: { ...services, ...patch } })
  const setQuestions = (questions: QualifyingQuestion[]) => setIntake({ qualification: { ...qual, questions } })
  const setRules = (patch: Partial<QualificationRules>) => setIntake({ qualification: { ...qual, rules: { ...qual.rules, ...patch } } })
  const patchQuestion = (key: string, patch: Partial<QualifyingQuestion>) =>
    setQuestions(qual.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)))

  function addQuestion() {
    const text = newQuestion.trim()
    if (!text) return
    setQuestions([
      ...qual.questions,
      { key: questionKey(text, qual.questions.map((q) => q.key)), question: text, required: false, enabled: true, custom: true },
    ])
    setNewQuestion("")
  }

  const allOn = services.flooringTypes.length === FLOORING_TYPES.length

  return (
    <div>
      <StepIntro
        title="Who is your ideal customer?"
        lead="This decides who your ads speak to and who your assistant books. A lead that does not fit is turned away politely before it reaches your calendar."
      />

      <div className="space-y-5">
        <Section title="What you install">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FLOORING_TYPES.map((t) => (
              <CheckTile key={t} label={JOB_TYPE_LABELS[t]} checked={services.flooringTypes.includes(t)}
                onChange={(on) => setServices({ flooringTypes: on ? [...services.flooringTypes, t] : services.flooringTypes.filter((x) => x !== t) })} />
            ))}
          </div>
          <button type="button" className="text-sm text-muted-foreground underline underline-offset-4 outline-none hover:text-[#1A1614] focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setServices({ flooringTypes: allOn ? [] : [...FLOORING_TYPES] })}>
            {allOn ? "Clear all" : "Select all"}
          </button>
          <Field label="You work on">
            <Segmented label="Property type" value={services.propertyScope} onChange={(v) => setServices({ propertyScope: v })} options={PROPERTY_SCOPES} />
          </Field>
          <AreaField id="notOffered" label="Jobs you do not take" optional rows={2} maxLength={1000} value={services.notOffered ?? ""}
            onChange={(v) => setServices({ notOffered: v })} placeholder="Water damage claims, single room carpet patches, sanding only" />
        </Section>

        <Section title="Questions your assistant asks" hint="Switch on the ones that matter to you and put them in your own words. Anything marked as a must is answered before a measure is booked.">
          <ul className="space-y-2">
            {qual.questions.map((q) => (
              <li key={q.key} className={cn("rounded-xl border bg-white p-3", q.enabled ? "border-border" : "border-border opacity-70")}>
                <div className="flex items-start gap-3">
                  <div className="pt-2"><Switch checked={q.enabled} onChange={(on) => patchQuestion(q.key, { enabled: on })} label={`Ask: ${q.question}`} /></div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input aria-label="Question wording" value={q.question} disabled={!q.enabled} maxLength={300}
                      onChange={(e) => patchQuestion(q.key, { question: e.target.value })} className="h-10 bg-white" />
                    {q.enabled && (
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-[#44403C]">
                        <input type="checkbox" checked={q.required} onChange={(e) => patchQuestion(q.key, { required: e.target.checked })}
                          className="h-4 w-4 accent-[#1A1614]" />
                        Must answer before booking
                      </label>
                    )}
                  </div>
                  {q.custom && (
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove this question"
                      onClick={() => setQuestions(qual.questions.filter((x) => x.key !== q.key))}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Field label="Add your own question" optional htmlFor="newQuestion">
            <div className="flex gap-2">
              <Input id="newQuestion" value={newQuestion} maxLength={300} placeholder="Do you have pets in the home?"
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuestion() } }} className="h-10 flex-1 bg-white" />
              <Button type="button" variant="outline" className="h-10 gap-1.5 px-3" disabled={!newQuestion.trim() || qual.questions.length >= 20} onClick={addQuestion}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </Field>
        </Section>

        <Section title="Who you do not book" hint="Your assistant holds to these. It never tells a lead the numbers below.">
          <div className="space-y-2">
            {([
              ["homeownersOnly", "Homeowners only", "Renters need the landlord's approval before a measure is booked."],
              ["requireDecisionMakers", "Every decision maker must be home", "No more driving out to hear that a spouse needs to see it first."],
              ["excludeMaterialOnly", "No material only sales", "Turn away leads who want to buy flooring without installation."],
              ["excludeRepairsOnly", "No repair or patch jobs", "Turn away small fixes. You install and replace floors."],
            ] as const).map(([key, label, hint]) => (
              <div key={key} className="flex items-start gap-3 rounded-xl border border-border bg-white px-3 py-3">
                <div className="pt-0.5"><Switch checked={qual.rules[key]} onChange={(on) => setRules({ [key]: on })} label={label} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A1614]">{label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberRule id="minSqft" label="Smallest job" hint="Leave empty for no minimum." placeholder="300" suffix="sq ft"
              value={qual.rules.minSqft} onChange={(v) => setRules({ minSqft: v })} />
            <NumberRule id="minBudget" label="Lowest budget" hint="Leave empty for no minimum." placeholder="2000" prefix="$"
              value={qual.rules.minBudget} onChange={(v) => setRules({ minBudget: v })} />
            <NumberRule id="maxTimeline" label="Latest start" hint="Leave empty for any time." placeholder="6" suffix="months out"
              value={qual.rules.maxTimelineMonths} onChange={(v) => setRules({ maxTimelineMonths: v })} />
          </div>
          <AreaField id="rulesOther" label="Anything else you turn away" optional rows={2} maxLength={1000} value={qual.rules.other}
            onChange={(v) => setRules({ other: v })} placeholder="Mobile homes, rentals managed by a property company" />
        </Section>
      </div>
    </div>
  )
}

// ── Step 5: offer ────────────────────────────────────────────────────────────

const blankOffer = (type: OfferType): OfferConfig => ({ type, headline: "", amount: "", conditions: "", expires: "" })

function OfferEditor({ offer, onChange, idPrefix }: { offer: OfferConfig; onChange: (o: OfferConfig) => void; idPrefix: string }) {
  const entry = OFFER_CATALOG.find((o) => o.type === offer.type)
  const preview = offerHeadline(offer)
  const templateLine = offerHeadline({ ...offer, headline: "" })
  return (
    <div className="space-y-4">
      {entry?.amountLabel && (
        <TextField id={`${idPrefix}-amount`} label={entry.amountLabel} value={offer.amount ?? ""} placeholder={entry.amountPlaceholder}
          onChange={(v) => onChange({ ...offer, amount: v })} maxLength={60} />
      )}
      <TextField id={`${idPrefix}-headline`} label={offer.type === "custom" ? "Your offer, in one line" : "Word it your own way"}
        optional={offer.type !== "custom"} value={offer.headline} maxLength={200}
        placeholder={offer.type === "custom" ? "Free stair treads with any whole home install" : templateLine || "Leave empty to use the line below"}
        onChange={(v) => onChange({ ...offer, headline: v })} />
      <div className="rounded-xl border border-border bg-[#FAFAF8] px-3.5 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How it reads in your ad</p>
        <p className="mt-1 text-[15px] font-semibold text-[#1A1614]">{preview || "Fill in the fields above to see your ad line."}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id={`${idPrefix}-conditions`} label="Conditions" optional value={offer.conditions ?? ""} maxLength={400}
          placeholder="Projects over 500 sq ft" onChange={(v) => onChange({ ...offer, conditions: v })}
          hint="Minimums and exclusions. Your assistant sticks to them." />
        <TextField id={`${idPrefix}-expires`} label="Ends" optional value={offer.expires ?? ""} maxLength={80}
          placeholder="December 31" onChange={(v) => onChange({ ...offer, expires: v })} hint="Leave empty if it has no end date." />
      </div>
    </div>
  )
}

export function StepOffer({ data, setIntake }: StepProps) {
  const offers = offersOf(data.intake)
  const set = (patch: Partial<typeof offers>) => setIntake({ offers: { ...offers, ...patch } })
  const primaryType = offers.primary?.type ?? ""

  function choosePrimary(type: OfferType | "") {
    if (!type) { set({ primary: null }); return }
    if (type === primaryType) return
    // A free measure as the headline offer and a paid measure cannot both be true.
    set({ primary: blankOffer(type), ...(type === "free_measure" ? { measureIsFree: true, measureFee: "" } : {}) })
  }

  return (
    <div>
      <StepIntro
        title="What is your offer?"
        lead="Pick the one thing your ads lead with. We advertise exactly what you enter here and nothing else, and your assistant quotes it the same way."
      />

      <div className="space-y-5">
        <Section title="Main offer">
          <div role="radiogroup" aria-label="Main offer" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OFFER_CATALOG.map((o) => {
              const selected = primaryType === o.type
              return (
                <button key={o.type} type="button" role="radio" aria-checked={selected} onClick={() => choosePrimary(o.type)}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "border-[#1A1614] bg-white ring-1 ring-[#1A1614]" : "border-border bg-white hover:border-[#A8A29E]"
                  )}>
                  <span className="block text-sm font-semibold text-[#1A1614]">{o.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{o.description}</span>
                </button>
              )
            })}
            <button type="button" role="radio" aria-checked={!primaryType} onClick={() => choosePrimary("")}
              className={cn(
                "rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 sm:col-span-2",
                !primaryType ? "border-[#1A1614] bg-white ring-1 ring-[#1A1614]" : "border-border bg-white hover:border-[#A8A29E]"
              )}>
              <span className="block text-sm font-semibold text-[#1A1614]">No special offer right now</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Your ads lead with the in-home measure and your work.</span>
            </button>
          </div>
          {offers.primary && (
            <div className="border-t border-border pt-4">
              <OfferEditor idPrefix="primary" offer={offers.primary} onChange={(o) => set({ primary: o })} />
            </div>
          )}
        </Section>

        <Section title="Other offers" hint="Anything else a homeowner can get. Your assistant can mention these when asked.">
          {offers.secondary.map((o, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-3">
              <div className="mb-3 flex items-center gap-2">
                <NativeSelect ariaLabel={`Extra offer ${i + 1} type`} value={o.type} className="flex-1"
                  onChange={(v) => set({ secondary: offers.secondary.map((x, j) => (j === i ? blankOffer(v as OfferType) : x)) })}
                  options={OFFER_CATALOG.map((c) => ({ value: c.type, label: c.label }))} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove extra offer ${i + 1}`}
                  onClick={() => set({ secondary: offers.secondary.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              <OfferEditor idPrefix={`secondary-${i}`} offer={o} onChange={(next) => set({ secondary: offers.secondary.map((x, j) => (j === i ? next : x)) })} />
            </div>
          ))}
          {offers.secondary.length < 3 && (
            <Button type="button" variant="outline" className="h-10 gap-1.5 px-3"
              onClick={() => set({ secondary: [...offers.secondary, blankOffer(primaryType === "financing" ? "free_removal" : "financing")] })}>
              <Plus className="h-4 w-4" /> Add another offer
            </Button>
          )}
        </Section>

        <Section title="The in-home measure" hint="Homeowners ask this first, so your assistant needs a straight answer.">
          <Segmented label="Is the measure free" value={offers.measureIsFree ? "free" : "fee"}
            onChange={(v) => set({ measureIsFree: v === "free", ...(v === "free" ? { measureFee: "" } : {}) })}
            options={[
              { value: "free", label: "Free", hint: "No charge, no obligation" },
              { value: "fee", label: "There is a fee", hint: "You charge to come out" },
            ]} />
          {!offers.measureIsFree && (
            <>
              <TextField id="measureFee" label="What does it cost?" value={offers.measureFee ?? ""} maxLength={200}
                placeholder="$49, credited toward the job if you go ahead" onChange={(v) => set({ measureFee: v })} />
              {primaryType === "free_measure" && <Notice tone="warn">Your main offer is a free in-home measure. Change one of the two so they agree.</Notice>}
            </>
          )}
        </Section>
      </div>
    </div>
  )
}
