import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const mocks = vi.hoisted(() => {
  const models = {
    project: { findFirst: vi.fn() }, researchQuestion: { findFirst: vi.fn() },
    workspaceSource: { findMany: vi.fn() }, pdfChunk: { findFirst: vi.fn() },
    researchExchange: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  }
  return { models, transaction: vi.fn(), collaborate: vi.fn(), appendAuditEvent: vi.fn() }
})

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'researcher-1') }))
vi.mock('@/lib/db', () => ({ db: { ...mocks.models, $transaction: mocks.transaction } }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: mocks.appendAuditEvent }))
vi.mock('@/lib/ai-service', () => ({
  getAIService: () => ({ collaborateOnDocument: mocks.collaborate }),
  publicAIConfiguration: () => ({ provider: 'gemini', model: 'configured-model', configured: true, local: false, status: 'configured', message: 'Configured.' }),
}))

import { GET, POST } from './route'
import { db } from '@/lib/db'

const routeContext = { params: Promise.resolve({ id: 'workspace-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'article')
  mocks.models.project.findFirst.mockResolvedValue({ id: 'workspace-1', userId: 'researcher-1', title: 'Library access', description: null, archived: false, deletedAt: null, researchContext: { topic: 'Library access' } })
  mocks.models.researchQuestion.findFirst.mockResolvedValue(null)
  mocks.models.workspaceSource.findMany.mockResolvedValue([])
  mocks.models.researchExchange.findFirst.mockResolvedValue(null)
  mocks.models.researchExchange.findMany.mockResolvedValue([])
  let index = 0
  mocks.models.researchExchange.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...data, id: `exchange-${++index}`, createdAt: new Date(`2026-09-05T00:00:0${index}.000Z`),
  }))
  mocks.transaction.mockImplementation(async (callback) => callback(db))
})

describe('document collaborator route', () => {
  it('persists a topic-level conversation without fabricating an investigation question', async () => {
    mocks.collaborate.mockResolvedValue({ answer: 'Longer hours may help some students, but access and schedules determine who benefits.', nextStep: 'Define which students and study outcome matter.', hypothetical: false, modelVersion: 'configured-document-collaborator' })
    const response = await POST(makeReq({
      message: 'How should I frame this question?', intent: 'ask', requestId: 'request-1',
      context: { activeQuestion: null, selection: null, sources: [] },
    }), routeContext)
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(mocks.models.researchQuestion.findFirst).not.toHaveBeenCalled()
    expect(mocks.models.researchExchange.create.mock.calls[0][0].data).toMatchObject({ speaker: 'researcher', questionId: null, body: 'How should I frame this question?' })
    expect(mocks.collaborate).toHaveBeenCalledWith(expect.objectContaining({ question: undefined, sources: [] }))
    expect(payload.assistantTurn.content).toContain('Longer hours')
    expect(payload.assistantTurn.providerStatus).toBe('configured')
  })

  it('saves the exact request before a provider failure and records an honest unavailable turn', async () => {
    mocks.collaborate.mockRejectedValue(new Error('provider unavailable'))
    const response = await POST(makeReq({
      message: 'Explain the part I selected.', intent: 'explain', requestId: 'request-2',
      context: { activeQuestion: null, selection: null, sources: [] },
    }), routeContext)
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(mocks.models.researchExchange.create.mock.calls[0][0].data.body).toBe('Explain the part I selected.')
    expect(payload.assistantTurn.providerStatus).toBe('unavailable')
    expect(payload.assistantTurn.content).toContain('cannot provide a trustworthy explanation')
  })

  it('returns both speakers in stable persisted order', async () => {
    mocks.models.researchExchange.findMany.mockResolvedValue([
      { id: 'one', speaker: 'researcher', body: 'First question', operation: 'document_collaborator:researcher:ask', modelVersion: null, referencedIdsJson: '[]', questionId: null, createdAt: new Date('2026-09-05T00:00:00Z') },
      { id: 'two', speaker: 'assistant', body: JSON.stringify({ content: 'First answer', intent: 'ask', providerStatus: 'configured', nextStep: null, hypothetical: false, context: { sourceIds: [] } }), operation: 'document_collaborator:assistant:ask', modelVersion: 'model', referencedIdsJson: '[]', questionId: null, createdAt: new Date('2026-09-05T00:00:01Z') },
    ])
    const response = await GET(new Request('http://localhost/api/workspaces/workspace-1/collaborator') as never, routeContext)
    const payload = await response.json()
    expect(payload.turns.map((turn: { role: string }) => turn.role)).toEqual(['researcher', 'assistant'])
    expect(payload.turns[1].content).toBe('First answer')
  })

  it('rejects a selection whose text fingerprint does not match its exact text', async () => {
    const response = await POST(makeReq({
      message: 'Revise this.', intent: 'revise_selection', requestId: 'request-3',
      context: { activeQuestion: null, sources: [], selection: {
        projectId: 'workspace-1', documentId: 'document-1', documentRevision: 2,
        from: 1, to: 5, exactText: 'Real text', textFingerprint: 'wrong',
        selectionId: 'workspace-1:document-1:2:1:5:wrong',
      } },
    }), routeContext)
    expect(response.status).toBe(409)
    expect(mocks.models.researchExchange.create).not.toHaveBeenCalled()
  })
})
