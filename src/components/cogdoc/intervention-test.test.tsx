// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Intervention } from '@/lib/types'
import { useCogdoc } from '@/lib/store'

const mocks = vi.hoisted(() => ({ answerIntervention: vi.fn(), recordDecision: vi.fn() }))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { ...original.api, answerIntervention: mocks.answerIntervention, recordDecision: mocks.recordDecision } }
})

import InterventionTest from './intervention-test'

const intervention: Intervention = {
  id: 'intervention-1', userId: 'user-1', projectId: 'project-1', paragraphId: null,
  promptTemplateTag: null, engineType: 'citation',
  promptText: 'Routine AI use always weakens independent evidence evaluation.',
  responseText: 'What evidence supports “always,” and where might the relationship differ?',
  verdict: 'insufficient_evidence', status: 'active', userAction: null,
  createdAt: '2026-09-01T00:00:00.000Z', resolvedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.recordDecision.mockResolvedValue({ event: { id: 'audit-1' } })
  useCogdoc.setState({ activeInterventions: [intervention] })
})

afterEach(() => useCogdoc.getState().clearInterventions())

describe('InterventionTest', () => {
  it('debates an incomplete answer and applies the grounded restructuring as an editor event', async () => {
    const followUp = { ...intervention, responseText: 'Which research setting would make your qualification observable?' }
    const resolved = { ...followUp, status: 'resolved' as const, resolvedAt: '2026-09-01T00:02:00.000Z' }
    mocks.answerIntervention
      .mockResolvedValueOnce({
        satisfied: false, evaluator: 'ai', evaluation: { satisfied: false, rationale: 'The boundary is still abstract.', followUpQuestion: followUp.responseText },
        intervention: followUp, note: null, structuredLines: [], revisionProposal: null,
      })
      .mockResolvedValueOnce({
        satisfied: true, evaluator: 'ai', evaluation: { satisfied: true, rationale: 'The claim now has an observable boundary.', followUpQuestion: null },
        intervention: resolved, note: {}, structuredLines: [{ label: 'Qualification', value: 'Effects depend on verification practice.' }],
        revisionProposal: 'Routine AI use may weaken independent evidence evaluation when researchers accept outputs without deliberate verification.',
      })
    const replacement = vi.fn()
    window.addEventListener('cogdoc:replace-research-passage', replacement)
    const user = userEvent.setup()
    render(<InterventionTest open onOpenChange={vi.fn()} />)

    const region = screen.getByTestId('intervention-test-scroll-region')
    expect(region).toHaveClass('min-h-0', 'overflow-y-auto', 'overscroll-contain')
    expect(region.closest('[data-slot="dialog-content"]')).toHaveClass('h-[calc(100dvh-1rem)]', 'overflow-hidden')
    expect(screen.getByRole('button', { name: 'Close intervention test' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Answer in your own words…'), { target: { value: 'The effect probably depends on whether researchers verify generated claims independently.' } })
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(followUp.responseText)).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Answer in your own words…'), { target: { value: 'In source appraisal tasks, independent checking can be measured through error detection rates.' } })
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/restructure the passage from your answer/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /apply restructuring/i }))

    await waitFor(() => expect(replacement).toHaveBeenCalledOnce())
    expect((replacement.mock.calls[0][0] as CustomEvent).detail).toEqual({
      passage: intervention.promptText,
      replacement: 'Routine AI use may weaken independent evidence evaluation when researchers accept outputs without deliberate verification.',
    })
    expect(useCogdoc.getState().activeInterventions).toHaveLength(0)
    expect(mocks.recordDecision).toHaveBeenCalledWith('project-1', expect.objectContaining({ type: 'intervention_revision_applied' }))
    window.removeEventListener('cogdoc:replace-research-passage', replacement)
  })
})
