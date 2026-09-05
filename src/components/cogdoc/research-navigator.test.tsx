// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Project, ResearchQuestionSummary } from '@/lib/types'
import ResearchNavigator from './research-navigator'

const project = {
  id: 'project-1', title: 'A focused research project', description: 'Test project', archived: false,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  document: {
    id: 'document-1', lastSaved: '2026-09-01T00:00:00.000Z',
    content: JSON.stringify({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Research question' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Methods' }] },
    ] }),
  },
  pdfs: [], interventions: [], _count: { pdfs: 0, interventions: 2 },
} as Project

const questions = [{ id: 'question-1', wording: 'What evidence explains the effect?', state: 'active', revision: 1 }] as ResearchQuestionSummary[]

function renderNavigator(overrides: Partial<React.ComponentProps<typeof ResearchNavigator>> = {}) {
  const props = {
    project,
    questions,
    activeQuestionId: null,
    activeSection: 'collaborator' as const,
    onHome: vi.fn(),
    onSectionChange: vi.fn(),
    onQuestionChange: vi.fn(),
    onCollapse: vi.fn(),
    onOpenHistory: vi.fn(),
    onOpenReferences: vi.fn(),
    ...overrides,
  }
  render(<ResearchNavigator {...props} />)
  return props
}

describe('ResearchNavigator', () => {
  it('keeps contextual tools in one compact project rail', () => {
    renderNavigator()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collaborator/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /sources/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /findings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /plan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /what evidence/i })).toBeInTheDocument()
  })

  it('routes questions and tools through typed callbacks', () => {
    const props = renderNavigator()
    fireEvent.click(screen.getByRole('button', { name: /what evidence/i }))
    expect(props.onQuestionChange).toHaveBeenCalledWith(questions[0])
    fireEvent.click(screen.getByRole('button', { name: /sources/i }))
    expect(props.onSectionChange).toHaveBeenCalledWith('sources')
  })
})
