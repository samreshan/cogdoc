/**
 * POST /api/projects/[id]/add-source
 * Body: { url, title }
 *
 * Fetches the URL directly, strips the HTML to text, chunks it, and adds it
 * to the project's research library — same as if the user had uploaded a PDF.
 *
 * This lets the user one-click add a web source found by "Find sources"
 * to their library, where the Citation Sentinel can then verify claims
 * against it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { chunkText } from '@/lib/retrieval'
import { fetchPublicHtml } from '@/lib/safe-url'

export const runtime = 'nodejs'
export const maxDuration = 45

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|article|section)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const body = await req.json().catch(() => ({}))
  const { url, title } = body as { url: string; title?: string }

  let parsedUrl: URL | null = null
  try { parsedUrl = new URL(url) } catch { /* handled below */ }
  if (!parsedUrl || !['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: 'A valid URL is required' }, { status: 400 })
  }

  const userId = await requireUserId(req)
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  let rawText = ''
  let sourceTitle = title || url

  try {
    const { html, url: finalUrl } = await fetchPublicHtml(url)
    rawText = stripHtml(html)
    if (!title) {
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      if (m?.[1]?.trim()) sourceTitle = m[1].trim().slice(0, 200)
    }
    if (!title) sourceTitle ||= finalUrl.hostname
  } catch (fetchErr) {
    return NextResponse.json({
      error: 'Could not fetch the page content',
      detail: (fetchErr as Error).message,
    }, { status: 502 })
  }

  if (rawText.trim().length < 100) {
    return NextResponse.json({
      error: 'The page content is too short to index. It may be a JavaScript-rendered page or a paywalled article.',
    }, { status: 422 })
  }

  // Cap at 50000 chars to keep the DB reasonable
  rawText = rawText.slice(0, 50000)

  // Create the Pdf record (reuse the same model — it's a "source" regardless of origin)
  const pdf = await db.pdf.create({
    data: {
      projectId,
      userId,
      filename: sourceTitle,
      rawText,
      sizeBytes: Buffer.byteLength(rawText, 'utf-8'),
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
    ok: true,
    source: {
      id: pdf.id,
      filename: sourceTitle,
      url,
      chunkCount: chunks.length,
      sizeBytes: pdf.sizeBytes,
    },
  }, { status: 201 })
}
