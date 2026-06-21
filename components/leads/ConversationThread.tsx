"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Send, Bot, User, Pause, Play, AlertCircle, XCircle,
  MessageSquare, Phone, CheckCircle2, Info,
} from "lucide-react"
import { createClient } from "@/lib/supabase"

type Message = {
  id: string
  direction: "inbound" | "outbound"
  sent_by: "ai" | "human" | "reminder" | string
  body: string
  created_at: string
  twilio_sid?: string | null
  channel?: string | null
}

type AgentType = "sms" | "voice"

type Props = {
  leadId: string
  companyId: string
  initialMessages: Message[]
  aiPaused: boolean
  aiVoicePaused: boolean
  leadStatus: string
  fromNumber: string | null
  leadPhone: string
  companyTimezone?: string
}

export function ConversationThread({
  leadId,
  companyId,
  initialMessages,
  aiPaused: initialAiPaused,
  aiVoicePaused: initialAiVoicePaused,
  leadStatus,
  fromNumber,
  leadPhone,
  companyTimezone = "America/New_York",
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [aiSmsPaused, setAiSmsPaused] = useState(initialAiPaused)
  const [aiVoicePaused, setAiVoicePaused] = useState(initialAiVoicePaused)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [togglingAgent, setTogglingAgent] = useState<AgentType | null>(null)
  const [resumedAgent, setResumedAgent] = useState<AgentType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef(messages)
  const animatedIds = useRef(new Set(initialMessages.map((m) => m.id)))
  const resumeBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    return () => {
      if (resumeBannerTimer.current) clearTimeout(resumeBannerTimer.current)
    }
  }, [])

  const mergeMessages = useCallback((rows: Message[]) => {
    setMessages((prev) => {
      const prevMap = new Map(prev.map((m) => [m.id, m]))
      let changed = false

      const merged = rows.map((row) => {
        const existing = prevMap.get(row.id)
        if (!existing) {
          changed = true
          return row
        }
        if (existing.twilio_sid !== row.twilio_sid) {
          changed = true
          return { ...existing, twilio_sid: row.twilio_sid }
        }
        return existing
      })

      if (!changed && merged.length === prev.length) return prev
      return merged
    })
  }, [])

  // Poll every 3 seconds for new messages
  useEffect(() => {
    const poll = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, direction, sent_by, body, created_at, twilio_sid, channel")
        .eq("lead_id", leadId)
        .eq("channel", "sms")
        .order("created_at", { ascending: true })

      if (!data) return
      data.forEach((row) => { animatedIds.current.add(row.id) })
      mergeMessages(data as Message[])
    }

    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [leadId, supabase, mergeMessages])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`conversations-thread:${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          const msg = payload.new as Message
          if (msg.channel && msg.channel !== "sms") return  // ignore voice transcripts
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          const updated = payload.new as Message
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, twilio_sid: updated.twilio_sid } : m))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [leadId, supabase])

  const handleSend = useCallback(async () => {
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError(null)
    setDraft("")

    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, body }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to send")
        setDraft(body)
      }
    } catch {
      setError("Network error — message not sent")
      setDraft(body)
    } finally {
      setSending(false)
    }
  }, [draft, leadId, sending])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleAgent = async (agent: AgentType) => {
    const currentlyPaused = agent === "sms" ? aiSmsPaused : aiVoicePaused
    const newPaused = !currentlyPaused

    setTogglingAgent(agent)
    try {
      const res = await fetch(`/api/leads/${leadId}/ai-pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: newPaused, agent }),
      })
      if (res.ok) {
        if (agent === "sms") setAiSmsPaused(newPaused)
        else setAiVoicePaused(newPaused)

        // When re-enabling, show the full-context banner for 5 seconds
        if (!newPaused) {
          setResumedAgent(agent)
          if (resumeBannerTimer.current) clearTimeout(resumeBannerTimer.current)
          resumeBannerTimer.current = setTimeout(() => setResumedAgent(null), 5000)
        }
      }
    } finally {
      setTogglingAgent(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Thread header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">SMS Conversation</span>
          <span className="text-xs text-muted-foreground font-mono">{leadPhone}</span>
        </div>
        {/* Legacy combined badge — shows combined state for quick glance */}
        {(aiSmsPaused || aiVoicePaused) ? (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1">
            <Pause className="w-3 h-3" />
            {aiSmsPaused && aiVoicePaused ? "Both agents paused" : aiSmsPaused ? "SMS agent paused" : "Voice agent paused"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
            <Bot className="w-3 h-3" /> AI agents active
          </Badge>
        )}
      </div>

      {/* AI Agent Controls */}
      <div className="px-5 py-3 border-b border-border/60 bg-muted/20 shrink-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
          AI Agents
        </p>
        <div className="flex flex-wrap gap-2">
          <AgentToggleCard
            icon={<MessageSquare className="w-3.5 h-3.5" />}
            label="SMS Agent"
            paused={aiSmsPaused}
            toggling={togglingAgent === "sms"}
            onToggle={() => toggleAgent("sms")}
          />
          <AgentToggleCard
            icon={<Phone className="w-3.5 h-3.5" />}
            label="Voice Agent"
            paused={aiVoicePaused}
            toggling={togglingAgent === "voice"}
            onToggle={() => toggleAgent("voice")}
          />
        </div>

        {/* Full-context resume banner */}
        <AnimatePresence>
          {resumedAgent && (
            <motion.div
              key="resume-banner"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 10 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-emerald-400">
                    {resumedAgent === "sms" ? "SMS" : "Voice"} Agent re-enabled
                  </p>
                  <p className="text-[11px] text-emerald-400/70 mt-0.5 leading-relaxed">
                    The AI has full context on this lead — every message, qualification answer, objection,
                    and appointment detail. It will pick up exactly where it left off.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Messages — filter voice transcripts at render time so they never appear here */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.filter(m => !m.channel || m.channel === "sms").length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              The AI will text this lead within 3.7 seconds of them submitting a form.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.filter(m => !m.channel || m.channel === "sms").map((msg) => {
              const isOutbound = msg.direction === "outbound"
              const isAi = msg.sent_by === "ai"
              const isReminder = msg.sent_by === "reminder"
              const ageSeconds = (Date.now() - new Date(msg.created_at).getTime()) / 1000
              const deliveryFailed = isOutbound && !isReminder && msg.twilio_sid === null && ageSeconds > 15
              const isInitial = initialMessages.some((m) => m.id === msg.id)

              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={isInitial ? false : { opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
                  className={cn("flex gap-2", isOutbound ? "justify-end" : "justify-start")}
                >
                  {!isOutbound && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}

                  <div className={cn("max-w-[75%] space-y-1", isOutbound && "items-end flex flex-col")}>
                    <motion.div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        isOutbound
                          ? isAi
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-sky-700 text-white rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                        deliveryFailed && "opacity-60"
                      )}
                    >
                      {msg.body}
                    </motion.div>
                    <div className="flex items-center gap-1.5 px-1">
                      {isOutbound && isAi && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Bot className="w-2.5 h-2.5" /> AI
                        </span>
                      )}
                      {isOutbound && !isAi && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" /> You
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString("en-US", {
                          hour: "numeric", minute: "2-digit",
                          timeZone: companyTimezone,
                        })}
                      </span>
                      {deliveryFailed && (
                        <span className="text-[10px] text-red-400 flex items-center gap-0.5 font-medium">
                          <XCircle className="w-2.5 h-2.5" /> Not delivered
                        </span>
                      )}
                    </div>
                  </div>

                  {isOutbound && (
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      isAi ? "bg-primary/20" : "bg-sky-700/30"
                    )}>
                      {isAi
                        ? <Bot className="w-3.5 h-3.5 text-primary" />
                        : <User className="w-3.5 h-3.5 text-sky-400" />
                      }
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </motion.div>
        )}
        {aiSmsPaused ? (
          <div className="flex items-center gap-1.5">
            <Info className="w-3 h-3 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400/90">
              SMS Agent paused — your message will be sent as you. The AI will not auto-reply.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Send a manual message — the SMS Agent will continue responding to their replies.
          </p>
        )}
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (⌘↵ to send)"
            rows={2}
            className="resize-none text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            size="icon"
            className="shrink-0 self-end h-10 w-10"
          >
            {sending
              ? <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

function AgentToggleCard({
  icon,
  label,
  paused,
  toggling,
  onToggle,
}: {
  icon: React.ReactNode
  label: string
  paused: boolean
  toggling: boolean
  onToggle: () => void
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
      paused
        ? "bg-amber-500/5 border-amber-500/25"
        : "bg-emerald-500/5 border-emerald-500/20"
    )}>
      <span className={paused ? "text-amber-400" : "text-emerald-400"}>
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium leading-none">{label}</span>
        <span className={cn(
          "text-[10px] mt-0.5 leading-none",
          paused ? "text-amber-400/70" : "text-emerald-400/70"
        )}>
          {paused ? "Paused" : "Active"}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        disabled={toggling}
        className={cn(
          "h-6 px-2 text-[10px] gap-1 rounded-md font-medium ml-1",
          paused
            ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            : "text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
        )}
      >
        {toggling ? (
          <div className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
        ) : paused ? (
          <><Play className="w-2.5 h-2.5" /> Resume</>
        ) : (
          <><Pause className="w-2.5 h-2.5" /> Pause</>
        )}
      </Button>
    </div>
  )
}
