"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check } from "lucide-react"

function FieldFMark({ size = 20, onDark = false }: { size?: number; onDark?: boolean }) {
  const base = onDark ? "#fff" : "#1C1917"
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="18" y="12" width="11" height="40" rx="1.5" fill={base} />
      <rect x="18" y="28" width="20" height="10" rx="1.5" fill={base} />
      <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
      <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
    </svg>
  )
}

function LogoLockup({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${onDark ? "bg-white/10" : "bg-[#1A1614]"}`}>
        <FieldFMark size={20} onDark={!onDark} />
      </div>
      <span
        className="font-extrabold tracking-tight"
        style={{
          fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em",
          color: onDark ? "#F5F3F0" : "#1C1917",
        }}
      >
        FIELDBUILT
        <span
          className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
          style={{ fontSize: "0.42em", background: "#F97316", padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}
        >
          AI
        </span>
      </span>
    </div>
  )
}

export default function SignupPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ fullName: "", email: "", password: "" })
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Create user server-side with email pre-confirmed so signIn works immediately
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, password: form.password, fullName: form.fullName }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "Failed to create account. Please try again.")
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) {
      setError("Account created but couldn't sign in automatically. Please log in.")
      setLoading(false)
      return
    }

    router.push("/onboarding")
    router.refresh()
  }

  const perks = [
    "Every lead texted in 3.7 seconds — day or night",
    "AI qualifies and books estimate appointments automatically",
    "Your AI operation installed and running in one day",
    "No credit card required for the install call",
  ]

  return (
    <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center">

      {/* Left — value prop */}
      <div className="hidden md:block">
        <div className="mb-8">
          <LogoLockup />
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
             style={{ background: "#FFF3EC", color: "#EA580C", fontFamily: "var(--font-mono)" }}>
          AI operations · installed for you
        </div>
        <h2 className="text-3xl font-extrabold leading-tight mb-4"
            style={{ fontFamily: "var(--font-jakarta)", color: "#1C1917", letterSpacing: "-0.02em" }}>
          Your AI operation.{" "}
          <span style={{ color: "#F97316" }}>Installed in a day.</span>{" "}
          You just show up.
        </h2>
        <p className="text-[#78716C] mb-8 leading-relaxed">
          Stop losing jobs to contractors who respond faster. Your AI texts every lead in 3.7 seconds,
          qualifies them, handles objections, and books the appointment — 24/7.
        </p>
        <ul className="space-y-3">
          {perks.map((perk) => (
            <li key={perk} className="flex items-center gap-3 text-sm">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                   style={{ background: "#FFF3EC" }}>
                <Check className="w-3 h-3" style={{ color: "#F97316" }} aria-hidden="true" />
              </div>
              <span style={{ color: "#1C1917" }}>{perk}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Right — form */}
      <div>
        <div className="flex items-center gap-2 mb-8 md:hidden justify-center">
          <LogoLockup />
        </div>

        <div className="bg-card border border-border rounded-xl p-8"
             style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.08), 0 1px 3px rgba(28,25,23,0.04)" }}>
          <div className="mb-6">
            <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-jakarta)" }}>
              Book your install call
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              We set up your AI operation. You approve it. It runs forever.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Your name</Label>
              <Input
                id="fullName"
                placeholder="John Smith"
                value={form.fullName}
                onChange={set("fullName")}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@apexroofing.com"
                value={form.email}
                onChange={set("email")}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={set("password")}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Get started →"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
