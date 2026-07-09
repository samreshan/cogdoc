/**
 * Integration tests for POST /api/projects/[id]/add-source (web URL ingestion).
 *
 * Mocks the ZAI page_reader + the fetch fallback. Covers validation, the
 * page_reader happy path, the fetch fallback, and the too-short-content path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const invokeMock = vi.fn()
vi.mock('z-ai-web-dev-sdk', () => ({
  default: { create: async () => ({ functions: { invoke: invokeMock } }) },
}))
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/lib/db', () => ({
  db: {
    project: { findFirst: vi.fn(async () => ({ id: 'p1' })) },
    pdf: { create: vi.fn(), update: vi.fn() },
    pdfChunk: { createMany: vi.fn() },
  },
}))

import { POST } from '@/app/api/projects/[id]/add-source/route'

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}
function req(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/projects/${id}/add-source`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

beforeEach(() => {
  invokeMock.mockReset()
})

describe('POST /api/projects/[id]/add-source — validation', () => {
  it('returns 400 for a missing/invalid url', async () => {
    const res = await POST(req('p1', { url: 'not-a-url' }), ctx('p1'))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/projects/[id]/add-source — page_reader path', () => {
  it('ingests html content from page_reader and chunks it', async () => {
    invokeMock.mockResolvedValue({
      data: { html: '<p>' + 'A'.repeat(200) + '</p>', title: 'A Page' },
    })
    const { db } = await import('@/lib/db')
    ;(db.pdf.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'pdf-1', sizeBytes: 200 })

    const res = await POST(req('p1', { url: 'https://example.com/article', title: 'Orig' }), ctx('p1'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.source.filename).toBe('A Page') // page_reader title overrides
    expect(body.source.chunkCount).toBeGreaterThan(0)
  })

  it('ingests text content when only data.text is present', async () => {
    invokeMock.mockResolvedValue({ data: { text: 'B'.repeat(200) } })
    const { db } = await import('@/lib/db')
    ;(db.pdf.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'pdf-1', sizeBytes: 200 })
    const res = await POST(req('p1', { url: 'https://example.com' }), ctx('p1'))
    expect(res.status).toBe(201)
  })

  it('returns 422 when extracted content is too short', async () => {
    invokeMock.mockResolvedValue({ data: { html: '<p>tiny</p>' } })
    const res = await POST(req('p1', { url: 'https://example.com' }), ctx('p1'))
    expect(res.status).toBe(422)
  })
})

describe('POST /api/projects/[id]/add-source — fetch fallback', () => {
  it('falls back to direct fetch when page_reader throws, and 502s if fetch also fails', async () => {
    invokeMock.mockRejectedValue(new Error('no page_reader'))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    const res = await POST(req('p1', { url: 'https://example.com' }), ctx('p1'))
    expect(res.status).toBe(502)
    fetchSpy.mockRestore()
  })
})
