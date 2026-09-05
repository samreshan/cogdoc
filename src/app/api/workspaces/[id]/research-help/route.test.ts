import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const mocks = vi.hoisted(() => {
  const models = {
    project: { findFirst: vi.fn() }, researchContext: { findUnique: vi.fn() }, researchQuestion: { findFirst: vi.fn() }, pdfChunk: { findFirst: vi.fn() },
    researchExchange: { findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() }, auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  const provideContextualHelp = vi.fn()
  return { models, transaction: vi.fn(), provideContextualHelp }
})

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'researcher-1') }))
vi.mock('@/lib/db', () => ({ db: { ...mocks.models, $transaction: mocks.transaction } }))
vi.mock('@/lib/ai-service', () => ({ getAIService: () => ({ provideContextualHelp: mocks.provideContextualHelp }) }))

import { POST } from './route'
import { db } from '@/lib/db'

const context = { params: Promise.resolve({ id: 'workspace-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'investigation')
  mocks.models.project.findFirst.mockResolvedValue({ id: 'workspace-1', userId: 'researcher-1', archived: false, deletedAt: null })
  mocks.models.researchContext.findUnique.mockResolvedValue({ id: 'context-1', projectId: 'workspace-1', selectedQuestionId: 'question-1' })
  mocks.models.researchQuestion.findFirst.mockResolvedValue({ id: 'question-1', projectId: 'workspace-1', contextId: 'context-1', wording: 'What follows from the supplied excerpt?' })
  mocks.models.researchExchange.findFirst.mockResolvedValue(null)
  mocks.models.researchExchange.create.mockResolvedValue({ id: 'exchange-1' })
  mocks.models.auditEvent.findFirst.mockResolvedValue(null)
  mocks.models.auditEvent.create.mockResolvedValue({ id: 'audit-1' })
  mocks.transaction.mockImplementation(async (callback) => callback(db))
})

describe('contextual research help route', () => {
  it('persists researcher wording first and sends the configured provider the exact requested non-Socratic action', async () => {
    mocks.provideContextualHelp.mockResolvedValue({ body: 'Compare the wording with one possible alternative.', action: 'Name the alternative you would test.', modelVersion: 'configured-contextual-provider' })
    const response = await POST(makeReq({ questionId: 'question-1', explanation: 'The report suggests an association, but I am unsure about other causes.', kind: 'alternative', requested: true }), context)
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(mocks.models.researchExchange.create.mock.calls[0][0].data).toMatchObject({ speaker: 'researcher', origin: 'researcher' })
    expect(mocks.provideContextualHelp).toHaveBeenCalledWith(expect.objectContaining({ action: 'alternative' }))
    expect(payload.providerStatus).toBe('configured')
    expect(payload.help.body).toContain('possible alternative')
  })

  it('labels a provider outage as deterministic fallback without blocking saved human work', async () => {
    mocks.provideContextualHelp.mockRejectedValue(new Error('provider unavailable'))
    const response = await POST(makeReq({ questionId: 'question-1', explanation: 'I think the evidence is limited.', kind: 'hint', requested: true }), context)
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.providerStatus).toBe('deterministic_fallback')
    expect(payload.help.basis).not.toContain('configured assistant')
    expect(mocks.models.researchExchange.create).toHaveBeenCalled()
  })

  it('suppresses an unchanged automatic concern after a dismissal while leaving explicit requests available', async () => {
    mocks.models.researchExchange.findFirst.mockResolvedValue({ id: 'dismissal-1' })
    const response = await POST(makeReq({ questionId: 'question-1', explanation: 'I think the evidence is limited.', kind: 'help', requested: false }), context)
    expect(response.status).toBe(200)
    expect((await response.json()).suppressed).toBe(true)
    expect(mocks.provideContextualHelp).not.toHaveBeenCalled()
  })
})
