import { google } from "googleapis"

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
]

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`
  )
}

export function getGoogleAuthUrl(state: string) {
  const client = createOAuth2Client()
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent",
  })
}

export async function getTokensFromCode(code: string) {
  const client = createOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getGoogleUserEmail(accessToken: string, refreshToken: string) {
  const client = createOAuth2Client()
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  const oauth2 = google.oauth2({ version: "v2", auth: client })
  const { data } = await oauth2.userinfo.get()
  return data.email ?? null
}

export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  calendarId: string,
  event: {
    summary: string
    description: string
    location?: string
    startTime: string
    endTime: string
    attendeeEmail?: string
    timezone?: string
    /** Video appointments get a real Google Meet room; site visits never do. */
    withMeet?: boolean
  },
  onTokenRefresh?: (newAccessToken: string) => void
) {
  const client = createOAuth2Client()
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  if (onTokenRefresh) {
    client.on("tokens", (tokens) => {
      if (tokens.access_token) onTokenRefresh(tokens.access_token)
    })
  }
  const calendar = google.calendar({ version: "v3", auth: client })
  const tz = event.timezone ?? "America/New_York"

  const res = await calendar.events.insert({
    calendarId,
    // conferenceDataVersion:1 is REQUIRED for Google to honour a Meet request;
    // without it the createRequest is silently dropped and no link comes back.
    conferenceDataVersion: event.withMeet ? 1 : 0,
    // Google emails the invite (with the Meet link) to attendees itself, which
    // is how the lead gets their email confirmation.
    sendUpdates: event.attendeeEmail ? "all" : "none",
    requestBody: {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.startTime, timeZone: tz },
      end: { dateTime: event.endTime, timeZone: tz },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
      ...(event.attendeeEmail
        ? { attendees: [{ email: event.attendeeEmail }] }
        : {}),
      ...(event.withMeet
        ? {
            conferenceData: {
              createRequest: {
                requestId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    },
  })
  return res.data
}

export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string,
  calendarId: string,
  eventId: string
) {
  const client = createOAuth2Client()
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  const calendar = google.calendar({ version: "v3", auth: client })
  await calendar.events.delete({ calendarId, eventId })
}

export async function getCalendarEvents(
  accessToken: string,
  refreshToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  onTokenRefresh?: (newAccessToken: string) => void
) {
  const client = createOAuth2Client()
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  if (onTokenRefresh) {
    client.on("tokens", (tokens) => {
      if (tokens.access_token) onTokenRefresh(tokens.access_token)
    })
  }
  const calendar = google.calendar({ version: "v3", auth: client })

  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  })
  return res.data.items ?? []
}
