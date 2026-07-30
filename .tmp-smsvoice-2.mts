import { config } from 'dotenv'
config({ path: '.env.local' })

const CID = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'
const PHONE_A = '+15550990101' // SMS duct flow
const PHONE_B = '+15550990102' // STOP flow

const { createServiceRoleClient } = await import('./lib/supabase-server')
const { processAndSave } = await import('./lib/ai-engine')
const db = createServiceRoleClient()

async function cleanup(phone: string) {
  const { data: leads } = await db.from('leads').select('id').eq('company_id', CID).eq('phone', phone)
  for (const l of leads ?? []) {
    await db.from('conversations').delete().eq('lead_id', l.id)
    await db.from('appointments').delete().eq('lead_id', l.id)
    await db.from('sequences').delete().eq('lead_id', l.id)
    await db.from('leads').delete().eq('id', l.id)
  }
}
await cleanup(PHONE_A); await cleanup(PHONE_B)

// ── Lead A: SMS duct-cleaning flow to slot offer (NO booking) ─────────────
const { data: leadA, error: eA } = await db.from('leads').insert({
  company_id: CID, phone: PHONE_A, first_name: 'AuditSms', last_name: 'Test',
  source: 'webhook', channel: 'sms', status: 'just_came_in', service_type: 'hvac',
  notes: 'air duct cleaning', metadata: { is_test: true },
}).select('id').single()
if (eA || !leadA) { console.error('lead A insert failed', eA); process.exit(1) }
console.log('leadA', leadA.id)

const turn = async (leadId: string, msg: string | null) => {
  const r = await processAndSave(leadId, CID, msg)
  console.log('\n>>> LEAD:', msg === null ? '(opener — null)' : msg)
  console.log('<<< AI  :', JSON.stringify(r.response))
  console.log('    action:', JSON.stringify(r.action ?? null), 'silent:', r.silent ?? false)
  return r
}

await turn(leadA.id, null)
await turn(leadA.id, 'Hi, yes I need my air ducts cleaned at my house')
await turn(leadA.id, "I'm at 3042 N Clark St, Chicago IL 60657")

const { data: fresh } = await db.from('leads').select('status, job_type, selected_slots, address').eq('id', leadA.id).single()
console.log('\nLead A after slot turn:', JSON.stringify({ status: fresh?.status, job_type: fresh?.job_type, address: fresh?.address }))
console.log('selected_slots techs:', JSON.stringify(fresh?.selected_slots ?? null, null, 1)?.slice(0, 800))

const { data: apts } = await db.from('appointments').select('id').eq('lead_id', leadA.id)
console.log('appointments created (must be 0):', apts?.length ?? 0)

// ── Lead B: STOP handling ─────────────────────────────────────────────────
const { data: leadB } = await db.from('leads').insert({
  company_id: CID, phone: PHONE_B, first_name: 'AuditStop', last_name: 'Test',
  source: 'webhook', channel: 'sms', status: 'contacted', service_type: 'hvac',
  metadata: { is_test: true },
}).select('id').single()
console.log('\nleadB', leadB!.id)
await turn(leadB!.id, null) // opener so there is history
const rStop = await turn(leadB!.id, 'STOP')
const { data: freshB } = await db.from('leads').select('status, ai_paused').eq('id', leadB!.id).single()
console.log('Lead B after STOP:', JSON.stringify(freshB), 'response len:', (rStop.response ?? '').length)

// ── Cleanup ───────────────────────────────────────────────────────────────
await cleanup(PHONE_A); await cleanup(PHONE_B)
console.log('\ncleaned up')
