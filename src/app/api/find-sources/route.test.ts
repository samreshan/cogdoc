/**
 * Integration tests for POST /api/find-sources (grounded Gemini web search).
 *
 * Mocks global fetch with Gemini generateContent response shapes. Covers
 * validation, the assessed-JSON path, the grounding-chunk fallback, the
 * no-results path, and the API-failure path.
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
  it('returns sources with assessed relevance from the model JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiResponse(
      '[{"title":"Paper A","url":"https://a","snippet":"good","relevance":"high"},' +
      '{"title":"Paper B","url":"https://b","snippet":"weak","relevance":"low"}]',
    ))

    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toHaveLength(2)
    expect(body.sources[0].relevance).toBe('high')
    expect(body.sources[0].snippet).toBe('good')
    expect(body.totalFound).toBe(2)
  })

  it('returns empty sources with a message when no results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiResponse('[]'))
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
    expect(body.message).toMatch(/No sources found/)
  })

  it('returns 502 when the Gemini call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 429, text: async () => 'quota',
    } as Response)
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(502)
  })

  it('falls back to grounding chunks at medium relevance when the JSON is unparseable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiResponse(
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
