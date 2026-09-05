import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  noteCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  evaluate: vi.fn(),
  restructure: vi.fn(),
  appendAuditEvent: vi.fn(),
}))

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/ai-service', () => ({ getAIService: () => ({ evaluateInterventionAnswer: mocks.evaluate, restructureFromIntervention: mocks.restructure }) }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: mocks.appendAuditEvent }))
vi.mock('@/lib/db', () => ({ db: {
  intervention: { findFirst: mocks.findFirst, update: mocks.update, updateMany: mocks.updateMany },
  researchNote: { create: mocks.noteCreate },
  auditEvent: { create: mocks.auditCreate },
  $transaction: mocks.transaction,
} }))

import { POST } from './route'
import { db } from '@/lib/db'

const intervention = {
  id: 'intervention-1', userId: 'user-1', projectId: 'project-1', status: 'active',
  engineType: 'citation', promptText: 'The highlighted claim.', responseText: 'What supports it?',
  evidences: [{
    citedExcerpt: 'A supporting passage.',
    chunk: { id: 'chunk-1', content: 'A supporting passage.', pageApprox: 3, pdf: { filename: 'paper.pdf' } },
  }],
}

const updated = { ...intervention, evidences: [{
  id: 'evidence-1', similarityScore: 0.9, citedExcerpt: 'A supporting passage.',
  chunk: { pageApprox: 3, pdf: { filename: 'paper.pdf' } },
}] }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue(intervention)
  mocks.update.mockResolvedValue(updated)
  mocks.updateMany.mockResolvedValue({ count: 0 })
  mocks.noteCreate.mockResolvedValue({ id: 'note-1' })
  mocks.auditCreate.mockResolvedValue({ id: 'audit-1' })
  mocks.transaction.mockImplementation(async (callback) => callback(db))
  mocks.appendAuditEvent.mockResolvedValue({ id: 'audit-1' })
  mocks.restructure.mockResolvedValue('The highlighted claim is supported within a bounded scope.')
})

const context = { params: Promise.resolve({ id: 'intervention-1' }) }

describe('POST /api/interventions/[id]/responses', () => {
  it('keeps an intervention active and persists the follow-up when the answer is insufficient', async () => {
    mocks.evaluate.mockResolvedValue({ satisfied: false, rationale: 'Needs evidence.', followUpQuestion: 'Which passage supports it?' })
    const response = await POST(makeReq({ answer: 'I believe this is correct.' }), context)
    expect(response.status).toBe(200)
    expect((await response.json()).satisfied).toBe(false)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'active', responseText: 'Which passage supports it?' }) }))
    expect(mocks.noteCreate).not.toHaveBeenCalled()
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      type: 'intervention_answer_followup', actor: 'student',
    }))
  })

  it('resolves a satisfied intervention and creates a structured notebook record', async () => {
    mocks.evaluate.mockResolvedValue({ satisfied: true, rationale: 'Specific and grounded.', followUpQuestion: null })
    const response = await POST(makeReq({ answer: 'The passage supports the bounded part of the claim, but not the interface evaluation.' }), context)
    const body = await response.json()
    expect(body.satisfied).toBe(true)
    expect(body.revisionProposal).toMatch(/bounded scope/)
    expect(body.structuredLines.map((line: { label: string }) => line.label)).toEqual([
      'Claim under review', 'Researcher reasoning', 'Evaluation', 'Supporting passages',
    ])
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'resolved' }) }))
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ promptText: 'The highlighted claim.', status: 'active' }),
      data: expect.objectContaining({ status: 'resolved' }),
    }))
    expect(mocks.noteCreate.mock.calls[0][0].data.body).toContain('Researcher reasoning:')
    expect(mocks.noteCreate.mock.calls[0][0].data.body).toContain('paper.pdf, p.3')
    expect(mocks.restructure).toHaveBeenCalledWith(expect.objectContaining({
      passage: 'The highlighted claim.',
      answer: expect.stringContaining('passage supports'),
    }))
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      type: 'intervention_answer_satisfied', actor: 'student',
    }))
  })

  it('does not expose interventions outside the authenticated user', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const response = await POST(makeReq({ answer: 'A sufficiently long answer.' }), context)
    expect(response.status).toBe(404)
  })
})
