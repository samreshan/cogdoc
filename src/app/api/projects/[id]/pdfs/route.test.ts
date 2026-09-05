/**
 * Integration tests for /api/projects/[id]/pdfs (upload + list).
 *
 * Covers the JSON text-paste ingestion path (multipart/PDF parsing is
 * exercised separately with a real fixture in Sprint 1's RAG tests).
 * Also covers GET (list PDFs).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findUnique: vi.fn() },
    pdf: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    pdfChunk: { createMany: vi.fn(), findMany: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: vi.fn(async () => ({ id: 'audit-1' })) }))

import { POST, GET } from '@/app/api/projects/[id]/pdfs/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'

const findUnique = db.project.findUnique as ReturnType<typeof vi.fn>
const pdfCreate = db.pdf.create as ReturnType<typeof vi.fn>
const pdfUpdate = db.pdf.update as ReturnType<typeof vi.fn>
const chunkCreateMany = db.pdfChunk.createMany as ReturnType<typeof vi.fn>
const chunkFindMany = db.pdfChunk.findMany as ReturnType<typeof vi.fn>
const pdfFindMany = db.pdf.findMany as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  findUnique.mockReset(); pdfCreate.mockReset(); pdfUpdate.mockReset()
  chunkCreateMany.mockReset(); chunkFindMany.mockReset(); pdfFindMany.mockReset()
  getUser.mockReset()
  getUser.mockResolvedValue({ id: 'u1' })
  // Default: no inserted chunks read back → ingest skipped cleanly. Tests that
  // exercise the ingest path override this with real chunk rows.
  chunkFindMany.mockResolvedValue([])

  // Default FastAPI ingest mock: succeed and round-trip the ids we sent.
  // Per-call tests override this. Set globally so NO test makes a real call.
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ chunks: [] }),
  } as unknown as Response)
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
})

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/projects/[id]/pdfs (text paste via JSON)', () => {
  function jsonReq(id: string, body: unknown) {
    return new NextRequest(`http://localhost/api/projects/${id}/pdfs`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
  }

  it('returns 404 when the project does not exist', async () => {
    findUnique.mockResolvedValue(null)
    const res = await POST(jsonReq('p1', { text: 'hello' }), ctx('p1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 on empty text', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    const res = await POST(jsonReq('p1', { text: '   ' }), ctx('p1'))
    expect(res.status).toBe(400)
  })

  it('creates the PDF, chunks it, and marks parseStatus ready', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    pdfCreate.mockResolvedValue({ id: 'pdf-1', filename: 't.txt', sizeBytes: 100 })
    const longText = 'A'.repeat(100)
    const res = await POST(jsonReq('p1', { text: longText, filename: 'notes.txt' }), ctx('p1'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.pdf.parseStatus).toBe('ready')
    expect(body.pdf.chunkCount).toBeGreaterThan(0)

    // chunk creation was called
    expect(chunkCreateMany).toHaveBeenCalled()
    // final status update to ready
    expect(pdfUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { parseStatus: 'ready' } }))
  })
})

describe('POST /api/projects/[id]/pdfs — FastAPI vector ingest', () => {
  function jsonReq(id: string, body: unknown) {
    return new NextRequest(`http://localhost/api/projects/${id}/pdfs`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
  }

  it('pushes newly-created chunks to FastAPI with aligned SQLite chunk ids', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    pdfCreate.mockResolvedValue({ id: 'pdf-1', filename: 't.txt', sizeBytes: 100 })
    // The route reads back the freshly-inserted PdfChunk rows to get their ids.
    chunkFindMany.mockResolvedValue([
      { id: 'cuid-aaa', chunkIndex: 0, content: 'first', pageApprox: 1 },
      { id: 'cuid-bbb', chunkIndex: 1, content: 'second', pageApprox: 1 },
    ])
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ chunks: [
        { chunk_id: 'cuid-aaa', chunk_index: 0, page_approx: 1 },
        { chunk_id: 'cuid-bbb', chunk_index: 1, page_approx: 1 },
      ] }),
    } as unknown as Response)

    const res = await POST(jsonReq('p1', { text: 'A'.repeat(100), filename: 'n.txt' }), ctx('p1'))
    expect(res.status).toBe(201)

    // The ingest call hit FastAPI ingest with explicit chunks carrying the
    // SQLite PdfChunk.id values (NOT chunk-N auto-ids) — the alignment contract.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8000/api/rag/ingest')
    const sentBody = JSON.parse(init.body)
    expect(sentBody.project_id).toBe('p1')
    expect(sentBody.pdf_id).toBe('pdf-1')
    expect(sentBody.chunks.map((c: { chunk_id: string }) => c.chunk_id)).toEqual(['cuid-aaa', 'cuid-bbb'])

    const body = await res.json()
    expect(body.vectorIngest).toBe('ok')
  })

  it('returns 201 with vectorIngest:"failed" when FastAPI is unreachable, SQLite intact', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    pdfCreate.mockResolvedValue({ id: 'pdf-1', filename: 't.txt', sizeBytes: 100 })
    chunkFindMany.mockResolvedValue([{ id: 'cuid-x', chunkIndex: 0, content: 'first', pageApprox: 1 }])
    // FastAPI rejects — must degrade gracefully, upload still succeeds.
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as unknown as Response)

    const res = await POST(jsonReq('p1', { text: 'A'.repeat(100), filename: 'n.txt' }), ctx('p1'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.pdf.parseStatus).toBe('ready')
    expect(body.vectorIngest).toBe('failed')
    // SQLite chunks were still created.
    expect(chunkCreateMany).toHaveBeenCalled()
  })

  it('returns 201 with vectorIngest:"failed" when fetch throws (network down)', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    pdfCreate.mockResolvedValue({ id: 'pdf-1', filename: 't.txt', sizeBytes: 100 })
    chunkFindMany.mockResolvedValue([{ id: 'cuid-x', chunkIndex: 0, content: 'first', pageApprox: 1 }])
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await POST(jsonReq('p1', { text: 'A'.repeat(100), filename: 'n.txt' }), ctx('p1'))
    expect(res.status).toBe(201)
    expect((await res.json()).vectorIngest).toBe('failed')
  })
})

describe('GET /api/projects/[id]/pdfs', () => {
  it('lists PDFs with chunk counts', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    pdfFindMany.mockResolvedValue([{ id: 'pdf-1', filename: 'a.pdf', _count: { chunks: 7 } }])
    const res = await GET(new NextRequest('http://localhost/api/projects/p1/pdfs'), ctx('p1'))
    expect(res.status).toBe(200)
    expect((await res.json()).pdfs).toHaveLength(1)
  })
})

describe('POST /api/projects/[id]/pdfs (multipart/form-data)', () => {
  it('returns 400 when neither file nor text is provided', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    const fd = new FormData()
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/p1/pdfs`, { method: 'POST', body: fd }),
      ctx('p1'),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/No file or text/)
  })

  it('accepts a text paste via multipart "text" field', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    pdfCreate.mockResolvedValue({ id: 'pdf-1', filename: 'notes.txt', sizeBytes: 50 })
    const fd = new FormData()
    fd.append('text', 'C'.repeat(120))
    fd.append('filename', 'notes.txt')
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/p1/pdfs`, { method: 'POST', body: fd }),
      ctx('p1'),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.pdf.filename).toBe('notes.txt')
  })

  it('uses a default filename when text paste omits it', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    pdfCreate.mockResolvedValue({ id: 'pdf-1', filename: 'Pasted Text.txt', sizeBytes: 50 })
    const fd = new FormData()
    fd.append('text', 'D'.repeat(120))
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/p1/pdfs`, { method: 'POST', body: fd }),
      ctx('p1'),
    )
    expect(res.status).toBe(201)
    expect(pdfCreate.mock.calls[0][0].data.filename).toBe('Pasted Text.txt')
  })

  it('returns 400 when pdf-parse extracts no text', async () => {
    findUnique.mockResolvedValue({ id: 'p1' })
    // Stub the dynamic pdf-parse import to return empty text
    vi.doMock('pdf-parse', () => ({ default: async () => ({ text: '' }) }))
    const fd = new FormData()
    fd.append('file', new File(['x'], 'scan.pdf', { type: 'application/pdf' }))
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/p1/pdfs`, { method: 'POST', body: fd }),
      ctx('p1'),
    )
    expect(res.status).toBe(400)
    vi.doUnmock('pdf-parse')
  })
})
