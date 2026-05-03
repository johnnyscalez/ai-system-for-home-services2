"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CheckCircle2, Clock, Mail, Upload, Loader2,
  ToggleLeft, ToggleRight, MessageSquare, Eye, ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import { buildEmailHtml, type EmailTemplateType } from "@/lib/email-builder"

type TemplateKey = "confirmation" | "reminder_2d" | "reminder_1d" | "reminder_2h"

const TABS: { key: TemplateKey; label: string; sublabel: string; icon: typeof Mail; color: string }[] = [
  { key: "confirmation", label: "Confirmation", sublabel: "Sent immediately", icon: CheckCircle2, color: "text-emerald-500" },
  { key: "reminder_2d", label: "2-Day Reminder", sublabel: "2 days before", icon: Clock, color: "text-purple-500" },
  { key: "reminder_1d", label: "1-Day Reminder", sublabel: "Day before", icon: Clock, color: "text-amber-500" },
  { key: "reminder_2h", label: "2-Hour Reminder", sublabel: "2 hrs before", icon: Clock, color: "text-red-500" },
]

const BANNER_PRESETS = [
  { color: "#7C3AED", label: "Purple" },
  { color: "#2563EB", label: "Blue" },
  { color: "#059669", label: "Green" },
  { color: "#DC2626", label: "Red" },
  { color: "#D97706", label: "Amber" },
  { color: "#0891B2", label: "Cyan" },
  { color: "#DB2777", label: "Pink" },
  { color: "#1C1917", label: "Charcoal" },
]

type Templates = {
  logo_url?: string | null
  from_name?: string | null
  reply_to_email?: string | null
  banner_color?: string | null
  confirmation_enabled?: boolean
  confirmation_subject?: string | null
  confirmation_custom_message?: string | null
  reminder_2d_enabled?: boolean
  reminder_2d_subject?: string | null
  reminder_2d_custom_message?: string | null
  reminder_1d_enabled?: boolean
  reminder_1d_subject?: string | null
  reminder_1d_custom_message?: string | null
  reminder_2h_enabled?: boolean
  reminder_2h_subject?: string | null
  reminder_2h_custom_message?: string | null
  sms_confirmation_enabled?: boolean
  sms_reminder_1d_enabled?: boolean
  sms_reminder_2h_enabled?: boolean
}

function getField(templates: Templates, key: TemplateKey, field: "enabled" | "subject" | "custom_message"): string | boolean {
  const k = `${key}_${field}` as keyof Templates
  const val = templates[k]
  if (field === "enabled") return val !== false
  return (val as string | null | undefined) ?? ""
}

export function EmailTemplatesClient({
  initialTemplates,
  companyName,
  serviceType,
  connectedGmailEmail,
}: {
  initialTemplates: Templates | null
  companyName: string
  serviceType: string
  connectedGmailEmail?: string | null
}) {
  const [activeTab, setActiveTab] = useState<TemplateKey>("confirmation")
  const [templates, setTemplates] = useState<Templates>(() => {
    const base = initialTemplates ?? {}
    if (!base.reply_to_email && connectedGmailEmail) {
      return { ...base, reply_to_email: connectedGmailEmail }
    }
    return base
  })
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [uploading, setUploading] = useState(false)
  const [activeView, setActiveView] = useState<"settings" | "preview">("settings")
  const isFirstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeBannerColor = templates.banner_color ?? "#7C3AED"

  const previewData = {
    leadName: "Michael",
    companyName: templates.from_name || companyName,
    serviceType,
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    address: "1234 Oak Street, Miami, FL 33101",
    notes: "AC unit making loud noise, 10 years old",
    timezone: "America/New_York",
    logoUrl: templates.logo_url,
    replyToEmail: templates.reply_to_email,
    fromName: templates.from_name || companyName,
    bannerColor: activeBannerColor,
  }

  const previewHtml = buildEmailHtml(
    activeTab,
    previewData,
    (templates[`${activeTab}_custom_message` as keyof Templates] as string | null) ?? null,
  )

  function update(key: keyof Templates, value: string | boolean) {
    setTemplates(prev => ({ ...prev, [key]: value }))
  }

  const doSave = useCallback(async (data: Templates) => {
    setSaveStatus("saving")
    try {
      await fetch("/api/settings/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2500)
    } catch {
      setSaveStatus("idle")
    }
  }, [])

  // Auto-save 1.5s after any change, skip on first render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(templates), 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [templates, doSave])

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/settings/logo", { method: "POST", body: fd })
      const data = await res.json()
      if (data.url) update("logo_url", data.url)
    } catch { /* non-fatal */ }
    finally { setUploading(false) }
  }, [])

  const enabled = getField(templates, activeTab, "enabled") as boolean
  const subject = getField(templates, activeTab, "subject") as string
  const customMessage = getField(templates, activeTab, "custom_message") as string

  return (
    <div className="flex flex-col h-screen bg-[#FAFAF8]">
      {/* Fixed visual background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(rgba(124,58,237,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(124,58,237,0.06)", top: "-10%", left: "-5%" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(77,124,15,0.05)", bottom: "-5%", right: "-5%" }} />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="px-8 pt-8 pb-0 shrink-0">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)" }}>
                Email & SMS
              </h1>
              <p className="text-sm text-[#78716C] mt-1">Automated confirmations and reminders sent to your leads</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              {saveStatus === "saving" && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 text-[#78716C]"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                </motion.span>
              )}
              {saveStatus === "saved" && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-emerald-500"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </motion.span>
              )}
              {saveStatus === "idle" && (
                <span className="text-[#A8A29E]">Changes save automatically</span>
              )}
            </div>
          </div>

          {/* Gmail connection status banner */}
          <div className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border mb-5 text-sm",
            connectedGmailEmail
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          )}>
            <Mail className="w-4 h-4 shrink-0" />
            {connectedGmailEmail ? (
              <span>Emails sent from <strong>{connectedGmailEmail}</strong> via your Gmail account.</span>
            ) : (
              <span>
                No Gmail connected — emails sent via LeadReply.{" "}
                <a href="/api/auth/gmail?return_to=settings" className="underline font-medium hover:opacity-80">
                  Connect Gmail <ExternalLink className="w-3 h-3 inline ml-0.5" />
                </a>
              </span>
            )}
          </div>

          {/* 4 template cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              const isEnabled = getField(templates, tab.key, "enabled") as boolean
              return (
                <motion.button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "relative text-left p-4 rounded-xl border transition-all duration-150",
                    isActive
                      ? "bg-white border-[#7C3AED]/30 shadow-[0_4px_20px_rgba(124,58,237,0.12)]"
                      : "bg-white border-[#E7E5E4] shadow-sm hover:border-[#7C3AED]/20 hover:shadow-md"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-[#7C3AED] rounded-t-xl" />
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <tab.icon className={cn("w-4 h-4", isActive ? "text-[#7C3AED]" : tab.color)} />
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isEnabled ? "bg-emerald-400" : "bg-[#E7E5E4]"
                    )} />
                  </div>
                  <div className={cn("text-sm font-semibold", isActive ? "text-[#7C3AED]" : "text-[#1C1917]")}>{tab.label}</div>
                  <div className="text-xs text-[#78716C] mt-0.5">{tab.sublabel}</div>
                </motion.button>
              )
            })}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-[#F5F4F2] rounded-lg p-1 w-fit mb-6">
            <button
              onClick={() => setActiveView("settings")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeView === "settings" ? "bg-white text-[#1C1917] shadow-sm" : "text-[#78716C] hover:text-[#1C1917]"
              )}
            >
              <Mail className="w-3.5 h-3.5" /> Settings
            </button>
            <button
              onClick={() => setActiveView("preview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeView === "preview" ? "bg-white text-[#1C1917] shadow-sm" : "text-[#78716C] hover:text-[#1C1917]"
              )}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden px-8 pb-8">
          <AnimatePresence mode="wait">
            {activeView === "settings" ? (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 gap-6 h-full"
              >
                {/* Left: email template settings */}
                <div className="bg-white rounded-xl border border-[#E7E5E4] shadow-sm overflow-y-auto">
                  <div className="p-6 border-b border-[#E7E5E4]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-[#1C1917]">
                          {TABS.find(t => t.key === activeTab)?.label} Email
                        </h2>
                        <p className="text-xs text-[#78716C] mt-0.5">Customize the email your leads receive</p>
                      </div>
                      <button
                        onClick={() => update(`${activeTab}_enabled` as keyof Templates, !enabled)}
                        className="flex items-center gap-2"
                      >
                        {enabled
                          ? <ToggleRight className="w-8 h-8 text-[#7C3AED]" />
                          : <ToggleLeft className="w-8 h-8 text-[#78716C]" />
                        }
                        <span className={cn("text-xs font-medium", enabled ? "text-emerald-500" : "text-[#78716C]")}>
                          {enabled ? "Enabled" : "Disabled"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Global settings (show on confirmation tab) */}
                    {activeTab === "confirmation" && (
                      <>
                        <div className="space-y-4 pb-5 border-b border-[#E7E5E4]">
                          <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">Brand Settings (applied to all emails)</p>

                          {/* Logo upload */}
                          <div>
                            <Label className="text-xs font-medium text-[#44403C]">Company Logo</Label>
                            <div className="mt-2 flex items-center gap-3">
                              {templates.logo_url ? (
                                <img src={templates.logo_url} alt="Logo" className="h-10 w-auto object-contain rounded border border-[#E7E5E4] p-1" />
                              ) : (
                                <div className="h-10 w-20 rounded border border-dashed border-[#E7E5E4] flex items-center justify-center">
                                  <span className="text-xs text-[#A8A29E]">No logo</span>
                                </div>
                              )}
                              <label className="cursor-pointer">
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E5E4] text-xs font-medium text-[#44403C] hover:bg-[#F5F4F2] transition-colors">
                                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                  {uploading ? "Uploading…" : "Upload logo"}
                                </div>
                              </label>
                            </div>
                            <p className="text-xs text-[#A8A29E] mt-1.5">PNG or JPG, max 2MB. Appears in the email header.</p>
                          </div>

                          {/* From name */}
                          <div>
                            <Label className="text-xs font-medium text-[#44403C]">From name</Label>
                            <Input
                              value={templates.from_name ?? ""}
                              onChange={e => update("from_name", e.target.value)}
                              placeholder={companyName}
                              className="mt-1.5 text-sm"
                            />
                            <p className="text-xs text-[#A8A29E] mt-1">This shows as the sender name in the lead&apos;s inbox.</p>
                          </div>

                          {/* Reply-to email */}
                          <div>
                            <Label className="text-xs font-medium text-[#44403C]">Your email (reply-to)</Label>
                            <Input
                              type="email"
                              value={templates.reply_to_email ?? ""}
                              onChange={e => update("reply_to_email", e.target.value)}
                              placeholder={connectedGmailEmail ?? "you@yourcompany.com"}
                              className="mt-1.5 text-sm"
                            />
                            <p className="text-xs text-[#A8A29E] mt-1">
                              When leads reply to the email, it goes to this address — not necessarily the Gmail you send from.
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Subject */}
                    <div>
                      <Label className="text-xs font-medium text-[#44403C]">Subject line</Label>
                      <Input
                        value={subject}
                        onChange={e => update(`${activeTab}_subject` as keyof Templates, e.target.value)}
                        placeholder="Leave blank for default"
                        className="mt-1.5 text-sm"
                      />
                    </div>

                    {/* Custom message */}
                    <div>
                      <Label className="text-xs font-medium text-[#44403C]">Custom intro message</Label>
                      <Textarea
                        value={customMessage}
                        onChange={e => update(`${activeTab}_custom_message` as keyof Templates, e.target.value)}
                        placeholder="Leave blank to use the default message. Use {{lead_name}} and {{company_name}} as placeholders."
                        rows={4}
                        className="mt-1.5 text-sm resize-none"
                      />
                      <p className="text-xs text-[#A8A29E] mt-1">Available: {`{{lead_name}}`}, {`{{company_name}}`}, {`{{date}}`}, {`{{time}}`}</p>
                    </div>
                  </div>
                </div>

                {/* Right: SMS settings */}
                <div className="bg-white rounded-xl border border-[#E7E5E4] shadow-sm overflow-y-auto">
                  <div className="p-6 border-b border-[#E7E5E4]">
                    <h2 className="font-semibold text-[#1C1917]">SMS Reminders</h2>
                    <p className="text-xs text-[#78716C] mt-0.5">Text messages sent to leads alongside emails</p>
                  </div>

                  <div className="p-6 space-y-4">
                    {[
                      { key: "sms_confirmation_enabled" as keyof Templates, label: "Confirmation SMS", desc: "Sent immediately when appointment is booked" },
                      { key: "sms_reminder_1d_enabled" as keyof Templates, label: "24-hour reminder SMS", desc: "Sent the day before the appointment" },
                      { key: "sms_reminder_2h_enabled" as keyof Templates, label: "2-hour reminder SMS", desc: "Sent 2 hours before the appointment" },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start gap-3 p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E4]">
                        <button onClick={() => update(key, !(templates[key] !== false))}>
                          {templates[key] !== false
                            ? <ToggleRight className="w-7 h-7 text-[#7C3AED] mt-0.5" />
                            : <ToggleLeft className="w-7 h-7 text-[#78716C] mt-0.5" />
                          }
                        </button>
                        <div>
                          <div className="text-sm font-medium text-[#1C1917]">{label}</div>
                          <div className="text-xs text-[#78716C] mt-0.5">{desc}</div>
                        </div>
                        <div className={cn("ml-auto w-2 h-2 rounded-full mt-1.5", templates[key] !== false ? "bg-emerald-400" : "bg-[#E7E5E4]")} />
                      </div>
                    ))}

                    <div className="p-4 rounded-xl bg-[#7C3AED]/5 border border-[#7C3AED]/15">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-[#7C3AED]" />
                        <span className="text-xs font-semibold text-[#7C3AED]">AI-powered replies</span>
                      </div>
                      <p className="text-xs text-[#78716C] leading-relaxed">
                        If a lead replies to any reminder SMS, your AI agent automatically picks up the conversation. It can reschedule or cancel appointments, answer questions, and keep the lead engaged — all without any manual work.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="h-full flex flex-col gap-3"
              >
                {/* Color picker toolbar */}
                <div className="bg-white rounded-xl border border-[#E7E5E4] shadow-sm px-4 py-3 flex items-center gap-4 shrink-0">
                  <span className="text-xs font-semibold text-[#44403C] whitespace-nowrap">Banner color</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {BANNER_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        title={preset.label}
                        onClick={() => update("banner_color", preset.color)}
                        className="w-7 h-7 rounded-full border-2 transition-all duration-100 hover:scale-110"
                        style={{
                          background: preset.color,
                          borderColor: activeBannerColor === preset.color ? "#1C1917" : "transparent",
                          boxShadow: activeBannerColor === preset.color ? "0 0 0 2px white, 0 0 0 4px #1C1917" : "none",
                        }}
                      />
                    ))}
                    {/* Custom color picker */}
                    <label className="relative w-7 h-7 rounded-full border-2 border-dashed border-[#E7E5E4] hover:border-[#7C3AED] cursor-pointer flex items-center justify-center overflow-hidden transition-colors" title="Custom color">
                      <span className="text-[10px] text-[#78716C] font-bold select-none">+</span>
                      <input
                        type="color"
                        value={activeBannerColor}
                        onChange={e => update("banner_color", e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  </div>
                  <div
                    className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E7E5E4] text-xs text-[#44403C] font-mono"
                    style={{ background: activeBannerColor + "18" }}
                  >
                    <div className="w-3.5 h-3.5 rounded-sm" style={{ background: activeBannerColor }} />
                    {activeBannerColor.toUpperCase()}
                  </div>
                </div>

                {/* Preview iframe */}
                <div className="bg-white rounded-xl border border-[#E7E5E4] shadow-sm flex-1 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E7E5E4] bg-[#FAFAF8]">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-[#78716C] border border-[#E7E5E4]">
                      Email preview — {TABS.find(t => t.key === activeTab)?.label}
                    </div>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-[calc(100%-44px)] border-0"
                    title="Email preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
