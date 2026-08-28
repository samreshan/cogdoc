/**
 * Integration tests for POST /api/find-sources (scholarly-first source search).
 *
 * Mocks OpenAlex and Gemini response shapes. Covers scholarly metadata,
 * grounded fallback, no-results, and dual-provider failure.
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

beforeEach(() => {
  vi.restoreAllMocks()
  process.env.GEMINI_API_KEY = 'test-key'
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
      isOpenAccess: true,
      openAccessUrl: 'https://repository.example/paper.pdf',
      citation: {
        authors: ['Maya Chen'], year: '2025', venue: 'Journal of Research',
        volume: '12', issue: '3', pages: '101–119',
        formatted: expect.objectContaining({ style: 'harvard', processor: 'citation-js/citeproc-js' }),
      },
    })
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
      .mockResolvedValueOnce(geminiResponse('[]'))
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
    expect(body.message).toMatch(/No sources found/)
  })

  it('falls back to grounded web search when OpenAlex is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce(geminiResponse('[{"title":"Web report","url":"https://example.org/report","snippet":"Relevant findings","relevance":"high"}]'))
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider).toBe('gemini')
    expect(body.sources[0]).toMatchObject({ title: 'Web report', relevance: 'high' })
  })

  it('returns 502 only when OpenAlex and Gemini both fail', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'quota' } as Response)
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(502)
  })

  it('falls back to grounding chunks at medium relevance when the JSON is unparseable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(openAlexResponse([]))
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
