"use client"

export const dynamic = "force-dynamic"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"
import { Phone, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, HardHat } from "lucide-react"

function TechLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [identifier, setIdentifier]           = useState("")
  const [password, setPassword]               = useState("")
  const [showPassword, setShowPassword]       = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [resolvedCompany, setResolvedCompany] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const id = searchParams.get("id")
    if (id) setIdentifier(decodeURIComponent(id))
  }, [searchParams])

  function isEmailInput(val: string) {
    return val.includes("@")
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim() || !password.trim()) {
      setError("Please enter your login details.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      let loginEmail = identifier.trim()

      if (!isEmailInput(loginEmail)) {
        const res = await fetch("/api/tech/resolve-identifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: loginEmail }),
        })

        if (!res.ok) {
          setError("No technician account found with that phone number.")
          setLoading(false)
          return
        }

        const data = await res.json()
        loginEmail = data.systemEmail
        setResolvedCompany(data.companyName)
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password.trim(),
      })

      if (signInError) {
        setError("Incorrect credentials. Check your email/phone and password.")
        setLoading(false)
        return
      }

      router.push("/tech/appointments")
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4" style={{ background: "#FAFAF8" }}>
      {/* Visual background layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.15) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <motion.div
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(249,115,22,0.07)", top: "-10%", left: "-5%" }}
        />
        <motion.div
          animate={{ y: [0, 20, 0], x: [0, -15, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.06)", bottom: "-5%", right: "-5%" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#F97316] flex items-center justify-center mx-auto mb-4 shadow-[0_4px_20px_rgba(249,115,22,0.35)]">
              <HardHat className="w-7 h-7 text-white" />
            </div>
            <h1
              className="text-2xl font-bold text-[#1C1917]"
              style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans')" }}
            >
              {resolvedCompany
                ? `Welcome to ${resolvedCompany}`
                : "Welcome to your portal"}
            </h1>
            <p className="text-sm text-[#78716C] mt-1.5">
              {resolvedCompany
                ? `${resolvedCompany} uses FieldBuilt AI to manage your appointments`
                : "Sign in to see your appointments and manage your jobs"}
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
            <form onSubmit={handleLogin} className="p-6 space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1C1917]">Email or phone number</Label>
                <div className="relative">
                  {isEmailInput(identifier) ? (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                  ) : (
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                  )}
                  <Input
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="your@email.com or +1 555 000 0000"
                    autoComplete="username"
                    className="pl-10 border-[#E7E5E4] focus-visible:ring-[#F97316] h-11"
                  />
                </div>
                <p className="text-xs text-[#A8A29E]">Use the email or phone your manager set up for your account.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1C1917]">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                  <Input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className="pl-10 pr-10 border-[#E7E5E4] focus-visible:ring-[#F97316] h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#1C1917] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#F97316] hover:bg-[#ea6d04] text-white font-semibold gap-2 shadow-sm"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                ) : (
                  "Sign in to my portal →"
                )}
              </Button>
            </form>

            <div className="px-6 py-4 bg-[#FAFAF8] border-t border-[#E7E5E4] text-center">
              <p className="text-xs text-[#A8A29E]">
                Forgot your password? Contact your manager to reset it.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-[#A8A29E] mt-6">
            This is a technician portal. Not a technician?{" "}
            <a href="/login" className="text-[#F97316] hover:underline font-medium">Admin login →</a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default function TechLoginPage() {
  return (
    <Suspense>
      <TechLoginForm />
    </Suspense>
  )
}
