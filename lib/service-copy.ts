// Customer-facing vocabulary per service type.
//
// Deterministic messages (confirmation replies, booking fallbacks, reminders,
// owner notifications) are written in code, not by the model, so they need the
// right words for the trade: a flooring company books an "in-home measure" with
// "our team", an HVAC company sends "our technician". Keep every hardcoded
// customer-facing sentence going through this file so no trade's wording leaks
// into another's texts.

export type ServiceCopy = {
  /** "in-home measure" / "service visit" / "appointment" */
  visit: string
  /** One word for tight sentences: "measure" / "visit" */
  visitShort: string
  /** Who shows up: "our team" / "our technician" */
  crew: string
  /** Label used in owner notifications and calendar titles: "Measure" / "Appointment" */
  label: string
  /** What the company does, for prompts: "flooring" / "home services" */
  trade: string
}

const FLOORING: ServiceCopy = {
  visit: "in-home measure",
  visitShort: "measure",
  crew: "our team",
  label: "Measure",
  trade: "flooring",
}

const HVAC: ServiceCopy = {
  visit: "service visit",
  visitShort: "visit",
  crew: "our technician",
  label: "Appointment",
  trade: "HVAC",
}

const SALES: ServiceCopy = {
  visit: "call",
  visitShort: "call",
  crew: "our team",
  label: "Call",
  trade: "FieldBuilt",
}

const GENERIC: ServiceCopy = {
  visit: "appointment",
  visitShort: "appointment",
  crew: "our team",
  label: "Appointment",
  trade: "home services",
}

export function serviceCopy(serviceType: string | null | undefined): ServiceCopy {
  const key = (serviceType ?? "").toLowerCase().trim()
  if (key === "flooring") return FLOORING
  if (key === "hvac") return HVAC
  if (key === "fieldbuilt_sales") return SALES
  if (!key) return GENERIC
  return { ...GENERIC, trade: key.replace(/_/g, " ") }
}

/**
 * The line sent when the engine cannot produce a reply. It promises a person,
 * so callers MUST also flag the lead needs_attention and notify the owner.
 */
export const HOLDING_REPLY = "Got your message. Someone from our team will text you back shortly."
