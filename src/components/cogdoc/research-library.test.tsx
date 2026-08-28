// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api-client'
import { useCogdoc } from '@/lib/store'
import type { Project, ReferenceSummary } from '@/lib/types'
import ResearchLibrary, { buildReferenceList } from './research-library'

const reference: ReferenceSummary = {
  id: 'ref-1', rawText: 'Chen, M. (2025). Learning through practice.', style: 'apa',
  authorsJson: '["Maya Chen"]', year: '2025', title: 'Learning through practice',
  doi: '10.1000/example', url: 'https://doi.org/10.1000/example',
  metadataStatus: 'unverified', metadataConfidence: 0, metadataJson: null,
  createdAt: '2026-08-28T00:00:00.000Z', source: null,
}

describe('ResearchLibrary reference verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useCogdoc.setState({
      activeProject: {
        id: 'project-1', title: 'Research', description: null, archived: false,
        createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
        document: null, pdfs: [], interventions: [], _count: { pdfs: 0, interventions: 0 },
      } as Project,
      libraryVersion: 0,
    })
    vi.spyOn(api, 'listPdfs').mockResolvedValue({ pdfs: [] })
    vi.spyOn(api, 'listReferences').mockResolvedValue({ references: [reference] })
  })

  it('checks a saved reference against the registry and shows the match', async () => {
    const verify = vi.spyOn(api, 'verifyReference').mockResolvedValue({
      reference: { ...reference, metadataStatus: 'matched', metadataConfidence: 1 },
      verified: true, confidence: 1,
      metadata: { provider: 'crossref', doi: '10.1000/example', title: reference.title, year: '2025', authors: ['Chen'], url: reference.url },
    })

    render(<ResearchLibrary />)
    fireEvent.click(await screen.findByRole('button', { name: /check registry/i }))

    await waitFor(() => expect(verify).toHaveBeenCalledWith('project-1', 'ref-1'))
    expect(await screen.findByText('Registry match · 100%')).toBeInTheDocument()
  })

  it('records manual confirmation only after the explicit author action', async () => {
    const confirm = vi.spyOn(api, 'confirmReferenceMetadata').mockResolvedValue({
      reference: { ...reference, metadataStatus: 'confirmed' },
    })

    render(<ResearchLibrary />)
    fireEvent.click(await screen.findByRole('button', { name: /i checked the original/i }))

    await waitFor(() => expect(confirm).toHaveBeenCalledWith('project-1', 'ref-1'))
    expect(await screen.findByText('Author confirmed')).toBeInTheDocument()
  })

  it('copies an alphabetized list while keeping insertion author-controlled', async () => {
    const clipboard = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipboard }, configurable: true })
    vi.spyOn(api, 'listReferences').mockResolvedValue({
      references: [
        { ...reference, id: 'ref-z', rawText: 'Williams, N. (2024). Later alphabetically.' },
        { ...reference, id: 'ref-a', rawText: 'Chen, M. (2025). Earlier alphabetically.' },
      ],
    })

    render(<ResearchLibrary />)
    const button = await screen.findByRole('button', { name: 'Copy reference list' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)

    await waitFor(() => expect(clipboard).toHaveBeenCalledWith(
      'Chen, M. (2025). Earlier alphabetically.\n\nWilliams, N. (2024). Later alphabetically.',
    ))
  })
})

describe('buildReferenceList', () => {
  it('sorts formatted entries case-insensitively and skips empty legacy rows', () => {
    expect(buildReferenceList([
      { ...reference, id: '2', rawText: 'zoe, A. (2025). Z.' },
      { ...reference, id: '3', rawText: '   ' },
      { ...reference, id: '1', rawText: 'Adams, B. (2024). A.' },
    ])).toBe('Adams, B. (2024). A.\n\nzoe, A. (2025). Z.')
  })
})
