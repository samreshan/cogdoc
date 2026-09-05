import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findFirst: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/ai-service', () => ({ getAIService: vi.fn() }))

import { POST } from '@/app/api/research-kickoff/route'
import { db } from '@/lib/db'
import { getAIService } from '@/lib/ai-service'
import { fakeAI, makeReq } from '@/app/api/_test-helpers'

const findProject = db.project.findFirst as ReturnType<typeof vi.fn>
const getService = getAIService as ReturnType<typeof vi.fn>
const auditCreate = db.auditEvent.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  findProject.mockResolvedValue({ id: 'project-1' })
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  auditCreate.mockResolvedValue({ id: 'audit-1' })
  getService.mockReturnValue(fakeAI())
})

describe('POST /api/research-kickoff', () => {
  it('uses the researcher conversation to plan the structure', async () => {
    const planResearchKickoff = vi.fn(async () => ({
      title: 'A title', description: 'A description',
      outline: [
        { heading: 'Question', purpose: 'Set the question.' },
        { heading: 'Evidence', purpose: 'Check the evidence.' },
        { heading: 'Other views', purpose: 'Compare other views.' },
      ],
      questions: [],
    }))
    getService.mockReturnValue(fakeAI({ planResearchKickoff }))
    const conversation = [
      { question: 'What do you think?', answer: 'I think verification habits matter.' },
      { question: 'What else?', answer: 'It may free time for comparison.' },
    ]
    const response = await POST(makeReq({
      action: 'plan', topic: 'How generative AI affects researcher cognition', conversation,
    }))
    expect(response.status).toBe(200)
    expect(planResearchKickoff).toHaveBeenCalledWith('How generative AI affects researcher cognition', conversation)
  })

  it('falls back to a useful research plan when the assistant is unavailable', async () => {
    getService.mockReturnValue(fakeAI({ planResearchKickoff: async () => { throw new Error('provider unavailable') } }))
    const response = await POST(makeReq({ action: 'plan', topic: 'How generative AI affects researcher cognition' }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.assistantFallback).toBe(true)
    expect(body.plan.outline).toHaveLength(5)
    expect(body.plan.questions).toHaveLength(3)
  })

  it('requires substantive preliminary answers before drafting', async () => {
    const response = await POST(makeReq({
      action: 'draft', projectId: 'project-1', topic: 'Research cognition and AI',
      outline: [
        { heading: 'Context', purpose: 'Define the context' },
        { heading: 'Evidence', purpose: 'Assess the evidence' },
        { heading: 'Implications', purpose: 'Explain implications' },
      ],
      responses: [{ question: 'Why?', answer: 'Not enough detail' }],
    }))
    expect(response.status).toBe(422)
    expect(findProject).not.toHaveBeenCalled()
  })

  it('drafts from a reviewed outline and three substantive answers', async () => {
    const draftResearchKickoff = vi.fn(async () => ({
      sections: [{ heading: 'Context', content: 'Working context.' }, { heading: 'Evidence', content: 'Working evidence.' }],
      reflection: 'Does this still represent your view?', sourceNeeds: [],
    }))
    getService.mockReturnValue(fakeAI({ draftResearchKickoff }))
    const responses = [1, 2, 3].map((index) => ({
      question: `Question ${index}?`, answer: `This is my substantive answer number ${index} with enough reasoning detail included.`,
    }))
    const outline = [
      { heading: 'Context', purpose: 'Define the context' },
      { heading: 'Evidence', purpose: 'Assess the evidence' },
      { heading: 'Implications', purpose: 'Explain implications' },
    ]
    const response = await POST(makeReq({ action: 'draft', projectId: 'project-1', topic: 'Research cognition and AI', outline, responses }))
    expect(response.status).toBe(200)
    expect(draftResearchKickoff).toHaveBeenCalledWith({ topic: 'Research cognition and AI', outline, responses })
    expect(auditCreate.mock.calls[0][0].data.type).toBe('research_draft_requested')
    expect(JSON.parse(auditCreate.mock.calls[0][0].data.payloadJson).responseCount).toBe(3)
  })
})
