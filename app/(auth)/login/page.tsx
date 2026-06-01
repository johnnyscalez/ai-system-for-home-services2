"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function FieldFMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#fff" />
      <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#fff" />
      <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
      <rect x="42" y="12" width="7"  height="11" rx="1.5" fill="#EA580C" />
    </svg>
  )
}

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8 justify-center">
        <div className="w-8 h-8 rounded-lg bg-[#1A1614] flex items-center justify-center shadow-sm">
          <FieldFMark size={20} />
        </div>
        <span
          className="font-extrabold text-[#1C1917] tracking-tight"
          style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}
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

      <div className="bg-card border border-border rounded-xl p-8"
           style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.08), 0 1px 3px rgba(28,25,23,0.04)" }}>
        <div className="mb-6">
          <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-jakarta)" }}>Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your FieldBuilt dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        No account?{" "}
        <Link href="/signup?new=1" className="text-primary hover:underline font-medium">
          Get your system installed
        </Link>
      </p>
    </div>
  )
}
