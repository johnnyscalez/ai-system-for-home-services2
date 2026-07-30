import { config } from 'dotenv'
config({ path: '.env.local' })

const CID = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'

const { createServiceRoleClient } = await import('./lib/supabase-server')
const { runVoiceTurn } = await import('./lib/voice-engine')
const { getOrCreateSession } = await import('./lib/voice-session')
const { processAndSave } = await import('./lib/ai-engine')
const { FOLLOW_UP_ANGLE } = await import('./lib/sequences')
const db = createServiceRoleClient()

const PHONES = ['+15550990201', '+15550990202', '+15550990203', '+15550990204']
const SIDS = ['CA_AUDIT_V1', 'CA_AUDIT_V2', 'CA_AUDIT_V3']

async function cleanup() {
  for (const sid of SIDS) await db.from('voice_sessions').delete().eq('call_sid', sid)
  for (const p of PHONES) {
    const { data: leads } = await db.from('leads').select('id').eq('company_id', CID).eq('phone', p)
    for (const l of leads ?? []) {
      await db.from('conversations').delete().eq('lead_id', l.id)
      await db.from('appointments').delete().eq('lead_id', l.id)
      await db.from('sequences').delete().eq('lead_id', l.id)
      await db.from('scheduled_calls').delete().eq('lead_id', l.id)
      await db.from('leads').delete().eq('id', l.id)
    }
  }
}
await cleanup()

async function mkLead(phone: string, name: string, extra: Record<string, unknown> = {}) {
  const { data } = await db.from('leads').insert({
    company_id: CID, phone, first_name: name, last_name: 'AuditVoice',
    source: 'webhook', channel: 'voice', status: 'new', service_type: 'hvac',
    metadata: { is_test: true }, ...extra,
  }).select('id').single()
  return data!.id
}

async function voiceConvo(sid: string, leadId: string, msgs: string[]) {
  let session = await getOrCreateSession(sid, leadId, CID, 'inbound')
  const r0 = await runVoiceTurn(session, null)
  console.log('  greeting:', JSON.stringify(r0.text), '| action:', r0.action.type)
  for (const m of msgs) {
    const { data: s } = await db.from('voice_sessions').select('*').eq('call_sid', sid).single()
    const r = await runVoiceTurn(s as any, m)
    console.log('  LEAD:', m)
    console.log('  AI  :', JSON.stringify(r.text), '| action:', JSON.stringify(r.action))
    if (r.action.type === 'end' || r.action.type === 'transfer') break
  }
  const { data: s2 } = await db.from('voice_sessions').select('collected').eq('call_sid', sid).single()
  console.log('  collected.available_slots:', JSON.stringify((s2?.collected as any)?.available_slots ?? null))
  const { data: lead } = await db.from('leads').select('status, job_type').eq('id', leadId).single()
  const { data: apts } = await db.from('appointments').select('id, technician_name, scheduled_at').eq('lead_id', leadId)
  console.log('  final lead:', JSON.stringify(lead), '| appointments:', JSON.stringify(apts))
}

// V1: duct cleaning Chicago — up to slot offer, then leave without booking
console.log('\n=== VOICE V1: duct @ Chicago 60640 ===')
const v1 = await mkLead(PHONES[0], 'VDuct')
await voiceConvo(SIDS[0], v1, [
  'Hi, I need my air ducts cleaned at my house',
  "I'm at 4823 North Ashland Avenue, Chicago, zip code 60640",
  "Hmm, let me talk to my wife first and I'll call you back. Bye!",
])

// V2: AC repair Chicago — David G routing
console.log('\n=== VOICE V2: ac_repair @ Chicago 60614 ===')
const v2 = await mkLead(PHONES[1], 'VAc', { job_type: 'ac_repair' })
await voiceConvo(SIDS[1], v2, [
  'My AC is running but blowing warm air, I need someone to come look at it',
  "Sure, it's 3042 North Clark Street, Chicago, 60614",
  "Actually I have to run, I'll call back to pick a time. Goodbye!",
])

// V3: thermostat — job_not_offered decline
console.log('\n=== VOICE V3: thermostat @ 60614 (should decline) ===')
const v3 = await mkLead(PHONES[2], 'VThermo', { job_type: 'thermostat' })
await voiceConvo(SIDS[2], v3, [
  'I want a new smart thermostat installed, do you guys do that?',
  'My zip is 60614',
])

// STOP-lead follow-up probe: does the cron path generate a follow-up text for a "lost" STOP lead?
console.log('\n=== STOP lead follow-up probe ===')
const p = await mkLead(PHONES[3], 'AuditStop2', { channel: 'sms', status: 'contacted' })
await processAndSave(p, CID, null) // opener
const rs = await processAndSave(p, CID, 'STOP. Do not text me again.')
console.log('  STOP reply:', JSON.stringify(rs.response), '| action:', JSON.stringify(rs.action ?? null))
const { data: pl } = await db.from('leads').select('status').eq('id', p).single()
console.log('  status after STOP:', pl?.status)
// Simulate the cron firing replied_not_booked step 1 (what the route would have scheduled)
const rf = await processAndSave(p, CID, null, undefined, FOLLOW_UP_ANGLE['replied_not_booked:1'])
console.log('  follow-up turn response (would be SMSed to STOP lead if non-empty):', JSON.stringify(rf.response))

await cleanup()
console.log('\ncleaned up all voice/stop test rows')
