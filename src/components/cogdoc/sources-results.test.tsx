// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  recordProvider: 'openalex',
  citation: {
    authors: ['Maya Chen', 'Noah Williams'],
    year: '2025',
    venue: 'Journal of Learning Research',
    doi: 'https://doi.org/10.1000/example',
    volume: '18',
    issue: '2',
    pages: '41-59',
    publisher: 'Learning Press',
    formatted: {
      reference: 'Chen, M., & Williams, N. (2025). Learning through deliberate practice. Journal of Learning Research. https://doi.org/10.1000/example',
      inText: '(Chen & Williams, 2025)',
      style: 'apa',
      processor: 'citation-js/citeproc-js',
    },
  },
}

describe('formatCitationSuggestions', () => {
  it('uses the server-rendered CSL reference and in-text citation', () => {
    const result = formatCitationSuggestions(source)
    expect(result?.reference).toContain('Chen, M., & Williams, N. (2025).')
    expect(result?.reference).toContain('Journal of Learning Research')
    expect(result?.inText).toBe('(Chen & Williams, 2025)')
    expect(result?.processor).toBe('citation-js/citeproc-js')
  })

  it('does not invent a citation when metadata is unavailable', () => {
    expect(formatCitationSuggestions({ ...source, citation: undefined })).toBeNull()
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
        snippet: 'Relevant abstract.', relevance: 'medium', recordProvider: 'openalex',
      }],
    })

    render(<SourcesResults open onOpenChange={() => {}} claim="Cognitive load affects learning outcomes" />)

    await waitFor(() => expect(search).toHaveBeenCalledWith('Cognitive load affects learning outcomes', 'project-1'))
    expect(await screen.findByText('A scholarly result')).toBeInTheDocument()
    expect(screen.getByText('Scholarly records from OpenAlex')).toBeInTheDocument()
    search.mockRestore()
  })

  it('explains Crossref metadata and Unpaywall access provenance', async () => {
    useCogdoc.setState({
      activeProject: {
        id: 'project-1', title: 'Research', description: null, archived: false,
        createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
        citationStyle: 'harvard', document: null, pdfs: [], interventions: [],
        _count: { pdfs: 0, interventions: 0 },
      } as Project,
    })
    const search = vi.spyOn(api, 'findSources').mockResolvedValue({
      provider: 'crossref',
      providersTried: ['openalex', 'crossref'],
      sources: [{
        title: 'An open scholarly result', url: 'https://doi.org/10.1000/open',
        snippet: 'Relevant abstract.', relevance: 'medium', recordProvider: 'crossref',
        isOpenAccess: true,
        openAccessUrl: 'https://repository.example/open.pdf',
        openAccessProvider: 'unpaywall',
        openAccessHostType: 'repository',
        openAccessVersion: 'acceptedVersion',
        openAccessLicense: 'cc-by',
      }],
    })

    render(<SourcesResults open onOpenChange={() => {}} claim="Evidence-informed teaching improves learning outcomes" />)

    expect(await screen.findByText('Scholarly records from Crossref')).toBeInTheDocument()
    expect(screen.getByText('Metadata: Crossref')).toBeInTheDocument()
    expect(screen.getByText(/Free copy via Unpaywall/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open legal copy/i })).toHaveAttribute('href', 'https://repository.example/open.pdf')
    search.mockRestore()
  })

  it('preserves complete citation metadata when saving a discovered source', async () => {
    const user = userEvent.setup()
    useCogdoc.setState({
      activeProject: {
        id: 'project-1', title: 'Research', description: null, archived: false,
        createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
        citationStyle: 'apa', document: null, pdfs: [], interventions: [],
        _count: { pdfs: 0, interventions: 0 },
      } as Project,
    })
    const search = vi.spyOn(api, 'findSources').mockResolvedValue({ provider: 'openalex', sources: [source] })
    const save = vi.spyOn(api, 'addReference').mockResolvedValue({
      alreadySaved: false,
      reference: { id: 'reference-1' } as never,
    })

    render(<SourcesResults open onOpenChange={() => {}} claim="Deliberate practice supports durable learning" />)
    await user.click(await screen.findByRole('button', { name: 'Save' }))

    await waitFor(() => expect(save).toHaveBeenCalledWith('project-1', expect.objectContaining({
      title: source.title,
      authors: source.citation?.authors,
      venue: source.citation?.venue,
      volume: '18',
      issue: '2',
      pages: '41-59',
      publisher: 'Learning Press',
      provider: 'openalex',
    })))
    search.mockRestore()
    save.mockRestore()
  })
})
