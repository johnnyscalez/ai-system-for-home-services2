"use client"

// The flooring onboarding wizard. One component, two homes:
//   /onboarding       mode="onboarding"  ordered steps, saves as you type, resumes where you left off
//   /settings/setup   mode="edit"        any step in any order, explicit Save, changes go live on save
//
// Everything the owner enters is stored through /api/onboarding/state. Nothing
// reaches the live assistant until onboarding finishes (or, in edit mode, on Save).

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/site/ui"
import { createClient } from "@/lib/supabase"
import type { A2pState, CompanyIntake, IntakePhoto } from "@/lib/intake"
import { cn } from "@/lib/utils"
import { STEPS, TONES } from "./constants"
import type { StepId } from "./constants"
import { a2pMissing, assetsOf, commitStepDefaults, DEFAULT_AGENT, EMPTY_KB, normalizeWebsite, validateStep } from "./logic"
import type { ScanSummary, WizardContext, WizardData, WizardKb } from "./logic"
import { StepBusiness, StepReview } from "./steps-business"
import { StepAreas, StepCustomer, StepOffer } from "./steps-market"
import { StepAds, StepCalendar, StepFinish, StepNumber, StepPhotos } from "./steps-launch"
import type { StepProps, WizardMode } from "./types"
import { ErrorList, Notice } from "./ui"

type ServerState = {
  company: { id: string; name: string | null; office_address: string | null; notification_phone: string | null; onboarding_completed: boolean } | null
  knowledgeBase: Partial<Record<keyof WizardKb, string | null>> | null
  agent: {
    agent_name: string | null; tone: string | null; working_hours_start: number | null; working_hours_end: number | null
    timezone: string | null; custom_instructions: string | null
  } | null
  intake: CompanyIntake | null
  phoneNumber: string | null
  facebook: { connected: boolean; pageName: string | null; adAccountId: string | null }
  gmailConnected: boolean
  googlePlaces: boolean
  scan: ScanSummary | null
  user: { fullName: string; email: string }
}

const INTAKE_SECTIONS = [
  "progress", "business", "serviceAreas", "excludedAreas", "services", "qualification",
  "offers", "assets", "ads", "domain", "calendar",
] as const

// Changing these changes what the assistant says, so its base prompt is rewritten after a save.
const RETRAIN_AFTER: StepId[] = ["business", "review", "areas", "customer", "offer", "calendar"]

const BLANK_DATA: WizardData = {
  company: { name: "", office_address: "", notification_phone: "" },
  kb: EMPTY_KB,
  agent: DEFAULT_AGENT,
  intake: { version: 1 },
}

const BLANK_CTX: WizardContext = {
  companyId: null,
  onboardingCompleted: false,
  phoneNumber: null,
  facebook: { connected: false, pageName: null, adAccountId: null },
  gmailConnected: false,
  googlePlaces: false,
  scan: null,
  user: { fullName: "", email: "" },
}

/** What a save sends: only the sections onboarding owns, and only the ones the owner has touched. */
function buildPayload(d: WizardData) {
  const intake: Record<string, unknown> = {}
  for (const key of INTAKE_SECTIONS) {
    if (d.intake[key] !== undefined) intake[key] = d.intake[key]
  }
  if (d.intake.a2p?.business) intake.a2p = { business: d.intake.a2p.business }
  return {
    company: d.company,
    knowledgeBase: { ...d.kb, website_url: normalizeWebsite(d.intake.business?.website ?? "") },
    agent: d.agent,
    intake,
  }
}

function fromServer(json: ServerState): { data: WizardData; ctx: WizardContext } {
  const intake: CompanyIntake = { ...(json.intake ?? { version: 1 }), version: 1 }
  if (!json.company) {
    // Brand new: start the owner fields from the login they just created.
    intake.business = { ownerName: json.user.fullName, ownerEmail: json.user.email, ...(intake.business ?? {}) }
  }
  let browserTz = DEFAULT_AGENT.timezone
  try { browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || browserTz } catch { /* keep the default */ }

  const kb = { ...EMPTY_KB }
  for (const key of Object.keys(EMPTY_KB) as Array<keyof WizardKb>) kb[key] = json.knowledgeBase?.[key] ?? ""

  const a = json.agent
  return {
    data: {
      company: {
        name: json.company?.name ?? "",
        office_address: json.company?.office_address ?? "",
        notification_phone: json.company?.notification_phone ?? "",
      },
      kb,
      agent: {
        agent_name: a?.agent_name?.trim() || DEFAULT_AGENT.agent_name,
        tone: a?.tone && TONES.some((t) => t.value === a.tone) ? a.tone : DEFAULT_AGENT.tone,
        working_hours_start: Number.isInteger(a?.working_hours_start) ? (a?.working_hours_start as number) : DEFAULT_AGENT.working_hours_start,
        working_hours_end: Number.isInteger(a?.working_hours_end) ? (a?.working_hours_end as number) : DEFAULT_AGENT.working_hours_end,
        timezone: a?.timezone || browserTz,
        custom_instructions: a?.custom_instructions ?? "",
      },
      intake,
    },
    ctx: {
      companyId: json.company?.id ?? null,
      onboardingCompleted: !!json.company?.onboarding_completed,
      phoneNumber: json.phoneNumber,
      facebook: json.facebook,
      gmailConnected: json.gmailConnected,
      googlePlaces: json.googlePlaces,
      scan: json.scan,
      user: json.user,
    },
  }
}

/** The middleware answers a signed-out API call by redirecting it to the login page. */
function sentToLogin(res: Response): boolean {
  if (!res.redirected) return false
  try { return new URL(res.url).pathname === "/login" } catch { return false }
}

function stepFromParam(raw: string | null): StepId | null {
  if (!raw) return null
  const byId = STEPS.find((s) => s.id === raw)
  if (byId) return byId.id
  const n = Number(raw)
  return STEPS.find((s) => s.n === n)?.id ?? null
}

export function OnboardingWizard({ mode }: { mode: WizardMode }) {
  return (
    <Suspense fallback={<WizardSkeleton mode={mode} />}>
      <Wizard mode={mode} />
    </Suspense>
  )
}

function WizardSkeleton({ mode }: { mode: WizardMode }) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl space-y-4 px-4 py-10", mode === "onboarding" && "min-h-dvh")} aria-busy="true" aria-label="Loading your setup">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

function Wizard({ mode }: { mode: WizardMode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedStep = searchParams.get("step")
  const gmailFailed = searchParams.get("gmail") === "error"

  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  const [data, setData] = useState<WizardData>(BLANK_DATA)
  const [ctx, setCtxState] = useState<WizardContext>(BLANK_CTX)
  const [step, setStep] = useState<StepId>("business")
  const [errors, setErrors] = useState<string[]>([])
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [dirty, setDirty] = useState(false)
  const [navBusy, setNavBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const lastSaved = useRef("")
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const topRef = useRef<HTMLDivElement>(null)

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/onboarding/state", { cache: "no-store" })
        if (res.status === 401 || sentToLogin(res)) { router.push("/login"); return }
        if (!res.ok) throw new Error(`state ${res.status}`)
        const json = (await res.json()) as ServerState
        if (cancelled) return
        const loaded = fromServer(json)
        lastSaved.current = JSON.stringify(buildPayload(loaded.data))
        setData(loaded.data)
        setCtxState(loaded.ctx)
        const saved = STEPS.find((s) => s.n === loaded.data.intake.progress?.step)?.id
        setStep(stepFromParam(requestedStep) ?? (mode === "onboarding" ? saved ?? "business" : "business"))
        setStatus("ready")
      } catch {
        if (!cancelled) setStatus("failed")
      }
    })()
    return () => { cancelled = true }
    // The requested step is only read on the first load of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, mode, router])

  // ── Saving ─────────────────────────────────────────────────────────────────
  // Saves, uploads and the number reservation all rewrite the same stored
  // document. Running them one after another is what keeps them from undoing
  // each other.
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(fn, fn)
    queue.current = run.catch(() => undefined)
    return run
  }, [])

  const persist = useCallback(
    async (d: WizardData, opts: { apply?: boolean; force?: boolean } = {}): Promise<boolean> => {
      const payload = buildPayload(d)
      const snapshot = JSON.stringify(payload)
      if (!opts.force && !opts.apply && snapshot === lastSaved.current) return true
      setSaveState("saving")
      try {
        const result = await enqueue(async () => {
          const res = await fetch("/api/onboarding/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(opts.apply ? { ...payload, apply: true } : payload),
          })
          const json = (await res.json().catch(() => ({}))) as {
            saved?: boolean; companyId?: string; photos?: IntakePhoto[]; a2p?: A2pState | null
          }
          return { ok: res.ok && !sentToLogin(res), expired: res.status === 401 || sentToLogin(res), json }
        })
        if (result.expired) {
          // The session ran out. What was typed since the last save is still on
          // screen, but it can only be saved after signing in again.
          setSaveState("error")
          router.push("/login")
          return false
        }
        if (!result.ok) { setSaveState("error"); return false }
        // No company name yet: there is nothing to save against, which is not an error.
        if (result.json.saved === false) { setSaveState("idle"); return false }
        lastSaved.current = snapshot
        setSaveState("saved")
        setDirty(false)
        const companyId = result.json.companyId
        if (companyId) setCtxState((c) => (c.companyId === companyId ? c : { ...c, companyId }))
        // The registration status belongs to the server; take its word for it.
        const serverA2p = result.json.a2p
        if (serverA2p?.status) {
          setData((cur) =>
            cur.intake.a2p && cur.intake.a2p.status !== serverA2p.status && !["not_started", "info_collected"].includes(serverA2p.status)
              ? { ...cur, intake: { ...cur.intake, a2p: { ...serverA2p, business: cur.intake.a2p.business ?? serverA2p.business } } }
              : cur
          )
        }
        return true
      } catch {
        setSaveState("error")
        return false
      }
    },
    [enqueue, router]
  )

  // Onboarding saves as the owner types. Settings waits for the Save button,
  // because there a save changes how the live assistant behaves.
  useEffect(() => {
    if (status !== "ready" || mode !== "onboarding") return
    const t = setTimeout(() => { void persist(data) }, 900)
    return () => clearTimeout(t)
  }, [data, status, mode, persist])

  useEffect(() => {
    const unsaved = saveState === "saving" || (mode === "edit" && dirty)
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [saveState, dirty, mode])

  // ── Editing ────────────────────────────────────────────────────────────────
  const update = useCallback((fn: (d: WizardData) => WizardData) => {
    setData(fn)
    setDirty(true)
    setErrors((e) => (e.length ? [] : e))
    setSavedNote(null)
  }, [])
  const setIntake = useCallback(
    (patch: Partial<CompanyIntake>) => update((d) => ({ ...d, intake: { ...d.intake, ...patch } })),
    [update]
  )
  const setCtx = useCallback((patch: Partial<WizardContext>) => setCtxState((c) => ({ ...c, ...patch })), [])

  // ── Moving between steps ───────────────────────────────────────────────────
  const index = STEPS.findIndex((s) => s.id === step)
  const current = STEPS[index]
  const completed = data.intake.progress?.completedSteps ?? []
  const furthest = Math.max(current.n, data.intake.progress?.step ?? 1, completed.length ? Math.max(...completed) + 1 : 1)
  const canOpen = (n: number) => mode === "edit" || n <= furthest

  function show(target: StepId) {
    setStep(target)
    setErrors([])
    setMenuOpen(false)
    setSavedNote(null)
    topRef.current?.scrollIntoView({ block: "start" })
  }

  /** Files the registration details with the registration service when it is installed. */
  function sendRegistrationDetails(d: WizardData) {
    const business = d.intake.a2p?.business
    if (!business || a2pMissing(business).length > 0) return
    void enqueue(async () => {
      try {
        const res = await fetch("/api/a2p/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business, submit: false }),
        })
        // 404: the registration route is not deployed yet. The details are
        // already saved on the intake, so nothing is lost.
        if (!res.ok) return
        const json = (await res.json().catch(() => ({}))) as { a2p?: A2pState }
        if (json.a2p?.status) {
          setData((cur) => ({ ...cur, intake: { ...cur.intake, a2p: { ...json.a2p!, business: cur.intake.a2p?.business ?? json.a2p!.business } } }))
        }
      } catch { /* same as above */ }
    })
  }

  async function goNext() {
    const next = STEPS[index + 1]
    if (!next || navBusy) return
    const committed = commitStepDefaults(step, data)
    const problems = validateStep(step, committed)
    if (problems.length > 0) {
      setErrors(problems)
      return
    }
    const withProgress: WizardData = {
      ...committed,
      intake: {
        ...committed.intake,
        progress: {
          ...committed.intake.progress,
          step: Math.max(next.n, committed.intake.progress?.step ?? 1),
          completedSteps: [...new Set([...completed, current.n])].sort((a, b) => a - b),
        },
      },
    }
    setData(withProgress)
    setNavBusy(true)
    const ok = await persist(withProgress, { force: true })
    setNavBusy(false)
    if (!ok) {
      setErrors(["That did not save. Check your connection and press Continue again."])
      return
    }
    if (step === "number") sendRegistrationDetails(withProgress)
    show(next.id)
  }

  function goBack() {
    const prev = STEPS[index - 1]
    if (prev) show(prev.id)
  }

  async function goTo(target: StepId) {
    const n = STEPS.find((s) => s.id === target)?.n ?? 1
    if (!canOpen(n) || target === step) { setMenuOpen(false); return }
    if (mode === "edit" && dirty) {
      const ok = await saveEdits()
      if (!ok) return
    }
    show(target)
  }

  /** Settings: save this section and make it live. */
  async function saveEdits(): Promise<boolean> {
    const committed = commitStepDefaults(step, data)
    const problems = validateStep(step, committed)
    if (problems.length > 0) { setErrors(problems); return false }
    setData(committed)
    setNavBusy(true)
    const ok = await persist(committed, { apply: true })
    setNavBusy(false)
    if (!ok) { setErrors(["That did not save. Check your connection and try again."]); return false }
    if (step === "number") sendRegistrationDetails(committed)
    if (RETRAIN_AFTER.includes(step)) {
      // The live settings are already updated. The assistant's base prompt is
      // rewritten in the background; it takes about a minute.
      void enqueue(() => fetch("/api/onboarding/complete", { method: "POST", keepalive: true }).then(() => undefined, () => undefined))
      setSavedNote("Saved and live. Your assistant is being updated with the change, which takes about a minute.")
    } else {
      setSavedNote("Saved.")
    }
    return true
  }

  async function finish() {
    setFinishing(true)
    setFinishError(null)
    try {
      const ok = await persist(data, { force: true })
      if (!ok) throw new Error("Your last changes did not save. Check your connection and try again.")
      const res = await enqueue(() => fetch("/api/onboarding/complete", { method: "POST" }))
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Setup did not finish. Please try again.")
      if (mode === "onboarding") {
        router.push("/dashboard")
        router.refresh()
        return
      }
      setSavedNote("Saved. Your assistant has been retrained on everything above.")
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : "Setup did not finish. Please try again.")
    }
    setFinishing(false)
  }

  async function signOut() {
    await persist(data)
    await createClient().auth.signOut()
    router.push("/login")
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (status === "loading") return <WizardSkeleton mode={mode} />
  if (status === "failed") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#1A1614]">We could not load your setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again. Nothing you entered is lost.</p>
        <Button type="button" className="mt-5 h-10 px-4" onClick={() => { setStatus("loading"); setReloadKey((k) => k + 1) }}>Try again</Button>
      </div>
    )
  }

  const stepProps: StepProps = { data, ctx, mode, update, setIntake, setCtx, save: () => persist(data), enqueue, goTo: (s) => void goTo(s) }
  const isFinish = step === "finish"
  const photoCount = assetsOf(data.intake).photos.length

  const saveBadge = (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      {saveState === "saving" && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving</>)}
      {saveState === "saved" && !(mode === "edit" && dirty) && (<><Check className="h-3.5 w-3.5 text-[#16A34A]" /> Saved</>)}
      {saveState === "error" && (
        <button type="button" className="font-medium text-destructive underline underline-offset-4" onClick={() => void persist(data, { force: true })}>
          Not saved. Tap to retry
        </button>
      )}
      {mode === "edit" && dirty && saveState !== "saving" && saveState !== "error" && "Unsaved changes"}
    </span>
  )

  const stepList = (
    <ol className="space-y-0.5">
      {STEPS.map((s) => {
        const isCurrent = s.id === step
        const done = mode === "onboarding" ? completed.includes(s.n) && !isCurrent : false
        const reachable = canOpen(s.n)
        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={!reachable}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => void goTo(s.id)}
              className={cn(
                "flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                isCurrent ? "bg-white font-semibold text-[#1A1614] shadow-[0_0_0_1px_#E7E5E4]" : reachable ? "text-[#44403C] hover:bg-white" : "cursor-not-allowed text-[#A8A29E]"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px]",
                  isCurrent ? "bg-primary text-white" : done ? "bg-[#16A34A] text-white" : "border border-[#D6D3D1] bg-white text-[#78716C]"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.n}
              </span>
              <span className="min-w-0 truncate">{s.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )

  const mobileProgress = (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="wizard-steps"
        onClick={() => setMenuOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Step {current.n} of {STEPS.length}</span>
          <span className="block truncate text-sm font-semibold text-[#1A1614]">{current.label}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", menuOpen && "rotate-180")} />
      </button>
      <div className="h-1 bg-[#E7E5E4]" aria-hidden="true">
        <div className="h-1 bg-primary transition-[width] duration-300" style={{ width: `${(current.n / STEPS.length) * 100}%` }} />
      </div>
      {menuOpen && <nav id="wizard-steps" aria-label="Setup steps" className="border-b border-border bg-[#FAFAF8] p-2">{stepList}</nav>}
    </div>
  )

  let body: React.ReactNode = null
  if (step === "business") body = <StepBusiness {...stepProps} />
  else if (step === "review") body = <StepReview {...stepProps} />
  else if (step === "areas") body = <StepAreas {...stepProps} />
  else if (step === "customer") body = <StepCustomer {...stepProps} />
  else if (step === "offer") body = <StepOffer {...stepProps} />
  else if (step === "photos") body = <StepPhotos {...stepProps} />
  else if (step === "ads") body = <StepAds {...stepProps} />
  else if (step === "number") body = <StepNumber {...stepProps} />
  else if (step === "calendar") body = <StepCalendar {...stepProps} />
  else body = <StepFinish {...stepProps} onFinish={() => void finish()} finishing={finishing} finishError={finishError} />

  const footer = (
    <div className={cn(
      "sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-[#FAFAF8]/95 px-4 py-3 backdrop-blur",
      "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    )}>
      <div className="flex items-center gap-3">
        {mode === "onboarding" ? (
          <>
            <Button type="button" variant="outline" className="h-11 gap-1.5 px-4" disabled={index === 0 || navBusy || finishing} onClick={goBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {!isFinish && (
              <Button type="button" className="h-11 flex-1 gap-1.5 px-5 text-[15px] sm:flex-none" disabled={navBusy} onClick={() => void goNext()}>
                {navBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
                {!navBusy && <ArrowRight className="h-4 w-4" />}
              </Button>
            )}
            {step === "photos" && photoCount === 0 && !navBusy && (
              <span className="hidden text-xs text-muted-foreground sm:inline">You can add photos later.</span>
            )}
          </>
        ) : (
          !isFinish && (
            <>
              <Button type="button" className="h-11 gap-1.5 px-5 text-[15px]" disabled={navBusy || !dirty} onClick={() => void saveEdits()}>
                {navBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
              {saveBadge}
            </>
          )
        )}
      </div>
    </div>
  )

  const main = (
    <main className="min-w-0 flex-1 pb-4 pt-6 lg:pt-10">
      <div className="mx-auto w-full max-w-2xl">
        {gmailFailed && step === "calendar" && (
          <Notice tone="warn" className="mb-5">Google did not grant access. You can try the Gmail connection again at the bottom of this page.</Notice>
        )}
        {body}
        <div className="mt-5 space-y-3">
          <ErrorList errors={errors} />
          {savedNote && <Notice tone="good">{savedNote}</Notice>}
        </div>
        {footer}
      </div>
    </main>
  )

  if (mode === "edit") {
    return (
      <div ref={topRef} className="scroll-mt-16">
        <div className="border-b border-border px-4 py-5 lg:px-8">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-[#1A1614]">Account setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you told us at onboarding. Change any section and save; your assistant follows the new settings right away.</p>
        </div>
        <div className="border-b border-border">{mobileProgress}</div>
        <div className="mx-auto flex w-full max-w-5xl gap-10 px-4 lg:px-8">
          <nav aria-label="Setup sections" className="sticky top-6 hidden h-fit w-60 shrink-0 py-10 lg:block">{stepList}</nav>
          {main}
        </div>
      </div>
    )
  }

  return (
    <div ref={topRef} className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-[#FAFAF8]/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 lg:px-8">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            {saveBadge}
            <button type="button" onClick={() => void signOut()}
              className="flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-[#1A1614] focus-visible:ring-2 focus-visible:ring-ring">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        {mobileProgress}
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-10 px-4 lg:px-8">
        <nav aria-label="Setup steps" className="sticky top-24 hidden h-fit w-60 shrink-0 py-10 lg:block">
          <p className="mb-3 px-2.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Your setup</p>
          {stepList}
        </nav>
        {main}
      </div>
    </div>
  )
}
