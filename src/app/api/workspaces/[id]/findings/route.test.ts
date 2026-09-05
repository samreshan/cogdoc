import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const mocks = vi.hoisted(() => {
  const models = {
    project: { findFirst: vi.fn() }, researchContext: { findUnique: vi.fn() }, researchQuestion: { findFirst: vi.fn() },
    librarySource: { upsert: vi.fn(), findFirst: vi.fn(), create: vi.fn() }, workspaceSource: { upsert: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() }, questionResource: { upsert: vi.fn() },
    researchExchange: { create: vi.fn() }, researchFinding: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    findingRevision: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() }, findingEvidence: { create: vi.fn(), count: vi.fn() }, findingReview: { create: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { models, transaction: vi.fn() }
})

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/db', () => ({ db: { ...mocks.models, $transaction: mocks.transaction } }))

import { GET, POST } from './route'
import { db } from '@/lib/db'

const context = { params: Promise.resolve({ id: 'workspace-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'investigation')
  mocks.models.project.findFirst.mockResolvedValue({ id: 'workspace-1', userId: 'user-1', archived: false, deletedAt: null })
  mocks.models.researchContext.findUnique.mockResolvedValue({ id: 'context-1', projectId: 'workspace-1', selectedQuestionId: 'question-1' })
  mocks.models.researchQuestion.findFirst.mockResolvedValue({ id: 'question-1', projectId: 'workspace-1', contextId: 'context-1' })
  mocks.models.librarySource.upsert.mockResolvedValue({ id: 'library-1', title: 'Synthetic source', contentHash: 'hash' })
  mocks.models.librarySource.findFirst.mockResolvedValue(null)
  mocks.models.librarySource.create.mockResolvedValue({ id: 'library-1', title: 'Synthetic source', canonicalUrl: 'https://example.test/source' })
  mocks.models.workspaceSource.upsert.mockResolvedValue({ id: 'source-1', projectId: 'workspace-1', librarySourceId: 'library-1' })
  mocks.models.workspaceSource.findMany.mockResolvedValue([])
  mocks.models.questionResource.upsert.mockResolvedValue({ id: 'resource-1', questionId: 'question-1', workspaceSourceId: 'source-1' })
  mocks.models.auditEvent.findFirst.mockResolvedValue(null)
  mocks.models.auditEvent.create.mockResolvedValue({ id: 'audit-1' })
  mocks.transaction.mockImplementation(async (callback) => callback(db))
})

afterEach(() => vi.unstubAllEnvs())

describe('manual finding journey route', () => {
  it('returns structured findings across questions for the primary findings workspace', async () => {
    mocks.models.researchFinding.findMany.mockResolvedValue([{
      id: 'finding-2', projectId: 'workspace-1', reviewState: 'reviewed',
      question: { id: 'question-2', wording: 'What changes across questions?' },
      revisions: [{ id: 'revision-2', conclusion: 'A bounded answer.', uncertainty: 'More evidence is needed.', limitations: 'One source.', reviews: [{ decision: 'retain_uncertainty' }] }],
    }])
    const response = await GET(makeReq({}, 'http://localhost/api/workspaces/workspace-1/findings?scope=all'), context)
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.scope).toBe('all')
    expect(payload.findings[0]).toMatchObject({ id: 'finding-2', question: { id: 'question-2' }, revisions: [{ reviews: [{ decision: 'retain_uncertainty' }] }] })
    expect(mocks.models.researchFinding.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'workspace-1' } }))
  })

  it('records a researcher-supplied excerpt as a workspace resource with its provenance', async () => {
    const response = await POST(makeReq({ action: 'add_manual_excerpt', sourceTitle: 'Synthetic example', excerpt: 'This is fixture text, not research evidence.', locator: 'Example §1', locatorChecked: true }), context)
    expect(response.status).toBe(201)
    expect(mocks.models.librarySource.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ parseStatus: 'manual_excerpt' }) }))
    const metadata = JSON.parse(mocks.models.librarySource.upsert.mock.calls[0][0].create.metadataJson)
    expect(metadata).toMatchObject({ provenance: 'researcher_supplied', locator: 'Example §1', locatorChecked: true })
    expect(mocks.models.questionResource.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ projectId: 'workspace-1', questionId: 'question-1' }) }))
  })

  it('does not allow the manual journey while the feature is disabled', async () => {
    vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', '')
    const response = await POST(makeReq({ action: 'add_manual_excerpt', sourceTitle: 'Synthetic example', excerpt: 'Fixture text.' }), context)
    expect(response.status).toBe(403)
    expect(mocks.models.project.findFirst).not.toHaveBeenCalled()
  })

  it('saves a discovery record once, links it to the selected question, and keeps its rationale metadata-only', async () => {
    const response = await POST(makeReq({
      action: 'save_discovered_source', title: 'Metadata record', url: 'https://example.test/article?utm_source=ignored', doi: '10.1000/example',
      role: 'orientation', rationale: 'It names the concept in the selected question.', recordProvider: 'openalex', accessState: 'metadata_only', rationaleBasis: 'metadata',
      metadata: { authors: [], year: null },
    }), context)
    expect(response.status).toBe(201)
    expect(mocks.models.librarySource.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ canonicalUrl: 'https://example.test/article', parseStatus: 'metadata_only' }) }))
    expect(mocks.models.questionResource.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ questionId: 'question-1', role: 'orientation', rationaleBasis: 'metadata_or_abstract' }) }))
    expect(mocks.models.workspaceSource.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId_librarySourceId: { projectId: 'workspace-1', librarySourceId: 'library-1' } } }))
  })

  it('rejects non-http discovery URLs instead of saving a malicious resource', async () => {
    const response = await POST(makeReq({ action: 'save_discovered_source', title: 'Unsafe', url: 'file:///etc/passwd' }), context)
    expect(response.status).toBe(400)
    expect(mocks.models.librarySource.create).not.toHaveBeenCalled()
  })

  it('saves a video without pretending it has a transcript and validates timestamped notes', async () => {
    const invalid = await POST(makeReq({ action: 'add_video_resource', title: 'Lecture', url: 'https://video.example/watch', manualNote: 'A note', timestampRange: 'later' }), context)
    expect(invalid.status).toBe(400)
    const response = await POST(makeReq({ action: 'add_video_resource', title: 'Lecture', url: 'https://video.example/watch', manualNote: 'Researcher note', timestampRange: '01:15–02:30', transcriptAvailable: false }), context)
    expect(response.status).toBe(201)
    const metadata = JSON.parse(mocks.models.librarySource.create.mock.calls[0][0].data.metadataJson)
    expect(metadata).toMatchObject({ medium: 'video', transcriptAvailable: false, manualTimestampNote: 'Researcher note', timestampRange: '01:15–02:30', inspectedContent: false })
  })

  it('does not retain the legacy review action now that current-revision review uses its dedicated endpoint', async () => {
    mocks.models.findingRevision.findFirst.mockResolvedValue({
      id: 'revision-1', projectId: 'workspace-1', findingId: 'finding-1', revision: 1, contentHash: 'revision-hash',
      conclusion: 'The synthetic source supports a bounded conclusion.', researcherExplanation: 'I limited the conclusion to what the excerpt says.',
      uncertainty: 'The fixture is illustrative only.', limitations: 'This is one excerpt.', conflicts: 'None identified.', evidenceUnavailable: false, evidenceScope: null,
      finding: { projectId: 'workspace-1', questionId: 'question-1', currentRevision: 1, disposition: 'supported_with_limits' },
    })
    mocks.models.findingEvidence.count.mockResolvedValue(1)
    mocks.models.findingReview.create.mockResolvedValue({ id: 'review-1', decision: 'accept' })
    mocks.models.researchFinding.update.mockResolvedValue({ id: 'finding-1', reviewState: 'reviewed' })
    const response = await POST(makeReq({ action: 'review_finding', findingRevisionId: 'revision-1', decision: 'accept' }), context)
    expect(response.status).toBe(400)
    expect(mocks.models.findingReview.create).not.toHaveBeenCalled()
  })
})
