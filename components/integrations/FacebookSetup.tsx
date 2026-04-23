"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight, ChevronLeft, Check, Users, FileText,
  AlertCircle, Loader2,
} from "lucide-react"

interface Page {
  id: string
  name: string
  fan_count?: number
  access_token: string
}

interface LeadForm {
  id: string
  name: string
  status: string
  leads_count?: number
  created_time: string
}

interface Props {
  pages: Page[]
  companyId: string
}

function DotGrid() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 opacity-40"
      style={{
        backgroundImage: "radial-gradient(rgba(124,58,237,0.15) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  )
}

function GlowOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full"
        style={{
          width: 600, height: 600,
          background: "rgba(24,119,242,0.07)",
          filter: "blur(80px)",
          top: "-10%", left: "-5%",
        }}
      />
      <motion.div
        animate={{ y: [0, 18, 0], x: [0, -14, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute rounded-full"
        style={{
          width: 500, height: 500,
          background: "rgba(124,58,237,0.05)",
          filter: "blur(70px)",
          bottom: "-5%", right: "-5%",
        }}
      />
    </div>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              i < current
                ? "bg-[#7C3AED] text-white"
                : i === current
                ? "bg-[#7C3AED]/10 text-[#7C3AED] ring-2 ring-[#7C3AED]"
                : "bg-[#F5F4F2] text-[#78716C]"
            }`}
          >
            {i < current ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-12 h-0.5 transition-all duration-300 ${i < current ? "bg-[#7C3AED]" : "bg-[#E7E5E4]"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export function FacebookSetup({ pages }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0) // 0=page, 1=forms, 2=confirm
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [forms, setForms] = useState<LeadForm[]>([])
  const [formsLoading, setFormsLoading] = useState(false)
  const [formsError, setFormsError] = useState<string | null>(null)
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const selectedPage = pages.find((p) => p.id === selectedPageId)

  async function handlePageNext() {
    if (!selectedPageId) return
    setFormsLoading(true)
    setFormsError(null)
    setForms([])
    setSelectedFormIds([])

    try {
      const res = await fetch(`/api/integrations/facebook/forms?page_id=${selectedPageId}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setFormsError(data.error ?? "Failed to load lead forms")
        setFormsLoading(false)
        return
      }
      setForms(data.forms)
      setStep(1)
    } catch {
      setFormsError("Network error — please try again")
    } finally {
      setFormsLoading(false)
    }
  }

  function toggleForm(id: string) {
    setSelectedFormIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!selectedPageId || !selectedFormIds.length) return
    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch("/api/integrations/facebook/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: selectedPageId, form_ids: selectedFormIds }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setSaveError(data.error ?? "Failed to save")
        setSaving(false)
        return
      }
      router.push("/integrations?success=facebook")
    } catch {
      setSaveError("Network error — please try again")
      setSaving(false)
    }
  }

  const stepLabels = ["Select Page", "Select Forms", "Confirm"]

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      <DotGrid />
      <GlowOrbs />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1877F2, #0C5AC4)", boxShadow: "0 8px 24px rgba(24,119,242,0.3)" }}
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            </div>
            <h1
              className="text-3xl font-bold text-[#1C1917] mb-2"
              style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Connect Facebook Lead Ads
            </h1>
            <p className="text-[#78716C]">
              Choose which page and lead forms to track
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex justify-center mb-8">
            <StepIndicator current={step} total={3} />
          </div>

          <div className="flex justify-center gap-12 mb-8">
            {stepLabels.map((label, i) => (
              <span
                key={i}
                className={`text-xs font-medium transition-colors ${
                  i === step ? "text-[#7C3AED]" : i < step ? "text-[#1C1917]" : "text-[#D1D5DB]"
                }`}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Card */}
          <div
            className="bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden"
            style={{ boxShadow: "0 8px 40px rgba(124,58,237,0.08), 0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <AnimatePresence mode="wait">
              {/* ── Step 0: Page Selection ──────────────────────────────── */}
              {step === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="p-6 border-b border-[#E7E5E4]">
                    <div className="flex items-center gap-2 text-sm text-[#78716C]">
                      <Users className="w-4 h-4 text-[#7C3AED]" />
                      <span>{pages.length} Facebook {pages.length === 1 ? "Page" : "Pages"} found on your account</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                    {pages.map((page) => (
                      <motion.button
                        key={page.id}
                        onClick={() => setSelectedPageId(page.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                          selectedPageId === page.id
                            ? "border-[#7C3AED] bg-[#7C3AED]/5"
                            : "border-[#E7E5E4] bg-white hover:border-[#C4B5FD] hover:bg-[#FAFAF8]"
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-lg"
                          style={{ background: "linear-gradient(135deg, #1877F2, #0C5AC4)" }}
                        >
                          {page.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#1C1917] truncate">{page.name}</p>
                          {page.fan_count != null && (
                            <p className="text-xs text-[#78716C] mt-0.5">
                              {page.fan_count.toLocaleString()} followers
                            </p>
                          )}
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            selectedPageId === page.id
                              ? "border-[#7C3AED] bg-[#7C3AED]"
                              : "border-[#D1D5DB] bg-white"
                          }`}
                        >
                          {selectedPageId === page.id && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  <div className="p-6 border-t border-[#E7E5E4] flex justify-end">
                    <button
                      onClick={handlePageNext}
                      disabled={!selectedPageId || formsLoading}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${
                        selectedPageId && !formsLoading
                          ? "hover:scale-[1.02] active:scale-[0.98]"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                      style={{
                        background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                        boxShadow: selectedPageId ? "0 4px 14px rgba(124,58,237,0.35)" : "none",
                      }}
                    >
                      {formsLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Loading forms…</>
                      ) : (
                        <>Next: Select Forms <ChevronRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>

                  {formsError && (
                    <div className="mx-6 mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {formsError}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Step 1: Form Selection ──────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="p-6 border-b border-[#E7E5E4]">
                    <div className="flex items-center gap-2 text-sm text-[#78716C]">
                      <FileText className="w-4 h-4 text-[#7C3AED]" />
                      <span>
                        Lead forms on <span className="font-semibold text-[#1C1917]">{selectedPage?.name}</span>
                        {" — "}select all that are running now
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                    {forms.length === 0 ? (
                      <div className="text-center py-8 text-[#78716C] text-sm">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No lead forms found on this page.
                        <br />
                        <span className="text-xs">Create a lead form in Meta Ads Manager first.</span>
                      </div>
                    ) : (
                      forms.map((form) => {
                        const selected = selectedFormIds.includes(form.id)
                        return (
                          <motion.button
                            key={form.id}
                            onClick={() => toggleForm(form.id)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                              selected
                                ? "border-[#7C3AED] bg-[#7C3AED]/5"
                                : "border-[#E7E5E4] bg-white hover:border-[#C4B5FD] hover:bg-[#FAFAF8]"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-[#1C1917] truncate">{form.name}</p>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                  form.status === "ACTIVE"
                                    ? "bg-green-50 text-green-700 border border-green-100"
                                    : "bg-[#F5F4F2] text-[#78716C] border border-[#E7E5E4]"
                                }`}>
                                  {form.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {form.leads_count != null && (
                                  <p className="text-xs text-[#78716C]">{form.leads_count} leads total</p>
                                )}
                                <p className="text-xs text-[#78716C]">
                                  Created {new Date(form.created_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                selected
                                  ? "border-[#7C3AED] bg-[#7C3AED]"
                                  : "border-[#D1D5DB] bg-white"
                              }`}
                            >
                              {selected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </motion.button>
                        )
                      })
                    )}
                  </div>

                  <div className="p-6 border-t border-[#E7E5E4] flex items-center justify-between">
                    <button
                      onClick={() => setStep(0)}
                      className="flex items-center gap-1.5 text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={() => setStep(2)}
                      disabled={selectedFormIds.length === 0 && forms.length > 0}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${
                        (selectedFormIds.length > 0 || forms.length === 0)
                          ? "hover:scale-[1.02] active:scale-[0.98]"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                      style={{
                        background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                        boxShadow: selectedFormIds.length > 0 ? "0 4px 14px rgba(124,58,237,0.35)" : "none",
                      }}
                    >
                      {forms.length === 0 ? (
                        <>Continue anyway <ChevronRight className="w-4 h-4" /></>
                      ) : (
                        <>Review ({selectedFormIds.length} form{selectedFormIds.length !== 1 ? "s" : ""}) <ChevronRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Confirm ──────────────────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="p-6 space-y-4">
                    <h3
                      className="font-bold text-[#1C1917] text-lg"
                      style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                    >
                      Ready to activate
                    </h3>

                    {/* Summary */}
                    <div className="bg-[#FAFAF8] rounded-xl border border-[#E7E5E4] p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-bold"
                          style={{ background: "linear-gradient(135deg, #1877F2, #0C5AC4)" }}
                        >
                          {selectedPage?.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs text-[#78716C]">Facebook Page</p>
                          <p className="font-semibold text-[#1C1917]">{selectedPage?.name}</p>
                        </div>
                      </div>

                      <div className="border-t border-[#E7E5E4] pt-3">
                        <p className="text-xs text-[#78716C] mb-2">
                          {selectedFormIds.length === 0
                            ? "All lead forms (any form submission will be captured)"
                            : `${selectedFormIds.length} lead form${selectedFormIds.length !== 1 ? "s" : ""} selected`}
                        </p>
                        {selectedFormIds.length > 0 && (
                          <ul className="space-y-1">
                            {forms
                              .filter((f) => selectedFormIds.includes(f.id))
                              .map((f) => (
                                <li key={f.id} className="flex items-center gap-2 text-sm text-[#1C1917]">
                                  <Check className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                                  {f.name}
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* What happens next */}
                    <div className="bg-[#7C3AED]/5 rounded-xl border border-[#7C3AED]/10 p-4">
                      <p className="text-xs font-semibold text-[#7C3AED] uppercase tracking-wider mb-2">What happens next</p>
                      <ul className="space-y-1.5">
                        {[
                          "Your page will be subscribed to receive lead notifications",
                          "Every new lead gets an AI SMS within 60 seconds",
                          "Leads appear instantly in your CRM pipeline",
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#78716C]">
                            <Check className="w-3.5 h-3.5 text-[#7C3AED] shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {saveError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {saveError}
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t border-[#E7E5E4] flex items-center justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center gap-1.5 text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${
                        !saving ? "hover:scale-[1.02] active:scale-[0.98]" : "opacity-70 cursor-not-allowed"
                      }`}
                      style={{
                        background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                        boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
                      }}
                    >
                      {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Activating…</>
                      ) : (
                        <><Check className="w-4 h-4" /> Activate Integration</>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
