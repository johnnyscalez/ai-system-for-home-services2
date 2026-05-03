import { google } from "googleapis"

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
]

export function createGmailOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  )
}

export function getGmailAuthUrl(state: string) {
  const client = createGmailOAuth2Client()
  return client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    state,
    prompt: "consent",
  })
}

export async function getGmailTokensFromCode(code: string) {
  const client = createGmailOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getGmailUserEmail(accessToken: string, refreshToken: string) {
  const client = createGmailOAuth2Client()
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  const oauth2 = google.oauth2({ version: "v2", auth: client })
  const { data } = await oauth2.userinfo.get()
  return data.email ?? null
}

export async function sendEmailViaGmail(
  accessToken: string,
  refreshToken: string,
  to: string,
  subject: string,
  html: string,
  fromName: string,
  fromEmail: string,
  replyTo?: string | null,
  onTokenRefresh?: (newToken: string) => void
): Promise<void> {
  const client = createGmailOAuth2Client()
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

  if (onTokenRefresh) {
    client.on("tokens", (tokens) => {
      if (tokens.access_token) onTokenRefresh(tokens.access_token)
    })
  }

  const gmail = google.gmail({ version: "v1", auth: client })

  // Encode subject for non-ASCII safety
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`

  const headerLines = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
  ]

  const raw = `${headerLines.join("\r\n")}\r\n\r\n${html}`
  const encoded = Buffer.from(raw).toString("base64url")

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  })
}
