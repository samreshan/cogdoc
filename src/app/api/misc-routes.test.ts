/**
 * Integration tests for the small routes: GET /api/user, GET /api/settings,
 * DELETE /api/pdfs/[id], and the root GET /api.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { pdf: { delete: vi.fn() } } }))

import { GET as getUser } from '@/app/api/user/route'
import { GET as getSettings } from '@/app/api/settings/route'
import { DELETE as deletePdf } from '@/app/api/pdfs/[id]/route'
import { GET as getRoot } from '@/app/api/route'
import { getDefaultUser } from '@/lib/auth'
import { db } from '@/lib/db'

const user = getDefaultUser as ReturnType<typeof vi.fn>
const pdfDelete = db.pdf.delete as ReturnType<typeof vi.fn>

beforeEach(() => {
  user.mockReset(); pdfDelete.mockReset()
})

describe('GET /api/user', () => {
  it('returns the default user profile fields', async () => {
    user.mockResolvedValue({ id: 'u1', email: 'w@c.local', displayName: 'Writer', dailyTokenBudget: 100000 })
    const res = await getUser()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toEqual({ id: 'u1', email: 'w@c.local', displayName: 'Writer', dailyTokenBudget: 100000 })
  })
})

describe('GET /api/settings', () => {
  it('returns idleThresholdSeconds and dailyTokenBudget from env with defaults', async () => {
    const res = await getSettings()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('idleThresholdSeconds')
    expect(body).toHaveProperty('dailyTokenBudget')
    expect(typeof body.idleThresholdSeconds).toBe('number')
  })

  it('respects the IDLE_THRESHOLD env var', async () => {
    process.env.IDLE_THRESHOLD = '45'
    const res = await getSettings()
    expect((await res.json()).idleThresholdSeconds).toBe(45)
    delete process.env.IDLE_THRESHOLD
  })
})

describe('DELETE /api/pdfs/[id]', () => {
  function ctx(id: string) {
    return { params: Promise.resolve({ id }) }
  }
  it('deletes the pdf and cascades', async () => {
    pdfDelete.mockResolvedValue({})
    const res = await deletePdf(new NextRequest('http://localhost/api/pdfs/p1', { method: 'DELETE' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(pdfDelete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })
})

describe('GET /api (root)', () => {
  it('returns the health message', async () => {
    const res = await getRoot()
    expect(res.status).toBe(200)
    expect((await res.json()).message).toBe('Hello, world!')
  })
})
