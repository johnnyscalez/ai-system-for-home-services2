import { config } from 'dotenv'
config({ path: '.env.local' })
const { getHcpBusyIntervals } = await import('./lib/housecall-sync')
const { getHcpClient } = await import('./lib/housecall')
const CO = 'bc9fb131-2af2-4c31-8d79-f46bb9663e60'
const ALEX = '21b08267-1b30-4c99-9efc-f9a585acbfcc'

const now = new Date()
const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
const busy = await getHcpBusyIntervals(CO, now.toISOString(), end.toISOString())
console.log('total busy intervals (7d):', busy.length)
const byTech: Record<string, number> = {}
for (const b of busy) byTech[b.technicianId] = (byTech[b.technicianId] ?? 0) + 1
console.log('per tech:', JSON.stringify(byTech))
console.log('Alex K intervals (UTC + Chicago local):')
for (const b of busy.filter(b => b.technicianId === ALEX)) {
  const s = new Date(b.startMs), e = new Date(b.endMs)
  console.log(' ', s.toISOString(), '→', e.toISOString(), '| local:',
    s.toLocaleString('en-US', { timeZone: 'America/Chicago' }), '→',
    e.toLocaleString('en-US', { timeZone: 'America/Chicago' }), '| point:', JSON.stringify(b.point))
}

// Raw job count over the 7-day horizon (GET only) to test the 3x100 page cap
const client = await getHcpClient(CO)
if (client) {
  const res = await client.get<{ jobs?: unknown[]; total_pages?: number; total_items?: number; page?: number }>(
    `/jobs?scheduled_start_min=${encodeURIComponent(now.toISOString())}&scheduled_start_max=${encodeURIComponent(end.toISOString())}&page=1&page_size=100`)
  console.log('HCP /jobs page1 size:', res.jobs?.length, 'total_pages:', res.total_pages, 'total_items:', (res as any).total_items)
  // 30-day forward view for cap headroom
  const end30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000)
  const res30 = await client.get<{ jobs?: unknown[]; total_pages?: number }>(
    `/jobs?scheduled_start_min=${encodeURIComponent(now.toISOString())}&scheduled_start_max=${encodeURIComponent(end30.toISOString())}&page=1&page_size=100`)
  console.log('HCP /jobs 30d page1 size:', res30.jobs?.length, 'total_pages:', res30.total_pages)
}
