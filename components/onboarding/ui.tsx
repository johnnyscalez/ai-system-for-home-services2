"use client"

// Small form building blocks for the onboarding wizard. Built on the shared
// shadcn inputs; everything here is sized for a thumb on a 390px screen.

import * as React from "react"
import { Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export const INK = "#1A1614"

export function StepIntro({ title, lead }: { title: string; lead?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#1A1614] sm:text-[30px]">{title}</h1>
      {lead && <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{lead}</p>}
    </div>
  )
}

export function Section({ title, hint, children, className }: { title?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      {title && <h2 className="text-[15px] font-bold text-[#1A1614]">{title}</h2>}
      {hint && <p className={cn("text-sm leading-relaxed text-muted-foreground", title && "mt-1")}>{hint}</p>}
      <div className={cn((title || hint) && "mt-4", "space-y-4")}>{children}</div>
    </section>
  )
}

export function Field({
  label, hint, error, optional, htmlFor, children, className,
}: {
  label: string
  hint?: React.ReactNode
  error?: string | null
  optional?: boolean
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-[#1A1614]">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function TextField({
  id, label, value, onChange, hint, optional, placeholder, type = "text", inputMode, autoComplete, onBlur, maxLength, className, disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  hint?: React.ReactNode
  optional?: boolean
  placeholder?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  autoComplete?: string
  onBlur?: () => void
  maxLength?: number
  className?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint} optional={optional} htmlFor={id} className={className}>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-10 bg-white"
      />
    </Field>
  )
}

export function AreaField({
  id, label, value, onChange, hint, optional, placeholder, rows = 3, maxLength,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  hint?: React.ReactNode
  optional?: boolean
  placeholder?: string
  rows?: number
  maxLength?: number
}) {
  return (
    <Field label={label} hint={hint} optional={optional} htmlFor={id}>
      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white"
      />
    </Field>
  )
}

/** Native select: the right control on a phone, and it shows the label rather than the stored value. */
export function NativeSelect({
  id, value, onChange, options, placeholder, className, ariaLabel,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-base text-[#1A1614] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
        !value && "text-muted-foreground",
        className
      )}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

/** One choice out of a few, shown side by side (stacks on narrow screens when `stack`). */
export function Segmented<T extends string | number>({
  label, value, onChange, options, stack,
}: {
  label: string
  value: T | ""
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; hint?: string }>
  stack?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", stack ? "sm:grid-cols-3" : "grid-cols-3")}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-xl border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-[#1A1614] bg-white font-semibold text-[#1A1614] ring-1 ring-[#1A1614]" : "border-border bg-white text-[#44403C] hover:border-[#A8A29E]"
            )}
          >
            <span className="block">{o.label}</span>
            {o.hint && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** A tick-box tile for picking several things from a list. */
export function CheckTile({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        checked ? "border-[#1A1614] bg-white text-[#1A1614] ring-1 ring-[#1A1614]" : "border-border bg-white text-[#44403C] hover:border-[#A8A29E]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border",
          checked ? "border-[#1A1614] bg-[#1A1614]" : "border-[#A8A29E] bg-white"
        )}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={cn("block", checked && "font-semibold")}>{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}

export function Switch({
  checked, onChange, label, id,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        checked ? "bg-[#1A1614]" : "bg-[#D6D3D1]"
      )}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  )
}

/** A labelled on/off row: the label is the click target too. */
export function SwitchRow({
  checked, onChange, label, hint, children,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="pt-0.5"><Switch checked={checked} onChange={onChange} label={label} /></div>
        <button type="button" tabIndex={-1} onClick={() => onChange(!checked)} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-medium text-[#1A1614]">{label}</span>
          {hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{hint}</span>}
        </button>
      </div>
      {checked && children && <div className="mt-3 pl-14">{children}</div>}
    </div>
  )
}

export function Chip({ children, onRemove, removeLabel }: { children: React.ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-white py-1 pl-3 pr-1 text-sm text-[#1A1614]">
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? "Remove"}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-[#1A1614] focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  )
}

export function Notice({ tone = "plain", children, className }: { tone?: "plain" | "warn" | "good" | "bad"; children: React.ReactNode; className?: string }) {
  const tones = {
    plain: "border-border bg-[#F5F4F2] text-[#44403C]",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    good: "border-green-200 bg-green-50 text-green-900",
    bad: "border-red-200 bg-red-50 text-red-800",
  }
  return <div className={cn("rounded-xl border px-3.5 py-3 text-sm leading-relaxed", tones[tone], className)}>{children}</div>
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
      {errors.length === 1 ? errors[0] : (
        <ul className="list-disc space-y-1 pl-4">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </div>
  )
}
