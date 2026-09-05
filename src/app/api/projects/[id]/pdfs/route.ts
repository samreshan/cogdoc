/**
 * POST /api/projects/[id]/pdfs — upload a PDF or paste text into the research library.
 *
 * Accepts multipart/form-data with:
 *   - file: PDF file (extracted via pdf-parse), OR
 *   - text: plain text paste (treated as a single "PDF" with rawText = text and filename = source name)
 *   - filename: required for text paste; ignored for file uploads (uses original filename)
 *
 * The PDF/text is chunked into ~500-token passages and stored in PdfChunk rows.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { chunkText } from '@/lib/retrieval'
import { ingestToVectorStore } from '@/lib/ai-gateway'
import { linkLegacyPdfToLibrary } from '@/lib/research-source-server'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const userId = await requireUserId(req)

  const project = await db.project.findUnique({ where: { id: projectId, userId, deletedAt: null } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  let filename: string
  let rawText: string
  let sizeBytes: number
  let originalBytes: Buffer | null = null

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const textPaste = formData.get('text') as string | null
    const textFilename = formData.get('filename') as string | null

    if (file) {
      filename = file.name
      sizeBytes = file.size
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      originalBytes = buffer
      try {
        // Dynamic import to avoid bundler issues
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: buffer })
        const data = await parser.getText()
        await parser.destroy()
        rawText = data.text || ''
        if (!rawText.trim()) {
          return NextResponse.json(
            { error: 'No text could be extracted from this PDF. It may be a scanned image.' },
            { status: 400 },
          )
        }
      } catch (err) {
        return NextResponse.json(
          { error: `PDF parse failed: ${(err as Error).message}` },
          { status: 400 },
        )
      }
    } else if (textPaste) {
      filename = textFilename || 'Pasted Text.txt'
      rawText = textPaste
      sizeBytes = Buffer.byteLength(textPaste, 'utf-8')
    } else {
      return NextResponse.json({ error: 'No file or text provided' }, { status: 400 })
    }
  } else {
    // JSON body for text paste
    const body = await req.json().catch(() => ({}))
    filename = body.filename || 'Pasted Text.txt'
    rawText = body.text || ''
    sizeBytes = Buffer.byteLength(rawText, 'utf-8')
    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 })
    }
  }

  // Create PDF record
  const pdf = await db.pdf.create({
    data: {
      projectId,
      userId,
      filename,
      rawText,
      sizeBytes,
      parseStatus: 'chunking',
    },
  })

  // Chunk and insert
  const chunks = chunkText(rawText)
  if (chunks.length === 0) {
    await db.pdf.update({ where: { id: pdf.id }, data: { parseStatus: 'failed' } })
    return NextResponse.json({ error: 'No chunks could be extracted' }, { status: 400 })
  }

  await db.pdfChunk.createMany({
    data: chunks.map((c) => ({
      pdfId: pdf.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      charCount: c.charCount,
      pageApprox: c.pageApprox,
    })),
  })

  await db.pdf.update({ where: { id: pdf.id }, data: { parseStatus: 'ready' } })

  // Compatibility route: mirror the project-scoped Pdf into the private,
  // user-global library and retain original PDF bytes for page-level viewing.
  void linkLegacyPdfToLibrary({ pdfId: pdf.id, projectId, userId, filename, rawText, bytes: originalBytes })
    .catch((error) => console.warn(`[pdfs] global-library link failed for pdf=${pdf.id}:`, (error as Error).message))

  // Push the new chunks into the FastAPI vector store so vector retrieval has
  // something to retrieve against when USE_VECTOR_RETRIEVAL is on. SQLite is
  // the source of truth; this push is best-effort and MUST NOT fail the upload
  // — if FastAPI is down the keyword retrieval path keeps the app usable.
  //
  // We always push (not only when isVectorRetrievalEnabled() is true) so the store is
  // warm the moment the flag flips — consistent with how retrieveVectorChunks
  // is gated (the retrieve side only reads the flag, never the ingest side).
  let vectorIngest: 'ok' | 'skipped' | 'failed' = 'ok'
  try {
    // createMany doesn't return inserted rows, so read the ids back to align
    // FastAPI's vector-store chunk ids with the SQLite PdfChunk.id (cuids).
    // DESIGN DECISION (task spec option A): FastAPI stores these ids verbatim,
    // so retrieved evidence chunk_ids are real FKs into SQLite and deep-links
    // resolve. See ingestToVectorStore() in ai-gateway.ts for the full rationale.
    const inserted = await db.pdfChunk.findMany({
      where: { pdfId: pdf.id },
      select: { id: true, chunkIndex: true, content: true, pageApprox: true },
      orderBy: { chunkIndex: 'asc' },
    })
    if (inserted.length > 0) {
      await ingestToVectorStore(
        projectId,
        pdf.id,
        inserted.map((c) => ({ content: c.content, chunk_id: c.id, page_approx: c.pageApprox })),
      )
    } else {
      vectorIngest = 'skipped'
    }
  } catch (err) {
    // FastAPI unreachable or non-2xx — log with context, keep going.
    console.warn(
      `[pdfs] vector ingest failed for pdf=${pdf.id} project=${projectId}:`,
      (err as Error).message,
    )
    vectorIngest = 'failed'
  }

  await db.$transaction((tx) => appendAuditEvent(tx, { projectId, userId, type: 'source_imported', actor: 'student', payload: { summary: `Imported source: ${filename}`, sourceId: pdf.id, filename, chunkCount: chunks.length, retainedOriginalBytes: Boolean(originalBytes), vectorIngest } }))

  return NextResponse.json({
    pdf: {
      id: pdf.id,
      filename: pdf.filename,
      sizeBytes: pdf.sizeBytes,
      parseStatus: 'ready',
      chunkCount: chunks.length,
    },
    vectorIngest,
  }, { status: 201 })
}

/**
 * GET /api/projects/[id]/pdfs — list PDFs in a project
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const userId = await requireUserId(req)
  const project = await db.project.findUnique({ where: { id: projectId, userId, deletedAt: null }, select: { id: true } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const pdfs = await db.pdf.findMany({
    where: { projectId, userId },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      filename: true,
      sizeBytes: true,
      parseStatus: true,
      uploadedAt: true,
      _count: { select: { chunks: true } },
    },
  })
  return NextResponse.json({ pdfs })
}
