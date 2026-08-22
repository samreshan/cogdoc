/**
 * Integration tests for PUT /api/projects/[id]/document (auto-save).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: {
    project: { findUnique: vi.fn(), update: vi.fn() },
    document: { upsert: vi.fn() },
    certificate: { updateMany: vi.fn() },
    auditEvent: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))

import { PUT } from '@/app/api/projects/[id]/document/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'

const findUnique = db.project.findUnique as ReturnType<typeof vi.fn>
const upsert = db.document.upsert as ReturnType<typeof vi.fn>
const update = db.project.update as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>
const transaction = db.$transaction as ReturnType<typeof vi.fn>

beforeEach(() => {
  findUnique.mockReset(); upsert.mockReset(); update.mockReset(); getUser.mockReset()
  getUser.mockResolvedValue({ id: 'user-1' })
  transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db))
})

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}
function putReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/projects/${id}/document`, {
    method: 'PUT', body: JSON.stringify(body),
  })
}

describe('PUT /api/projects/[id]/document', () => {
  it('returns 404 when the project does not exist', async () => {
    findUnique.mockResolvedValue(null)
    const res = await PUT(putReq('p1', { content: 'x' }), ctx('p1'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the project belongs to a different user (isolation)', async () => {
    findUnique.mockResolvedValue({ userId: 'someone-else', document: { id: 'd1' } })
    const res = await PUT(putReq('p1', { content: 'x' }), ctx('p1'))
    expect(res.status).toBe(404)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('upserts the document and touches project.updatedAt', async () => {
    findUnique.mockResolvedValue({ userId: 'user-1', document: { id: 'd1' } })
    upsert.mockResolvedValue({ lastSaved: '2026-01-01', revision: 1, contentHash: 'hash' })
    const res = await PUT(putReq('p1', { content: 'new content' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect((await res.json())).toEqual({ ok: true, lastSaved: '2026-01-01', revision: 1, contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(upsert).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { updatedAt: expect.any(Date), lifecycleState: 'draft' } })
  })

  it('defaults content to empty string when not a string', async () => {
    findUnique.mockResolvedValue({ userId: 'user-1' })
    upsert.mockResolvedValue({ lastSaved: '2026-01-01', revision: 1, contentHash: 'hash' })
    await PUT(putReq('p1', {}), ctx('p1'))
    expect(JSON.parse(upsert.mock.calls[0][0].update.content)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })
})
