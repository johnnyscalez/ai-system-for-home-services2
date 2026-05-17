"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  HardHat, Plus, X, Phone, MapPin, Wrench,
  Zap, ArrowRight, Check, Loader2, User,
  BrainCircuit, CalendarCheck, ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_SPECS = [
  "AC Repair", "Furnace Repair", "Heat Pump Installation",
  "Duct Cleaning", "Mini-Split Installation", "Boiler Repair",
  "Electrical", "Plumbing", "Air Quality / Filtration", "Commercial HVAC",
]

const DEFAULT_SCHEDULE = {
  monday:    { enabled: true,  start: "08:00", end: "17:00" },
  tuesday:   { enabled: true,  start: "08:00", end: "17:00" },
  wednesday: { enabled: true,  start: "08:00", end: "17:00" },
  thursday:  { enabled: true,  start: "08:00", end: "17:00" },
  friday:    { enabled: true,  start: "08:00", end: "17:00" },
  saturday:  { enabled: false, start: "08:00", end: "17:00" },
  sunday:    { enabled: false, start: "08:00", end: "17:00" },
}

type AddedTech = { id: string; name: string; phone: string; specializations: string[]; zip_codes: string[] }

type FormState = {
  name: string
  phone: string
  specializations: string[]
  zipInput: string
  zip_codes: string[]
}

const EMPTY: FormState = { name: "", phone: "", specializations: [], zipInput: "", zip_codes: [] }

// ─── Component ─────────────────────────────────────────────────────────────────

export function StepTechnicians({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [techs, setTechs]       = useState<AddedTech[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormState>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function toggleSpec(s: string) {
    setForm(f => ({
      ...f,
      specializations: f.specializations.includes(s)
        ? f.specializations.filter(x => x !== s)
        : [...f.specializations, s],
    }))
  }

  function addZip() {
    const z = form.zipInput.trim()
    if (!/^\d{5}$/.test(z)) return
    if (!form.zip_codes.includes(z)) setForm(f => ({ ...f, zip_codes: [...f.zip_codes, z], zipInput: "" }))
    else setForm(f => ({ ...f, zipInput: "" }))
  }

  function removeZip(z: string) {
    setForm(f => ({ ...f, zip_codes: f.zip_codes.filter(x => x !== z) }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/technicians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          specializations: form.specializations,
          zip_codes: form.zip_codes,
          schedule: DEFAULT_SCHEDULE,
          status: "active",
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to save."); return }
      setTechs(prev => [...prev, {
        id: data.technician?.id ?? crypto.randomUUID(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        specializations: form.specializations,
        zip_codes: form.zip_codes,
      }])
      setForm(EMPTY)
      setShowForm(false)
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Smart Dispatch Hero ─────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center shadow-sm">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#7C3AED]">Smart Dispatch</span>
        </div>

        <h2 className="text-2xl font-bold text-[#1C1917] mt-3" style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
          Add your field team — your AI books the right tech automatically
        </h2>
        <p className="mt-2 text-[#78716C]">
          When a lead books an appointment, your AI doesn't just pick any open slot.
          It looks at your technicians' specializations, availability, and service area — and assigns the best person for that specific job.
          No manual scheduling. No calls to figure out who's free.
        </p>

        {/* Feature highlights */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: Wrench,
              title: "Right skill for the job",
              desc: "Each tech has specializations. AC repair goes to your AC tech. Heat pump install goes to your install guy.",
            },
            {
              icon: CalendarCheck,
              title: "Respects availability",
              desc: "The AI only books during each tech's working hours. No more double-books or after-hours surprises.",
            },
            {
              icon: MapPin,
              title: "Stays in their area",
              desc: "Set service zip codes per tech. The AI matches leads to the closest available tech automatically.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#E7E5E4] rounded-xl p-4 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center mb-2">
                <Icon className="w-3.5 h-3.5 text-[#7C3AED]" />
              </div>
              <p className="text-sm font-semibold text-[#1C1917]">{title}</p>
              <p className="text-xs text-[#78716C] mt-0.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Added technicians list ──────────────────────────────────────── */}
      <AnimatePresence>
        {techs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {techs.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 bg-white border border-[#E7E5E4] rounded-xl px-4 py-3 shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-[#4D7C0F]/10 flex items-center justify-center shrink-0">
                  <HardHat className="w-4 h-4 text-[#4D7C0F]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1C1917]">{t.name}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {t.specializations.map(s => (
                      <span key={s} className="text-[10px] bg-[#7C3AED]/8 text-[#7C3AED] px-1.5 py-0.5 rounded-full font-medium">{s}</span>
                    ))}
                    {t.specializations.length === 0 && (
                      <span className="text-[10px] text-[#78716C]">General (all jobs)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Check className="w-4 h-4 text-[#4D7C0F]" />
                  <span className="text-xs text-[#4D7C0F] font-medium">Added</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add technician form ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!showForm ? (
          <motion.button
            key="add-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#E7E5E4] rounded-xl py-4 text-sm font-medium text-[#78716C] hover:border-[#7C3AED]/40 hover:text-[#7C3AED] hover:bg-[#7C3AED]/4 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            {techs.length === 0 ? "Add your first technician" : "Add another technician"}
          </motion.button>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-[#1C1917]">New technician</p>
              <button onClick={() => { setShowForm(false); setForm(EMPTY); setError(null) }}
                className="text-[#78716C] hover:text-[#1C1917] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1C1917]">Full name <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#78716C]" />
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. James Rodriguez"
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1C1917]">Phone <span className="text-[#78716C] font-normal">(optional)</span></Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#78716C]" />
                  <Input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Specializations */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1C1917] flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Specializations
                <span className="text-[#78716C] font-normal ml-1">— leave blank for "all jobs"</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SPECS.map(s => {
                  const active = form.specializations.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpec(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150",
                        active
                          ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm"
                          : "bg-white text-[#78716C] border-[#E7E5E4] hover:border-[#7C3AED]/40 hover:text-[#7C3AED]"
                      )}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Zip codes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1C1917] flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Service zip codes
                <span className="text-[#78716C] font-normal ml-1">— leave blank to serve all areas</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={form.zipInput}
                  onChange={e => setForm(f => ({ ...f, zipInput: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addZip() } }}
                  placeholder="Enter zip code"
                  className="h-9 text-sm w-36"
                />
                <Button type="button" size="sm" variant="outline" onClick={addZip} className="h-9 px-3">Add</Button>
              </div>
              {form.zip_codes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.zip_codes.map(z => (
                    <Badge key={z} variant="secondary" className="gap-1 text-xs pr-1">
                      {z}
                      <button onClick={() => removeZip(z)} className="ml-0.5 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                {saving ? "Saving…" : "Add technician"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY); setError(null) }}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer actions ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#E7E5E4]"
      >
        <p className="text-xs text-[#78716C] text-center sm:text-left">
          You can add, edit, and remove technicians anytime from the{" "}
          <span className="font-medium text-[#7C3AED]">Technicians</span> section.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-[#78716C] hover:text-[#1C1917]">
            {techs.length === 0 ? "Skip for now" : "Skip"}
          </Button>
          <Button
            size="sm"
            onClick={onNext}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5"
          >
            {techs.length === 0 ? "Continue without team" : `Continue with ${techs.length} tech${techs.length > 1 ? "s" : ""}`}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
