"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

// Routes that belong to the standalone CRM product only.
// In Housecall Pro mode the contractor's CRM owns these — we redirect to the
// AI performance dashboard instead of showing a duplicate surface.
const CRM_ONLY_PREFIXES = [
  "/leads",
  "/appointments",
  "/calendar",
  "/property-image",
  "/email",
  "/reports",
  "/invoices",
]

export function AgentModeGate({ integrationMode, children }: {
  integrationMode: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Lead DETAIL pages (/leads/<id>) are allowed in HCP mode: they are the only
  // place the owner can read a conversation thread, see the human-takeover
  // (AI paused) state, and resume the AI. Blocking them made every link on the
  // Conversations page bounce to the dashboard (audit C9). Only the pipeline
  // INDEX (/leads) stays CRM-only.
  const isLeadDetail = /^\/leads\/[^/]+/.test(pathname)

  const blocked =
    integrationMode === "housecall_pro" &&
    !isLeadDetail &&
    CRM_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))

  useEffect(() => {
    if (blocked) router.replace("/dashboard")
  }, [blocked, router])

  if (blocked) return null
  return <>{children}</>
}
