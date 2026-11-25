// Shapes the Conversations list. Shared by the server page (first paint) and the
// client list (live refetch), so both build rows the same way. No "use client":
// the server page calls these functions directly.

export type ConversationRow = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  status: string
  ai_paused: boolean | null
  last_message_at: string | null
  messageCount: number
  channels: string[]
}

/** The select both callers use: every lead that has at least one message. */
export const CONVERSATION_LIST_SELECT =
  "id, first_name, last_name, phone, status, ai_paused, last_message_at, created_at, conversations!inner(id, channel)"

type RawLead = {
  id: unknown; first_name: unknown; last_name: unknown; phone: unknown; status: unknown
  ai_paused: unknown; last_message_at: unknown; conversations: unknown
}

/** Rows written on the retired WhatsApp channel, and legacy rows with no channel, are text messages. */
function normalizeChannel(channel: string | null): string {
  if (!channel || channel === "whatsapp") return "sms"
  return channel
}

export function toConversationRows(leads: unknown[] | null | undefined): ConversationRow[] {
  return ((leads ?? []) as RawLead[]).map((l) => {
    const convos = (l.conversations as { id: string; channel: string | null }[] | null) ?? []
    const channels = Array.from(new Set(convos.map((c) => normalizeChannel(c.channel))))
    return {
      id: l.id as string,
      first_name: l.first_name as string | null,
      last_name: l.last_name as string | null,
      phone: l.phone as string,
      status: l.status as string,
      ai_paused: l.ai_paused as boolean | null,
      last_message_at: l.last_message_at as string | null,
      messageCount: convos.length,
      channels,
    }
  })
}
