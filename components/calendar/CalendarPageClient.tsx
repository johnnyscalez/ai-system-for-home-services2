"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { WeekCalendar } from "./WeekCalendar"
import { AvailabilityDrawer } from "./AvailabilityDrawer"
import { CalendarCheck, ExternalLink, SlidersHorizontal } from "lucide-react"

type Props = {
  isGcalConnected: boolean
  gcalEmail?: string | null
}

export function CalendarPageClient({ isGcalConnected, gcalEmail }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen relative overflow-hidden">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-sm z-10">
        <div>
          <h1 className="text-xl font-bold">Calendar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">All booked appointments at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          {isGcalConnected ? (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-muted-foreground">Google Calendar synced</span>
              <span className="text-emerald-400 font-medium">{gcalEmail}</span>
            </div>
          ) : (
            <a
              href="/api/auth/google-calendar"
              className="flex items-center gap-2 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              Connect Google Calendar
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-4 py-2 rounded-lg shadow-sm transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Edit Availability
          </button>
        </div>
      </div>

      {/* Calendar — always full height */}
      <div className="flex-1 overflow-hidden">
        <WeekCalendar />
      </div>

      {/* Backdrop */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Availability drawer — slides in from right */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.9 }}
            className="fixed right-0 top-0 bottom-0 z-40 w-[360px] bg-card border-l border-border shadow-2xl flex flex-col"
          >
            <AvailabilityDrawer onClose={() => setDrawerOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
