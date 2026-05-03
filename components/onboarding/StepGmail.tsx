"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Mail, CheckCircle2, AlertCircle, ArrowRight, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  onSkip: () => void
}

export function StepGmail({ onSkip }: Props) {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"idle" | "error">("idle")

  useEffect(() => {
    if (searchParams.get("gmail") === "error") setStatus("error")
  }, [searchParams])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center mb-4">
          <Mail className="w-6 h-6 text-[#7C3AED]" />
        </div>
        <h1 className="text-2xl font-bold text-[#1C1917]">Connect your Gmail</h1>
        <p className="text-[#78716C] mt-2 leading-relaxed">
          Appointment confirmations and reminders will be sent from your email address — so leads see your name and can reply directly to you.
        </p>
      </div>

      {/* What you get */}
      <div className="space-y-3">
        {[
          { icon: "✓", text: "Confirmation emails sent from your Gmail address" },
          { icon: "✓", text: "Appointment reminders (2 days, 1 day, 2 hours before)" },
          { icon: "✓", text: "Leads reply directly to your inbox" },
          { icon: "✓", text: "Disconnect anytime from Email settings" },
        ].map((item) => (
          <div key={item.text} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-emerald-600 text-xs font-bold">{item.icon}</span>
            </div>
            <span className="text-sm text-[#44403C]">{item.text}</span>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {status === "error" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          Google didn't grant access. Please try again or skip for now.
        </motion.div>
      )}

      {/* Connect button */}
      <a href="/api/auth/gmail?return_to=onboarding" className="block">
        <button className={cn(
          "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-[#1C1917]",
          "bg-white border-2 border-[#E7E5E4] hover:border-[#7C3AED]/40 hover:shadow-md transition-all duration-150",
          "shadow-sm"
        )}>
          {/* Google logo SVG */}
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
            <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
            <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
            <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
          </svg>
          Connect Gmail account
        </button>
      </a>

      {/* Privacy note */}
      <div className="flex items-start gap-2 text-xs text-[#A8A29E]">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          We only request permission to send emails. We cannot read your inbox.
          You can disconnect at any time in Email settings.
        </span>
      </div>

      {/* Skip */}
      <div className="pt-2 flex items-center justify-between">
        <button
          onClick={onSkip}
          className="flex items-center gap-1.5 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors"
        >
          Skip for now
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <p className="text-xs text-[#A8A29E]">You can connect Gmail later in Email settings</p>
      </div>
    </motion.div>
  )
}
