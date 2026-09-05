/**
 * Integration tests for GET /api/interventions + PATCH /api/interventions/[id].
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => {
  const models = { intervention: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() } }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'u1') }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: vi.fn(async () => ({ id: 'audit-1' })) }))

import { GET } from '@/app/api/interventions/route'
import { PATCH } from '@/app/api/interventions/[id]/route'
import { db } from '@/lib/db'

const findMany = db.intervention.findMany as ReturnType<typeof vi.fn>
const findFirst = db.intervention.findFirst as ReturnType<typeof vi.fn>
const update = db.intervention.update as ReturnType<typeof vi.fn>

beforeEach(() => {
  findMany.mockReset(); findFirst.mockReset(); update.mockReset()
  findFirst.mockResolvedValue({ id: 'iv-1', projectId: 'p1', engineType: 'socratic', status: 'active' })
})

describe('GET /api/interventions', () => {
  it('returns 400 when projectId is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/interventions'))
    expect(res.status).toBe(400)
  })

  it('lists interventions for the project with evidences included', async () => {
    findMany.mockResolvedValue([{ id: 'iv-1' }])
    const res = await GET(new NextRequest('http://localhost/api/interventions?projectId=p1'))
    expect(res.status).toBe(200)
    expect((await res.json()).interventions).toHaveLength(1)
    const q = findMany.mock.calls[0][0]
    expect(q.where).toEqual({ projectId: 'p1' })
    expect(q.take).toBe(200)
    expect(q.include.evidences).toBeDefined()
  })

  it('returns one active intervention when persisted engines share a phrase', async () => {
    const shared = {
      userId: 'u1', projectId: 'p1', paragraphId: null, promptTemplateTag: null,
      promptText: 'One anchored phrase.', responseText: 'Question', verdict: null,
      status: 'active', userAction: null, resolvedAt: null,
    }
    findMany.mockResolvedValue([
      { ...shared, id: 'socratic', engineType: 'socratic', createdAt: '2026-09-01T02:00:00.000Z' },
      { ...shared, id: 'citation', engineType: 'citation', createdAt: '2026-09-01T01:00:00.000Z' },
    ])
    const res = await GET(new NextRequest('http://localhost/api/interventions?projectId=p1'))
    expect((await res.json()).interventions.map((item: { id: string }) => item.id)).toEqual(['citation'])
  })
})

describe('PATCH /api/interventions/[id]', () => {
  function ctx(id: string) {
    return { params: Promise.resolve({ id }) }
  }
  function patchReq(id: string, body: unknown) {
    return new NextRequest(`http://localhost/api/interventions/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    })
  }

  it('does not resolve an intervention merely because the researcher engaged with it', async () => {
    update.mockResolvedValue({ id: 'iv-1', userAction: 'engaged' })
    await PATCH(patchReq('iv-1', { userAction: 'engaged' }), ctx('iv-1'))
    const data = update.mock.calls[0][0].data
    expect(data.userAction).toBe('engaged')
    expect(data.resolvedAt).toBeUndefined()
  })

  it('clears a stale resolution timestamp when returning an intervention to active', async () => {
    update.mockResolvedValue({ id: 'iv-1', userAction: 'engaged' })
    await PATCH(patchReq('iv-1', { userAction: 'engaged', status: 'active' }), ctx('iv-1'))
    expect(update.mock.calls[0][0].data.resolvedAt).toBeNull()
  })

  it('sets resolvedAt when status is resolved', async () => {
    update.mockResolvedValue({ id: 'iv-1' })
    await PATCH(patchReq('iv-1', { status: 'resolved' }), ctx('iv-1'))
    expect(update.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(Date)
  })

  it('does not set resolvedAt for ignored action', async () => {
    update.mockResolvedValue({ id: 'iv-1' })
    await PATCH(patchReq('iv-1', { userAction: 'ignored' }), ctx('iv-1'))
    expect(update.mock.calls[0][0].data.resolvedAt).toBeUndefined()
  })
})
