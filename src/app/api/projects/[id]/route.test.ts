/**
 * Integration tests for /api/projects/[id] (get + delete).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findUnique: vi.fn(), update: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))

import { GET, DELETE } from '@/app/api/projects/[id]/route'
import { db } from '@/lib/db'

const findUnique = db.project.findUnique as ReturnType<typeof vi.fn>
const update = db.project.update as ReturnType<typeof vi.fn>
const auditCreate = db.auditEvent.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  findUnique.mockReset(); update.mockReset(); auditCreate.mockReset()
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockReset()
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  auditCreate.mockResolvedValue({ id: 'audit-1' })
})

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/projects/[id]', () => {
  it('returns the project with relations', async () => {
    findUnique.mockResolvedValue({ id: 'p1', title: 'A', pdfs: [], interventions: [] })
    const res = await GET(new NextRequest('http://localhost/api/projects/p1'), ctx('p1'))
    expect(res.status).toBe(200)
    expect((await res.json()).project.id).toBe('p1')
    // take limit on interventions is 100
    const q = findUnique.mock.calls[0][0]
    expect(q.include.interventions.take).toBe(100)
  })

  it('returns 404 when not found', async () => {
    findUnique.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/projects/x'), ctx('x'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('soft-deletes the owned project', async () => {
    findUnique.mockResolvedValue({ userId: 'u1', title: 'Research project' })
    update.mockResolvedValue({})
    const res = await DELETE(new NextRequest('http://localhost/api/projects/p1', { method: 'DELETE' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { archived: true, deletedAt: expect.any(Date) } })
    expect(auditCreate.mock.calls[0][0].data.type).toBe('workspace_deleted')
  })
})
