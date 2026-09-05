import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  const models = { project: { findFirst: vi.fn() } }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/ai-service', () => ({ getAIService: vi.fn() }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: vi.fn(async () => ({ id: 'audit-1' })) }))

import { POST } from '@/app/api/research-dialogue/route'
import { db } from '@/lib/db'
import { getAIService } from '@/lib/ai-service'
import { fakeAI, makeReq } from '@/app/api/_test-helpers'

const findProject = db.project.findFirst as ReturnType<typeof vi.fn>
const getService = getAIService as ReturnType<typeof vi.fn>

const completeAnswers = {
  focus: 'I want to understand how cognitive offloading changes long term memory.',
  evidence: 'Several studies report weaker recall when people expect information to remain digitally available.',
  tension: 'External tools may instead free working memory for deeper reasoning and more complex synthesis.',
  contribution: 'Readers should distinguish strategic tool use from unreflective dependence on generated answers.',
}

beforeEach(() => {
  vi.clearAllMocks()
  findProject.mockResolvedValue({
    id: 'project-1', userId: 'user-1', archived: false, deletedAt: null,
    document: { content: '<p>Existing research context.</p>' },
  })
})

describe('POST /api/research-dialogue', () => {
  it('requires the researcher to explain thin answers before drafting', async () => {
    const response = await POST(makeReq({
      projectId: 'project-1',
      answers: { ...completeAnswers, tension: 'There are limitations.' },
    }))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ field: 'tension', minimumWords: 4 })
    expect(getService).not.toHaveBeenCalled()
  })

  it('does not allow the legacy draft path when investigation mode is enabled', async () => {
    vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'investigation')
    const response = await POST(makeReq({ projectId: 'project-1', answers: completeAnswers }))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'forbidden_operation' })
    expect(findProject).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('drafts only after the complete research dialogue', async () => {
    const draftFromResearchDialogue = vi.fn(async () => ({
      draft: 'A provisional account of cognitive offloading.',
      reflection: 'Does this distinguish support from interpretation?',
      sourceNeeds: ['Longitudinal evidence'],
    }))
    getService.mockReturnValue(fakeAI({ draftFromResearchDialogue }))

    const response = await POST(makeReq({ projectId: 'project-1', answers: completeAnswers }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.draft).toMatch(/provisional account/)
    expect(draftFromResearchDialogue).toHaveBeenCalledWith(
      completeAnswers,
      'Existing research context.',
    )
  })
})
