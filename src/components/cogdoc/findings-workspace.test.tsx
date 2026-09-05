// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({ updateResearchQuestion: vi.fn(async () => ({})) }))
vi.mock('@/lib/api-client', () => ({ api: { updateResearchQuestion: mocks.updateResearchQuestion } }))

import FindingsWorkspace from './findings-workspace'

beforeEach(() => {
  mocks.updateResearchQuestion.mockClear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ findings: [{
    id: 'finding-1', reviewState: 'reviewed', question: { id: 'question-2', wording: 'How does the second question change the result?' },
    revisions: [{ id: 'revision-1', conclusion: 'The answer remains qualified.', uncertainty: 'One population was studied.', limitations: 'The sample is narrow.', reviews: [{ decision: 'retain_uncertainty' }] }],
  }] }), { status: 200, headers: { 'content-type': 'application/json' } })))
})

describe('FindingsWorkspace', () => {
  it('shows project-wide question provenance and retained uncertainty, then selects the finding question', async () => {
    const user = userEvent.setup()
    const onOpenFinding = vi.fn()
    render(<FindingsWorkspace projectId="workspace-1" onOpenFinding={onOpenFinding} />)
    expect(await screen.findByText('The answer remains qualified.')).toBeVisible()
    expect(screen.getByText('Addresses: How does the second question change the result?')).toBeVisible()
    expect(screen.getByText('Uncertainty retained')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /open question and finding/i }))
    expect(mocks.updateResearchQuestion).toHaveBeenCalledWith('workspace-1', { action: 'select', questionId: 'question-2' })
    expect(onOpenFinding).toHaveBeenCalledTimes(1)
  })
})
