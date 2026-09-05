// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

// Vitest in this checkout currently loads an invalid shared PostCSS plugin.
// The component contract tests do not assert CSS, so provide deterministic
// class names without changing the shared build/test configuration.
vi.mock('./refined-ui.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}))

import {
  FindingDetailCard,
  FindingsStrip,
  ReasoningWorkspace,
  RefinedWorkspaceShell,
  SourcePassageReader,
} from './index'

describe('refined research collaborator UI', () => {
  it('keeps source locator precision visible and links the exact selected passage', async () => {
    const user = userEvent.setup()
    const onLinkEvidence = vi.fn()
    render(
      <SourcePassageReader
        source={{ id: 'source-1', title: 'Research source', availability: 'full_text', kind: 'Article' }}
        passage={{
          id: 'passage-1',
          content: <p>A passage supplied by the active reader.</p>,
          locator: { label: 'Page 4', precision: 'approximate', detail: 'text extraction offset' },
        }}
        onLinkEvidence={onLinkEvidence}
      />,
    )
    expect(screen.getByText('Approximate locator')).toBeVisible()
    expect(screen.getByText(/text extraction offset/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /link evidence/i }))
    expect(onLinkEvidence).toHaveBeenCalledWith('passage-1')
  })

  it('keeps researcher wording controlled and exposes contextual actions only when supplied', async () => {
    const user = userEvent.setup()
    const onExplanationChange = vi.fn()
    const onHint = vi.fn()
    const onSaveFinding = vi.fn()
    function ControlledReasoning() {
      const [explanation, setExplanation] = useState('')
      return <ReasoningWorkspace
        explanation={explanation}
        onExplanationChange={(value) => { setExplanation(value); onExplanationChange(value) }}
        onHint={onHint}
        onSaveFinding={onSaveFinding}
        contextualPrompt={{ title: 'What remains uncertain?', body: 'Compare this passage with the question.' }}
      />
    }
    render(<ControlledReasoning />)
    await user.type(screen.getByLabelText(/write what this evidence means/i), 'My tentative interpretation')
    await user.click(screen.getByRole('button', { name: /give a hint/i }))
    await user.click(screen.getByRole('button', { name: /save draft finding/i }))
    expect(onExplanationChange).toHaveBeenLastCalledWith('My tentative interpretation')
    expect(onHint).toHaveBeenCalledTimes(1)
    expect(onSaveFinding).toHaveBeenCalledTimes(1)
  })

  it('distinguishes explicit human acceptance from an article affordance', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    const onStartArticle = vi.fn()
    const finding = {
      id: 'finding-1',
      title: 'A bounded conclusion',
      questionLabel: 'What does this evidence support?',
      reviewState: 'review_needed' as const,
      conclusion: 'The evidence supports a provisional answer.',
      uncertainty: 'The source does not answer every part of the question.',
    }
    const { rerender } = render(<FindingDetailCard finding={finding} onAccept={onAccept} onStartArticle={onStartArticle} />)
    expect(screen.getByText('Review needed')).toBeVisible()
    expect(screen.queryByRole('button', { name: /use in an article/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /accept this revision/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    rerender(<FindingDetailCard finding={{ ...finding, reviewState: 'accepted' }} onStartArticle={onStartArticle} />)
    expect(screen.getByText('Accepted by researcher')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /use in an article/i }))
    expect(onStartArticle).toHaveBeenCalledTimes(1)
  })

  it('uses parent callbacks for shell navigation and finding selection', async () => {
    const user = userEvent.setup()
    const onNavigationChange = vi.fn()
    const onSelectFinding = vi.fn()
    render(
      <RefinedWorkspaceShell
        workspaceTitle="Research topic"
        navigation={[{ id: 'investigate', label: 'Investigate' }, { id: 'findings', label: 'Findings', count: 2 }]}
        activeNavigationId="investigate"
        onNavigationChange={onNavigationChange}
      >
        <FindingsStrip findings={[{ id: 'finding-1', title: 'Evidence gap', reviewState: 'uncertain' }]} onSelectFinding={onSelectFinding} />
      </RefinedWorkspaceShell>,
    )
    await user.click(screen.getByRole('button', { name: /findings 2/i }))
    await user.click(screen.getByRole('button', { name: /evidence gap/i }))
    expect(onNavigationChange).toHaveBeenCalledWith('findings')
    expect(onSelectFinding).toHaveBeenCalledWith('finding-1')
  })
})
