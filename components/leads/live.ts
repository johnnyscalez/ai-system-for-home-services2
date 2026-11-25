"use client"

// Keeping CRM screens current without a page reload.
//
// Two signals, used together:
//   1. Supabase Realtime. `conversations` is in the realtime publication today;
//      `leads` and `appointments` join it once the SQL in supabase/migrations is
//      run. Subscribing to all three now means nothing changes here on that day.
//   2. A light poll that stops while the tab is hidden. This is what makes lead
//      status and details move today, before leads are in the publication.

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { Lead } from "@/types/database"

/** Runs `fn` every `ms` while the tab is visible, and once right when it becomes visible again. */
export function useVisiblePoll(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (!timer) timer = setInterval(() => { void fnRef.current() }, ms)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fnRef.current()
        start()
      } else {
        stop()
      }
    }
    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [ms, enabled])
}

/**
 * Calls `onChange` (debounced) whenever a row of one of `tables` changes for the
 * company. Tables that are not in the realtime publication simply never fire.
 */
export function useCompanyRealtime(
  companyId: string | null | undefined,
  tables: Array<"leads" | "conversations" | "appointments">,
  onChange: () => void,
  debounceMs = 800
) {
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })
  const tableKey = tables.join(",")

  useEffect(() => {
    if (!companyId) return
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const fire = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => onChangeRef.current(), debounceMs)
    }
    let channel = supabase.channel(`crm-live:${companyId}:${tableKey}`)
    for (const table of tableKey.split(",")) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `company_id=eq.${companyId}` },
        fire
      )
    }
    channel.subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [companyId, tableKey, debounceMs])
}

/**
 * The company's leads, kept current: realtime on leads and conversations (a new
 * message almost always comes with a status change) plus a 20 second poll.
 * Returns setLeads for optimistic updates and refresh for "do it now".
 */
export function useCompanyLeads(companyId: string | null | undefined, initialLeads: Lead[]) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  // "Now" as of the last refresh. Screens derive "replying now" from it instead
  // of reading the clock while rendering.
  const [nowMs, setNowMs] = useState(() => Date.now())
  // Bumped by every local write so a fetch that started before the write cannot
  // overwrite it with older rows when it lands.
  const writeVersion = useRef(0)

  const setLeadsLocal = useCallback((updater: Lead[] | ((prev: Lead[]) => Lead[])) => {
    writeVersion.current += 1
    setLeads(updater)
  }, [])

  const refresh = useCallback(async () => {
    if (!companyId) return
    const startedAt = writeVersion.current
    const supabase = createClient()
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
    setNowMs(Date.now())
    if (error || !data) return
    if (writeVersion.current !== startedAt) return
    setLeads(data as Lead[])
  }, [companyId])

  useVisiblePoll(refresh, 20_000, !!companyId)
  useCompanyRealtime(companyId, ["leads", "conversations"], () => { void refresh() })

  return { leads, setLeads: setLeadsLocal, refresh, nowMs }
}
