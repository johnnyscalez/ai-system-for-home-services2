// HVAC job type enum values stored in leads.job_type.
// Shared between the AI voice/SMS engine tools and the CRM display layer.

export const JOB_TYPES = [
  "ac_repair",
  "ac_replacement",
  "new_ac_install",
  "furnace_repair",
  "furnace_replacement",
  "heat_pump_install",
  "heat_pump_replacement",
  "full_hvac_upgrade",
  "hvac_maintenance",
  "ductwork",
  "mini_split",
  "thermostat",
  "air_quality",
  "other",
] as const

export type JobType = (typeof JOB_TYPES)[number]

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  ac_repair:            "AC Repair",
  ac_replacement:       "AC Replacement",
  new_ac_install:       "New AC Installation",
  furnace_repair:       "Furnace Repair",
  furnace_replacement:  "Furnace Replacement",
  heat_pump_install:    "Heat Pump Installation",
  heat_pump_replacement:"Heat Pump Replacement",
  full_hvac_upgrade:    "Full HVAC Upgrade",
  hvac_maintenance:     "Maintenance / Tune-up",
  ductwork:             "Ductwork",
  mini_split:           "Mini-split Installation",
  thermostat:           "Thermostat / Smart Control",
  air_quality:          "Indoor Air Quality",
  other:                "Other",
}

// Colour coding for CRM badges
export const JOB_TYPE_COLORS: Record<JobType, string> = {
  ac_repair:            "bg-sky-500/15 text-sky-400 border-sky-500/20",
  ac_replacement:       "bg-violet-500/15 text-violet-400 border-violet-500/20",
  new_ac_install:       "bg-violet-500/15 text-violet-400 border-violet-500/20",
  furnace_repair:       "bg-orange-500/15 text-orange-400 border-orange-500/20",
  furnace_replacement:  "bg-orange-500/15 text-orange-400 border-orange-500/20",
  heat_pump_install:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  heat_pump_replacement:"bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  full_hvac_upgrade:    "bg-purple-500/15 text-purple-400 border-purple-500/20",
  hvac_maintenance:     "bg-teal-500/15 text-teal-400 border-teal-500/20",
  ductwork:             "bg-stone-500/15 text-stone-400 border-stone-500/20",
  mini_split:           "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  thermostat:           "bg-blue-500/15 text-blue-400 border-blue-500/20",
  air_quality:          "bg-lime-500/15 text-lime-400 border-lime-500/20",
  other:                "bg-slate-500/15 text-slate-400 border-slate-500/20",
}

export function getJobTypeLabel(jobType: string | null | undefined): string {
  if (!jobType) return ""
  return JOB_TYPE_LABELS[jobType as JobType] ?? jobType
}

export function getJobTypeColor(jobType: string | null | undefined): string {
  if (!jobType) return "bg-slate-500/15 text-slate-400 border-slate-500/20"
  return JOB_TYPE_COLORS[jobType as JobType] ?? JOB_TYPE_COLORS.other
}

// Description string passed to Claude in the tool definition
// so it maps natural language to the correct enum value.
export const JOB_TYPE_TOOL_DESCRIPTION =
  `The type of HVAC job needed. Pick the most specific match:
ac_repair = AC runs but not cooling well, likely fixable without full replacement.
ac_replacement = AC system is old, dead, or beyond repair — needs a new unit.
new_ac_install = Property has no existing AC at all — first-time install.
furnace_repair = Furnace has issues (no heat, noises, won't start) but may be fixable.
furnace_replacement = Old or dead furnace — needs a new unit.
heat_pump_install = Adding a heat pump where there was none before.
heat_pump_replacement = Existing heat pump needs to be replaced.
full_hvac_upgrade = Replacing or upgrading both heating AND cooling together.
hvac_maintenance = Tune-up, annual service, cleaning, no known breakdown.
ductwork = Duct repair, sealing, cleaning, or full ductwork replacement.
mini_split = Ductless mini-split system — install or repair.
thermostat = Smart thermostat or control system installation.
air_quality = Air purifier, filtration, humidity control.
other = Anything that doesn't fit the above.`
