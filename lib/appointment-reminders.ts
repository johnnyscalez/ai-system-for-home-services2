import { createServiceRoleClient } from "@/lib/supabase-server"
import { sendAppointmentEmail, type EmailTemplateType, type GmailCredentials } from "@/lib/email"
import { sendSMS } from "@/lib/twilio"

async function getContext(appointmentId: string) {
  const supabase = createServiceRoleClient()

  const { data: apt } = await supabase
    .from("appointments")
    .select("*, leads(first_name, last_name, phone, email), companies(name, service_type)")
    .eq("id", appointmentId)
    .single()

  if (!apt) return null

  const { data: agentCfg } = await supabase
    .from("ai_agent_config")
    .select("timezone")
    .eq("company_id", apt.company_id)
    .single()

  const { data: emailTpl } = await supabase
    .from("email_templates")
    .select("*")
    .eq("company_id", apt.company_id)
    .single()

  const { data: phoneNum } = await supabase
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", apt.company_id)
    .eq("is_active", true)
    .single()

  const { data: gmailConn } = await supabase
    .from("gmail_connections")
    .select("gmail_email, access_token, refresh_token")
    .eq("company_id", apt.company_id)
    .eq("is_connected", true)
    .single()

  return { apt, agentCfg, emailTpl, phoneNum, gmailConn }
}

async function persistGmailToken(supabase: ReturnType<typeof createServiceRoleClient>, companyId: string, newToken: string) {
  await supabase
    .from("gmail_connections")
    .update({ access_token: newToken, updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
}

export async function sendConfirmations(appointmentId: string) {
  const supabase = createServiceRoleClient()
  const ctx = await getContext(appointmentId)
  if (!ctx) return

  const { apt, agentCfg, emailTpl, phoneNum, gmailConn } = ctx
  const lead = apt.leads as { first_name: string | null; last_name: string | null; phone: string; email: string | null } | null
  const company = apt.companies as { name: string; service_type: string | null } | null
  if (!lead || !company) return

  const timezone = agentCfg?.timezone ?? "America/New_York"
  const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "there"
  const companyName = emailTpl?.from_name || company.name

  const gmail: GmailCredentials | null = gmailConn
    ? {
        accessToken: gmailConn.access_token,
        refreshToken: gmailConn.refresh_token,
        fromEmail: gmailConn.gmail_email,
        onTokenRefresh: (t) => persistGmailToken(supabase, apt.company_id, t),
      }
    : null

  const emailData = {
    leadName,
    companyName,
    serviceType: company.service_type ?? "home services",
    scheduledAt: apt.scheduled_at,
    address: apt.address,
    notes: apt.notes,
    timezone,
    logoUrl: emailTpl?.logo_url ?? null,
    replyToEmail: emailTpl?.reply_to_email ?? null,
    fromName: emailTpl?.from_name ?? null,
  }

  // Send confirmation email if lead has email and email is enabled
  if (lead.email && emailTpl?.confirmation_enabled !== false) {
    try {
      await sendAppointmentEmail(
        lead.email,
        "confirmation",
        emailData,
        emailTpl?.confirmation_subject,
        emailTpl?.confirmation_custom_message,
        gmail,
      )
      await supabase.from("appointments").update({ confirmation_email_sent: true }).eq("id", appointmentId)
    } catch (err) {
      console.error("[reminders] Confirmation email failed:", err)
    }
  }

  // Send confirmation SMS
  if (emailTpl?.sms_confirmation_enabled !== false && phoneNum?.phone_number) {
    const formattedDate = new Date(apt.scheduled_at).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: timezone,
    })
    const formattedTime = new Date(apt.scheduled_at).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: timezone,
    })
    const smsBody = `${companyName}: Your appointment is confirmed for ${formattedDate} at ${formattedTime}${apt.address ? ` at ${apt.address}` : ""}. Reply RESCHEDULE or CANCEL if needed.`

    try {
      await sendSMS(lead.phone, smsBody, phoneNum.phone_number)
      // Save to conversations so AI has context
      await supabase.from("conversations").insert({
        lead_id: apt.lead_id,
        company_id: apt.company_id,
        direction: "outbound",
        sent_by: "reminder",
        body: smsBody,
      })
      await supabase.from("appointments").update({ confirmation_sms_sent: true }).eq("id", appointmentId)
    } catch (err) {
      console.error("[reminders] Confirmation SMS failed:", err)
    }
  }
}

export async function processAppointmentReminders() {
  const supabase = createServiceRoleClient()
  const now = new Date()

  // Get all scheduled appointments in the next 3 days with pending reminders
  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id, lead_id, company_id, scheduled_at, address, notes,
      reminder_2d_email_sent, reminder_2d_sms_sent,
      reminder_1d_email_sent, reminder_1d_sms_sent,
      reminder_2h_email_sent, reminder_2h_sms_sent,
      leads(first_name, last_name, phone, email),
      companies(name, service_type)
    `)
    .eq("status", "scheduled")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString())

  if (!appointments?.length) return { processed: 0 }

  let processed = 0

  for (const apt of appointments) {
    const scheduledAt = new Date(apt.scheduled_at)
    const msDiff = scheduledAt.getTime() - now.getTime()
    const hoursDiff = msDiff / (1000 * 60 * 60)

    const lead = apt.leads as unknown as { first_name: string | null; last_name: string | null; phone: string; email: string | null } | null
    const company = apt.companies as unknown as { name: string; service_type: string | null } | null
    if (!lead || !company) continue

    const { data: agentCfg } = await supabase
      .from("ai_agent_config")
      .select("timezone")
      .eq("company_id", apt.company_id)
      .single()

    const { data: emailTpl } = await supabase
      .from("email_templates")
      .select("*")
      .eq("company_id", apt.company_id)
      .single()

    const { data: phoneNum } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("company_id", apt.company_id)
      .eq("is_active", true)
      .single()

    const { data: gmailConn } = await supabase
      .from("gmail_connections")
      .select("gmail_email, access_token, refresh_token")
      .eq("company_id", apt.company_id)
      .eq("is_connected", true)
      .single()

    const gmail: GmailCredentials | null = gmailConn
      ? {
          accessToken: gmailConn.access_token,
          refreshToken: gmailConn.refresh_token,
          fromEmail: gmailConn.gmail_email,
          onTokenRefresh: (t) => persistGmailToken(supabase, apt.company_id, t),
        }
      : null

    const timezone = agentCfg?.timezone ?? "America/New_York"
    const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "there"
    const companyName = emailTpl?.from_name || company.name

    const emailData = {
      leadName,
      companyName,
      serviceType: company.service_type ?? "home services",
      scheduledAt: apt.scheduled_at,
      address: apt.address,
      notes: apt.notes,
      timezone,
      logoUrl: emailTpl?.logo_url ?? null,
      replyToEmail: emailTpl?.reply_to_email ?? null,
      fromName: emailTpl?.from_name ?? null,
    }

    const formattedDate = scheduledAt.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: timezone,
    })
    const formattedTime = scheduledAt.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: timezone,
    })

    async function sendReminderEmail(type: EmailTemplateType, subject?: string | null, message?: string | null) {
      if (!lead!.email) return
      try {
        await sendAppointmentEmail(lead!.email!, type, emailData, subject, message, gmail)
      } catch (err) {
        console.error(`[reminders] ${type} email failed:`, err)
      }
    }

    async function sendReminderSMS(body: string, column: string) {
      if (!phoneNum?.phone_number) return
      try {
        await sendSMS(lead!.phone, body, phoneNum.phone_number)
        await supabase.from("conversations").insert({
          lead_id: apt.lead_id,
          company_id: apt.company_id,
          direction: "outbound",
          sent_by: "reminder",
          body,
        })
        await supabase.from("appointments").update({ [column]: true }).eq("id", apt.id)
      } catch (err) {
        console.error(`[reminders] SMS ${column} failed:`, err)
      }
    }

    // 2-day reminder: between 47-49 hours before
    if (hoursDiff >= 47 && hoursDiff <= 49) {
      if (!apt.reminder_2d_email_sent && emailTpl?.reminder_2d_enabled !== false) {
        await sendReminderEmail("reminder_2d", emailTpl?.reminder_2d_subject, emailTpl?.reminder_2d_custom_message)
        await supabase.from("appointments").update({ reminder_2d_email_sent: true }).eq("id", apt.id)
        processed++
      }
      if (!apt.reminder_2d_sms_sent && emailTpl?.sms_reminder_1d_enabled !== false) {
        const body = `${companyName}: Just a reminder your appointment is in 2 days — ${formattedDate} at ${formattedTime}. Reply if you need to reschedule.`
        await sendReminderSMS(body, "reminder_2d_sms_sent")
        processed++
      }
    }

    // 1-day reminder: between 23-25 hours before
    if (hoursDiff >= 23 && hoursDiff <= 25) {
      if (!apt.reminder_1d_email_sent && emailTpl?.reminder_1d_enabled !== false) {
        await sendReminderEmail("reminder_1d", emailTpl?.reminder_1d_subject, emailTpl?.reminder_1d_custom_message)
        await supabase.from("appointments").update({ reminder_1d_email_sent: true }).eq("id", apt.id)
        processed++
      }
      if (!apt.reminder_1d_sms_sent && emailTpl?.sms_reminder_1d_enabled !== false) {
        const body = `${companyName}: Reminder — your appointment is tomorrow at ${formattedTime}${apt.address ? ` at ${apt.address}` : ""}. Reply to reschedule or cancel.`
        await sendReminderSMS(body, "reminder_1d_sms_sent")
        processed++
      }
    }

    // 2-hour reminder: between 1.75-2.25 hours before
    if (hoursDiff >= 1.75 && hoursDiff <= 2.25) {
      if (!apt.reminder_2h_email_sent && emailTpl?.reminder_2h_enabled !== false) {
        await sendReminderEmail("reminder_2h", emailTpl?.reminder_2h_subject, emailTpl?.reminder_2h_custom_message)
        await supabase.from("appointments").update({ reminder_2h_email_sent: true }).eq("id", apt.id)
        processed++
      }
      if (!apt.reminder_2h_sms_sent && emailTpl?.sms_reminder_2h_enabled !== false) {
        const body = `${companyName}: Your appointment starts in 2 hours — ${formattedTime}${apt.address ? ` at ${apt.address}` : ""}. See you soon!`
        await sendReminderSMS(body, "reminder_2h_sms_sent")
        processed++
      }
    }
  }

  return { processed }
}
