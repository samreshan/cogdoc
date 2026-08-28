// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { api } from '@/lib/api-client'
import { useCogdoc } from '@/lib/store'
import { formatCitationSuggestions, type FoundSource } from './sources-results'
import SourcesResults from './sources-results'
import type { Project } from '@/lib/types'

const source: FoundSource = {
  title: 'Learning through deliberate practice',
  url: 'https://doi.org/10.1000/example',
  snippet: 'A study of deliberate practice.',
  relevance: 'medium',
  citation: {
    authors: ['Maya Chen', 'Noah Williams'],
    year: '2025',
    venue: 'Journal of Learning Research',
    doi: 'https://doi.org/10.1000/example',
  },
}

describe('formatCitationSuggestions', () => {
  it('formats a transparent APA suggestion and in-text citation', () => {
    const result = formatCitationSuggestions(source, 'apa')
    expect(result?.reference).toContain('Chen, M., & Williams, N. (2025).')
    expect(result?.reference).toContain('Journal of Learning Research')
    expect(result?.inText).toBe('(Chen & Williams, 2025)')
  })

  it('formats a Harvard suggestion', () => {
    const result = formatCitationSuggestions(source, 'harvard')
    expect(result?.reference).toContain('‘Learning through deliberate practice’')
    expect(result?.reference).toContain('Available at: https://doi.org/10.1000/example')
  })

  it('does not invent a citation when metadata is unavailable', () => {
    expect(formatCitationSuggestions({ ...source, citation: undefined }, 'apa')).toBeNull()
  })

  it('keeps surname particles together in author-date citations', () => {
    const result = formatCitationSuggestions({
      ...source,
      citation: { ...source.citation!, authors: ['Jeroen J. G. van Merriënboer'] },
    }, 'apa')
    expect(result?.reference).toContain('van Merriënboer, J. J. G.')
    expect(result?.inText).toBe('(van Merriënboer, 2025)')
  })
})

describe('SourcesResults', () => {
  it('searches the highlighted claim immediately when opened', async () => {
    useCogdoc.setState({
      activeProject: {
        id: 'project-1', title: 'Research', description: null, archived: false,
        createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
        citationStyle: 'harvard', document: null, pdfs: [], interventions: [],
        _count: { pdfs: 0, interventions: 0 },
      } as Project,
    })
    const search = vi.spyOn(api, 'findSources').mockResolvedValue({
      provider: 'openalex',
      sources: [{
        title: 'A scholarly result', url: 'https://doi.org/10.1000/result',
        snippet: 'Relevant abstract.', relevance: 'medium',
      }],
    })

    render(<SourcesResults open onOpenChange={() => {}} claim="Cognitive load affects learning outcomes" />)

    await waitFor(() => expect(search).toHaveBeenCalledWith('Cognitive load affects learning outcomes', 'project-1'))
    expect(await screen.findByText('A scholarly result')).toBeInTheDocument()
    expect(screen.getByText('Scholarly records from OpenAlex')).toBeInTheDocument()
    search.mockRestore()
  })
})
