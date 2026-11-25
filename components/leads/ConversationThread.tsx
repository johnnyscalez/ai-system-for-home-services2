"use client"

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Send, Bot, User, Pause, Play, AlertCircle, XCircle,
  MessageSquare, Phone, CheckCircle2, Info, Bell, Loader2, Settings2,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { hasRealPhone } from "@/lib/lead-status"
import { useVisiblePoll } from "@/components/leads/live"

export type ThreadMessage = {
  id: string
  direction: "inbound" | "outbound"
  sent_by: "ai" | "human" | "reminder" | "system" | string
  body: string
  created_at: string
  twilio_sid?: string | null
  channel?: string | null
  delivery_status?: string | null
  delivery_error_code?: string | null
}

type AgentType = "sms" | "voice"

type Props = {
  leadId: string
  initialMessages: ThreadMessage[]
  /** Owned by the lead page so it follows the live lead record */
  aiPaused: boolean
  aiVoicePaused: boolean
  onPauseChange: (patch: { ai_paused?: boolean; ai_voice_paused?: boolean }) => void
  /** Called when a message arrives or changes, so the page can refetch the lead */
  onActivity?: () => void
  leadPhone: string
  companyTimezone?: string
  leadChannel?: string | null
  /** The assistant's name from the company's AI settings */
  agentName?: string
  /** False for every company with the voice agent off: no voice controls render */
  voiceEnabled?: boolean
}

const MESSAGE_FIELDS = "id, direction, sent_by, body, created_at, twilio_sid, channel, delivery_status, delivery_error_code"

// Brand glyph for Messenger (lucide has no Messenger icon)
function MessengerGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.145 2 11.26c0 2.913 1.454 5.512 3.726 7.21V22l3.405-1.869c.909.252 1.871.388 2.869.388 5.523 0 10-4.145 10-9.259C22 6.145 17.523 2 12 2zm1.008 12.461-2.546-2.716-4.97 2.716 5.467-5.804 2.609 2.716 4.906-2.716-5.466 5.804z" />
    </svg>
  )
}

const MESSENGER_COLOR = "#0084FF"

// What the carrier told us, in plain words. Codes are Twilio error codes.
const DELIVERY_REASONS: Record<string, string> = {
  "30034": "Your texting number is not registered with US carriers yet, so they blocked this text.",
  "30007": "The carrier filtered this text as spam.",
  "30003": "The phone is unreachable or switched off.",
  "30004": "This person's carrier is blocking texts from your number.",
  "30005": "This number does not exist or is not a mobile phone.",
  "30006": "This is a landline. It cannot receive texts.",
  "30008": "The carrier could not deliver this text.",
  "21610": "This person opted out of texts.",
  "21211": "This is not a valid phone number.",
  "21614": "This number is not a mobile phone.",
}

function deliveryReason(code: string | null | undefined): string {
  if (!code) return "The carrier did not deliver this text."
  return DELIVERY_REASONS[code] ?? `The carrier did not deliver this text (error ${code}).`
}

type DeliveryState =
  | { kind: "none" }
  | { kind: "sending" }
  | { kind: "not_sent" }
  | { kind: "failed"; reason: string }

/**
 * Delivery truth, in order of evidence:
 *  - the carrier report on the row (delivery_status) is the only source of "Not delivered";
 *  - a text row with no provider id is still being sent for its first minute;
 *  - after that, a text row that never got a provider id was never handed to the carrier.
 * Messenger rows are not tracked this way.
 */
function deliveryState(msg: ThreadMessage, nowMs: number): DeliveryState {
  if (msg.direction !== "outbound") return { kind: "none" }
  if (msg.delivery_status === "failed" || msg.delivery_status === "undelivered") {
    return { kind: "failed", reason: deliveryReason(msg.delivery_error_code) }
  }
  if (msg.channel === "messenger" || msg.channel === "voice") return { kind: "none" }
  if (msg.twilio_sid) return { kind: "none" }
  const ageSeconds = (nowMs - new Date(msg.created_at).getTime()) / 1000
  if (ageSeconds < 60) return { kind: "sending" }
  return { kind: "not_sent" }
}

function sameMessage(a: ThreadMessage, b: ThreadMessage): boolean {
  return (
    a.body === b.body &&
    (a.twilio_sid ?? null) === (b.twilio_sid ?? null) &&
    (a.delivery_status ?? null) === (b.delivery_status ?? null) &&
    (a.delivery_error_code ?? null) === (b.delivery_error_code ?? null) &&
    (a.channel ?? null) === (b.channel ?? null) &&
    a.sent_by === b.sent_by
  )
}

export function ConversationThread({
  leadId,
  initialMessages,
  aiPaused,
  aiVoicePaused,
  onPauseChange,
  onActivity,
  leadPhone,
  companyTimezone = "America/New_York",
  leadChannel = null,
  agentName = "Assistant",
  voiceEnabled = false,
}: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [togglingAgent, setTogglingAgent] = useState<AgentType | null>(null)
  const [resumedAgent, setResumedAgent] = useState<AgentType | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Re-evaluates "Sending" vs "Not sent" as rows age, without waiting for a data change.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const bottomRef = useRef<HTMLDivElement>(null)
  // Messages present at first paint do not animate in; later ones do.
  const [initialIds] = useState(() => new Set(initialMessages.map((m) => m.id)))
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])
  const resumeBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const onActivityRef = useRef(onActivity)
  useEffect(() => { onActivityRef.current = onActivity })

  const visible = useMemo(() => messages.filter((m) => m.channel !== "voice"), [messages])
  const lastVisibleId = visible.length ? visible[visible.length - 1].id : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lastVisibleId])

  useEffect(() => {
    return () => {
      if (resumeBannerTimer.current) clearTimeout(resumeBannerTimer.current)
    }
  }, [])

  // The full thread from the database. Authoritative: rows the engine rewrote
  // (guards replace a draft before it is sent) or removed show the stored truth.
  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select(MESSAGE_FIELDS)
      .eq("lead_id", leadId)
      // Text thread = sms + messenger (legacy rows have null channel).
      .or("channel.is.null,channel.neq.voice")
      .order("created_at", { ascending: true })
    setNowMs(Date.now())
    if (!data) return
    const rows = data as ThreadMessage[]
    const prev = messagesRef.current
    const prevMap = new Map(prev.map((m) => [m.id, m]))
    let changed = false
    const merged = rows.map((row) => {
      const existing = prevMap.get(row.id)
      if (existing && sameMessage(existing, row)) return existing
      changed = true
      return row
    })
    // A message that arrived over realtime after this query started is newer
    // than everything the query returned: keep it instead of dropping it.
    const rowIds = new Set(rows.map((r) => r.id))
    const newestMs = rows.length ? Date.parse(rows[rows.length - 1].created_at) : -Infinity
    for (const m of prev) {
      if (!rowIds.has(m.id) && Date.parse(m.created_at) > newestMs) merged.push(m)
    }
    if (!changed && merged.length === prev.length) return
    messagesRef.current = merged
    setMessages(merged)
    onActivityRef.current?.()
  }, [leadId, supabase])

  useVisiblePoll(refetch, 4000)

  // Realtime: conversations is in the publication, so this is the fast path.
  useEffect(() => {
    const channel = supabase
      .channel(`conversations-thread:${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          const msg = payload.new as ThreadMessage
          if (msg.channel === "voice") return
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          onActivityRef.current?.()
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          const updated = payload.new as ThreadMessage
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    body: updated.body,
                    twilio_sid: updated.twilio_sid,
                    delivery_status: updated.delivery_status,
                    delivery_error_code: updated.delivery_error_code,
                    channel: updated.channel,
                    sent_by: updated.sent_by,
                  }
                : m
            )
          )
          onActivityRef.current?.()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [leadId, supabase])

  // Which channel is this thread on? The latest message wins, then the lead's own
  // channel. Decides the header and where a manual reply goes. Anything that is
  // not Messenger is a text message.
  const lastVisible = visible.length ? visible[visible.length - 1] : null
  const threadChannel: "sms" | "messenger" =
    (lastVisible ? lastVisible.channel : leadChannel) === "messenger" ? "messenger" : "sms"

  const phoneOnFile = hasRealPhone(leadPhone)
  const canSend = threadChannel === "messenger" || phoneOnFile

  const handleSend = useCallback(async () => {
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError(null)
    setDraft("")

    try {
      // Messenger leads get replies through the Messenger Send API: their
      // phone may be a placeholder, so a text would go nowhere.
      const endpoint = threadChannel === "messenger" ? "/api/messenger/send" : "/api/sms/send"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, body }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? `The message was not sent (server answered ${res.status}).`)
        setDraft(body)
      } else {
        // The server pauses the assistant when a person replies: show it at once.
        onPauseChange({ ai_paused: true })
        void refetch()
      }
    } catch {
      setError("Could not reach the server. The message was not sent.")
      setDraft(body)
    } finally {
      setSending(false)
    }
  }, [draft, leadId, sending, threadChannel, onPauseChange, refetch])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleAgent = async (agent: AgentType) => {
    const currentlyPaused = agent === "sms" ? aiPaused : aiVoicePaused
    const newPaused = !currentlyPaused

    setTogglingAgent(agent)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/ai-pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: newPaused, agent }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? "Could not change the assistant setting.")
        return
      }
      onPauseChange(agent === "sms" ? { ai_paused: newPaused } : { ai_voice_paused: newPaused })

      // When re-enabling, show the full-context banner for 5 seconds
      if (!newPaused) {
        setResumedAgent(agent)
        if (resumeBannerTimer.current) clearTimeout(resumeBannerTimer.current)
        resumeBannerTimer.current = setTimeout(() => setResumedAgent(null), 5000)
      }
    } catch {
      setError("Could not reach the server. The assistant setting did not change.")
    } finally {
      setTogglingAgent(null)
    }
  }

  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: companyTimezone })
  const todayKey = dayKey(new Date(nowMs).toISOString())
  const yesterdayKey = dayKey(new Date(nowMs - 24 * 60 * 60 * 1000).toISOString())
  const dayLabel = (iso: string) => {
    const key = dayKey(iso)
    if (key === todayKey) return "Today"
    if (key === yesterdayKey) return "Yesterday"
    const sameYear = key.slice(0, 4) === todayKey.slice(0, 4)
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
      timeZone: companyTimezone,
    })
  }

  const anyPaused = aiPaused || (voiceEnabled && aiVoicePaused)

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      {/* Thread header: Messenger or text */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {threadChannel === "messenger" ? (
            <>
              <span style={{ color: MESSENGER_COLOR }}><MessengerGlyph className="w-4 h-4" /></span>
              <span className="text-sm font-medium" style={{ color: MESSENGER_COLOR }}>
                Messenger conversation
              </span>
            </>
          ) : (
            <span className="text-sm font-medium">Text conversation</span>
          )}
          <span className="text-xs text-muted-foreground font-mono truncate">
            {phoneOnFile ? leadPhone : "No phone on file"}
          </span>
        </div>
        {anyPaused ? (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 gap-1">
            <Pause className="w-3 h-3" />
            {!voiceEnabled
              ? "Assistant paused"
              : aiPaused && aiVoicePaused ? "Text and voice paused" : aiPaused ? "Text assistant paused" : "Voice assistant paused"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
            <Bot className="w-3 h-3" /> {agentName} is handling this lead
          </Badge>
        )}
      </div>

      {/* Assistant controls */}
      <div className="px-5 py-3 border-b border-border/60 bg-muted/20 shrink-0">
        <div className="flex flex-wrap gap-2">
          <AgentToggleCard
            icon={<MessageSquare className="w-3.5 h-3.5" />}
            label={voiceEnabled ? "Text assistant" : `${agentName} (AI assistant)`}
            paused={aiPaused}
            toggling={togglingAgent === "sms"}
            onToggle={() => toggleAgent("sms")}
          />
          {voiceEnabled && (
            <AgentToggleCard
              icon={<Phone className="w-3.5 h-3.5" />}
              label="Voice assistant"
              paused={aiVoicePaused}
              toggling={togglingAgent === "voice"}
              onToggle={() => toggleAgent("voice")}
            />
          )}
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
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-emerald-700">
                    {resumedAgent === "sms" ? "Assistant" : "Voice assistant"} turned back on
                  </p>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5 leading-relaxed">
                    It reads the whole thread first, including what you wrote, and picks up from there.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Every text with this lead shows here as it is sent or received.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visible.map((msg, index) => {
              const isOutbound = msg.direction === "outbound"
              const sender = isOutbound ? senderOf(msg.sent_by, agentName) : null
              const delivery = deliveryState(msg, nowMs)
              const failed = delivery.kind === "failed" || delivery.kind === "not_sent"
              const isMessenger = msg.channel === "messenger"
              const isInitial = initialIds.has(msg.id)
              const showDay = index === 0 || dayKey(visible[index - 1].created_at) !== dayKey(msg.created_at)

              return (
                <Fragment key={msg.id}>
                  {showDay && (
                    <div className="flex items-center gap-3 py-1" role="separator" aria-label={dayLabel(msg.created_at)}>
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {dayLabel(msg.created_at)}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <motion.div
                    initial={isInitial ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className={cn("flex gap-2", isOutbound ? "justify-end" : "justify-start")}
                  >
                    {!isOutbound && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}

                    <div className={cn("max-w-[75%] space-y-1", isOutbound && "items-end flex flex-col")}>
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                          !isOutbound && "bg-muted text-foreground rounded-bl-sm",
                          isOutbound && sender?.kind === "ai" && "bg-primary text-primary-foreground rounded-br-sm",
                          isOutbound && sender?.kind === "human" && "bg-[#1A1614] text-white rounded-br-sm",
                          isOutbound && (sender?.kind === "reminder" || sender?.kind === "system") &&
                            "bg-white text-foreground border border-border rounded-br-sm",
                          failed && "opacity-60"
                        )}
                      >
                        {msg.body}
                      </div>
                      <div className={cn("flex items-center gap-1.5 px-1 flex-wrap", isOutbound && "justify-end")}>
                        {sender && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <sender.Icon className="w-2.5 h-2.5" /> {sender.label}
                          </span>
                        )}
                        {isMessenger && (
                          <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: MESSENGER_COLOR }}>
                            <MessengerGlyph className="w-2.5 h-2.5" /> Messenger
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString("en-US", {
                            hour: "numeric", minute: "2-digit",
                            timeZone: companyTimezone,
                          })}
                        </span>
                        {delivery.kind === "sending" && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending
                          </span>
                        )}
                        {delivery.kind === "not_sent" && (
                          <span className="text-[10px] text-red-600 flex items-center gap-0.5 font-medium">
                            <XCircle className="w-2.5 h-2.5" /> Not sent
                          </span>
                        )}
                        {delivery.kind === "failed" && (
                          <span className="text-[10px] text-red-600 flex items-center gap-0.5 font-medium">
                            <XCircle className="w-2.5 h-2.5" /> Not delivered
                          </span>
                        )}
                      </div>
                      {delivery.kind === "failed" && (
                        <p className="text-[11px] text-red-600 px-1 max-w-xs text-right">{delivery.reason}</p>
                      )}
                      {delivery.kind === "not_sent" && (
                        <p className="text-[11px] text-red-600 px-1 max-w-xs text-right">
                          This text was written but never left the system. Check the texting number in Settings.
                        </p>
                      )}
                    </div>

                    {isOutbound && sender && (
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        sender.kind === "ai" ? "bg-primary/15" : sender.kind === "human" ? "bg-[#1A1614]/10" : "bg-muted"
                      )}>
                        <sender.Icon className={cn(
                          "w-3.5 h-3.5",
                          sender.kind === "ai" ? "text-primary" : sender.kind === "human" ? "text-[#1A1614]" : "text-muted-foreground"
                        )} />
                      </div>
                    )}
                  </motion.div>
                </Fragment>
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
            role="alert"
            className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
        {!canSend ? (
          <div className="flex items-start gap-1.5">
            <Info className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              This lead has no phone number on file yet. Add one under Edit details to text them.
            </p>
          </div>
        ) : aiPaused ? (
          <div className="flex items-start gap-1.5">
            <Info className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              The assistant is paused on this lead. Your message goes out as you, and the assistant stays quiet until you resume it.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sending a message yourself pauses the assistant on this lead until you resume it above.
          </p>
        )}
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={canSend ? "Type a message (Cmd or Ctrl + Enter to send)" : "No phone number on file"}
            aria-label="Message to this lead"
            rows={2}
            disabled={!canSend}
            className="resize-none text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={!draft.trim() || sending || !canSend}
            size="icon"
            aria-label="Send message"
            className="shrink-0 self-end h-10 w-10"
          >
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

type Sender = { kind: "ai" | "human" | "reminder" | "system"; label: string; Icon: React.ElementType }

function senderOf(sentBy: string, agentName: string): Sender {
  switch (sentBy) {
    case "ai":       return { kind: "ai", label: agentName, Icon: Bot }
    case "reminder": return { kind: "reminder", label: "Reminder", Icon: Bell }
    case "system":   return { kind: "system", label: "System", Icon: Settings2 }
    default:         return { kind: "human", label: "You", Icon: User }
  }
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
      paused ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
    )}>
      <span className={paused ? "text-amber-600" : "text-emerald-600"}>
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium leading-none">{label}</span>
        <span className={cn(
          "text-[10px] mt-0.5 leading-none",
          paused ? "text-amber-700" : "text-emerald-700"
        )}>
          {paused ? "Paused" : "On"}
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
            ? "text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            : "text-amber-700 hover:bg-amber-100 hover:text-amber-800"
        )}
      >
        {toggling ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : paused ? (
          <><Play className="w-2.5 h-2.5" /> Resume</>
        ) : (
          <><Pause className="w-2.5 h-2.5" /> Pause</>
        )}
      </Button>
    </div>
  )
}
