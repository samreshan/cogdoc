import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const mocks = vi.hoisted(() => {
  const models = {
    project: { findFirst: vi.fn() }, workspaceSource: { findFirst: vi.fn(), delete: vi.fn() },
    findingEvidence: { findMany: vi.fn() }, researchFinding: { updateMany: vi.fn(), findMany: vi.fn() }, researchArticle: { updateMany: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { models, transaction: vi.fn() }
})

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'researcher-1') }))
vi.mock('@/lib/db', () => ({ db: { ...mocks.models, $transaction: mocks.transaction } }))

import { DELETE } from './route'
import { db } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.models.project.findFirst.mockResolvedValue({ id: 'workspace-1', userId: 'researcher-1' })
  mocks.models.workspaceSource.findFirst.mockResolvedValue({ id: 'source-1', projectId: 'workspace-1', librarySourceId: 'library-1' })
  mocks.models.findingEvidence.findMany.mockResolvedValue([{ findingRevision: { findingId: 'finding-1', revision: 2, finding: { id: 'finding-1', currentRevision: 2, reviewState: 'reviewed' } } }])
  mocks.models.researchFinding.updateMany.mockResolvedValue({ count: 1 })
  mocks.models.researchArticle.updateMany.mockResolvedValue({ count: 1 })
  mocks.models.workspaceSource.delete.mockResolvedValue({ id: 'source-1' })
  mocks.models.auditEvent.findFirst.mockResolvedValue(null)
  mocks.models.auditEvent.create.mockResolvedValue({ id: 'audit-1' })
  mocks.transaction.mockImplementation(async (callback) => callback(db))
})

describe('workspace source removal', () => {
  it('invalidates only current reviewed evidence dependencies before unlinking the source', async () => {
    const response = await DELETE(makeReq({ workspaceSourceId: 'source-1' }), { params: Promise.resolve({ id: 'workspace-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.models.researchFinding.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { reviewState: 'review_needed' } }))
    expect(mocks.models.researchArticle.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'review_needed' } }))
    expect(mocks.models.workspaceSource.delete).toHaveBeenCalledWith({ where: { id: 'source-1' } })
  })
})
