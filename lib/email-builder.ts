export type EmailTemplateType = "confirmation" | "reminder_2d" | "reminder_1d" | "reminder_2h"

export type AppointmentEmailData = {
  leadName: string
  companyName: string
  serviceType: string
  scheduledAt: string
  address?: string | null
  notes?: string | null
  timezone: string
  logoUrl?: string | null
  replyToEmail?: string | null
  fromName?: string | null
}

function formatDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
  })
}

function formatTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: tz,
  })
}

export function buildEmailHtml(
  templateType: EmailTemplateType,
  data: AppointmentEmailData,
  customMessage?: string | null,
): string {
  const date = formatDate(data.scheduledAt, data.timezone)
  const time = formatTime(data.scheduledAt, data.timezone)

  const configs = {
    confirmation: {
      badge: "Confirmed", badgeColor: "#16A34A",
      headline: "Your Appointment is Confirmed ✓",
      intro: customMessage || `Hi ${data.leadName}, your appointment with ${data.companyName} has been confirmed. We look forward to seeing you!`,
    },
    reminder_2d: {
      badge: "Reminder", badgeColor: "#7C3AED",
      headline: "Your Appointment is in 2 Days",
      intro: customMessage || `Hi ${data.leadName}, just a quick reminder that your appointment with ${data.companyName} is coming up in 2 days.`,
    },
    reminder_1d: {
      badge: "Tomorrow", badgeColor: "#D97706",
      headline: "Your Appointment is Tomorrow",
      intro: customMessage || `Hi ${data.leadName}, your appointment with ${data.companyName} is tomorrow! We wanted to make sure you're all set.`,
    },
    reminder_2h: {
      badge: "Starting Soon", badgeColor: "#DC2626",
      headline: "Your Appointment Starts in 2 Hours",
      intro: customMessage || `Hi ${data.leadName}, your appointment with ${data.companyName} starts in just 2 hours. See you soon!`,
    },
  }

  const c = configs[templateType]

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F4F2;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F4F2;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

<!-- Header -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="background:linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%);padding:36px 40px;text-align:center;">
${data.logoUrl
  ? `<img src="${data.logoUrl}" alt="${data.companyName}" style="max-height:64px;max-width:200px;object-fit:contain;display:block;margin:0 auto 16px;">`
  : `<div style="color:#FFFFFF;font-size:20px;font-weight:700;margin-bottom:16px;">${data.companyName}</div>`}
<div style="background:rgba(255,255,255,0.2);display:inline-block;padding:5px 16px;border-radius:100px;color:#FFFFFF;font-size:12px;font-weight:600;letter-spacing:0.5px;margin-bottom:14px;">${c.badge}</div>
<h1 style="color:#FFFFFF;font-size:24px;font-weight:700;margin:0;line-height:1.3;">${c.headline}</h1>
</td></tr>
</table>

<!-- Body -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:36px 40px;">
<p style="color:#44403C;font-size:16px;line-height:1.6;margin:0 0 28px;">${c.intro}</p>

<!-- Details card -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF8;border:1px solid #E7E5E4;border-radius:12px;margin-bottom:28px;">
<tr><td style="padding:16px 24px;border-bottom:1px solid #E7E5E4;">
<span style="color:#78716C;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Appointment Details</span>
</td></tr>
<tr><td style="padding:20px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding-bottom:14px;">
<div style="color:#78716C;font-size:12px;font-weight:500;margin-bottom:3px;">📅  Date</div>
<div style="color:#1C1917;font-size:15px;font-weight:600;">${date}</div>
</td></tr>
<tr><td style="padding-bottom:14px;">
<div style="color:#78716C;font-size:12px;font-weight:500;margin-bottom:3px;">🕐  Time</div>
<div style="color:#1C1917;font-size:15px;font-weight:600;">${time}</div>
</td></tr>
${data.address ? `<tr><td style="padding-bottom:14px;">
<div style="color:#78716C;font-size:12px;font-weight:500;margin-bottom:3px;">📍  Address</div>
<div style="color:#1C1917;font-size:15px;font-weight:600;">${data.address}</div>
</td></tr>` : ""}
<tr><td>
<div style="color:#78716C;font-size:12px;font-weight:500;margin-bottom:3px;">🔧  Service</div>
<div style="color:#1C1917;font-size:15px;font-weight:600;">${data.serviceType}</div>
</td></tr>
</table>
</td></tr>
</table>

${data.notes ? `<div style="background:#F5F4F2;border-radius:10px;padding:14px 18px;margin-bottom:28px;color:#78716C;font-size:14px;line-height:1.6;">📝 ${data.notes}</div>` : ""}

<p style="color:#78716C;font-size:14px;line-height:1.6;margin:0 0 8px;">Questions or need to reschedule? Just reply to this email${data.replyToEmail ? ` or reach us at <a href="mailto:${data.replyToEmail}" style="color:#7C3AED;">${data.replyToEmail}</a>` : ""}.</p>
</td></tr>
</table>

<!-- Footer -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="background:#FAFAF8;border-top:1px solid #E7E5E4;padding:18px 40px;text-align:center;">
<p style="color:#A8A29E;font-size:12px;margin:0;">${data.companyName} · Powered by LeadReply</p>
</td></tr>
</table>

</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
