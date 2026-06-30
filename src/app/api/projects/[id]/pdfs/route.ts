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
import { getDefaultUser } from '@/lib/auth'
import { chunkText } from '@/lib/retrieval'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const user = await getDefaultUser()

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  let filename: string
  let rawText: string
  let sizeBytes: number

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
      try {
        // Dynamic import to avoid bundler issues
        const pdfParse = (await import('pdf-parse')).default
        const data = await pdfParse(buffer)
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
      userId: user.id,
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

  return NextResponse.json({
    pdf: {
      id: pdf.id,
      filename: pdf.filename,
      sizeBytes: pdf.sizeBytes,
      parseStatus: 'ready',
      chunkCount: chunks.length,
    },
  }, { status: 201 })
}

/**
 * GET /api/projects/[id]/pdfs — list PDFs in a project
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const pdfs = await db.pdf.findMany({
    where: { projectId },
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
