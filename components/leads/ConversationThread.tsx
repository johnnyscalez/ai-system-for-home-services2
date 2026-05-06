"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Send, Bot, User, Pause, Play, AlertCircle, XCircle } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Message = {
  id: string
  direction: "inbound" | "outbound"
  sent_by: "ai" | "human" | "reminder" | string
  body: string
  created_at: string
  twilio_sid?: string | null
}

type Props = {
  leadId: string
  companyId: string
  initialMessages: Message[]
  aiPaused: boolean
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
  leadStatus,
  fromNumber,
  leadPhone,
  companyTimezone = "America/New_York",
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [aiPaused, setAiPaused] = useState(initialAiPaused)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [togglingAi, setTogglingAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef(messages)
  const animatedIds = useRef(new Set(initialMessages.map((m) => m.id)))
  const supabase = createClient()

  useEffect(() => { messagesRef.current = messages }, [messages])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Merge incoming rows into state — animates new ones, updates twilio_sid on existing
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

  // Polling — guaranteed delivery every 3 seconds regardless of realtime status
  useEffect(() => {
    const poll = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, direction, sent_by, body, created_at, twilio_sid")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true })

      if (!data) return

      // Track which IDs are new for animation
      data.forEach((row) => {
        if (!animatedIds.current.has(row.id)) {
          animatedIds.current.add(row.id)
        }
      })

      mergeMessages(data as Message[])
    }

    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [leadId, supabase, mergeMessages])

  // Realtime subscription — bonus layer on top of polling
  useEffect(() => {
    const channel = supabase
      .channel(`conversations-thread:${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          const msg = payload.new as Message
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

  const toggleAi = async () => {
    setTogglingAi(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/ai-pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !aiPaused }),
      })
      if (res.ok) setAiPaused(!aiPaused)
    } finally {
      setTogglingAi(false)
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
        <div className="flex items-center gap-2">
          {aiPaused ? (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1">
              <Pause className="w-3 h-3" /> AI paused
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
              <Bot className="w-3 h-3" /> AI active
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAi}
            disabled={togglingAi}
            className="text-xs h-7 gap-1.5"
          >
            {aiPaused ? (
              <><Play className="w-3 h-3" /> Resume AI</>
            ) : (
              <><Pause className="w-3 h-3" /> Pause AI</>
            )}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              The AI will text this lead within 60 seconds of them submitting a form.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isOutbound = msg.direction === "outbound"
              const isAi = msg.sent_by === "ai"
              const isReminder = msg.sent_by === "reminder"
              const ageSeconds = (Date.now() - new Date(msg.created_at).getTime()) / 1000
              // Only flag delivery failure for AI messages — reminder/confirmation SMS may not have a SID logged yet
              const deliveryFailed = isOutbound && !isReminder && msg.twilio_sid === null && ageSeconds > 15
              const isInitial = initialMessages.some((m) => m.id === msg.id)

              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={isInitial ? false : {
                    opacity: 0,
                    y: 18,
                    scale: 0.96,
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 28,
                    mass: 0.8,
                  }}
                  className={cn(
                    "flex gap-2",
                    isOutbound ? "justify-end" : "justify-start"
                  )}
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
        {aiPaused && (
          <p className="text-xs text-amber-400/80">
            AI is paused — your message will be sent as you.
          </p>
        )}
        {!aiPaused && (
          <p className="text-xs text-muted-foreground">
            Send a manual message — AI will continue responding to their replies.
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
