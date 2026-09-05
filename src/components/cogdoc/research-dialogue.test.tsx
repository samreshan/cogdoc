// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Project } from '@/lib/types'

const mocks = vi.hoisted(() => ({ draftFromResearchDialogue: vi.fn(), recordDecision: vi.fn() }))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { ...original.api, draftFromResearchDialogue: mocks.draftFromResearchDialogue, recordDecision: mocks.recordDecision } }
})

import ResearchDialogue from '@/components/cogdoc/research-dialogue'

const project = { id: 'project-1', title: 'Memory and tools' } as Project

beforeEach(() => {
  vi.clearAllMocks()
  mocks.draftFromResearchDialogue.mockResolvedValue({
    draft: 'A working account grounded in the researcher’s explanation.',
    reflection: 'Does this wording preserve the limitation?',
    sourceNeeds: ['Evidence about delayed recall'],
  })
  mocks.recordDecision.mockResolvedValue({ event: { id: 'audit-1' } })
})

describe('ResearchDialogue', () => {
  it('requires explanation, walks four perspectives, and inserts the editable draft', async () => {
    const user = userEvent.setup()
    const insertion = vi.fn()
    window.addEventListener('cogdoc:insert-research-draft', insertion)
    render(<ResearchDialogue open onOpenChange={vi.fn()} project={project} />)

    expect(screen.getByTestId('research-dialogue-scroll-region')).toHaveClass('min-h-0', 'overflow-y-auto', 'overscroll-contain')
    expect(screen.getByRole('button', { name: 'Close research dialogue' })).toBeInTheDocument()
    expect(screen.getByText('What are you trying to say?')).toBeTruthy()
    await user.type(screen.getByPlaceholderText('Explain your thinking here…'), 'Too short')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/say a little more/i)).toBeTruthy()

    const answers = [
      'I want to understand how external tools alter a researcher’s memory.',
      'Several studies suggest expected access can reduce later recall of specific information.',
      'External tools may free working memory for deeper synthesis instead of weakening thought.',
      'Readers should distinguish deliberate cognitive support from passive dependence on generated answers.',
    ]
    fireEvent.change(screen.getByPlaceholderText('Explain your thinking here…'), { target: { value: answers[0] } })
    await user.click(screen.getByRole('button', { name: /continue/i }))
    for (const answer of answers.slice(1, -1)) {
      await user.type(screen.getByPlaceholderText('Explain your thinking here…'), answer)
      await user.click(screen.getByRole('button', { name: /continue/i }))
    }
    await user.type(screen.getByPlaceholderText('Explain your thinking here…'), answers.at(-1)!)
    await user.click(screen.getByRole('button', { name: /create working draft/i }))

    await waitFor(() => expect(mocks.draftFromResearchDialogue).toHaveBeenCalledWith('project-1', {
      focus: answers[0], evidence: answers[1], tension: answers[2], contribution: answers[3],
    }))
    expect(await screen.findByText('Built from your reasoning')).toBeTruthy()
    expect(screen.getByText(/evidence about delayed recall/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /insert at cursor/i }))
    expect(insertion).toHaveBeenCalledOnce()
    expect(mocks.recordDecision).toHaveBeenCalledWith('project-1', expect.objectContaining({ type: 'research_draft_inserted' }))
    expect((insertion.mock.calls[0][0] as CustomEvent).detail.draft).toMatch(/working account/)
    window.removeEventListener('cogdoc:insert-research-draft', insertion)
  })
})
