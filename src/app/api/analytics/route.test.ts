/**
 * Integration tests for GET /api/analytics (aggregate counts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: { intervention: { findMany: vi.fn() } },
}))

import { GET } from '@/app/api/analytics/route'
import { db } from '@/lib/db'

const findMany = db.intervention.findMany as ReturnType<typeof vi.fn>

beforeEach(() => findMany.mockReset())

describe('GET /api/analytics', () => {
  it('returns 400 when projectId is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/analytics'))
    expect(res.status).toBe(400)
  })

  it('aggregates by engine, action, verdict and computes engagementRate', async () => {
    findMany.mockResolvedValue([
      { engineType: 'citation', userAction: 'engaged', verdict: 'supported', status: 'active', createdAt: new Date() },
      { engineType: 'citation', userAction: 'dismissed', verdict: 'unsupported', status: 'resolved', createdAt: new Date() },
      { engineType: 'socratic', userAction: null, verdict: null, status: 'active', createdAt: new Date() },
    ])
    const res = await GET(new NextRequest('http://localhost/api/analytics?projectId=p1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(3)
    expect(body.byEngine.citation).toBe(2)
    expect(body.byEngine.socratic).toBe(1)
    expect(body.byAction.engaged).toBe(1)
    expect(body.byVerdict.supported).toBe(1)
    // engaged (1) / total (3)
    expect(body.engagementRate).toBeCloseTo(1 / 3)
  })

  it('returns engagementRate 0 when no interventions', async () => {
    findMany.mockResolvedValue([])
    const res = await GET(new NextRequest('http://localhost/api/analytics?projectId=p1'))
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.engagementRate).toBe(0)
  })
})
