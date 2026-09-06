// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn() }))
vi.mock('@/lib/document-collaborator-client', () => ({
  loadDocumentCollaborator: mocks.load,
  sendDocumentCollaboratorMessage: mocks.send,
}))
vi.mock('@/components/cogdoc/investigation-plan-panel', () => ({ default: () => <div>Plan panel</div> }))
vi.mock('@/components/cogdoc/manual-finding-panel', () => ({ default: () => <div>Finding editor</div> }))
vi.mock('@/components/cogdoc/findings-workspace', () => ({ default: () => <div>Finding list</div> }))
vi.mock('@/components/cogdoc/article-workspace', () => ({ ArticleWorkspace: () => <div>Article workspace</div> }))

import { DocumentResearchDock } from '@/components/cogdoc/document-research-dock'
import { INITIAL_INTERACTIVE_DEMO_STATE } from '@/lib/interactive-demo'

const selection = {
  projectId: 'project-1', documentId: 'document-1', documentRevision: 2, from: 1, to: 12,
  exactText: 'chosen text', textFingerprint: 'fingerprint', selectionId: 'project-1:document-1:2:1:12:fingerprint',
}

beforeEach(() => {
  vi.clearAllMocks()
  const storage = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  } })
  window.localStorage.clear()
  mocks.load.mockResolvedValue({ turns: [], assistant: { provider: 'gemini', model: 'test-model', configured: true, local: false, status: 'configured', message: 'Configured.' } })
  mocks.send.mockResolvedValue({
    researcherTurn: { id: 'human', role: 'researcher', content: 'Explain this', createdAt: new Date().toISOString(), context: { sourceIds: [] } },
    assistantTurn: { id: 'assistant', role: 'assistant', content: 'A direct explanation.', createdAt: new Date().toISOString(), context: { sourceIds: [] }, providerStatus: 'configured' },
    assistant: { provider: 'gemini', model: 'test-model', configured: true, local: false, status: 'configured', message: 'Configured.' },
  })
})

describe('DocumentResearchDock', () => {
  it('shows and removes explicit context before sending a free-form message', async () => {
    const user = userEvent.setup()
    render(<DocumentResearchDock projectId="project-1" projectTitle="Access study" documentSelection={selection} selectedQuestion={{ id: 'question-1', wording: 'Who benefits?', revision: 0 }} selectedSources={[]} onRequestPreview={vi.fn()} onApplyProposal={vi.fn()} onOpenSource={vi.fn()} onFocusDocument={vi.fn()} />)
    expect(await screen.findByText('Work through the next part')).toBeInTheDocument()
    expect(screen.getByText(/Question: Who benefits/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Remove Question:/ }))
    await user.type(screen.getByLabelText('Message the research collaborator'), 'Explain this')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(mocks.send).toHaveBeenCalled())
    expect(mocks.send.mock.calls[0][1].context.activeQuestion).toBeNull()
    expect(await screen.findByText('A direct explanation.')).toBeInTheDocument()
  })

  it('keeps the document-return action available on every dock surface', async () => {
    const onFocusDocument = vi.fn()
    const user = userEvent.setup()
    render(<DocumentResearchDock projectId="project-1" onRequestPreview={vi.fn()} onApplyProposal={vi.fn()} onOpenSource={vi.fn()} onFocusDocument={onFocusDocument} />)
    await user.click(screen.getByRole('tab', { name: 'Plan' }))
    expect(screen.getByText('Plan panel')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close research tools' }))
    expect(onFocusDocument).toHaveBeenCalled()
  })

  it('follows a controlled rail section without remounting the dock', async () => {
    const stableProps = { projectId: 'project-1', onRequestPreview: vi.fn(), onApplyProposal: vi.fn(), onOpenSource: vi.fn(), onFocusDocument: vi.fn() }
    const { rerender } = render(<DocumentResearchDock {...stableProps} activeSection="collaborator" />)
    expect(await screen.findByText('Work through the next part')).toBeInTheDocument()
    rerender(<DocumentResearchDock {...stableProps} activeSection="plan" />)
    expect(screen.getByText('Plan panel')).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledTimes(1)
  })

  it('uses deterministic demo content without loading the live collaborator', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<DocumentResearchDock projectId="cogdoc-interactive-demo-v3" activeSection="collaborator" onRequestPreview={vi.fn()} onApplyProposal={vi.fn()} onOpenSource={vi.fn()} onFocusDocument={vi.fn()} interactiveDemo={{ state: INITIAL_INTERACTIVE_DEMO_STATE, onAction }} />)
    expect(screen.getByText('Every response below is deterministic sample material.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ask sample question' }))
    expect(onAction).toHaveBeenCalledWith('collaborator-asked')
    expect(mocks.load).not.toHaveBeenCalled()
  })
})
