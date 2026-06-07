"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Calendar, Clock, MapPin, ChevronRight, CheckCircle2, Circle, HardHat } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export type AppointmentWithLead = {
  id: string
  scheduled_at: string
  address: string | null
  notes: string | null
  status: string
  leads: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string
    address: string | null
    service_type: string | null
    job_type: string | null
    status: string
  } | null
}

function AppCard({ apt, dim = false }: { apt: AppointmentWithLead; dim?: boolean }) {
  // Supabase join returns array for one-to-many; grab first element
  const lead = Array.isArray(apt.leads) ? apt.leads[0] : apt.leads
  const date = new Date(apt.scheduled_at)
  const isToday = new Date().toDateString() === date.toDateString()
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === date.toDateString()

  const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : date.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  })
  const timeLabel = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

  const displayAddress = apt.address || lead?.address

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.99 }}
      className={dim ? "opacity-50" : ""}
    >
      <Link href={`/tech/appointments/${apt.id}`}>
        <div className="bg-white border border-[#E7E5E4] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(249,115,22,0.08)] hover:border-[#F97316]/20 transition-all p-4 md:p-5 flex items-center gap-4">
          {/* Date bubble */}
          <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center ${isToday ? "bg-[#F97316] text-white" : "bg-[#F5F4F2] text-[#1C1917]"}`}>
            <span className={`text-xs font-semibold ${isToday ? "text-white/80" : "text-[#78716C]"}`}>
              {date.toLocaleDateString("en-US", { month: "short" })}
            </span>
            <span className="text-xl font-bold leading-none">
              {date.getDate()}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[#1C1917]">
                {lead?.first_name ?? "?"} {lead?.last_name ?? ""}
              </p>
              {isToday && (
                <Badge className="text-[10px] bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20 border">
                  Today
                </Badge>
              )}
              {apt.status === "completed" && (
                <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 border">
                  Completed
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-[#78716C] flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dayLabel} · {timeLabel}
              </span>
              {displayAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[180px]">{displayAddress}</span>
                </span>
              )}
            </div>

            {(lead?.job_type || lead?.service_type) && (
              <p className="text-xs text-[#F97316] font-medium mt-1 capitalize">
                {(lead.job_type ?? lead.service_type ?? "").replace(/_/g, " ")}
              </p>
            )}
          </div>

          <ChevronRight className="w-4 h-4 text-[#A8A29E] shrink-0" />
        </div>
      </Link>
    </motion.div>
  )
}

export function TechAppointmentsList({
  upcoming,
  past,
  techName,
}: {
  upcoming: AppointmentWithLead[]
  past: AppointmentWithLead[]
  techName: string
}) {
  const hasAny = upcoming.length > 0 || past.length > 0

  return (
    <div className="relative min-h-screen">
      {/* Visual background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(249,115,22,0.05)", top: "-10%", right: "-5%" }} />
      </div>

      <div className="relative z-10 p-6 max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#F97316] flex items-center justify-center">
              <HardHat className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold text-[#1C1917]"
                style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans')" }}
              >
                Hey {techName.split(" ")[0]}!
              </h1>
              <p className="text-sm text-[#78716C]">
                {upcoming.length === 0
                  ? "No upcoming appointments right now."
                  : `You have ${upcoming.length} upcoming job${upcoming.length > 1 ? "s" : ""}.`}
              </p>
            </div>
          </div>
        </motion.div>

        {!hasAny ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-dashed border-[#E7E5E4] rounded-2xl p-16 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F5F4F2] flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-6 h-6 text-[#A8A29E]" />
            </div>
            <p className="font-semibold text-[#1C1917] mb-1">No appointments yet</p>
            <p className="text-sm text-[#78716C]">Your manager will assign jobs here. Check back soon.</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-3">
                  Upcoming ({upcoming.length})
                </p>
                <div className="space-y-3">
                  {upcoming.map((apt, i) => (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <AppCard apt={apt} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-3">
                  Past jobs ({past.length})
                </p>
                <div className="space-y-3">
                  {past.slice(0, 10).map((apt, i) => (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <AppCard apt={apt} dim />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
