// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { api } from '@/lib/api-client'
import { useCogdoc } from '@/lib/store'
import type { EngineType, Intervention } from '@/lib/types'
import ActionQueue, { groupActiveInterventions } from './action-queue'

function intervention(id: string, engineType: EngineType, overrides: Partial<Intervention> = {}): Intervention {
  return {
    id,
    userId: 'user-1',
    projectId: 'project-1',
    paragraphId: null,
    promptTemplateTag: null,
    engineType,
    promptText: `Passage for ${id}`,
    responseText: `Guidance for ${id}`,
    verdict: null,
    status: 'active',
    userAction: null,
    createdAt: `2026-08-28T00:00:0${id.slice(-1)}.000Z`,
    resolvedAt: null,
    ...overrides,
  }
}

describe('groupActiveInterventions', () => {
  it('groups active anchored items in the research workflow order', () => {
    const groups = groupActiveInterventions([
      intervention('item-1', 'scaffold'),
      intervention('item-2', 'citation'),
      intervention('item-3', 'socratic'),
      intervention('item-4', 'interceptor'),
    ])

    expect(groups.map((group) => group.engineType)).toEqual(['citation', 'interceptor', 'socratic', 'scaffold'])
  })

  it('excludes resolved and unanchored interventions', () => {
    const groups = groupActiveInterventions([
      intervention('item-1', 'citation', { status: 'resolved' }),
      intervention('item-2', 'citation', { promptText: null }),
      intervention('item-3', 'citation'),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((item) => item.id)).toEqual(['item-3'])
  })

  it('orders the newest intervention first inside each category', () => {
    const groups = groupActiveInterventions([
      intervention('item-1', 'citation', { createdAt: '2026-08-28T01:00:00.000Z' }),
      intervention('item-2', 'citation', { createdAt: '2026-08-28T02:00:00.000Z' }),
    ])

    expect(groups[0].items.map((item) => item.id)).toEqual(['item-2', 'item-1'])
  })
})

describe('ActionQueue navigation', () => {
  it('exposes a labelled source query and named review control', async () => {
    useCogdoc.setState({
      activeProject: {
        id: 'project-1', title: 'Research', description: null, archived: false,
        createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
        document: null, pdfs: [], interventions: [], _count: { pdfs: 0, interventions: 0 },
      },
      activeInterventions: [],
      editorFocusQuote: null,
    })
    const list = vi.spyOn(api, 'listReviewItems').mockResolvedValue({ reviewItems: [], reviewRunId: null, stale: false })

    render(<ActionQueue />)
    await waitFor(() => expect(list).toHaveBeenCalledWith('project-1'))

    expect(screen.getByRole('textbox', { name: 'Claim or research question' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run document review' })).toBeInTheDocument()
    list.mockRestore()
  })

  it('groups a signal and sends its exact passage to the editor when clicked', async () => {
    const signal = intervention('item-1', 'citation', { promptText: 'This exact claim needs supporting evidence.' })
    useCogdoc.setState({
      activeProject: {
        id: 'project-1', title: 'Research', description: null, archived: false,
        createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
        document: null, pdfs: [], interventions: [signal], _count: { pdfs: 0, interventions: 1 },
      },
      activeInterventions: [signal],
      editorFocusQuote: null,
    })
    const list = vi.spyOn(api, 'listReviewItems').mockResolvedValue({ reviewItems: [], reviewRunId: null, stale: false })

    render(<ActionQueue />)
    await waitFor(() => expect(list).toHaveBeenCalledWith('project-1'))
    fireEvent.click(screen.getByText('“This exact claim needs supporting evidence.”'))

    expect(useCogdoc.getState().editorFocusQuote).toBe('This exact claim needs supporting evidence.')
    const detail = screen.getByLabelText('Selected intervention')
    expect(within(detail).getByRole('button', { name: /mark addressed/i })).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: /find sources/i })).toBeInTheDocument()
    list.mockRestore()
  })
})
