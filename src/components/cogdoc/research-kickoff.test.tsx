// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Project } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  saveInvestigation: vi.fn(),
  getWorkspace: vi.fn(),
  planResearchKickoff: vi.fn(),
  draftResearchKickoff: vi.fn(),
}))

vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { ...original.api, ...mocks } }
})

import ResearchKickoff, { projectTitleFromTopic } from './research-kickoff'

const workspace = {
  id: 'project-1', title: 'AI', description: 'AI', archived: false,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  workspaceType: 'research', reviewPace: 'deep', citationStyle: 'harvard', lifecycleState: 'draft',
  document: { id: 'document-1', content: '', lastSaved: '2026-09-01T00:00:00.000Z', revision: 0 },
  pdfs: [], interventions: [], reviewItems: [], reviewRuns: [], reports: [], codeSnapshots: [], assets: [], certificates: [],
  _count: { pdfs: 0, interventions: 0, reviewItems: 0, codeSnapshots: 0 },
} as Project

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createWorkspace.mockResolvedValue({ workspace })
  mocks.saveInvestigation.mockResolvedValue({ context: { id: 'context-1', revision: 0 } })
  mocks.getWorkspace.mockResolvedValue({ workspace })
})

describe('research kickoff', () => {
  it('only rejects an empty topic and keeps the form usable', async () => {
    const user = userEvent.setup()
    render(<ResearchKickoff onComplete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Start writing' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add a topic')
    expect(mocks.createWorkspace).not.toHaveBeenCalled()
  })

  it('creates a durable blank document from a one-word topic', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<ResearchKickoff onComplete={onComplete} />)

    await user.type(screen.getByLabelText('What are you working on?'), 'AI')
    await user.click(screen.getByRole('button', { name: 'Start writing' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(workspace))
    expect(mocks.createWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      title: 'AI', description: 'AI', workspaceType: 'research', citationStyle: 'harvard',
    }))
    expect(mocks.saveInvestigation).toHaveBeenCalledWith('project-1', {
      topic: 'AI', purpose: '', existingUnderstanding: '',
    })
    expect(mocks.planResearchKickoff).not.toHaveBeenCalled()
    expect(mocks.draftResearchKickoff).not.toHaveBeenCalled()
  })

  it('saves optional context including an explicit unknown without making it a gate', async () => {
    const user = userEvent.setup()
    render(<ResearchKickoff onComplete={vi.fn()} />)

    await user.type(screen.getByLabelText('What are you working on?'), 'Evidence evaluation')
    await user.click(screen.getByRole('button', { name: /add goal and starting point/i }))
    await user.type(screen.getByLabelText('Goal'), 'Prepare a literature review')
    await user.type(screen.getByLabelText('What you know so far'), 'Not sure')
    await user.selectOptions(screen.getByLabelText('Citation style'), 'apa')
    await user.click(screen.getByRole('button', { name: 'Start writing' }))

    await waitFor(() => expect(mocks.saveInvestigation).toHaveBeenCalledWith('project-1', {
      topic: 'Evidence evaluation', purpose: 'Prepare a literature review', existingUnderstanding: 'Not sure',
    }))
    expect(mocks.createWorkspace).toHaveBeenCalledWith(expect.objectContaining({ citationStyle: 'apa' }))
  })

  it('opens the created document even when optional context persistence is unavailable', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    mocks.saveInvestigation.mockRejectedValueOnce(new Error('Context service unavailable'))
    render(<ResearchKickoff onComplete={onComplete} />)

    await user.type(screen.getByLabelText('What are you working on?'), 'Resilient entry')
    await user.click(screen.getByRole('button', { name: 'Start writing' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(workspace))
    expect(mocks.createWorkspace).toHaveBeenCalledTimes(1)
  })

  it('preserves user text after creation failure so retry does not require retyping', async () => {
    const user = userEvent.setup()
    mocks.createWorkspace.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<ResearchKickoff onComplete={vi.fn()} />)

    const topic = screen.getByLabelText('What are you working on?')
    await user.type(topic, 'My retained topic')
    await user.click(screen.getByRole('button', { name: 'Start writing' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(topic).toHaveValue('My retained topic')
  })

  it('derives a concise title without changing the full topic', () => {
    const longTopic = 'How should independent researchers compare several conflicting evidence sources while preserving uncertainty and provenance?'
    expect(projectTitleFromTopic(longTopic).length).toBeLessThanOrEqual(75)
    expect(projectTitleFromTopic('  Short   topic  ')).toBe('Short topic')
  })
})
