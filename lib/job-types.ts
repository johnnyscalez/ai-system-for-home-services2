// Flooring job type enum values stored in leads.job_type.
// Shared between the AI voice/SMS engine tools and the CRM display layer.

export const JOB_TYPES = [
  "lvp",
  "laminate",
  "hardwood",
  "engineered_hardwood",
  "carpet",
  "tile",
  "refinishing",
  "stairs",
  "whole_home",
  "commercial_flooring",
  "other",
] as const

export type JobType = (typeof JOB_TYPES)[number]

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  lvp:                 "LVP / Vinyl Plank",
  laminate:            "Laminate",
  hardwood:            "Hardwood",
  engineered_hardwood: "Engineered Hardwood",
  carpet:              "Carpet",
  tile:                "Tile",
  refinishing:         "Hardwood Refinishing",
  stairs:              "Stairs",
  whole_home:          "Whole Home",
  commercial_flooring: "Commercial Flooring",
  other:               "Other",
}

// The labels in display order. The close-deal form and the reports group by these
// exact strings, so there is one vocabulary everywhere.
export const FLOORING_JOB_TYPE_LABELS: string[] = JOB_TYPES.map((t) => JOB_TYPE_LABELS[t])

// Colour coding for CRM badges (light UI, orange kept to the accent job type)
export const JOB_TYPE_COLORS: Record<JobType, string> = {
  lvp:                 "bg-amber-50 text-amber-700 border-amber-200",
  laminate:            "bg-yellow-50 text-yellow-700 border-yellow-200",
  hardwood:            "bg-orange-50 text-orange-700 border-orange-200",
  engineered_hardwood: "bg-orange-50 text-orange-700 border-orange-200",
  carpet:              "bg-stone-100 text-stone-700 border-stone-200",
  tile:                "bg-sky-50 text-sky-700 border-sky-200",
  refinishing:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  stairs:              "bg-teal-50 text-teal-700 border-teal-200",
  whole_home:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  commercial_flooring: "bg-slate-100 text-slate-700 border-slate-200",
  other:               "bg-slate-100 text-slate-600 border-slate-200",
}

export function getJobTypeLabel(jobType: string | null | undefined): string {
  if (!jobType) return ""
  return JOB_TYPE_LABELS[jobType as JobType] ?? jobType
}

export function getJobTypeColor(jobType: string | null | undefined): string {
  if (!jobType) return "bg-slate-100 text-slate-600 border-slate-200"
  return JOB_TYPE_COLORS[jobType as JobType] ?? JOB_TYPE_COLORS.other
}

// Description string passed to Claude in the tool definition
// so it maps natural language to the correct enum value.
export const JOB_TYPE_TOOL_DESCRIPTION =
  `The type of flooring job. Pick the most specific match:
lvp = Luxury vinyl plank or vinyl flooring.
laminate = Laminate flooring.
hardwood = Solid hardwood, new install.
engineered_hardwood = Engineered hardwood install.
carpet = Carpet, new install or replacement.
tile = Tile for floors, showers or backsplashes.
refinishing = Sanding and refinishing existing hardwood.
stairs = Stairs: treads, risers, runners.
whole_home = Flooring for most or all of the home.
commercial_flooring = Office, retail or other commercial space.
other = Anything that doesn't fit the above.`
