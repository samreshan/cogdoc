/**
 * Integration tests for POST /api/citation-sentinel
 *
 * The most complex route: RAG retrieval → claim verification → nested-evidence
 * persistence. Mocks @/lib/retrieval (retrieveTopK), @/lib/ai-service, db, auth.
 *
 * This is the contract the pgvector migration (Sprint 1) must preserve: same
 * RetrievedChunk[] shape in, same verdict taxonomy + nested evidence write out.
 *
 * Maps to PRODUCT.md §15.3 (I-01, I-02, I-03).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    project: { findUnique: vi.fn() },
    intervention: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))
vi.mock('@/lib/ai-service', () => ({ getAIService: vi.fn() }))
// Mock retrieval so we control the "retrieved chunks" without DB coupling.
vi.mock('@/lib/retrieval', () => ({
  retrieveTopK: vi.fn(),
}))

import { POST } from '@/app/api/citation-sentinel/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'
import { getAIService } from '@/lib/ai-service'
import { retrieveTopK } from '@/lib/retrieval'
import { makeReq, fakeAI, DEFAULT_USER, DEFAULT_PROJECT } from '@/app/api/_test-helpers'
import type { RetrievedChunk } from '@/lib/retrieval'

const findProject = db.project.findUnique as ReturnType<typeof vi.fn>
const createIntervention = db.intervention.create as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>
const getService = getAIService as ReturnType<typeof vi.fn>
const retrieve = retrieveTopK as ReturnType<typeof vi.fn>

beforeEach(() => {
  findProject.mockReset(); createIntervention.mockReset(); getUser.mockReset(); getService.mockReset(); retrieve.mockReset()
  getUser.mockResolvedValue(DEFAULT_USER)
  findProject.mockResolvedValue(DEFAULT_PROJECT)
})

const CHUNKS: RetrievedChunk[] = [
  { chunkId: 'c1', content: 'The study found a significant effect.', similarityScore: 0.8, pageApprox: 3, pdfFilename: 'a.pdf' },
  { chunkId: 'c2', content: 'The control group showed no change.', similarityScore: 0.5, pageApprox: 7, pdfFilename: 'a.pdf' },
]

describe('POST /api/citation-sentinel — validation', () => {
  it('returns 400 when projectId or claim is missing', async () => {
    expect((await POST(makeReq({ claim: 'x' }))).status).toBe(400)
    expect((await POST(makeReq({ projectId: 'p1' }))).status).toBe(400)
  })

  it('returns 404 when the project does not exist', async () => {
    findProject.mockResolvedValue(null)
    getService.mockReturnValue(fakeAI())
    expect((await POST(makeReq({ projectId: 'nope', claim: 'a claim' }))).status).toBe(404)
  })
})

describe('POST /api/citation-sentinel — supported claim', () => {
  it('retrieves, verifies as supported, and persists intervention + nested evidence', async () => {
    retrieve.mockResolvedValue(CHUNKS)
    getService.mockReturnValue(
      fakeAI({
        verifyClaim: async () => ({
          verdict: 'supported' as const,
          explanation: 'Source [1] directly supports this.',
          supported_claims: ['the effect is significant'],
          unsupported_claims: [],
        }),
      }),
    )
    // The route includes evidences in the create result; return a matching shape.
    createIntervention.mockResolvedValue({
      id: 'iv-1',
      engineType: 'citation',
      verdict: 'supported',
      evidences: [
        { id: 'ev-1', similarityScore: 0.8, citedExcerpt: 'The study found', chunk: { pageApprox: 3, pdf: { filename: 'a.pdf' } } },
        { id: 'ev-2', similarityScore: 0.5, citedExcerpt: 'The control', chunk: { pageApprox: 7, pdf: { filename: 'a.pdf' } } },
      ],
    })

    const res = await POST(makeReq({ projectId: 'proj-1', claim: 'The effect is significant.', paragraphId: 'p1' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    // verdict flows through
    expect(body.verdict).toBe('supported')
    expect(body.explanation).toBe('Source [1] directly supports this.')

    // evidence array shape
    expect(body.evidence).toHaveLength(2)
    expect(body.evidence[0].chunkId).toBe('c1')
    expect(body.evidence[0].pdfFilename).toBe('a.pdf')
    expect(body.evidence[0].evidenceId).toBe('ev-1')

    // retrieve was called with the right args
    expect(retrieve).toHaveBeenCalledWith('proj-1', 'The effect is significant.', 5, 0.05)

    // nested evidence write shape
    const created = createIntervention.mock.calls[0][0].data
    expect(created.engineType).toBe('citation')
    expect(created.promptTemplateTag).toBe('Lens')
    expect(created.verdict).toBe('supported')
    expect(created.evidences.create).toHaveLength(2)
    expect(created.evidences.create[0]).toMatchObject({ chunkId: 'c1', similarityScore: 0.8 })
    // citedExcerpt is sliced to 500 chars
    expect(created.evidences.create[0].citedExcerpt.length).toBeLessThanOrEqual(500)
  })
})

describe('POST /api/citation-sentinel — unsupported claim', () => {
  it('returns an unsupported verdict with no supporting evidence', async () => {
    retrieve.mockResolvedValue([])
    getService.mockReturnValue(
      fakeAI({
        verifyClaim: async () => ({
          verdict: 'insufficient_evidence' as const,
          explanation: 'No relevant evidence found.',
          supported_claims: [],
          unsupported_claims: ['the claim'],
        }),
      }),
    )
    createIntervention.mockResolvedValue({ id: 'iv-2', evidences: [] })

    const res = await POST(makeReq({ projectId: 'proj-1', claim: 'an ungrounded claim' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.verdict).toBe('insufficient_evidence')
    expect(body.evidence).toEqual([])
    // persisted verdict reflects the model output
    expect(createIntervention.mock.calls[0][0].data.verdict).toBe('insufficient_evidence')
  })
})
