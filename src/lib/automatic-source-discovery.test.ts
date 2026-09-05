import { beforeEach, describe, expect, it, vi } from 'vitest'
import { automaticallyDiscoverSources } from './automatic-source-discovery'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

function candidate(title: string, url: string, doi: string | null = null) {
  return { title, url, snippet: 'Potentially relevant abstract metadata.', relevance: 'medium', recordProvider: 'openalex', citation: { authors: ['Researcher'], year: '2024', venue: 'Journal', doi } }
}

describe('automatic source discovery', () => {
  let apiClient: { findSources: ReturnType<typeof vi.fn>; researchFindingAction: ReturnType<typeof vi.fn>; saveWorkspaceSource: ReturnType<typeof vi.fn> }
  beforeEach(() => {
    apiClient = { findSources: vi.fn(), researchFindingAction: vi.fn().mockResolvedValue({}), saveWorkspaceSource: vi.fn().mockResolvedValue({}) }
  })

  it('deduplicates and saves at most three metadata leads for a confirmed topic', async () => {
    apiClient.findSources.mockResolvedValue({ sources: [candidate('A', 'https://doi.org/10.1/a', '10.1/a'), candidate('A duplicate', 'https://example.test/a', '10.1/a'), candidate('B', 'https://example.test/b'), candidate('C', 'https://example.test/c'), candidate('D', 'https://example.test/d')], providerStatus: { openalex: 'available' } })
    const result = await automaticallyDiscoverSources({ projectId: 'topic-project', query: 'A confirmed research topic', apiClient: apiClient as never, storage: storage() as never })
    expect(result).toMatchObject({ status: 'saved', saved: 3 })
    expect(apiClient.saveWorkspaceSource).toHaveBeenCalledTimes(3)
    expect(apiClient.researchFindingAction).not.toHaveBeenCalled()
    expect(apiClient.saveWorkspaceSource.mock.calls[0][1].metadata).toMatchObject({ automaticSuggestion: true, inspectedContent: false })
  })

  it('links question suggestions through the existing finding journey and skips an unchanged context', async () => {
    const cache = storage()
    apiClient.findSources.mockResolvedValue({ sources: [candidate('A', 'https://example.test/a')], providerStatus: {} })
    const input = { projectId: 'question-project', query: 'What evidence explains this effect?', questionId: 'question-1', apiClient: apiClient as never, storage: cache as never }
    expect((await automaticallyDiscoverSources(input)).saved).toBe(1)
    expect(apiClient.researchFindingAction).toHaveBeenCalledWith('question-project', expect.objectContaining({ action: 'save_discovered_source', questionId: 'question-1' }))
    expect((await automaticallyDiscoverSources(input)).status).toBe('skipped')
    expect(apiClient.findSources).toHaveBeenCalledTimes(1)
  })

  it('keeps existing sources usable when every provider is unavailable', async () => {
    apiClient.findSources.mockRejectedValue(new Error('providers offline'))
    const result = await automaticallyDiscoverSources({ projectId: 'offline-project', query: 'A sufficiently specific topic', apiClient: apiClient as never, storage: storage() as never })
    expect(result.status).toBe('unavailable')
    expect(result.message).toContain('Existing sources were kept')
    expect(apiClient.saveWorkspaceSource).not.toHaveBeenCalled()
  })
})
