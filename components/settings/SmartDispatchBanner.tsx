"use client"

import { BrainCircuit, Wrench, CalendarCheck, MapPin, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const FEATURES = [
  {
    icon: Wrench,
    title: "Matches skill to job",
    desc: "Each technician has specializations. When a lead books an AC repair, your AI assigns an AC tech — not whoever happens to be free.",
  },
  {
    icon: CalendarCheck,
    title: "Respects working hours",
    desc: "Set each tech's working schedule. The AI only books within their available hours so you never get a double-book or an after-hours surprise.",
  },
  {
    icon: MapPin,
    title: "Covers their service area",
    desc: "Assign zip codes to each tech. The AI matches every lead to the nearest available technician in their area automatically.",
  },
]

export function SmartDispatchBanner({ techCount }: { techCount: number }) {
  const [expanded, setExpanded] = useState(techCount === 0)

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-all duration-200",
      "bg-gradient-to-br from-[#7C3AED]/5 via-white to-[#4D7C0F]/5 border-[#7C3AED]/20"
    )}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center shadow-sm shrink-0">
          <BrainCircuit className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#1C1917]" style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              Smart Dispatch — powered by your AI agent
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#7C3AED] text-white">
              Active
            </span>
          </div>
          <p className="text-xs text-[#78716C] mt-0.5">
            {techCount === 0
              ? "Add your first technician below to activate smart booking."
              : `Routing jobs across ${techCount} technician${techCount > 1 ? "s" : ""} by skill, schedule, and service area.`}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-[#78716C] shrink-0" />
          : <ChevronDown className="w-4 h-4 text-[#78716C] shrink-0" />}
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            <div className="px-5 pb-5 border-t border-[#7C3AED]/10">
              <p className="text-sm text-[#78716C] mt-4 mb-4 leading-relaxed">
                Every time your AI books an appointment, it doesn't just pick any slot.
                It looks at your technicians' specializations, real-time schedule, and service zip codes —
                and assigns the <span className="font-medium text-[#1C1917]">best available person</span> for that exact job.
                No dispatch calls. No manual scheduling. It just happens.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="bg-white rounded-lg border border-[#E7E5E4] p-3.5 shadow-sm">
                    <div className="w-6 h-6 rounded-md bg-[#7C3AED]/10 flex items-center justify-center mb-2">
                      <Icon className="w-3 h-3 text-[#7C3AED]" />
                    </div>
                    <p className="text-xs font-semibold text-[#1C1917]">{title}</p>
                    <p className="text-[11px] text-[#78716C] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              {techCount === 0 && (
                <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-3">
                  <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">No technicians yet.</span> Until you add at least one,
                    appointments will be booked without a specific technician assigned. Add your team below to activate Smart Dispatch.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
