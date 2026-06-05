"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail]     = useState("")
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8 justify-center">
        <div className="w-8 h-8 rounded-lg bg-[#1A1614] flex items-center justify-center shadow-sm">
          <svg width={20} height={20} viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect x="18" y="12" width="11" height="40" rx="1.5" fill="#fff" />
            <rect x="18" y="28" width="20" height="10" rx="1.5" fill="#fff" />
            <rect x="18" y="12" width="31" height="11" rx="1.5" fill="#F97316" />
            <rect x="42" y="12" width="7" height="11" rx="1.5" fill="#EA580C" />
          </svg>
        </div>
        <span className="font-extrabold text-[#1C1917] tracking-tight"
          style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
          FIELDBUILT
          <span className="inline-flex items-center justify-center text-white font-bold rounded ml-1"
            style={{ fontSize: "0.42em", background: "#F97316", padding: "0.22em 0.45em", borderRadius: 5, letterSpacing: "0.04em", verticalAlign: "super" }}>
            AI
          </span>
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl p-8"
        style={{ boxShadow: "0 4px 24px rgba(249,115,22,0.08), 0 1px 3px rgba(28,25,23,0.04)" }}>

        {sent ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-jakarta)" }}>Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
              Check your inbox and click the link to reset your password.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Didn&apos;t get it? Check spam or{" "}
              <button onClick={() => setSent(false)} className="text-primary hover:underline">try again</button>.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-jakarta)" }}>Reset your password</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Remember your password?{" "}
        <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
      </p>
    </div>
  )
}
