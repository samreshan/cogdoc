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
import { retrieveVectorChunks, ingestToVectorStore, type IngestChunk } from '@/lib/ai-gateway'
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

describe('ingestToVectorStore', () => {
  const chunks: IngestChunk[] = [
    { content: 'first passage', chunk_id: 'cuid-aaa', page_approx: 1 },
    { content: 'second passage', chunk_id: 'cuid-bbb', page_approx: 1 },
  ]

  it('POSTs explicit chunks to /api/rag/ingest with aligned chunk ids', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        chunks: [
          { chunk_id: 'cuid-aaa', chunk_index: 0, page_approx: 1 },
          { chunk_id: 'cuid-bbb', chunk_index: 1, page_approx: 1 },
        ],
      }),
    )
    const res = await ingestToVectorStore('p1', 'pdf-1', chunks)

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/rag/ingest')
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    // Option A: the BFF owns content + ids; FastAPI stores them verbatim.
    expect(JSON.parse(init.body)).toEqual({
      project_id: 'p1',
      pdf_id: 'pdf-1',
      chunks: [
        { content: 'first passage', chunk_id: 'cuid-aaa', page_approx: 1 },
        { content: 'second passage', chunk_id: 'cuid-bbb', page_approx: 1 },
      ],
    })
    // The returned ids must round-trip verbatim (SQLite-alignment contract).
    expect(res.chunkIds).toEqual(['cuid-aaa', 'cuid-bbb'])
    expect(res.count).toBe(2)
  })

  it('parses the response into a typed { chunkIds, count } result', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        chunks: [
          { chunk_id: 'x1', chunk_index: 0, page_approx: 2 },
          { chunk_id: 'x2', chunk_index: 1, page_approx: 4 },
          { chunk_id: 'x3', chunk_index: 2, page_approx: 6 },
        ],
      }),
    )
    const res = await ingestToVectorStore('p1', 'pdf-1', chunks)
    expect(res).toEqual({ chunkIds: ['x1', 'x2', 'x3'], count: 3 })
  })

  it('throws on non-2xx so the route layer can catch and degrade gracefully', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ detail: 'boom' }, false, 500))
    await expect(ingestToVectorStore('p1', 'pdf-1', chunks)).rejects.toThrow(/ingest/i)
  })

  it('uses FASTAPI_URL from env', async () => {
    process.env.FASTAPI_URL = 'http://rag.svc.internal:9000'
    fetchMock.mockResolvedValue(mockJsonResponse({ chunks: [] }))
    await ingestToVectorStore('p1', 'pdf-1', [])
    expect(fetchMock.mock.calls[0][0]).toBe('http://rag.svc.internal:9000/api/rag/ingest')
  })
})

describe('streamIntervention', () => {
  it('POSTs to the engine stream endpoint and yields SSE events', async () => {
    const { streamIntervention } = await import('@/lib/ai-gateway')
    const sseBody = 'event: meta\ndata: {"tag":"[Provocation]","engine":"socratic"}\n\n' +
      'event: token\ndata: {"t":"Why"}\n\n' +
      'event: token\ndata: {"t":" is this?"}\n\n' +
      'event: done\ndata: {"intervention_id":"iv-1"}\n\n'
    fetchMock.mockResolvedValue(
      new Response(sseBody, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    )

    const events = []
    for await (const e of streamIntervention('socratic', { project_id: 'p1', context: 'ctx' })) {
      events.push(e)
    }
    expect(events.map((e) => e.type)).toEqual(['meta', 'token', 'token', 'done'])
    expect((events[3] as any).data.intervention_id).toBe('iv-1')
  })

  it('passes the engine + payload as JSON body', async () => {
    const { streamIntervention } = await import('@/lib/ai-gateway')
    fetchMock.mockResolvedValue(
      new Response('event: done\ndata: {"intervention_id":"x"}\n\n', {
        status: 200, headers: { 'content-type': 'text/event-stream' },
      }),
    )
    for await (const _ of streamIntervention('interceptor', { project_id: 'p2', prompt: 'hi' })) {
      // drain
    }
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/ai/interceptor/stream')
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ project_id: 'p2', prompt: 'hi' })
  })

  it('throws on non-ok response', async () => {
    const { streamIntervention } = await import('@/lib/ai-gateway')
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(async () => {
      for await (const _ of streamIntervention('socratic', { project_id: 'p1' })) break
    }).rejects.toThrow()
  })
})

