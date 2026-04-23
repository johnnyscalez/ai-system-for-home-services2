"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Check } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ fullName: "", email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/onboarding")
      router.refresh()
    }
  }

  const perks = [
    "Every lead texted in under 60 seconds",
    "AI books estimate appointments automatically",
    "No credit card required for 14 days",
  ]

  return (
    <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center">
      {/* Left — value prop */}
      <div className="hidden md:block">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">LeadReply</span>
        </div>
        <h2 className="text-3xl font-bold leading-tight mb-4">
          Every lead gets a response in{" "}
          <span className="text-primary">60 seconds.</span>{" "}
          Automatically.
        </h2>
        <p className="text-muted-foreground mb-8">
          Stop losing jobs to contractors who respond faster. Our AI texts every lead the moment they fill out your form — 24/7, even at 11pm on a Sunday.
        </p>
        <ul className="space-y-3">
          {perks.map((perk) => (
            <li key={perk} className="flex items-center gap-3 text-sm">
              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-primary" />
              </div>
              {perk}
            </li>
          ))}
        </ul>
      </div>

      {/* Right — form */}
      <div>
        <div className="flex items-center gap-2 mb-8 md:hidden justify-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">LeadReply</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold">Start your free trial</h1>
            <p className="text-sm text-muted-foreground mt-1">14 days free. No credit card needed.</p>
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
              {loading ? "Creating account..." : "Create free account →"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
