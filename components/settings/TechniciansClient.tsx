"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, User, Phone, MapPin, Wrench, Clock, Trash2,
  ChevronDown, ChevronUp, Check, X, Edit2, Power,
  Calendar, AlertCircle, Loader2, Upload, Mail, Lock, Eye, EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Technician, TechnicianSchedule, SPECIALIZATIONS } from "@/types/database"

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_SPECIALIZATIONS: string[] = [
  "AC Repair", "Furnace Repair", "Heat Pump Installation",
  "Duct Cleaning", "Commercial HVAC", "Electrical", "Plumbing",
  "Mini-Split Installation", "Boiler Repair", "Air Quality / Filtration",
]

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
const DAY_LABELS: Record<typeof DAYS[number], string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
}

const DEFAULT_SCHEDULE: TechnicianSchedule = {
  monday:    { enabled: true,  start: "08:00", end: "17:00" },
  tuesday:   { enabled: true,  start: "08:00", end: "17:00" },
  wednesday: { enabled: true,  start: "08:00", end: "17:00" },
  thursday:  { enabled: true,  start: "08:00", end: "17:00" },
  friday:    { enabled: true,  start: "08:00", end: "17:00" },
  saturday:  { enabled: false, start: "08:00", end: "17:00" },
  sunday:    { enabled: false, start: "08:00", end: "17:00" },
}

// ─── Form state type ─────────────────────────────────────────────────────────

type FormState = {
  name: string
  phone: string
  email: string
  password: string
  specializations: string[]
  customSpecialization: string
  zipInput: string
  zip_codes: string[]
  serves_all_areas: boolean
  schedule: TechnicianSchedule
  status: "active" | "inactive"
  notes: string
}

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  email: "",
  password: "",
  specializations: [],
  customSpecialization: "",
  zipInput: "",
  zip_codes: [],
  serves_all_areas: true,
  schedule: DEFAULT_SCHEDULE,
  status: "active",
  notes: "",
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TechniciansClient({ initial, companyServiceAreas = [] }: { initial: Technician[]; companyServiceAreas?: string[] }) {
  const [technicians, setTechnicians] = useState<Technician[]>(initial)
  const [showForm, setShowForm]       = useState(false)
  const [editId, setEditId]           = useState<string | null>(null)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [toggling, setToggling]       = useState<string | null>(null)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // ── Form helpers ────────────────────────────────────────────────────────────

  function openNew() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEdit(t: Technician) {
    setEditId(t.id)
    setForm({
      name: t.name,
      phone: t.phone ?? "",
      email: t.email ?? "",
      password: "",
      specializations: t.specializations,
      customSpecialization: "",
      zipInput: "",
      zip_codes: t.zip_codes,
      serves_all_areas: t.serves_all_areas,
      schedule: t.schedule,
      status: t.status,
      notes: t.notes ?? "",
    })
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  // ── Zip code helpers ─────────────────────────────────────────────────────────

  function setAllAreas(on: boolean) {
    if (on) {
      setForm(f => ({ ...f, serves_all_areas: true, zip_codes: [] }))
    } else {
      setForm(f => ({ ...f, serves_all_areas: false }))
    }
  }

  function addArea(raw: string) {
    const areas = raw.split(/[,\n]+/).map(z => z.trim()).filter(z => z.length > 0)
    if (areas.length === 0) return
    const unique = Array.from(new Set([...form.zip_codes, ...areas]))
    setForm(f => ({ ...f, zip_codes: unique, zipInput: "", serves_all_areas: false }))
  }

  function toggleArea(area: string) {
    setForm(f => {
      const next = f.zip_codes.includes(area)
        ? f.zip_codes.filter(x => x !== area)
        : [...f.zip_codes, area]
      return { ...f, zip_codes: next, serves_all_areas: false }
    })
  }

  function removeZip(z: string) {
    setForm(f => ({ ...f, zip_codes: f.zip_codes.filter(x => x !== z), serves_all_areas: false }))
  }

  // ── Specialization helpers ───────────────────────────────────────────────────

  function toggleSpec(s: string) {
    setForm(f => ({
      ...f,
      specializations: f.specializations.includes(s)
        ? f.specializations.filter(x => x !== s)
        : [...f.specializations, s],
    }))
  }

  function addCustomSpec() {
    const s = form.customSpecialization.trim()
    if (!s || form.specializations.includes(s)) return
    setForm(f => ({ ...f, specializations: [...f.specializations, s], customSpecialization: "" }))
  }

  // ── Schedule helpers ─────────────────────────────────────────────────────────

  function toggleDay(day: typeof DAYS[number]) {
    setForm(f => ({
      ...f,
      schedule: { ...f.schedule, [day]: { ...f.schedule[day], enabled: !f.schedule[day].enabled } },
    }))
  }

  function setDayTime(day: typeof DAYS[number], field: "start" | "end", val: string) {
    setForm(f => ({
      ...f,
      schedule: { ...f.schedule, [day]: { ...f.schedule[day], [field]: val } },
    }))
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return }
    if (!form.serves_all_areas && form.zip_codes.length === 0) {
      setError("Select at least one service area, or enable \"Serves All Areas\".")
      return
    }
    setSaving(true); setError(null)

    // password + email only sent on create (not edit)
    const payload: Record<string, unknown> = {
      name:             form.name.trim(),
      phone:            form.phone.trim() || null,
      specializations:  form.specializations,
      zip_codes:        form.serves_all_areas ? [] : form.zip_codes,
      serves_all_areas: form.serves_all_areas,
      schedule:         form.schedule,
      status:           form.status,
      notes:            form.notes.trim() || null,
    }
    if (!editId) {
      payload.email    = form.email.trim() || null
      payload.password = form.password.trim()
    }

    try {
      if (editId) {
        const res = await fetch(`/api/technicians/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? "Save failed")
        const updated: Technician = await res.json()
        setTechnicians(ts => ts.map(t => t.id === editId ? updated : t))
      } else {
        const res = await fetch("/api/technicians", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? "Save failed")
        const created: Technician = await res.json()
        setTechnicians(ts => [...ts, created])
      }
      cancelForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle status ────────────────────────────────────────────────────────────

  async function toggleStatus(t: Technician) {
    setToggling(t.id)
    const newStatus = t.status === "active" ? "inactive" : "active"
    try {
      const res = await fetch(`/api/technicians/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setTechnicians(ts => ts.map(x => x.id === t.id ? { ...x, status: newStatus } : x))
    } finally {
      setToggling(null)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function deleteTech(id: string) {
    if (!confirm("Delete this technician? They will be unassigned from future appointments.")) return
    setDeleting(id)
    try {
      await fetch(`/api/technicians/${id}`, { method: "DELETE" })
      setTechnicians(ts => ts.filter(t => t.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans')" }}>
            Technicians
          </h1>
          <p className="text-sm text-[#78716C] mt-0.5">
            Your field team — the AI uses this to assign the right tech to every job.
          </p>
        </div>
        <Button
          onClick={openNew}
          className="bg-[#F97316] hover:bg-[#6d28d9] text-white gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Technician
        </Button>
      </div>

      {/* Form panel */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="bg-white border border-[#E7E5E4] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-[#E7E5E4] flex items-center justify-between">
              <h2 className="font-semibold text-[#1C1917]">
                {editId ? "Edit Technician" : "New Technician"}
              </h2>
              <button onClick={cancelForm} className="text-[#78716C] hover:text-[#1C1917] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#1C1917]">Full name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="James Rivera"
                    className="border-[#E7E5E4] focus-visible:ring-[#F97316]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#1C1917]">Phone number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A8A29E]" />
                    <Input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+1 555 000 0000"
                      type="tel"
                      className="border-[#E7E5E4] focus-visible:ring-[#F97316] pl-9"
                    />
                  </div>
                </div>
              </div>

              {/* Login credentials (new techs only) */}
              {!editId && (
                <div className="rounded-xl border border-[#F97316]/20 bg-[#FFF8F3] p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-[#F97316]" />
                    <p className="text-sm font-semibold text-[#F97316]">Login credentials</p>
                    <p className="text-xs text-[#78716C]">— sent via SMS and email</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-[#1C1917]">Tech&apos;s email <span className="text-[#A8A29E] font-normal">(optional)</span></Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A8A29E]" />
                        <Input
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="jake@example.com"
                          type="email"
                          className="border-[#E7E5E4] focus-visible:ring-[#F97316] pl-9 bg-white"
                        />
                      </div>
                      <p className="text-[11px] text-[#A8A29E]">If provided, tech can log in with email. Without email, they log in with their phone number.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-[#1C1917]">Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A8A29E]" />
                        <Input
                          value={form.password}
                          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="Min. 6 characters"
                          type={showPassword ? "text" : "password"}
                          className="border-[#E7E5E4] focus-visible:ring-[#F97316] pl-9 pr-9 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#1C1917] transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-[#A8A29E]">Credentials are sent via SMS (and email if provided).</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status toggle */}
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium text-[#1C1917]">Status</Label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status: f.status === "active" ? "inactive" : "active" }))}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    form.status === "active"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-[#F5F4F2] border-[#E7E5E4] text-[#78716C]"
                  )}
                >
                  <Power className="w-3 h-3" />
                  {form.status === "active" ? "Active" : "Inactive"}
                </button>
                <p className="text-xs text-[#78716C]">Inactive technicians are never booked by the AI.</p>
              </div>

              {/* Specializations */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1C1917]">Specializations</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SPECIALIZATIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpec(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        form.specializations.includes(s)
                          ? "bg-[#F97316] border-[#F97316] text-white"
                          : "bg-white border-[#E7E5E4] text-[#78716C] hover:border-[#F97316] hover:text-[#F97316]"
                      )}
                    >
                      {form.specializations.includes(s) && <Check className="w-3 h-3 inline mr-1" />}
                      {s}
                    </button>
                  ))}
                </div>
                {/* Custom specialization */}
                <div className="flex gap-2 mt-2">
                  <Input
                    value={form.customSpecialization}
                    onChange={e => setForm(f => ({ ...f, customSpecialization: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomSpec())}
                    placeholder="Add custom specialization..."
                    className="border-[#E7E5E4] focus-visible:ring-[#F97316] text-sm h-9"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCustomSpec} className="h-9 shrink-0">
                    Add
                  </Button>
                </div>
                {form.specializations.filter(s => !ALL_SPECIALIZATIONS.includes(s)).map(s => (
                  <Badge key={s} variant="outline" className="text-xs gap-1 bg-[#F97316]/8 border-[#F97316]/20 text-[#F97316]">
                    {s}
                    <button onClick={() => toggleSpec(s)}><X className="w-2.5 h-2.5" /></button>
                  </Badge>
                ))}
              </div>

              {/* Service areas */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-[#1C1917]">Service areas</Label>

                {/* All Areas toggle */}
                <button
                  type="button"
                  onClick={() => setAllAreas(!form.serves_all_areas)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all w-full",
                    form.serves_all_areas
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-[#E7E5E4] text-[#78716C] hover:border-emerald-300 hover:text-emerald-700"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                    form.serves_all_areas
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-[#D6D3D1] bg-white"
                  )}>
                    {form.serves_all_areas && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span>Serves All Areas</span>
                  {form.serves_all_areas && (
                    <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                </button>

                {/* Specific area selector — only shown when All Areas is OFF */}
                {!form.serves_all_areas && (
                  <div className="space-y-3 pl-1">
                    {companyServiceAreas.length === 0 ? (
                      <p className="text-xs text-[#78716C] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                        No service areas configured yet.{" "}
                        <a href="/settings" className="underline text-[#F97316] hover:text-[#ea6d04]">
                          Add service areas in your company settings first.
                        </a>
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs text-[#78716C]">Select from your company service areas:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {companyServiceAreas.map(area => {
                            const selected = form.zip_codes.includes(area)
                            return (
                              <button
                                key={area}
                                type="button"
                                onClick={() => toggleArea(area)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                  selected
                                    ? "bg-[#F97316] border-[#F97316] text-white"
                                    : "bg-white border-[#E7E5E4] text-[#78716C] hover:border-[#F97316] hover:text-[#F97316]"
                                )}
                              >
                                {selected && <Check className="w-3 h-3 inline mr-1" />}
                                {area}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Free text input */}
                    <div className="space-y-1.5">
                      <p className="text-xs text-[#78716C]">Or add a custom city / zip code:</p>
                      <div className="flex gap-2">
                        <Input
                          value={form.zipInput}
                          onChange={e => setForm(f => ({ ...f, zipInput: e.target.value }))}
                          onKeyDown={e => (e.key === "Enter" || e.key === ",") && (e.preventDefault(), addArea(form.zipInput))}
                          placeholder="e.g. North Chicago, 60614"
                          className="border-[#E7E5E4] focus-visible:ring-[#F97316] text-sm h-9"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => addArea(form.zipInput)} className="h-9 shrink-0">
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Selected areas pills */}
                    {form.zip_codes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {form.zip_codes.map(z => (
                          <span key={z} className="flex items-center gap-1 bg-[#F97316]/8 border border-[#F97316]/20 text-xs px-2 py-1 rounded-md text-[#F97316]">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            {z}
                            <button onClick={() => removeZip(z)} className="text-[#F97316]/60 hover:text-red-500 transition-colors ml-0.5">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1C1917]">Working schedule</Label>
                <div className="space-y-2">
                  {DAYS.map(day => (
                    <div key={day} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "w-10 h-6 rounded-full transition-colors relative shrink-0",
                          form.schedule[day].enabled ? "bg-[#F97316]" : "bg-[#E7E5E4]"
                        )}
                      >
                        <span className={cn(
                          "absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                          form.schedule[day].enabled ? "translate-x-4" : "translate-x-0"
                        )} />
                      </button>
                      <span className={cn(
                        "text-sm font-medium w-8 shrink-0",
                        form.schedule[day].enabled ? "text-[#1C1917]" : "text-[#78716C]"
                      )}>
                        {DAY_LABELS[day]}
                      </span>
                      {form.schedule[day].enabled && (
                        <div className="flex items-center gap-2 text-sm">
                          <input
                            type="time"
                            value={form.schedule[day].start}
                            onChange={e => setDayTime(day, "start", e.target.value)}
                            className="border border-[#E7E5E4] rounded-lg px-2 py-1 text-xs font-mono text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                          />
                          <span className="text-[#78716C] text-xs">to</span>
                          <input
                            type="time"
                            value={form.schedule[day].end}
                            onChange={e => setDayTime(day, "end", e.target.value)}
                            className="border border-[#E7E5E4] rounded-lg px-2 py-1 text-xs font-mono text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                          />
                        </div>
                      )}
                      {!form.schedule[day].enabled && (
                        <span className="text-xs text-[#78716C]">Off</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1C1917]">Internal notes</Label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes visible only to your team..."
                  rows={2}
                  className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-[#E7E5E4] flex justify-end gap-3 bg-[#FAFAF8]">
              <Button variant="outline" onClick={cancelForm} className="border-[#E7E5E4]">
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className="bg-[#F97316] hover:bg-[#6d28d9] text-white gap-2 shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editId ? "Save changes" : "Add technician"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Technician list */}
      {technicians.length === 0 && !showForm ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white border border-dashed border-[#E7E5E4] rounded-2xl px-8 py-16 text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#F97316]/10 flex items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6 text-[#F97316]" />
          </div>
          <p className="font-semibold text-[#1C1917] mb-1">No technicians yet</p>
          <p className="text-sm text-[#78716C] max-w-xs mx-auto mb-4">
            Add your field team. The AI will assign the right tech to every appointment based on specialization, zip code, and availability.
          </p>
          <Button
            onClick={openNew}
            className="bg-[#F97316] hover:bg-[#6d28d9] text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Add your first technician
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {technicians.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "bg-white border border-[#E7E5E4] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden",
                t.status === "inactive" && "opacity-60"
              )}
            >
              {/* Card header */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F97316]/20 to-[#4D7C0F]/20 flex items-center justify-center shrink-0 text-[#F97316] font-bold text-sm">
                  {t.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#1C1917] truncate">{t.name}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs shrink-0",
                        t.status === "active"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-[#F5F4F2] border-[#E7E5E4] text-[#78716C]"
                      )}
                    >
                      {t.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {t.phone && (
                      <span className="flex items-center gap-1 text-xs text-[#78716C]">
                        <Phone className="w-3 h-3" />{t.phone}
                      </span>
                    )}
                    {/* Service area badge */}
                    {t.serves_all_areas || t.zip_codes.length === 0 ? (
                      <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        <Check className="w-2.5 h-2.5" /> All Areas
                      </span>
                    ) : (
                      t.zip_codes.slice(0, 4).map(z => (
                        <span key={z} className="flex items-center gap-0.5 bg-[#F97316]/8 border border-[#F97316]/20 text-[#F97316] text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />{z}
                        </span>
                      ))
                    )}
                    {!t.serves_all_areas && t.zip_codes.length > 4 && (
                      <span className="text-[10px] text-[#78716C]">+{t.zip_codes.length - 4} more</span>
                    )}
                  </div>
                  {t.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.specializations.slice(0, 3).map(s => (
                        <span key={s} className="bg-[#F97316]/8 text-[#F97316] text-xs px-2 py-0.5 rounded-full border border-[#F97316]/15">
                          {s}
                        </span>
                      ))}
                      {t.specializations.length > 3 && (
                        <span className="text-xs text-[#78716C]">+{t.specializations.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Schedule summary */}
                  <div className="hidden sm:flex items-center gap-0.5">
                    {DAYS.map(day => (
                      <div
                        key={day}
                        title={`${DAY_LABELS[day]}: ${t.schedule[day].enabled ? `${t.schedule[day].start}–${t.schedule[day].end}` : "Off"}`}
                        className={cn(
                          "w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center",
                          t.schedule[day].enabled
                            ? "bg-[#F97316]/10 text-[#F97316]"
                            : "bg-[#F5F4F2] text-[#78716C]/40"
                        )}
                      >
                        {DAY_LABELS[day].charAt(0)}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => toggleStatus(t)}
                    disabled={toggling === t.id}
                    title={t.status === "active" ? "Deactivate" : "Activate"}
                    className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F2] transition-colors"
                  >
                    {toggling === t.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Power className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    title="Edit"
                    className="p-1.5 rounded-lg text-[#78716C] hover:text-[#F97316] hover:bg-[#F97316]/8 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTech(t.id)}
                    disabled={deleting === t.id}
                    title="Delete"
                    className="p-1.5 rounded-lg text-[#78716C] hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    {deleting === t.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F4F2] transition-colors"
                  >
                    {expandedId === t.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {expandedId === t.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-[#E7E5E4]"
                  >
                    <div className="px-5 py-4 bg-[#FAFAF8] grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">Working hours</p>
                        {DAYS.filter(d => t.schedule[d].enabled).map(d => (
                          <div key={d} className="flex items-center justify-between py-0.5">
                            <span className="text-[#78716C] capitalize">{d}</span>
                            <span className="font-mono text-xs text-[#1C1917]">
                              {t.schedule[d].start} – {t.schedule[d].end}
                            </span>
                          </div>
                        ))}
                        {DAYS.filter(d => !t.schedule[d].enabled).length > 0 && (
                          <p className="text-xs text-[#78716C] mt-1">
                            Off: {DAYS.filter(d => !t.schedule[d].enabled).join(", ")}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">All specializations</p>
                        {t.specializations.length === 0
                          ? <p className="text-xs text-[#78716C]">None set</p>
                          : t.specializations.map(s => (
                            <p key={s} className="text-xs py-0.5 text-[#1C1917]">• {s}</p>
                          ))}
                        <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mt-3 mb-2">Service areas</p>
                        {t.serves_all_areas || t.zip_codes.length === 0
                          ? <p className="text-xs text-emerald-600 font-medium">✓ Serves all areas</p>
                          : <p className="text-xs font-mono text-[#1C1917]">{t.zip_codes.join(", ")}</p>}
                        {t.notes && (
                          <>
                            <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mt-3 mb-1">Notes</p>
                            <p className="text-xs text-[#78716C]">{t.notes}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
