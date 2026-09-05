// @vitest-environment happy-dom

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Project } from '@/lib/types'
import { useCogdoc } from '@/lib/store'
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

beforeEach(() => {
  useCogdoc.setState({
    activeProject: project,
    activeInterventions: [],
    ideTabs: [{ id: 'document', kind: 'document', label: 'Working document', closable: false }],
    activeTabId: 'document',
    editorOutlineTarget: null,
    editorContext: { workspaceId: project.id, activeTabId: 'document', activeKind: 'document' },
  })
})

afterEach(() => act(() => useCogdoc.setState({ activeProject: null, activeInterventions: [] })))

describe('ResearchNavigator', () => {
  it('keeps the full research system in four quiet groups', () => {
    render(<ResearchNavigator project={project} data={null} loading={false} onRefresh={() => undefined} />)
    expect(screen.getByText('Document')).toBeInTheDocument()
    expect(screen.getByText('In focus')).toBeInTheDocument()
    expect(screen.getByText('Research')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sources/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument()
  })

  it('keeps outline links clickable and opens history as one focused view', () => {
    render(<ResearchNavigator project={project} data={null} loading={false} onRefresh={() => undefined} />)
    const methods = screen.getByRole('link', { name: /methods/i })
    expect(methods).toHaveAttribute('href', expect.stringMatching(/^#outline-/))
    fireEvent.click(methods)
    expect(useCogdoc.getState().editorOutlineTarget).toMatch(/^outline-/)

    fireEvent.click(screen.getByRole('button', { name: /history/i }))
    expect(useCogdoc.getState().activeTabId).toBe('history:decisions')
  })
})
