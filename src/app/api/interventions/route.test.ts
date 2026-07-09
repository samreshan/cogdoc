/**
 * Integration tests for GET /api/interventions + PATCH /api/interventions/[id].
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: { intervention: { findMany: vi.fn(), update: vi.fn() } },
}))

import { GET } from '@/app/api/interventions/route'
import { PATCH } from '@/app/api/interventions/[id]/route'
import { db } from '@/lib/db'

const findMany = db.intervention.findMany as ReturnType<typeof vi.fn>
const update = db.intervention.update as ReturnType<typeof vi.fn>

beforeEach(() => {
  findMany.mockReset(); update.mockReset()
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

  it('sets resolvedAt when action is engaged', async () => {
    update.mockResolvedValue({ id: 'iv-1', userAction: 'engaged' })
    await PATCH(patchReq('iv-1', { userAction: 'engaged' }), ctx('iv-1'))
    const data = update.mock.calls[0][0].data
    expect(data.userAction).toBe('engaged')
    expect(data.resolvedAt).toBeInstanceOf(Date)
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
