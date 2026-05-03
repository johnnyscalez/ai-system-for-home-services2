import { Resend } from "resend"
import { sendEmailViaGmail } from "@/lib/gmail"
import { buildEmailHtml, type EmailTemplateType, type AppointmentEmailData } from "@/lib/email-builder"

export type { EmailTemplateType, AppointmentEmailData } from "@/lib/email-builder"

const resend = new Resend(process.env.RESEND_API_KEY)

export type GmailCredentials = {
  accessToken: string
  refreshToken: string
  fromEmail: string
  onTokenRefresh?: (newToken: string) => void
}

export async function sendAppointmentEmail(
  to: string,
  templateType: EmailTemplateType,
  data: AppointmentEmailData,
  subject?: string | null,
  customMessage?: string | null,
  gmail?: GmailCredentials | null,
): Promise<void> {
  const defaultSubjects: Record<EmailTemplateType, string> = {
    confirmation: `Your Appointment is Confirmed ✓`,
    reminder_2d: `Your Appointment is in 2 Days — ${data.companyName}`,
    reminder_1d: `Reminder: Your Appointment is Tomorrow — ${data.companyName}`,
    reminder_2h: `Your Appointment Starts in 2 Hours — ${data.companyName}`,
  }

  const resolvedSubject = subject || defaultSubjects[templateType]
  const html = buildEmailHtml(templateType, data, customMessage)
  const fromName = data.fromName || data.companyName

  if (gmail) {
    await sendEmailViaGmail(
      gmail.accessToken,
      gmail.refreshToken,
      to,
      resolvedSubject,
      html,
      fromName,
      gmail.fromEmail,
      data.replyToEmail ?? null,
      gmail.onTokenRefresh,
    )
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: resolvedSubject,
    html,
    ...(data.replyToEmail ? { replyTo: data.replyToEmail } : {}),
  })
}
