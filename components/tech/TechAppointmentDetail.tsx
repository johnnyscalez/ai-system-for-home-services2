"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Phone, MapPin, Clock, Calendar, Car, CheckCircle,
  Loader2, X, DollarSign, MessageSquare, User, Zap, AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

// ── Types ──────────────────────────────────────────────────────────────────────

type Conversation = {
  id: string
  direction: "inbound" | "outbound"
  body: string
  sent_by: "ai" | "human"
  created_at: string
}

type Lead = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  email: string | null
  address: string | null
  service_type: string | null
  job_type: string | null
  status: string
}

type Appointment = {
  id: string
  scheduled_at: string
  address: string | null
  notes: string | null
  status: string
}

interface Props {
  appointment: Appointment
  lead: Lead
  conversations: Conversation[]
  techName: string
  timezone: string
}

// ── On My Way Dialog ───────────────────────────────────────────────────────────

function OnMyWayDialog({
  appointmentId,
  leadFirstName,
  onClose,
}: {
  appointmentId: string
  leadFirstName: string
  onClose: () => void
}) {
  const [minutes, setMinutes] = useState("15")
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function send() {
    const m = parseInt(minutes)
    if (isNaN(m) || m < 1) { setError("Enter a valid number of minutes."); return }
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/tech/appointments/${appointmentId}/on-my-way`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: m }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {!sent ? (
          <>
            <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                  <Car className="w-4 h-4 text-[#F97316]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1C1917] text-sm">On My Way</p>
                  <p className="text-xs text-[#78716C]">Let {leadFirstName} know you&apos;re coming</p>
                </div>
              </div>
              <button onClick={onClose} className="text-[#A8A29E] hover:text-[#1C1917] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#FAFAF8] rounded-xl p-3 text-xs text-[#78716C] leading-relaxed border border-[#E7E5E4]">
                <p className="font-medium text-[#1C1917] mb-1">Message preview:</p>
                <p className="italic">
                  &quot;Hey {leadFirstName}! Just wanted to let you know that [you], our specialist, is on his way and will be there in about <span className="font-semibold text-[#F97316]">{minutes || "?"} minute{parseInt(minutes) === 1 ? "" : "s"}</span>! 🚗&quot;
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1C1917]">Minutes until arrival</Label>
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={minutes}
                  onChange={e => setMinutes(e.target.value)}
                  className="border-[#E7E5E4] focus-visible:ring-[#F97316] text-lg font-semibold font-mono"
                  placeholder="15"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={onClose} className="flex-1 border-[#E7E5E4]">
                  Cancel
                </Button>
                <Button
                  onClick={send}
                  disabled={sending}
                  className="flex-1 bg-[#F97316] hover:bg-[#ea6d04] text-white gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
                  Send
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </motion.div>
            <p className="font-semibold text-[#1C1917] mb-1">Message sent!</p>
            <p className="text-sm text-[#78716C] mb-4">{leadFirstName} knows you&apos;re on your way.</p>
            <Button onClick={onClose} className="bg-[#F97316] hover:bg-[#ea6d04] text-white">
              Close
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── Close Job Dialog ───────────────────────────────────────────────────────────

function CloseJobDialog({
  appointmentId,
  leadName,
  onClose,
  onSuccess,
}: {
  appointmentId: string
  leadName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [dealValue, setDealValue] = useState("")
  const [closing, setClosing]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function close() {
    setClosing(true)
    setError(null)
    try {
      const res = await fetch(`/api/tech/appointments/${appointmentId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealValue: dealValue ? parseFloat(dealValue) : null }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-[#1C1917] text-sm">Mark as Closed</p>
              <p className="text-xs text-[#78716C]">Job with {leadName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#A8A29E] hover:text-[#1C1917] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#1C1917]">
              Deal value <span className="text-[#A8A29E] font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
              <Input
                type="number"
                min={0}
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                placeholder="0.00"
                className="pl-9 border-[#E7E5E4] focus-visible:ring-emerald-500 text-lg font-semibold font-mono"
              />
            </div>
            <p className="text-xs text-[#A8A29E]">Leave blank if you don&apos;t know the final amount yet.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            This will mark the job as <strong>Closed Won</strong> in your manager&apos;s pipeline and stop all follow-up messages.
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 border-[#E7E5E4]">
              Cancel
            </Button>
            <Button
              onClick={close}
              disabled={closing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Close job
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TechAppointmentDetail({ appointment, lead, conversations, techName, timezone }: Props) {
  const router = useRouter()
  const [showOnMyWay, setShowOnMyWay]   = useState(false)
  const [showClose, setShowClose]       = useState(false)
  const [isClosed, setIsClosed]         = useState(
    appointment.status === "completed" || lead.status === "closed_won"
  )
  const [propertyImage, setPropertyImage] = useState<string | null>(null)
  const [imageSource, setImageSource]     = useState<string | null>(null)

  const date       = new Date(appointment.scheduled_at)
  const dateLabel  = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone })
  const timeLabel  = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })
  const leadName   = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Lead"
  const leadFirst  = lead.first_name ?? "there"
  const address    = appointment.address || lead.address

  useEffect(() => {
    if (!address) return
    fetch("/api/property-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.imageUrl) {
          setPropertyImage(d.imageUrl)
          setImageSource(d.source)
        }
      })
      .catch(() => {})
  }, [address])

  return (
    <>
      <AnimatePresence>
        {showOnMyWay && (
          <OnMyWayDialog
            appointmentId={appointment.id}
            leadFirstName={leadFirst}
            onClose={() => setShowOnMyWay(false)}
          />
        )}
        {showClose && (
          <CloseJobDialog
            appointmentId={appointment.id}
            leadName={leadName}
            onClose={() => setShowClose(false)}
            onSuccess={() => { setShowClose(false); setIsClosed(true) }}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col h-screen">
        {/* Top bar */}
        <div className="px-4 py-3 border-b border-[#E7E5E4] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/tech/appointments" className="flex items-center gap-1.5 text-sm text-[#78716C] hover:text-[#1C1917] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              My Jobs
            </Link>
            <span className="text-[#E7E5E4]">/</span>
            <span className="text-sm font-medium text-[#1C1917]">{leadName}</span>
          </div>

          {isClosed ? (
            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3 h-3 mr-1" /> Closed
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOnMyWay(true)}
                className="gap-1.5 border-[#F97316]/30 text-[#F97316] hover:bg-[#FFF3EC] hover:border-[#F97316]/50 text-xs"
              >
                <Car className="w-3.5 h-3.5" />
                On My Way
              </Button>
              <Button
                size="sm"
                onClick={() => setShowClose(true)}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Close Job
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left panel — info */}
          <div className="md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-[#E7E5E4] overflow-y-auto max-h-[40vh] md:max-h-none bg-white">
            {/* Property image */}
            {propertyImage && (
              <div className="relative w-full h-36 overflow-hidden">
                <img
                  src={propertyImage}
                  alt={`Property at ${address}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                {imageSource === "street_view" && (
                  <span className="absolute bottom-2 right-2 text-[10px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded">
                    Street View
                  </span>
                )}
                {imageSource === "maps_static_fallback" && (
                  <span className="absolute bottom-2 right-2 text-[10px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded">
                    Satellite
                  </span>
                )}
              </div>
            )}

            <div className="p-4 space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center text-center gap-2 pt-2">
              <div className="w-14 h-14 rounded-full bg-[#F97316]/10 flex items-center justify-center text-xl font-bold text-[#F97316]">
                {lead.first_name?.[0] ?? "?"}{lead.last_name?.[0] ?? ""}
              </div>
              <div>
                <h2 className="font-semibold text-base text-[#1C1917]">{leadName}</h2>
                {lead.service_type && (
                  <p className="text-xs text-[#78716C] capitalize">{(lead.job_type ?? lead.service_type).replace(/_/g, " ")}</p>
                )}
              </div>
            </div>

            {/* Appointment details */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">Appointment</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#A8A29E] shrink-0" />
                  <span className="text-[#1C1917]">{dateLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#A8A29E] shrink-0" />
                  <span className="text-[#1C1917]">{timeLabel}</span>
                </div>
                {address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#A8A29E] shrink-0 mt-0.5" />
                    <span className="text-[#1C1917] text-xs">{address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">Contact</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#A8A29E] shrink-0" />
                  <a href={`tel:${lead.phone}`} className="text-xs font-mono text-[#F97316] hover:underline">
                    {lead.phone}
                  </a>
                </div>
                {lead.email && (
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#A8A29E] shrink-0" />
                    <span className="text-xs text-[#78716C] truncate">{lead.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {appointment.notes && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">Job notes</p>
                <p className="text-xs text-[#78716C] bg-[#FAFAF8] rounded-lg p-3 leading-relaxed border border-[#E7E5E4]">
                  {appointment.notes}
                </p>
              </div>
            )}

            {/* Mobile action buttons */}
            {!isClosed && (
              <div className="flex gap-2 md:hidden pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOnMyWay(true)}
                  className="flex-1 gap-1.5 border-[#F97316]/30 text-[#F97316] hover:bg-[#FFF3EC]"
                >
                  <Car className="w-3.5 h-3.5" /> On My Way
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowClose(true)}
                  className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Close
                </Button>
              </div>
            )}
            </div>
          </div>

          {/* Right panel — conversation (read-only) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFAF8]">
            <div className="px-4 py-3 border-b border-[#E7E5E4] bg-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#A8A29E]" />
              <p className="text-sm font-medium text-[#1C1917]">AI Conversation</p>
              <span className="text-xs text-[#A8A29E]">— {conversations.length} messages</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversations.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-8 h-8 text-[#E7E5E4] mx-auto mb-3" />
                  <p className="text-sm text-[#A8A29E]">No messages yet</p>
                </div>
              ) : (
                conversations.map((msg) => {
                  const isOutbound = msg.direction === "outbound"
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isOutbound
                            ? msg.sent_by === "ai"
                              ? "bg-[#F97316] text-white rounded-br-md"
                              : "bg-[#1C1917] text-white rounded-br-md"
                            : "bg-white border border-[#E7E5E4] text-[#1C1917] rounded-bl-md shadow-sm"
                        }`}
                      >
                        {msg.body}
                        <div className={`text-[10px] mt-1 ${isOutbound ? "text-white/60" : "text-[#A8A29E]"}`}>
                          {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {isOutbound && msg.sent_by === "ai" && " · AI"}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
