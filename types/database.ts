export type ServiceType = "roofing" | "solar" | "hvac" | "windows" | "bath_remodel"
export type Plan = "trial" | "starter" | "growth" | "scale"
export type LeadStatus =
  | "just_came_in"       // lead arrived, AI sent opener, no reply yet
  | "following_up"       // no reply — AI is actively sending follow-up sequence
  | "active_conversation" // lead replied, AI is working them
  | "qualified"          // AI confirmed good fit
  | "unqualified"        // AI confirmed not a good fit
  | "appointment_booked"
  | "closed"
  | "lost"
  // legacy — kept for backward compat with existing DB rows
  | "new"
  | "contacted"
  | "followed_up"
  | "closed_won"
  | "closed_lost"
  | "cold"
  | "nurturing"
  | "needs_attention"
export type UserRole = "owner" | "admin" | "member"
export type SequenceType = "no_reply" | "replied_not_booked"
export type SequenceStatus = "pending" | "sent" | "cancelled"
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show"
export type ConfirmationStatus =
  | "pending_confirmation"
  | "confirmed"
  | "cancelled_by_lead"
  | "reschedule_requested"
  | "no_response"
  | "completed"
export type MessageDirection = "inbound" | "outbound"
export type MessageSender = "ai" | "human"
export type LeadSource = "facebook" | "webhook" | "manual"

export interface Company {
  id: string
  name: string
  slug: string | null
  owner_id: string
  service_type: ServiceType | null
  service_area: string | null
  notification_phone: string | null
  avg_job_value: number
  plan: Plan
  leads_used_this_month: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string
  onboarding_completed: boolean
  webhook_secret: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  company_id: string | null
  role: UserRole
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface PhoneNumber {
  id: string
  company_id: string
  phone_number: string
  twilio_sid: string | null
  is_active: boolean
  created_at: string
}

export interface Lead {
  id: string
  company_id: string
  first_name: string | null
  last_name: string | null
  phone: string
  email: string | null
  source: LeadSource
  source_form_id: string | null
  service_type: string | null
  status: LeadStatus
  address: string | null
  notes: string | null
  metadata: Record<string, unknown>
  last_message_at: string | null
  last_inbound_at: string | null
  is_active_conversation: boolean
  ai_paused: boolean
  deal_value: number | null
  closed_job_type: string | null
  closed_technician_id: string | null
  closed_technician_name: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  company_id: string
  lead_id: string
  direction: MessageDirection
  body: string
  twilio_sid: string | null
  sent_by: MessageSender
  created_at: string
}

export interface Appointment {
  id: string
  company_id: string
  lead_id: string
  technician_id: string | null
  technician_name: string | null
  scheduled_at: string
  address: string | null
  notes: string | null
  status: AppointmentStatus
  confirmation_status: ConfirmationStatus
  confirmation_requested_at: string | null
  confirmed_at: string | null
  no_response_call_scheduled: boolean
  no_response_call_at: string | null
  created_at: string
  updated_at: string
}

export type TechnicianDaySchedule = {
  enabled: boolean
  start: string  // "08:00"
  end: string    // "17:00"
}

export type TechnicianSchedule = {
  monday: TechnicianDaySchedule
  tuesday: TechnicianDaySchedule
  wednesday: TechnicianDaySchedule
  thursday: TechnicianDaySchedule
  friday: TechnicianDaySchedule
  saturday: TechnicianDaySchedule
  sunday: TechnicianDaySchedule
}

export const SPECIALIZATIONS = [
  "AC Repair",
  "Furnace Repair",
  "Heat Pump Installation",
  "Duct Cleaning",
  "Commercial HVAC",
  "Electrical",
  "Plumbing",
  "Mini-Split Installation",
  "Boiler Repair",
  "Air Quality / Filtration",
] as const

export type Specialization = typeof SPECIALIZATIONS[number]

export interface Technician {
  id: string
  company_id: string
  name: string
  phone: string | null
  photo_url: string | null
  specializations: string[]
  zip_codes: string[]
  schedule: TechnicianSchedule
  status: "active" | "inactive"
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Sequence {
  id: string
  company_id: string
  lead_id: string
  sequence_type: SequenceType
  step: number
  scheduled_at: string
  sent_at: string | null
  status: SequenceStatus
  created_at: string
}

export interface Settings {
  id: string
  company_id: string
  ai_name: string
  opening_message: string | null
  qualifying_questions: QualifyingQuestion[]
  objection_responses: Record<string, string>
  follow_up_enabled: boolean
  working_hours_start: number
  working_hours_end: number
  timezone: string
  created_at: string
  updated_at: string
}

export interface FacebookConnection {
  id: string
  company_id: string
  fb_ad_account_id: string | null
  fb_form_id: string | null
  fb_page_id: string | null
  fb_page_name: string | null
  access_token: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface QualifyingQuestion {
  id: string
  question: string
  order: number
}

export type LeadWithConversations = Lead & {
  conversations: Conversation[]
  appointments: Appointment[]
}
