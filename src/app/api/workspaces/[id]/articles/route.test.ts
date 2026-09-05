import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const drafting = vi.hoisted(() => ({ configuredArticleDraft: vi.fn(), manualOutlineContent: vi.fn(() => '# Manual outline\n\nWrite this section in your own words') }))

const mocks = vi.hoisted(() => {
  const models = {
    project: { findFirst: vi.fn() }, researchContext: { findUnique: vi.fn() },
    findingRevision: { findMany: vi.fn() }, researchArticle: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  }
  return { models, transaction: vi.fn() }
})
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/db', () => ({ db: { ...mocks.models, $transaction: mocks.transaction } }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: vi.fn() }))
vi.mock('@/lib/article-composition', () => drafting)

import { POST } from './route'
import { db } from '@/lib/db'

const context = { params: Promise.resolve({ id: 'workspace-1' }) }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'article')
  mocks.models.project.findFirst.mockResolvedValue({ id: 'workspace-1', userId: 'user-1', archived: false, deletedAt: null })
  mocks.models.researchContext.findUnique.mockResolvedValue({ id: 'context-1', projectId: 'workspace-1' })
  mocks.models.findingRevision.findMany.mockResolvedValue([{
    id: 'revision-1', projectId: 'workspace-1', findingId: 'finding-1', revision: 1, contentHash: 'revision-hash',
    conclusion: 'A limited conclusion.', researcherExplanation: 'The excerpt is narrow.', uncertainty: 'More evidence may change this.', limitations: 'One source.', conflicts: 'None identified.',
    finding: { projectId: 'workspace-1', questionId: 'question-1', currentRevision: 1, reviewState: 'reviewed', question: { wording: 'What follows?', revision: 1 } },
    reviews: [{ decision: 'retain_uncertainty' }],
    evidences: [{ id: 'evidence-1', workspaceSourceId: 'source-1', sourceFingerprint: 'source', contentFingerprint: 'content', locatorType: 'section', locatorValue: '§ 2', locatorPrecision: 'user_confirmed', workspaceSource: { source: { title: 'Synthetic source' } } }],
  }])
  mocks.models.researchArticle.create.mockResolvedValue({ id: 'article-1', inputs: [] })
  mocks.models.researchArticle.update.mockResolvedValue({ id: 'article-1', status: 'review_needed', generationStatus: 'completed' })
  drafting.configuredArticleDraft.mockResolvedValue({ content: '# Generated draft', modelVersion: 'mock-v1' })
  mocks.transaction.mockImplementation(async (callback) => callback(db))
})
describe('article route', () => {
  it('creates a separate manual outline from current reviewed findings without calling a provider', async () => {
    const response = await POST(makeReq({ path: 'manual_outline', title: 'Bounded article', findingRevisionIds: ['revision-1'] }), context)
    expect(response.status).toBe(201)
    expect(mocks.models.researchArticle.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ path: 'manual_outline', status: 'outline', content: expect.stringContaining('Write this section in your own words') }) }))
  })
  it('creates a review-needed generated draft only after server-side eligibility validation', async () => {
    const response = await POST(makeReq({ path: 'generated_draft', title: 'Generated article', findingRevisionIds: ['revision-1'] }), context)
    expect(response.status).toBe(201)
    expect(drafting.configuredArticleDraft).toHaveBeenCalledWith(expect.objectContaining({ title: 'Generated article', findings: expect.any(Array) }))
    expect(mocks.models.researchArticle.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'review_needed', generationStatus: 'completed' }) }))
  })

  it('rejects an unreviewed selected revision before article creation', async () => {
    mocks.models.findingRevision.findMany.mockResolvedValue([{ id: 'revision-1', projectId: 'workspace-1', findingId: 'finding-1', revision: 1, contentHash: 'revision-hash', conclusion: 'A limited conclusion.', researcherExplanation: 'The excerpt is narrow.', uncertainty: 'More evidence may change this.', limitations: 'One source.', conflicts: 'None identified.', finding: { projectId: 'workspace-1', questionId: 'question-1', currentRevision: 1, reviewState: 'review_needed', question: { wording: 'What follows?', revision: 1 } }, reviews: [{ decision: 'withdraw' }], evidences: [] }])
    const response = await POST(makeReq({ path: 'manual_outline', findingRevisionIds: ['revision-1'] }), context)
    expect(response.status).toBe(400)
    expect(mocks.models.researchArticle.create).not.toHaveBeenCalled()
  })
})
