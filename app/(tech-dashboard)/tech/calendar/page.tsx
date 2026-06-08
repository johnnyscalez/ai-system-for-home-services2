"use client"

import { motion } from "framer-motion"
import { TechWeekCalendar } from "@/components/tech/TechWeekCalendar"

export default function TechCalendarPage() {
  return (
    <div className="relative flex flex-col h-screen bg-[#FAFAF8] overflow-hidden">
      {/* Visual background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <motion.div animate={{ y: [0,-18,0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(249,115,22,0.05)", top: "-10%", right: "0%" }} />
        <motion.div animate={{ y: [0,15,0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(77,124,15,0.04)", bottom: "0%", left: "-5%" }} />
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 py-4 border-b border-[#E7E5E4] bg-white/90 backdrop-blur-sm shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1C1917]">My Calendar</h1>
          <p className="text-xs text-[#78716C] mt-0.5">All your scheduled jobs at a glance</p>
        </div>
      </div>

      {/* Calendar fills remaining height */}
      <div className="relative z-10 flex-1 min-h-0 bg-white/60">
        <TechWeekCalendar />
      </div>
    </div>
  )
}
