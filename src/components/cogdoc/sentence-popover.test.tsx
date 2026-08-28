// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Intervention, Project } from '@/lib/types'
import { useCogdoc } from '@/lib/store'
import SentencePopover from './sentence-popover'

const intervention: Intervention = {
  id: 'intervention-1',
  userId: 'user-1',
  projectId: 'project-1',
  paragraphId: null,
  promptTemplateTag: null,
  engineType: 'citation',
  promptText: 'This claim needs supporting evidence.',
  responseText: 'Check the strength of the source support.',
  verdict: 'insufficient_evidence',
  status: 'active',
  userAction: null,
  createdAt: '2026-08-28T00:00:00.000Z',
  resolvedAt: null,
}

afterEach(() => {
  useCogdoc.getState().setHovered(null, null)
  useCogdoc.getState().clearInterventions()
})

describe('SentencePopover accessibility', () => {
  it('announces the intervention dialog and exposes named close controls', () => {
    useCogdoc.setState({
      activeProject: {
        id: 'project-1', title: 'Research', description: null, archived: false,
        createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
        document: null, pdfs: [], interventions: [intervention], _count: { pdfs: 0, interventions: 1 },
      } as Project,
      activeInterventions: [intervention],
      hoveredSentenceKey: 'this claim needs supporting evidence',
      hoveredPosition: { top: 20, left: 20 },
    })

    render(<SentencePopover />)

    expect(screen.getByRole('dialog', { name: 'Interventions for selected passage' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss Galileo intervention' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close interventions' }))
    expect(useCogdoc.getState().hoveredSentenceKey).toBeNull()
  })
})
