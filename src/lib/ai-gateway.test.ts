/**
 * Tests for the AI gateway seam — the single integration point between the
 * Next.js BFF and the FastAPI RAG service.
 *
 * This is the merge point guarded by the multi-agent "one owner at a time"
 * rule. The gateway must:
 *  - call the FastAPI base URL from FASTAPI_URL env
 *  - return RetrievedChunk[] in the SAME shape as the keyword retrieval path
 *  - throw on non-ok responses
 *  - fall back gracefully if the service is unreachable
 *
 * Mocks global.fetch. The flag USE_VECTOR_RETRIEVAL toggles which path the
 * citation route uses; the gateway is only invoked when the flag is on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retrieveVectorChunks } from '@/lib/ai-gateway'
import type { RetrievedChunk } from '@/lib/retrieval'

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>
const ORIG_URL = process.env.FASTAPI_URL

beforeEach(() => {
  fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  process.env.FASTAPI_URL = 'http://localhost:8000'
})
afterEach(() => {
  vi.restoreAllMocks()
  process.env.FASTAPI_URL = ORIG_URL
})

describe('retrieveVectorChunks', () => {
  it('POSTs to /api/rag/retrieve with claim + project_id + top_k', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        passages: [
          { chunk_id: 'c1', pdf_id: 'pdf-1', text: 'evidence text', score: 0.8, page_approx: 3, pdf_filename: 'a.pdf' },
        ],
      }),
    )
    await retrieveVectorChunks('proj-1', 'a claim', 5)
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/rag/retrieve')
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ claim: 'a claim', project_id: 'proj-1', top_k: 5 })
  })

  it('returns RetrievedChunk[] in the same shape as keyword retrieval', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        passages: [
          { chunk_id: 'c1', pdf_id: 'pdf-1', text: 'passage', score: 0.9, page_approx: 2, pdf_filename: 'a.pdf' },
          { chunk_id: 'c2', pdf_id: 'pdf-1', text: 'another', score: 0.5, page_approx: 4, pdf_filename: 'a.pdf' },
        ],
      }),
    )
    const result = await retrieveVectorChunks('p1', 'claim')
    expect(result).toHaveLength(2)
    // shape parity with RetrievedChunk from retrieval.ts
    expect(result[0]).toMatchObject({
      chunkId: 'c1',
      content: 'passage',
      similarityScore: 0.9,
      pageApprox: 2,
      pdfFilename: 'a.pdf',
    })
  })

  it('throws when the FastAPI service returns non-ok', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ detail: 'bad request' }, false, 422))
    await expect(retrieveVectorChunks('p1', 'claim')).rejects.toThrow()
  })

  it('returns [] when the service returns empty passages', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ passages: [] }))
    expect(await retrieveVectorChunks('p1', 'claim')).toEqual([])
  })

  it('uses FASTAPI_URL from env (not hardcoded)', async () => {
    process.env.FASTAPI_URL = 'http://rag.svc.internal:9000'
    fetchMock.mockResolvedValue(mockJsonResponse({ passages: [] }))
    await retrieveVectorChunks('p1', 'claim')
    expect(fetchMock.mock.calls[0][0]).toBe('http://rag.svc.internal:9000/api/rag/retrieve')
  })
})
