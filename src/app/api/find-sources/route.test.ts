/**
 * Integration tests for POST /api/find-sources (web search + relevance).
 *
 * Mocks the ZAI SDK's web_search + chat completions. Covers validation,
 * the search→assess pipeline, and the no-results path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const invokeMock = vi.fn()
const createChatMock = vi.fn()
vi.mock('z-ai-web-dev-sdk', () => ({
  default: {
    create: async () => ({
      functions: { invoke: invokeMock },
      chat: { completions: { create: createChatMock } },
    }),
  },
}))
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

beforeEach(() => {
  invokeMock.mockReset(); createChatMock.mockReset()
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
  it('returns sources with assessed relevance', async () => {
    invokeMock.mockResolvedValue({ data: { results: [
      { title: 'Paper A', url: 'https://a', snippet: 'supports' },
      { title: 'Paper B', url: 'https://b', snippet: 'refutes' },
    ] } })
    createChatMock.mockResolvedValue({
      choices: [{ message: { content: '[{"i":0,"relevance":"high","note":"good"},{"i":1,"relevance":"low","note":"weak"}]' } }],
    })

    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toHaveLength(2)
    expect(body.sources[0].relevance).toBe('high')
    expect(body.sources[0].snippet).toBe('good')
    expect(body.totalFound).toBe(2)
  })

  it('returns empty sources with a message when no results', async () => {
    invokeMock.mockResolvedValue({ data: { results: [] } })
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
    expect(body.message).toMatch(/No sources found/)
  })

  it('returns 502 when web_search throws', async () => {
    invokeMock.mockRejectedValue(new Error('unsupported'))
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    expect(res.status).toBe(502)
  })

  it('falls back to medium relevance when LLM assessment fails', async () => {
    invokeMock.mockResolvedValue({ data: [{ title: 'X', url: 'https://x', snippet: 's' }] })
    createChatMock.mockRejectedValue(new Error('llm down'))
    const res = await POST(req({ claim: 'a sufficiently long claim about something' }))
    const body = await res.json()
    expect(body.sources[0].relevance).toBe('medium')
  })
})
