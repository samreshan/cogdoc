/**
 * Tests for GET/PUT /api/settings — runtime settings + friction-mode persistence.
 *
 * GET returns public env-derived settings (idle threshold, token budget) AND the
 * acting user's frictionMode (persisted per-user). PUT validates + persists a
 * friction-mode change on the User row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))

import { GET, PUT } from '@/app/api/settings/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'

const userFindUnique = db.user.findUnique as ReturnType<typeof vi.fn>
const userUpdate = db.user.update as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>

beforeEach(() => {
  userFindUnique.mockReset()
  userUpdate.mockReset()
  getUser.mockReset()
  getUser.mockResolvedValue({ id: 'u1' })
})

describe('GET /api/settings', () => {
  function getReq() {
    return new NextRequest('http://localhost/api/settings', { method: 'GET' })
  }
  it('returns env settings plus the user frictionMode', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', frictionMode: 'coach' })
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.idleThresholdSeconds).toBe(2)
    expect(body.dailyTokenBudget).toBe(100000)
    expect(body.frictionMode).toBe('coach')
  })

  it('defaults to socratic when the user row has no frictionMode', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1' })
    const res = await GET(getReq())
    expect((await res.json()).frictionMode).toBe('socratic')
  })
})

describe('PUT /api/settings', () => {
  function putReq(body: unknown) {
    return new NextRequest('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('persists a valid friction mode and returns it', async () => {
    userUpdate.mockResolvedValue({ id: 'u1', frictionMode: 'assistant' })
    const res = await PUT(putReq({ frictionMode: 'assistant' }))
    expect(res.status).toBe(200)
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { frictionMode: 'assistant' } }),
    )
    expect((await res.json()).frictionMode).toBe('assistant')
  })

  it('rejects an invalid friction mode with 400', async () => {
    const res = await PUT(putReq({ frictionMode: 'turbo' }))
    expect(res.status).toBe(400)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('accepts each of the three valid modes', async () => {
    for (const mode of ['socratic', 'coach', 'assistant'] as const) {
      userUpdate.mockResolvedValue({ id: 'u1', frictionMode: mode })
      const res = await PUT(putReq({ frictionMode: mode }))
      expect(res.status).toBe(200)
    }
  })

  it('rejects a missing frictionMode field with 400', async () => {
    const res = await PUT(putReq({}))
    expect(res.status).toBe(400)
  })
})
