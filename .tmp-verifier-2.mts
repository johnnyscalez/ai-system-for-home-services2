import { config } from 'dotenv'
config({ path: '.env.local' })

const { createServiceRoleClient } = await import('./lib/supabase-server')
const { getOrCreateSession } = await import('./lib/voice-session')
const { runVoiceTurn } = await import('./lib/voice-engine')

const COMPANY = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'
const TAG = `AUDIT_VRF_${Date.now()}`
const db = createServiceRoleClient()

// 1. Create fresh test lead
const { data: lead, error: leadErr } = await db.from('leads').insert({
  company_id: COMPANY,
  first_name: 'AuditVerify',
  last_name: 'Test',
  phone: `msgr:${TAG}`,
  status: 'new',
  source: 'audit-test',
  metadata: { is_test: true },
}).select().single()
if (leadErr || !lead) { console.error('lead insert failed', leadErr); process.exit(1) }
console.log('LEAD', lead.id)

const session = await getOrCreateSession(TAG, lead.id, COMPANY, 'inbound')

async function turn(msg: string | null) {
  const r = await runVoiceTurn(session, msg)
  // refresh session from DB so next turn has updated messages/collected
  const { data: s2 } = await db.from('voice_sessions').select('*').eq('call_sid', TAG).single()
  Object.assign(session, s2)
  console.log('CALLER:', msg ?? '(greeting turn)')
  console.log('AGENT :', r.text)
  console.log('ACTION:', JSON.stringify(r.action ?? null))
  console.log('---')
  return r
}

try {
  await turn(null)
  await turn('Hi, I need air duct cleaning at my house')
  await turn('Sure, my zip code is 60540')

  const { data: after } = await db.from('leads').select('status, notes').eq('id', lead.id).single()
  console.log('FINAL LEAD STATUS:', after?.status)
} finally {
  // Cleanup: conversations, appointments, voice_sessions, then lead
  const del1 = await db.from('conversations').delete().eq('lead_id', lead.id)
  const del2 = await db.from('appointments').delete().eq('lead_id', lead.id)
  const del3 = await db.from('voice_sessions').delete().eq('lead_id', lead.id)
  const del4 = await db.from('leads').delete().eq('id', lead.id)
  console.log('CLEANUP errors:', del1.error, del2.error, del3.error, del4.error)
  const { data: leftover } = await db.from('leads').select('id').eq('id', lead.id)
  console.log('LEAD STILL EXISTS?', (leftover ?? []).length > 0)
}
