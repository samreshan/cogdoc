// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { api } from '@/lib/api-client'
import { useCogdoc } from '@/lib/store'
import type { EngineType, Intervention, ReviewItem } from '@/lib/types'
import ActionQueue, { groupActiveInterventions, groupOpenReviewItems, reviewItemContext } from './action-queue'

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

function reviewItem(id: string, type: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    projectId: 'project-1',
    reviewRunId: 'run-1',
    claimId: null,
    type,
    severity: 'advisory',
    title: 'Review this item',
    detail: 'Inspect the underlying academic issue.',
    evidenceJson: '{}',
    anchorJson: null,
    state: 'open',
    blocksCertification: false,
    resolution: null,
    createdAt: '2026-08-31T00:00:00.000Z',
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

  it('shows only the highest-priority intervention when engines target the same phrase', () => {
    const groups = groupActiveInterventions([
      intervention('item-1', 'socratic', { promptText: 'The same phrase.' }),
      intervention('item-2', 'citation', { promptText: '  THE SAME PHRASE. ' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].engineType).toBe('citation')
    expect(groups[0].items.map((item) => item.id)).toEqual(['item-2'])
  })
})

describe('review action presentation', () => {
  it('groups every open item in stable workflow order and excludes closed work', () => {
    const groups = groupOpenReviewItems([
      reviewItem('requirement', 'rubric_gap'),
      reviewItem('reference', 'reference_metadata_unverified'),
      reviewItem('understanding', 'comprehension_check'),
      reviewItem('evidence', 'claim_needs_evidence'),
      reviewItem('other', 'future_review_type'),
      reviewItem('resolved', 'claim_needs_evidence', { state: 'resolved' }),
    ])

    expect(groups.map((group) => group.key)).toEqual([
      'evidence', 'references', 'understanding', 'requirements', 'other',
    ])
    expect(groups.flatMap((group) => group.items).map((item) => item.id)).toEqual([
      'evidence', 'reference', 'understanding', 'requirement', 'other',
    ])
  })

  it('extracts distinctive context from anchored claims and reference metadata', () => {
    expect(reviewItemContext(reviewItem('claim', 'claim_needs_evidence', {
      anchorJson: JSON.stringify({ quote: 'This claim needs a source.' }),
    }))).toBe('This claim needs a source.')

    expect(reviewItemContext(reviewItem('reference', 'reference_not_cited', {
      evidenceJson: JSON.stringify({ reference: { title: 'Research literacy in higher education', doi: '10.1000/example' } }),
    }))).toBe('Research literacy in higher education')
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
    expect(within(detail).getByRole('textbox', { name: 'Your reasoning' })).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: /evaluate answer/i })).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: /find sources/i })).toBeInTheDocument()
    list.mockRestore()
  })

  it('renders large review sets as distinct categories with direct reference actions', async () => {
    const reference = reviewItem('reference-1', 'reference_metadata_unverified', {
      title: 'Reference metadata needs confirmation',
      evidenceJson: JSON.stringify({ reference: { title: 'Research literacy in higher education' } }),
    })
    const evidence = reviewItem('evidence-1', 'claim_needs_evidence', {
      title: 'Claim may need evidence',
      anchorJson: JSON.stringify({ quote: 'Students need reliable evidence.' }),
    })
    useCogdoc.setState({
      activeProject: {
        id: 'project-1', title: 'Research', description: null, archived: false,
        createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z',
        document: null, pdfs: [], interventions: [], _count: { pdfs: 0, interventions: 0 },
      },
      activeInterventions: [],
      editorFocusQuote: null,
      activeModal: 'none',
    })
    const list = vi.spyOn(api, 'listReviewItems').mockResolvedValue({ reviewItems: [reference, evidence], reviewRunId: 'run-1', stale: false })

    render(<ActionQueue />)
    await screen.findByText('Evidence and citations')
    expect(screen.getByText('Reference list')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Reference list'))
    const referenceRow = screen.getAllByText('“Research literacy in higher education”')[0].closest('button')
    expect(referenceRow).not.toBeNull()
    fireEvent.click(referenceRow!)
    fireEvent.click(screen.getByRole('button', { name: /open library/i }))

    expect(useCogdoc.getState().activeModal).toBe('library')
    list.mockRestore()
  })
})
