import { describe, expect, it, vi } from 'vitest'
import { currentFindingIdsForWorkspaceSource, invalidateFindingReviews } from './finding-review-invalidation'

function transaction() {
  return {
    researchFinding: { updateMany: vi.fn(async () => ({ count: 1 })), findMany: vi.fn(async () => [{ id: 'finding-1' }]) },
    researchArticle: { updateMany: vi.fn(async () => ({ count: 1 })) },
    findingEvidence: { findMany: vi.fn(async () => [
      { findingRevision: { findingId: 'finding-1', revision: 2, finding: { id: 'finding-1', currentRevision: 2, reviewState: 'reviewed' } } },
      { findingRevision: { findingId: 'old-finding', revision: 1, finding: { id: 'old-finding', currentRevision: 2, reviewState: 'reviewed' } } },
    ]) },
    auditEvent: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'audit-1' })) },
  }
}

describe('review dependency invalidation', () => {
  it('marks only selected reviewed findings and their selected articles review-needed with a durable reason', async () => {
    const tx = transaction()
    const result = await invalidateFindingReviews(tx, {
      projectId: 'workspace-1', userId: 'researcher-1', findingIds: ['finding-1', 'finding-1'],
      reason: 'The locator changed.', changed: { kind: 'locator', id: 'evidence-1' },
    })
    expect(result).toEqual({ findings: 1, articles: 1 })
    expect(tx.researchFinding.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['finding-1'] }, projectId: 'workspace-1', reviewState: 'reviewed' }, data: { reviewState: 'review_needed' },
    }))
    expect(tx.researchArticle.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ inputs: { some: { findingId: { in: ['finding-1'] } } } }), data: { status: 'review_needed' },
    }))
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'research_finding_review_invalidated' }) }))
    expect(tx.auditEvent.create.mock.calls[0][0].data.payloadJson).toContain('The locator changed.')
  })

  it('ignores an old revision when a workspace source is removed', async () => {
    const tx = transaction()
    await expect(currentFindingIdsForWorkspaceSource(tx, 'workspace-1', 'source-1')).resolves.toEqual(['finding-1'])
  })
})
