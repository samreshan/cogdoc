/**
 * Integration tests for POST /api/projects/[id]/add-source (web URL ingestion).
 *
 * Mocks global fetch. Covers validation, the fetch+strip happy path (with
 * <title> extraction), the too-short-content path, and the fetch-failure path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/lib/db', () => ({
  db: {
    project: { findFirst: vi.fn(async () => ({ id: 'p1' })) },
    pdf: { create: vi.fn(), update: vi.fn() },
    pdfChunk: { createMany: vi.fn() },
  },
}))
vi.mock('@/lib/safe-url', () => ({ fetchPublicHtml: vi.fn() }))

import { POST } from '@/app/api/projects/[id]/add-source/route'
import { fetchPublicHtml } from '@/lib/safe-url'

const safeFetch = fetchPublicHtml as ReturnType<typeof vi.fn>

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}
function req(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/projects/${id}/add-source`, {
    method: 'POST', body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  safeFetch.mockReset()
})

describe('POST /api/projects/[id]/add-source — validation', () => {
  it('returns 400 for a missing/invalid url', async () => {
    const res = await POST(req('p1', { url: 'not-a-url' }), ctx('p1'))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/projects/[id]/add-source — fetch path', () => {
  it('ingests html content, extracts the <title>, and chunks it', async () => {
    safeFetch.mockResolvedValue({ url: new URL('https://example.com/article'), html: '<html><head><title>A Page</title></head><body><p>' + 'A'.repeat(200) + '</p></body></html>' })
    const { db } = await import('@/lib/db')
    ;(db.pdf.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'pdf-1', sizeBytes: 200 })

    const res = await POST(req('p1', { url: 'https://example.com/article' }), ctx('p1'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.source.filename).toBe('A Page') // page <title> used when no title given
    expect(body.source.chunkCount).toBeGreaterThan(0)
  })

  it('keeps the caller-provided title over the page <title>', async () => {
    safeFetch.mockResolvedValue({ url: new URL('https://example.com'), html: '<title>Page Title</title><p>' + 'B'.repeat(200) + '</p>' })
    const { db } = await import('@/lib/db')
    ;(db.pdf.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'pdf-1', sizeBytes: 200 })
    const res = await POST(req('p1', { url: 'https://example.com', title: 'Orig' }), ctx('p1'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.source.filename).toBe('Orig')
  })

  it('returns 422 when extracted content is too short', async () => {
    safeFetch.mockResolvedValue({ url: new URL('https://example.com'), html: '<p>tiny</p>' })
    const res = await POST(req('p1', { url: 'https://example.com' }), ctx('p1'))
    expect(res.status).toBe(422)
  })

  it('returns 502 when the fetch fails', async () => {
    safeFetch.mockRejectedValue(new Error('network'))
    const res = await POST(req('p1', { url: 'https://example.com' }), ctx('p1'))
    expect(res.status).toBe(502)
  })
})
