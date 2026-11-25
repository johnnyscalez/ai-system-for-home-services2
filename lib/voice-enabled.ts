// The one switch for the AI voice agent.
//
// Voice is OFF unless BOTH are true:
//   1. the deployment allows it:  VOICE_AGENT_ENABLED=true  (Railway env)
//   2. the company opted in:      intake.voice.enabled === true
//
// Off means the AI never places a call (no follow-up call steps, no "calling you
// now", no confirmation calls, no manual Call Lead) and never answers one: an
// inbound call to the company number is forwarded to the owner's phone instead.
// Every call site asks this helper, so there is no second place to forget.
//
// Fails CLOSED: any lookup problem means "off". A missed call is recoverable, an
// AI call a contractor did not ask for is not.

import { createServiceRoleClient } from "@/lib/supabase-server"
import { loadIntake } from "@/lib/intake"

const cache = new Map<string, { on: boolean; at: number }>()
const TTL_MS = 60 * 1000

export function voiceAllowedByDeployment(): boolean {
  return process.env.VOICE_AGENT_ENABLED === "true"
}

export async function voiceEnabled(companyId: string | null | undefined): Promise<boolean> {
  if (!companyId) return false
  if (!voiceAllowedByDeployment()) return false
  const hit = cache.get(companyId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.on
  let on = false
  try {
    const intake = await loadIntake(createServiceRoleClient(), companyId)
    on = intake.voice?.enabled === true
  } catch {
    on = false
  }
  cache.set(companyId, { on, at: Date.now() })
  return on
}
