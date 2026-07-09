/**
 * Integration tests for /api/projects/[id]/pdfs (upload + list).
 *
 * Covers the JSON text-paste ingestion path (multipart/PDF parsing is
 * exercised separately with a real fixture in Sprint 1's RAG tests).
 * Also covers GET (list PDFs).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: {
    project: { findUnique: vi.fn() },
    pdf: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    pdfChunk: { createMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))

import { POST, GET } from '@/app/api/projects/[id]/pdfs/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'

const findUnique = db.project.findUnique as ReturnType<typeof vi.fn>
const pdfCreate = db.pdf.create as ReturnType<typeof vi.fn>
const pdfUpdate = db.pdf.update as ReturnType<typeof vi.fn>
const chunkCreateMany = db.pdfChunk.createMany as ReturnType<typeof vi.fn>
const pdfFindMany = db.pdf.findMany as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>

beforeEach(() => {
  findUnique.mockReset(); pdfCreate.mockReset(); pdfUpdate.mockReset()
  chunkCreateMany.mockReset(); pdfFindMany.mockReset(); getUser.mockReset()
  getUser.mockResolvedValue({ id: 'u1' })
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

describe('GET /api/projects/[id]/pdfs', () => {
  it('lists PDFs with chunk counts', async () => {
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
