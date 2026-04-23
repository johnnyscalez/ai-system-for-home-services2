export type ServiceType = "roofing" | "solar" | "hvac" | "windows" | "bath_remodel"
export type Plan = "trial" | "starter" | "growth" | "scale"
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "appointment_booked"
  | "closed_won"
  | "closed_lost"
  | "cold"
  | "nurturing"
  | "needs_attention"
export type UserRole = "owner" | "admin" | "member"
export type SequenceType = "no_reply" | "replied_not_booked"
export type SequenceStatus = "pending" | "sent" | "cancelled"
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show"
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
  ai_paused: boolean
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
  scheduled_at: string
  address: string | null
  notes: string | null
  status: AppointmentStatus
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
