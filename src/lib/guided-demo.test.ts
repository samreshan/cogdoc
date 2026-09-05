import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/lib/types'
import { createOrResumeGuidedDemo, GUIDED_DEMO_MARKER, GUIDED_DEMO_QUESTIONS } from './guided-demo'

const emptyWorkspace = { id: 'demo-1', title: 'Demo', description: GUIDED_DEMO_MARKER, document: { id: 'doc-1', content: '', revision: 0 } } as Project
const filledWorkspace = { ...emptyWorkspace, document: { ...emptyWorkspace.document!, content: '{"type":"doc","content":[{"type":"paragraph"}]}' } } as Project

describe('guided demo initialization', () => {
  let apiClient: Record<string, ReturnType<typeof vi.fn>>
  beforeEach(() => {
    apiClient = {
      createWorkspace: vi.fn().mockResolvedValue({ workspace: emptyWorkspace }),
      getWorkspace: vi.fn().mockResolvedValue({ workspace: filledWorkspace }),
      getInvestigation: vi.fn().mockRejectedValue(new Error('not initialized')),
      saveInvestigation: vi.fn().mockResolvedValue({ context: { selectedQuestionId: null } }),
      createResearchQuestion: vi.fn(), updateResearchQuestion: vi.fn().mockResolvedValue({}),
      saveDocument: vi.fn().mockResolvedValue({}), saveWorkspaceSource: vi.fn().mockResolvedValue({}),
    }
    GUIDED_DEMO_QUESTIONS.forEach((fixture, index) => apiClient.createResearchQuestion.mockResolvedValueOnce({ question: { id: `question-${index + 1}`, ...fixture } }))
  })

  it('creates an isolated prefilled project without accepting a finding or faking an AI call', async () => {
    const result = await createOrResumeGuidedDemo({ workspaces: [], apiClient: apiClient as never })
    expect(result.resumed).toBe(false)
    expect(apiClient.createWorkspace).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining(GUIDED_DEMO_MARKER) }))
    expect(apiClient.createResearchQuestion).toHaveBeenCalledTimes(3)
    expect(apiClient.saveDocument).toHaveBeenCalledWith('demo-1', expect.stringContaining('DEMONSTRATION MATERIAL'), 0)
    expect(apiClient.saveWorkspaceSource).toHaveBeenCalledTimes(3)
    expect(apiClient.saveWorkspaceSource.mock.calls[0][1].metadata).toMatchObject({ accessState: 'metadata_only', inspectedContent: false })
  })

  it('resumes a marked demo and never overwrites its existing document', async () => {
    apiClient.getInvestigation.mockResolvedValue({ context: { selectedQuestionId: 'question-1' }, questions: GUIDED_DEMO_QUESTIONS.map((fixture, index) => ({ id: `question-${index + 1}`, ...fixture })) })
    apiClient.getWorkspace.mockResolvedValue({ workspace: filledWorkspace })
    const result = await createOrResumeGuidedDemo({ workspaces: [filledWorkspace], apiClient: apiClient as never })
    expect(result.resumed).toBe(true)
    expect(apiClient.createWorkspace).not.toHaveBeenCalled()
    expect(apiClient.createResearchQuestion).not.toHaveBeenCalled()
    expect(apiClient.saveDocument).not.toHaveBeenCalled()
  })

  it('creates a separate copy when a safe reset is requested', async () => {
    await createOrResumeGuidedDemo({ workspaces: [filledWorkspace], apiClient: apiClient as never, forceNew: true })
    expect(apiClient.createWorkspace).toHaveBeenCalledTimes(1)
    expect(apiClient.getWorkspace).toHaveBeenCalledWith('demo-1')
  })
})
