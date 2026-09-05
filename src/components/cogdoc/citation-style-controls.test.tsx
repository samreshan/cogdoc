// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  saveInvestigation: vi.fn(),
  updateWorkspace: vi.fn(),
  planResearchKickoff: vi.fn(),
  draftResearchKickoff: vi.fn(),
  findSources: vi.fn(),
  addReference: vi.fn(),
  verifyReference: vi.fn(),
  saveDocument: vi.fn(),
  recordDecision: vi.fn(),
  setView: vi.fn(),
  setActiveProject: vi.fn(),
  workspace: {
    id: 'workspace-1', title: 'Learning study', description: null, archived: false,
    createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
    workspaceType: 'research' as const, reviewPace: 'deep' as const, citationStyle: 'harvard' as const,
    lifecycleState: 'draft' as const, dueAt: null, briefText: null,
    document: { id: 'document-1', content: '', lastSaved: '2026-08-28T00:00:00.000Z', revision: 0 },
    pdfs: [], interventions: [], reviewItems: [], reviewRuns: [], reports: [], codeSnapshots: [], assets: [], certificates: [],
    _count: { pdfs: 0, interventions: 0, reviewItems: 0, codeSnapshots: 0 },
  },
}))

const workspace = mocks.workspace

vi.mock('@/lib/api-client', () => ({
  api: {
    listWorkspaces: mocks.listWorkspaces,
    createWorkspace: mocks.createWorkspace,
    getWorkspace: mocks.getWorkspace,
    saveInvestigation: mocks.saveInvestigation,
    updateWorkspace: mocks.updateWorkspace,
    planResearchKickoff: mocks.planResearchKickoff,
    draftResearchKickoff: mocks.draftResearchKickoff,
    findSources: mocks.findSources,
    addReference: mocks.addReference,
    verifyReference: mocks.verifyReference,
    saveDocument: mocks.saveDocument,
    recordDecision: mocks.recordDecision,
  },
}))
vi.mock('@/lib/store', () => ({
  useCogdoc: (selector: (state: Record<string, unknown>) => unknown) => selector({
    activeProject: mocks.workspace,
    setView: mocks.setView,
    setActiveProject: mocks.setActiveProject,
  }),
}))

import Dashboard from '@/components/cogdoc/dashboard'
import WorkspaceHome from '@/components/cogdoc/workspace-home'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listWorkspaces.mockResolvedValue({ workspaces: [] })
  mocks.createWorkspace.mockResolvedValue({ workspace })
  mocks.getWorkspace.mockResolvedValue({ workspace })
  mocks.saveInvestigation.mockResolvedValue({ context: { id: 'context-1', revision: 0 } })
  mocks.updateWorkspace.mockResolvedValue({
    workspace: { ...workspace, citationStyle: 'apa' },
    referencesReformatted: 3,
    referencesNeedingReview: 0,
  })
  mocks.planResearchKickoff.mockResolvedValue({
    assistantFallback: false,
    plan: {
      title: 'Evidence synthesis', description: 'Study how researchers evaluate evidence.',
      outline: [
        { heading: 'Context', purpose: 'Define the research context.' },
        { heading: 'Evidence', purpose: 'Assess relevant findings.' },
        { heading: 'Limits', purpose: 'Test alternative explanations.' },
      ],
      questions: [1, 2, 3].map((index) => ({ id: `q${index}`, question: `Research question ${index}?`, why: 'Make the reasoning explicit.' })),
    },
  })
  mocks.draftResearchKickoff.mockResolvedValue({ draft: {
    sections: [{ heading: 'Context', content: 'Working context.' }, { heading: 'Evidence', content: 'Working evidence.' }],
    reflection: 'Does this match?', sourceNeeds: [],
  } })
  mocks.findSources.mockResolvedValue({ sources: [] })
  mocks.saveDocument.mockResolvedValue({ ok: true, lastSaved: 'now', revision: 1 })
  mocks.recordDecision.mockResolvedValue({ event: { id: 'audit-1' } })
})

describe('citation style controls', () => {
  it('lets the author choose a style while creating a workspace', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)
    await user.type(screen.getByLabelText('What are you working on?'), 'How do researchers evaluate evidence when using generative AI?')
    await user.click(screen.getByRole('button', { name: /add goal and starting point/i }))
    await user.selectOptions(screen.getByLabelText('Citation style'), 'apa')
    await user.click(screen.getByRole('button', { name: /start writing/i }))

    await waitFor(() => expect(mocks.createWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      workspaceType: 'research',
      citationStyle: 'apa',
    })))
  })

  it('exposes the current style in workspace settings and persists a change', async () => {
    const user = userEvent.setup()
    render(<WorkspaceHome />)
    const trigger = await screen.findByRole('combobox', { name: 'Citation style' })
    expect(trigger).toHaveTextContent('Harvard')
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'APA 7th edition' }))

    await waitFor(() => expect(mocks.updateWorkspace).toHaveBeenCalledWith(
      'workspace-1',
      { citationStyle: 'apa' },
    ))
  })
})
