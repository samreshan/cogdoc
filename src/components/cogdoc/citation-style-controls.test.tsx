// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
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
    updateWorkspace: mocks.updateWorkspace,
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
  mocks.updateWorkspace.mockResolvedValue({
    workspace: { ...workspace, citationStyle: 'apa' },
    referencesReformatted: 3,
    referencesNeedingReview: 0,
  })
})

describe('citation style controls', () => {
  it('lets the author choose a style while creating a workspace', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)
    await user.click(screen.getByRole('button', { name: /new assignment/i }))
    await user.type(screen.getByLabelText('Title'), 'Evidence assignment')
    await user.selectOptions(screen.getByLabelText('Citation style'), 'apa')
    await user.click(screen.getByRole('button', { name: 'Create workspace' }))

    await waitFor(() => expect(mocks.createWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Evidence assignment',
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
