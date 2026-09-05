import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/db', () => {
  const models = {
    reviewItem: { findFirst: vi.fn(), update: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})

import { POST } from '@/app/api/review-items/[id]/recheck/route'
import { db } from '@/lib/db'

const findItem = db.reviewItem.findFirst as ReturnType<typeof vi.fn>
const updateItem = db.reviewItem.update as ReturnType<typeof vi.fn>
const auditCreate = db.auditEvent.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  findItem.mockResolvedValue({ id: 'review-1', projectId: 'project-1', type: 'claim_needs_evidence' })
  updateItem.mockResolvedValue({ id: 'review-1', state: 'rechecking' })
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  auditCreate.mockResolvedValue({ id: 'audit-1' })
})

describe('review recheck history', () => {
  it('records the explicit recheck request with the state update', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/review-items/review-1/recheck', { method: 'POST' }),
      { params: Promise.resolve({ id: 'review-1' }) },
    )

    expect(response.status).toBe(200)
    expect(updateItem).toHaveBeenCalledWith({ where: { id: 'review-1' }, data: { state: 'rechecking' } })
    expect(auditCreate.mock.calls[0][0].data.type).toBe('review_item_recheck_requested')
    expect(auditCreate.mock.calls[0][0].data.eventHash).toBeTruthy()
  })

  it('does not expose another user review item', async () => {
    findItem.mockResolvedValue(null)
    const response = await POST(
      new NextRequest('http://localhost/api/review-items/review-1/recheck', { method: 'POST' }),
      { params: Promise.resolve({ id: 'review-1' }) },
    )
    expect(response.status).toBe(404)
    expect(updateItem).not.toHaveBeenCalled()
  })
})
