import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn(), transaction: vi.fn(), append: vi.fn() }))
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: mocks.append }))
vi.mock('@/lib/db', () => ({ db: {
  intervention: { findFirst: mocks.findFirst, update: mocks.update },
  $transaction: mocks.transaction,
} }))

import { PATCH } from './route'
import { db } from '@/lib/db'

const context = { params: Promise.resolve({ id: 'intervention-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue({ id: 'intervention-1', projectId: 'project-1', engineType: 'socratic', status: 'active' })
  mocks.update.mockResolvedValue({ id: 'intervention-1', projectId: 'project-1', engineType: 'socratic', status: 'resolved', userAction: 'dismissed' })
  mocks.transaction.mockImplementation(async (callback) => callback(db))
  mocks.append.mockResolvedValue({ id: 'audit-1' })
})

describe('intervention decisions', () => {
  it('authorizes, updates, and seals a dismissal decision', async () => {
    const response = await PATCH(makeReq({ userAction: 'dismissed', status: 'resolved' }), context)
    expect(response.status).toBe(200)
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: 'intervention-1', userId: 'user-1', project: { deletedAt: null } } })
    expect(mocks.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'intervention_dismissed', actor: 'student' }))
  })

  it('does not mutate an intervention outside the authenticated user', async () => {
    mocks.findFirst.mockResolvedValue(null)
    expect((await PATCH(makeReq({ userAction: 'dismissed' }), context)).status).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
