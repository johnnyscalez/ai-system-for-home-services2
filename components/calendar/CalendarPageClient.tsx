"use client"

import Link from "next/link"
import { WeekCalendar } from "./WeekCalendar"
import { CalendarCheck, ExternalLink, SlidersHorizontal } from "lucide-react"

type Props = {
  isGcalConnected: boolean
  gcalEmail?: string | null
  timezone?: string
}

export function CalendarPageClient({ isGcalConnected, gcalEmail, timezone }: Props) {
  return (
    <div className="flex flex-col h-screen relative overflow-hidden">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap shrink-0 bg-background/95 backdrop-blur-sm z-10">
        <div>
          <h1 className="text-xl font-bold">Calendar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">All booked measures at a glance</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isGcalConnected ? (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Google Calendar synced</span>
              <span className="text-emerald-700 font-medium">{gcalEmail}</span>
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

          {/* The days, time windows and capacity the assistant books into are
              set in one place: the measure calendar step of account setup. */}
          <Link
            href="/settings/setup"
            className="flex items-center gap-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-4 py-2 rounded-lg shadow-sm transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Measure availability
          </Link>
        </div>
      </div>

      {/* Calendar, always full height */}
      <div className="flex-1 overflow-hidden">
        <WeekCalendar timezone={timezone} />
      </div>
    </div>
  )
}
