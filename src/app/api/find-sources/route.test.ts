/**
 * Integration tests for POST /api/find-sources (scholarly-first source search).
 *
 * Mocks OpenAlex, Crossref, Semantic Scholar, Unpaywall, and Gemini response shapes. Covers
 * scholarly metadata, legal full-text resolution, grounded fallback,
 * no-results, and provider failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/lib/db', () => ({
  db: { project: { findFirst: vi.fn(async () => ({ id: 'p1' })) } },
}))

import { POST } from '@/app/api/find-sources/route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/find-sources', {
    method: 'POST', body: JSON.stringify(body),
  })
}

function geminiResponse(text: string, groundingChunks?: Array<{ web: { uri: string; title: string } }>) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: { parts: [{ text }] },
        ...(groundingChunks ? { groundingMetadata: { groundingChunks } } : {}),
      }],
    }),
  } as Response
}

function openAlexResponse(works: Array<Record<string, unknown>>) {
  return { ok: true, json: async () => ({ results: works }) } as Response
}

function crossrefResponse(items: Array<Record<string, unknown>>) {
  return { ok: true, json: async () => ({ message: { items } }) } as Response
}

function semanticScholarResponse(papers: Array<Record<string, unknown>>) {
  return { ok: true, json: async () => ({ total: papers.length, data: papers }) } as Response
}

function unpaywallResponse(input: Record<string, unknown>) {
  return { ok: true, json: async () => input } as Response
}

beforeEach(() => {
  vi.restoreAllMocks()
  process.env.GEMINI_API_KEY = 'test-key'
  delete process.env.UNPAYWALL_EMAIL
  delete process.env.SEMANTIC_SCHOLAR_API_KEY
})

describe('POST /api/find-sources — validation', () => {
  it('returns 400 when claim is too short', async () => {
    const res = await POST(req({ claim: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when projectId is given but not owned', async () => {
    const { db } = await import('@/lib/db')
    ;(db.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const res = await POST(req({ claim: 'a longer claim here', projectId: 'p1' }))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/find-sources — pipeline', () => {
  it('returns scholarly sources with citation metadata from OpenAlex first', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(openAlexResponse([{
      id: 'https://openalex.org/W1',
      display_name: 'Paper A',
      doi: 'https://doi.org/10.1000/a',
      publication_date: '2025-03-01',
      authorships: [{ author: { display_name: 'Maya Chen' } }],
      primary_location: { source: { display_name: 'Journal of Research' } },
      open_access: { is_oa: true, oa_url: 'https://repository.example/paper' },
      best_oa_location: { pdf_url: 'https://repository.example/paper.pdf' },
      biblio: { volume: '12', issue: '3', first_page: '101', last_page: '119' },
      abstract_inverted_index: { Strong: [0], evidence: [1] },
    }]))

    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider).toBe('openalex')
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0]).toMatchObject({
      title: 'Paper A',
      snippet: 'Strong evidence',
      recordProvider: 'openalex',
      isOpenAccess: true,
      openAccessUrl: 'https://repository.example/paper.pdf',
      openAccessProvider: 'openalex',
      citation: {
        authors: ['Maya Chen'], year: '2025', venue: 'Journal of Research',
        volume: '12', issue: '3', pages: '101–119',
        formatted: expect.objectContaining({ style: 'harvard', processor: 'citation-js/citeproc-js' }),
      },
    })
  })

  it('merges Crossref with the other discovery providers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(openAlexResponse([]))
      .mockResolvedValueOnce(crossrefResponse([{
        DOI: '10.1000/crossref',
        title: ['Crossref indexed study'],
        URL: 'https://doi.org/10.1000/crossref',
        abstract: '<jats:p>Evidence from a longitudinal study.</jats:p>',
        author: [{ given: 'Maya', family: 'Chen' }],
        issued: { 'date-parts': [[2023, 4, 2]] },
        'container-title': ['Journal of Evidence'],
        volume: '7', issue: '2', page: '14-29', publisher: 'Example Press',
      }]))
      .mockResolvedValueOnce(semanticScholarResponse([]))
      .mockResolvedValueOnce(geminiResponse('[]'))

    const res = await POST(req({ claim: 'a sufficiently long claim about longitudinal evidence' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider).toBe('crossref')
    expect(body.providersTried).toEqual(['openalex', 'crossref', 'semantic_scholar', 'gemini'])
    expect(body.sources[0]).toMatchObject({
      title: 'Crossref indexed study',
      url: 'https://doi.org/10.1000/crossref',
      snippet: 'Evidence from a longitudinal study.',
      recordProvider: 'crossref',
      citation: {
        authors: ['Maya Chen'], year: '2023', venue: 'Journal of Evidence',
        doi: '10.1000/crossref', volume: '7', issue: '2', pages: '14-29',
        publisher: 'Example Press',
        formatted: expect.objectContaining({ processor: 'citation-js/citeproc-js' }),
      },
    })
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('resolves a legal open-access location through Unpaywall when configured', async () => {
    process.env.UNPAYWALL_EMAIL = 'research@example.com'
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(openAlexResponse([]))
      .mockResolvedValueOnce(crossrefResponse([{
        DOI: '10.1000/open-copy', title: ['Open study'],
        author: [{ family: 'Chen' }], issued: { 'date-parts': [[2022]] },
      }]))
      .mockResolvedValueOnce(semanticScholarResponse([]))
      .mockResolvedValueOnce(geminiResponse('[]'))
      .mockResolvedValueOnce(unpaywallResponse({
        is_oa: true,
        best_oa_location: {
          url_for_pdf: 'https://repository.example/open-copy.pdf',
          url: 'https://repository.example/open-copy',
          host_type: 'repository', version: 'acceptedVersion', license: 'cc-by',
        },
      }))

    const res = await POST(req({ claim: 'a sufficiently long claim about an open study' }))
    const body = await res.json()
    expect(body.sources[0]).toMatchObject({
      isOpenAccess: true,
      openAccessUrl: 'https://repository.example/open-copy.pdf',
      openAccessProvider: 'unpaywall',
      openAccessHostType: 'repository',
      openAccessVersion: 'acceptedVersion',
      openAccessLicense: 'cc-by',
    })
  })

  it('merges Semantic Scholar with grounded web search', async () => {
    process.env.SEMANTIC_SCHOLAR_API_KEY = 'semantic-test-key'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(openAlexResponse([]))
      .mockResolvedValueOnce(crossrefResponse([]))
      .mockResolvedValueOnce(semanticScholarResponse([{
        paperId: 'paper-1',
        title: 'Semantic Scholar indexed study',
        url: 'https://www.semanticscholar.org/paper/paper-1',
        abstract: 'Evidence from a relevance-ranked scholarly record.',
        year: 2024,
        publicationDate: '2024-05-10',
        venue: 'Evidence Conference',
        citationCount: 17,
        authors: [{ name: 'Maya Chen' }, { name: 'A. Rai' }],
        externalIds: { DOI: '10.1000/semantic' },
        openAccessPdf: {
          url: 'https://repository.example/semantic.pdf', status: 'GOLD', license: 'CC-BY',
        },
        journal: { name: 'Journal of Evidence', volume: '9', pages: '30-42' },
      }]))
      .mockResolvedValueOnce(geminiResponse('[]'))

    const res = await POST(req({ claim: 'a sufficiently long evidence-based claim' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.provider).toBe('semantic_scholar')
    expect(body.providersTried).toEqual(['openalex', 'crossref', 'semantic_scholar', 'gemini'])
    expect(body.sources[0]).toMatchObject({
      title: 'Semantic Scholar indexed study',
      url: 'https://doi.org/10.1000/semantic',
      snippet: 'Evidence from a relevance-ranked scholarly record.',
      recordProvider: 'semantic_scholar',
      openAccessUrl: 'https://repository.example/semantic.pdf',
      openAccessProvider: 'semantic_scholar',
      openAccessVersion: 'GOLD',
      citation: {
        authors: ['Maya Chen', 'A. Rai'], year: '2024', venue: 'Journal of Evidence',
        doi: '10.1000/semantic', volume: '9', pages: '30-42',
        formatted: expect.objectContaining({ processor: 'citation-js/citeproc-js' }),
      },
    })
    const semanticCall = fetchSpy.mock.calls[2]
    expect(String(semanticCall?.[0])).toContain('api.semanticscholar.org/graph/v1/paper/search')
    expect(semanticCall?.[1]).toMatchObject({
      headers: expect.objectContaining({ 'x-api-key': 'semantic-test-key' }),
    })
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('retries a transient Unpaywall failure and caches the DOI result', async () => {
    process.env.UNPAYWALL_EMAIL = 'research@example.com'
    const item = {
      DOI: '10.1000/cached-copy', title: ['Cached open study'],
      author: [{ family: 'Chen' }], issued: { 'date-parts': [[2021]] },
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(openAlexResponse([]))
      .mockResolvedValueOnce(crossrefResponse([item]))
      .mockResolvedValueOnce(semanticScholarResponse([]))
      .mockResolvedValueOnce(geminiResponse('[]'))
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce(unpaywallResponse({
        is_oa: true,
        best_oa_location: { url: 'https://repository.example/cached-copy' },
      }))
      .mockResolvedValueOnce(openAlexResponse([]))
      .mockResolvedValueOnce(crossrefResponse([item]))
      .mockResolvedValueOnce(semanticScholarResponse([]))
      .mockResolvedValueOnce(geminiResponse('[]'))

    const first = await POST(req({ claim: 'a sufficiently long claim about cached access' }))
    const second = await POST(req({ claim: 'a sufficiently long claim about cached access' }))
    expect((await first.json()).sources[0].openAccessUrl).toBe('https://repository.example/cached-copy')
    expect((await second.json()).sources[0].openAccessUrl).toBe('https://repository.example/cached-copy')
    expect(fetchSpy).toHaveBeenCalledTimes(10)
  })

  it('uses the workspace citation style for CSL rendering', async () => {
    const { db } = await import('@/lib/db')
    ;(db.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'p1', citationStyle: 'apa' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(openAlexResponse([{
      id: 'https://openalex.org/W2', display_name: 'Paper B', doi: 'https://doi.org/10.1000/b',
      publication_date: '2024-01-01', authorships: [{ author: { display_name: 'Maya Chen' } }],
      primary_location: { source: { display_name: 'Journal B' } },
    }]))

    const res = await POST(req({ claim: 'a sufficiently long claim about another topic', projectId: 'p1' }))
    const body = await res.json()
    expect(body.sources[0].citation.formatted.style).toBe('apa')
    expect(body.sources[0].citation.formatted.reference).toContain('Chen, M. (2024).')
  })

  it('returns empty sources with a message when no results', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(openAlexResponse([]))
      .mockResolvedValueOnce(crossrefResponse([]))
      .mockResolvedValueOnce(semanticScholarResponse([]))
      .mockResolvedValueOnce(geminiResponse('[]'))
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
    expect(body.message).toMatch(/No sources found/)
  })

  it('falls back to grounded web search when every scholarly provider is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce(geminiResponse('[{"title":"Web report","url":"https://example.org/report","snippet":"Relevant findings","relevance":"high"}]'))
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider).toBe('gemini')
    expect(body.providersTried).toEqual(['openalex', 'crossref', 'semantic_scholar', 'gemini'])
    expect(body.sources[0]).toMatchObject({ title: 'Web report', relevance: 'high', recordProvider: 'gemini' })
  })

  it('returns 502 only when every discovery provider fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'quota' } as Response)
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(502)
  })

  it('falls back to grounding chunks at medium relevance when the JSON is unparseable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(openAlexResponse([]))
      .mockResolvedValueOnce(crossrefResponse([]))
      .mockResolvedValueOnce(semanticScholarResponse([]))
      .mockResolvedValueOnce(geminiResponse(
        'I found some sources but forgot to format them.',
        [{ web: { uri: 'https://x', title: 'X' } }],
      ))
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources[0].relevance).toBe('medium')
    expect(body.sources[0].url).toBe('https://x')
  })
})
