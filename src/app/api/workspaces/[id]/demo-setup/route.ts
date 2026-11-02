import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { DEMO_SOURCE_CATALOG, DEMO_TOPICS, readableDocumentation } from '@/lib/demo-topics'
import { chunkText } from '@/lib/retrieval'
import { indexSourceChunks } from '@/lib/source-indexing'
import { LIVE_GUIDE_MARKER } from '@/lib/live-research-guide'

export const runtime = 'nodejs'
export const maxDuration = 120
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await requireUserId(req)
  const project = await db.project.findFirst({ where: { id, userId, deletedAt: null }, include: { document: true } })
  if (!project || !project.description?.includes(LIVE_GUIDE_MARKER)) return NextResponse.json({ error: 'Guided workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const topic = DEMO_TOPICS.find((item) => item.id === (body.topicId ?? project.description?.match(/\[demo-topic:([^\]]+)\]/)?.[1]))
  if (!topic) return NextResponse.json({ error: 'Choose a supported demo topic' }, { status: 400 })
  // Starter writing is supplied only during creation by the client; never reset a document on Retry.
  const results: Array<{ title: string; readable: boolean; indexed: number; status: string; message?: string }> = []
  for (const sourceKey of topic.sources) {
    const fixture = DEMO_SOURCE_CATALOG[sourceKey]
    try {
      let pdf = await db.pdf.findFirst({ where: { projectId: id, librarySource: { canonicalUrl: fixture.url } } })
      if (!pdf) {
        // Only server-owned official repository URLs are fetchable. No arbitrary URL proxy.
        const response = await fetch(fixture.textUrl, { redirect: 'error', signal: AbortSignal.timeout(15000) })
        if (!response.ok) throw new Error(`Official documentation returned ${response.status}`)
        const markdown = readableDocumentation(await response.text()).slice(0, 12000)
        if (markdown.trim().length < 100) throw new Error('The documentation response had no usable text')
        const text = `Official documentation excerpt: ${fixture.title}\nOriginal: ${fixture.url}\nRetrieved: ${new Date().toISOString()}\nThis is a bounded excerpt, not the complete page. Page numbers below are approximate offsets.\n\n${markdown}`
        pdf = await db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`
          const already = await tx.pdf.findFirst({ where: { projectId: id, librarySource: { canonicalUrl: fixture.url } } })
          if (already) return already
          const existing = await tx.librarySource.findFirst({ where: { userId, canonicalUrl: fixture.url } })
          const source = existing ?? await tx.librarySource.create({ data: { userId, title: fixture.title, canonicalUrl: fixture.url, parseStatus: 'ready', mimeType: 'text/markdown', metadataJson: JSON.stringify({ origin: 'official_documentation_excerpt', textUrl: fixture.textUrl, fetchedAt: new Date().toISOString(), inspectedContent: false }) } })
          await tx.workspaceSource.upsert({ where: { projectId_librarySourceId: { projectId: id, librarySourceId: source.id } }, update: {}, create: { projectId: id, librarySourceId: source.id } })
          const created = await tx.pdf.create({ data: { projectId: id, userId, librarySourceId: source.id, filename: fixture.title + '.md', rawText: text, parseStatus: 'ready', sizeBytes: Buffer.byteLength(text) } })
          await tx.pdfChunk.createMany({ data: chunkText(text).map((chunk) => ({ ...chunk, pdfId: created.id })) })
          return created
        })
      }
      try { const indexed = await indexSourceChunks(id, pdf.id); results.push({ title: fixture.title, readable: true, indexed: indexed.count, status: 'ready' }) }
      catch { results.push({ title: fixture.title, readable: true, indexed: 0, status: 'indexing_unavailable', message: 'Text is saved. Retry indexing in Sources when the retrieval service is ready.' }) }
    } catch (error) { results.push({ title: fixture.title, readable: false, indexed: 0, status: 'unavailable', message: (error as Error).message }) }
  }
  return NextResponse.json({ sources: results, ready: results.every((source) => source.status === 'ready') })
}
