import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/db', () => ({ db: {
  project: { findFirst: vi.fn() },
  pdfChunk: { findMany: vi.fn() },
  workspaceSource: { findMany: vi.fn() },
} }))
vi.mock('@/lib/retrieval', () => ({ retrieveTopK: vi.fn() }))
vi.mock('@/lib/ai-gateway', () => ({ isVectorRetrievalEnabled: vi.fn(), retrieveVectorChunks: vi.fn() }))
vi.mock('@/lib/ai-service', () => ({ getAIService: vi.fn() }))

import { POST } from './route'
import { db } from '@/lib/db'
import { retrieveTopK } from '@/lib/retrieval'
import { isVectorRetrievalEnabled } from '@/lib/ai-gateway'
import { getAIService } from '@/lib/ai-service'
import { makeReq } from '@/app/api/_test-helpers'

const project = db.project.findFirst as ReturnType<typeof vi.fn>
const chunks = db.pdfChunk.findMany as ReturnType<typeof vi.fn>
const workspaceSources = db.workspaceSource.findMany as ReturnType<typeof vi.fn>
const retrieve = retrieveTopK as ReturnType<typeof vi.fn>
const vectorEnabled = isVectorRetrievalEnabled as ReturnType<typeof vi.fn>
const service = getAIService as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  project.mockResolvedValue({ id: 'project-1' })
  vectorEnabled.mockReturnValue(false)
  retrieve.mockResolvedValue([{ chunkId: 'chunk-1', content: 'Spacing improves retention.', similarityScore: 0.4, pageApprox: 3, pdfFilename: 'learning.pdf' }])
  chunks.mockResolvedValue([{ id: 'chunk-1', pdfId: 'pdf-1', pdf: { filename: 'learning.pdf', librarySourceId: 'library-1', references: [{ id: 'ref-1' }] } }])
  workspaceSources.mockResolvedValue([{ id: 'workspace-source-1', librarySourceId: 'library-1' }])
  service.mockReturnValue({ answerFromEvidence: vi.fn(async () => ({ answer: 'Spacing improves retention.', passageIds: ['chunk-1'], confidence: 'high', followUpQuestion: null })) })
})

describe('POST source map', () => {
  it('returns a project-owned, passage-grounded local answer', async () => {
    const response = await POST(makeReq({ question: 'What improves retention?' }), { params: Promise.resolve({ id: 'project-1' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.answer.passageIds).toEqual(['chunk-1'])
    expect(body.passages[0]).toMatchObject({ workspaceSourceId: 'workspace-source-1', referenceId: 'ref-1', matchType: 'exact' })
    expect(body.needsWebSearch).toBe(false)
  })

  it('recommends explicit web discovery when local retrieval is empty', async () => {
    retrieve.mockResolvedValue([])
    chunks.mockResolvedValue([])
    const response = await POST(makeReq({ question: 'What is missing locally?' }), { params: Promise.resolve({ id: 'project-1' }) })
    const body = await response.json()
    expect(body.answer).toBeNull()
    expect(body.needsWebSearch).toBe(true)
  })
})
