/**
 * Integration tests for /api/projects/[id] (get + delete).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: { project: { findUnique: vi.fn(), delete: vi.fn() } },
}))

import { GET, DELETE } from '@/app/api/projects/[id]/route'
import { db } from '@/lib/db'

const findUnique = db.project.findUnique as ReturnType<typeof vi.fn>
const del = db.project.delete as ReturnType<typeof vi.fn>

beforeEach(() => {
  findUnique.mockReset(); del.mockReset()
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
  it('deletes the project', async () => {
    del.mockResolvedValue({})
    const res = await DELETE(new NextRequest('http://localhost/api/projects/p1', { method: 'DELETE' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(del).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })
})
