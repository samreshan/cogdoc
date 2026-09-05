import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const mocks = vi.hoisted(() => {
  const models = {
    project: { findFirst: vi.fn() },
    findingRevision: { findFirst: vi.fn() },
    findingEvidence: { findMany: vi.fn() },
    researchExchange: { findFirst: vi.fn() },
    researchFinding: { updateMany: vi.fn() },
    findingReview: { create: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { models, transaction: vi.fn() }
})

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'researcher-1') }))
vi.mock('@/lib/db', () => ({ db: { ...mocks.models, $transaction: mocks.transaction } }))

import { POST } from './route'
import { db } from '@/lib/db'

const context = { params: Promise.resolve({ id: 'workspace-1', findingId: 'finding-1' }) }

function revision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'revision-2',
    projectId: 'workspace-1',
    findingId: 'finding-1',
    revision: 2,
    contentHash: 'revision-content-hash',
    conclusion: 'The bounded evidence supports only this qualified conclusion.',
    researcherExplanation: 'I limited my conclusion to the supplied material.',
    uncertainty: 'More sources might change the conclusion.',
    limitations: 'Only one source was examined.',
    conflicts: 'No conflict was found in the examined material.',
    evidenceUnavailable: false,
    evidenceScope: null,
    finding: {
      id: 'finding-1',
      projectId: 'workspace-1',
      questionId: 'question-1',
      currentRevision: 2,
      disposition: 'supported_with_limits',
      question: { id: 'question-1', revision: 3 },
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'investigation')
  mocks.models.project.findFirst.mockResolvedValue({ id: 'workspace-1', userId: 'researcher-1', archived: false, deletedAt: null })
  mocks.models.findingRevision.findFirst.mockResolvedValue(revision())
  mocks.models.findingEvidence.findMany.mockResolvedValue([{
    id: 'evidence-1', workspaceSourceId: 'source-1', sourceFingerprint: 'source-hash',
    contentFingerprint: 'content-hash', locatorType: 'section', locatorValue: '§ 2', locatorPrecision: 'user_confirmed',
  }])
  mocks.models.researchExchange.findFirst.mockResolvedValue(null)
  mocks.models.researchFinding.updateMany.mockResolvedValue({ count: 1 })
  mocks.models.findingReview.create.mockResolvedValue({ id: 'review-1', decision: 'accept' })
  mocks.models.auditEvent.findFirst.mockResolvedValue(null)
  mocks.models.auditEvent.create.mockResolvedValue({ id: 'audit-1' })
  mocks.transaction.mockImplementation(async (callback) => callback(db))
})

describe('finding review endpoint', () => {
  it('creates an explicit researcher-owned current revision review with a dependency snapshot', async () => {
    const response = await POST(makeReq({
      findingRevisionId: 'revision-2',
      expectedRevision: 2,
      decision: 'retain_uncertainty',
      note: 'The available evidence remains bounded.',
    }), context)

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.reviewState).toBe('reviewed')
    expect(mocks.models.researchFinding.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'finding-1', projectId: 'workspace-1', currentRevision: 2 },
      data: { reviewState: 'reviewed' },
    }))
    expect(mocks.models.findingReview.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reviewerId: 'researcher-1',
        findingRevisionId: 'revision-2',
        decision: 'retain_uncertainty',
        dependencyHash: expect.any(String),
      }),
    }))
  })

  it('rejects stale review attempts before recording a decision', async () => {
    const response = await POST(makeReq({ findingRevisionId: 'revision-2', expectedRevision: 1, decision: 'accept' }), context)
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('stale_revision')
    expect(mocks.models.findingReview.create).not.toHaveBeenCalled()
  })

  it('gates only the affected revision while its engine question is unanswered', async () => {
    mocks.models.researchExchange.findFirst.mockResolvedValue({ id: 'engine-1' })
    const response = await POST(makeReq({ findingRevisionId: 'revision-2', expectedRevision: 2, decision: 'retain_uncertainty' }), context)
    const payload = await response.json()
    expect(response.status).toBe(409)
    expect(payload).toMatchObject({ code: 'engine_response_required', promptId: 'engine-1' })
    expect(mocks.models.findingReview.create).not.toHaveBeenCalled()
  })

  it('records a request for more evidence without falsely reviewing an incomplete finding', async () => {
    mocks.models.findingRevision.findFirst.mockResolvedValue(revision({
      conclusion: null, researcherExplanation: null, uncertainty: null, limitations: null, conflicts: null,
    }))
    mocks.models.findingEvidence.findMany.mockResolvedValue([])
    const response = await POST(makeReq({ findingRevisionId: 'revision-2', expectedRevision: 2, decision: 'request_more_evidence' }), context)
    expect(response.status).toBe(200)
    expect(mocks.models.researchFinding.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { reviewState: 'review_needed' } }))
    expect(mocks.models.findingReview.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ decision: 'request_more_evidence' }) }))
  })

  it('does not allow a stale concurrent update to create a false current review', async () => {
    mocks.models.researchFinding.updateMany.mockResolvedValue({ count: 0 })
    const response = await POST(makeReq({ findingRevisionId: 'revision-2', expectedRevision: 2, decision: 'accept' }), context)
    expect(response.status).toBe(409)
    expect(mocks.models.findingReview.create).not.toHaveBeenCalled()
  })
})
