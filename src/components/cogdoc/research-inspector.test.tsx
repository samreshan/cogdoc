// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { Intervention, Project } from '@/lib/types'
import { useCogdoc } from '@/lib/store'
import ResearchInspector from './research-inspector'

const project = {
  id: 'project-1', title: 'Research project', description: null, archived: false,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  document: null, pdfs: [], interventions: [], _count: { pdfs: 0, interventions: 0 },
} as Project

const intervention = {
  id: 'intervention-1', userId: 'user-1', projectId: project.id, paragraphId: null,
  promptTemplateTag: null, engineType: 'socratic', promptText: 'A highlighted claim.',
  responseText: 'What would make this claim testable?', verdict: null, status: 'active',
  userAction: null, createdAt: '2026-09-01T00:00:00.000Z', resolvedAt: null,
} as Intervention

afterEach(() => useCogdoc.getState().clearInterventions())

describe('ResearchInspector intervention entry', () => {
  it('shows one focused test action only while an intervention is active', () => {
    useCogdoc.setState({ activeInterventions: [intervention] })
    const { rerender } = render(<ResearchInspector project={project} data={null} loading={false} onRefresh={() => undefined} />)
    expect(screen.getByRole('button', { name: /review highlighted questions/i })).toBeInTheDocument()

    act(() => useCogdoc.getState().clearInterventions())
    rerender(<ResearchInspector project={project} data={null} loading={false} onRefresh={() => undefined} />)
    expect(screen.queryByRole('button', { name: /review highlighted questions/i })).toBeNull()
  })
})
